"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, GraduationCap, ShieldCheck, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import type { AuthResult } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await api.post<AuthResult>("/auth/login", { username, password });

    if (res.success && res.data) {
      const data = res.data as AuthResult;
      api.setTokens(data.accessToken, data.refreshToken);
      router.push("/");
    } else {
      setError(res.error?.message || "Login gagal");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 30%, #3d7ab3 60%, #4a8fc4 100%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-800/40 to-slate-900/70 backdrop-blur-[2px]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">LSAR</h1>
          <p className="text-sm text-blue-200/80 mt-1.5 leading-relaxed">
            Platform Manajemen Akademik Berbasis<br />
            AI untuk Masa Depan Pendidikan
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Selamat Datang Kembali</h2>
            <p className="text-sm text-gray-500 mt-1">
              Masuk ke akun guru atau staf Anda untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email/Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Username / Email
              </label>
              <div className="relative">
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  Lupa sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 h-11 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Ingat saya di perangkat ini</span>
            </label>

            {/* Error */}
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-600/30"
            >
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

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-gray-400 uppercase tracking-wider font-medium">
                Bantuan Akses
              </span>
            </div>
          </div>

          {/* Alt Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button className="h-10 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              Single Sign-On
            </button>
            <button className="h-10 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium">
              Hubungi IT
            </button>
          </div>
        </div>
      </div>

      {/* Security Badge */}
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

      {/* Footer */}
      <div className="relative z-10 text-center mt-4 mb-6">
        <p className="text-xs text-blue-200/60">
          © 2024 LSAR. Dikembangkan untuk pendidik di Indonesia.
        </p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="text-[10px] text-blue-200/50 uppercase tracking-wider hover:text-blue-200/80 cursor-pointer transition-colors">
            Kebijakan Privasi
          </span>
          <span className="text-[10px] text-blue-200/50 uppercase tracking-wider hover:text-blue-200/80 cursor-pointer transition-colors">
            Syarat Ketentuan
          </span>
          <span className="text-[10px] text-blue-200/50 uppercase tracking-wider hover:text-blue-200/80 cursor-pointer transition-colors">
            Panduan Guru
          </span>
        </div>
      </div>
    </div>
  );
}
