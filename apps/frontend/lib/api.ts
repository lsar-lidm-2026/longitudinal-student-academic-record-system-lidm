/**
 * FILE: lib/api.ts
 * ================
 * Custom HTTP client wrapper untuk seluruh komunikasi dengan backend Elysia API.
 *
 * Cara Kerja:
 * 1. ApiClient membungkus fetch API native dengan JSON serialization dan structured error handling.
 * 2. Token JWT dikelola di localStorage dan cookie — sinkron untuk middleware Next.js.
 * 3. Auto-refresh token pada response 401 dengan deduplication (race condition protection).
 * 4. Semua method HTTP (GET/POST/PUT/PATCH/DELETE) melalui method request<T>().
 * 5. handleResponse() menyediakan error handling konsisten — melempar Error dengan kode.
 * 6. requestStream() khusus untuk SSE/streaming endpoint — mereturn raw Response.
 *
 * Alur Lengkap:
 * 1. Constructor → baca accessToken dari localStorage (client-side only).
 * 2. setToken/setTokens → simpan ke localStorage + cookie untuk dibaca middleware.
 * 3. request<T>() → siapkan headers (Authorization) → fetch → jika 401 & retry=true → refresh.
 * 4. ensureFreshToken() → dedup: hanya satu refresh berjalan, sisanya menunggu.
 * 5. refreshSession() → POST /auth/refresh dengan refreshToken → simpan token baru.
 * 6. Jika refresh gagal → setToken(null) → redirect /login.
 * 7. handleResponse<T>() → cek success flag → throw Error dengan code jika gagal.
 * 8. requestStream() → fetch POST → jika 401 → refresh → retry — return raw Response.
 *
 * Catatan:
 * - Tidak menggunakan axios, hanya fetch API native.
 * - Tidak ada state management (Redux/Zustand) — state via localStorage + cookie.
 *
 * @module ApiClient
 */

import type { ApiResponse } from "../types";
import { logger } from "@/lib/logger";

/** Base URL API — dari environment variable, fallback ke localhost development */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/**
 * ApiClient — Singleton HTTP client wrapper untuk backend Elysia.
 *
 * Menangani:
 * - Token lifecycle (set, get, clear, refresh)
 * - Auto-refresh dengan dedup (cegah multiple refresh bersamaan)
 * - Error terstruktur via handleResponse
 * - SSE streaming via requestStream
 */
class ApiClient {
  /** JWT access token — di-set dari localStorage saat konstruktor, atau via login/refresh */
  private token: string | null = null;
  /** Promise shared untuk dedup refresh token — hanya satu refresh berjalan, sisanya menunggu hasil ini */
  private refreshPromise: Promise<boolean> | null = null;

  /** Inisialisasi: baca token dari localStorage jika di browser */
  constructor() {
    // Hanya jalan di client-side (typeof window check)
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("accessToken");
      logger.info("ApiClient", "Constructor initialized", { hasToken: !!this.token });
    }
  }

  /**
   * Set atau clear access token tunggal.
   * Sinkronisasi ke localStorage + cookie agar middleware Next.js bisa membaca token.
   * Saat clear, refreshToken juga dihapus.
   */
  setToken(token: string | null) {
    logger.info("ApiClient", "setToken", { hasToken: !!token });
    this.token = token;
    if (token) {
      // Set token ke localStorage dan cookie — expiry 7 hari (604800 detik)
      localStorage.setItem("accessToken", token);
      document.cookie = `accessToken=${token}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      // Hapus semua token — untuk logout atau session expired
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      document.cookie = "accessToken=; path=/; max-age=0";
    }
  }

  /**
   * Set access token dan refresh token sekaligus.
   * Dipanggil setelah login sukses atau token refresh berhasil.
   * Kedua token disimpan di localStorage; accessToken juga di-cookie.
   */
  setTokens(accessToken: string, refreshToken: string) {
    logger.info("ApiClient", "setTokens — setting both access and refresh tokens");
    this.token = accessToken;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
  }

  /**
   * getToken — Mengembalikan access token yang sedang aktif.
   * Digunakan untuk request yang tidak bisa pakai ApiClient.request(), misalnya
   * upload file via FormData (multipart) yang butuh header Authorization manual.
   */
  getToken(): string | null {
    return this.token;
  }

  /** Ambil refresh token dari localStorage — digunakan oleh refreshSession() */
  getRefreshToken(): string | null {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("refreshToken");
      logger.debug("ApiClient", "getRefreshToken", { hasToken: !!token });
      return token;
    }
    logger.debug("ApiClient", "getRefreshToken — called server-side, returning null");
    return null;
  }

  /**
   * Refresh JWT session — kirim refreshToken ke endpoint /auth/refresh.
   *
   * Flow:
   * 1. Ambil refreshToken dari localStorage via getRefreshToken()
   * 2. POST ke /auth/refresh dengan refreshToken
   * 3. Jika sukses → simpan token baru via setTokens(), return true
   * 4. Jika gagal atau error → return false
   *
   * Catatan: Method ini dipanggil oleh ensureFreshToken() yang handle dedup.
   */
  private async refreshSession(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      logger.warn("ApiClient", "refreshSession — no refresh token available, cannot refresh");
      return false;
    }

    try {
      logger.info("ApiClient", "refreshSession — attempting to refresh token");
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        // Refresh berhasil — simpan token baru
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        logger.info("ApiClient", "refreshSession — token refreshed successfully");
        return true;
      }
      // Server merespon tapi refresh ditolak
      logger.warn("ApiClient", "refreshSession — server rejected refresh", { success: data.success });
      return false;
    } catch (err) {
      // Network error saat refresh — koneksi bermasalah
      logger.error("ApiClient", "refreshSession — network error during refresh", { err });
      return false;
    }
  }

  /**
   * Deduplicate concurrent refresh calls — proteksi race condition.
   *
   * Masalah: Jika banyak request kena 401 bersamaan, tanpa dedup akan ada N request refresh.
   * Solusi: Hanya satu refresh berjalan, sisanya menunggu promise yang sama.
   *
   * Flow:
   * 1. Cek apakah refreshPromise sudah ada (ada refresh berjalan)
   * 2. Jika ya → return promise yang sudah ada (tunggu hasilnya)
   * 3. Jika tidak → buat promise baru dari refreshSession(), simpan di refreshPromise
   * 4. Setelah selesai → hapus refreshPromise (di finally block)
   */
  private async ensureFreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      // Ada request lain yang sedang refresh — ikut menunggu hasil yang sama
      logger.debug("ApiClient", "ensureFreshToken — another refresh in progress, waiting");
      return this.refreshPromise;
    }
    // Mulai refresh — simpan promise agar request lain bisa ikut menunggu
    this.refreshPromise = this.refreshSession();
    try {
      const result = await this.refreshPromise;
      logger.info("ApiClient", "ensureFreshToken — refresh result", { success: result });
      return result;
    } finally {
      // Reset setelah selesai (sukses atau gagal)
      this.refreshPromise = null;
    }
  }

  /**
   * Handle API response — verifikasi success flag dan expose structured errors.
   *
   * Dipanggil oleh pages/components untuk mendapatkan error handling konsisten:
   * - Jika success=false → throw Error dengan code + message
   * - Jika data undefined → throw Error EMPTY_DATA
   * - Jika sukses → return data
   *
   * Contoh penggunaan:
   *   const students = await api.handleResponse(api.get<Student[]>("/students"));
   */
  async handleResponse<T>(response: Promise<ApiResponse<T>>): Promise<T> {
    const res = await response;
    if (!res.success) {
      // Response gagal — bungkus jadi Error terstruktur dengan kode error
      const message = res.error?.message || "Terjadi kesalahan";
      const code = res.error?.code || "UNKNOWN_ERROR";
      const err = new Error(message) as Error & { code: string; status?: number };
      err.code = code;
      logger.error("ApiClient", "handleResponse — API returned error", { code, message });
      throw err;
    }
    if (res.data === undefined) {
      // Response sukses tapi data kosong — kemungkinan bug di backend
      logger.warn("ApiClient", "handleResponse — success but data is undefined");
      throw Object.assign(new Error("Data tidak ditemukan"), { code: "EMPTY_DATA" });
    }
    return res.data;
  }

  /**
   * Core request method — semua HTTP method melalui sini.
   *
   * Flow lengkap:
   * 1. Siapkan headers: Content-Type + Authorization (jika token ada)
   * 2. Fetch ke `${API_URL}${path}` dengan method, headers, body
   * 3. Cek response status:
   *    a. 401 + retry=true → ensureFreshToken() → retry sekali (retry=false)
   *    b. 401 + retry=false → session expired → redirect login
   *    c. Selain 401 → parse JSON dan return ApiResponse<T>
   * 4. Network error → return { success: false, error: NETWORK_ERROR }
   *
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param path - API endpoint path (e.g. "/students")
   * @param body - Optional request body untuk method POST/PUT/PATCH
   * @param retry - Allow retry on 401 (default true; false after first retry)
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retry = true
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Tambahkan Authorization header jika token tersedia
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    logger.debug("ApiClient", `request — ${method} ${path}`, { hasToken: !!this.token, retry });

    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Auto-refresh pada 401 Unauthorized — dengan proteksi race condition
      if (res.status === 401 && retry) {
        logger.warn("ApiClient", `request — 401 on ${method} ${path}, attempting token refresh`);
        const refreshed = await this.ensureFreshToken();
        if (refreshed) {
          // Token berhasil direfresh — retry request tanpa retry lagi
          logger.info("ApiClient", `request — retrying ${method} ${path} after successful refresh`);
          return this.request<T>(method, path, body, false);
        }
        // Refresh gagal — session expired, redirect ke login
        logger.error("ApiClient", `request — token refresh failed, redirecting to login`);
        this.setToken(null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return {
          success: false,
          error: { code: "SESSION_EXPIRED", message: "Sesi berakhir, silakan login ulang" },
        };
      }

      // Parse response JSON dan return sebagai ApiResponse<T>
      return await res.json();
    } catch (err) {
      // Network error — fetch tidak sampai ke server
      logger.error("ApiClient", `request — network error on ${method} ${path}`, { err });
      return {
        success: false,
        error: { code: "NETWORK_ERROR", message: "Koneksi bermasalah, periksa jaringan Anda" },
      };
    }
  }

  /** HTTP GET request ke endpoint tertentu */
  get<T>(path: string) {
    logger.debug("ApiClient", `GET ${path}`);
    return this.request<T>("GET", path);
  }

  /** HTTP POST request ke endpoint tertentu dengan optional body */
  post<T>(path: string, body?: unknown) {
    logger.debug("ApiClient", `POST ${path}`, { hasBody: !!body });
    return this.request<T>("POST", path, body);
  }

  /** HTTP PUT request ke endpoint tertentu dengan optional body */
  put<T>(path: string, body?: unknown) {
    logger.debug("ApiClient", `PUT ${path}`, { hasBody: !!body });
    return this.request<T>("PUT", path, body);
  }

  /** HTTP PATCH request ke endpoint tertentu dengan optional body */
  patch<T>(path: string, body?: unknown) {
    logger.debug("ApiClient", `PATCH ${path}`, { hasBody: !!body });
    return this.request<T>("PATCH", path, body);
  }

  /** HTTP DELETE request ke endpoint tertentu */
  delete<T>(path: string) {
    logger.debug("ApiClient", `DELETE ${path}`);
    return this.request<T>("DELETE", path);
  }

  /**
   * Khusus untuk request yang mengembalikan ReadableStream (SSE / Server-Sent Events).
   * Berbeda dengan request() yang parse JSON otomatis, method ini return raw Response
   * agar caller bisa membaca stream secara bertahap (response.body.getReader()).
   *
   * Flow:
   * 1. Siapkan headers + Authorization
   * 2. POST fetch ke endpoint
   * 3. Jika 401 → refresh token → retry
   * 4. Jika refresh gagal → throw Error (redirect ke login)
   * 5. Jika response tidak ok → throw Error
   * 6. Return raw Response untuk streaming
   */
  async requestStream(path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    logger.info("ApiClient", `requestStream — ${path}`);

    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 — auto-refresh seperti di request()
    if (res.status === 401) {
      logger.warn("ApiClient", "requestStream — 401, attempting token refresh");
      const refreshed = await this.ensureFreshToken();
      if (refreshed) {
        logger.info("ApiClient", "requestStream — retrying after successful refresh");
        return this.requestStream(path, body);
      }
      // Refresh gagal — session expired
      logger.error("ApiClient", "requestStream — refresh failed, redirecting to login");
      this.setToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Sesi berakhir, silakan login ulang");
    }

    // Handle error status non-401 (e.g. 403, 404, 500)
    if (!res.ok) {
      logger.error("ApiClient", `requestStream — failed with status ${res.status}`);
      throw new Error(`Request failed with status ${res.status}`);
    }

    logger.info("ApiClient", `requestStream — success, returning raw Response for ${path}`);
    return res;
  }
}

/** Singleton instance ApiClient — semua module frontend import ini */
export const api = new ApiClient();
