"use client";

import { useEffect, useState, FormEvent } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import { api } from "../../../lib/api";
import type { User, Role } from "../../../types";

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

  const roleBadge: Record<Role, { variant: "info" | "success" | "warning" | "danger"; label: string }> = {
    ADMINISTRATOR: { variant: "danger", label: "Admin" },
    OPERATOR_SEKOLAH: { variant: "warning", label: "Operator" },
    GURU: { variant: "info", label: "Guru" },
    KEPALA_SEKOLAH: { variant: "success", label: "Kepsek" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pengguna</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Batal" : "Tambah User"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-3">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        </Card>
      )}

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Username</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nama</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">{user.username}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{user.name}</td>
                <td className="py-3 px-4">
                  <Badge variant={roleBadge[user.role].variant}>
                    {roleBadge[user.role].label}
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
      </Card>
    </div>
  );
}
