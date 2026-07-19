import type { ApiResponse } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("accessToken");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("accessToken", token);
      document.cookie = `accessToken=${token}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      document.cookie = "accessToken=; path=/; max-age=0";
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.token = accessToken;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
  }

  getRefreshToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("refreshToken");
    }
    return null;
  }

  private async refreshSession(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Deduplicate concurrent refresh calls.
   * Multiple requests that hit 401 simultaneously share one refresh attempt.
   */
  private async ensureFreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      // Another request is already refreshing — wait for it
      return this.refreshPromise;
    }
    this.refreshPromise = this.refreshSession();
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Handle API response — check success flag and expose structured errors.
   * Pages call this instead of raw api.get() to get consistent error handling.
   */
  async handleResponse<T>(response: Promise<ApiResponse<T>>): Promise<T> {
    const res = await response;
    if (!res.success) {
      const message = res.error?.message || "Terjadi kesalahan";
      const code = res.error?.code || "UNKNOWN_ERROR";
      const err = new Error(message) as Error & { code: string; status?: number };
      err.code = code;
      throw err;
    }
    if (res.data === undefined) {
      throw Object.assign(new Error("Data tidak ditemukan"), { code: "EMPTY_DATA" });
    }
    return res.data;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retry = true
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Auto-refresh on 401 Unauthorized — with race condition protection
      if (res.status === 401 && retry) {
        const refreshed = await this.ensureFreshToken();
        if (refreshed) {
          return this.request<T>(method, path, body, false);
        }
        // Refresh failed — clear session
        this.setToken(null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return {
          success: false,
          error: { code: "SESSION_EXPIRED", message: "Sesi berakhir, silakan login ulang" },
        };
      }

      return await res.json();
    } catch (err) {
      return {
        success: false,
        error: { code: "NETWORK_ERROR", message: "Koneksi bermasalah, periksa jaringan Anda" },
      };
    }
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }

  /**
   * Khusus untuk request yang mengembalikan ReadableStream (SSE).
   * Mereturn raw Response objek untuk dibaca secara bertahap oleh caller.
   */
  async requestStream(path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      const refreshed = await this.ensureFreshToken();
      if (refreshed) {
        return this.requestStream(path, body);
      }
      this.setToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Sesi berakhir, silakan login ulang");
    }

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    return res;
  }
}

export const api = new ApiClient();
