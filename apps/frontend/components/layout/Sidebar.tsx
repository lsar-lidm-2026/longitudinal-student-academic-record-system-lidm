/**
 * Sidebar — Komponen navigasi sidebar untuk dashboard.
 * ======================================================
 *
 * Cara Kerja:
 * 1. Komponen menerima `role`, `userName`, dan `onLogout` sebagai props.
 * 2. Mendefinisikan `menuItems` — array statis berisi label, href, icon, dan roles yang diizinkan.
 * 3. Filter menu items berdasarkan `role` user yang sedang login.
 * 4. Gunakan `usePathname()` untuk menentukan item menu aktif (active state).
 * 5. Tampilkan:
 *    a. Logo + brand "LSAR" di header sidebar
 *    b. Navigasi menu (item yang sesuai role)
 *    c. Tombol logout di bagian bawah
 *    d. Info "Peran Aktif" (role label + username)
 * 6. `getRoleLabel(role)` mapping role kode ke label Bahasa Indonesia.
 *
 * Alur Lengkap:
 *   <Sidebar role="GURU" userName="Budi" onLogout={handleLogout} />
 *       │
 *       ├─ Filter menuItems berdasarkan role
 *       │       └─ visibleItems = menuItems.filter(item => item.roles.includes(role))
 *       │
 *       ├─ Render sidebar
 *       │       ├─ Logo + brand LSAR
 *       │       ├─ Nav items (Link)
 *       │       │       └─ Tiap item: icon + label + chevron (jika aktif)
 *       │       └─ Bottom section
 *       │               ├─ Tombol logout
 *       │               └─ Peran Aktif card (role label + username)
 *       │
 *       └─ highlight item berdasarkan pathname matching
 */

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

/** Interface untuk props Sidebar */
interface SidebarProps {
  role: Role;               /** Role user yang sedang login */
  userName: string;         /** Nama lengkap user */
  onLogout: () => void;     /** Handler untuk tombol logout */
}

/**
 * menuItems — Definisi item navigasi sidebar.
 * Setiap item memiliki label, href, icon Lucide, dan roles yang diizinkan.
 */
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

/**
 * getRoleLabel — Mapping role kode (EN) ke label Bahasa Indonesia.
 *
 * @param role - Kode role dari backend
 * @returns Label role dalam Bahasa Indonesia
 */
function getRoleLabel(role: Role) {
  switch (role) {
    case "ADMINISTRATOR": return "Administrator";
    case "OPERATOR_SEKOLAH": return "Operator";
    case "GURU": return "Wali Kelas";
    case "KEPALA_SEKOLAH": return "Kepala Sekolah";
    default: return role; /** Fallback: return raw role code */
  }
}

/**
 * Sidebar — Komponen navigasi sidebar utama dashboard.
 *
 * @param role - Role user (untuk filter menu)
 * @param userName - Nama user (ditampilkan di bagian Peran Aktif)
 * @param onLogout - Callback saat tombol logout diklik
 */
export function Sidebar({ role, userName, onLogout }: SidebarProps) {
  // Baca pathname saat ini untuk highlight item aktif
  const pathname = usePathname();

  // Filter menu items berdasarkan role user
  const visibleItems = menuItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-60 bg-white border-r border-gray-100 h-screen flex flex-col shrink-0">
      {/* Logo Section */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Icon logo: ikon graduation cap di gradasi biru */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {/* Brand name */}
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">LSAR</span>
        </Link>
      </div>

      {/* Navigation Menu Items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          // Deteksi apakah item menu sedang aktif
          // Exact match untuk "/", prefix match untuk path lain
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));
          // Ambil icon component dari definisi item
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              // Styling: aktif → bg biru + text biru, non-aktif → text gray + hover effect
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {/* Icon menu */}
              <Icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"
                }`}
              />
              {/* Label menu */}
              <span className="flex-1">{item.label}</span>
              {/* Chevron indikator (hanya tampil jika item aktif) */}
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section: Logout + Peran Aktif */}
      <div className="px-3 pb-4 mt-auto">
        {/* Tombol Logout */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 rounded-lg transition-colors mb-3"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>

        {/* Peran Aktif Card */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Peran Aktif
          </p>
          {/* Card biru dengan border-left aksen */}
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 border-l-[3px] border-blue-500">
            <p className="text-[13px] font-semibold text-gray-900">{getRoleLabel(role)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{userName}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
