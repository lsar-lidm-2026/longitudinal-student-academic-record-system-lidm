/**
 * Reset Password Page — LSAR Frontend
 * ======================================
 * Cara Kerja:
 * 1. Halaman ini adalah Client Component ("use client") karena menggunakan
 *    useState, event handler, dan navigasi.
 * 2. Membaca token dari URL search params (?token=xxx) via useSearchParams().
 * 3. Menampilkan form dengan dua input password (new + confirm) dan tombol submit.
 * 4. Saat submit:
 *    a. Validasi client-side: password minimal 6 karakter & kedua input harus cocok.
 *    b. POST /api/auth/reset-password dengan { token, newPassword }.
 *    c. Jika sukses: tampilkan pesan sukses + link ke halaman login.
 *    d. Jika gagal: tampilkan toast error dengan pesan dari server.
 * 5. Jika token tidak ada di URL: tampilkan pesan error "Tautan tidak valid".
 *
 * Alur:
 * - User membuka /reset-password?token=xxx dari email reset password.
 * - Halaman membaca token, menampilkan form password baru.
 * - User mengisi password baru & konfirmasi → submit → API call.
 * - Jika sukses → user bisa klik link untuk login.
 * - Jika token expired/invalid → tampilkan error.
 *
 * Logger:
 * - Log info saat render dengan/ tanpa token.
 * - Log info saat submit reset password.
 * - Log error jika validasi atau API gagal.
 *
 * @module ResetPasswordPage
 */

"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, GraduationCap, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

// ── Response type untuk POST /auth/reset-password ───────────────────────
interface ResetPasswordResult {
  message: string;
}

/**
 * ResetPasswordForm — Komponen form reset password yang menggunakan useSearchParams.
 * Dipisahkan dari komponen utama dan dibungkus Suspense di ResetPasswordPage
 * karena useSearchParams() membutuhkan Suspense boundary.
 *
 * @returns JSX element form reset password atau pesan error/ sukses.
 */
function ResetPasswordForm() {
  /** Baca token dari URL search params: ?token=xxx */
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  logger.info("ResetPasswordForm", "Rendered", { hasToken: !!token });

  // ── State untuk form ──────────────────────────────────────────────────
  /** Input password baru */
  const [newPassword, setNewPassword] = useState("");
  /** Input konfirmasi password */
  const [confirmPassword, setConfirmPassword] = useState("");
  /** Toggle visibility password baru */
  const [showNewPassword, setShowNewPassword] = useState(false);
  /** Toggle visibility konfirmasi password */
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  /** Loading state saat submit */
  const [loading, setLoading] = useState(false);
  /** State sukses — form diganti dengan pesan sukses */
  const [success, setSuccess] = useState(false);
  /** Pesan sukses dari server */
  const [successMessage, setSuccessMessage] = useState("");
  /** Pesan error (ditampilkan jika token invalid atau API error) */
  const [error, setError] = useState<string | null>(null);

  // ── Handle ketika token tidak ada di URL ──────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background gradient — konsisten dengan halaman login */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 30%, #3d7ab3 60%, #4a8fc4 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-800/40 to-slate-900/70 backdrop-blur-[2px]" />

        {/* Kartu error — token tidak ditemukan */}
        <div className="relative z-10 w-full max-w-md px-4">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Tautan Tidak Valid</h2>
            <p className="text-sm text-gray-500 mb-6">
              Tautan reset password tidak valid atau tidak mengandung token. Silakan minta tautan reset baru.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Handle ketika reset berhasil ──────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background gradient — konsisten dengan halaman login */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 30%, #3d7ab3 60%, #4a8fc4 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-800/40 to-slate-900/70 backdrop-blur-[2px]" />

        {/* Kartu sukses */}
        <div className="relative z-10 w-full max-w-md px-4">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Password Berhasil Diubah</h2>
            <p className="text-sm text-gray-500 mb-6">
              {successMessage || "Password Anda telah berhasil direset. Silakan login dengan password baru Anda."}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Masuk Sekarang
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /**
   * handleSubmit — Handler saat form reset password disubmit.
   *
   * Alur:
   * 1. Prevent default form submission.
   * 2. Validasi: password minimal 6 karakter & confirm password harus cocok.
   * 3. POST /auth/reset-password dengan { token, newPassword }.
   * 4. Jika sukses: set success state, tampilkan pesan dari server.
   * 5. Jika gagal: tampilkan toast error + set error state untuk banner.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // ── Validasi client-side ──────────────────────────────────────────
    if (newPassword.length < 6) {
      const msg = "Password minimal 6 karakter";
      logger.warn("ResetPasswordForm", "Validation failed: password too short");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = "Konfirmasi password tidak cocok";
      logger.warn("ResetPasswordForm", "Validation failed: passwords do not match");
      setError(msg);
      toast.error(msg);
      return;
    }

    logger.info("ResetPasswordForm", "Submitting reset password request", {
      hasToken: true,
    });

    setLoading(true);

    try {
      // ── API call — POST /auth/reset-password ────────────────────────
      const res = await api.post<ResetPasswordResult>("/auth/reset-password", {
        token,
        newPassword,
      });

      if (res.success && res.data) {
        // ── Sukses ────────────────────────────────────────────────────
        logger.info("ResetPasswordForm", "Reset password successful");
        setSuccessMessage(res.data.message || "Password berhasil direset");
        setSuccess(true);
        toast.success("Password berhasil diubah");
      } else {
        // ── Error dari server ─────────────────────────────────────────
        const errorMsg = res.error?.message || "Gagal mereset password. Token mungkin sudah kadaluwarsa.";
        logger.error("ResetPasswordForm", "Reset password failed", { error: errorMsg });
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: unknown) {
      // ── Network error atau exception tak terduga ────────────────────
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
      logger.error("ResetPasswordForm", "Reset password unexpected error", { err });
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Render form reset password ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient — konsisten dengan halaman login */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 30%, #3d7ab3 60%, #4a8fc4 100%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-800/40 to-slate-900/70 backdrop-blur-[2px]" />

      {/* ── Konten Reset Password ────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">LSAR</h1>
          <p className="text-sm text-blue-200/80 mt-1.5">
            Buat Password Baru
          </p>
        </div>

        {/* ── Kartu Form ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
            <p className="text-sm text-gray-500 mt-1">
              Masukkan password baru untuk akun Anda. Minimal 6 karakter.
            </p>
          </div>

          {/* ── Form ──────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Password Baru */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  autoFocus
                  minLength={6}
                  className="w-full pl-10 pr-10 h-11 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                />
                {/* Toggle show/hide password baru */}
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input Konfirmasi Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Konfirmasi Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 h-11 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                />
                {/* Toggle show/hide konfirmasi password */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Banner — muncul jika ada error dari validasi atau server */}
            {error && (
              <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-600/30"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                "Reset Password"
              )}
            </button>
          </form>

          {/* Link kembali ke login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke halaman login
            </Link>
          </div>
        </div>
      </div>

      {/* ── Security Badge ────────────────────────────────────────────── */}
      <div className="relative z-10 mt-6 mb-2">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <div>
              <p className="text-xs font-semibold text-white">Aman & Terenkripsi</p>
              <p className="text-[10px] text-blue-200/70 mt-0.5">
                Data password dilindungi dengan standar enkripsi industri.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="relative z-10 text-center mt-4 mb-6">
        <p className="text-xs text-blue-200/60">
          © 2024 LSAR. Dikembangkan untuk pendidik di Indonesia.
        </p>
      </div>
    </div>
  );
}

/**
 * ResetPasswordPage — Halaman reset password.
 * Membungkus ResetPasswordForm dalam Suspense karena useSearchParams()
 * memerlukan Suspense boundary sesuai persyaratan Next.js.
 *
 * @returns JSX element dengan Suspense fallback spinner lalu form reset password.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
