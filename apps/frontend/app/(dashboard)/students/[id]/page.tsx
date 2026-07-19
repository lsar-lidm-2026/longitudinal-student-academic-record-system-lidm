"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ini menampilkan detail profil seorang siswa beserta data akademiknya
 * dalam bentuk tabs: Statistik Akademik, Timeline Semester, dan Catatan.
 *
 * Alur lengkap:
 * 1. Mengambil params.id dari URL untuk identifikasi siswa.
 * 2. useEffect memanggil refresh() saat params.id berubah.
 * 3. refresh() mengambil data dari endpoint /students/:id/profile
 *    yang mengembalikan StudentProfile (student + semesterRecords).
 * 4. Dari data semesterRecords, dihitung statistik:
 *    - avgScore: rata-rata nilai pengetahuan dari semua semester.
 *    - totalAttendanceRate: estimasi tingkat kehadiran (100 - total absensi).
 * 5. Layout terbagi menjadi 2 kolom:
 *    - Kiri: kartu profil siswa + ringkasan nilai + kehadiran.
 *    - Kanan: tabs (Akademik, Timeline, Catatan) dengan konten masing-masing.
 * 6. Tabs menggunakan komponen Tabs dari @/components/ui/tabs.
 * 7. Loading state: skeleton placeholder. Error state: pesan + tombol retry.
 *
 * Fitur tambahan:
 * 8. Edit Biodata Modal: tombol "Ubah Biodata" membuka modal form (name, NIS, NISN),
 *    submit ke PUT /students/:id, refresh data, toast notifikasi.
 * 9. Photo Upload: avatar menampilkan student.photoUrl (jika ada), hover overlay
 *    dengan tombol kamera untuk upload foto baru via POST /upload/students/:id/photo.
 */

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  MapPin,
  Calendar,
  Users,
  Award,
  Download,
  Edit,
  TrendingUp,
  Clock,
  Trophy,
  Camera,
  Loader2,
  X,
  Upload,
  RefreshCw,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudentTimeline } from "@/components/students/StudentTimeline";
import { RiskBadge } from "@/components/ml/RiskBadge";
import { TrendChart } from "@/components/ml/TrendChart";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { StudentProfile, StudentNote, StudentRiskResponse, StudentTrendResponse } from "@/types";

export default function StudentDetailPage() {
  /** Ambil parameter id dari URL — Next.js App Router useParams() */
  const params = useParams();
  /** State utama: data profil siswa (Student + SemesterRecord[]) */
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  /** Indikator loading untuk skeleton */
  const [loading, setLoading] = useState(true);
  /** State error apabila fetch gagal */
  const [error, setError] = useState<string | null>(null);

  // ── Edit Biodata Modal States ────────────────────────────────────────
  /** Kontrol visibilitas modal Ubah Biodata */
  const [isModalOpen, setIsModalOpen] = useState(false);
  /** Nilai form biodata — di-populate dari student saat modal dibuka */
  const [formData, setFormData] = useState({ name: "", nis: "", nisn: "" });
  /** Loading state saat submit form biodata */
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ── Photo Upload States ───────────────────────────────────────────────
  /** Loading state saat upload foto */
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  /** Ref ke hidden file input untuk trigger upload foto */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * refresh — Fungsi untuk mengambil data profil dari API.
   * Dipanggil saat mount dan saat params.id berubah.
   */
  function refresh() {
    setLoading(true);
    setError(null);
    logger.info("StudentDetailPage", "Mengambil data profil siswa", { studentId: params.id });
    api.handleResponse(api.get<StudentProfile>(`/students/${params.id}/profile`))
      .then((data) => {
        setProfile(data);
        logger.info("StudentDetailPage", "Data profil siswa berhasil dimuat", {
          name: data.student.name,
          semesterRecords: data.semesterRecords.length,
        });
      })
      .catch((err) => {
        const msg = err.message || "Gagal memuat data siswa";
        setError(msg);
        logger.error("StudentDetailPage", "Gagal memuat profil siswa", { err, studentId: params.id });
      })
      .finally(() => {
        setLoading(false);
        logger.info("StudentDetailPage", "Fetch profil selesai", { loading: false });
      });
  }

  /** Trigger fetch saat params.id berubah */
  useEffect(() => { refresh(); }, [params.id]);

  // ── Edit Biodata Handlers ────────────────────────────────────────────

  /**
   * handleOpenModal — Buka modal Ubah Biodata dan isi form dengan data terkini.
   * Dipanggil saat tombol "Ubah Biodata" diklik.
   */
  function handleOpenModal() {
    logger.info("StudentDetailPage", "Membuka modal Ubah Biodata", { studentId: params.id });
    if (profile) {
      // Isi form dari data student yang sudah ada
      setFormData({
        name: profile.student.name || "",
        nis: profile.student.nis || "",
        nisn: profile.student.nisn || "",
      });
    }
    setIsModalOpen(true);
  }

  /**
   * handleCloseModal — Tutup modal dan reset form ke default (string kosong).
   */
  function handleCloseModal() {
    logger.info("StudentDetailPage", "Menutup modal Ubah Biodata");
    setIsModalOpen(false);
    setFormData({ name: "", nis: "", nisn: "" });
  }

  /**
   * handleSubmitBiodata — Kirim perubahan biodata ke API.
   * Alur:
   * 1. Set isSubmitting = true untuk loading state tombol.
   * 2. PUT /students/:id dengan body { name, nis, nisn }.
   * 3. Jika sukses → refresh profil, tutup modal, toast success.
   * 4. Jika gagal → toast error, tetap di modal.
   * 5. Finally → isSubmitting = false.
   */
  async function handleSubmitBiodata() {
    logger.info("StudentDetailPage", "Submit perubahan biodata", { studentId: params.id, ...formData });
    setIsSubmitting(true);
    try {
      await api.handleResponse(
        api.put(`/students/${params.id}`, {
          name: formData.name,
          nis: formData.nis,
          nisn: formData.nisn,
        })
      );
      logger.info("StudentDetailPage", "Biodata berhasil diperbarui");
      toast.success("Biodata berhasil diperbarui");
      refresh(); // Refresh data profil agar tampilan terbaru
      handleCloseModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui biodata";
      logger.error("StudentDetailPage", "Gagal update biodata", { err, studentId: params.id });
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Catatan Guru States ──────────────────────────────────────────────
  /** Daftar catatan guru untuk siswa ini */
  const [notes, setNotes] = useState<StudentNote[]>([]);
  /** Loading state saat mengambil catatan */
  const [notesLoading, setNotesLoading] = useState(false);
  /** Kontrol visibilitas form tambah catatan */
  const [showNoteForm, setShowNoteForm] = useState(false);
  /** Konten textarea catatan baru */
  const [noteContent, setNoteContent] = useState("");
  /** Loading state saat submit catatan baru */
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  /** ID user yang sedang login — untuk menentukan hak hapus catatan */
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Photo Upload Handler ─────────────────────────────────────────────

  /**
   * handlePhotoUpload — Upload foto profil siswa via FormData.
   * Alur:
   * 1. Validasi file (tipe gambar, max 2MB).
   * 2. Set isUploadingPhoto = true.
   * 3. POST /upload/students/:id/photo dengan FormData (field: "file").
   * 4. Gunakan fetch langsung (bukan api.post) karena butuh FormData.
   * 5. Jika sukses → refresh profil, toast success.
   * 6. Jika gagal → toast error.
   * 7. Finally → isUploadingPhoto = false, reset input value.
   *
   * @param e - Change event dari <input type="file">
   */
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi tipe file — hanya gambar
    if (!file.type.startsWith("image/")) {
      logger.warn("StudentDetailPage", "File yang dipilih bukan gambar", { type: file.type });
      toast.error("Hanya file gambar yang diperbolehkan (JPEG, PNG, WebP, GIF)");
      return;
    }
    // Validasi ukuran — maks 2MB
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      logger.warn("StudentDetailPage", "Ukuran file terlalu besar", { size: file.size });
      toast.error("Ukuran foto maksimal 2MB");
      return;
    }

    logger.info("StudentDetailPage", "Upload foto profil", { studentId: params.id, fileName: file.name, fileSize: file.size });
    setIsUploadingPhoto(true);

    try {
      // Gunakan FormData — tidak bisa pakai api.post karena Content-Type otomatis multipart
      const formData = new FormData();
      formData.append("file", file);

      // Baca token dari localStorage untuk Authorization header
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

      const res = await fetch(`${API_URL}/upload/students/${params.id}/photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Gagal upload foto");
      }

      logger.info("StudentDetailPage", "Foto profil berhasil diupload", { url: data.data?.url });
      toast.success("Foto profil berhasil diperbarui");
      refresh(); // Refresh untuk menampilkan foto baru
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengupload foto";
      logger.error("StudentDetailPage", "Gagal upload foto", { err, studentId: params.id });
      toast.error(msg);
    } finally {
      setIsUploadingPhoto(false);
      // Reset input value agar bisa memilih file yang sama lagi
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // ── Catatan Guru Functions ───────────────────────────────────────────

  /**
   * fetchNotes — Mengambil daftar catatan guru dari API.
   * Alur:
   * 1. Set notesLoading = true.
   * 2. GET /students/:id/notes via api.handleResponse.
   * 3. Urutkan data dari yang terbaru (newest first) berdasarkan createdAt.
   * 4. Set state notes dengan data yang sudah diurutkan.
   * 5. Jika gagal → toast error.
   * 6. Finally → notesLoading = false.
   */
  async function fetchNotes() {
    if (!params.id) return;
    setNotesLoading(true);
    logger.info("StudentDetailPage", "Mengambil catatan guru", { studentId: params.id });
    try {
      const data = await api.handleResponse(
        api.get<StudentNote[]>(`/students/${params.id}/notes`)
      );
      // Urutkan dari yang terbaru — newest first
      const sorted = data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotes(sorted);
      logger.info("StudentDetailPage", "Catatan guru berhasil dimuat", { count: data.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat catatan";
      logger.error("StudentDetailPage", "Gagal memuat catatan", { err, studentId: params.id });
      toast.error(msg);
    } finally {
      setNotesLoading(false);
    }
  }

  /**
   * handleAddNote — Menambahkan catatan baru untuk siswa.
   * Alur:
   * 1. Validasi content tidak kosong (trim).
   * 2. POST /students/:id/notes dengan body { content }.
   * 3. Jika sukses → reset form, tutup form, refresh notes, toast success.
   * 4. Jika gagal → toast error.
   */
  async function handleAddNote() {
    if (!noteContent.trim()) {
      toast.error("Catatan tidak boleh kosong");
      return;
    }
    logger.info("StudentDetailPage", "Menambahkan catatan baru", {
      studentId: params.id,
      contentLength: noteContent.length,
    });
    setNoteSubmitting(true);
    try {
      await api.handleResponse(
        api.post(`/students/${params.id}/notes`, { content: noteContent.trim() })
      );
      logger.info("StudentDetailPage", "Catatan berhasil ditambahkan");
      toast.success("Catatan berhasil ditambahkan");
      // Reset form state
      setNoteContent("");
      setShowNoteForm(false);
      // Refresh daftar catatan
      await fetchNotes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambahkan catatan";
      logger.error("StudentDetailPage", "Gagal menambahkan catatan", { err, studentId: params.id });
      toast.error(msg);
    } finally {
      setNoteSubmitting(false);
    }
  }

  /**
   * handleDeleteNote — Menghapus catatan milik guru yang sedang login.
   * Hanya catatan dengan createdById === currentUserId yang bisa dihapus.
   * Alur:
   * 1. DELETE /teacher-notes/:noteId via api.delete.
   * 2. Jika sukses → refresh notes, toast success.
   * 3. Jika gagal → toast error.
   *
   * @param noteId - UUID catatan yang akan dihapus
   */
  async function handleDeleteNote(noteId: string) {
    logger.info("StudentDetailPage", "Menghapus catatan", { noteId });
    try {
      await api.handleResponse(
        api.delete(`/teacher-notes/${noteId}`)
      );
      logger.info("StudentDetailPage", "Catatan berhasil dihapus", { noteId });
      toast.success("Catatan berhasil dihapus");
      await fetchNotes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus catatan";
      logger.error("StudentDetailPage", "Gagal menghapus catatan", { err, noteId });
      toast.error(msg);
    }
  }

  // ── ML Risk & Trend States ──────────────────────────────────────────
  /**
   * Data risk assessment dari GET /ml/risk/student/:id.
   * Berisi level risiko, skor, faktor, rekomendasi, dan AI explanation.
   */
  const [riskData, setRiskData] = useState<StudentRiskResponse | null>(null);
  /** Data trend akademik dari GET /ml/trend/student/:id */
  const [trendData, setTrendData] = useState<StudentTrendResponse | null>(null);
  /** Loading state untuk fetch risk & trend */
  const [mlLoading, setMlLoading] = useState(false);
  /** Error state untuk fetch risk & trend */
  const [mlError, setMlError] = useState<string | null>(null);

  /**
   * fetchRiskAndTrend — Mengambil data risk assessment dan trend akademik
   * dari endpoint ML secara paralel.
   *
   * Alur:
   * 1. Set mlLoading = true, reset error.
   * 2. Gunakan Promise.all untuk fetch risk dan trend secara paralel.
   * 3. Jika sukses → set state riskData dan trendData.
   * 4. Jika gagal → set mlError dengan pesan error.
   * 5. Finally → mlLoading = false.
   */
  async function fetchRiskAndTrend() {
    const studentId = params.id;
    if (!studentId) return;
    setMlLoading(true);
    setMlError(null);
    logger.info("StudentDetailPage", "Mengambil data ML risk & trend", { studentId });

    try {
      // Fetch risk assessment dan trend secara paralel untuk efisiensi
      const [risk, trend] = await Promise.all([
        api.handleResponse(api.get<StudentRiskResponse>(`/ml/risk/student/${studentId}`)),
        api.handleResponse(api.get<StudentTrendResponse>(`/ml/trend/student/${studentId}`)),
      ]);
      setRiskData(risk);
      setTrendData(trend);
      logger.info("StudentDetailPage", "Data ML risk & trend berhasil dimuat", {
        riskLevel: risk.risk.level,
        trendDirection: trend.trend.trend,
      });
    } catch (err: any) {
      const msg = err.message || "Gagal memuat data analisis ML";
      setMlError(msg);
      logger.error("StudentDetailPage", "Gagal memuat data ML", { err, studentId });
    } finally {
      setMlLoading(false);
    }
  }

  /** Trigger fetch risk & trend saat params.id berubah (bersamaan dengan profil) */
  useEffect(() => { fetchRiskAndTrend(); }, [params.id]);

  // ── Catatan Guru: Decode JWT & fetch notes ────────────────────────────
  /**
   * Decode current user ID dari JWT access token yang tersimpan.
   * Digunakan untuk menentukan apakah tombol hapus catatan ditampilkan
   * (hanya guru yang membuat catatan bisa menghapus catatannya sendiri).
   */
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUserId(payload.userId || null);
        logger.info("StudentDetailPage", "Current user ID decoded from JWT", { userId: payload.userId });
      } catch {
        logger.warn("StudentDetailPage", "Gagal decode token JWT untuk currentUserId");
      }
    }
  }, []);

  /**
   * Fetch catatan guru saat student ID tersedia.
   * Dipisah dari useEffect utama agar tidak blocking render profil.
   */
  useEffect(() => {
    if (params.id) {
      fetchNotes();
    }
  }, [params.id]);

  // ── Loading State: Skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Skeleton: judul, subjudul, dan area konten utama */}
        <div className="h-12 w-64 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-64 w-full bg-gray-200 animate-pulse rounded-2xl" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────
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

  // ── Not Found State ──────────────────────────────────────────────────
  if (!profile) {
    return <div className="text-center py-12 text-gray-500">Siswa tidak ditemukan</div>;
  }

  /** Destructure data profil: data siswa dan daftar record semester */
  const { student, semesterRecords } = profile;

  // ── Compute simple stats from semester records ───────────────────────
  /** Rata-rata nilai pengetahuan dari seluruh semester */
  const avgScore = semesterRecords.length > 0
    ? Math.round(
        semesterRecords.reduce((sum, r) => {
          const scores = r.subjectScores || [];
          if (scores.length === 0) return sum;
          // rata-rata per semester dulu, baru di-accumulate
          return sum + scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length;
        }, 0) / semesterRecords.length
      )
    : 0;

  /** Estimasi tingkat kehadiran (100 - total hari absen) */
  const totalAttendanceRate = semesterRecords.length > 0
    ? (() => {
        const total = semesterRecords.reduce((s, r) => {
          if (!r.attendance) return s;
          return s + r.attendance.sick + r.attendance.permission + r.attendance.absent;
        }, 0);
        // Approximate: fewer absences = higher rate
        return total === 0 ? 100 : Math.max(0, 100 - total);
      })()
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <Link href="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
        <span>›</span>
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Detail Siswa</span>
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Profil Siswa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola informasi mendalam dan pantau perkembangan akademik siswa.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Tombol navigasi ke halaman Buku Induk */}
          <Link
            href={`/students/${params.id}/buku-induk`}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white shadow-sm"
          >
            <Download className="w-4 h-4" />
            Ekspor Buku Induk
          </Link>
          {/* Tombol Ubah Biodata — membuka modal form edit biodata */}
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Ubah Biodata
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ====== Left: Profile Card + Quick Stats ====== */}
        <div className="space-y-4">
          {/* Kartu Profil Siswa — dengan banner header + avatar placeholder */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Banner gradient biru */}
            <div className="h-24 bg-gradient-to-r from-blue-500 to-blue-400 relative">
              {/* Foto profil — menampilkan photoUrl jika ada, fallback ke ikon User */}
              {/* Hover overlay untuk upload foto baru — camera icon muncul di hover */}
              <div className="absolute -bottom-10 left-5 group">
                <div className="relative w-20 h-20 rounded-xl bg-white border-4 border-white shadow-sm flex items-center justify-center overflow-hidden">
                  {profile.student.photoUrl ? (
                    /* Foto real dari server: tampilkan gambar siswa */
                    <img
                      src={profile.student.photoUrl}
                      alt={profile.student.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    /* Fallback: ikon default jika belum ada foto */
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                  {/* Overlay saat hover — tombol ganti foto dengan ikon kamera */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
                {/* Hidden file input — trigger via click pada overlay kamera */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>
            <div className="pt-12 pb-5 px-5">
              {/* Nama siswa + badge status */}
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900">{student.name}</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
                  Aktif
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {student.class?.name || "-"} • {student.nisn}
              </p>

              {/* Detail informasi siswa — dalam baris dengan ikon */}
              {/* birthDate, address, parentName adalah field opsional dari backend (FR-04) */}
              <div className="mt-5 space-y-3">
                <InfoRow icon={Calendar} label="Tanggal Lahir" value={formatBirthDate(student.birthDate)} />
                <InfoRow icon={MapPin} label="Alamat" value={student.address || "-"} />
                <InfoRow icon={Users} label="Nama Orang Tua" value={student.parentName || "-"} />
                <InfoRow icon={Award} label="Jenis Kelamin" value={student.gender === "L" ? "Laki-laki" : "Perempuan"} />
              </div>
            </div>
          </div>

          {/* Quick Stats: Rata-rata Nilai */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Rata-rata Nilai</p>
                <p className="text-lg font-bold text-gray-900">{avgScore || "-"}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats: Tingkat Kehadiran */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Tingkat Kehadiran</p>
                <p className="text-lg font-bold text-gray-900">{totalAttendanceRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* ====== Right: Tabs Content ====== */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="akademik">
            {/* Tab navigasi */}
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="akademik">Statistik Akademik</TabsTrigger>
              <TabsTrigger value="timeline">Timeline Semester</TabsTrigger>
              <TabsTrigger value="catatan">Catatan</TabsTrigger>
            </TabsList>

            {/* ── Tab: Statistik Akademik ──────────────────────────────── */}
            <TabsContent value="akademik">
              <div className="space-y-4">
                {/* Rekap Nilai per Semester */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Rekap Nilai per Semester
                  </h3>
                  {semesterRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Belum ada data semester</p>
                  ) : (
                    <div className="space-y-3">
                      {semesterRecords.map((record) => {
                        /** Hitung rata-rata nilai pengetahuan untuk record ini */
                        const scores = record.subjectScores || [];
                        const avg = scores.length > 0
                          ? Math.round(scores.reduce((s, sc) => s + sc.knowledgeScore, 0) / scores.length)
                          : 0;
                        return (
                          <div key={record.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {record.academicYear?.year || "N/A"} - Semester {record.semester}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{scores.length} mata pelajaran</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">{avg}</p>
                              <p className="text-[10px] text-gray-400">rata-rata</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Analisis Risiko & Tren (ML) ──────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  {/* Header: judul + tombol refresh */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Analisis Risiko & Tren Akademik
                    </h3>
                    <button
                      onClick={fetchRiskAndTrend}
                      disabled={mlLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
                      title="Refresh data analisis"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${mlLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>

                  {/* ── Loading State ──────────────────────────────────── */}
                  {mlLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3" />
                      <p className="text-sm text-gray-500">Menganalisis data siswa...</p>
                    </div>
                  )}

                  {/* ── Error State ────────────────────────────────────── */}
                  {!mlLoading && mlError && (
                    <div className="text-center py-6">
                      <p className="text-sm text-red-500 mb-3">{mlError}</p>
                      <button
                        onClick={fetchRiskAndTrend}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Coba Lagi
                      </button>
                    </div>
                  )}

                  {/* ── Risk & Trend Data ─────────────────────────────── */}
                  {!mlLoading && !mlError && (
                    <div className="space-y-4">
                      {/* Risk Assessment Section */}
                      {riskData && (
                        <div className="space-y-3">
                          {/* Baris: badge risiko + skor */}
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Badge level risiko — warna otomatis sesuai level */}
                            <RiskBadge level={riskData.risk.level} score={riskData.risk.score} />
                            <span className="text-xs text-gray-400">
                              Confidence: {(riskData as any).risk?.confidence ?? "-"}
                            </span>
                          </div>

                          {/* Skor risiko numerik — progress bar visual */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 font-medium">Skor Risiko</span>
                              <span className="text-xs font-bold text-gray-700">
                                {riskData.risk.score}/100
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  riskData.risk.level === "KRITIS"
                                    ? "bg-red-500"
                                    : riskData.risk.level === "WASPADA"
                                    ? "bg-amber-500"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${riskData.risk.score}%` }}
                              />
                            </div>
                          </div>

                          {/* Faktor Risiko — ditampilkan sebagai list dengan bullet */}
                          {riskData.risk.factors.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                Faktor Risiko
                              </p>
                              <ul className="space-y-1">
                                {riskData.risk.factors.map((factor, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                    {factor}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* AI Explanation — jika tersedia */}
                          {riskData.risk.aiExplanation && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold text-blue-700 mb-0.5">
                                    Penjelasan AI
                                  </p>
                                  <p className="text-sm text-blue-800/80 leading-relaxed">
                                    {riskData.risk.aiExplanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Rekomendasi — jika tersedia */}
                          {riskData.risk.recommendations.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                Rekomendasi
                              </p>
                              <ul className="space-y-1">
                                {riskData.risk.recommendations.map((rec, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Separator antara risk dan trend — hanya jika keduanya ada */}
                      {riskData && trendData && <hr className="border-gray-100" />}

                      {/* Trend Chart Section */}
                      {trendData && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Tren Akademik
                          </p>
                          {/* TrendChart menampilkan banner + metrik + bar chart */}
                          <TrendChart
                            features={trendData.features}
                            trend={{
                              trend: trendData.trend.trend,
                              description: trendData.trend.description,
                            }}
                          />
                        </div>
                      )}

                      {/* Empty state — jika tidak ada data risk maupun trend */}
                      {!riskData && !trendData && (
                        <p className="text-sm text-gray-400 py-4 text-center">
                          Belum ada data analisis. Klik Refresh untuk memuat.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons navigasi ke sub-halaman */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Link
                    href={`/students/${params.id}/semester-records`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Edit className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Input Semester</span>
                  </Link>
                  <Link
                    href={`/students/${params.id}/ai`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Trophy className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">AI Assistant</span>
                  </Link>
                  <Link
                    href={`/students/${params.id}/buku-induk`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <Download className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Buku Induk</span>
                  </Link>
                </div>
              </div>
            </TabsContent>

            {/* ── Tab: Timeline Semester ────────────────────────────────── */}
            <TabsContent value="timeline">
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                {semesterRecords.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Belum ada data semester</p>
                ) : (
                  <div className="px-4 py-2">
                    {/* Komponen StudentTimeline — render timeline visual */}
                    <StudentTimeline semesterRecords={semesterRecords} />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Catatan Guru ─────────────────────────────────────── */}
            <TabsContent value="catatan">
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                {/* Header: judul + tombol tambah catatan */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Catatan Guru
                  </h3>
                  {!showNoteForm && (
                    <button
                      onClick={() => setShowNoteForm(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Catatan
                    </button>
                  )}
                </div>

                {/* ── Form Tambah Catatan ───────────────────────────────── */}
                {showNoteForm && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Tulis catatan tentang perkembangan siswa..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        onClick={() => {
                          setShowNoteForm(false);
                          setNoteContent("");
                        }}
                        disabled={noteSubmitting}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleAddNote}
                        disabled={noteSubmitting || !noteContent.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {noteSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            Simpan Catatan
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Loading State ────────────────────────────────────── */}
                {notesLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-gray-100 rounded-lg" />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Daftar Catatan ───────────────────────────────────── */}
                {!notesLoading && notes.length > 0 && (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Konten catatan — whitespace-pre-wrap untuk menjaga format baris baru */}
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {note.content}
                            </p>
                            {/* Metadata: nama guru + timestamp */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <User className="w-3 h-3" />
                                <span>{note.createdBy?.name || "Guru"}</span>
                              </div>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs text-gray-400">
                                {formatRelativeTime(note.createdAt)}
                              </span>
                            </div>
                          </div>
                          {/* Tombol hapus — hanya tampil untuk catatan milik guru yang login */}
                          {currentUserId && note.createdById === currentUserId && (
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                              title="Hapus catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Empty State ──────────────────────────────────────── */}
                {!notesLoading && notes.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      Belum ada catatan guru untuk siswa ini.
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Klik "Tambah Catatan" untuk menambahkan catatan pertama.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Edit Biodata Modal ─────────────────────────────────────────── */}
      {/* Modal overlay dengan backdrop blur, hanya muncul jika isModalOpen true */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          {/* Panel modal — card putih dengan shadow */}
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header modal: judul + tombol close */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Ubah Biodata</h3>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body modal — form biodata */}
            <div className="px-6 py-5 space-y-4">
              {/* Field: Nama Lengkap */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Nama lengkap siswa"
                />
              </div>
              {/* Field: NIS (Nomor Induk Siswa) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIS</label>
                <input
                  type="text"
                  value={formData.nis}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nis: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Nomor Induk Siswa"
                />
              </div>
              {/* Field: NISN (Nomor Induk Siswa Nasional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NISN</label>
                <input
                  type="text"
                  value={formData.nisn}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nisn: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Nomor Induk Siswa Nasional"
                />
              </div>
            </div>

            {/* Footer modal — tombol aksi: Batal + Simpan */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitBiodata}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Simpan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * InfoRow — Komponen baris informasi dengan ikon di kiri.
 * Digunakan di kartu profil untuk menampilkan detail siswa.
 *
 * @param icon - Komponen ikon (Lucide icon)
 * @param label - Label di atas value (uppercase, kecil)
 * @param value - Nilai informasi yang ditampilkan
 */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-sm text-gray-700">{value}</p>
      </div>
    </div>
  );
}

/**
 * formatRelativeTime — Format ISO timestamp menjadi teks relatif dalam Bahasa Indonesia.
 * Contoh: "Baru saja", "5 menit yang lalu", "2 jam yang lalu", "3 hari yang lalu",
 * "1 minggu yang lalu", "2 bulan yang lalu", atau fallback ke locale date string.
 *
 * @param dateStr - ISO date string dari server (e.g. "2026-07-19T02:27:48.352Z")
 * @returns string teks relatif dalam Bahasa Indonesia
 */
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  // Logika: semakin besar selisih, semakin "jauh" format relatifnya
  if (diffSec < 0) return "Baru saja"; // handle future date (clock skew)
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  if (diffHour < 24) return `${diffHour} jam yang lalu`;
  if (diffDay < 7) return `${diffDay} hari yang lalu`;
  if (diffWeek < 4) return `${diffWeek} minggu yang lalu`;
  if (diffMonth < 12) return `${diffMonth} bulan yang lalu`;
  // Fallback: format tanggal lengkap untuk catatan lama (> 1 tahun)
  return date.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * formatBirthDate — Format ISO date string menjadi format tanggal Indonesia.
 * Contoh: "2020-03-12" → "12 Maret 2020"
 * Jika dateStr null/undefined → return "-"
 *
 * @param dateStr - ISO date string dari server (e.g. "2020-03-12")
 * @returns string tanggal dalam format "DD Bulan YYYY" atau "-" jika tidak ada
 */
function formatBirthDate(dateStr: string | null | undefined): string {
  if (!dateStr) {
    logger.debug("StudentDetailPage", "birthDate kosong — menampilkan fallback '-'", {});
    return "-";
  }
  try {
    const date = new Date(dateStr);
    // Validasi: pastikan date valid (NaN check)
    if (isNaN(date.getTime())) {
      logger.warn("StudentDetailPage", "birthDate tidak valid", { dateStr });
      return "-";
    }
    // Format ke locale Indonesia: "12 Maret 2020"
    const formatted = date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    logger.debug("StudentDetailPage", "birthDate berhasil diformat", { dateStr, formatted });
    return formatted;
  } catch (err) {
    logger.error("StudentDetailPage", "Gagal memformat birthDate", { err, dateStr });
    return "-";
  }
}
