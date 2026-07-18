"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  BookOpen,
  CalendarCheck,
  Trophy,
  Heart,
  FileText,
  Save,
  Plus,
  User,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { AcademicYear, SemesterRecord } from "@/types";

const SUBJECTS = [
  "Pendidikan Agama & Budi Pekerti",
  "Pendidikan Pancasila & Kewarganegaraan",
  "Bahasa Indonesia",
  "Matematika",
  "Ilmu Pengetahuan Alam",
  "Ilmu Pengetahuan Sosial",
  "Seni Budaya",
  "PJOK",
];

// Score value options for dropdown
const SCORE_OPTIONS = Array.from({ length: 101 }, (_, i) => i);

function getGrade(score: number): string {
  if (score >= 88) return "A";
  if (score >= 75) return "B";
  if (score >= 62) return "C";
  return "D";
}

interface SubjectScoreInput {
  subjectName: string;
  knowledgeScore: number;
  skillsScore: number;
  kkm: number;
  description: string;
}

export default function SemesterRecordsPage() {
  const params = useParams();
  const [studentName, setStudentName] = useState("");
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [semester, setSemester] = useState(1);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [scores, setScores] = useState<SubjectScoreInput[]>(
    SUBJECTS.map((s) => ({ subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, description: "" }))
  );
  const [attendance, setAttendance] = useState({ sick: 0, permission: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.handleResponse(api.get<AcademicYear[]>("/academic-years")),
      api.handleResponse(api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`)),
      api.handleResponse(api.get<any>(`/students/${params.id}/profile`)).catch(() => null),
    ])
      .then(([yearsData, recordsData, profileData]) => {
        setAcademicYears(yearsData);
        const active = yearsData.find((y) => y.isActive);
        if (active) setSelectedYear(active.id);
        setRecords(recordsData);
        if (profileData?.student?.name) {
          setStudentName(profileData.student.name);
        }
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, [params.id]);

  async function createOrGetRecord(): Promise<string | null> {
    const existing = records.find(
      (r) => r.academicYearId === selectedYear && r.semester === semester
    );
    if (existing) {
      setRecordId(existing.id);
      if (existing.subjectScores.length > 0) {
        setScores(
          SUBJECTS.map((s) => {
            const found = existing.subjectScores.find((sc) => sc.subjectName === s);
            return found
              ? { subjectName: s, knowledgeScore: found.knowledgeScore, skillsScore: found.skillsScore, kkm: 75, description: found.notes || "" }
              : { subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, description: "" };
          })
        );
      }
      if (existing.attendance) {
        setAttendance({
          sick: existing.attendance.sick,
          permission: existing.attendance.permission,
          absent: existing.attendance.absent,
        });
      }
      return existing.id;
    }

    const data = await api.handleResponse(api.post<SemesterRecord>(`/students/${params.id}/semester-records`, {
      academicYearId: selectedYear,
      semester,
    }));
    setRecordId(data.id);
    setRecords((prev) => [...prev, data]);
    return data.id;
  }

  async function saveAll(e: FormEvent) {
    e.preventDefault();

    const hasInvalid = scores.some(
      (s) => s.knowledgeScore < 0 || s.knowledgeScore > 100 || s.skillsScore < 0 || s.skillsScore > 100
    );
    if (hasInvalid) {
      toast.error("Nilai harus antara 0 - 100");
      return;
    }

    let currentRecordId = recordId;
    setSaving(true);

    try {
      if (!currentRecordId) {
        currentRecordId = await createOrGetRecord();
      }
      if (!currentRecordId) {
        toast.error("Gagal membuat record semester");
        setSaving(false);
        return;
      }

      const scoresRes = await api.put(`/semester-records/${currentRecordId}/subject-scores/batch`, {
        scores: scores.map(s => ({
          subjectName: s.subjectName,
          knowledgeScore: s.knowledgeScore,
          skillsScore: s.skillsScore,
        }))
      });
      if (!scoresRes.success) throw new Error(scoresRes.error?.message || "Gagal menyimpan nilai");

      const attRes = await api.put(`/semester-records/${currentRecordId}/attendance`, attendance);
      if (!attRes.success) throw new Error(attRes.error?.message || "Gagal menyimpan kehadiran");

      toast.success("Data berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    }

    setSaving(false);
  }

  const activeYear = academicYears.find(y => y.id === selectedYear);

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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Input Semester</span>
      </div>

      {/* Student Info Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/students/${params.id}`}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{studentName || "Siswa"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">NISN: {params.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Semester Aktif</span>
          {activeYear && (
            <span className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              {semester === 1 ? "Ganjil" : "Genap"} {activeYear.year}
            </span>
          )}
        </div>
      </div>

      {/* Year & Semester Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tahun Ajaran</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year} {y.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-36">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Semester</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              <option value={1}>Ganjil</option>
              <option value={2}>Genap</option>
            </select>
          </div>
          <button
            onClick={createOrGetRecord}
            className={`h-10 px-4 rounded-lg text-sm font-medium transition-all ${
              recordId
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            }`}
          >
            {recordId ? "✓ Record Siap" : "Buat Record"}
          </button>
        </div>
      </div>

      {/* Tabs Content */}
      {recordId && (
        <form onSubmit={saveAll}>
          <Tabs defaultValue="nilai">
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="nilai" className="gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Nilai
              </TabsTrigger>
              <TabsTrigger value="kehadiran" className="gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5" /> Kehadiran
              </TabsTrigger>
              <TabsTrigger value="prestasi" className="gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Prestasi
              </TabsTrigger>
              <TabsTrigger value="kesehatan" className="gap-1.5">
                <Heart className="w-3.5 h-3.5" /> Kesehatan
              </TabsTrigger>
              <TabsTrigger value="catatan" className="gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Catatan
              </TabsTrigger>
            </TabsList>

            {/* Nilai Tab */}
            <TabsContent value="nilai">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Input Nilai Mata Pelajaran</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-6">
                    Pilih nilai akhir semester untuk setiap mata pelajaran menggunakan dropdown.
                  </p>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left py-3 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mata Pelajaran</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">KKM</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Nilai</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Predikat</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Deskripsi Kompetensi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score, idx) => (
                      <tr key={score.subjectName} className="border-b border-gray-50">
                        <td className="py-3 px-5 text-sm text-gray-700">{score.subjectName}</td>
                        <td className="py-3 px-3 text-center text-sm text-gray-500">{score.kkm}</td>
                        <td className="py-3 px-3 text-center">
                          <select
                            value={score.knowledgeScore}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setScores(prev => prev.map((s, i) =>
                                i === idx ? { ...s, knowledgeScore: val, skillsScore: val } : s
                              ));
                            }}
                            className={`w-24 h-9 px-1.5 border rounded-lg text-sm text-center bg-white outline-none transition-all font-medium ${
                              score.knowledgeScore > 0 && score.knowledgeScore < 75
                                ? "border-red-300 text-red-600 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-gray-200 text-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            }`}
                          >
                            {SCORE_OPTIONS.map(v => (
                              <option key={v} value={v} className={v < 75 && v > 0 ? "text-red-500 font-medium" : "text-gray-700"}>
                                {v} {v < 75 && v > 0 ? "⚠️" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-xs font-bold ${
                            score.knowledgeScore >= 88 ? "bg-green-50 text-green-600" :
                            score.knowledgeScore >= 75 ? "bg-blue-50 text-blue-600" :
                            score.knowledgeScore > 0 ? "bg-red-50 text-red-600 border border-red-100" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {score.knowledgeScore > 0 ? getGrade(score.knowledgeScore) : "-"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={score.description}
                            onChange={(e) => {
                              setScores(prev => prev.map((s, i) =>
                                i === idx ? { ...s, description: e.target.value } : s
                              ));
                            }}
                            placeholder="Deskripsi kompetensi..."
                            className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Kehadiran Tab */}
            <TabsContent value="kehadiran">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Rekap Kehadiran</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Sakit (hari)</label>
                    <select
                      value={attendance.sick}
                      onChange={(e) => setAttendance(prev => ({ ...prev, sick: Number(e.target.value) }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Izin (hari)</label>
                    <select
                      value={attendance.permission}
                      onChange={(e) => setAttendance(prev => ({ ...prev, permission: Number(e.target.value) }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Alpha (hari)</label>
                    <select
                      value={attendance.absent}
                      onChange={(e) => setAttendance(prev => ({ ...prev, absent: Number(e.target.value) }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Prestasi Tab */}
            <TabsContent value="prestasi">
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Fitur input prestasi akan segera tersedia.</p>
              </div>
            </TabsContent>

            {/* Kesehatan Tab */}
            <TabsContent value="kesehatan">
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <Heart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Fitur input data kesehatan akan segera tersedia.</p>
              </div>
            </TabsContent>

            {/* Catatan Tab */}
            <TabsContent value="catatan">
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Fitur catatan guru akan segera tersedia.</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {scores.filter(s => s.knowledgeScore > 0).length} mata pelajaran terisi
            </p>
            <div className="flex gap-3">
              <Link
                href={`/students/${params.id}`}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batalkan
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
