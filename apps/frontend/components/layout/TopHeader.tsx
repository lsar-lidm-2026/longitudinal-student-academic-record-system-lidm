"use client";

import { Bell, User } from "lucide-react";
import type { JwtPayload } from "../../types";

interface TopHeaderProps {
  user: JwtPayload;
  breadcrumb?: string;
}

function getRoleLabel(role: string) {
  switch (role) {
    case "ADMINISTRATOR": return "Administrator";
    case "OPERATOR_SEKOLAH": return "Operator";
    case "GURU": return "Wali Kelas";
    case "KEPALA_SEKOLAH": return "Kepala Sekolah";
    default: return role;
  }
}

export function TopHeader({ user, breadcrumb }: TopHeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-center shrink-0 w-full">
      <div className="w-full max-w-7xl px-6 flex items-center justify-between">
        {/* Left: Breadcrumb */}
        <div className="text-sm text-gray-500">
          {breadcrumb || "Dashboard"}
        </div>

        {/* Right: Bell + User */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-medium text-gray-900 leading-tight">{user.name}</p>
              <p className="text-[11px] text-gray-400">{getRoleLabel(user.role)}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
