/**
 * AuthGuard — Component untuk melindungi halaman dari akses tanpa autentikasi.
 * =============================================================================
 *
 * Cara Kerja:
 * 1. Komponen ini adalah client component yang membungkus children dengan proteksi auth.
 * 2. Saat mount, useEffect menjalankan:
 *    a. Cek `accessToken` di localStorage
 *    b. Jika tidak ada token → redirect ke /login
 *    c. Jika ada token → set token ke API, panggil GET /auth/me untuk validasi
 *    d. Jika role-based access (`roles` prop) → cek apakah user.role termasuk
 *       e. Jika role tidak sesuai → redirect ke / (dashboard)
 *       f. Jika role sesuai → setAuthorized(true)
 *    g. Jika token invalid → hapus token, redirect ke /login
 * 3. Selama proses validasi, tampilkan spinner loading.
 * 4. Jika authorized, render children.
 *
 * Alur Lengkap:
 *   <AuthGuard roles={["GURU", "ADMINISTRATOR"]}>
 *       <ProtectedPage />
 *   </AuthGuard>
 *       │
 *       ├─ [Mount] useEffect
 *       │       ├─ Cek localStorage["accessToken"]
 *       │       ├─ Tidak ada → router.push("/login"), return
 *       │       ├─ Ada → api.setToken(token)
 *       │       │       └─ GET /auth/me
 *       │       │           ├─ sukses + data
 *       │       │           │   ├─ roles && !includes → router.push("/") (forbidden)
 *       │       │           │   └─ authorized = true
 *       │       │           └─ gagal → api.setToken(null), router.push("/login")
 *       │       └─ .catch → api.setToken(null), router.push("/login")
 *       │
 *       ├─ [Loading] Tampilkan spinner fullscreen
 *       │
 *       └─ [Authorized] <>{children}</>
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { logger } from "../../lib/logger";
import type { Role } from "../../types";

const MODULE = "AuthGuard"; /** Nama module untuk logger */

/** Interface untuk props AuthGuard */
interface AuthGuardProps {
  children: React.ReactNode;  /** Komponen child yang dilindungi */
  roles?: Role[];             /** Role yang diizinkan mengakses (opsional) */
}

/**
 * AuthGuard — Component wrapper untuk proteksi halaman.
 * Memvalidasi token dan role sebelum menampilkan children.
 *
 * @param children - React children yang akan dilindungi
 * @param roles - Daftar role yang diizinkan (optional, jika tidak ada, hanya cek auth)
 */
export function AuthGuard({ children, roles }: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  /**
   * Effect mount: validasi token dan role-based access.
   * Redirect jika tidak terautentikasi atau tidak punya akses.
   */
  useEffect(() => {
    logger.debug(MODULE, "Validasi akses dimulai", { requiredRoles: roles });

    // Baca token dari localStorage
    const token = localStorage.getItem("accessToken");
    if (!token) {
      // Tidak ada token — redirect ke login
      logger.warn(MODULE, "Tidak ada token — redirect ke /login");
      router.push("/login");
      return;
    }

    // Set token ke instance API dan validasi ke server
    api.setToken(token);
    api
      .get<{ userId: string; role: Role }>("/auth/me")
      .then((res) => {
        if (res.success && res.data) {
          // Token valid — cek role-based access
          const userRole = res.data.role;
          logger.info(MODULE, "User terautentikasi", { userId: res.data.userId, role: userRole });

          if (roles && !roles.includes(userRole)) {
            // Role tidak diizinkan — redirect ke dashboard
            logger.warn(MODULE, "Role tidak diizinkan", { userRole, requiredRoles: roles });
            router.push("/");
            return;
          }

          // Authorized — render children
          logger.debug(MODULE, "Akses diizinkan");
          setAuthorized(true);
        } else {
          // Token tidak valid di server
          logger.warn(MODULE, "Token tidak valid — redirect ke /login");
          api.setToken(null);
          router.push("/login");
        }
      })
      .catch((err) => {
        // Error network/server
        logger.error(MODULE, "Gagal validasi token", { err });
        api.setToken(null);
        router.push("/login");
      });
  }, [router, roles]); /** Dependency: router dan roles */

  /**
   * Render:
   * - Jika belum authorized → spinner loading fullscreen
   * - Jika authorized → render children
   */
  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {/* Spinner loading biru */}
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
