"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BorderBeam } from "@/components/ui/border-beam";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentTimeline } from "@/components/students/StudentTimeline";
import { api } from "@/lib/api";
import type { StudentProfile } from "@/types";

export default function StudentDetailPage() {
  const params = useParams();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    api.get<StudentProfile>(`/students/${params.id}/profile`)
      .then((res) => {
        if (res.success && res.data) {
          setProfile(res.data as StudentProfile);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data siswa");
        setLoading(false);
      });
  }

  useEffect(() => { refresh(); }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        <button
          onClick={refresh}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted-foreground">Siswa tidak ditemukan</div>;
  }

  const { student, semesterRecords } = profile;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-2">
        <Link href="/students" className="hover:text-blue-600 transition-colors">Siswa</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{student.name}</span>
      </div>

      {/* Header */}
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 rounded-2xl border border-blue-100/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                NIS: {student.nis} | NISN: {student.nisn} | Kelas: {student.class.name}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href={`/students/${params.id}/semester-records`}>
                <Button variant="primary" size="sm">Input Semester</Button>
              </Link>
              <Link href={`/students/${params.id}/ai`}>
                <Button variant="secondary" size="sm">AI Assistant</Button>
              </Link>
              <Link href={`/students/${params.id}/buku-induk`}>
                <Button variant="ghost" size="sm">Buku Induk</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <MagicCard className="p-6" gradientSize={250}>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Riwayat Semester</h3>
        <p className="text-xs text-muted-foreground mb-4">Perkembangan akademik siswa per semester</p>
        <Separator className="mb-4" />

        {semesterRecords.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Belum ada data semester</p>
          </div>
        ) : (
          <TracingBeam className="px-4">
            <StudentTimeline semesterRecords={semesterRecords} />
          </TracingBeam>
        )}
      </MagicCard>
    </div>
  );
}
