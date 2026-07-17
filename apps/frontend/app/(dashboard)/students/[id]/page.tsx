"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "../../../../lib/api";
import type { StudentProfile, SemesterRecord } from "../../../../types";

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-gray-500">Siswa tidak ditemukan</div>;
  }

  const { student, semesterRecords } = profile;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            NIS: {student.nis} | NISN: {student.nisn} | Kelas: {student.class.name}
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Timeline */}
      <Card title="Riwayat Semester">
        {semesterRecords.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            Belum ada data semester
          </p>
        ) : (
          <div className="space-y-3">
            {semesterRecords.map((record, idx) => (
              <SemesterCard
                key={record.id}
                record={record}
                isLast={idx === semesterRecords.length - 1}
              />
            ))}
          </div>
        )}
      </Card>
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
            record.subjectScores.length) *
            100
        ) / 100
      : 0;

  return (
    <div className={`flex gap-4 ${!isLast ? "pb-3 border-b border-gray-100" : ""}`}>
      <div className="flex-shrink-0 w-24 pt-1">
        <Badge variant="info">
          Sem {record.semester === 1 ? "Ganjil" : "Genap"}
        </Badge>
        <p className="text-xs text-gray-400 mt-1">{record.academicYear?.year}</p>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-4 text-sm">
          <span>
            Rata-rata: <strong>{avgKnowledge}</strong>
          </span>
          {record.attendance && (
            <span className="text-gray-500">
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
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1">
            {record.subjectScores.map((sc) => (
              <div key={sc.id} className="text-xs text-gray-600">
                {sc.subjectName}: {sc.knowledgeScore}/{sc.skillsScore}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
