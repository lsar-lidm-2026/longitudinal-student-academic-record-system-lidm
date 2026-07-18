"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { Sidebar } from "../../components/layout/Sidebar";
import { TopHeader } from "../../components/layout/TopHeader";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import { ChatBot } from "../../components/chatbot/ChatBot";
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
    let token = localStorage.getItem("accessToken");

    // Fallback to cookie if not in localStorage (middleware redirected but token is in cookie)
    if (!token) {
      const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
      if (match) token = match[1];
    }

    if (!token) {
      router.replace("/login");
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
          router.replace("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    api.setToken(null);
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <Toaster richColors position="top-right" />
      <Sidebar role={user.role} userName={user.name} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
      <ChatBot />
    </div>
  );
}
