"use client";

import { useEffect, useState, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "../../../lib/api";
import type { AcademicYear } from "../../../types";

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [newYear, setNewYear] = useState("");

  function load() {
    api.get<AcademicYear[]>("/academic-years").then((res) => {
      if (res.success && res.data) setYears(res.data as AcademicYear[]);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const res = await api.post("/academic-years", { year: newYear });
    if (res.success) {
      setNewYear("");
      load();
    } else {
      alert(res.error?.message || "Gagal membuat tahun ajaran");
    }
  }

  async function activate(id: string) {
    await api.patch(`/academic-years/${id}/activate`);
    load();
  }

  async function archive(id: string) {
    await api.patch(`/academic-years/${id}/archive`);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tahun Ajaran</h1>

      <Card>
        <form onSubmit={create} className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Contoh: 2025/2026"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              required
            />
          </div>
          <Button type="submit">Tambah</Button>
        </form>
      </Card>

      <Card>
        <div className="space-y-2">
          {years.map((year) => (
            <div
              key={year.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{year.year}</span>
                {year.isActive && <Badge variant="success">Aktif</Badge>}
                {year.isArchived && <Badge variant="info">Arsip</Badge>}
              </div>
              <div className="flex gap-2">
                {!year.isActive && !year.isArchived && (
                  <Button variant="primary" size="sm" onClick={() => activate(year.id)}>
                    Aktifkan
                  </Button>
                )}
                {!year.isArchived && (
                  <Button variant="ghost" size="sm" onClick={() => archive(year.id)}>
                    Arsipkan
                  </Button>
                )}
              </div>
            </div>
          ))}
          {years.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">
              Belum ada tahun ajaran
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
