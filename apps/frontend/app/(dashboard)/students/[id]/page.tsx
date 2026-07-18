"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MagicCard } from "@/components/ui/magic-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BorderBeam } from "@/components/ui/border-beam";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { StudentProfile, SemesterRecord } from "@/types";

export default function StudentDetailPage() {
  const params = useParams();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<StudentProfile>(`/students/${params.id}/profile`).then((res) => {
      if (res.success && res.data) {
        setProfile(res.data as StudentProfile);
      }
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted-foreground">Siswa tidak ditemukan</div>;
  }

  const { student, semesterRecords } = profile;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
            <div className="space-y-6">
              {semesterRecords.map((record, idx) => (
                <SemesterCard
                  key={record.id}
                  record={record}
                  isLast={idx === semesterRecords.length - 1}
                />
              ))}
            </div>
          </TracingBeam>
        )}
      </MagicCard>
    </div>
  );
}

function SemesterCard({
  record,
  isLast,
}: {
  record: SemesterRecord;
  isLast: boolean;
}) {
  const avgKnowledge =
    record.subjectScores.length > 0
      ? Math.round(
          (record.subjectScores.reduce((s, sc) => s + sc.knowledgeScore, 0) /
            record.subjectScores.length) * 100
        ) / 100
      : 0;

  return (
    <div className={`relative pl-8 ${!isLast ? "pb-6" : ""}`}>
      {/* Timeline dot */}
      <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-blue-500 bg-white" />
      {!isLast && (
        <div className="absolute left-[7px] top-5 w-0.5 h-full bg-gradient-to-b from-blue-300 to-transparent" />
      )}

      <div className="bg-gray-50/80 rounded-xl p-4 hover:bg-gray-100/80 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="info">
            Sem {record.semester === 1 ? "Ganjil" : "Genap"}
          </Badge>
          <span className="text-xs text-muted-foreground">{record.academicYear?.year}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Rata-rata: <strong className="text-blue-700">{avgKnowledge}</strong>
          </span>
          {record.attendance && (
            <span className="text-muted-foreground">
              Hadir: {record.attendance.sick + record.attendance.permission + record.attendance.absent} hari
            </span>
          )}
          {record.achievements.length > 0 && (
            <Badge variant="success">
              {record.achievements.length} prestasi
            </Badge>
          )}
        </div>

        {record.subjectScores.length > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {record.subjectScores.map((sc) => (
              <div key={sc.id} className="text-xs bg-white rounded-lg p-2 border border-gray-100">
                <span className="text-gray-600">{sc.subjectName}</span>
                <div className="flex gap-1 mt-0.5">
                  <span className="font-medium text-blue-600">{sc.knowledgeScore}</span>
                  <span className="text-gray-300">/</span>
                  <span className="font-medium text-green-600">{sc.skillsScore}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
