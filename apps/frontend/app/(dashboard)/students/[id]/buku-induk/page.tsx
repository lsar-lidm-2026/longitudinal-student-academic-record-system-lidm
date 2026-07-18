"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MagicCard } from "@/components/ui/magic-card";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { ValidationBadges } from "@/components/buku-induk/ValidationBadges";
import { BiodataCard } from "@/components/buku-induk/BiodataCard";
import { api } from "@/lib/api";

interface PreviewData {
  biodata: { nis: string; nisn: string; name: string; gender: string; className: string };
  semesterRecords: any[];
}

interface ValidationItem {
  year: string;
  semester: number;
  status: { subjectScores: string; attendance: string; healthRecord: string };
}

export default function BukuIndukPage() {
  const params = useParams();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [validation, setValidation] = useState<ValidationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<PreviewData>(`/students/${params.id}/buku-induk-preview`),
      api.get<ValidationItem[]>(`/students/${params.id}/validation-status`),
    ]).then(([previewRes, validationRes]) => {
      if (previewRes.success && previewRes.data) setPreview(previewRes.data as PreviewData);
      if (validationRes.success && validationRes.data) setValidation(validationRes.data as ValidationItem[]);
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

  if (!preview) {
    return <div className="text-center py-12 text-muted-foreground">Data tidak ditemukan</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={10} />
        <div className="relative p-6 bg-gradient-to-br from-white via-amber-50/30 rounded-2xl border border-amber-100/50">
          <h1 className="text-2xl font-bold text-gray-900">Preview Buku Induk</h1>
          <p className="text-sm text-muted-foreground mt-1">Data siap disalin ke Buku Induk manual</p>
        </div>
      </div>

      {validation.length > 0 && (
        <MagicCard className="p-6">
          <ValidationBadges validation={validation} />
        </MagicCard>
      )}

      <MagicCard className="p-6" gradientSize={200}>
        <BiodataCard biodata={preview.biodata} />
      </MagicCard>

      {preview.semesterRecords.map((record: any, idx: number) => (
        <MagicCard key={idx} className="p-6" gradientSize={200}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              {record.year} - Semester {record.semester === 1 ? "Ganjil" : "Genap"}
            </h3>
          </div>
          <Separator className="mb-4" />

          {record.subjectScores?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Nilai</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {record.subjectScores.map((sc: any) => (
                  <div key={sc.id} className="flex justify-between p-2 bg-gray-50/80 rounded-lg">
                    <span className="text-gray-600">{sc.subjectName}</span>
                    <span className="font-medium text-blue-700">{sc.knowledgeScore} / {sc.skillsScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.attendance && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Kehadiran</h4>
              <div className="flex gap-4 text-sm">
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg">
                  Sakit: <strong className="text-orange-600">{record.attendance.sick}</strong>
                </span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg">
                  Izin: <strong className="text-blue-600">{record.attendance.permission}</strong>
                </span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg">
                  Alpha: <strong className="text-red-600">{record.attendance.absent}</strong>
                </span>
              </div>
            </div>
          )}

          {record.achievements?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Prestasi</h4>
              <div className="space-y-1">
                {record.achievements.map((ach: any) => (
                  <div key={ach.id} className="text-sm text-gray-600 bg-gray-50/80 p-2 rounded-lg">
                    <span className="font-medium">• {ach.title}</span>
                    <Badge variant={ach.type === "Akademik" ? "info" : "warning"} className="ml-2">
                      {ach.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </MagicCard>
      ))}
    </div>
  );
}
