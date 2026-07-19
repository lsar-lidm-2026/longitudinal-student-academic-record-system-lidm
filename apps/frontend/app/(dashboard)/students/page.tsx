"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ini menampilkan daftar seluruh siswa dalam bentuk tabel lengkap
 * dengan fitur pencarian (search), filter berdasarkan kelas, dan paginasi.
 *
 * Alur lengkap:
 * 1. Saat halaman dimuat (mount), useEffect pertama mengambil daftar kelas
 *    untuk dropdown filter kelas.
 * 2. useEffect kedua menggunakan debounced search value dan classId untuk
 *    memicu fetchStudents() — fungsi utama yang mengambil data siswa dari
 *    API /students dengan parameter search, classId, page, dan limit.
 * 3. Setiap perubahan input search akan di-debounce 300ms sebelum dipakai.
 * 4. Data siswa ditampilkan dalam tabel dengan kolom: Nama, NISN, Kelas, NIS, Status.
 * 5. Setiap baris siswa bisa diklik ke halaman detail siswa.
 * 6. Pagination di bagian bawah tabel memungkinkan navigasi halaman.
 * 7. Jika error, ditampilkan tombol "Coba Lagi" untuk re-fetch.
 * 8. Jika loading, ditampilkan skeleton/shimmer placeholder.
 */

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  X,
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { Student, ClassItem, Role } from "@/types";

/** Jumlah item per halaman untuk pagination */
const PAGE_SIZE = 10;

export default function StudentsPage() {
  /** State utama: daftar siswa hasil fetch */
  const [students, setStudents] = useState<Student[]>([]);
  /** State daftar kelas untuk dropdown filter */
  const [classes, setClasses] = useState<ClassItem[]>([]);
  /** Status loading untuk indikasi proses pengambilan data */
  const [loading, setLoading] = useState(true);
  /** State error apabila fetch gagal */
  const [error, setError] = useState<string | null>(null);

  // ── Filter / search state ─────────────────────────────────────────────
  /** Nilai input pencarian mentah (real-time) */
  const [search, setSearch] = useState("");
  /** ID kelas yang dipilih di dropdown filter */
  const [classId, setClassId] = useState("");
  /** Halaman aktif untuk pagination */
  const [page, setPage] = useState(1);
  /** Total jumlah siswa (dari meta response) */
  const [total, setTotal] = useState(0);

  // ── Create Student Modal State ──────────────────────────────────────────
  /** Tampilkan/sembunyikan modal tambah siswa */
  const [showModal, setShowModal] = useState(false);
  /** Form: nama lengkap siswa */
  const [formName, setFormName] = useState("");
  /** Form: Nomor Induk Siswa (internal sekolah) */
  const [formNis, setFormNis] = useState("");
  /** Form: Nomor Induk Siswa Nasional */
  const [formNisn, setFormNisn] = useState("");
  /** Form: jenis kelamin — "L" (Laki-laki) atau "P" (Perempuan) */
  const [formGender, setFormGender] = useState<"L" | "P">("L");
  /** Form: ID kelas yang dipilih dari dropdown */
  const [formClassId, setFormClassId] = useState("");
  /** Status loading saat submit — true = sedang mengirim data */
  const [submitting, setSubmitting] = useState(false);
  /** Form: Tanggal Lahir — opsional (FR-04) */
  const [formBirthDate, setFormBirthDate] = useState("");
  /** Form: Alamat — opsional (FR-04) */
  const [formAddress, setFormAddress] = useState("");
  /** Form: Nama Orang Tua — opsional (FR-04) */
  const [formParentName, setFormParentName] = useState("");

  // ── Import CSV Modal State ──────────────────────────────────────────────
  /** Tampilkan/sembunyikan modal import CSV */
  const [showImportModal, setShowImportModal] = useState(false);
  /** Teks CSV yang di-paste user */
  const [importText, setImportText] = useState("");
  /** File CSV yang dipilih user */
  const [importFile, setImportFile] = useState<File | null>(null);
  /** Data hasil parsing — array student yang siap di-preview */
  const [parsedStudents, setParsedStudents] = useState<
    Array<{ row: number; name: string; nis: string; nisn: string; gender: string; className: string; classId?: string }>
  >([]);
  /** Langkah import: "input" → "preview" → "result" */
  const [importStep, setImportStep] = useState<"input" | "preview" | "result">("input");
  /** Status loading saat import berlangsung */
  const [importing, setImporting] = useState(false);
  /** Hasil import dari server */
  const [importResult, setImportResult] = useState<{
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; nis?: string; nisn?: string; message: string }>;
  } | null>(null);
  /** Mapping nama kelas → ID kelas */
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  /** Referensi hidden file input untuk upload CSV */
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Role user untuk menentukan visibilitas tombol import */
  const [userRole, setUserRole] = useState<Role | null>(null);
  /** Total kelas dari dashboard/summary — untuk stat card */
  const [totalClasses, setTotalClasses] = useState(0);

  // ── Debounced search ───────────────────────────────────────────────────
  /** Nilai pencarian yang sudah di-debounce 300ms — digunakan untuk trigger fetch */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    // Timer debounce: hanya update debouncedSearch setelah 300ms tidak ada perubahan
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Reset page on filter change ────────────────────────────────────────
  /** Saat filter berubah, reset ke halaman 1 */
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, classId]);

  // ── Fetch classes for dropdown + build classMap + fetch user role (once) ─
  useEffect(() => {
    logger.info("StudentsPage", "Mengambil daftar kelas untuk filter dan import", {});

    // Fetch classes + user role + dashboard summary secara paralel
    Promise.all([
      api.handleResponse(api.get<ClassItem[]>("/classes")),
      api.handleResponse(api.get<{ userId: string; role: Role }>("/auth/me")).catch(() => null),
      api.handleResponse(api.get<{ totalClasses: number }>("/dashboard/summary")).catch(() => null),
    ])
      .then(([classData, userData, summaryData]) => {
        setClasses(classData);

        // Build mapping nama kelas → ID kelas untuk fitur import CSV
        const map: Record<string, string> = {};
        classData.forEach((c) => {
          map[c.name.toLowerCase().trim()] = c.id;
        });
        setClassMap(map);
        logger.info("StudentsPage", "Class map built untuk import", { mapSize: Object.keys(map).length });

        if (userData) {
          setUserRole(userData.role);
          logger.info("StudentsPage", "User role fetched", { role: userData.role });
        }

        if (summaryData && summaryData.totalClasses !== undefined) {
          setTotalClasses(summaryData.totalClasses);
          logger.info("StudentsPage", "Total kelas dimuat untuk stat card", { totalClasses: summaryData.totalClasses });
        }
      })
      .catch(() => {
        logger.error("StudentsPage", "Gagal memuat data awal untuk filter/import", {});
      });
  }, []);

  // ── Main data fetch — server-side search, filter, pagination ───────────
  /**
   * Fungsi utama untuk mengambil data siswa dari server.
   * Parameter: p = page, q = debouncedSearch, cid = classId
   * Ditimpa dengan nilai state default.
   */
  function fetchStudents(p = page, q = debouncedSearch, cid = classId) {
    setLoading(true);
    setError(null);

    // Bangun query parameter untuk request API
    const params = new URLSearchParams();
    params.set("page", String(p));        // Halaman yang diminta
    params.set("limit", String(PAGE_SIZE)); // Limit per halaman
    if (q) params.set("search", q);       // Keyword pencarian
    if (cid) params.set("classId", cid);  // Filter kelas

    logger.info("StudentsPage", "Mengambil data siswa", { page: p, search: q, classId: cid });

    api
      .get<Student[]>(`/students?${params.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setStudents(res.data);                    // Simpan array siswa
          setTotal(res.meta?.total ?? res.data.length); // Simpan total count dari meta
          logger.info("StudentsPage", "Data siswa berhasil dimuat", { count: res.data.length, total: res.meta?.total });
        } else {
          const errMsg = res.error?.message || "Gagal memuat data siswa";
          setError(errMsg);
          logger.error("StudentsPage", "Gagal memuat data siswa dari response", { message: errMsg });
        }
      })
      .catch((err) => {
        setError("Gagal memuat data siswa");
        logger.error("StudentsPage", "Error fetch data siswa", { err });
      })
      .finally(() => {
        setLoading(false);
        logger.info("StudentsPage", "Fetch data siswa selesai", { loading: false });
      });
  }

  // ── CSV Parsing ─────────────────────────────────────────────────────────
  /**
   * parseCsvData — Parse teks CSV menjadi array student objects.
   *
   * Format CSV yang diharapkan (header wajib):
   *   Nama, NIS, NISN, Jenis Kelamin, Nama Kelas
   *
   * Alur:
   * 1. Split teks per baris
   * 2. Ambil header baris pertama untuk validasi
   * 3. Parse setiap baris berikutnya (skip baris kosong)
   * 4. Map nama kelas ke classId via classMap
   * 5. Return array student untuk preview
   */
  function parseCsvData(csvText: string) {
    logger.info("StudentsPage", "Memulai parsing CSV", { textLength: csvText.length });

    const lines = csvText.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      logger.warn("StudentsPage", "CSV terlalu pendek — minimal 2 baris (header + 1 data)");
      toast.error("CSV harus berisi header dan minimal 1 data");
      return;
    }

    // Parse header: cari index kolom berdasarkan nama
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = header.findIndex(
      (h) => h === "nama" || h === "name" || h === "nama lengkap"
    );
    const nisIdx = header.findIndex((h) => h === "nis" || h === "no induk");
    const nisnIdx = header.findIndex((h) => h === "nisn");
    const genderIdx = header.findIndex(
      (h) => h === "jenis kelamin" || h === "gender" || h === "jk" || h === "kelamin"
    );
    const classIdx = header.findIndex(
      (h) => h === "nama kelas" || h === "kelas" || h === "class" || h === "class name"
    );

    // Validasi: semua kolom wajib ditemukan
    if (nameIdx === -1 || nisIdx === -1 || nisnIdx === -1 || genderIdx === -1 || classIdx === -1) {
      logger.warn("StudentsPage", "Header CSV tidak lengkap", { nameIdx, nisIdx, nisnIdx, genderIdx, classIdx });
      toast.error(
        "Format CSV salah. Header harus: Nama, NIS, NISN, Jenis Kelamin, Nama Kelas"
      );
      return;
    }

    const parsed: Array<{
      row: number;
      name: string;
      nis: string;
      nisn: string;
      gender: string;
      className: string;
      classId?: string;
    }> = [];

    // Parse setiap baris data (skip header)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const name = cols[nameIdx] || "";
      const nis = cols[nisIdx] || "";
      const nisn = cols[nisnIdx] || "";
      const genderRaw = (cols[genderIdx] || "").toUpperCase();
      const className = cols[classIdx] || "";

      // Normalisasi jenis kelamin
      let gender = genderRaw;
      if (genderRaw === "LAKI-LAKI" || genderRaw === "LAKI" || genderRaw === "L") gender = "L";
      else if (genderRaw === "PEREMPUAN" || genderRaw === "WANITA" || genderRaw === "P") gender = "P";

      // Map nama kelas ke classId
      const classId = classMap[className.toLowerCase().trim()];

      parsed.push({
        row: i,
        name,
        nis,
        nisn,
        gender,
        className,
        classId,
      });
    }

    logger.info("StudentsPage", "CSV parsing selesai", { totalRows: parsed.length });

    if (parsed.length === 0) {
      toast.error("Tidak ada data valid ditemukan di CSV");
      return;
    }

    setParsedStudents(parsed);
    setImportStep("preview");
  }

  /**
   * handleFileImport — Baca file CSV dan parse isinya.
   */
  function handleFileImport(file: File) {
    logger.info("StudentsPage", "Membaca file CSV", { fileName: file.name, fileSize: file.size });

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportText(text);
      parseCsvData(text);
    };
    reader.onerror = () => {
      logger.error("StudentsPage", "Gagal membaca file CSV");
      toast.error("Gagal membaca file. Coba lagi.");
    };
    reader.readAsText(file);
  }

  /**
   * handleBulkImport — Kirim data siswa yang sudah di-preview ke server.
   *
   * Alur:
   * 1. Validasi: pastikan ada data
   * 2. Filter siswa yang memiliki classId valid
   * 3. Kirim POST /students/bulk dengan array students
   * 4. Tampilkan hasil: success count + error list
   */
  async function handleBulkImport() {
    // Filter hanya siswa yang bisa di-import (punya classId)
    const validStudents = parsedStudents.filter((s) => s.classId);
    const invalidStudents = parsedStudents.filter((s) => !s.classId);

    if (validStudents.length === 0) {
      toast.error("Tidak ada data valid untuk di-import. Periksa nama kelas.");
      logger.warn("StudentsPage", "Bulk import dibatalkan — 0 data valid");
      return;
    }

    logger.info("StudentsPage", "Memulai bulk import", {
      total: parsedStudents.length,
      valid: validStudents.length,
      invalid: invalidStudents.length,
    });

    setImporting(true);

    try {
      // Map parsed data ke format API
      const students = validStudents.map((s) => ({
        nis: s.nis,
        nisn: s.nisn,
        name: s.name,
        gender: s.gender,
        classId: s.classId!,
      }));

      const result = await api.handleResponse(
        api.post<{
          imported: number;
          errors: Array<{ index: number; message: string }>;
        }>("/students/bulk", { students })
      );

      // Konversi response backend (imported + errors[index]) ke format frontend
      // errors.index = 0-based, kita konversi ke 1-based untuk display
      const backendErrors = (result.errors || []).map((e) => ({
        row: e.index + 1,
        message: e.message,
      }));

      // Gabungkan error dari siswa tanpa classId yang valid
      invalidStudents.forEach((s) => {
        backendErrors.push({
          row: s.row,
          message: `Kelas "${s.className}" tidak ditemukan`,
        });
      });

      setImportResult({
        successCount: result.imported,
        errorCount: backendErrors.length,
        errors: backendErrors,
      });

      setImportStep("result");
      logger.info("StudentsPage", "Bulk import selesai", {
        successCount: result.imported,
        errorCount: backendErrors.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengimport data";
      logger.error("StudentsPage", "Bulk import gagal", { err, message });
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  /** Trigger fetch otomatis saat page / debouncedSearch / classId berubah */
  useEffect(() => {
    fetchStudents(page, debouncedSearch, classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, classId]);

  /** Hitung total halaman untuk pagination */
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Create Student Handler ──────────────────────────────────────────────
  /**
   * handleCreateStudent — Mengirim data siswa baru ke backend via POST /students.
   *
   * Alur lengkap:
   * 1. Validasi form — pastikan semua field required terisi (name, nis, nisn, classId)
   * 2. Set submitting = true untuk menonaktifkan tombol selama proses
   * 3. Kirim POST request ke API dengan form data sebagai JSON body
   * 4. Jika sukses (201) → tutup modal, reset form, refresh daftar siswa, tampilkan toast sukses
   * 5. Jika gagal (validasi / server error) → tampilkan toast error dengan pesan dari server
   * 6. Finally → set submitting = false agar tombol aktif kembali
   */
  async function handleCreateStudent() {
    // Step 1: Validasi form — semua field required harus terisi
    if (!formName.trim() || !formNis.trim() || !formNisn.trim() || !formClassId) {
      logger.warn("StudentsPage", "Validasi form gagal — ada field kosong", {
        name: !!formName.trim(),
        nis: !!formNis.trim(),
        nisn: !!formNisn.trim(),
        classId: !!formClassId,
      });
      toast.error("Semua field wajib diisi");
      return;
    }

    // Step 2: Set loading state
    setSubmitting(true);
    logger.info("StudentsPage", "Mengirim data siswa baru ke server", {
      name: formName.trim(),
      nis: formNis.trim(),
      nisn: formNisn.trim(),
      gender: formGender,
      classId: formClassId,
    });

    try {
      // Step 3: Hit API POST /students dengan data form
      // handleResponse akan melempar Error jika success=false dari server
      // Sertakan field opsional (FR-04): birthDate, address, parentName — dikirim hanya jika diisi
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        nis: formNis.trim(),
        nisn: formNisn.trim(),
        gender: formGender,
        classId: formClassId,
      };
      // Hanya kirim field opsional jika user mengisinya (backend expects null/omitted jika kosong)
      if (formBirthDate) payload.birthDate = formBirthDate;
      if (formAddress.trim()) payload.address = formAddress.trim();
      if (formParentName.trim()) payload.parentName = formParentName.trim();

      logger.info("StudentsPage", "Payload create student", {
        ...payload,
        birthDate: payload.birthDate || "(not set)",
        address: payload.address || "(not set)",
        parentName: payload.parentName || "(not set)",
      });

      await api.handleResponse(
        api.post<Student>("/students", payload)
      );

      // Step 4: Sukses — cleanup dan refresh
      logger.info("StudentsPage", "Siswa baru berhasil dibuat di server");
      // Tutup modal
      setShowModal(false);
      // Reset semua field form ke default
      setFormName("");
      setFormNis("");
      setFormNisn("");
      setFormGender("L");
      setFormClassId("");
      setFormBirthDate("");
      setFormAddress("");
      setFormParentName("");
      // Refresh daftar siswa agar data terbaru muncul
      fetchStudents();
      // Notifikasi sukses ke user
      toast.success("Siswa berhasil ditambahkan");
    } catch (err) {
      // Step 5: Error — tampilkan pesan error dari server atau fallback
      const message = err instanceof Error ? err.message : "Gagal menambahkan siswa";
      logger.error("StudentsPage", "Gagal membuat siswa baru", { err, message });
      toast.error(message);
    } finally {
      // Step 6: Selesai — aktifkan tombol kembali
      setSubmitting(false);
    }
  }

  // ── Error State ──────────────────────────────────────────────────────
  // Jika terjadi error saat fetch, tampilkan pesan error + tombol "Coba Lagi"
  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
        <button
          onClick={() => fetchStudents()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Data Siswa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola informasi biodata dan status akademik siswa secara terpusat.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // Buka modal tambah siswa — logger untuk tracking interaksi
              logger.info("StudentsPage", "Tombol Tambah Siswa diklik", {});
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────── */}
      {/* Grid 2 kolom: Total Siswa (dari meta API) + Total Kelas (dari /dashboard/summary) */}
      {/* Note: Stat cuti/pindah dihapus karena backend tidak menyediakan data tersebut */}
      <div className="grid grid-cols-2 gap-4">
        <MiniStat icon={Users} label="Total Siswa" value={total} iconBg="bg-blue-50" iconColor="text-blue-500" />
        <MiniStat icon={CheckCircle} label="Total Kelas" value={totalClasses} iconBg="bg-green-50" iconColor="text-green-500" />
      </div>

      {/* ── Search & Filters ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Input pencarian dengan ikon search dan tombol clear */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama, NIS, atau NISN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 h-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
          />
          {/* Tombol clear (X) — hanya muncul jika ada isian search */}
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Dropdown filter kelas */}
        <select
          className="h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white outline-none focus:border-blue-400 transition-colors"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.academicYear?.year ? `(${c.academicYear.year})` : ""}
            </option>
          ))}
        </select>
        {/* Tombol Import CSV — hanya untuk ADMINISTRATOR dan OPERATOR_SEKOLAH */}
        {userRole && (userRole === "ADMINISTRATOR" || userRole === "OPERATOR_SEKOLAH") && (
          <button
            onClick={() => {
              logger.info("StudentsPage", "Tombol Import CSV diklik", {});
              setImportText("");
              setImportFile(null);
              setParsedStudents([]);
              setImportStep("input");
              setImportResult(null);
              setShowImportModal(true);
            }}
            className="h-10 px-3 border border-dashed border-blue-300 bg-blue-50/50 rounded-lg text-sm text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Siswa</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">NISN</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Kelas</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">NIS</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton: tampilkan PAGE_SIZE baris shimmer */}
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={7} className="py-3 px-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              : /* Data rows: iterasi setiap student dari hasil fetch */
                students.map((student, idx) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    {/* Nomor urut — hitung berdasarkan halaman dan index */}
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    {/* Kolom Nama: link ke halaman detail, dengan avatar */}
                    <td className="py-3 px-4">
                      <Link href={`/students/${student.id}`} className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt={student.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {student.name}
                          </p>
                        </div>
                      </Link>
                    </td>
                    {/* NISN (hidden on small screens) */}
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-sm text-gray-500 font-mono">{student.nisn}</span>
                    </td>
                    {/* Nama Kelas (hidden on smaller screens) */}
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">{student.class?.name || "-"}</span>
                    </td>
                    {/* NIS (hidden on smaller screens) */}
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <span className="text-sm text-gray-500">{student.nis}</span>
                    </td>
                    {/* Status badge (selalu "Aktif" untuk MVP) */}
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-600 border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Aktif
                      </span>
                    </td>
                    {/* Tombol aksi: link Detail & Nilai */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/students/${student.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          Detail
                        </Link>
                        <Link
                          href={`/students/${student.id}/semester-records`}
                          className="px-2 py-1 text-xs font-semibold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-100/30 rounded-lg transition-all"
                        >
                          Nilai
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
            {/* Empty state: tampilkan pesan jika tidak ada data */}
            {!loading && students.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  {search || classId ? "Tidak ada siswa yang sesuai filter" : "Tidak ada data siswa"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Pagination ──────────────────────────────────────────────── */}
        {/* Tampilkan hanya jika ada data */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            {/* Info: menampilkan range dan total */}
            <p className="text-sm text-gray-500">
              Menampilkan{" "}
              <strong>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </strong>{" "}
              dari {total} siswa
            </p>
            <div className="flex items-center gap-1">
              {/* Tombol Previous — disabled di halaman 1 */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* Nomor halaman — tampilkan maks 5 tombol dengan sliding window */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  // Jika total halaman <= 5, tampilkan semua
                  pageNum = i + 1;
                } else if (page <= 3) {
                  // Jika di awal, tampilkan 1-5
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  // Jika di akhir, tampilkan totalPages-4 sampai totalPages
                  pageNum = totalPages - 4 + i;
                } else {
                  // Jika di tengah, tampilkan page-2 sampai page+2
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {/* Ellipsis + halaman terakhir jika totalPages > 5 dan page belum di akhir */}
              {totalPages > 5 && page < totalPages - 2 && (
                <>
                  <span className="text-gray-400 px-1">...</span>
                  <button
                    onClick={() => setPage(totalPages)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              {/* Tombol Next — disabled di halaman terakhir */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Tambah Siswa ────────────────────────────────────────────── */}
      {/*
       * Modal dialog untuk menambah siswa baru.
       * Tampil/tersembunyi berdasarkan state showModal.
       * Form berisi: Nama, NIS, NISN, Jenis Kelamin (select), Kelas (select).
       * Daftar kelas diambil dari state classes yang sudah di-fetch saat mount.
       */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop overlay — klik di luar modal untuk menutup (kecuali sedang submit) */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!submitting) {
                logger.debug("StudentsPage", "Modal ditutup via backdrop click", {});
                setShowModal(false);
              }
            }}
          />

          {/* Panel modal — card putih di tengah layar */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            {/* Header modal dengan judul dan tombol close */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Tambah Siswa Baru</h2>
              {/* Tombol close (X) — disabled saat submit berlangsung */}
              <button
                onClick={() => {
                  logger.debug("StudentsPage", "Modal ditutup via tombol X", {});
                  setShowModal(false);
                }}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form fields — setiap field memiliki label + input/select */}
            <div className="space-y-4">
              {/* Nama Lengkap — text input, required */}
              <div>
                <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Masukkan nama lengkap siswa"
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* NIS — text input, required */}
              <div>
                <label htmlFor="student-nis" className="block text-sm font-medium text-gray-700 mb-1">
                  NIS <span className="text-red-500">*</span>
                </label>
                <input
                  id="student-nis"
                  type="text"
                  value={formNis}
                  onChange={(e) => setFormNis(e.target.value)}
                  placeholder="Nomor Induk Siswa (internal sekolah)"
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* NISN — text input, required */}
              <div>
                <label htmlFor="student-nisn" className="block text-sm font-medium text-gray-700 mb-1">
                  NISN <span className="text-red-500">*</span>
                </label>
                <input
                  id="student-nisn"
                  type="text"
                  value={formNisn}
                  onChange={(e) => setFormNisn(e.target.value)}
                  placeholder="Nomor Induk Siswa Nasional"
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Jenis Kelamin — select dropdown, required */}
              <div>
                <label htmlFor="student-gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Jenis Kelamin <span className="text-red-500">*</span>
                </label>
                <select
                  id="student-gender"
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as "L" | "P")}
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white outline-none focus:border-blue-400 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              {/* Kelas — select dropdown dari data classes yang sudah di-fetch, required */}
              <div>
                <label htmlFor="student-class" className="block text-sm font-medium text-gray-700 mb-1">
                  Kelas <span className="text-red-500">*</span>
                </label>
                <select
                  id="student-class"
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white outline-none focus:border-blue-400 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.academicYear?.year ? `(${c.academicYear.year})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Field Opsional (FR-04) ───────────────────────────────── */}
              {/* Tanggal Lahir — date input, optional */}
              <div>
                <label htmlFor="student-birth-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Lahir <span className="text-gray-400 text-xs">(opsional)</span>
                </label>
                <input
                  id="student-birth-date"
                  type="date"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-600 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Alamat — textarea, optional */}
              <div>
                <label htmlFor="student-address" className="block text-sm font-medium text-gray-700 mb-1">
                  Alamat <span className="text-gray-400 text-xs">(opsional)</span>
                </label>
                <textarea
                  id="student-address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Alamat domisili siswa"
                  disabled={submitting}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Nama Orang Tua — text input, optional */}
              <div>
                <label htmlFor="student-parent-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Orang Tua <span className="text-gray-400 text-xs">(opsional)</span>
                </label>
                <input
                  id="student-parent-name"
                  type="text"
                  value={formParentName}
                  onChange={(e) => setFormParentName(e.target.value)}
                  placeholder="Nama orang tua atau wali"
                  disabled={submitting}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Tombol aksi — Batal (cancel) dan Simpan (submit) */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  logger.debug("StudentsPage", "Modal ditutup via tombol Batal", {});
                  setShowModal(false);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleCreateStudent}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Spinner animasi saat submitting */}
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Import CSV ──────────────────────────────────────────────── */}
      {/*
       * Modal untuk import siswa secara massal dari CSV.
       * Tiga langkah: input (paste/upload) → preview (verifikasi data) → result (hasil import).
       * Hanya bisa diakses oleh ADMINISTRATOR dan OPERATOR_SEKOLAH.
       */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!importing) {
                logger.debug("StudentsPage", "Modal import ditutup via backdrop", {});
                setShowImportModal(false);
              }
            }}
          />

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Import Siswa dari CSV</h2>
              </div>
              <button
                onClick={() => {
                  logger.debug("StudentsPage", "Modal import ditutup via tombol X", {});
                  setShowImportModal(false);
                }}
                disabled={importing}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Step 1: Input ────────────────────────────────────────── */}
            {importStep === "input" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste data CSV
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`Nama, NIS, NISN, Jenis Kelamin, Nama Kelas\nAhmad Fauzi, 12345, 9988776655, L, 1A\nSiti Nurhaliza, 12346, 9988776656, P, 1A`}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400 font-mono"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">ATAU</span>
                  <div className="flex-1 border-t border-gray-100" />
                </div>

                {/* File upload area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload file CSV
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportFile(file);
                        handleFileImport(file);
                      }
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/10 transition-all"
                  >
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">
                      {importFile ? importFile.name : "Klik untuk pilih file CSV"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      atau drag & drop file .csv di sini
                    </p>
                  </div>
                </div>

                {/* Tombol aksi */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-400">
                    Format: <span className="font-mono">Nama, NIS, NISN, Jenis Kelamin, Nama Kelas</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        logger.debug("StudentsPage", "Modal import ditutup via tombol Batal", {});
                        setShowImportModal(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => {
                        if (!importText.trim()) {
                          toast.error("Paste data CSV atau upload file terlebih dahulu");
                          return;
                        }
                        logger.info("StudentsPage", "Proses parsing CSV dimulai", {});
                        parseCsvData(importText);
                      }}
                      disabled={!importText.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Proses Import
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Preview ─────────────────────────────────────── */}
            {importStep === "preview" && (
              <div className="space-y-4">
                {/* Info bar */}
                <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-3">
                  <p className="text-sm text-blue-700">
                    Ditemukan <strong>{parsedStudents.length}</strong> data siswa
                  </p>
                  <button
                    onClick={() => setImportStep("input")}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ← Kembali ke input
                  </button>
                </div>

                {/* Tabel preview */}
                <div className="border border-gray-100 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">#</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Nama</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">NIS</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">NISN</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">JK</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Kelas</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedStudents.map((s) => {
                        const isValid = !!s.classId && !!s.name && !!s.nis && !!s.nisn && ["L", "P"].includes(s.gender);
                        return (
                          <tr key={s.row} className="border-b border-gray-50">
                            <td className="py-2 px-3 text-xs text-gray-400">{s.row}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{s.name}</td>
                            <td className="py-2 px-3 text-sm text-gray-500 font-mono">{s.nis}</td>
                            <td className="py-2 px-3 text-sm text-gray-500 font-mono">{s.nisn}</td>
                            <td className="py-2 px-3 text-sm text-gray-500">{s.gender}</td>
                            <td className="py-2 px-3 text-sm text-gray-500">{s.className}</td>
                            <td className="py-2 px-3 text-center">
                              {isValid ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              ) : (
                                <span title={!s.classId ? `Kelas "${s.className}" tidak ditemukan` : "Data tidak valid"}>
                                  <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary error untuk kelas tidak ditemukan */}
                {parsedStudents.some((s) => !s.classId) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700">Perhatian:</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {parsedStudents.filter((s) => !s.classId).length} siswa dengan kelas yang tidak dikenali
                        tidak akan di-import. Pastikan nama kelas sesuai dengan data di sistem.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tombol aksi */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      logger.debug("StudentsPage", "Import dibatalkan dari preview", {});
                      setShowImportModal(false);
                    }}
                    disabled={importing}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={importing || parsedStudents.filter((s) => s.classId).length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Mengimport...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import {parsedStudents.filter((s) => s.classId).length} Siswa
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Result ──────────────────────────────────────── */}
            {importStep === "result" && importResult && (
              <div className="space-y-4">
                {/* Success banner */}
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Import Selesai</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      {importResult.successCount} siswa berhasil diimport
                      {importResult.errorCount > 0
                        ? `, ${importResult.errorCount} gagal`
                        : ""}
                    </p>
                  </div>
                </div>

                {/* Daftar error (jika ada) */}
                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      Detail Error ({importResult.errors.length})
                    </h4>
                    <div className="border border-red-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr className="border-b border-red-100">
                            <th className="text-left py-2 px-3 text-xs font-medium text-red-500">Baris</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-red-500">NIS</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-red-500">NISN</th>
                            <th className="text-left py-2 px-3 text-xs font-medium text-red-500">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.map((e, i) => (
                            <tr key={i} className="border-b border-red-50">
                              <td className="py-2 px-3 text-xs text-gray-500">{e.row}</td>
                              <td className="py-2 px-3 text-xs text-gray-500 font-mono">{e.nis || "-"}</td>
                              <td className="py-2 px-3 text-xs text-gray-500 font-mono">{e.nisn || "-"}</td>
                              <td className="py-2 px-3 text-xs text-red-500">{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tombol aksi */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      // Reset ke input untuk import lagi
                      logger.debug("StudentsPage", "Import ulang dari hasil", {});
                      setImportText("");
                      setImportFile(null);
                      setParsedStudents([]);
                      setImportStep("input");
                      setImportResult(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Import Lagi
                  </button>
                  <button
                    onClick={() => {
                      logger.info("StudentsPage", "Modal import ditutup setelah sukses");
                      setShowImportModal(false);
                      // Refresh daftar siswa
                      fetchStudents();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MiniStat — Komponen kartu statistik kecil.
 * Menampilkan ikon, label, dan nilai numerik.
 *
 * @param icon - Komponen ikon (Lucide icon)
 * @param label - Teks label di bawah ikon
 * @param value - Nilai numerik
 * @param iconBg - Kelas Tailwind untuk background ikon
 * @param iconColor - Kelas Tailwind untuk warna ikon
 */
function MiniStat({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
