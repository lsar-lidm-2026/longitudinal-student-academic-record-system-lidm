/**
 * Login Page — LSAR Frontend
 * ============================
 * Cara Kerja:
 * 1. Halaman ini adalah Client Component ("use client") karena menggunakan
 *    useState, useEffect (via hooks), event handler, dan router navigation.
 * 2. User memasukkan username/email dan password melalui form controlled components.
 * 3. Saat submit, fungsi handleSubmit() dipanggil:
 *    a. Mencegah reload default browser (e.preventDefault()).
 *    b. Set state loading = true, error = null.
 *    c. Panggil api.post<AuthResult>("/auth/login", { username, password }).
 *    d. Jika sukses: simpan accessToken & refreshToken via api.setTokens(), redirect ke "/".
 *    e. Jika gagal: tampilkan pesan error dari response.
 * 4. Form terdiri dari input username, input password (dengan toggle show/hide),
 *    checkbox "remember me", tombol submit, dan error banner.
 *
 *
 * Alur:
 * - User membuka /login → halaman dirender dengan form kosong.
 * - User mengisi username & password → onChange update state.
 * - User klik "Masuk Sekarang" → handleSubmit() → API call → redirect atau error.
 * - Jika redirect ke "/", middleware/dashboard layout akan memvalidasi token.
 *
 * Logger:
 * - Log info saat submit login.
 * - Log error jika login gagal.
 * - Log info saat redirect sukses.
 */

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, GraduationCap, ShieldCheck, ArrowRight, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AuthResult } from "@/types";
import { logger } from "@/lib/logger";

/**
 * LoginPage — Komponen utama halaman login.
 * Mengelola form autentikasi dengan state lokal (tanpa Redux/Zustand sesuai MVP).
 *
 * @returns JSX element halaman login dengan form, background, dan footer.
 */
export default function LoginPage() {
  /** Router Next.js untuk navigasi setelah login sukses */
  const router = useRouter();

  /** State untuk input username/email — dikontrol via onChange */
  const [username, setUsername] = useState("");
  /** State untuk input password — dikontrol via onChange */
  const [password, setPassword] = useState("");
  /** State toggle untuk menampilkan/sembunyikan password (ikon mata) */
  const [showPassword, setShowPassword] = useState(false);
  /** State checkbox "Ingat saya di perangkat ini" */
  const [rememberMe, setRememberMe] = useState(false);
  /** State indikator loading — true saat API call berlangsung */
  const [loading, setLoading] = useState(false);
  /** State pesan error — ditampilkan di banner merah jika login gagal */
  const [error, setError] = useState<string | null>(null);

  // ── Forgot Password States ──────────────────────────────────────────
  /** Kontrol visibilitas modal lupa kata sandi */
  const [showForgotModal, setShowForgotModal] = useState(false);
  /** Input email untuk form reset password */
  const [forgotEmail, setForgotEmail] = useState("");
  /** Loading state saat mengirim tautan reset */
  const [forgotLoading, setForgotLoading] = useState(false);

  /**
   * handleSubmit — Handler saat form login disubmit.
   * Melakukan validasi client-side minimal, lalu POST ke endpoint /auth/login.
   *
   * @param e — Form event untuk mencegah reload default.
   */
  async function handleSubmit(e: FormEvent) {
    /* Mencegah browser reload form submission */
    e.preventDefault();

    /* Reset state sebelum API call */
    setLoading(true);
    setError(null);

    logger.info("LoginPage", "Submitting login form", { username });

    /* Kirim request login ke backend */
    const res = await api.post<AuthResult>("/auth/login", { username, password });

    /* Response sukses — simpan token dan redirect */
    if (res.success && res.data) {
      const data = res.data as AuthResult;
      api.setTokens(data.accessToken, data.refreshToken);
      logger.info("LoginPage", "Login successful, redirecting to dashboard", {
        role: data.user?.role,
      });
      router.push("/");
    } else {
      /* Response gagal — tampilkan pesan error dari server atau default */
      const errorMsg = res.error?.message || "Login gagal";
      logger.error("LoginPage", "Login failed", { error: errorMsg });
      setError(errorMsg);
      setLoading(false);
    }
  }

  // ── Forgot Password Handler ─────────────────────────────────────────

  /**
   * handleForgotPassword — Kirim permintaan reset password ke API.
   * Alur:
   * 1. Validasi email tidak kosong.
   * 2. POST /auth/forgot-password dengan body { email }.
   * 3. Jika sukses → toast success, tutup modal, reset form email.
   * 4. Jika gagal → toast error dari server atau default.
   */
  async function handleForgotPassword() {
    // Validasi client-side: email wajib diisi
    if (!forgotEmail.trim()) {
      toast.error("Email tidak boleh kosong");
      return;
    }

    logger.info("LoginPage", "Mengirim permintaan reset password", { email: forgotEmail });
    setForgotLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail.trim() });

      if (res.success) {
        logger.info("LoginPage", "Reset password link berhasil dikirim", { email: forgotEmail });
        toast.success("Tautan reset password telah dikirim ke email Anda");
        // Tutup modal dan reset form
        setShowForgotModal(false);
        setForgotEmail("");
      } else {
        // Server merespon error — tampilkan pesan dari server
        const errorMsg = res.error?.message || "Gagal mengirim tautan reset";
        logger.error("LoginPage", "Gagal kirim reset password", { error: errorMsg });
        toast.error(errorMsg);
      }
    } catch (err: unknown) {
      // Network error atau exception tidak terduga
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
      logger.error("LoginPage", "Error saat kirim permintaan reset password", { err });
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    /* ── Container Utama ────────────────────────────────────── */
    /* min-h-screen full viewport, flex column untuk stacking vertikal,
       relative + overflow-hidden untuk efek background gradient */
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background — gradient biru gelap dengan efek overlay blur */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 30%, #3d7ab3 60%, #4a8fc4 100%)",
        }}
      />
      {/* Overlay gelap dengan backdrop blur untuk meningkatkan readability konten */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-800/40 to-slate-900/70 backdrop-blur-[2px]" />

      {/* ── Konten Login ────────────────────────────────────── */}
      {/* z-10 agar di atas background, max-w-md untuk lebar maksimal form */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          {/* Ikon GraduationCap dalam kotak biru dengan shadow */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          {/* Nama aplikasi */}
          <h1 className="text-2xl font-bold text-white tracking-tight">LSAR</h1>
          {/* Tagline */}
          <p className="text-sm text-blue-200/80 mt-1.5 leading-relaxed">
            Platform Manajemen Akademik Berbasis<br />
            AI untuk Masa Depan Pendidikan
          </p>
        </div>

        {/* ── Kartu Login ────────────────────────────────────── */}
        {/* Container putih dengan shadow, padding 8 (32px), border radius 2xl */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8">
          {/* Header kartu */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Selamat Datang Kembali</h2>
            <p className="text-sm text-gray-500 mt-1">
              Masuk ke akun guru atau staf Anda untuk melanjutkan.
            </p>
          </div>

          {/* ── Form Login ──────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Username/Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                {/* Ikon mail di kiri input */}
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nama@sekolah.sch.id"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 h-11 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              {/* Label + link "Lupa sandi?" */}
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Lupa sandi?
                </button>
              </div>
              <div className="relative">
                {/* Ikon lock di kiri input */}
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  /* Toggle type antara password dan text berdasarkan showPassword state */
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 h-11 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                />
                {/* Tombol toggle show/hide password — ikon mata */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox "Ingat saya" */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Ingat saya di perangkat ini</span>
            </label>

            {/* Error Banner — hanya tampil jika ada error */}
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-600/30"
            >
              {/* Loading spinner atau teks "Masuk Sekarang" */}
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Masuk Sekarang
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* ── Forgot Password Modal ───────────────────────────────────── */}
          {showForgotModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              {/* Panel modal — card putih dengan shadow */}
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
                {/* Header: judul + tombol close */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Lupa Kata Sandi</h3>
                  <button
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotEmail("");
                    }}
                    disabled={forgotLoading}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body: deskripsi + input email */}
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-gray-500">
                    Masukkan email terdaftar Anda untuk menerima tautan reset password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="nama@sekolah.sch.id"
                        className="w-full pl-10 pr-4 h-11 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer: tombol Batal + Kirim */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotEmail("");
                    }}
                    disabled={forgotLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleForgotPassword}
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      "Kirim Tautan Reset"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Security Badge ──────────────────────────────────── */}
      {/* Informasi keamanan dengan efek backdrop blur */}
      <div className="relative z-10 mt-6 mb-2">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <div>
              <p className="text-xs font-semibold text-white">Aman & Terenkripsi</p>
              <p className="text-[10px] text-blue-200/70 mt-0.5">
                Data siswa dan nilai akademik dilindungi dengan standar enkripsi industri.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      {/* Informasi copyright dan tautan kebijakan */}
      <div className="relative z-10 text-center mt-4 mb-6">
        <p className="text-xs text-blue-200/60">
          © 2024 LSAR. Dikembangkan untuk pendidik di Indonesia.
        </p>
        {/* Catatan: Tautan kebijakan (privasi, syarat, panduan) akan ditambahkan
             setelah halaman-halaman tersebut tersedia. */}
      </div>
    </div>
  );
}
