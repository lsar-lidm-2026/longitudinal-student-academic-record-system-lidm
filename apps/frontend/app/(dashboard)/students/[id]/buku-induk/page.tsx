"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  Printer,
  Share2,
  FileText,
  Clock,
  User,
  GraduationCap,
  Heart,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { SubjectScore, Achievement, Attendance } from "@/types";

interface SemesterRecordPreview {
  id: string;
  year: string;
  semester: number;
  subjectScores: SubjectScore[];
  attendance: Attendance | null;
  achievements: Achievement[];
}

interface PreviewData {
  biodata: {
    nis: string;
    nisn: string;
    name: string;
    gender: string;
    className: string;
    photoUrl?: string | null;
  };
  semesterRecords: SemesterRecordPreview[];
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
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.handleResponse(api.get<PreviewData>(`/students/${params.id}/buku-induk-preview`)),
      api.handleResponse(api.get<ValidationItem[]>(`/students/${params.id}/validation-status`)),
    ])
      .then(([previewData, validationData]) => {
        setPreview(previewData);
        setValidation(validationData);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data buku induk");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
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

  if (!preview) {
    return <div className="text-center py-12 text-muted-foreground">Data tidak ditemukan</div>;
  }

  const bio = preview.biodata;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5 no-print">
        <Link href="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
        <span>›</span>
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Buku Induk</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/students/${params.id}`}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Buku Induk Siswa</h1>
            <p className="text-sm text-gray-500 mt-0.5">Dokumen arsip resmi data akademik dan biodata lengkap siswa.</p>
          </div>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Unduh PDF
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Share2 className="w-4 h-4" />
            Bagikan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Student Card + Doc Info */}
        <div className="space-y-4">
          {/* Student Identity Card */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-blue-500 to-blue-400 relative">
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-white shadow flex items-center justify-center">
                  <User className="w-7 h-7 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="pt-10 pb-5 px-5 text-center">
              <h2 className="text-base font-bold text-gray-900">{bio.name}</h2>
              <p className="text-xs text-blue-600 font-semibold mt-0.5">NISN: {bio.nisn}</p>
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Kelas</p>
                  <p className="font-semibold text-gray-700">{bio.className}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Status</p>
                  <p className="font-semibold text-green-600">Aktif</p>
                </div>
              </div>
            </div>
          </div>

          {/* Informasi Dokumen */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-500" />
              Informasi Dokumen
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ID Dokumen</span>
                <span className="text-gray-700 font-mono text-xs">BI-{new Date().getFullYear()}-{bio.nis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Terakhir Diperbarui</span>
                <span className="text-gray-700">{new Date().toLocaleDateString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Petugas Input</span>
                <span className="text-gray-700">Admin</span>
              </div>
            </div>
          </div>

          {/* Riwayat Log */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-500" />
              Riwayat Log
            </h3>
            <div className="space-y-2">
              <LogItem text="Dokumen digenerate" time="Baru saja" />
              <LogItem text="Data nilai diperbarui" time="Hari ini" />
            </div>
          </div>
        </div>

        {/* Right: Document Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* I. Keterangan Tentang Siswa */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">I. Keterangan Tentang Siswa</h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-500 border border-red-100">
                RAHASIA
              </span>
            </div>
            <div className="space-y-0">
              <DocRow label="Nama Lengkap" value={bio.name} />
              <DocRow label="Jenis Kelamin" value={bio.gender === "L" ? "Laki-laki" : "Perempuan"} />
              <DocRow label="NISN" value={bio.nisn} />
              <DocRow label="NIS / Nomor Induk" value={bio.nis} />
              <DocRow label="Kelas" value={bio.className} />
            </div>
          </div>

          {/* II. Data Akademik per Semester */}
          {preview.semesterRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-500" />
                {record.year} — Semester {record.semester === 1 ? "Ganjil" : "Genap"}
              </h2>

              {/* Subject Scores */}
              {record.subjectScores.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nilai Akademik</h4>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Mata Pelajaran</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-gray-400 w-24">Pengetahuan</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-gray-400 w-24">Keterampilan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.subjectScores.map((sc) => (
                          <tr key={sc.id} className="border-b border-gray-50">
                            <td className="py-2 px-3 text-gray-700">{sc.subjectName}</td>
                            <td className="py-2 px-3 text-center font-semibold text-blue-600">{sc.knowledgeScore}</td>
                            <td className="py-2 px-3 text-center font-semibold text-blue-600">{sc.skillsScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance */}
              {record.attendance && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kehadiran</h4>
                  <div className="flex gap-3">
                    <span className="px-3 py-2 bg-orange-50 rounded-lg text-sm border border-orange-100">
                      Sakit: <strong className="text-orange-600">{record.attendance.sick}</strong>
                    </span>
                    <span className="px-3 py-2 bg-blue-50 rounded-lg text-sm border border-blue-100">
                      Izin: <strong className="text-blue-600">{record.attendance.permission}</strong>
                    </span>
                    <span className="px-3 py-2 bg-red-50 rounded-lg text-sm border border-red-100">
                      Alpha: <strong className="text-red-600">{record.attendance.absent}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Achievements */}
              {record.achievements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prestasi</h4>
                  <div className="space-y-1">
                    {record.achievements.map((ach) => (
                      <div key={ach.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-sm text-gray-700">{ach.title}</span>
                        <Badge variant={ach.type === "Akademik" ? "info" : "warning"} className="ml-auto">
                          {ach.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {preview.semesterRecords.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <GraduationCap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada data semester untuk ditampilkan.</p>
            </div>
          )}

          {/* Signature Area */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-12">Mengetahui,</p>
                <div className="border-t border-gray-300 pt-2 w-40 mx-auto">
                  <p className="text-sm font-semibold text-gray-700">Kepala Sekolah</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-12">
                  {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <div className="border-t border-gray-300 pt-2 w-40 mx-auto">
                  <p className="text-sm font-semibold text-gray-700">Wali Kelas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} LSAR SYSTEM • DATA TERENKRIPSI
      </div>
    </div>
  );
}

function DocRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wider w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

function LogItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      <div className="flex-1">
        <p className="text-sm text-gray-700">{text}</p>
        <p className="text-[10px] text-gray-400 uppercase">{time}</p>
      </div>
    </div>
  );
}
