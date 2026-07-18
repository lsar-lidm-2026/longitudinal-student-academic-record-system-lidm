"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MagicCard } from "@/components/ui/magic-card";
import { ShineBorder } from "@/components/ui/shine-border";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      <MagicCard
        className="w-full max-w-sm p-0 shadow-2xl"
        gradientColor="#D9D9D933"
        gradientSize={300}
      >
        <ShineBorder className="rounded-2xl" borderWidth={1}>
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                LSAR
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
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

              <Button type="submit" loading={loading} className="w-full">
                Masuk
              </Button>
            </form>
          </div>
        </ShineBorder>
      </MagicCard>
    </div>
  );
}
