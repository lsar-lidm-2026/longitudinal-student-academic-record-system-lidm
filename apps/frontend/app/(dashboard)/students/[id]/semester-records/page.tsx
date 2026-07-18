"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { ScoreInput } from "@/components/academic/ScoreInput";
import { AttendanceInput } from "@/components/academic/AttendanceInput";
import { api } from "@/lib/api";
import type { AcademicYear, SemesterRecord } from "@/types";

const SUBJECTS = [
  "Pendidikan Agama", "Pendidikan Pancasila", "Bahasa Indonesia",
  "Matematika", "IPA", "IPS", "Seni Budaya", "PJOK",
];

interface SubjectScoreInput {
  subjectName: string;
  knowledgeScore: number;
  skillsScore: number;
}

export default function SemesterRecordsPage() {
  const params = useParams();
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [semester, setSemester] = useState(1);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [scores, setScores] = useState<SubjectScoreInput[]>(
    SUBJECTS.map((s) => ({ subjectName: s, knowledgeScore: 0, skillsScore: 0 }))
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
    ])
      .then(([yearsData, recordsData]) => {
        setAcademicYears(yearsData);
        const active = yearsData.find((y) => y.isActive);
        if (active) setSelectedYear(active.id);
        setRecords(recordsData);
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
              ? { subjectName: s, knowledgeScore: found.knowledgeScore, skillsScore: found.skillsScore }
              : { subjectName: s, knowledgeScore: 0, skillsScore: 0 };
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

    // Validate form before submit
    const hasEmptyScore = scores.some(
      (s) => s.knowledgeScore < 0 || s.knowledgeScore > 100 || s.skillsScore < 0 || s.skillsScore > 100
    );
    if (hasEmptyScore) {
      toast.error("Nilai harus antara 0 - 100");
      return;
    }

    // Resolve (or create) the record ID synchronously via return value
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

      // Batch save all subject scores in one call
      const scoresRes = await api.put(`/semester-records/${currentRecordId}/subject-scores/batch`, { scores });
      if (!scoresRes.success) throw new Error(scoresRes.error?.message || "Gagal menyimpan nilai");

      const attRes = await api.put(`/semester-records/${currentRecordId}/attendance`, attendance);
      if (!attRes.success) throw new Error(attRes.error?.message || "Gagal menyimpan kehadiran");

      toast.success("Data berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    }

    setSaving(false);
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
          onClick={refresh}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-sm text-gray-500 mb-2 flex flex-wrap items-center gap-x-2">
        <Link href="/students" className="hover:text-blue-600 transition-colors">Siswa</Link>
        <span>/</span>
        <Link href={`/students/${params.id}`} className="hover:text-blue-600 transition-colors">Detail</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Input Semester</span>
      </div>

      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-orange-50/30 rounded-2xl border border-orange-100/50">
          <h1 className="text-2xl font-bold text-gray-900">Input Semester</h1>
          <p className="text-sm text-muted-foreground mt-1">Input nilai dan kehadiran siswa</p>
        </div>
      </div>

      <MagicCard className="p-6" gradientSize={200}>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Ajaran</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
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
          <div className="w-full sm:w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              <option value={1}>Ganjil</option>
              <option value={2}>Genap</option>
            </select>
          </div>
          <Button variant="secondary" onClick={createOrGetRecord}>
            {recordId ? "Record Siap ✓" : "Buat Record"}
          </Button>
        </div>
      </MagicCard>

      {recordId && (
        <form onSubmit={saveAll} className="space-y-6">
          <MagicCard className="p-6" gradientSize={250}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Nilai Mata Pelajaran</h3>
            <p className="text-xs text-muted-foreground mb-4">Input nilai pengetahuan dan keterampilan</p>
            <Separator className="mb-4" />
            <ScoreInput scores={scores} onChange={setScores} />
          </MagicCard>

          <MagicCard className="p-6" gradientSize={200}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Kehadiran</h3>
            <p className="text-xs text-muted-foreground mb-4">Rekap ketidakhadiran siswa</p>
            <Separator className="mb-4" />
            <AttendanceInput attendance={attendance} onChange={setAttendance} />
          </MagicCard>

          <Button type="submit" loading={saving} className="w-full">
            Simpan Semua Data
          </Button>
        </form>
      )}
    </div>
  );
}
