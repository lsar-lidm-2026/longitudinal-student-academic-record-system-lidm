"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import { Input } from "../../../../../components/ui/Input";
import { api } from "../../../../../lib/api";
import type { AcademicYear, SemesterRecord } from "../../../../../types";

const SUBJECTS = [
  "Pendidikan Agama",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "IPA",
  "IPS",
  "Seni Budaya",
  "PJOK",
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<AcademicYear[]>("/academic-years"),
      api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`),
    ]).then(([yearsRes, recordsRes]) => {
      if (yearsRes.success && yearsRes.data) {
        setAcademicYears(yearsRes.data as AcademicYear[]);
        const active = (yearsRes.data as AcademicYear[]).find((y) => y.isActive);
        if (active) setSelectedYear(active.id);
      }
      if (recordsRes.success && recordsRes.data) {
        setRecords(recordsRes.data as SemesterRecord[]);
      }
    });
  }, [params.id]);

  async function createOrGetRecord() {
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
      return;
    }

    const res = await api.post<SemesterRecord>(`/students/${params.id}/semester-records`, {
      academicYearId: selectedYear,
      semester,
    });

    if (res.success && res.data) {
      const data = res.data as SemesterRecord;
      setRecordId(data.id);
      setRecords((prev) => [...prev, data]);
    }
  }

  async function saveAll(e: FormEvent) {
    e.preventDefault();
    if (!recordId) {
      await createOrGetRecord();
    }
    setLoading(true);

    // Save subject scores
    for (const score of scores) {
      await api.put(`/semester-records/${recordId}/subject-scores`, score);
    }

    // Save attendance
    await api.put(`/semester-records/${recordId}/attendance`, attendance);

    setLoading(false);
    alert("Data berhasil disimpan!");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Input Semester</h1>

      <Card>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Ajaran</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              <option value={1}>Ganjil</option>
              <option value={2}>Genap</option>
            </select>
          </div>
          <Button variant="secondary" onClick={createOrGetRecord}>
            {recordId ? "Record Siap" : "Buat Record"}
          </Button>
        </div>
      </Card>

      {recordId && (
        <form onSubmit={saveAll} className="space-y-6">
          <Card title="Nilai Mata Pelajaran">
            <div className="space-y-3">
              {scores.map((score, idx) => (
                <div key={score.subjectName} className="flex items-center gap-3">
                  <span className="w-40 text-sm font-medium text-gray-700">{score.subjectName}</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={score.knowledgeScore || ""}
                    onChange={(e) => {
                      const newScores = [...scores];
                      newScores[idx] = {
                        ...newScores[idx],
                        knowledgeScore: Number(e.target.value),
                      };
                      setScores(newScores);
                    }}
                    placeholder="Pengetahuan"
                    className="w-24"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={score.skillsScore || ""}
                    onChange={(e) => {
                      const newScores = [...scores];
                      newScores[idx] = {
                        ...newScores[idx],
                        skillsScore: Number(e.target.value),
                      };
                      setScores(newScores);
                    }}
                    placeholder="Keterampilan"
                    className="w-24"
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Kehadiran">
            <div className="flex gap-4">
              <Input
                label="Sakit"
                type="number"
                min="0"
                value={attendance.sick}
                onChange={(e) =>
                  setAttendance((a) => ({ ...a, sick: Number(e.target.value) }))
                }
                className="w-24"
              />
              <Input
                label="Izin"
                type="number"
                min="0"
                value={attendance.permission}
                onChange={(e) =>
                  setAttendance((a) => ({ ...a, permission: Number(e.target.value) }))
                }
                className="w-24"
              />
              <Input
                label="Alpha"
                type="number"
                min="0"
                value={attendance.absent}
                onChange={(e) =>
                  setAttendance((a) => ({ ...a, absent: Number(e.target.value) }))
                }
                className="w-24"
              />
            </div>
          </Card>

          <Button type="submit" loading={loading} className="w-full">
            Simpan Semua Data
          </Button>
        </form>
      )}
    </div>
  );
}
