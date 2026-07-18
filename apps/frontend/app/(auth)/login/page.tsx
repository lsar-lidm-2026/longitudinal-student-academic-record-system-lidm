"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MagicCard } from "@/components/ui/magic-card";
import { api } from "@/lib/api";
import type { AuthResult } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await api.post<AuthResult>("/auth/login", { username, password });

    if (res.success && res.data) {
      const data = res.data as AuthResult;
      api.setToken(data.accessToken);
      router.push("/");
    } else {
      setError(res.error?.message || "Login gagal");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      <MagicCard
        className="w-full max-w-sm rounded-2xl shadow-xl border-0"
        gradientSize={300}
        gradientFrom="#3B82F6"
        gradientTo="#8B5CF6"
        gradientColor="#E8F0FE"
        gradientOpacity={0.6}
      >
        <div className="relative p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-bold mb-4 shadow-lg">
              L
            </div>
            <h1 className="text-2xl font-bold text-gray-900">LSAR - Longitudinal Student Academic Record</h1>
            <p className="text-xs text-gray-500 mt-1">
              Bantu persiapkan administrasi Buku Induk dengan AI<br />
              Longitudinal Student Academic Record
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
            />

            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full h-11">
              Masuk
            </Button>
          </form>
        </div>
      </MagicCard>
    </div>
  );
}
