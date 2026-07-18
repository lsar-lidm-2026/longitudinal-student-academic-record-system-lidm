"use client";

import { useEffect, useState, FormEvent } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AcademicYear } from "@/types";

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newYear, setNewYear] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    api.handleResponse(api.get<AcademicYear[]>("/academic-years"))
      .then(setYears)
      .catch((err) => setError(err.message || "Gagal memuat tahun ajaran"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.post("/academic-years", { year: newYear });
      if (res.success) {
        setNewYear("");
        load();
      } else {
        toast.error(res.error?.message || "Gagal membuat tahun ajaran");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat tahun ajaran");
    }
  }

  async function activate(id: string) {
    try {
      await api.patch(`/academic-years/${id}/activate`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengaktifkan tahun ajaran");
    }
  }

  async function archive(id: string) {
    try {
      await api.patch(`/academic-years/${id}/archive`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengarsipkan tahun ajaran");
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={10} />
        <div className="relative p-6 bg-gradient-to-br from-white via-indigo-50/30 rounded-2xl border border-indigo-100/50">
          <h1 className="text-2xl font-bold text-gray-900">Tahun Ajaran</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola tahun ajaran sekolah</p>
        </div>
      </div>

      <MagicCard className="p-6" gradientSize={200}>
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
      </MagicCard>

      <MagicCard className="p-0 overflow-hidden" gradientSize={300}>
        <div className="p-4 pb-0">
          <h3 className="text-sm font-medium text-muted-foreground">Daftar Tahun Ajaran</h3>
        </div>
        <Separator className="mt-3" />
        <div className="p-4 space-y-2">
          {years.map((year) => (
            <div
              key={year.id}
              className="flex items-center justify-between p-3 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{year.year}</span>
                <div className="flex gap-1.5">
                  {year.isActive && <Badge variant="success">Aktif</Badge>}
                  {year.isArchived && <Badge variant="info">Arsip</Badge>}
                </div>
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
            <p className="text-center text-sm text-muted-foreground py-4">
              Belum ada tahun ajaran
            </p>
          )}
        </div>
      </MagicCard>
    </div>
    </AuthGuard>
  );
}
