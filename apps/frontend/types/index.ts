/**
 * FILE: types/index.ts
 * =====================
 * Type definitions utama untuk seluruh aplikasi frontend LSAR.
 * Semua interface dan type yang digunakan di frontend didefinisikan di sini.
 *
 * Cara Kerja:
 * 1. Type ini digunakan sebagai kontrak data antara frontend dan backend API.
 * 2. Setiap interface merepresentasikan shape data dari satu endpoint atau model Prisma.
 * 3. Generic type ApiResponse<T> membungkus semua response API — memastikan struktur konsisten.
 * 4. Type dibagi per domain: Auth, Academic, Student, AI, ML/Risk.
 *
 * Alur:
 * 1. Backend mengirim JSON → response di-parse sebagai ApiResponse<T>.
 * 2. handleResponse() dari ApiClient mengekstrak data sebagai T.
 * 3. Komponen React menggunakan interface ini untuk props dan state.
 * 4. TypeScript memvalidasi seluruh chain — dari fetch hingga render.
 *
 * Domain yang dicakup:
 * - Auth: Role, User, JwtPayload, AuthResult
 * - API wrapper: ApiResponse<T>
 * - Academic: AcademicYear, ClassItem
 * - Student: Student, SemesterRecord, SubjectScore, Attendance, etc.
 * - AI: AiSummary
 * - ML/Risk: RiskResult, RiskSummary, ClusterResult
 * - Chatbot: ChatMessage
 *
 * @module Types
 */

/**
 * Role pengguna dalam sistem LSAR.
 * - ADMINISTRATOR: Super admin — akses penuh.
 * - OPERATOR_SEKOLAH: Operator sekolah — manage data administrasi.
 * - GURU: Wali kelas — input nilai, rapor, absensi.
 * - KEPALA_SEKOLAH: Kepala sekolah — view-only, validasi.
 */
export type Role = "ADMINISTRATOR" | "OPERATOR_SEKOLAH" | "GURU" | "KEPALA_SEKOLAH";

/** Data user yang dikembalikan oleh API /auth/me dan /users */
export interface User {
  /** UUID user */
  id: string;
  /** Username untuk login */
  username: string;
  /** Nama lengkap user */
  name: string;
  /** Role / hak akses */
  role: Role;
  /** Status aktif — nonaktif = tidak bisa login */
  isActive: boolean;
  /** Timestamp pembuatan akun */
  createdAt: string;
}

/** Payload JWT yang didecode dari accessToken — berisi identitas user */
export interface JwtPayload {
  /** UUID user dari database */
  userId: string;
  /** Username untuk display */
  username: string;
  /** Role untuk otorisasi */
  role: Role;
  /** Nama lengkap */
  name: string;
}

/** Response dari endpoint /auth/login dan /auth/refresh */
export interface AuthResult {
  /** JWT access token — expiry 7 hari */
  accessToken: string;
  /** Refresh token — untuk memperpanjang session */
  refreshToken: string;
  /** Data user yang login */
  user: JwtPayload;
}

/**
 * Generic wrapper untuk semua response API.
 * Backend selalu return { success, data?, error?, meta? }.
 *
 * @template T - Tipe data yang dikembalikan (di field data)
 */
export interface ApiResponse<T = unknown> {
  /** Indikator sukses/gagal */
  success: boolean;
  /** Payload data (undefined jika gagal) */
  data?: T;
  /** Detail error (ada jika success=false) */
  error?: { code: string; message: string };
  /** Metadata pagination (ada untuk list endpoint) */
  meta?: { page: number; limit: number; total: number };
}

/** Tahun ajaran — dibuat oleh OPERATOR_SEKOLAH */
export interface AcademicYear {
  /** UUID tahun ajaran */
  id: string;
  /** Label tahun, e.g. "2025/2026" */
  year: string;
  /** Status aktif — hanya satu tahun ajaran aktif per waktu */
  isActive: boolean;
  /** Status arsip — tahun ajaran lama diarsipkan */
  isArchived: boolean;
}

/** Kelas — terikat ke satu tahun ajaran dan satu wali kelas */
export interface ClassItem {
  /** UUID kelas */
  id: string;
  /** Nama kelas, e.g. "1A", "6B" */
  name: string;
  /** ID tahun ajaran yang menaungi kelas ini */
  academicYearId: string;
  /** ID wali kelas (nullable — bisa belum diassign) */
  homeroomTeacherId: string | null;
  /** Relasi: data tahun ajaran */
  academicYear?: { year: string };
  /** Relasi: data wali kelas */
  homeroomTeacher?: { id: string; name: string };
  /** Hitung jumlah siswa di kelas ini */
  _count?: { students: number };
}

/** Data siswa — core entity dari sistem LSAR */
export interface Student {
  /** UUID siswa */
  id: string;
  /** Nomor Induk Siswa (internal sekolah) */
  nis: string;
  /** Nomor Induk Siswa Nasional */
  nisn: string;
  /** Nama lengkap siswa */
  name: string;
  /** Jenis kelamin: L = Laki-laki, P = Perempuan */
  gender: "L" | "P";
  /** Tanggal lahir (FR-04) — opsional, diisi saat registrasi */
  birthDate?: string | null;
  /** Alamat domisili (FR-04) — opsional, diisi saat registrasi */
  address?: string | null;
  /** Nama orang tua / wali (FR-04) — opsional, diisi saat registrasi */
  parentName?: string | null;
  /** ID kelas saat ini */
  classId: string;
  /** URL foto siswa (opsional) */
  photoUrl?: string | null;
  /** Relasi: data kelas */
  class?: { id: string; name: string };
}

/** Rekam semester — satu record per siswa per tahun ajaran per semester */
export interface SemesterRecord {
  /** UUID semester record */
  id: string;
  /** ID siswa */
  studentId: string;
  /** ID tahun ajaran */
  academicYearId: string;
  /** Semester: 1 = Ganjil, 2 = Genap */
  semester: 1 | 2;
  /** ID user yang membuat record */
  createdById: string;
  /** Relasi: data tahun ajaran */
  academicYear?: { year: string };
  /** Daftar nilai mata pelajaran */
  subjectScores: SubjectScore[];
  /** Data absensi (1:1 dengan SemesterRecord) */
  attendance: Attendance | null;
  /** Daftar prestasi/achievement */
  achievements: Achievement[];
  /** Data kesehatan (1:1 dengan SemesterRecord) */
  healthRecord: HealthRecord | null;
  /** Riwayat ringkasan AI untuk semester ini */
  aiSummaries?: AiSummary[];
}

/** Nilai mata pelajaran — untuk satu mapel dalam satu semester record */
export interface SubjectScore {
  id: string;
  /** Parent semester record */
  semesterRecordId: string;
  /** Nama mata pelajaran, e.g. "Matematika", "Bahasa Indonesia" */
  subjectName: string;
  /** Nilai pengetahuan (KI-3) — rentang 0-100 */
  knowledgeScore: number;
  /** Nilai keterampilan (KI-4) — rentang 0-100 */
  skillsScore: number;
  /** Catatan tambahan dari guru */
  notes: string | null;
}

/** Data absensi — 1:1 dengan SemesterRecord (upsert) */
export interface Attendance {
  id: string;
  /** Parent semester record */
  semesterRecordId: string;
  /** Jumlah hari sakit */
  sick: number;
  /** Jumlah hari izin */
  permission: number;
  /** Jumlah hari alpha (tanpa keterangan) */
  absent: number;
}

/** Prestasi/Achievement siswa — bisa akademik atau non-akademik */
export interface Achievement {
  id: string;
  /** Parent semester record */
  semesterRecordId: string;
  /** Judul prestasi, e.g. "Juara 1 Olimpiade Matematika" */
  title: string;
  /** Tipe prestasi: "Akademik" | "Non-Akademik" */
  type: string;
  /** Deskripsi detail prestasi */
  description: string | null;
  /** URL file pendukung (foto sertifikat, dll) */
  attachmentUrl?: string | null;
}

/** Dokumen siswa — file pendukung seperti scan akta, KK, ijazah */
export interface StudentDocument {
  id: string;
  /** ID siswa pemilik dokumen */
  studentId: string;
  /** Nama dokumen untuk display */
  name: string;
  /** URL file yang sudah diupload */
  fileUrl: string;
  /** MIME type file (image/png, application/pdf, dll) */
  mimeType: string;
  /** Ukuran file dalam bytes */
  fileSize: number;
  /** Timestamp upload */
  createdAt: string;
}

/** Data kesehatan siswa — 1:1 dengan SemesterRecord (upsert) */
export interface HealthRecord {
  id: string;
  /** Parent semester record */
  semesterRecordId: string;
  /** Tinggi badan (cm) */
  height: number | null;
  /** Berat badan (kg) */
  weight: number | null;
  /** Kondisi pendengaran, e.g. "Normal", "Kurang" */
  hearingCondition: string | null;
  /** Kondisi penglihatan, e.g. "Normal", "Miopia" */
  visionCondition: string | null;
  /** Kondisi gigi, e.g. "Baik", "Berlubang" */
  teethCondition: string | null;
}

/**
 * Ringkasan AI — hasil generate dari OpenAI/Gemini.
 * Human-in-the-loop: isFinal=false sebelum guru review.
 * Setiap regenerate = version+1 (versi sebelumnya tetap disimpan).
 */
export interface AiSummary {
  id: string;
  /** Parent semester record */
  semesterRecordId: string;
  /** Tipe ringkasan: ringkasan siswa, draft deskripsi, atau ringkasan transisi */
  summaryType: "STUDENT_SUMMARY" | "DRAFT_DESCRIPTION" | "TRANSITION_SUMMARY";
  /** Konten hasil generate AI (HTML/Markdown) */
  content: string;
  /** Status finalisasi — true jika guru sudah approve */
  isFinal: boolean;
  /** Nomor versi — increment setiap regenerate */
  version: number;
}

/** Data ringkasan untuk halaman dashboard utama */
export interface DashboardSummary {
  /** Total seluruh siswa aktif */
  totalStudents: number;
  /** Total kelas (opsional, tergantung role) */
  totalClasses?: number;
  /** Tahun ajaran aktif saat ini, null jika tidak ada */
  activeYear: string | null;
  /** Jumlah draft AI yang menunggu review guru */
  pendingAiDrafts?: number;
  /** Daftar kelas yang dikelola (untuk role GURU) */
  managedClasses?: Array<{
    id: string;
    name: string;
    _count?: { students: number };
  }>;
}

/** Catatan guru untuk siswa — di-create oleh guru wali/pengajar */
export interface StudentNote {
  /** UUID catatan */
  id: string;
  /** ID siswa yang dicatat */
  studentId: string;
  /** ID guru yang membuat catatan */
  createdById: string;
  /** Konten catatan */
  content: string;
  /** Timestamp pembuatan */
  createdAt: string;
  /** Data guru yang membuat (relasi opsional) */
  createdBy?: { id: string; name: string };
}

/** Item aktivitas dari endpoint /activity */
export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  userName: string;
  timestamp: string;
}

/** Profile lengkap siswa — termasuk data kelas dan semua semester records */
export interface StudentProfile {
  /** Data siswa + relasi kelas */
  student: Student & { class: { id: string; name: string } };
  /** Semua semester record siswa (dengan nilai, absensi, prestasi, kesehatan) */
  semesterRecords: SemesterRecord[];
}

/** Response paginated untuk endpoint /students — list siswa + meta pagination */
export interface PaginatedStudents {
  /** Array siswa di halaman ini */
  students: Student[];
  /** Metadata pagination */
  meta: {
    /** Halaman saat ini (1-indexed) */
    page: number;
    /** Jumlah item per halaman */
    limit: number;
    /** Total seluruh item */
    total: number;
  };
}

// ── Chatbot Types ─────────────────────────────────────────────────────
/** Pesan dalam percakapan chatbot AI */
export interface ChatMessage {
  /** Pengirim pesan: user atau asisten AI */
  role: "user" | "assistant";
  /** Konten pesan teks */
  content: string;
  /** Timestamp pengiriman (opsional, di-set client-side) */
  timestamp?: number;
}

// ── ML Types ──────────────────────────────────────────────────────────
/**
 * Hasil analisis risiko individual untuk satu siswa.
 * Digunakan oleh fitur ML untuk mendeteksi siswa berpotensi dropout/masalah akademik.
 */
export interface RiskResult {
  /** UUID siswa */
  studentId: string;
  /** Nama siswa */
  name: string;
  /** Detail risiko */
  risk: {
    /** Level risiko: AMAN = hijau, WASPADA = kuning, KRITIS = merah */
    level: "AMAN" | "WASPADA" | "KRITIS";
    /** Skor risiko (0-100) */
    score: number;
    /** Confidence level model ML */
    confidence?: number;
    /** Faktor-faktor penyebab risiko */
    factors: string[];
    /** Rekomendasi intervensi */
    recommendations: string[];
    /** Penjelasan dari AI (natural language) */
    aiExplanation?: string;
  };
  /** Feature engineering — data mentah yang digunakan model ML */
  features?: {
    /** Rata-rata nilai pengetahuan */
    avgKnowledge: number;
    /** Delta nilai (perubahan dibanding semester sebelumnya) */
    scoreDelta: number;
    /** Volatilitas nilai — fluktuasi antar mapel */
    scoreVolatility: number;
    /** Total ketidakhadiran */
    totalAbsence: number;
    /** Jumlah prestasi yang dicatat */
    achievementCount: number;
    /** Jumlah semester yang sudah ditempuh */
    semesterCount: number;
  };
  /** Tren akademik siswa */
  trend: {
    /** Arah tren: NAIK, STABIL, atau TURUN */
    trend: "NAIK" | "STABIL" | "TURUN";
    /** Deskripsi tren dalam bahasa natural */
    description: string;
  };
}

/** Ringkasan agregat risiko untuk dashboard ML */
export interface RiskSummary {
  /** Total siswa yang dianalisis */
  total: number;
  /** Jumlah siswa KRITIS */
  kritis: number;
  /** Jumlah siswa WASPADA */
  waspada: number;
  /** Jumlah siswa AMAN */
  aman: number;
  /** Detail siswa kritis — untuk prioritas intervensi */
  kritisStudents: { id: string; name: string; score: number }[];
}

/** Container untuk data risiko lengkap (results + summary) */
export interface RiskData {
  /** Array hasil risiko per siswa */
  results: RiskResult[];
  /** Ringkasan agregat */
  summary: RiskSummary;
}

/** Assignment klaster untuk satu siswa — hasil clustering ML */
export interface ClusterAssignment {
  /** UUID siswa */
  studentId: string;
  /** Nama siswa */
  name: string;
  /** ID klaster */
  clusterId: number;
  /** Label klaster untuk display */
  clusterLabel: string;
}

/** Profile satu klaster — karakteristik agregat */
export interface ClusterProfile {
  /** ID klaster */
  clusterId: number;
  /** Jumlah anggota klaster */
  size: number;
  /** Rata-rata nilai pengetahuan di klaster ini */
  avgKnowledge: number;
  /** Rata-rata ketidakhadiran di klaster ini */
  avgAbsence: number;
}

/** Hasil clustering lengkap — untuk visualisasi dan analisis */
export interface ClusterResult {
  /** Profile setiap klaster */
  clusters: ClusterProfile[];
  /** Assignment siswa ke klaster */
  assignments: ClusterAssignment[];
  /** Label dan deskripsi untuk setiap klaster */
  profiles: { clusterId: number; label: string; description: string }[];
}

// ── ML Risk & Trend Types ──────────────────────────────────────────────────
/**
 * Response dari GET /ml/risk/student/:id — risk assessment individual.
 * Backend mengembalikan { features, risk }.
 */
export interface StudentRiskResponse {
  /** Feature vector hasil ekstraksi dari riwayat akademik */
  features: {
    avgKnowledge: number;
    avgSkills: number;
    scoreDelta: number;
    scoreVolatility: number;
    totalAbsence: number;
    achievementCount: number;
    semesterCount: number;
    academicYearId?: string;
    studentId: string;
  };
  /** Hasil risk assessment: level, skor, faktor, rekomendasi, AI explanation */
  risk: {
    level: "AMAN" | "WASPADA" | "KRITIS";
    score: number;
    factors: string[];
    recommendations: string[];
    aiExplanation?: string;
  };
}

/**
 * Response dari GET /ml/trend/student/:id — trend akademik individual.
 * Backend mengembalikan { features, trend }.
 */
export interface StudentTrendResponse {
  /** Feature vector — sama dengan risk endpoint */
  features: {
    avgKnowledge: number;
    avgSkills: number;
    scoreDelta: number;
    scoreVolatility: number;
    totalAbsence: number;
    achievementCount: number;
    semesterCount: number;
    academicYearId?: string;
    studentId: string;
  };
  /** Hasil analisis tren: arah, slope, R², prediksi, deskripsi */
  trend: {
    trend: "NAIK" | "STABIL" | "TURUN";
    slope: number;
    rSquared: number;
    nextPrediction: number;
    description: string;
  };
}

// ── ML Evaluation Types ────────────────────────────────────────────────────
/**
 * Response dari GET /ml/eval — evaluasi performa semua model ML.
 * Backend mengembalikan EvaluationReport.
 */
export interface EvaluationReport {
  /** Timestamp kapan evaluasi di-generate */
  generatedAt: string;
  /** Jumlah siswa yang dianalisis */
  nStudents: number;
  /** Analisis kualitas data */
  dataQuality: {
    missingDataPct: number;
    warnings: string[];
  };
  /** Statistik deskriptif per fitur (mean, std, min, max, kuartil, outlier) */
  featureStats: Array<{
    name: string;
    mean: number;
    std: number;
    min: number;
    max: number;
    q1: number;
    median: number;
    q3: number;
    missing: number;
    outlierCount: number;
  }>;
  /** Distribusi level risiko untuk seluruh siswa */
  riskDistribution: {
    total: number;
    aman: number;
    waspada: number;
    kritis: number;
    pctAman: number;
    pctWaspada: number;
    pctKritis: number;
    avgScore: number;
    scoreHistogram: Array<{ range: string; count: number; pct: number }>;
  };
  /** Evaluasi clustering (null jika model cluster belum di-train) */
  clusterEvaluation: {
    nClusters: number;
    nSamples: number;
    inertia: number;
    clusterSizes: number[];
    avgDistanceToCentroid: number;
    silhouetteScore: number | null;
  } | null;
  /** Evaluasi trend prediction untuk seluruh siswa */
  trendEvaluation: {
    totalStudents: number;
    studentsWithTrend: number;
    avgSlope: number;
    avgRSquared: number;
    improving: number;
    declining: number;
    stable: number;
    qualityWarnings: string[];
  };
}
