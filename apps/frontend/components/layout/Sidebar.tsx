"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  BookOpen,
  Settings,
  ChevronRight,
  LogOut,
  GraduationCap,
} from "lucide-react";
import type { Role } from "../../types";

interface SidebarProps {
  role: Role;
  userName: string;
  onLogout: () => void;
}

const menuItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH"] as Role[],
  },
  {
    label: "Data Siswa",
    href: "/students",
    icon: Users,
    roles: ["GURU", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"] as Role[],
  },
  {
    label: "AI Assistant",
    href: "/ml",
    icon: Sparkles,
    roles: ["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH"] as Role[],
  },
  {
    label: "Buku Induk",
    href: "/classes",
    icon: BookOpen,
    roles: ["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"] as Role[],
  },
  {
    label: "Pengaturan",
    href: "/settings",
    icon: Settings,
    roles: ["ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH"] as Role[],
  },
];

function getRoleLabel(role: Role) {
  switch (role) {
    case "ADMINISTRATOR": return "Administrator";
    case "OPERATOR_SEKOLAH": return "Operator";
    case "GURU": return "Wali Kelas";
    case "KEPALA_SEKOLAH": return "Kepala Sekolah";
    default: return role;
  }
}

export function Sidebar({ role, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = menuItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-60 bg-white border-r border-gray-100 h-screen flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">LSAR</span>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"
                }`}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* PERAN AKTIF */}
      <div className="px-3 pb-4 mt-auto">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 rounded-lg transition-colors mb-3"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Peran Aktif
          </p>
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 border-l-[3px] border-blue-500">
            <p className="text-[13px] font-semibold text-gray-900">{getRoleLabel(role)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{userName}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
