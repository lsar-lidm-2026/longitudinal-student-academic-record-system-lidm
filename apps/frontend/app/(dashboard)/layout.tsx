"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/layout/Sidebar";
import { api } from "../../lib/api";
import type { JwtPayload } from "../../types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }

    api.setToken(token);
    api
      .get<JwtPayload>("/auth/me")
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data as JwtPayload);
        } else {
          api.setToken(null);
          router.push("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    api.setToken(null);
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.name} onLogout={handleLogout} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
