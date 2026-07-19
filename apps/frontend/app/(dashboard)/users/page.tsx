"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ini mengelola pengguna sistem (Users). Fitur:
 * - Melihat daftar semua pengguna dengan filter per role (Semua, Guru, Admin, Operator, Kepsek).
 * - Untuk Guru, menampilkan kelas-kelas yang diampu.
 * - Menambah pengguna baru via form di sidebar.
 * - Mengedit nama dan role pengguna.
 * - Mengaktifkan/nonaktifkan status pengguna (toggle).
 *
 * Alur lengkap:
 * 1. useEffect memanggil load() saat mount — GET /users.
 * 2. Data ditampilkan dalam tabel dengan kolom: Username, Nama, Role (badge),
 *    Status (Aktif/Nonaktif), dan Aksi (Edit + Toggle Status).
 * 3. Sidebar kanan menampilkan form tambah/edit pengguna (tampil/sembunyi
 *    via tombol "Tambah Pengguna").
 * 4. Form create: username, password, nama, role.
 *    Form edit: nama, role (username read-only, password tidak diisi ulang).
 * 5. Tombol toggle status mengaktifkan/nonaktifkan user via PATCH.
 * 6. Hanya role ADMINISTRATOR yang bisa mengakses halaman ini via AuthGuard.
 */

import { useEffect, useState, FormEvent } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { Users, Plus, Pencil, X, Power, PowerOff, ShieldCheck, Eye, EyeOff, Trash2 } from "lucide-react";
import type { User, Role } from "@/types";

/** Konfigurasi tampilan untuk setiap role — warna badge dan label */
const roleConfig: Record<Role, { color: string; label: string }> = {
  ADMINISTRATOR: { color: "bg-red-50 text-red-600 border-red-100", label: "Admin" },
  OPERATOR_SEKOLAH: { color: "bg-amber-50 text-amber-600 border-amber-100", label: "Operator" },
  GURU: { color: "bg-blue-50 text-blue-600 border-blue-100", label: "Wali Kelas" },
  KEPALA_SEKOLAH: { color: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Kepsek" },
};

export default function UsersPage() {
  /** Daftar semua pengguna */
  const [users, setUsers] = useState<User[]>([]);
  /** Indikator loading */
  const [loading, setLoading] = useState(true);
  /** State error */
  const [error, setError] = useState<string | null>(null);

  /** Tampilkan/sembunyikan form sidebar */
  const [showForm, setShowForm] = useState(false);
  /** User yang sedang diedit (null = mode create) */
  const [editingUser, setEditingUser] = useState<User | null>(null);
  /** Indikator saving */
  const [saving, setSaving] = useState(false);
  /** State form — username, password, name, role */
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    role: "GURU" as Role,
  });

  /** Toggle show/hide password on create form */
  const [showNewUserPw, setShowNewUserPw] = useState(false);

  /** Filter role yang sedang aktif — null = semua */
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  /** Data kelas untuk menampilkan wali kelas per guru */
  const [teacherClasses, setTeacherClasses] = useState<Record<string, string[]>>({});

  /** Map wali kelas: classId → className untuk lookup cepat */
  const [classNames, setClassNames] = useState<Record<string, string>>({});

  /**
   * load — Mengambil daftar pengguna dari API dan data kelas untuk lookup.
   */
  function load() {
    setLoading(true);
    setError(null);
    logger.info("UsersPage", "Memuat daftar pengguna");
    Promise.all([
      api.handleResponse(api.get<User[]>("/users")),
      api.handleResponse(api.get<any[]>("/classes")),
    ])
      .then(([usersData, classesData]) => {
        setUsers(usersData);
        // Build lookup maps untuk kelas → wali kelas
        const teacherMap: Record<string, string[]> = {};
        const nameMap: Record<string, string> = {};
        for (const cls of classesData) {
          nameMap[cls.id] = cls.name;
          const teacherId = cls.homeroomTeacher?.id;
          if (teacherId) {
            if (!teacherMap[teacherId]) teacherMap[teacherId] = [];
            teacherMap[teacherId].push(cls.name);
          }
        }
        setTeacherClasses(teacherMap);
        setClassNames(nameMap);
        logger.info("UsersPage", "Data berhasil dimuat", { users: usersData.length, classes: classesData.length });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
        logger.error("UsersPage", "Gagal memuat data", { err });
      })
      .finally(() => setLoading(false));
  }

  /** Trigger load saat mount */
  useEffect(() => {
    load();
  }, []);

  /**
   * resetForm — Mereset form ke keadaan awal (tersembunyi, data kosong).
   */
  function resetForm() {
    setShowForm(false);
    setEditingUser(null);
    setForm({ username: "", password: "", name: "", role: "GURU" });
  }

  /**
   * startEdit — Mengisi form dengan data user untuk diedit.
   * @param user - User yang akan diedit
   */
  function startEdit(user: User) {
    setEditingUser(user);
    setForm({ username: user.username, password: "", name: user.name, role: user.role });
    setShowForm(true);
  }

  /**
   * save — Menyimpan data pengguna (create atau update).
   * @param e - Form submit event
   */
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        // Mode edit — update nama dan role (tanpa password)
        logger.info("UsersPage", "Mengupdate pengguna", { userId: editingUser.id });
        await api.handleResponse(
          api.put(`/users/${editingUser.id}`, {
            name: form.name,
            role: form.role,
          })
        );
        toast.success("Pengguna berhasil diperbarui");
        resetForm();
        load();
      } else {
        // Mode create — buat pengguna baru dengan username, password, nama, role
        logger.info("UsersPage", "Membuat pengguna baru", { username: form.username, role: form.role });
        await api.handleResponse(
          api.post("/users", {
            username: form.username,
            password: form.password,
            name: form.name,
            role: form.role,
          })
        );
        toast.success("Pengguna berhasil dibuat");
        resetForm();
        load();
      }
    } catch (err: any) {
      logger.error("UsersPage", "Gagal menyimpan pengguna", { err });
      toast.error(err.message || "Gagal menyimpan pengguna");
    } finally {
      setSaving(false);
    }
  }

  /**
   * toggleStatus — Mengaktifkan/nonaktifkan status pengguna.
   * @param userId - ID user yang akan diubah statusnya
   */
  async function toggleStatus(userId: string) {
    logger.info("UsersPage", "Toggle status pengguna", { userId });
    try {
      await api.handleResponse(api.patch(`/users/${userId}/status`));
      toast.success("Status pengguna berhasil diubah");
      load(); // Refresh daftar
    } catch (err: any) {
      logger.error("UsersPage", "Gagal mengubah status", { err });
      toast.error(err.message || "Gagal mengubah status");
    }
  }

  /**
   * handleDeleteUser — Menghapus pengguna.
   * @param userId - ID user yang akan dihapus
   * @param username - Username untuk dikonfirmasi
   */
  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`Hapus pengguna "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await api.handleResponse(api.delete(`/users/${userId}`));
      toast.success(`Pengguna "${username}" berhasil dihapus`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus pengguna");
    }
  }

  // ── Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    /* AuthGuard: hanya ADMINISTRATOR yang bisa mengakses halaman ini */
    <AuthGuard roles={["ADMINISTRATOR"]}>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Pengguna Sistem
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Kelola akun administrator, operator, dan guru. Filter per role untuk melihat guru dan kelas yang diampu.
            </p>
          </div>
          {/* Tombol toggle form — berubah jadi "Batal" jika form terbuka */}
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Batal" : "Tambah Pengguna"}
          </button>
        </div>

        {/* Grid: tabel (kiri) + form/create (kanan) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ── Main Table Area ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm order-2 lg:order-1">
            {/* ── Role Filter Tabs ──────────────────────────────────────── */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-100">
              {[
                { key: null, label: "Semua" },
                { key: "GURU", label: "Guru" },
                { key: "ADMINISTRATOR", label: "Admin" },
                { key: "OPERATOR_SEKOLAH", label: "Operator" },
                { key: "KEPALA_SEKOLAH", label: "Kepsek" },
              ].map((tab) => (
                <button
                  key={tab.key || "all"}
                  onClick={() => setRoleFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    roleFilter === tab.key
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kelas Diampu</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((user) => !roleFilter || user.role === roleFilter)
                  .map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.name}</td>
                    {/* Badge role — warna berbeda tiap role */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${roleConfig[user.role].color}`}>
                        {roleConfig[user.role].label}
                      </span>
                    </td>
                    {/* Kelas Diampu — untuk guru, tampilkan kelas-kelas yang diampu */}
                    <td className="py-3 px-4 text-sm">
                      {user.role === "GURU" ? (
                        teacherClasses[user.id]?.length > 0 ? (
                          <span className="text-gray-600">
                            {teacherClasses[user.id].join(", ")}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Belum ditugaskan</span>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    {/* Status: Aktif (hijau) / Nonaktif (merah) */}
                    <td className="py-3 px-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Nonaktif
                        </span>
                      )}
                    </td>
                    {/* Tombol aksi: Edit + Toggle Status */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(user)}
                          title="Edit Pengguna"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus(user.id)}
                          title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            user.isActive
                              ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                              : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {user.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Hapus pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Empty state */}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Belum ada pengguna terdaftar.</p>
                      <p className="text-xs text-gray-400 mt-1">Tambahkan pengguna baru melalui form di samping.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Right Sidebar Form ────────────────────────────────────────── */}
          <div className="order-1 lg:order-2 space-y-4">
            {showForm ? (
              /* Form Create / Edit — tampil saat showForm true */
              <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  {editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
                </h3>
                <form onSubmit={save} className="space-y-4">
                  {/* Username — input hanya untuk create, read-only saat edit */}
                  {!editingUser ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Username</label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                        required
                        disabled={saving}
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  ) : (
                    /* Saat edit: username ditampilkan sebagai teks (read-only) */
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm flex justify-between">
                      <span className="text-gray-500">Username</span>
                      <span className="font-semibold text-gray-900">{form.username}</span>
                    </div>
                  )}

                  {/* Nama lengkap */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      disabled={saving}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  {/* Password — hanya untuk create, tidak bisa diedit */}
                  {!editingUser && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          type={showNewUserPw ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                          required
                          minLength={6}
                          disabled={saving}
                          className="w-full h-10 pl-3 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPw(!showNewUserPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewUserPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dropdown role */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Hak Akses (Role)</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                      disabled={saving}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      <option value="GURU">Guru</option>
                      <option value="OPERATOR_SEKOLAH">Operator Sekolah</option>
                      <option value="ADMINISTRATOR">Administrator</option>
                      <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
                    </select>
                  </div>

                  {/* Tombol submit */}
                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : editingUser ? (
                        "Simpan Perubahan"
                      ) : (
                        "Tambahkan"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Info box — tampil saat form tertutup */
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center text-blue-800">
                <ShieldCheck className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-sm font-medium">Manajemen Akses</p>
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  Hanya Administrator yang dapat mengelola pengguna. Pastikan Anda mengatur role yang sesuai.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </AuthGuard>
  );
}
