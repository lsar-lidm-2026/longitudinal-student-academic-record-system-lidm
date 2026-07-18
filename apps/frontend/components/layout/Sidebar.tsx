"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "../../types";

interface SidebarProps {
  role: Role;
  userName: string;
  onLogout: () => void;
}

const menuItems: Record<string, { label: string; href: string; roles: Role[] }[]> = {
  main: [
    { label: "Dashboard", href: "/", roles: ["ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH"] },
    { label: "Siswa", href: "/students", roles: ["GURU", "KEPALA_SEKOLAH", "OPERATOR_SEKOLAH"] },
    { label: "ML Dashboard", href: "/ml", roles: ["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH"] },
    { label: "Kelas", href: "/classes", roles: ["ADMINISTRATOR"] },
    { label: "Tahun Ajaran", href: "/academic-years", roles: ["ADMINISTRATOR"] },
    { label: "Pengguna", href: "/users", roles: ["ADMINISTRATOR"] },
  ],
  bottom: [
    { label: "Pengaturan", href: "/settings", roles: ["ADMINISTRATOR", "OPERATOR_SEKOLAH", "GURU", "KEPALA_SEKOLAH"] },
  ],
};

export function Sidebar({ role, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = menuItems.main.filter((item) => item.roles.includes(role));
  const bottomItems = menuItems.bottom.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-blue-600">LSAR</h1>
        <p className="text-xs text-gray-500 mt-1">{userName}</p>
        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 mt-1">
          {role === "ADMINISTRATOR" ? "Admin" :
           role === "OPERATOR_SEKOLAH" ? "Operator" :
           role === "GURU" ? "Guru" : "Kepala Sekolah"}
        </span>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 space-y-1">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={onLogout}
          className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
