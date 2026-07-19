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
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { AcademicYear, SemesterRecord, Achievement, HealthRecord } from "@/types";

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
  notes: string;
}

interface AchievementForm {
  title: string;
  type: string;
  description: string;
}

interface HealthForm {
  height: string;
  weight: string;
  hearingCondition: string;
  visionCondition: string;
  teethCondition: string;
}

const emptyHealthForm = (): HealthForm => ({
  height: "",
  weight: "",
  hearingCondition: "",
  visionCondition: "",
  teethCondition: "",
});

export default function SemesterRecordsPage() {
  const params = useParams();
  const [studentName, setStudentName] = useState("");
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [semester, setSemester] = useState<1 | 2>(1);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [scores, setScores] = useState<SubjectScoreInput[]>(
    SUBJECTS.map((s) => ({ subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, notes: "" }))
  );
  const [attendance, setAttendance] = useState({ sick: 0, permission: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementForm, setAchievementForm] = useState<AchievementForm>({ title: "", type: "Akademik", description: "" });
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [showAchievementForm, setShowAchievementForm] = useState(false);
  const [savingAchievement, setSavingAchievement] = useState(false);

  // Health state
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [healthForm, setHealthForm] = useState<HealthForm>(emptyHealthForm());
  const [savingHealth, setSavingHealth] = useState(false);

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

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  /** Load data dari record yang dipilih ke form state */
  function loadRecordData(record: SemesterRecord) {
    setRecordId(record.id);

    // Nilai
    if (record.subjectScores.length > 0) {
      setScores(
        SUBJECTS.map((s) => {
          const found = record.subjectScores.find((sc) => sc.subjectName === s);
          return found
            ? {
                subjectName: s,
                knowledgeScore: found.knowledgeScore,
                skillsScore: found.skillsScore,
                kkm: 75,
                notes: found.notes || "",
              }
            : { subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, notes: "" };
        })
      );
    } else {
      setScores(SUBJECTS.map((s) => ({ subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, notes: "" })));
    }

    // Kehadiran
    if (record.attendance) {
      setAttendance({
        sick: record.attendance.sick,
        permission: record.attendance.permission,
        absent: record.attendance.absent,
      });
    } else {
      setAttendance({ sick: 0, permission: 0, absent: 0 });
    }

    // Prestasi
    setAchievements(record.achievements || []);
    setShowAchievementForm(false);
    setEditingAchievement(null);
    setAchievementForm({ title: "", type: "Akademik", description: "" });

    // Kesehatan
    setHealthRecord(record.healthRecord);
    if (record.healthRecord) {
      setHealthForm({
        height: record.healthRecord.height?.toString() || "",
        weight: record.healthRecord.weight?.toString() || "",
        hearingCondition: record.healthRecord.hearingCondition || "",
        visionCondition: record.healthRecord.visionCondition || "",
        teethCondition: record.healthRecord.teethCondition || "",
      });
    } else {
      setHealthForm(emptyHealthForm());
    }
  }

  async function createOrGetRecord(): Promise<string | null> {
    if (saving) return null; // Guard concurrent call

    const existing = records.find(
      (r) => r.academicYearId === selectedYear && r.semester === semester
    );
    if (existing) {
      loadRecordData(existing);
      return existing.id;
    }

    try {
      const data = await api.handleResponse(
        api.post<SemesterRecord>(`/students/${params.id}/semester-records`, {
          academicYearId: selectedYear,
          semester,
        })
      );
      setRecordId(data.id);
      setRecords((prev) => [...prev, data]);
      setAchievements([]);
      setHealthRecord(null);
      setHealthForm(emptyHealthForm());
      return data.id;
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat record semester");
      return null;
    }
  }

  async function saveAll(e: FormEvent) {
    e.preventDefault();

    const hasInvalid = scores.some(
      (s) =>
        s.knowledgeScore < 0 || s.knowledgeScore > 100 ||
        s.skillsScore < 0 || s.skillsScore > 100
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
        return;
      }

      // Fix: gunakan api.handleResponse() konsisten + kirim notes (bukan description)
      await api.handleResponse(
        api.put(`/semester-records/${currentRecordId}/subject-scores/batch`, {
          scores: scores.map((s) => ({
            subjectName: s.subjectName,
            knowledgeScore: s.knowledgeScore,
            skillsScore: s.skillsScore,
            notes: s.notes,
          })),
        })
      );

      await api.handleResponse(
        api.put(`/semester-records/${currentRecordId}/attendance`, attendance)
      );

      toast.success("Data nilai dan kehadiran berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  }

  // ── Achievements handlers ─────────────────────────────────────────

  async function saveAchievement(e: FormEvent) {
    e.preventDefault();
    if (!recordId) return;
    setSavingAchievement(true);

    try {
      if (editingAchievement) {
        const updated = await api.handleResponse(
          api.put<Achievement>(`/semester-records/achievements/${editingAchievement.id}`, {
            title: achievementForm.title,
            type: achievementForm.type,
            description: achievementForm.description || undefined,
          })
        );
        setAchievements((prev) =>
          prev.map((a) => (a.id === editingAchievement.id ? updated : a))
        );
        toast.success("Prestasi berhasil diperbarui");
      } else {
        const created = await api.handleResponse(
          api.post<Achievement>(`/semester-records/${recordId}/achievements`, {
            title: achievementForm.title,
            type: achievementForm.type,
            description: achievementForm.description || undefined,
          })
        );
        setAchievements((prev) => [...prev, created]);
        toast.success("Prestasi berhasil ditambahkan");
      }
      resetAchievementForm();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan prestasi");
    } finally {
      setSavingAchievement(false);
    }
  }

  async function deleteAchievement(achievementId: string) {
    try {
      await api.handleResponse(
        api.delete(`/semester-records/achievements/${achievementId}`)
      );
      setAchievements((prev) => prev.filter((a) => a.id !== achievementId));
      toast.success("Prestasi berhasil dihapus");
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus prestasi");
    }
  }

  function startEditAchievement(a: Achievement) {
    setEditingAchievement(a);
    setAchievementForm({ title: a.title, type: a.type, description: a.description || "" });
    setShowAchievementForm(true);
  }

  function resetAchievementForm() {
    setShowAchievementForm(false);
    setEditingAchievement(null);
    setAchievementForm({ title: "", type: "Akademik", description: "" });
  }

  // ── Health handlers ───────────────────────────────────────────────

  async function saveHealth(e: FormEvent) {
    e.preventDefault();
    if (!recordId) return;
    setSavingHealth(true);

    try {
      const updated = await api.handleResponse(
        api.put<HealthRecord>(`/semester-records/${recordId}/health-record`, {
          height: healthForm.height ? Number(healthForm.height) : undefined,
          weight: healthForm.weight ? Number(healthForm.weight) : undefined,
          hearingCondition: healthForm.hearingCondition || undefined,
          visionCondition: healthForm.visionCondition || undefined,
          teethCondition: healthForm.teethCondition || undefined,
        })
      );
      setHealthRecord(updated);
      toast.success("Data kesehatan berhasil disimpan");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data kesehatan");
    } finally {
      setSavingHealth(false);
    }
  }

  const activeYear = academicYears.find((y) => y.id === selectedYear);

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
            <p className="text-xs text-gray-400 mt-0.5">ID: {params.id}</p>
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
              onChange={(e) => { setSelectedYear(e.target.value); setRecordId(null); }}
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
              onChange={(e) => { setSemester(Number(e.target.value) as 1 | 2); setRecordId(null); }}
            >
              <option value={1}>Ganjil</option>
              <option value={2}>Genap</option>
            </select>
          </div>
          <button
            onClick={createOrGetRecord}
            disabled={saving}
            className={`h-10 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
              recordId
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            }`}
          >
            {recordId ? "✓ Record Siap" : "Buat / Muat Record"}
          </button>
        </div>
      </div>

      {/* Tabs Content */}
      {recordId && (
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
              {achievements.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-600 rounded-full">
                  {achievements.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="kesehatan" className="gap-1.5">
              <Heart className="w-3.5 h-3.5" /> Kesehatan
              {healthRecord && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-600 rounded-full">✓</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="catatan" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Catatan
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Nilai ────────────────────────────────────── */}
          <TabsContent value="nilai">
            <form onSubmit={saveAll}>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Input Nilai Mata Pelajaran</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-6">
                    Isi nilai pengetahuan dan nilai keterampilan secara terpisah.
                  </p>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left py-3 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mata Pelajaran</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">KKM</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Pengetahuan</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Keterampilan</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">Predikat</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Catatan/Deskripsi</th>
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
                              setScores((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, knowledgeScore: val } : s))
                              );
                            }}
                            className={`w-20 h-9 px-1.5 border rounded-lg text-sm text-center bg-white outline-none transition-all font-medium ${
                              score.knowledgeScore > 0 && score.knowledgeScore < 75
                                ? "border-red-300 text-red-600 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-gray-200 text-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            }`}
                          >
                            {SCORE_OPTIONS.map((v) => (
                              <option key={v} value={v} className={v < 75 && v > 0 ? "text-red-500" : "text-gray-700"}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <select
                            value={score.skillsScore}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setScores((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, skillsScore: val } : s))
                              );
                            }}
                            className={`w-20 h-9 px-1.5 border rounded-lg text-sm text-center bg-white outline-none transition-all font-medium ${
                              score.skillsScore > 0 && score.skillsScore < 75
                                ? "border-red-300 text-red-600 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-gray-200 text-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            }`}
                          >
                            {SCORE_OPTIONS.map((v) => (
                              <option key={v} value={v} className={v < 75 && v > 0 ? "text-red-500" : "text-gray-700"}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-xs font-bold ${
                              score.knowledgeScore >= 88
                                ? "bg-green-50 text-green-600"
                                : score.knowledgeScore >= 75
                                ? "bg-blue-50 text-blue-600"
                                : score.knowledgeScore > 0
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {score.knowledgeScore > 0 ? getGrade(score.knowledgeScore) : "-"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={score.notes}
                            onChange={(e) => {
                              setScores((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, notes: e.target.value } : s))
                              );
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

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {scores.filter((s) => s.knowledgeScore > 0).length} mata pelajaran terisi
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
                    {saving ? "Menyimpan..." : "Simpan Nilai & Kehadiran"}
                  </button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Kehadiran ────────────────────────────────── */}
          <TabsContent value="kehadiran">
            <form onSubmit={saveAll}>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Rekap Kehadiran</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(["sick", "permission", "absent"] as const).map((field) => {
                    const labels = { sick: "Sakit (hari)", permission: "Izin (hari)", absent: "Alpha (hari)" };
                    return (
                      <div key={field}>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          {labels[field]}
                        </label>
                        <select
                          value={attendance[field]}
                          onChange={(e) =>
                            setAttendance((prev) => ({ ...prev, [field]: Number(e.target.value) }))
                          }
                          className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-4">
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
                    {saving ? "Menyimpan..." : "Simpan Nilai & Kehadiran"}
                  </button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Prestasi ─────────────────────────────────── */}
          <TabsContent value="prestasi">
            <div className="space-y-4">
              {/* Daftar prestasi */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Daftar Prestasi</h3>
                    <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-medium">
                      {achievements.length} prestasi
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      resetAchievementForm();
                      setShowAchievementForm(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Prestasi
                  </button>
                </div>

                {achievements.length === 0 ? (
                  <div className="py-10 text-center">
                    <Trophy className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Belum ada data prestasi</p>
                    <p className="text-xs text-gray-300 mt-0.5">Klik tombol Tambah Prestasi untuk menambahkan</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {achievements.map((a) => (
                      <div key={a.id} className="flex items-start justify-between p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${
                              a.type === "Akademik"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-purple-50 text-purple-600"
                            }`}
                          >
                            {a.type}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                            {a.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-4">
                          <button
                            onClick={() => startEditAchievement(a)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteAchievement(a.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form tambah/edit prestasi */}
              {showAchievementForm && (
                <div className="bg-white rounded-xl border border-amber-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {editingAchievement ? "Edit Prestasi" : "Tambah Prestasi Baru"}
                    </h4>
                    <button
                      onClick={resetAchievementForm}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={saveAchievement} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Judul Prestasi</label>
                      <input
                        type="text"
                        value={achievementForm.title}
                        onChange={(e) => setAchievementForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Contoh: Juara 1 Olimpiade Matematika"
                        required
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Jenis Prestasi</label>
                      <select
                        value={achievementForm.type}
                        onChange={(e) => setAchievementForm((f) => ({ ...f, type: e.target.value }))}
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                      >
                        <option value="Akademik">Akademik</option>
                        <option value="Non-Akademik">Non-Akademik</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Deskripsi (Opsional)</label>
                      <textarea
                        value={achievementForm.description}
                        onChange={(e) => setAchievementForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Deskripsi singkat mengenai prestasi ini..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={savingAchievement}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {savingAchievement ? (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        ) : null}
                        {editingAchievement ? "Simpan Perubahan" : "Tambahkan"}
                      </button>
                      <button
                        type="button"
                        onClick={resetAchievementForm}
                        className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Kesehatan ────────────────────────────────── */}
          <TabsContent value="kesehatan">
            <form onSubmit={saveHealth}>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Data Kesehatan Siswa</h3>
                  {healthRecord && (
                    <span className="px-2 py-0.5 text-[10px] bg-green-50 text-green-600 rounded-full font-semibold border border-green-100">
                      Sudah diisi
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Tinggi Badan (cm)
                    </label>
                    <input
                      type="number"
                      value={healthForm.height}
                      onChange={(e) => setHealthForm((f) => ({ ...f, height: e.target.value }))}
                      placeholder="Contoh: 135"
                      min={0}
                      max={250}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Berat Badan (kg)
                    </label>
                    <input
                      type="number"
                      value={healthForm.weight}
                      onChange={(e) => setHealthForm((f) => ({ ...f, weight: e.target.value }))}
                      placeholder="Contoh: 35"
                      min={0}
                      max={300}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Kondisi Pendengaran
                    </label>
                    <select
                      value={healthForm.hearingCondition}
                      onChange={(e) => setHealthForm((f) => ({ ...f, hearingCondition: e.target.value }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="">Pilih kondisi...</option>
                      <option value="Normal">Normal</option>
                      <option value="Gangguan Ringan">Gangguan Ringan</option>
                      <option value="Gangguan Sedang">Gangguan Sedang</option>
                      <option value="Gangguan Berat">Gangguan Berat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Kondisi Penglihatan
                    </label>
                    <select
                      value={healthForm.visionCondition}
                      onChange={(e) => setHealthForm((f) => ({ ...f, visionCondition: e.target.value }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="">Pilih kondisi...</option>
                      <option value="Normal">Normal</option>
                      <option value="Rabun Jauh (Miopi)">Rabun Jauh (Miopi)</option>
                      <option value="Rabun Dekat (Hipermetropi)">Rabun Dekat (Hipermetropi)</option>
                      <option value="Silinder (Astigmatisme)">Silinder (Astigmatisme)</option>
                      <option value="Gangguan Lainnya">Gangguan Lainnya</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Kondisi Gigi
                    </label>
                    <select
                      value={healthForm.teethCondition}
                      onChange={(e) => setHealthForm((f) => ({ ...f, teethCondition: e.target.value }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="">Pilih kondisi...</option>
                      <option value="Normal / Sehat">Normal / Sehat</option>
                      <option value="Karies Ringan">Karies Ringan</option>
                      <option value="Karies Sedang">Karies Sedang</option>
                      <option value="Karies Berat">Karies Berat</option>
                      <option value="Perlu Perawatan">Perlu Perawatan</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={savingHealth}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingHealth ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savingHealth ? "Menyimpan..." : "Simpan Data Kesehatan"}
                  </button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Catatan ──────────────────────────────────── */}
          <TabsContent value="catatan">
            <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Fitur catatan guru akan segera tersedia.</p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
