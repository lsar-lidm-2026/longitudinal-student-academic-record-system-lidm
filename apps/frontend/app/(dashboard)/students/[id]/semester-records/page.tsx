"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ini adalah form input data semester siswa yang mencakup:
 * - Nilai mata pelajaran (knowledge + skills score per mapel)
 * - Kehadiran (sakit, izin, alpha)
 * - Prestasi (tambah/edit/hapus)
 * - Kesehatan (tinggi, berat, pendengaran, penglihatan, gigi)
 * - Catatan (placeholder)
 *
 * Alur lengkap:
 * 1. Saat mount, refresh() memuat: daftar academic years, semester records
 *    yang sudah ada, dan profil siswa (untuk nama).
 * 2. User memilih tahun ajaran dan semester, lalu klik "Buat / Muat Record".
 * 3. Jika record sudah ada, data di-load ke form (loadRecordData).
 *    Jika belum ada, record baru dibuat via createOrGetRecord().
 * 4. Setelah record siap (recordId tidak null), tabs akan muncul:
 *    - Nilai: input score per subject dalam tabel.
 *    - Kehadiran: dropdown jumlah hari (sakit, izin, alpha).
 *    - Prestasi: daftar prestasi + form tambah/edit.
 *    - Kesehatan: input tinggi/berat + dropdown kondisi.
 *    - Catatan: placeholder "akan segera tersedia".
 * 5. Tombol "Simpan Nilai & Kehadiran" mengirim batch score + attendance.
 * 6. Prestasi disimpan/update/hapus secara terpisah via API masing-masing.
 * 7. Kesehatan disimpan terpisah via API /health-record.
 */

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  BookOpen,
  CalendarCheck,
  Trophy,
  Heart,
  FileText,
  Save,
  Plus,
  User,
  Trash2,
  Pencil,
  X,
  Paperclip,
  Download,
  Loader2,
  MessageSquare,
  AlignLeft,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, API_BASE_URL } from "@/lib/api";
import { logger } from "@/lib/logger";
import { SUBJECTS } from "@/lib/constants";
import type { AcademicYear, SemesterRecord, Achievement, HealthRecord, StudentNote } from "@/types";

/**
 * Catatan: SUBJECTS diimpor dari lib/constants.ts.
 * Nilai-nilai inilah yang digunakan sebagai subjectName saat
 * submit nilai ke backend — harus konsisten dengan API.
 */

/** Opsi nilai 0-100 untuk dropdown select */
const SCORE_OPTIONS = Array.from({ length: 101 }, (_, i) => i);

/**
 * getGrade — Mengonversi nilai angka ke predikat huruf (A/B/C/D).
 * @param score - Nilai pengetahuan/skills (0-100)
 * @returns Predikat huruf: A (>=88), B (>=75), C (>=62), D (<62)
 */
function getGrade(score: number): string {
  if (score >= 88) return "A";
  if (score >= 75) return "B";
  if (score >= 62) return "C";
  return "D";
}

/**
 * getRelativeTime — Mengonversi timestamp ISO ke format relatif Bahasa Indonesia.
 * Contoh: "Baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu".
 * Untuk yang lebih dari 7 hari, tampilkan tanggal pendek (contoh: "12 Jul 2026").
 * @param dateStr - String tanggal ISO
 * @returns String waktu relatif
 */
function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * getCurrentUserId — Mendecode JWT access token untuk mendapatkan ID user yang login.
 * Berguna untuk menentukan apakah catatan milik user sendiri (tampilkan tombol hapus).
 * @returns ID user dari token, atau null jika token tidak tersedia / tidak valid
 */
function getCurrentUserId(): string | null {
  const token = api.getToken();
  if (!token) return null;
  try {
    // Decode payload JWT (bagian kedua setelah titik pertama)
    const payload = JSON.parse(atob(token.split(".")[1]));
    // JWT payload selalu berisi `userId` (lihat JwtPayload interface di common/types.ts)
    return payload.userId || null;
  } catch {
    logger.warn("getCurrentUserId", "Gagal mendecode JWT token");
    return null;
  }
}

/** Tipe data untuk input nilai per mata pelajaran di form */
interface SubjectScoreInput {
  subjectName: string;
  knowledgeScore: number;
  skillsScore: number;
  kkm: number;
  notes: string;
}

/** Tipe data untuk form tambah/edit prestasi */
interface AchievementForm {
  title: string;
  type: string;
  description: string;
}

/** Tipe data untuk form kesehatan */
interface HealthForm {
  height: string;
  weight: string;
  hearingCondition: string;
  visionCondition: string;
  teethCondition: string;
}

/** Helper untuk membuat form kesehatan kosong */
const emptyHealthForm = (): HealthForm => ({
  height: "",
  weight: "",
  hearingCondition: "",
  visionCondition: "",
  teethCondition: "",
});

export default function SemesterRecordsPage() {
  /** ID siswa dari URL parameter */
  const params = useParams();
  /** Nama siswa (diambil dari profile) */
  const router = useRouter();
  const [studentName, setStudentName] = useState("");
  /** Daftar semester records yang sudah ada */
  const [records, setRecords] = useState<SemesterRecord[]>([]);
  /** Daftar tahun ajaran untuk dropdown */
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  /** Tahun ajaran yang dipilih */
  const [selectedYear, setSelectedYear] = useState("");
  /** Semester yang dipilih (1=Ganjil, 2=Genap) */
  const [semester, setSemester] = useState<1 | 2>(1);
  /** ID record semester yang aktif (null = belum dibuat/dipilih) */
  const [recordId, setRecordId] = useState<string | null>(null);
  /** State array nilai per mata pelajaran */
  const [scores, setScores] = useState<SubjectScoreInput[]>(
    SUBJECTS.map((s) => ({ subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, notes: "" }))
  );
  /** State kehadiran: sakit, izin, alpha */
  const [attendance, setAttendance] = useState({ sick: 0, permission: 0, absent: 0 });
  /** Indikator loading utama */
  const [loading, setLoading] = useState(true);
  /** Indikator saving (nilai + kehadiran) */
  const [saving, setSaving] = useState(false);
  /** State error */
  const [error, setError] = useState<string | null>(null);

  // ── Achievements state ───────────────────────────────────────────────
  /** Daftar prestasi untuk record semester yang aktif */
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  /** Form state untuk tambah/edit prestasi */
  const [achievementForm, setAchievementForm] = useState<AchievementForm>({ title: "", type: "Akademik", description: "" });
  /** Prestasi yang sedang diedit (null = tambah baru) */
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  /** Tampilkan/sembunyikan form prestasi */
  const [showAchievementForm, setShowAchievementForm] = useState(false);
  /** Indikator saving prestasi */
  const [savingAchievement, setSavingAchievement] = useState(false);
  /** File lampiran yang dipilih untuk diupload ke prestasi */
  const [achievementAttachment, setAchievementAttachment] = useState<File | null>(null);
  /** Indikator upload lampiran prestasi */
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  /** Progress upload lampiran (0-100) */
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Health state ─────────────────────────────────────────────────────
  /** Data kesehatan yang sudah ada (null = belum diisi) */
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  /** Form state kesehatan */
  const [healthForm, setHealthForm] = useState<HealthForm>(emptyHealthForm());
  /** Indikator saving kesehatan */
  const [savingHealth, setSavingHealth] = useState(false);

  // ── Notes state ──────────────────────────────────────────────────────
  /** Daftar catatan guru untuk siswa ini */
  const [notes, setNotes] = useState<StudentNote[]>([]);
  /** Indikator loading catatan */
  const [loadingNotes, setLoadingNotes] = useState(false);
  /** Konten catatan yang sedang diketik user */
  const [noteContent, setNoteContent] = useState("");
  /** Indikator saving catatan baru */
  const [savingNote, setSavingNote] = useState(false);

  // ── Development Description state ──────────────────────────────────
  /** Konten deskripsi perkembangan */
  const [devDescription, setDevDescription] = useState("");
  /** Indikator saving deskripsi perkembangan */
  const [savingDevDesc, setSavingDevDesc] = useState(false);

  /**
   * refresh — Fungsi utama untuk memuat data awal halaman.
   * Mengambil academic years, semester records, dan profil siswa secara paralel.
   */
  function refresh() {
    setLoading(true);
    setError(null);
    logger.info("SemesterRecordsPage", "Memuat data awal", { studentId: params.id });
    Promise.all([
      api.handleResponse(api.get<AcademicYear[]>("/academic-years")),
      api.handleResponse(api.get<SemesterRecord[]>(`/students/${params.id}/semester-records`)),
      // Profile fetch non-critical: catch error agar tidak mengganggu data lain
      api.handleResponse(api.get<any>(`/students/${params.id}/profile`)).catch(() => null),
    ])
      .then(([yearsData, recordsData, profileData]) => {
        setAcademicYears(yearsData);
        // Set tahun ajaran aktif sebagai default
        const active = yearsData.find((y) => y.isActive);
        if (active) setSelectedYear(active.id);
        setRecords(recordsData);
        if (profileData?.student?.name) {
          setStudentName(profileData.student.name);
        }
        logger.info("SemesterRecordsPage", "Data awal berhasil dimuat", {
          yearsCount: yearsData.length,
          recordsCount: recordsData.length,
          studentName: profileData?.student?.name,
        });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
        logger.error("SemesterRecordsPage", "Gagal memuat data awal", { err });
      })
      .finally(() => setLoading(false));
  }

  /** Trigger refresh saat params.id berubah */
  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  /** Fetch catatan guru setiap kali recordId berubah (tabs baru aktif) */
  useEffect(() => {
    if (recordId) {
      fetchNotes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  /**
   * loadRecordData — Mengisi form state dengan data dari record semester yang sudah ada.
   * Mencakup: nilai, kehadiran, prestasi, dan kesehatan.
   * @param record - SemesterRecord yang dipilih/ditemukan
   */
  function loadRecordData(record: SemesterRecord) {
    setRecordId(record.id);
    logger.info("SemesterRecordsPage", "Memuat data record semester", { recordId: record.id });

    // ── Nilai ──
    // Map setiap subject ke nilai yang ada di record, atau default (0)
    if (record.subjectScores.length > 0) {
      setScores(
        SUBJECTS.map((s) => {
          // Cari subject score yang cocok berdasarkan nama
          const found = record.subjectScores.find((sc) => sc.subjectName === s);
          return found
            ? {
                subjectName: s,
                knowledgeScore: found.knowledgeScore,
                skillsScore: found.skillsScore,
                kkm: 75,
                notes: found.notes || "",
              }
            : { subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, notes: "" };
        })
      );
    } else {
      // Reset semua ke default jika belum ada nilai
      setScores(SUBJECTS.map((s) => ({ subjectName: s, knowledgeScore: 0, skillsScore: 0, kkm: 75, notes: "" })));
    }

    // ── Kehadiran ──
    if (record.attendance) {
      setAttendance({
        sick: record.attendance.sick,
        permission: record.attendance.permission,
        absent: record.attendance.absent,
      });
    } else {
      setAttendance({ sick: 0, permission: 0, absent: 0 });
    }

    // ── Prestasi ──
    setAchievements(record.achievements || []);
    // Reset form prestasi
    setShowAchievementForm(false);
    setEditingAchievement(null);
    setAchievementForm({ title: "", type: "Akademik", description: "" });

    // ── Kesehatan ──
    setHealthRecord(record.healthRecord);
    if (record.healthRecord) {
      setHealthForm({
        height: record.healthRecord.height?.toString() || "",
        weight: record.healthRecord.weight?.toString() || "",
        hearingCondition: record.healthRecord.hearingCondition || "",
        visionCondition: record.healthRecord.visionCondition || "",
        teethCondition: record.healthRecord.teethCondition || "",
      });
    } else {
      setHealthForm(emptyHealthForm());
    }

    // ── Deskripsi Perkembangan ──
    setDevDescription(record.developmentDescription || "");
  }

  /**
   * createOrGetRecord — Membuat record semester baru ATAU memuat data yang sudah ada.
   * Mengecek records yang sudah di-fetch berdasarkan academicYearId + semester.
   * Jika sudah ada, panggil loadRecordData(). Jika belum, buat via API POST.
   * @returns ID record semester, atau null jika gagal
   */
  async function createOrGetRecord(): Promise<string | null> {
    // Guard: cegah concurrent call saat saving
    if (saving) return null;

    // Cari apakah sudah ada record untuk tahun dan semester yang dipilih
    const existing = records.find(
      (r) => r.academicYearId === selectedYear && r.semester === semester
    );
    if (existing) {
      logger.info("SemesterRecordsPage", "Record sudah ada, memuat data", { recordId: existing.id });
      loadRecordData(existing);
      return existing.id;
    }

    // Tidak ada record yang cocok — buat baru
    logger.info("SemesterRecordsPage", "Membuat record semester baru", { yearId: selectedYear, semester });
    try {
      const data = await api.handleResponse(
        api.post<SemesterRecord>(`/students/${params.id}/semester-records`, {
          academicYearId: selectedYear,
          semester,
        })
      );
      setRecordId(data.id);
      setRecords((prev) => [...prev, data]); // Tambahkan ke daftar lokal
      // Reset prestasi & kesehatan karena record baru
      setAchievements([]);
      setHealthRecord(null);
      setHealthForm(emptyHealthForm());
      logger.info("SemesterRecordsPage", "Record semester baru berhasil dibuat", { recordId: data.id });
      return data.id;
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal membuat record semester", { err });
      toast.error(err.message || "Gagal membuat record semester");
      return null;
    }
  }

  /**
   * saveAll — Menyimpan nilai dan kehadiran secara batch.
   * Sebelum menyimpan, validasi nilai (0-100).
   * Jika belum ada recordId, buat record terlebih dahulu.
   * @param e - Form submit event
   */
  async function saveAll(e: FormEvent) {
    e.preventDefault();

    // Validasi: pastikan semua nilai dalam rentang 0-100
    const hasInvalid = scores.some(
      (s) =>
        s.knowledgeScore < 0 || s.knowledgeScore > 100 ||
        s.skillsScore < 0 || s.skillsScore > 100
    );
    if (hasInvalid) {
      toast.error("Nilai harus antara 0 - 100");
      return;
    }

    let currentRecordId = recordId;
    setSaving(true);
    logger.info("SemesterRecordsPage", "Menyimpan nilai dan kehadiran", { recordId: currentRecordId });

    try {
      // Jika belum ada record, buat dulu
      if (!currentRecordId) {
        currentRecordId = await createOrGetRecord();
      }
      if (!currentRecordId) {
        toast.error("Gagal membuat record semester");
        logger.error("SemesterRecordsPage", "Gagal membuat record saat saveAll", {});
        return;
      }

      // Simpan batch subject scores (dengan notes, bukan description)
      await api.handleResponse(
        api.put(`/semester-records/${currentRecordId}/subject-scores/batch`, {
          scores: scores.map((s) => ({
            subjectName: s.subjectName,
            knowledgeScore: s.knowledgeScore,
            skillsScore: s.skillsScore,
            notes: s.notes,
          })),
        })
      );

      // Simpan data kehadiran
      await api.handleResponse(
        api.put(`/semester-records/${currentRecordId}/attendance`, attendance)
      );

      logger.info("SemesterRecordsPage", "Nilai dan kehadiran berhasil disimpan", { recordId: currentRecordId });
      toast.success("Data nilai dan kehadiran berhasil disimpan!");
      setTimeout(() => {
        router.back();
        setTimeout(() => {
          router.refresh();
        }, 100);
      }, 800);
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal menyimpan data nilai & kehadiran", { err });
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  }

  // ── Achievements handlers ─────────────────────────────────────────

  /**
   * saveAchievement — Menyimpan prestasi baru atau mengupdate yang sudah ada.
   * Jika editingAchievement tidak null, lakukan PUT (update).
   * Jika null, lakukan POST (create).
   * @param e - Form submit event
   */
  async function saveAchievement(e: FormEvent) {
    e.preventDefault();
    if (!recordId) return;
    setSavingAchievement(true);

    try {
      if (editingAchievement) {
        // Mode edit: update prestasi yang sudah ada
        logger.info("SemesterRecordsPage", "Mengupdate prestasi", { achievementId: editingAchievement.id });
        const updated = await api.handleResponse(
          api.put<Achievement>(`/semester-records/achievements/${editingAchievement.id}`, {
            title: achievementForm.title,
            type: achievementForm.type,
            description: achievementForm.description || undefined,
          })
        );
        // Replace di daftar lokal
        setAchievements((prev) =>
          prev.map((a) => (a.id === editingAchievement.id ? updated : a))
        );
        toast.success("Prestasi berhasil diperbarui");
      } else {
        // Mode create: tambah prestasi baru
        logger.info("SemesterRecordsPage", "Menambah prestasi baru", { recordId });
        const created = await api.handleResponse(
          api.post<Achievement>(`/semester-records/${recordId}/achievements`, {
            title: achievementForm.title,
            type: achievementForm.type,
            description: achievementForm.description || undefined,
          })
        );

        // Jika ada file lampiran yang dipilih, upload setelah prestasi berhasil dibuat
        if (achievementAttachment) {
          logger.info("SemesterRecordsPage", "Ada file lampiran, memulai upload", {
            achievementId: created.id,
            fileName: achievementAttachment.name,
          });
          const updated = await uploadAchievementAttachment(created.id, achievementAttachment);
          // Update daftar lokal dengan data achievement yang sudah punya attachmentUrl
          if (updated) {
            setAchievements((prev) => [...prev, updated]);
          } else {
            // Upload gagal tapi prestasi sudah terbuat — tetap tambahkan tanpa attachment
            setAchievements((prev) => [...prev, created]);
          }
        } else {
          // Tidak ada file lampiran — tambahkan prestasi biasa
          setAchievements((prev) => [...prev, created]);
        }
        toast.success("Prestasi berhasil ditambahkan");
      }
      resetAchievementForm();
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal menyimpan prestasi", { err });
      toast.error(err.message || "Gagal menyimpan prestasi");
    } finally {
      setSavingAchievement(false);
    }
  }

  /**
   * deleteAchievement — Menghapus prestasi berdasarkan ID.
   * @param achievementId - ID prestasi yang akan dihapus
   */
  async function deleteAchievement(achievementId: string) {
    logger.info("SemesterRecordsPage", "Menghapus prestasi", { achievementId });
    try {
      await api.handleResponse(
        api.delete(`/semester-records/achievements/${achievementId}`)
      );
      // Hapus dari daftar lokal
      setAchievements((prev) => prev.filter((a) => a.id !== achievementId));
      toast.success("Prestasi berhasil dihapus");
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal menghapus prestasi", { err });
      toast.error(err.message || "Gagal menghapus prestasi");
    }
  }

  /**
   * uploadAchievementAttachment — Upload file lampiran untuk prestasi tertentu.
   * Alur:
   * 1. Buat FormData dengan file yang dipilih user.
   * 2. POST ke /upload/achievements/:id/attachment via XMLHttpRequest agar bisa
   *    tracking progress upload (onprogress).
   * 3. Parsing response → jika success, return Achievement yang sudah diupdate
   *    (dengan attachmentUrl). Jika gagal, throw error.
   * 4. Progress percentage disimpan di state uploadProgress untuk ditampilkan ke user.
   *
   * @param achievementId - ID prestasi tujuan upload
   * @param file - File yang akan diupload (JPEG/PNG/WebP/GIF/PDF)
   * @returns Achievement yang sudah diupdate, atau null jika gagal
   */
  async function uploadAchievementAttachment(achievementId: string, file: File): Promise<Achievement | null> {
    logger.info("SemesterRecordsPage", "Mengupload lampiran prestasi", {
      achievementId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    setUploadingAttachment(true);
    setUploadProgress(0);

    try {
      // Siapkan FormData dengan file
      const formData = new FormData();
      formData.append("file", file);

      // Ambil token JWT dari ApiClient untuk Authorization header
      const token = api.getToken();
      const baseUrl = API_BASE_URL;

      // Gunakan XMLHttpRequest agar bisa tracking progress upload
      const xhr = new XMLHttpRequest();
      const result = await new Promise<Achievement>((resolve, reject) => {
        // Update progress setiap ada event onprogress dari XHR
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(progress);
            logger.debug("SemesterRecordsPage", "Upload progress", { progress });
          }
        };

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.data) {
              logger.info("SemesterRecordsPage", "Upload lampiran sukses", { achievementId });
              resolve(response.data as Achievement);
            } else {
              reject(new Error(response.error?.message || "Gagal mengupload lampiran"));
            }
          } catch (e) {
            reject(new Error("Response tidak valid dari server"));
          }
        };

        xhr.onerror = () => {
          logger.error("SemesterRecordsPage", "Network error saat upload lampiran", { achievementId });
          reject(new Error("Koneksi bermasalah, periksa jaringan Anda"));
        };

        // Kirim request POST dengan FormData (multipart)
        xhr.open("POST", `${baseUrl}/upload/achievements/${achievementId}/attachment`);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(formData);
      });

      toast.success("Lampiran berhasil diupload");
      return result;
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal mengupload lampiran prestasi", { err, achievementId });
      toast.error(err.message || "Gagal mengupload lampiran");
      return null;
    } finally {
      setUploadingAttachment(false);
      setUploadProgress(0);
    }
  }

  /**
   * startEditAchievement — Mengisi form dengan data prestasi untuk diedit.
   * @param a - Achievement yang akan diedit
   */
  function startEditAchievement(a: Achievement) {
    setEditingAchievement(a);
    setAchievementForm({ title: a.title, type: a.type, description: a.description || "" });
    setShowAchievementForm(true);
  }

  /**
   * resetAchievementForm — Mereset form prestasi ke keadaan awal.
   * Juga menghapus file lampiran yang sudah dipilih dan state upload.
   */
  function resetAchievementForm() {
    setShowAchievementForm(false);
    setEditingAchievement(null);
    setAchievementForm({ title: "", type: "Akademik", description: "" });
    // Reset file lampiran dan state upload
    setAchievementAttachment(null);
    setUploadingAttachment(false);
    setUploadProgress(0);
  }

  // ── Health handlers ───────────────────────────────────────────────

  /**
   * saveHealth — Menyimpan data kesehatan siswa.
   * Mengirim field yang terisi (height, weight, dll) via PUT.
   * @param e - Form submit event
   */
  async function saveHealth(e: FormEvent) {
    e.preventDefault();
    if (!recordId) return;
    setSavingHealth(true);
    logger.info("SemesterRecordsPage", "Menyimpan data kesehatan", { recordId });

    try {
      const updated = await api.handleResponse(
        api.put<HealthRecord>(`/semester-records/${recordId}/health-record`, {
          // Convert string ke number jika ada isian, else undefined
          height: healthForm.height ? Number(healthForm.height) : undefined,
          weight: healthForm.weight ? Number(healthForm.weight) : undefined,
          hearingCondition: healthForm.hearingCondition || undefined,
          visionCondition: healthForm.visionCondition || undefined,
          teethCondition: healthForm.teethCondition || undefined,
        })
      );
      setHealthRecord(updated);
      logger.info("SemesterRecordsPage", "Data kesehatan berhasil disimpan", {});
      toast.success("Data kesehatan berhasil disimpan");
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal menyimpan data kesehatan", { err });
      toast.error(err.message || "Gagal menyimpan data kesehatan");
    } finally {
      setSavingHealth(false);
    }
  }

  // ── Notes handlers ────────────────────────────────────────────────

  /**
   * fetchNotes — Mengambil daftar catatan guru untuk siswa ini dari API.
   * Hasil diurutkan dari yang terbaru (berdasarkan createdAt descending).
   * Dipanggil otomatis setiap kali recordId berubah (lihat useEffect).
   */
  async function fetchNotes() {
    if (!params.id) return;
    setLoadingNotes(true);
    logger.info("CatatanTab", "Memuat catatan guru", { studentId: params.id });
    try {
      const data = await api.handleResponse<StudentNote[]>(
        api.get(`/students/${params.id}/notes`)
      );
      // Urutkan dari yang terbaru (descending by createdAt)
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotes(sorted);
      logger.info("CatatanTab", "Catatan berhasil dimuat", { count: data.length });
    } catch (err: any) {
      logger.error("CatatanTab", "Gagal memuat catatan", { err });
      toast.error(err.message || "Gagal memuat catatan");
    } finally {
      setLoadingNotes(false);
    }
  }

  /**
   * addNote — Menambahkan catatan baru untuk siswa ini.
   * Mengirim konten ke POST /students/:id/notes, lalu menambahkan hasil
   * response ke daftar lokal (di posisi paling atas = terbaru).
   * @param e - Form submit event
   */
  async function addNote(e: FormEvent) {
    e.preventDefault();
    const trimmed = noteContent.trim();
    if (!trimmed || !params.id) return;
    setSavingNote(true);
    logger.info("CatatanTab", "Menambah catatan baru", { preview: trimmed.substring(0, 50) });
    try {
      const created = await api.handleResponse<StudentNote>(
        api.post(`/students/${params.id}/notes`, { content: trimmed })
      );
      // Tambahkan ke awal array (posisi terbaru)
      setNotes((prev) => [created, ...prev]);
      setNoteContent(""); // Reset form
      toast.success("Catatan berhasil ditambahkan");
      logger.info("CatatanTab", "Catatan berhasil dibuat", { noteId: created.id });
    } catch (err: any) {
      logger.error("CatatanTab", "Gagal menambah catatan", { err });
      toast.error(err.message || "Gagal menambah catatan");
    } finally {
      setSavingNote(false);
    }
  }

  /**
   * deleteNote — Menghapus catatan guru berdasarkan ID via DELETE /teacher-notes/:id.
   * Konfirmasi via confirm() sebelum eksekusi.
   * @param noteId - ID catatan yang akan dihapus
   */
  async function deleteNote(noteId: string) {
    if (!confirm("Hapus catatan ini?")) return;
    logger.info("CatatanTab", "Menghapus catatan", { noteId });
    try {
      await api.handleResponse(
        api.delete(`/teacher-notes/${noteId}`)
      );
      // Hapus dari daftar lokal
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Catatan berhasil dihapus");
      logger.info("CatatanTab", "Catatan berhasil dihapus", { noteId });
    } catch (err: any) {
      logger.error("CatatanTab", "Gagal menghapus catatan", { err });
      toast.error(err.message || "Gagal menghapus catatan");
    }
  }

  // ── Development Description handlers ─────────────────────────────

  /**
   * saveDevDescription — Menyimpan deskripsi perkembangan siswa.
   * Mengirim PATCH ke /semester-records/:id/development-description.
   */
  async function saveDevDescription() {
    if (!recordId) return;
    setSavingDevDesc(true);
    logger.info("SemesterRecordsPage", "Menyimpan deskripsi perkembangan", { recordId });
    try {
      await api.handleResponse(
        api.patch(`/semester-records/${recordId}/development-description`, {
          developmentDescription: devDescription,
        })
      );
      toast.success("Deskripsi perkembangan berhasil disimpan");
      logger.info("SemesterRecordsPage", "Deskripsi perkembangan berhasil disimpan", { recordId });
    } catch (err: any) {
      logger.error("SemesterRecordsPage", "Gagal menyimpan deskripsi perkembangan", { err });
      toast.error(err.message || "Gagal menyimpan deskripsi perkembangan");
    } finally {
      setSavingDevDesc(false);
    }
  }

  /** Auto-save on blur — panggil saveDevDescription jika ada recordId */
  async function handleBlurSave() {
    if (recordId) {
      await saveDevDescription();
    }
  }

  /** Tahun ajaran yang sedang dipilih (untuk ditampilkan di header) */
  const activeYear = academicYears.find((y) => y.id === selectedYear);

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

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <Link href="/students" className="hover:text-blue-600 transition-colors">Data Siswa</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">Input Semester</span>
      </div>

      {/* ── Student Info Header ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Tombol back ke halaman profil siswa */}
          <Link
            href={`/students/${params.id}`}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </Link>
          {/* Avatar placeholder */}
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{studentName || "Siswa"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">ID: {params.id}</p>
          </div>
        </div>
        {/* Badge semester aktif */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Semester Aktif</span>
          {activeYear && (
            <span className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              {semester === 1 ? "Ganjil" : "Genap"} {activeYear.year}
            </span>
          )}
        </div>
      </div>

      {/* ── Year & Semester Selector ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* Dropdown tahun ajaran */}
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tahun Ajaran</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setRecordId(null); }}
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year} {y.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>
          {/* Dropdown semester (Ganjil / Genap) */}
          <div className="w-full sm:w-36">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Semester</label>
            <select
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              value={semester}
              onChange={(e) => { setSemester(Number(e.target.value) as 1 | 2); setRecordId(null); }}
            >
              <option value={1}>Ganjil</option>
              <option value={2}>Genap</option>
            </select>
          </div>
          {/* Tombol Buat/Muat Record — berubah hijau jika sudah ada recordId */}
          <button
            onClick={createOrGetRecord}
            disabled={saving}
            className={`h-10 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
              recordId
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            }`}
          >
            {recordId ? "✓ Record Siap" : "Buat / Muat Record"}
          </button>
        </div>
      </div>

      {/* ── Tabs Content ──────────────────────────────────────────────── */}
      {/* Tabs hanya muncul setelah recordId tersedia */}
      {recordId && (
        <Tabs defaultValue="nilai">
          {/* Tab navigasi: Nilai, Kehadiran, Prestasi, Kesehatan, Catatan */}
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="nilai" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Nilai
            </TabsTrigger>
            <TabsTrigger value="kehadiran" className="gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> Kehadiran
            </TabsTrigger>
            <TabsTrigger value="prestasi" className="gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Prestasi
              {/* Badge jumlah prestasi */}
              {achievements.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-600 rounded-full">
                  {achievements.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="kesehatan" className="gap-1.5">
              <Heart className="w-3.5 h-3.5" /> Kesehatan
              {/* Badge centang jika data kesehatan sudah diisi */}
              {healthRecord && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-600 rounded-full">✓</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="catatan" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Catatan
            </TabsTrigger>
            <TabsTrigger value="deskripsi" className="gap-1.5">
              <AlignLeft className="w-3.5 h-3.5" /> Deskripsi
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Nilai ────────────────────────────────────── */}
          <TabsContent value="nilai">
            {/* Form nilai dan kehadiran — submit via saveAll */}
            <form onSubmit={saveAll}>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Input Nilai Mata Pelajaran</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-6">
                    Isi nilai pengetahuan dan nilai keterampilan secara terpisah.
                  </p>
                </div>

                {/* Tabel input nilai per mata pelajaran */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left py-3 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mata Pelajaran</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">KKM</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Pengetahuan</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Keterampilan</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">Predikat</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Catatan/Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score, idx) => (
                      <tr key={score.subjectName} className="border-b border-gray-50">
                        {/* Nama mata pelajaran */}
                        <td className="py-3 px-5 text-sm text-gray-700">{score.subjectName}</td>
                        {/* KKM (standar 75, tidak diedit) */}
                        <td className="py-3 px-3 text-center text-sm text-gray-500">{score.kkm}</td>
                        {/* Dropdown nilai pengetahuan (0-100) */}
                        <td className="py-3 px-3 text-center">
                          <select
                            value={score.knowledgeScore}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setScores((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, knowledgeScore: val } : s))
                              );
                            }}
                            /* Jika nilai < 75 dan > 0, tampilkan border merah (di bawah KKM) */
                            className={`w-20 h-9 px-1.5 border rounded-lg text-sm text-center bg-white outline-none transition-all font-medium ${
                              score.knowledgeScore > 0 && score.knowledgeScore < 75
                                ? "border-red-300 text-red-600 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-gray-200 text-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            }`}
                          >
                            {SCORE_OPTIONS.map((v) => (
                              <option key={v} value={v} className={v < 75 && v > 0 ? "text-red-500 font-medium" : "text-gray-700"}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Dropdown nilai keterampilan (0-100) */}
                        <td className="py-3 px-3 text-center">
                          <select
                            value={score.skillsScore}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setScores((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, skillsScore: val } : s))
                              );
                            }}
                            className={`w-20 h-9 px-1.5 border rounded-lg text-sm text-center bg-white outline-none transition-all font-medium ${
                              score.skillsScore > 0 && score.skillsScore < 75
                                ? "border-red-300 text-red-600 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                : "border-gray-200 text-gray-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            }`}
                          >
                            {SCORE_OPTIONS.map((v) => (
                              <option key={v} value={v} className={v < 75 && v > 0 ? "text-red-500" : "text-gray-700"}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Predikat — ditentukan dari nilai pengetahuan (A/B/C/D) */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-xs font-bold ${
                              score.knowledgeScore >= 88
                                ? "bg-green-50 text-green-600"
                                : score.knowledgeScore >= 75
                                ? "bg-blue-50 text-blue-600"
                                : score.knowledgeScore > 0
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {score.knowledgeScore > 0 ? getGrade(score.knowledgeScore) : "-"}
                          </span>
                        </td>
                        {/* Input catatan/deskripsi kompetensi */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={score.notes}
                            onChange={(e) => {
                              setScores((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, notes: e.target.value } : s))
                              );
                            }}
                            placeholder="Deskripsi kompetensi..."
                            className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer form: info jumlah mapel terisi + tombol aksi */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {scores.filter((s) => s.knowledgeScore > 0).length} mata pelajaran terisi
                </p>
                <div className="flex gap-3">
                  {/* Tombol batal — kembali ke profil siswa */}
                  <Link
                    href={`/students/${params.id}`}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Batalkan
                  </Link>
                  {/* Tombol simpan */}
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? "Menyimpan..." : "Simpan Nilai & Kehadiran"}
                  </button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Kehadiran ────────────────────────────────── */}
          <TabsContent value="kehadiran">
            {/* Form kehadiran — submit via saveAll (bersama nilai) */}
            <form onSubmit={saveAll}>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Rekap Kehadiran</h3>
                {/* Grid 3 kolom: Sakit, Izin, Alpha — masing-masing dropdown 0-30 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(["sick", "permission", "absent"] as const).map((field) => {
                    /** Label untuk masing-masing field kehadiran */
                    const labels = { sick: "Sakit (hari)", permission: "Izin (hari)", absent: "Alpha (hari)" };
                    return (
                      <div key={field}>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          {labels[field]}
                        </label>
                        {/* Dropdown jumlah hari (0-30) */}
                        <select
                          value={attendance[field]}
                          onChange={(e) =>
                            setAttendance((prev) => ({ ...prev, [field]: Number(e.target.value) }))
                          }
                          className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                {/* Tombol simpan — juga menyimpan nilai (saveAll) */}
                <div className="flex justify-end mt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? "Menyimpan..." : "Simpan Nilai & Kehadiran"}
                  </button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Prestasi ─────────────────────────────────── */}
          <TabsContent value="prestasi">
            <div className="space-y-4">
              {/* ── Daftar prestasi ──────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Daftar Prestasi</h3>
                    {/* Badge jumlah prestasi */}
                    <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-medium">
                      {achievements.length} prestasi
                    </span>
                  </div>
                  {/* Tombol tambah prestasi baru */}
                  <button
                    onClick={() => {
                      resetAchievementForm();
                      setShowAchievementForm(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Prestasi
                  </button>
                </div>

                {/* Empty state: belum ada prestasi */}
                {achievements.length === 0 ? (
                  <div className="py-10 text-center">
                    <Trophy className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Belum ada data prestasi</p>
                    <p className="text-xs text-gray-300 mt-0.5">Klik tombol Tambah Prestasi untuk menambahkan</p>
                  </div>
                ) : (
                  /* Daftar prestasi — setiap item memiliki tombol edit & hapus */
                  <div className="divide-y divide-gray-50">
                    {achievements.map((a) => (
                      <div key={a.id} className="flex items-start justify-between p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Badge tipe prestasi: Akademik (biru) / Non-Akademik (ungu) */}
                          <span
                            className={`mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${
                              a.type === "Akademik"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-purple-50 text-purple-600"
                            }`}
                          >
                            {a.type}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                            {a.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                            )}
                            {/* Download link untuk lampiran — tampil jika attachmentUrl tersedia */}
                            {a.attachmentUrl && (
                              <a
                                href={a.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
                                onClick={() => logger.info("SemesterRecordsPage", "Membuka lampiran prestasi", { achievementId: a.id, url: a.attachmentUrl })}
                              >
                                <Download className="w-3 h-3" />
                                Lihat Lampiran
                              </a>
                            )}
                          </div>
                        </div>
                        {/* Tombol aksi: edit dan hapus */}
                        <div className="flex gap-1.5 shrink-0 ml-4">
                          <button
                            onClick={() => startEditAchievement(a)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteAchievement(a.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Form tambah/edit prestasi ──────────────────────── */}
              {showAchievementForm && (
                <div className="bg-white rounded-xl border border-amber-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {editingAchievement ? "Edit Prestasi" : "Tambah Prestasi Baru"}
                    </h4>
                    {/* Tombol tutup form */}
                    <button
                      onClick={resetAchievementForm}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={saveAchievement} className="space-y-3">
                    {/* Input judul prestasi */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Judul Prestasi</label>
                      <input
                        type="text"
                        value={achievementForm.title}
                        onChange={(e) => setAchievementForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Contoh: Juara 1 Olimpiade Matematika"
                        required
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                    {/* Dropdown jenis prestasi */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Jenis Prestasi</label>
                      <select
                        value={achievementForm.type}
                        onChange={(e) => setAchievementForm((f) => ({ ...f, type: e.target.value }))}
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                      >
                        <option value="Akademik">Akademik</option>
                        <option value="Non-Akademik">Non-Akademik</option>
                      </select>
                    </div>
                    {/* Textarea deskripsi (opsional) */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Deskripsi (Opsional)</label>
                      <textarea
                        value={achievementForm.description}
                        onChange={(e) => setAchievementForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Deskripsi singkat mengenai prestasi ini..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none placeholder:text-gray-300"
                      />
                    </div>

                    {/* ── Field upload lampiran (file attachment) ──────────── */}
                    {/*
                      * File input untuk upload lampiran prestasi.
                      * Hanya menerima gambar (JPEG/PNG/WebP/GIF) dan PDF.
                      * File dikirim setelah prestasi berhasil dibuat di database.
                      */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Lampiran (Opsional)
                      </label>
                      {/* Area drag-and-drop / click-to-upload yang lebih user-friendly */}
                      <label
                        className={`relative flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                          achievementAttachment
                            ? "border-amber-400 bg-amber-50/30"
                            : "border-gray-200 bg-gray-50/30 hover:border-amber-300 hover:bg-amber-50/10"
                        }`}
                      >
                        {/* Icon dan teks — berubah jika file sudah dipilih */}
                        <div className="flex flex-col items-center gap-1">
                          {uploadingAttachment ? (
                            // Sedang upload — tampilkan spinner + progress
                            <>
                              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                              <span className="text-[10px] text-amber-600 font-medium">
                                Mengupload... {uploadProgress}%
                              </span>
                            </>
                          ) : achievementAttachment ? (
                            // File sudah dipilih — tampilkan nama file
                            <>
                              <Paperclip className="w-5 h-5 text-amber-500" />
                              <span className="text-[10px] text-gray-600 font-medium truncate max-w-[200px]">
                                {achievementAttachment.name}
                              </span>
                            </>
                          ) : (
                            // Belum ada file — tampilkan instruksi upload
                            <>
                              <Paperclip className="w-4 h-4 text-gray-400" />
                              <span className="text-[10px] text-gray-500">
                                Klik untuk pilih file (JPEG/PNG/WebP/GIF/PDF)
                              </span>
                            </>
                          )}
                        </div>
                        {/* Hidden file input — hanya menerima tipe yang diizinkan */}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                          className="hidden"
                          disabled={uploadingAttachment || !!editingAchievement}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setAchievementAttachment(file);
                            logger.info("SemesterRecordsPage", "File lampiran dipilih", {
                              fileName: file?.name,
                              fileSize: file?.size,
                              fileType: file?.type,
                            });
                          }}
                        />
                      </label>
                      {/* Keterangan: disabled saat edit karena upload hanya untuk prestasi baru */}
                      {editingAchievement && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Upload lampiran hanya tersedia saat menambah prestasi baru.
                        </p>
                      )}
                    </div>
                    {/* ── End file upload ─────────────────────────────────── */}

                    {/* Progress bar — tampil saat upload berlangsung */}
                    {uploadingAttachment && (
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    {/* Tombol submit + batal */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={savingAchievement}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {savingAchievement ? (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        ) : null}
                        {editingAchievement ? "Simpan Perubahan" : "Tambahkan"}
                      </button>
                      <button
                        type="button"
                        onClick={resetAchievementForm}
                        className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Kesehatan ────────────────────────────────── */}
          <TabsContent value="kesehatan">
            {/* Form data kesehatan — submit via saveHealth */}
            <form onSubmit={saveHealth}>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Data Kesehatan Siswa</h3>
                  {/* Badge status — hijau jika sudah pernah diisi */}
                  {healthRecord && (
                    <span className="px-2 py-0.5 text-[10px] bg-green-50 text-green-600 rounded-full font-semibold border border-green-100">
                      Sudah diisi
                    </span>
                  )}
                </div>

                {/* Grid 2 kolom: input tinggi, berat, pendengaran, penglihatan, gigi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Input tinggi badan (cm) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Tinggi Badan (cm)
                    </label>
                    <input
                      type="number"
                      value={healthForm.height}
                      onChange={(e) => setHealthForm((f) => ({ ...f, height: e.target.value }))}
                      placeholder="Contoh: 135"
                      min={0}
                      max={250}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  {/* Input berat badan (kg) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Berat Badan (kg)
                    </label>
                    <input
                      type="number"
                      value={healthForm.weight}
                      onChange={(e) => setHealthForm((f) => ({ ...f, weight: e.target.value }))}
                      placeholder="Contoh: 35"
                      min={0}
                      max={300}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  {/* Dropdown kondisi pendengaran */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Kondisi Pendengaran
                    </label>
                    <select
                      value={healthForm.hearingCondition}
                      onChange={(e) => setHealthForm((f) => ({ ...f, hearingCondition: e.target.value }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="">Pilih kondisi...</option>
                      <option value="Normal">Normal</option>
                      <option value="Gangguan Ringan">Gangguan Ringan</option>
                      <option value="Gangguan Sedang">Gangguan Sedang</option>
                      <option value="Gangguan Berat">Gangguan Berat</option>
                    </select>
                  </div>
                  {/* Dropdown kondisi penglihatan */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Kondisi Penglihatan
                    </label>
                    <select
                      value={healthForm.visionCondition}
                      onChange={(e) => setHealthForm((f) => ({ ...f, visionCondition: e.target.value }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="">Pilih kondisi...</option>
                      <option value="Normal">Normal</option>
                      <option value="Rabun Jauh (Miopi)">Rabun Jauh (Miopi)</option>
                      <option value="Rabun Dekat (Hipermetropi)">Rabun Dekat (Hipermetropi)</option>
                      <option value="Silinder (Astigmatisme)">Silinder (Astigmatisme)</option>
                      <option value="Gangguan Lainnya">Gangguan Lainnya</option>
                    </select>
                  </div>
                  {/* Dropdown kondisi gigi (full width) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Kondisi Gigi
                    </label>
                    <select
                      value={healthForm.teethCondition}
                      onChange={(e) => setHealthForm((f) => ({ ...f, teethCondition: e.target.value }))}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                    >
                      <option value="">Pilih kondisi...</option>
                      <option value="Normal / Sehat">Normal / Sehat</option>
                      <option value="Karies Ringan">Karies Ringan</option>
                      <option value="Karies Sedang">Karies Sedang</option>
                      <option value="Karies Berat">Karies Berat</option>
                      <option value="Perlu Perawatan">Perlu Perawatan</option>
                    </select>
                  </div>
                </div>

                {/* Tombol simpan data kesehatan */}
                <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={savingHealth}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingHealth ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savingHealth ? "Menyimpan..." : "Simpan Data Kesehatan"}
                  </button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Catatan ───────────────────────────────────── */}
          <TabsContent value="catatan">
            <div className="space-y-4">
              {/* ── Form tambah catatan ────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Catatan Guru</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-6">
                    Tambahkan catatan tentang perkembangan, sikap, atau hal penting lainnya.
                  </p>
                </div>
                {/* Form textarea + tombol submit */}
                <form onSubmit={addNote} className="p-5 space-y-3">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Tulis catatan di sini..."
                    rows={3}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none placeholder:text-gray-300"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingNote || !noteContent.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {savingNote ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      {savingNote ? "Menyimpan..." : "Tambah Catatan"}
                    </button>
                  </div>
                </form>
              </div>

              {/* ── Daftar catatan ─────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Riwayat Catatan</h3>
                  <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-medium">
                    {notes.length} catatan
                  </span>
                </div>

                {/* Loading state */}
                {loadingNotes && (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                  </div>
                )}

                {/* Empty state */}
                {!loadingNotes && notes.length === 0 && (
                  <div className="py-10 text-center">
                    <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Belum ada catatan guru untuk siswa ini.</p>
                  </div>
                )}

                {/* Note list — newest first */}
                {!loadingNotes && notes.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {notes.map((note) => {
                      const currentUserId = getCurrentUserId();
                      const isOwnNote = currentUserId !== null && note.createdById === currentUserId;
                      return (
                        <div key={note.id} className="p-5 hover:bg-gray-50/30 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            {/* Konten catatan */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                {note.content}
                              </p>
                              {/* Meta: nama guru + timestamp */}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {note.createdBy?.name || "Guru"}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  {getRelativeTime(note.createdAt)}
                                </span>
                              </div>
                            </div>
                            {/* Tombol hapus — hanya untuk catatan milik sendiri */}
                            {isOwnNote && (
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Hapus catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Deskripsi Perkembangan ────────────────────── */}
          <TabsContent value="deskripsi">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlignLeft className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900">Deskripsi Perkembangan Siswa</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3 ml-6">
                Tulis deskripsi perkembangan siswa secara manual untuk semester ini.
              </p>
              <textarea
                value={devDescription}
                onChange={(e) => setDevDescription(e.target.value)}
                onBlur={handleBlurSave}
                placeholder="Tulis deskripsi perkembangan siswa di sini..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-y placeholder:text-gray-300"
              />
              <div className="flex justify-end mt-4">
                <button
                  onClick={saveDevDescription}
                  disabled={savingDevDesc}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingDevDesc ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {savingDevDesc ? "Menyimpan..." : "Simpan Deskripsi"}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
