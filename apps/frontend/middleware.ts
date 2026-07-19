/**
 * FILE: middleware.ts
 * ====================
 * Next.js Edge Middleware — proteksi route dan redirect berdasarkan authentication state.
 * Berjalan di Edge Runtime (sebelum request mencapai halaman).
 *
 * Cara Kerja:
 * 1. Middleware membaca accessToken dari cookie (set oleh ApiClient di browser).
 * 2. Tentukan apakah route yang diakses adalah dashboard route (perlu login).
 * 3. Jika dashboard route & tidak ada token → redirect ke /login dengan redirect param.
 * 4. Jika /login & ada token → redirect ke / (dashboard) — cegah akses login page saat sudah login.
 * 5. Selain itu → NextResponse.next() — lanjutkan request normal.
 *
 * Alur Lengkap:
 * 1. Request masuk → middleware() dipanggil oleh Next.js Edge Runtime.
 * 2. Ekstrak pathname dari request URL.
 * 3. Baca cookie "accessToken" — token di-set oleh ApiClient.setToken().
 * 4. Evaluasi isDashboardRoute:
 *    - BUKAN /login
 *    - BUKAN /_next/* (static assets & internals)
 *    - BUKAN /api/* (backend API proxying)
 *    - BUKAN /favicon (browser icon request)
 * 5. Jika perlu login tapi tidak ada token → redirect 307 ke /login?redirect=pathname.
 * 6. Jika sudah login tapi buka /login → redirect ke /.
 * 7. Jika tidak ada kondisi di atas → lanjutkan (NextResponse.next()).
 *
 * Catatan:
 * - Middleware TIDAK memverifikasi validitas JWT — hanya mengecek keberadaan cookie.
 * - Verifikasi token dilakukan oleh backend di setiap request API.
 * - Cookie di-set dengan max-age=604800 (7 hari) oleh ApiClient.
 * - Edge Runtime: tidak bisa import logger yang bergantung pada Node.js API.
 *
 * @module Middleware
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware utama — intercept setiap request yang match config.matcher.
 * Berjalan di Edge Runtime sebelum request mencapai route handler.
 *
 * @param request - NextRequest objek dari Edge Runtime
 * @returns NextResponse — redirect atau lanjutkan request
 */
export function middleware(request: NextRequest) {
  // Ekstrak pathname dari URL request untuk routing logic
  const { pathname } = request.nextUrl;

  // Baca accessToken dari cookie — di-set oleh ApiClient.setToken() saat login
  const token = request.cookies.get("accessToken")?.value;

  // Tentukan apakah route ini perlu proteksi (dashboard route)
  // Route dashboard = semua route kecuali /login, Next.js internals, API, dan favicon
  const isDashboardRoute =
    pathname !== "/login" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/favicon");

  // Proteksi: dashboard route tanpa token → redirect ke login
  if (isDashboardRoute && !token) {
    // Buat URL login dengan redirect param agar setelah login kembali ke halaman semula
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    // console tersedia di Edge Runtime — gunakan untuk log sederhana
    console.info(`[Middleware] Redirect to login — no token for ${pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  // Jika user sudah login tapi mengakses /login → redirect ke dashboard
  if (pathname === "/login" && token) {
    console.info(`[Middleware] Redirect to dashboard — already logged in accessing /login`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Tidak ada kondisi khusus — lanjutkan request normal
  return NextResponse.next();
}

/**
 * Konfigurasi matcher — menentukan route mana yang diproses middleware.
 *
 * Pola regex: "/((?!_next/static|_next/image|favicon.ico).*)"
 * - Match semua route KECUALI:
 *   - _next/static (static files: JS, CSS, images)
 *   - _next/image (image optimization API)
 *   - favicon.ico
 *
 * Catatan: Tidak perlu exclude /api karena dihandle oleh isDashboardRoute.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
