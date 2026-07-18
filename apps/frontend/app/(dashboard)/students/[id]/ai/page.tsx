"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { AiResultCard } from "@/components/ai/AiResultCard";
import { AiHistoryList } from "@/components/ai/AiHistoryList";
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
  const [regenerating, setRegenerating] = useState(false);
  const [result, setResult] = useState<AiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    api.handleResponse(api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`))
      .then(setRecords)
      .catch((err) => {
        setError(err.message || "Gagal memuat data semester");
      });
  }

  useEffect(() => { refresh(); }, [params.id]);

  async function loadSummaries() {
    if (!selectedRecord) return;
    try {
      const data = await api.handleResponse(api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`));
      setSummaries(data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat riwayat AI");
    }
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

    try {
      const data = await api.handleResponse(api.post<AiSummary>(endpointMap[aiType], { semesterRecordId: selectedRecord }));
      setResult(data);
      toast.success("AI analysis berhasil digenerate");
      loadSummaries();
    } catch (err: any) {
      toast.error(err.message || "Gagal generate AI analysis");
    }
    setGenerating(false);
  }

  async function finalize(summaryId: string) {
    try {
      const res = await api.put(`/ai-summaries/${summaryId}`, { isFinal: true });
      if (res.success) {
        loadSummaries();
        toast.success("AI summary berhasil difinalkan");
      } else {
        toast.error(res.error?.message || "Gagal finalkan");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal finalkan AI summary");
    }
  }

  async function regenerate(summaryId: string) {
    setRegenerating(true);
    try {
      const data = await api.handleResponse(api.post<AiSummary>(`/ai-summaries/${summaryId}/regenerate`));
      setResult(data);
      toast.success("AI berhasil di-regenerate");
      loadSummaries();
    } catch (err: any) {
      toast.error(err.message || "Gagal regenerate AI");
    }
    setRegenerating(false);
  }

  const typeLabels: Record<AiType, string> = {
    summary: "Student Summary",
    "draft-description": "Draft Deskripsi",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-sm text-gray-500 mb-2 flex flex-wrap items-center gap-x-2">
        <Link href="/students" className="hover:text-blue-600 transition-colors">Siswa</Link>
        <span>/</span>
        <Link href={`/students/${params.id}`} className="hover:text-blue-600 transition-colors">Detail</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">AI Assistant</span>
      </div>

      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-violet-50/30 to-purple-50/30 rounded-2xl border border-violet-100/50">
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, review, dan finalkan ringkasan AI
          </p>
        </div>
      </div>

      {error && (
        <div className="text-center py-12 text-red-500">
          <p>{error}</p>
          <button
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!error && (
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
      )}

      {result && (
        <MagicCard className="p-6" gradientSize={250}>
          <AiResultCard
            result={result}
            typeLabel={typeLabels[aiType]}
            onFinalize={finalize}
            onRegenerate={regenerate}
            regenerating={regenerating}
          />
        </MagicCard>
      )}

      {summaries.length > 0 && (
        <MagicCard className="p-6" gradientSize={300}>
          <AiHistoryList
            summaries={summaries}
            onSelect={setResult}
            selectedId={result?.id}
          />
        </MagicCard>
      )}
    </div>
  );
}
