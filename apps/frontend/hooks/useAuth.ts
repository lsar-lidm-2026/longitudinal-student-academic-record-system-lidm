/**
 * useAuth — Custom hook untuk manajemen autentikasi (login, logout, session check).
 * ================================================================================
 *
 * Cara Kerja:
 * 1. Hook ini mengelola state autentikasi: user (JwtPayload), loading, error.
 * 2. Saat mount, hook membaca token dari localStorage. Jika ada token:
 *    a. Set token ke api instance
 *    b. Panggil GET /auth/me untuk validasi token
 *    c. Jika valid → setState dengan data user
 *    d. Jika tidak valid → hapus token, set user = null
 * 3. `login(username, password)`:
 *    a. POST /auth/login dengan kredensial
 *    b. Jika sukses → simpan accessToken & refreshToken, setState user
 *    c. Jika gagal → setState error
 * 4. `logout()`:
 *    a. POST /auth/logout (best-effort)
 *    b. Hapus token, set user = null, redirect ke /login
 *
 * Alur Lengkap:
 *   Komponen memanggil useAuth()
 *       │
 *       ├─ [mount] useEffect
 *       │       ├─ Cek localStorage["accessToken"]
 *       │       ├─ Tidak ada → loading = false, user = null
 *       │       └─ Ada → GET /auth/me
 *       │               ├─ sukses → set user, loading = false
 *       │               └─ gagal → hapus token, loading = false
 *       │
 *       ├─ login(username, password):
 *       │       ├─ POST /auth/login
 *       │       ├─ sukses → simpan tokens, set user, return true
 *       │       └─ gagal → set error, return false
 *       │
 *       ├─ logout():
 *       │       ├─ POST /auth/logout (best-effort)
 *       │       ├─ hapus token, set user = null
 *       │       └─ redirect ke /login
 *       │
 *       └─ return { user, loading, error, login, logout }
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { logger } from "../lib/logger";
import type { JwtPayload, AuthResult } from "../types";

const MODULE = "useAuth"; /** Nama module untuk logger */

/** Interface untuk state internal autentikasi */
interface AuthState {
  user: JwtPayload | null;
  loading: boolean;
  error: string | null;
}

/**
 * useAuth — Hook utama autentikasi.
 * Mengelola user state, login, logout, dan session validation.
 *
 * @returns Object { user, loading, error, login, logout }
 */
export function useAuth() {
  // State autentikasi: default loading = true (sedang cek session)
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  /**
   * Effect mount: validasi session yang ada.
   * Membaca token dari localStorage dan verifikasi ke endpoint /auth/me.
   */
  useEffect(() => {
    logger.debug(MODULE, "Mount — validasi session");

    const token = localStorage.getItem("accessToken");
    if (!token) {
      // Tidak ada token → user tidak terautentikasi
      logger.info(MODULE, "Tidak ada token — user = null");
      setState({ user: null, loading: false, error: null });
      return;
    }

    // Set token ke instance API, lalu validasi ke server
    api.setToken(token);
    api
      .get<JwtPayload>("/auth/me")
      .then((res) => {
        if (res.success && res.data) {
          // Token valid — simpan data user
          logger.info(MODULE, "Session valid", { userId: (res.data as JwtPayload).userId });
          setState({ user: res.data as JwtPayload, loading: false, error: null });
        } else {
          // Token tidak valid di server — hapus
          logger.warn(MODULE, "Token tidak valid — dihapus");
          api.setToken(null);
          setState({ user: null, loading: false, error: null });
        }
      })
      .catch((err) => {
        // Error network/server — anggap session expired
        logger.error(MODULE, "Gagal validasi session", { err });
        api.setToken(null);
        setState({ user: null, loading: false, error: null });
      });
  }, []); /** Hanya jalan sekali di mount */

  /**
   * login — Authentikasi user dengan username dan password.
   *
   * @param username - Nama pengguna
   * @param password - Kata sandi
   * @returns Promise<boolean> — true jika login sukses, false jika gagal
   */
  const login = useCallback(async (username: string, password: string) => {
    logger.info(MODULE, "Login dimulai", { username });
    setState((s) => ({ ...s, loading: true, error: null }));

    // Kirim request login ke backend
    const res = await api.post<AuthResult>("/auth/login", { username, password });

    if (res.success && res.data) {
      // Login sukses — simpan token dan data user
      const data = res.data as AuthResult;
      api.setTokens(data.accessToken, data.refreshToken);
      logger.info(MODULE, "Login berhasil", { userId: data.user.userId, role: data.user.role });
      setState({ user: data.user, loading: false, error: null });
      return true;
    } else {
      // Login gagal — set pesan error
      const errMsg = res.error?.message || "Login gagal";
      logger.warn(MODULE, "Login gagal", { error: errMsg });
      setState({
        user: null,
        loading: false,
        error: errMsg,
      });
      return false;
    }
  }, []);

  /**
   * logout — Logout user dan hapus session.
   * Mengirim request logout ke server (best-effort), lalu redirect ke /login.
   */
  const logout = useCallback(async () => {
    logger.info(MODULE, "Logout dimulai");
    // Attempt server-side logout (best-effort) — ignore error
    await api.post("/auth/logout").catch(() => {
      logger.warn(MODULE, "Logout server gagal — dilanjutkan local cleanup");
    });
    // Hapus token dari instance API
    api.setToken(null);
    // Reset state ke default
    setState({ user: null, loading: false, error: null });
    logger.info(MODULE, "Logout selesai — redirect ke /login");
    // Redirect ke halaman login
    window.location.href = "/login";
  }, []);

  // Return state + methods untuk konsumen hook
  return { ...state, login, logout };
}
