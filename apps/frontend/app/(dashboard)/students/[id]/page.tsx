"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Download,
  Edit,
  TrendingUp,
  Clock,
  Trophy,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudentTimeline } from "@/components/students/StudentTimeline";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { Skeleton } from "@/components/ui/skeleton";
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
    api.handleResponse(api.get<StudentProfile>(`/students/${params.id}/profile`))
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message || "Gagal memuat data siswa"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
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

  // Compute simple stats from semester records
  const avgScore = semesterRecords.length > 0
    ? Math.round(
        semesterRecords.reduce((sum, r) => {
          const scores = r.subjectScores || [];
          if (scores.length === 0) return sum;
          return sum + scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length;
        }, 0) / semesterRecords.length
      )
    : 0;

  const totalAttendanceRate = semesterRecords.length > 0
    ? (() => {
        const total = semesterRecords.reduce((s, r) => {
          if (!r.attendance) return s;
          return s + r.attendance.sick + r.attendance.permission + r.attendance.absent;
        }, 0);
        // Approximate: fewer absences = higher rate
        return total === 0 ? 100 : Math.max(0, 100 - total);
      })()
    : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <Link href="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
        <span>›</span>
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Detail Siswa</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Profil Siswa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola informasi mendalam dan pantau perkembangan akademik siswa.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/students/${params.id}/buku-induk`}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Ekspor Buku Induk
          </Link>
          <button className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Edit className="w-4 h-4" />
            Ubah Biodata
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile Card */}
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-500 to-blue-400 relative">
              <div className="absolute -bottom-10 left-5">
                <div className="w-20 h-20 rounded-xl bg-white border-4 border-white shadow-sm flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="pt-12 pb-5 px-5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900">{student.name}</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-600 border border-green-100">
                  Aktif
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {student.class?.name || "-"} • {student.nisn}
              </p>

              <div className="mt-5 space-y-3">
                <InfoRow icon={Mail} label="Email" value={`${student.nis}@siswa.sch.id`} />
                <InfoRow icon={Phone} label="Telepon" value="-" />
                <InfoRow icon={MapPin} label="Alamat" value="-" />
                <InfoRow icon={Calendar} label="Tanggal Lahir" value="-" />
                <InfoRow icon={Award} label="Jenis Kelamin" value={student.gender === "L" ? "Laki-laki" : "Perempuan"} />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Rata-rata Nilai</p>
                <p className="text-lg font-bold text-gray-900">{avgScore || "-"}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Tingkat Kehadiran</p>
                <p className="text-lg font-bold text-gray-900">{totalAttendanceRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Tabs Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="akademik">
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="akademik">Statistik Akademik</TabsTrigger>
              <TabsTrigger value="timeline">Timeline Semester</TabsTrigger>
              <TabsTrigger value="catatan">Catatan</TabsTrigger>
            </TabsList>

            <TabsContent value="akademik">
              <div className="space-y-4">
                {/* Score Overview */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Rekap Nilai per Semester
                  </h3>
                  {semesterRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Belum ada data semester</p>
                  ) : (
                    <div className="space-y-3">
                      {semesterRecords.map((record) => {
                        const scores = record.subjectScores || [];
                        const avg = scores.length > 0
                          ? Math.round(scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length)
                          : 0;
                        return (
                          <div key={record.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {record.academicYear?.year || "N/A"} - Semester {record.semester}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{scores.length} mata pelajaran</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">{avg}</p>
                              <p className="text-[10px] text-gray-400">rata-rata</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Link
                    href={`/students/${params.id}/semester-records`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Edit className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Input Semester</span>
                  </Link>
                  <Link
                    href={`/students/${params.id}/ai`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                      <Trophy className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">AI Assistant</span>
                  </Link>
                  <Link
                    href={`/students/${params.id}/buku-induk`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <Download className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Buku Induk</span>
                  </Link>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                {semesterRecords.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Belum ada data semester</p>
                ) : (
                  <TracingBeam className="px-4">
                    <StudentTimeline semesterRecords={semesterRecords} />
                  </TracingBeam>
                )}
              </div>
            </TabsContent>

            <TabsContent value="catatan">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-sm text-gray-400 py-8 text-center">
                  Belum ada catatan guru untuk siswa ini.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm text-gray-700">{value}</p>
      </div>
    </div>
  );
}
