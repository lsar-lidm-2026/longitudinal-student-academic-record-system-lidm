"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles,
  FileText,
  BarChart3,
  MessageCircle,
  AlertTriangle,
  ChevronLeft,
  Copy,
  RotateCcw,
  CheckCircle,
  Save,
  Users,
  Clock,
  AlertCircle,
  Info,
} from "lucide-react";
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
      // Fix: gunakan api.handleResponse() konsisten seperti generate() dan regenerate()
      await api.handleResponse(api.put<AiSummary>(`/ai-summaries/${summaryId}`, { isFinal: true }));
      // Update result state jika yang di-finalize adalah yang sedang ditampilkan
      setResult((prev) => (prev?.id === summaryId ? { ...prev, isFinal: true } : prev));
      loadSummaries();
      toast.success("AI summary berhasil difinalkan");
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

  const aiTasks = [
    {
      id: "summary",
      title: "Ringkasan Rapor Otomatis",
      description: "Generasi narasi catatan wali kelas berdasarkan akumulasi nilai dan perilaku",
      icon: FileText,
      needsReview: summaries.some(s => !s.isFinal && s.summaryType === "STUDENT_SUMMARY"),
    },
    {
      id: "draft-description",
      title: "Draft Deskripsi Kompetensi",
      description: "Saran deskripsi untuk setiap mata pelajaran berdasarkan nilai",
      icon: BarChart3,
      needsReview: summaries.some(s => !s.isFinal && s.summaryType === "DRAFT_DESCRIPTION"),
    },
  ];

  const analyzedCount = summaries.filter(s => s.isFinal).length;
  const pendingCount = summaries.filter(s => !s.isFinal).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <Link href="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
        <span>›</span>
        <Link href={`/students/${params.id}`} className="hover:text-blue-600 transition-colors">Detail</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">AI Assistant</span>
      </div>

      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 rounded-2xl p-6 md:p-8 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 right-32 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-medium mb-3">
            <Sparkles className="w-3 h-3" />
            Didukung oleh Teknologi AI
          </span>
          <h1 className="text-2xl font-bold">Ada yang bisa LSAR AI bantu hari ini?</h1>
          <p className="text-blue-100 mt-2 text-sm max-w-xl leading-relaxed">
            Gunakan asisten kecerdasan buatan untuk mempercepat administrasi, menganalisis performa siswa, dan memberikan rekomendasi.
          </p>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => selectedRecord && generate()}
              disabled={!selectedRecord || generating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors shadow-sm disabled:opacity-50"
            >
              Mulai Analisis Baru
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 border border-white/30 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition-colors">
              <Clock className="w-3.5 h-3.5" />
              Riwayat Sesi
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-center py-8 text-red-500">
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
        <>
          {/* Semester Selector */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Pilih Semester</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tipe AI</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  value={aiType}
                  onChange={(e) => setAiType(e.target.value as AiType)}
                >
                  <option value="summary">Student Summary</option>
                  <option value="draft-description">Draft Deskripsi</option>
                </select>
              </div>
              <button
                onClick={generate}
                disabled={!selectedRecord || generating}
                className="h-10 px-5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {generating && <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />}
                Generate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: AI Tasks */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                Tugas AI Anda
                <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-medium">
                  {aiTasks.length} Tugas
                </span>
              </h3>

              {aiTasks.map((task) => {
                const Icon = task.icon;
                const isSelected = aiType === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => setAiType(task.id as AiType)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                          {task.needsReview && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-600 rounded uppercase">
                              Butuh Tinjauan
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Custom Analysis */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <MessageCircle className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Butuh Analisis Kustom?</p>
                <p className="text-xs text-gray-400 mt-0.5">Tuliskan instruksi Anda sendiri untuk hasil yang lebih spesifik.</p>
              </div>
            </div>

            {/* Right: AI Result */}
            <div className="lg:col-span-3">
              {result ? (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-semibold text-gray-900">Hasil Generasi AI</h3>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      result.isFinal
                        ? "bg-green-50 text-green-600 border border-green-100"
                        : "bg-orange-50 text-orange-600 border border-orange-100"
                    }`}>
                      {result.isFinal ? "Final" : "Perlu Tinjauan Guru"}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Editor Hasil</span>
                      <div className="ml-auto flex gap-1">
                        <button
                          onClick={() => { navigator.clipboard.writeText(result.content); toast.success("Disalin!"); }}
                          className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => regenerate(result.id)}
                          disabled={regenerating}
                          className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[120px]">
                      {result.content}
                    </div>
                  </div>

                  <div className="px-5 pb-5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      v{result.version} • {result.summaryType}
                    </span>
                    <div className="flex gap-2">
                      <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <Save className="w-3.5 h-3.5 inline mr-1.5" />
                        Simpan Draft
                      </button>
                      {!result.isFinal && (
                        <button
                          onClick={() => finalize(result.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Konfirmasi & Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                  <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-700">Belum Ada Hasil</h3>
                  <p className="text-xs text-gray-400 mt-1">Pilih semester dan klik Generate untuk memulai analisis AI.</p>
                </div>
              )}

              {/* History */}
              {summaries.length > 0 && (
                <div className="mt-4 bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Riwayat AI</h3>
                  <div className="space-y-2">
                    {summaries.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setResult(s)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                          result?.id === s.id ? "bg-blue-50 border border-blue-100" : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                          s.isFinal ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                        }`}>
                          {s.isFinal ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{s.summaryType}</p>
                          <p className="text-[10px] text-gray-400">v{s.version}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          s.isFinal ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                        }`}>
                          {s.isFinal ? "Final" : "Draft"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Analisis</p>
                <p className="text-lg font-bold text-gray-900">{summaries.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Tinjauan Selesai</p>
                <p className="text-lg font-bold text-gray-900">{analyzedCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Belum Ditinjau</p>
                <p className="text-lg font-bold text-gray-900">{pendingCount}</p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              <strong>Penting:</strong> AI dapat membuat kesalahan. Selalu tinjau hasil analisis sebelum menggunakannya untuk laporan resmi sekolah. Guru bertanggung jawab penuh atas kebenaran narasi rapor.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
