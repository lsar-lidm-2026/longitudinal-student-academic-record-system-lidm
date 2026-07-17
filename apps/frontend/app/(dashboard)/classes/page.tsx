"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { api } from "../../../lib/api";
import type { ClassItem, User } from "../../../types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      api.get<ClassItem[]>("/classes"),
      api.get<User[]>("/auth/users"),
    ]).then(([classesRes, usersRes]) => {
      if (classesRes.success && classesRes.data) setClasses(classesRes.data as ClassItem[]);
      if (usersRes.success && usersRes.data) {
        const guru = (usersRes.data as User[]).filter((u) => u.role === "GURU");
        setUsers(guru);
      }
      setLoading(false);
    });
  }, []);

  async function assignTeacher(classId: string, teacherId: string) {
    const res = await api.patch(`/classes/${classId}/homeroom-teacher`, { teacherId });
    if (res.success) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId
            ? { ...c, homeroomTeacherId: teacherId, homeroomTeacher: users.find((u) => u.id === teacherId) }
            : c
        )
      );
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
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Manajemen Kelas</h1>

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Kelas</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tahun Ajaran</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Siswa</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Wali Kelas</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-medium text-gray-900">{cls.name}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{cls.academicYear?.year}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{cls._count?.students || 0}</td>
                <td className="py-3 px-4">
                  <select
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                    value={cls.homeroomTeacherId || ""}
                    onChange={(e) => assignTeacher(cls.id, e.target.value)}
                  >
                    <option value="">-</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
