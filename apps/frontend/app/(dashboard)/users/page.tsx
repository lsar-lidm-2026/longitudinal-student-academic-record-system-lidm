"use client";

import { useEffect, useState, FormEvent } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { User, Role } from "@/types";

const roleConfig: Record<Role, { variant: "info" | "success" | "warning" | "danger"; label: string }> = {
  ADMINISTRATOR: { variant: "danger", label: "Admin" },
  OPERATOR_SEKOLAH: { variant: "warning", label: "Operator" },
  GURU: { variant: "info", label: "Guru" },
  KEPALA_SEKOLAH: { variant: "success", label: "Kepsek" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "GURU" as Role });

  function load() {
    setLoading(true);
    setError(null);
    api.handleResponse(api.get<User[]>("/users"))
      .then(setUsers)
      .catch((err) => setError(err.message || "Gagal memuat data pengguna"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setShowForm(false);
    setEditingUser(null);
    setForm({ username: "", password: "", name: "", role: "GURU" });
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setForm({ username: user.username, password: "", name: user.name, role: user.role });
    setShowForm(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();

    try {
      if (editingUser) {
        const res = await api.put(`/users/${editingUser.id}`, {
          name: form.name,
          role: form.role,
        });
        if (res.success) {
          toast.success("User berhasil diperbarui");
          resetForm();
          load();
        } else {
          toast.error(res.error?.message || "Gagal memperbarui user");
        }
      } else {
        const res = await api.post("/auth/users", form);
        if (res.success) {
          toast.success("User berhasil dibuat");
          resetForm();
          load();
        } else {
          toast.error(res.error?.message || "Gagal membuat user");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan user");
    }
  }

  async function toggleStatus(userId: string) {
    try {
      const res = await api.patch(`/users/${userId}/status`);
      if (res.success) {
        toast.success("Status user berhasil diubah");
        load();
      } else {
        toast.error(res.error?.message || "Gagal mengubah status");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah status");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

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
    <AuthGuard roles={["ADMINISTRATOR"]}>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={10} />
        <div className="relative p-6 bg-gradient-to-br from-white via-purple-50/30 rounded-2xl border border-purple-100/50">
          <div className="flex items-center justify-between">
            <div>
              <AnimatedShinyText className="text-2xl font-bold text-gray-900">
                Pengguna
              </AnimatedShinyText>
              <p className="text-sm text-muted-foreground mt-1">
                {users.length} pengguna terdaftar
              </p>
            </div>
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? "Batal" : "Tambah User"}
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <MagicCard className="p-6" gradientSize={200}>
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {editingUser ? "Edit User" : "Tambah User Baru"}
          </h3>
          <Separator className="mb-4" />
          <form onSubmit={save} className="space-y-4">
            {!editingUser && (
              <Input
                label="Username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
              />
            )}
            {editingUser && (
              <div className="p-3 bg-gray-50/50 rounded-lg text-sm">
                <span className="text-muted-foreground">Username: </span>
                <span className="font-medium text-gray-900">{form.username}</span>
              </div>
            )}
            <Input
              label="Nama Lengkap"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            {!editingUser && (
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
              />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              >
                <option value="GURU">Guru</option>
                <option value="OPERATOR_SEKOLAH">Operator Sekolah</option>
                <option value="ADMINISTRATOR">Administrator</option>
                <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{editingUser ? "Simpan Perubahan" : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={resetForm}>Batal</Button>
            </div>
          </form>
        </MagicCard>
      )}

      <MagicCard className="p-0 overflow-hidden" gradientSize={300}>
        <div className="p-4 pb-0">
          <h3 className="text-sm font-medium text-muted-foreground">Daftar Pengguna</h3>
        </div>
        <Separator className="mt-3" />
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Username</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nama</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-purple-50/30 transition-colors">
                <td className="py-3 px-4 text-sm text-gray-900">{user.username}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{user.name}</td>
                <td className="py-3 px-4">
                  <Badge variant={roleConfig[user.role].variant}>
                    {roleConfig[user.role].label}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <Badge variant={user.isActive ? "success" : "danger"}>
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatus(user.id)}
                      className={user.isActive ? "text-red-600" : "text-green-600"}
                    >
                      {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </MagicCard>
    </div>
    </AuthGuard>
  );
}
