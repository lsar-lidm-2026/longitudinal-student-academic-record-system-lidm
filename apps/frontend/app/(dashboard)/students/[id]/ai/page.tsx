"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "../../../../../lib/api";
import type { AiSummary, SemesterRecord } from "../../../../../types";

type AiType = "summary" | "draft-description" | "transition-summary";

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
      if (res.success && res.data) {
        setRecords(res.data as SemesterRecord[]);
      }
    });
  }, [params.id]);

  async function loadSummaries() {
    if (!selectedRecord) return;
    const res = await api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`);
    if (res.success && res.data) {
      setSummaries(res.data as AiSummary[]);
    }
  }

  useEffect(() => {
    loadSummaries();
  }, [selectedRecord]);

  async function generate() {
    if (!selectedRecord) return;
    setGenerating(true);
    setResult(null);

    const endpointMap: Record<AiType, string> = {
      summary: `/ai/students/${params.id}/summary`,
      "draft-description": `/ai/students/${params.id}/draft-description`,
      "transition-summary": `/ai/classes/${params.id}/transition-summary`,
    };

    const res = await api.post<AiSummary>(endpointMap[aiType], {
      semesterRecordId: selectedRecord,
    });

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
    if (res.success) {
      loadSummaries();
    }
  }

  const typeLabels: Record<AiType, string> = {
    summary: "Student Summary",
    "draft-description": "Draft Deskripsi",
    "transition-summary": "Transition Summary",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>

      <Card>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester Record</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={selectedRecord}
              onChange={(e) => setSelectedRecord(e.target.value)}
            >
              <option value="">Pilih semester...</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.academicYear?.year} - Semester {r.semester === 1 ? "Ganjil" : "Genap"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe AI</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={aiType}
              onChange={(e) => setAiType(e.target.value as AiType)}
            >
              <option value="summary">Student Summary</option>
              <option value="draft-description">Draft Deskripsi</option>
              <option value="transition-summary">Transition Summary</option>
            </select>
          </div>
          <Button
            onClick={generate}
            loading={generating}
            disabled={!selectedRecord}
          >
            Generate
          </Button>
        </div>
      </Card>

      {result && (
        <Card title={`Hasil ${typeLabels[aiType]}`}>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-gray-700">
            {result.content}
          </div>
          <div className="mt-4 flex gap-2">
            {!result.isFinal && (
              <Button onClick={() => finalize(result.id)} variant="primary" size="sm">
                Setujui & Finalkan
              </Button>
            )}
            {result.isFinal && <Badge variant="success">Final</Badge>}
          </div>
        </Card>
      )}

      {summaries.length > 0 && (
        <Card title="Riwayat AI Summary">
          <div className="space-y-3">
            {summaries.map((s) => (
              <div
                key={s.id}
                className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                onClick={() => setResult(s)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {s.summaryType === "STUDENT_SUMMARY" ? "Student Summary" :
                     s.summaryType === "DRAFT_DESCRIPTION" ? "Draft Deskripsi" :
                     "Transition Summary"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">v{s.version}</span>
                    {s.isFinal ? (
                      <Badge variant="success">Final</Badge>
                    ) : (
                      <Badge variant="warning">Draft</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{s.content}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
