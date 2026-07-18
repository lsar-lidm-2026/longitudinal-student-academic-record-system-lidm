"use client";

import { useEffect, useState, FormEvent } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "GURU" as Role });

  function load() {
    api.get<User[]>("/auth/users").then((res) => {
      if (res.success && res.data) setUsers(res.data as User[]);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await api.post("/auth/users", form);
    if (res.success) {
      setShowForm(false);
      setForm({ username: "", password: "", name: "", role: "GURU" });
      load();
    } else {
      alert(res.error?.message || "Gagal membuat user");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? "Batal" : "Tambah User"}
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <MagicCard className="p-6" gradientSize={200}>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Form Tambah User</h3>
          <Separator className="mb-4" />
          <form onSubmit={create} className="space-y-4">
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
            <Input
              label="Nama Lengkap"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
            />
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
            <Button type="submit">Simpan</Button>
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
              </tr>
            ))}
          </tbody>
        </table>
      </MagicCard>
    </div>
  );
}
