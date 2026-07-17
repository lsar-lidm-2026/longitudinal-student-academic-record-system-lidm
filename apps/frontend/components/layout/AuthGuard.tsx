"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import type { Role } from "../../types";

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

export function AuthGuard({ children, roles }: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }

    api.setToken(token);
    api
      .get<{ userId: string; role: Role }>("/auth/me")
      .then((res) => {
        if (res.success && res.data) {
          if (roles && !roles.includes(res.data.role)) {
            router.push("/");
            return;
          }
          setAuthorized(true);
        } else {
          api.setToken(null);
          router.push("/login");
        }
      })
      .catch(() => {
        api.setToken(null);
        router.push("/login");
      });
  }, [router, roles]);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
