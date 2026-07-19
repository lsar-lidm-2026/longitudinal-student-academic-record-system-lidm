"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman Buku Induk Siswa menampilkan dokumen arsip resmi yang berisi
 * biodata lengkap siswa dan seluruh data akademik per semester.
 * Layout mirip dokumen cetak dengan area signature dan siap di-print.
 *
 * Alur lengkap:
 * 1. Saat mount, refresh() mengambil dua data secara paralel:
 *    - /students/:id/buku-induk-preview → PreviewData (biodata + semesterRecords)
 *    - /students/:id/validation-status → ValidationItem[] (status kelengkapan)
 * 2. Data preview ditampilkan dalam layout dua kolom:
 *    - Kiri: kartu identitas siswa + info dokumen + riwayat log.
 *    - Kanan: data akademik per semester (nilai, kehadiran, prestasi)
 *      + area signature + footer.
 * 3. Tombol Cetak/Unduh PDF menggunakan window.print().
 * 4. Class .no-print pada elemen UI (breadcrumb, tombol) agar tidak ikut
 *    tercetak saat print.
 * 5. Loading: spinner. Error: pesan + retry.
 */

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  Download,
  Printer,
  FileText,
  Clock,
  User,
  GraduationCap,
  Heart,
  Trophy,
  Upload,
  Paperclip,
  Loader2,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { SubjectScore, Achievement, Attendance, StudentDocument } from "@/types";

/** Tipe data untuk preview record semester di buku induk */
interface SemesterRecordPreview {
  id: string;
  year: string;
  semester: number;
  subjectScores: SubjectScore[];
  attendance: Attendance | null;
  achievements: Achievement[];
}

/** Tipe data preview buku induk — biodata + daftar semester */
interface PreviewData {
  biodata: {
    nis: string;
    nisn: string;
    name: string;
    gender: string;
    className: string;
    photoUrl?: string | null;
  };
  semesterRecords: SemesterRecordPreview[];
}

/** Tipe data status validasi per semester */
interface ValidationItem {
  year: string;
  semester: number;
  status: { subjectScores: string; attendance: string; healthRecord: string };
}

export default function BukuIndukPage() {
  /** ID siswa dari URL parameter */
  const params = useParams();
  /** Data preview buku induk */
  const [preview, setPreview] = useState<PreviewData | null>(null);
  /** Status validasi kelengkapan data per semester */
  const [validation, setValidation] = useState<ValidationItem[]>([]);
  /** Indikator loading */
  const [loading, setLoading] = useState(true);
  /** State error */
  const [error, setError] = useState<string | null>(null);

  // ── Dokumen Siswa state ───────────────────────────────────────────
  /** Daftar dokumen siswa (akta, KK, ijazah, dll) */
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  /** Indikator loading dokumen */
  const [loadingDocs, setLoadingDocs] = useState(false);
  /** File yang dipilih untuk diupload sebagai dokumen baru */
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  /** Indikator upload dokumen berlangsung */
  const [uploadingDoc, setUploadingDoc] = useState(false);
  /** Progress upload dokumen (0-100) */
  const [uploadDocProgress, setUploadDocProgress] = useState(0);

  /**
   * refresh — Mengambil data preview buku induk + status validasi + dokumen siswa.
   * Ketiga request dilakukan paralel via Promise.all.
   */
  function refresh() {
    setLoading(true);
    setError(null);
    logger.info("BukuIndukPage", "Memuat data buku induk", { studentId: params.id });
    Promise.all([
      api.handleResponse(api.get<PreviewData>(`/students/${params.id}/buku-induk-preview`)),
      api.handleResponse(api.get<ValidationItem[]>(`/students/${params.id}/validation-status`)),
      // Fetch dokumen siswa secara paralel
      fetchDocuments(),
    ])
      .then(([previewData, validationData]) => {
        setPreview(previewData);
        setValidation(validationData);
        logger.info("BukuIndukPage", "Data buku induk berhasil dimuat", {
          semesterCount: previewData.semesterRecords.length,
          validationCount: validationData.length,
        });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data buku induk");
        logger.error("BukuIndukPage", "Gagal memuat data buku induk", { err });
      })
      .finally(() => setLoading(false));
  }

  /**
   * fetchDocuments — Mengambil daftar dokumen siswa dari server.
   * GET /upload/students/:id/documents → mengembalikan StudentDocument[].
   * Dipanggil saat refresh() dan setelah upload dokumen baru.
   */
  async function fetchDocuments() {
    setLoadingDocs(true);
    logger.info("BukuIndukPage", "Memuat dokumen siswa", { studentId: params.id });
    try {
      const docs = await api.handleResponse(
        api.get<StudentDocument[]>(`/upload/students/${params.id}/documents`)
      );
      setDocuments(docs);
      logger.info("BukuIndukPage", "Dokumen siswa berhasil dimuat", { count: docs.length });
    } catch (err: any) {
      // Jangan tampilkan error ke user — dokumen bersifat non-kritis
      logger.error("BukuIndukPage", "Gagal memuat dokumen siswa", { err });
    } finally {
      setLoadingDocs(false);
    }
  }

  /**
   * uploadDocument — Mengupload file sebagai dokumen siswa baru.
   * Alur:
   * 1. Validasi: pastikan ada file yang dipilih.
   * 2. Buat FormData dengan file.
   * 3. POST ke /upload/students/:id/documents via XMLHttpRequest untuk progress tracking.
   * 4. Jika sukses, refresh daftar dokumen.
   * 5. Jika gagal, tampilkan toast error.
   */
  async function uploadDocument() {
    if (!selectedDocFile) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }

    logger.info("BukuIndukPage", "Mengupload dokumen siswa", {
      studentId: params.id,
      fileName: selectedDocFile.name,
      fileSize: selectedDocFile.size,
      fileType: selectedDocFile.type,
    });
    setUploadingDoc(true);
    setUploadDocProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedDocFile);

      const token = api.getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

      // Gunakan XMLHttpRequest untuk tracking progress upload
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadDocProgress(progress);
          }
        };

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              logger.info("BukuIndukPage", "Upload dokumen sukses");
              resolve();
            } else {
              reject(new Error(response.error?.message || "Gagal mengupload dokumen"));
            }
          } catch {
            reject(new Error("Response tidak valid dari server"));
          }
        };

        xhr.onerror = () => {
          logger.error("BukuIndukPage", "Network error saat upload dokumen");
          reject(new Error("Koneksi bermasalah, periksa jaringan Anda"));
        };

        xhr.open("POST", `${baseUrl}/upload/students/${params.id}/documents`);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(formData);
      });

      toast.success("Dokumen berhasil diupload");
      // Reset file input dan refresh daftar dokumen
      setSelectedDocFile(null);
      await fetchDocuments();
    } catch (err: any) {
      logger.error("BukuIndukPage", "Gagal mengupload dokumen", { err });
      toast.error(err.message || "Gagal mengupload dokumen");
    } finally {
      setUploadingDoc(false);
      setUploadDocProgress(0);
    }
  }

  /**
   * copyFormattedData — Menyalin data buku induk ke clipboard dalam format teks terstruktur.
   *
   * Alur:
   * 1. Bangun string teks dari biodata + semua semester records
   * 2. Format rapi dengan judul, separator, dan data per semester
   * 3. navigator.clipboard.writeText() untuk copy ke clipboard
   * 4. Tampilkan toast sukses
   */
  async function copyFormattedData() {
    if (!preview) return;

    logger.info("BukuIndukPage", "Menyalin data buku induk ke clipboard");

    try {
      const bio = preview.biodata;
      let text = "========================================\n";
      text += "         BUKU INDUK SISWA\n";
      text += `         ${bio.name}\n`;
      text += "========================================\n\n";
      text += "I. KETERANGAN TENTANG SISWA\n";
      text += "----------------------------------------\n";
      text += `Nama Lengkap       : ${bio.name}\n`;
      text += `Jenis Kelamin      : ${bio.gender === "L" ? "Laki-laki" : "Perempuan"}\n`;
      text += `NISN               : ${bio.nisn}\n`;
      text += `NIS                : ${bio.nis}\n`;
      text += `Kelas              : ${bio.className}\n\n`;

      text += "II. DATA AKADEMIK PER SEMESTER\n";
      text += "========================================\n\n";

      for (const record of preview.semesterRecords) {
        text += `--- ${record.year} — Semester ${record.semester === 1 ? "Ganjil" : "Genap"} ---\n`;

        // Nilai akademik
        if (record.subjectScores.length > 0) {
          text += "Nilai Akademik:\n";
          text += "  Mata Pelajaran                Pengetahuan  Keterampilan\n";
          text += "  " + "-".repeat(55) + "\n";
          for (const sc of record.subjectScores) {
            const name = sc.subjectName.padEnd(30);
            const knowledge = String(sc.knowledgeScore).padStart(10);
            const skills = String(sc.skillsScore).padStart(12);
            text += `  ${name}${knowledge}${skills}\n`;
          }
        }

        // Kehadiran
        if (record.attendance) {
          text += "\nKehadiran:\n";
          text += `  Sakit: ${record.attendance.sick} hari\n`;
          text += `  Izin: ${record.attendance.permission} hari\n`;
          text += `  Alpha: ${record.attendance.absent} hari\n`;
        }

        // Prestasi
        if (record.achievements.length > 0) {
          text += "\nPrestasi:\n";
          for (const ach of record.achievements) {
            text += `  - [${ach.type}] ${ach.title}\n`;
          }
        }

        text += "\n";
      }

      text += "========================================\n";
      text += `Dicetak: ${new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}\n`;
      text += "© LSAR SYSTEM - DATA TERENKRIPSI\n";

      await navigator.clipboard.writeText(text);
      toast.success("Data berhasil disalin ke clipboard");
      logger.info("BukuIndukPage", "Data buku induk berhasil disalin ke clipboard");
    } catch (err) {
      logger.error("BukuIndukPage", "Gagal menyalin data ke clipboard", { err });
      toast.error("Gagal menyalin data. Coba lagi.");
    }
  }

  /** Trigger refresh saat params.id berubah */
  useEffect(() => { refresh(); }, [params.id]);

  // ── Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────
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

  // ── Not Found State ──────────────────────────────────────────────
  if (!preview) {
    return <div className="text-center py-12 text-muted-foreground">Data tidak ditemukan</div>;
  }

  /** Destructure biodata dari preview */
  const bio = preview.biodata;

  return (
    <div className="space-y-6">
      {/* ── Print Styles ────────────────────────────────────────────── */}
      {/*
       * CSS @media print untuk layout A4 yang rapi saat dicetak/di-PDF.
       * - Sembunyikan elemen dengan class .no-print (navbar, sidebar, tombol)
       * - Atur ukuran halaman A4 dengan margin 2cm
       * - Pastikan warna tetap tercetak
       * - Tambahkan page numbers via counter
       */}
      <style>{`
        @media print {
          /* Warna tetap muncul di print */
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Sembunyikan elemen non-cetak */
          nav, header, footer, .no-print, .no-print * {
            display: none !important;
          }
          /* Reset margin dan padding */
          @page {
            size: A4;
            margin: 2cm;
          }
          /* Layout cetak — single column full width */
          .print-area {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Grid cetak — jadi single column */
          .print-grid {
            display: block !important;
          }
          /* Hapus shadow dan rounded corners di cetak */
          .print-card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 0 !important;
            page-break-inside: avoid;
          }
          /* Pastikan tabel tidak pecah */
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
          }
          /* Sembunyikan scrollbar */
          ::-webkit-scrollbar {
            display: none;
          }
        }
        /* Print preview watermark */
        @media print {
          .print-watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            color: rgba(0, 0, 0, 0.03);
            pointer-events: none;
            z-index: -1;
            font-weight: bold;
            white-space: nowrap;
          }
        }
      `}</style>

      {/* ── Breadcrumb — class .no-print agar tidak tercetak ─────────── */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5 no-print">
        <Link href="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
        <span>›</span>
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Buku Induk</span>
      </div>

      {/* ── Header — tombol aksi pakai class .no-print ─────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Tombol back ke profil siswa */}
          <Link
            href={`/students/${params.id}`}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Buku Induk Siswa</h1>
            <p className="text-sm text-gray-500 mt-0.5">Dokumen arsip resmi data akademik dan biodata lengkap siswa.</p>
          </div>
        </div>
        {/* Tombol aksi — Unduh PDF, Cetak, Salin Data (no-print) */}
        <div className="flex gap-2 no-print">
          <button
            onClick={() => {
              logger.info("BukuIndukPage", "Unduh PDF / Cetak diklik — memicu window.print()");
              window.print();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Unduh PDF
          </button>
          <button
            onClick={() => {
              logger.info("BukuIndukPage", "Cetak diklik — memicu window.print()");
              window.print();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
          <button
            onClick={() => {
              logger.info("BukuIndukPage", "Salin Data diklik");
              copyFormattedData();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Salin Data
          </button>
        </div>
      </div>

      {/* ── Main Content: 2-column layout ──────────────────────────── */}
      {/*
       * class print-grid dan print-card untuk styling cetak:
       * - print-grid → single column di print
       * - print-card → hapus shadow, pertahankan border
       */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-grid">
        {/* ====== Left: Student Card + Doc Info ====== */}
        <div className="space-y-4">
          {/* Kartu Identitas Siswa — dengan foto profil placeholder */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm print-card">
            <div className="h-20 bg-gradient-to-r from-blue-500 to-blue-400 relative">
              {/* Avatar — center di bawah banner */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-white shadow flex items-center justify-center">
                  <User className="w-7 h-7 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="pt-10 pb-5 px-5 text-center">
              <h2 className="text-base font-bold text-gray-900">{bio.name}</h2>
              <p className="text-xs text-blue-600 font-semibold mt-0.5">NISN: {bio.nisn}</p>
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Kelas</p>
                  <p className="font-semibold text-gray-700">{bio.className}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Status</p>
                  <p className="font-semibold text-emerald-600">Aktif</p>
                </div>
              </div>
            </div>
          </div>

          {/* Informasi Dokumen — ID dokumen, update date, petugas */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-500" />
              Informasi Dokumen
            </h3>
            <div className="space-y-2 text-sm">
              {/* ID Dokumen — format BI-{tahun}-{nis} */}
              <div className="flex justify-between">
                <span className="text-gray-500">ID Dokumen</span>
                <span className="text-gray-700 font-mono text-xs">BI-{new Date().getFullYear()}-{bio.nis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Terakhir Diperbarui</span>
                <span className="text-gray-700">{new Date().toLocaleDateString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Petugas Input</span>
                <span className="text-gray-700">Admin</span>
              </div>
            </div>
          </div>

          {/* Riwayat Log — aktivitas terbaru (static untuk MVP) */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-500" />
              Riwayat Log
            </h3>
            <div className="space-y-2">
              <LogItem text="Dokumen digenerate" time="Baru saja" />
              <LogItem text="Data nilai diperbarui" time="Hari ini" />
            </div>
          </div>
        </div>

        {/* ====== Right: Document Content ====== */}
        <div className="lg:col-span-2 space-y-4 print-area">
          {/* I. Keterangan Tentang Siswa — data biodata */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm print-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">I. Keterangan Tentang Siswa</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-red-50 text-red-500 border border-red-100">
                RAHASIA
              </span>
            </div>
            <div className="space-y-0">
              <DocRow label="Nama Lengkap" value={bio.name} />
              <DocRow label="Jenis Kelamin" value={bio.gender === "L" ? "Laki-laki" : "Perempuan"} />
              <DocRow label="NISN" value={bio.nisn} />
              <DocRow label="NIS / Nomor Induk" value={bio.nis} />
              <DocRow label="Kelas" value={bio.className} />
            </div>
          </div>

          {/* II. Data Akademik per Semester — iterasi setiap record */}
          {preview.semesterRecords.map((record) => (
            <div key={record.id || `${record.year}-${record.semester}`} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm print-card">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-500" />
                {record.year} — Semester {record.semester === 1 ? "Ganjil" : "Genap"}
              </h2>

              {/* ── Subject Scores ──────────────────────────────────── */}
              {record.subjectScores.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nilai Akademik</h4>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Mata Pelajaran</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-gray-400 w-24">Pengetahuan</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-gray-400 w-24">Keterampilan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.subjectScores.map((sc) => (
                          <tr key={sc.id} className="border-b border-gray-50">
                            <td className="py-2 px-3 text-gray-700">{sc.subjectName}</td>
                            <td className="py-2 px-3 text-center font-semibold text-blue-600">{sc.knowledgeScore}</td>
                            <td className="py-2 px-3 text-center font-semibold text-blue-600">{sc.skillsScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Attendance ──────────────────────────────────────── */}
              {record.attendance && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kehadiran</h4>
                  <div className="flex gap-3">
                    <span className="px-3 py-2 bg-orange-50 rounded-lg text-sm border border-orange-100">
                      Sakit: <strong className="text-orange-600">{record.attendance.sick}</strong>
                    </span>
                    <span className="px-3 py-2 bg-blue-50 rounded-lg text-sm border border-blue-100">
                      Izin: <strong className="text-blue-600">{record.attendance.permission}</strong>
                    </span>
                    <span className="px-3 py-2 bg-red-50 rounded-lg text-sm border border-red-100">
                      Alpha: <strong className="text-red-600">{record.attendance.absent}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* ── Achievements ──────────────────────────────────── */}
              {record.achievements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prestasi</h4>
                  <div className="space-y-1">
                    {record.achievements.map((ach) => (
                      <div key={ach.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-sm text-gray-700">{ach.title}</span>
                        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                          {ach.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Empty state jika belum ada data semester */}
          {preview.semesterRecords.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm print-card">
              <GraduationCap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada data semester untuk ditampilkan.</p>
            </div>
          )}

          {/* ── Dokumen Siswa ─────────────────────────────────────── */}
          {/*
           * Bagian ini menampilkan daftar dokumen siswa (akta kelahiran, KK, ijazah, dll)
           * dan menyediakan tombol upload untuk menambah dokumen baru.
           * Data di-fetch dari GET /upload/students/:id/documents.
           */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm print-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Dokumen Siswa
              </h2>
              {/* Badge jumlah dokumen */}
              <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-medium">
                {documents.length} dokumen
              </span>
            </div>

            {/* Daftar dokumen — loading state */}
            {loadingDocs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              /* Empty state: belum ada dokumen */
              <div className="py-6 text-center">
                <Paperclip className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Belum ada dokumen siswa</p>
                <p className="text-xs text-gray-300 mt-0.5">Upload dokumen seperti akta, KK, atau ijazah</p>
              </div>
            ) : (
              /* Grid daftar dokumen — nama, type, ukuran, download */
              <div className="space-y-2 mb-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-100 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon berdasarkan tipe file */}
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        {/* Nama dokumen — truncated jika panjang */}
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          {/* Tipe file (MIME) */}
                          <span className="uppercase">{doc.mimeType.split("/")[1] || doc.mimeType}</span>
                          <span>•</span>
                          {/* Ukuran file — format bytes → KB/MB */}
                          <span>{formatFileSize(doc.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Tombol download/lihat dokumen */}
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      onClick={() => logger.info("BukuIndukPage", "Membuka dokumen", { docId: doc.id, name: doc.name })}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* ── Upload dokumen baru ──────────────────────────────── */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Upload Dokumen Baru
              </p>
              <div className="flex items-center gap-3">
                {/* Hidden file input — trigger via label */}
                <input
                  type="file"
                  id="doc-upload-input"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  disabled={uploadingDoc}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedDocFile(file);
                    logger.info("BukuIndukPage", "File dokumen dipilih", {
                      fileName: file?.name,
                      fileSize: file?.size,
                    });
                  }}
                />
                {/* Label bertindak sebagai tombol upload (styled) */}
                <label
                  htmlFor="doc-upload-input"
                  className={`flex-1 flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    selectedDocFile
                      ? "border-blue-400 bg-blue-50/30"
                      : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/10"
                  }`}
                >
                  <Paperclip className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 truncate">
                    {selectedDocFile ? selectedDocFile.name : "Pilih file..."}
                  </span>
                </label>
                {/* Tombol kirim — aktif hanya jika ada file terpilih */}
                <button
                  onClick={uploadDocument}
                  disabled={!selectedDocFile || uploadingDoc}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {uploadingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploadDocProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
              {/* Progress bar upload — tampil saat upload berlangsung */}
              {uploadingDoc && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadDocProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Signature Area ────────────────────────────────────── */}
          {/* Area tanda tangan: Kepala Sekolah (kiri) dan Wali Kelas (kanan) */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm print-card">
            <div className="flex justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-12">Mengetahui,</p>
                <div className="border-t border-gray-300 pt-2 w-40 mx-auto">
                  <p className="text-sm font-semibold text-gray-700">Kepala Sekolah</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-12">
                  {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <div className="border-t border-gray-300 pt-2 w-40 mx-auto">
                  <p className="text-sm font-semibold text-gray-700">Wali Kelas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} LSAR SYSTEM • DATA TERENKRIPSI
      </div>
    </div>
  );
}

/**
 * DocRow — Baris data dokumen dengan label dan value.
 * Digunakan di bagian "Keterangan Tentang Siswa".
 * @param label - Nama field (contoh: "Nama Lengkap")
 * @param value - Nilai field
 */
function DocRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wider w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

/**
 * LogItem — Item riwayat log dengan bullet point biru.
 * @param text - Deskripsi aktivitas
 * @param time - Waktu relatif aktivitas
 */
function LogItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      <div className="flex-1">
        <p className="text-sm text-gray-700">{text}</p>
        <p className="text-[10px] text-gray-400 uppercase">{time}</p>
      </div>
    </div>
  );
}

/**
 * formatFileSize — Mengonversi ukuran file dari bytes ke format yang mudah dibaca (KB/MB).
 * @param bytes - Ukuran file dalam satuan bytes
 * @returns String format ukuran file, misal "245 KB" atau "1.2 MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
