"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman AI Assistant membantu guru menyusun narasi rapor siswa secara
 * otomatis menggunakan AI. Dua jenis output:
 * 1. Ringkasan Catatan Wali Kelas (summary) — narasi menyeluruh.
 * 2. Deskripsi Kompetensi (draft-description) — teks per mata pelajaran.
 *
 * Alur lengkap:
 * 1. Saat mount, fetchRecords() mengambil daftar semester records siswa.
 *    Semester pertama dipilih sebagai default.
 * 2. Saat selectedRecord berubah, useEffect mengambil riwayat AI summaries
 *    untuk semester record tersebut via /semester-records/:id/ai-summaries.
 * 3. Setiap summary memiliki version, isFinal (boolean), dan content.
 *    Draft yang belum final dapat diedit di textarea.
 * 4. User dapat:
 *    - Generate: membuat summary baru via POST /ai/students/:id/summary
 *      atau /ai/students/:id/draft-description.
 *    - Regenerate: membuat versi baru dari summary yang sudah ada.
 *    - Edit draft: mengubah teks di textarea (disimpan lokal).
 *    - Save Draft: menyimpan perubahan ke backend.
 *    - Finalisasi: mengunci konten (isFinal = true) — tidak bisa diedit lagi.
 * 5. Disclaimer: hasil AI wajib direview guru sebelum finalisasi.
 *
 * Human-in-the-loop: semua konten AI adalah draft awal. Finalisasi hanya
 * bisa dilakukan oleh guru setelah review.
 */

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
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { AiSummary, SemesterRecord } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/** Jenis konten AI: summary (catatan wali kelas) atau draft-description (deskripsi mapel) */
type AiType = "summary" | "draft-description";

export default function AiAssistantPage() {
  /** ID siswa dari URL parameter */
  const params = useParams();

  /** Daftar semester records untuk dropdown pilih semester */
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  /** Loading state untuk fetch records */
  const [loadingRecords, setLoadingRecords] = useState(true);
  /** Semester record yang dipilih (ID) */
  const [selectedRecord, setSelectedRecord] = useState("");

  /** Daftar AI summaries untuk semester record yang dipilih */
  const [summaries, setSummaries] = useState<AiSummary[]>([]);
  /** Loading state untuk fetch summaries */
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  // ── States for generation & saving ────────────────────────────────────
  /** Sedang melakukan generate/regenerate */
  const [generating, setGenerating] = useState(false);
  /** ID summary yang sedang di-save draft-nya */
  const [savingId, setSavingId] = useState<string | null>(null);
  /** ID summary yang sedang di-finalisasi */
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  /** Store konten draft yang diedit — key = summary ID, value = teks */
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});

  /**
   * fetchRecords — Mengambil daftar semester records siswa.
   * Record pertama dipilih sebagai default.
   */
  function fetchRecords() {
    setLoadingRecords(true);
    logger.info("AiAssistantPage", "Mengambil daftar semester records", { studentId: params.id });
    api
      .handleResponse(api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`))
      .then((data) => {
        setRecords(data);
        if (data.length > 0) setSelectedRecord(data[0].id);
        logger.info("AiAssistantPage", "Semester records berhasil dimuat", { count: data.length });
      })
      .catch((err) => {
        logger.error("AiAssistantPage", "Gagal memuat semester records", { err });
        toast.error(err.message ?? "Gagal memuat data semester");
      })
      .finally(() => setLoadingRecords(false));
  }

  /** Fetch records saat mount */
  useEffect(() => {
    fetchRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  /**
   * useEffect — Saat selectedRecord berubah, ambil riwayat AI summaries.
   * Juga inisialisasi draftContent untuk summary yang belum final.
   */
  useEffect(() => {
    if (!selectedRecord) return;
    setLoadingSummaries(true);
    logger.info("AiAssistantPage", "Mengambil AI summaries", { selectedRecord });
    api
      .handleResponse(api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`))
      .then((data) => {
        setSummaries(data);
        // Inisialisasi draft content untuk setiap summary yang belum final
        const initialDrafts: Record<string, string> = {};
        data.forEach((s) => {
          if (!s.isFinal) initialDrafts[s.id] = s.content;
        });
        setDraftContent(initialDrafts);
        logger.info("AiAssistantPage", "AI summaries berhasil dimuat", { count: data.length });
      })
      .catch((err) => {
        logger.error("AiAssistantPage", "Gagal memuat AI summaries", { err });
        toast.error(err.message ?? "Gagal memuat riwayat AI");
      })
      .finally(() => setLoadingSummaries(false));
  }, [selectedRecord]);

  /**
   * getLatestSummary — Mendapatkan summary terbaru (versi tertinggi) untuk tipe tertentu.
   * @param type - Tipe summary: STUDENT_SUMMARY atau DRAFT_DESCRIPTION
   * @returns AiSummary terbaru, atau null jika tidak ada
   */
  const getLatestSummary = (type: "STUDENT_SUMMARY" | "DRAFT_DESCRIPTION") => {
    const filtered = summaries.filter((s) => s.summaryType === type);
    if (filtered.length === 0) return null;
    // Sort by version descending, ambil yang paling atas
    return filtered.sort((a, b) => b.version - a.version)[0];
  };

  /**
   * handleGenerate — Meminta AI untuk membuat konten baru.
   * @param aiType - Jenis konten: "summary" atau "draft-description"
   */
  async function handleGenerate(aiType: AiType) {
    if (!selectedRecord || generating) return;
    setGenerating(true);
    logger.info("AiAssistantPage", "Generate AI konten", { aiType, selectedRecord });

    // Map AiType ke endpoint API yang sesuai
    const endpointMap: Record<AiType, string> = {
      summary: `/ai/students/${params.id}/summary`,
      "draft-description": `/ai/students/${params.id}/draft-description`,
    };

    try {
      const data = await api.handleResponse(
        api.post<AiSummary>(endpointMap[aiType], { semesterRecordId: selectedRecord })
      );
      setSummaries((prev) => [data, ...prev]); // Tambahkan ke awal array
      setDraftContent((prev) => ({ ...prev, [data.id]: data.content }));
      logger.info("AiAssistantPage", "Konten AI berhasil dibuat", { summaryId: data.id });
      toast.success("Konten AI berhasil dibuat!");
    } catch (err: any) {
      logger.error("AiAssistantPage", "Gagal generate AI", { err });
      toast.error(err.message ?? "Gagal generate AI");
    } finally {
      setGenerating(false);
    }
  }

  /**
   * handleRegenerate — Membuat versi baru dari summary yang sudah ada.
   * @param summaryId - ID summary yang akan diregenerate
   */
  async function handleRegenerate(summaryId: string) {
    if (generating) return;
    setGenerating(true);
    logger.info("AiAssistantPage", "Regenerate AI konten", { summaryId });
    try {
      const data = await api.handleResponse(
        api.post<AiSummary>(`/ai-summaries/${summaryId}/regenerate`)
      );
      setSummaries((prev) => [data, ...prev]); // Versi baru ditambahkan ke awal
      setDraftContent((prev) => ({ ...prev, [data.id]: data.content }));
      logger.info("AiAssistantPage", "Regenerate berhasil", { newSummaryId: data.id, version: data.version });
      toast.success("Versi baru berhasil dibuat!");
    } catch (err: any) {
      logger.error("AiAssistantPage", "Gagal regenerate AI", { err });
      toast.error(err.message ?? "Gagal regenerate AI");
    } finally {
      setGenerating(false);
    }
  }

  /**
   * handleSaveDraft — Menyimpan perubahan teks draft ke backend.
   * @param summary - Summary yang akan di-save draft-nya
   */
  async function handleSaveDraft(summary: AiSummary) {
    setSavingId(summary.id);
    logger.info("AiAssistantPage", "Menyimpan draft", { summaryId: summary.id });
    try {
      const updated = await api.handleResponse(
        api.put<AiSummary>(`/ai-summaries/${summary.id}`, { content: draftContent[summary.id] })
      );
      // Update summary di state lokal
      setSummaries((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      logger.info("AiAssistantPage", "Draft berhasil disimpan", { summaryId: summary.id });
      toast.success("Draft berhasil disimpan");
    } catch (err: any) {
      logger.error("AiAssistantPage", "Gagal menyimpan draft", { err });
      toast.error(err.message ?? "Gagal menyimpan draft");
    } finally {
      setSavingId(null);
    }
  }

  /**
   * handleFinalize — Memfinalisasi konten (isFinal = true).
   * Setelah final, konten tidak bisa diedit lagi.
   * @param summary - Summary yang akan difinalisasi
   */
  async function handleFinalize(summary: AiSummary) {
    setFinalizingId(summary.id);
    logger.info("AiAssistantPage", "Finalisasi konten AI", { summaryId: summary.id });
    try {
      // Kirim konten terbaru (dari draftContent) + isFinal = true
      await api.handleResponse(
        api.put<AiSummary>(`/ai-summaries/${summary.id}`, {
          content: draftContent[summary.id] || summary.content,
          isFinal: true,
        })
      );
      // Refresh summaries untuk mendapatkan state final terbaru
      const data = await api.handleResponse(
        api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`)
      );
      setSummaries(data);
      logger.info("AiAssistantPage", "Konten berhasil difinalisasi", { summaryId: summary.id });
      toast.success("Konten berhasil difinalisasi!");
    } catch (err: any) {
      logger.error("AiAssistantPage", "Gagal finalisasi konten", { err });
      toast.error(err.message ?? "Gagal memfinalisasi konten");
    } finally {
      setFinalizingId(null);
    }
  }

  /**
   * handleDeleteSummary — Menghapus draft AI summary.
   * @param summaryId - ID summary yang akan dihapus
   */
  async function handleDeleteSummary(summaryId: string) {
    if (!confirm("Hapus draft AI ini?")) return;
    try {
      await api.handleResponse(api.delete(`/ai-summaries/${summaryId}`));
      toast.success("Draft AI berhasil dihapus");
      // Refresh summaries
      const data = await api.handleResponse(
        api.get<AiSummary[]>(`/semester-records/${selectedRecord}/ai-summaries`)
      );
      setSummaries(data);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus draft");
    }
  }

  /** Summary terbaru untuk tipe STUDENT_SUMMARY (Catatan Wali Kelas) */
  const latestSummary = getLatestSummary("STUDENT_SUMMARY");
  /** Summary terbaru untuk tipe DRAFT_DESCRIPTION (Deskripsi Kompetensi) */
  const latestDraft = getLatestSummary("DRAFT_DESCRIPTION");

  // ── Loading State ──────────────────────────────────────────────────
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

        {/* Dropdown pilih semester — hanya muncul jika ada records */}
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

      {/* Tabs hanya muncul jika ada records */}
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
              onDelete={handleDeleteSummary}
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
              onDelete={handleDeleteSummary}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      {/* Peringatan bahwa hasil AI harus direview guru sebelum finalisasi */}
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

/**
 * AiContentPanel — Panel yang menampilkan konten AI beserta editor dan aksi.
 * Kondisi yang di-handle:
 * - loading: spinner
 * - summary null: tombol "Generate AI Sekarang"
 * - isDraft = true: textarea yang bisa diedit + tombol save draft & finalisasi
 * - isDraft = false: read-only view
 *
 * @param title - Judul panel (e.g., "Catatan Wali Kelas")
 * @param description - Deskripsi singkat untuk empty state
 * @param aiType - Jenis konten (summary / draft-description)
 * @param summary - AiSummary terbaru (atau null)
 * @param draftContent - Map ID -> teks draft yang sedang diedit
 * @param setDraftContent - Setter untuk draftContent
 * @param loading - Loading state summaries
 * @param generating - Loading state generate/regenerate
 * @param savingId - ID summary yang sedang di-save
 * @param finalizingId - ID summary yang sedang di-finalisasi
 * @param onGenerate - Callback generate konten baru
 * @param onRegenerate - Callback regenerate versi baru
 * @param onSaveDraft - Callback simpan draft
 * @param onFinalize - Callback finalisasi konten
 */
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
  onDelete,
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
  onDelete: (id: string) => void;
}) {
  // ── Loading State ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Memuat data AI...</p>
      </div>
    );
  }

  // ── Empty State: BELUM ADA KONTEN ────────────────────────────────
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

  /** Apakah summary masih dalam status draft? */
  const isDraft = !summary.isFinal;
  /** Konten yang akan ditampilkan: draftContent (jika diedit) atau original content */
  const contentValue = isDraft ? (draftContent[summary.id] ?? summary.content) : summary.content;
  /** Apakah ada perubahan yang belum disimpan? */
  const isChanged = isDraft && draftContent[summary.id] !== summary.content;

  // ── Content State: SUDAH ADA KONTEN (DRAFT ATAU FINAL) ───────────
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {/* Header status: badge Draft/Final + versi + tombol aksi */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isDraft ? (
            /* Badge Draft — kuning dengan animasi pulse */
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Status: Draft
            </span>
          ) : (
            /* Badge Final — hijau dengan icon check */
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold uppercase tracking-wider">
              <Check className="w-3.5 h-3.5" />
              Telah Difinalisasi
            </span>
          )}
          {/* Nomor versi */}
          <span className="text-xs text-gray-500 font-medium border-l border-gray-300 pl-3">
            Versi {summary.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Tombol Buat Ulang (Regenerate) — hanya untuk draft */}
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
          {/* Tombol Salin Teks ke clipboard */}
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

      {/* ── Editor / Viewer Area ────────────────────────────────────── */}
      <div className="p-5">
        {isDraft ? (
          /* Mode draft: textarea yang bisa diedit */
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
          /* Mode final: read-only view dengan whitespace preserved */
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {contentValue}
          </div>
        )}
      </div>

      {/* ── Footer Actions (Only for Drafts) ────────────────────────── */}
      {isDraft && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Indikator perubahan */}
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
            {/* Tombol Simpan Draft — disabled jika tidak ada perubahan */}
            <button
              onClick={() => onSaveDraft(summary)}
              disabled={savingId === summary.id || !isChanged}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-white font-medium text-sm rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {savingId === summary.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Draft
            </button>
            {/* Tombol Finalisasi — mengunci konten (tidak bisa diedit lagi) */}
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
            {/* Tombol Hapus Draft */}
            <button
              onClick={() => onDelete(summary.id)}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Hapus draft AI"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
