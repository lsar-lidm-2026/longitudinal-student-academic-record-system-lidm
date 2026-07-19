"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles,
  FileText,
  ChevronLeft,
  Copy,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Save,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AiSummary, SemesterRecord } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type AiType = "summary" | "draft-description";

export default function AiAssistantPage() {
  const params = useParams();

  const [records, setRecords] = useState<SemesterRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState("");

  const [summaries, setSummaries] = useState<AiSummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  // States for generation & saving
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  // Store editable content for drafts
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});

  function fetchRecords() {
    setLoadingRecords(true);
    api
      .handleResponse(api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`))
      .then((data) => {
        setRecords(data);
        if (data.length > 0) setSelectedRecord(data[0].id);
      })
      .catch((err) => toast.error(err.message ?? "Gagal memuat data semester"))
      .finally(() => setLoadingRecords(false));
  }

  useEffect(() => {
    fetchRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!selectedRecord) return;
    setLoadingSummaries(true);
    api
      .handleResponse(api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`))
      .then((data) => {
        setSummaries(data);
        // Initialize draft content for any non-final summaries
        const initialDrafts: Record<string, string> = {};
        data.forEach((s) => {
          if (!s.isFinal) initialDrafts[s.id] = s.content;
        });
        setDraftContent(initialDrafts);
      })
      .catch((err) => toast.error(err.message ?? "Gagal memuat riwayat AI"))
      .finally(() => setLoadingSummaries(false));
  }, [selectedRecord]);

  // Helpers to get the latest summary for a specific type
  const getLatestSummary = (type: "STUDENT_SUMMARY" | "DRAFT_DESCRIPTION") => {
    const filtered = summaries.filter((s) => s.summaryType === type);
    if (filtered.length === 0) return null;
    // Sort by version descending
    return filtered.sort((a, b) => b.version - a.version)[0];
  };

  async function handleGenerate(aiType: AiType) {
    if (!selectedRecord || generating) return;
    setGenerating(true);

    const endpointMap: Record<AiType, string> = {
      summary: `/ai/students/${params.id}/summary`,
      "draft-description": `/ai/students/${params.id}/draft-description`,
    };

    try {
      const data = await api.handleResponse(
        api.post<AiSummary>(endpointMap[aiType], { semesterRecordId: selectedRecord })
      );
      setSummaries((prev) => [data, ...prev]);
      setDraftContent((prev) => ({ ...prev, [data.id]: data.content }));
      toast.success("Konten AI berhasil dibuat!");
    } catch (err: any) {
      toast.error(err.message ?? "Gagal generate AI");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(summaryId: string) {
    if (generating) return;
    setGenerating(true);
    try {
      const data = await api.handleResponse(
        api.post<AiSummary>(`/ai-summaries/${summaryId}/regenerate`)
      );
      setSummaries((prev) => [data, ...prev]);
      setDraftContent((prev) => ({ ...prev, [data.id]: data.content }));
      toast.success("Versi baru berhasil dibuat!");
    } catch (err: any) {
      toast.error(err.message ?? "Gagal regenerate AI");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft(summary: AiSummary) {
    setSavingId(summary.id);
    try {
      const updated = await api.handleResponse(
        api.put<AiSummary>(`/ai-summaries/${summary.id}`, { content: draftContent[summary.id] })
      );
      setSummaries((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Draft berhasil disimpan");
    } catch (err: any) {
      toast.error(err.message ?? "Gagal menyimpan draft");
    } finally {
      setSavingId(null);
    }
  }

  async function handleFinalize(summary: AiSummary) {
    setFinalizingId(summary.id);
    try {
      // Ensure the latest edited content is saved during finalization
      await api.handleResponse(
        api.put<AiSummary>(`/ai-summaries/${summary.id}`, {
          content: draftContent[summary.id] || summary.content,
          isFinal: true,
        })
      );
      // Refresh summaries to reflect final state
      const data = await api.handleResponse(
        api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`)
      );
      setSummaries(data);
      toast.success("Konten berhasil difinalisasi!");
    } catch (err: any) {
      toast.error(err.message ?? "Gagal memfinalisasi konten");
    } finally {
      setFinalizingId(null);
    }
  }

  const latestSummary = getLatestSummary("STUDENT_SUMMARY");
  const latestDraft = getLatestSummary("DRAFT_DESCRIPTION");

  if (loadingRecords) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <Link href={`/students/${params.id}`} className="hover:text-blue-600 transition-colors">Profil Siswa</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">AI Assistant</span>
      </div>

      {/* ── Header & Semester Selector ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            AI Assistant Rapor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Bantu susun narasi rapor siswa berdasarkan nilai dan absensi secara otomatis.
          </p>
        </div>
        
        {records.length > 0 ? (
          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Pilih Semester
            </label>
            <select
              value={selectedRecord}
              onChange={(e) => setSelectedRecord(e.target.value)}
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-900"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.academicYear?.year ?? "?"} — Semester {r.semester === 1 ? "Ganjil" : "Genap"}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-100">
            Belum ada record semester.
          </div>
        )}
      </div>

      {records.length > 0 && (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="summary" className="gap-2">
              <FileText className="w-4 h-4" /> Ringkasan Catatan Wali Kelas
            </TabsTrigger>
            <TabsTrigger value="draft-description" className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> Deskripsi Kompetensi
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Ringkasan Catatan Wali Kelas ───────────────── */}
          <TabsContent value="summary">
            <AiContentPanel
              title="Catatan Wali Kelas"
              description="Narasi menyeluruh tentang perkembangan akademik, kehadiran, dan prestasi siswa selama satu semester."
              aiType="summary"
              summary={latestSummary}
              draftContent={draftContent}
              setDraftContent={setDraftContent}
              loading={loadingSummaries}
              generating={generating}
              savingId={savingId}
              finalizingId={finalizingId}
              onGenerate={() => handleGenerate("summary")}
              onRegenerate={handleRegenerate}
              onSaveDraft={handleSaveDraft}
              onFinalize={handleFinalize}
            />
          </TabsContent>

          {/* ── TAB 2: Deskripsi Kompetensi ───────────────────────── */}
          <TabsContent value="draft-description">
            <AiContentPanel
              title="Deskripsi Mata Pelajaran"
              description="Rekomendasi teks deskripsi untuk setiap mata pelajaran berdasarkan nilai yang telah diinput."
              aiType="draft-description"
              summary={latestDraft}
              draftContent={draftContent}
              setDraftContent={setDraftContent}
              loading={loadingSummaries}
              generating={generating}
              savingId={savingId}
              finalizingId={finalizingId}
              onGenerate={() => handleGenerate("draft-description")}
              onRegenerate={handleRegenerate}
              onSaveDraft={handleSaveDraft}
              onFinalize={handleFinalize}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
        <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Catatan:</strong> AI Assistant berfungsi untuk memberikan saran draf awal. Seluruh teks wajib dibaca dan dapat disesuaikan kembali oleh Guru sebelum dilakukan finalisasi ke buku induk.
        </p>
      </div>
    </div>
  );
}

// ── Komponen Pembantu untuk menampilkan Konten AI ──────────────
function AiContentPanel({
  title,
  description,
  aiType,
  summary,
  draftContent,
  setDraftContent,
  loading,
  generating,
  savingId,
  finalizingId,
  onGenerate,
  onRegenerate,
  onSaveDraft,
  onFinalize,
}: {
  title: string;
  description: string;
  aiType: AiType;
  summary: AiSummary | null;
  draftContent: Record<string, string>;
  setDraftContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loading: boolean;
  generating: boolean;
  savingId: string | null;
  finalizingId: string | null;
  onGenerate: () => void;
  onRegenerate: (id: string) => void;
  onSaveDraft: (s: AiSummary) => void;
  onFinalize: (s: AiSummary) => void;
}) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Memuat data AI...</p>
      </div>
    );
  }

  // JIKA BELUM ADA KONTEN SAMA SEKALI
  if (!summary) {
    return (
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center min-h-[300px] text-center">
        <Sparkles className="w-10 h-10 text-gray-300 mb-3" />
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Belum ada {title}</h3>
        <p className="text-xs text-gray-500 max-w-sm mb-6">{description}</p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Sedang Membuat..." : "Generate AI Sekarang"}
        </button>
      </div>
    );
  }

  const isDraft = !summary.isFinal;
  const contentValue = isDraft ? (draftContent[summary.id] ?? summary.content) : summary.content;
  const isChanged = isDraft && draftContent[summary.id] !== summary.content;

  // JIKA SUDAH ADA KONTEN (DRAFT ATAU FINAL)
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {/* Header status */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isDraft ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Status: Draft
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold uppercase tracking-wider">
              <Check className="w-3.5 h-3.5" />
              Telah Difinalisasi
            </span>
          )}
          <span className="text-xs text-gray-500 font-medium border-l border-gray-300 pl-3">
            Versi {summary.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <button
              onClick={() => onRegenerate(summary.id)}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
              Buat Ulang
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(contentValue);
              toast.success("Teks disalin ke clipboard");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Salin Teks
          </button>
        </div>
      </div>

      {/* Editor / Viewer Area */}
      <div className="p-5">
        {isDraft ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 font-medium">
              Silakan periksa dan sesuaikan teks di bawah ini sebelum melakukan finalisasi:
            </p>
            <textarea
              value={contentValue}
              onChange={(e) =>
                setDraftContent((prev) => ({ ...prev, [summary.id]: e.target.value }))
              }
              rows={12}
              className="w-full p-4 border border-blue-200 rounded-lg text-sm text-gray-800 leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-y bg-blue-50/20"
            />
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {contentValue}
          </div>
        )}
      </div>

      {/* Footer Actions (Only for Drafts) */}
      {isDraft && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            {isChanged ? (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Ada perubahan yang belum disimpan
              </span>
            ) : (
              "Semua perubahan tersimpan."
            )}
          </p>
          <div className="flex w-full sm:w-auto gap-2">
            <button
              onClick={() => onSaveDraft(summary)}
              disabled={savingId === summary.id || !isChanged}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-white font-medium text-sm rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {savingId === summary.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Draft
            </button>
            <button
              onClick={() => onFinalize(summary)}
              disabled={finalizingId === summary.id}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {finalizingId === summary.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Finalisasi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
