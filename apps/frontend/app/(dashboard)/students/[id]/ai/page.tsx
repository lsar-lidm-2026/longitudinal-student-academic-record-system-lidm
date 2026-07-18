"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { AiSummary, SemesterRecord } from "@/types";

type AiType = "summary" | "draft-description";

export default function AiAssistantPage() {
  const params = useParams();
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState("");
  const [aiType, setAiType] = useState<AiType>("summary");
  const [summaries, setSummaries] = useState<AiSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AiSummary | null>(null);

  useEffect(() => {
    api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`).then((res) => {
      if (res.success && res.data) setRecords(res.data as SemesterRecord[]);
    });
  }, [params.id]);

  async function loadSummaries() {
    if (!selectedRecord) return;
    const res = await api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`);
    if (res.success && res.data) setSummaries(res.data as AiSummary[]);
  }

  useEffect(() => { loadSummaries(); }, [selectedRecord]);

  async function generate() {
    if (!selectedRecord) return;
    setGenerating(true);
    setResult(null);

    const endpointMap: Record<AiType, string> = {
      summary: `/ai/students/${params.id}/summary`,
      "draft-description": `/ai/students/${params.id}/draft-description`,
    };

    const res = await api.post<AiSummary>(endpointMap[aiType], { semesterRecordId: selectedRecord });
    if (res.success && res.data) {
      setResult(res.data as AiSummary);
      loadSummaries();
    } else {
      alert("Gagal generate: " + (res.error?.message || "Unknown error"));
    }
    setGenerating(false);
  }

  async function finalize(summaryId: string) {
    const res = await api.put(`/ai-summaries/${summaryId}`, { isFinal: true });
    if (res.success) loadSummaries();
  }

  const typeLabels: Record<AiType, string> = {
    summary: "Student Summary",
    "draft-description": "Draft Deskripsi",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-violet-50/30 to-purple-50/30 rounded-2xl border border-violet-100/50">
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate ringkasan dan draft dengan AI
          </p>
        </div>
      </div>

      <MagicCard className="p-6" gradientSize={200}>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              value={selectedRecord}
              onChange={(e) => setSelectedRecord(e.target.value)}
            >
              <option value="">Pilih semester...</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.academicYear?.year} - Sem {r.semester === 1 ? "Ganjil" : "Genap"}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe AI</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              value={aiType}
              onChange={(e) => setAiType(e.target.value as AiType)}
            >
              <option value="summary">Student Summary</option>
              <option value="draft-description">Draft Deskripsi</option>
            </select>
          </div>
          <Button onClick={generate} loading={generating} disabled={!selectedRecord}>
            Generate
          </Button>
        </div>
      </MagicCard>

      {result && (
        <MagicCard className="p-6" gradientSize={250}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              Hasil {typeLabels[aiType]}
            </h3>
            <Badge variant={result.isFinal ? "success" : "warning"}>
              {result.isFinal ? "Final" : "Draft v" + result.version}
            </Badge>
          </div>
          <Separator className="mb-4" />
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {result.content}
          </div>
          <div className="mt-6 flex gap-2">
            {!result.isFinal && (
              <Button onClick={() => finalize(result.id)} variant="primary" size="sm">
                Setujui & Finalkan
              </Button>
            )}
          </div>
        </MagicCard>
      )}

      {summaries.length > 0 && (
        <MagicCard className="p-6" gradientSize={300}>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Riwayat AI Summary</h3>
          <Separator className="mb-4" />
          <div className="space-y-3">
            {summaries.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-gray-50/80 rounded-xl cursor-pointer hover:bg-gray-100/80 transition-all hover:shadow-sm"
                onClick={() => setResult(s)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {s.summaryType === "STUDENT_SUMMARY" ? "Student Summary" : "Draft Deskripsi"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">v{s.version}</span>
                    <Badge variant={s.isFinal ? "success" : "warning"}>
                      {s.isFinal ? "Final" : "Draft"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{s.content}</p>
              </div>
            ))}
          </div>
        </MagicCard>
      )}
    </div>
  );
}
