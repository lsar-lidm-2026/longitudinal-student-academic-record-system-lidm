"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "../../../../../lib/api";

interface PreviewData {
  biodata: { nis: string; nisn: string; name: string; gender: string; className: string };
  semesterRecords: any[];
}

interface ValidationItem {
  year: string;
  semester: number;
  status: {
    subjectScores: string;
    attendance: string;
    healthRecord: string;
  };
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
      if (previewRes.success && previewRes.data) {
        setPreview(previewRes.data as PreviewData);
      }
      if (validationRes.success && validationRes.data) {
        setValidation(validationRes.data as ValidationItem[]);
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

  if (!preview) {
    return <div className="text-center py-12 text-gray-500">Data tidak ditemukan</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preview Buku Induk</h1>
        <p className="text-sm text-gray-500 mt-1">
          Data siap disalin ke Buku Induk manual
        </p>
      </div>

      {/* Validation Status */}
      {validation.length > 0 && (
        <Card title="Status Kelengkapan">
          <div className="space-y-2">
            {validation.map((v, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <span className="w-32 font-medium">
                  {v.year} - Sem {v.semester}
                </span>
                <Badge variant={v.status.subjectScores === "complete" ? "success" : "danger"}>
                  Nilai
                </Badge>
                <Badge variant={v.status.attendance === "complete" ? "success" : "danger"}>
                  Hadir
                </Badge>
                <Badge variant={v.status.healthRecord === "complete" ? "success" : "danger"}>
                  Kesehatan
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Preview */}
      <Card title="Biodata">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Nama:</span> <span className="font-medium">{preview.biodata.name}</span></div>
          <div><span className="text-gray-500">NIS:</span> <span className="font-medium">{preview.biodata.nis}</span></div>
          <div><span className="text-gray-500">NISN:</span> <span className="font-medium">{preview.biodata.nisn}</span></div>
          <div><span className="text-gray-500">Kelas:</span> <span className="font-medium">{preview.biodata.className}</span></div>
        </div>
      </Card>

      {preview.semesterRecords.map((record: any, idx: number) => (
        <Card key={idx} title={`${record.year} - Semester ${record.semester === 1 ? "Ganjil" : "Genap"}`}>
          {record.subjectScores?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Nilai</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {record.subjectScores.map((sc: any) => (
                  <div key={sc.id} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span>{sc.subjectName}</span>
                    <span className="font-medium">{sc.knowledgeScore} / {sc.skillsScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.attendance && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Kehadiran</h4>
              <div className="flex gap-4 text-sm">
                <span>Sakit: <strong>{record.attendance.sick}</strong></span>
                <span>Izin: <strong>{record.attendance.permission}</strong></span>
                <span>Alpha: <strong>{record.attendance.absent}</strong></span>
              </div>
            </div>
          )}

          {record.achievements?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Prestasi</h4>
              {record.achievements.map((ach: any) => (
                <div key={ach.id} className="text-sm text-gray-600">
                  • {ach.title} ({ach.type})
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
