/**
 * Tool Definitions & Handlers untuk Chatbot AI.
 * ==============================================
 *
 * Cara Kerja:
 * 1. CHATBOT_TOOLS — Array definisi tool dalam format OpenAI-compatible (function calling).
 *    Setiap tool memiliki: name, description, parameters (JSON Schema).
 *    Digunakan oleh LLM untuk mengetahui tool apa yang tersedia dan kapan memanggilnya.
 * 2. toolHandlers — Object yang memetakan nama tool ke fungsi handler async.
 *    Setiap handler menerima args (Record<string, string>) dan mengembalikan ToolResult.
 * 3. executeToolCall — Fungsi publik yang dipanggil oleh chatbot.service.ts.
 *    Mencari handler berdasarkan nama tool, mengeksekusinya, dan mengembalikan hasil.
 *
 * Alur Lengkap:
 * 1. LLM memutuskan untuk memanggil tool tertentu beserta arguments-nya.
 * 2. chatbot.service.ts memanggil executeToolCall(toolName, args).
 * 3. executeToolCall mencari handler di toolHandlers.
 * 4. Handler menjalankan query Prisma ke database.
 * 5. Hasil diformat sebagai string dan dikembalikan ke LLM.
 * 6. LLM memproses hasil dan memberikan jawaban ke user.
 *
 * Tools yang Tersedia:
 * - cari_siswa         — Cari siswa berdasarkan nama/NIS/NISN
 * - detail_siswa       — Profil lengkap siswa
 * - nilai_siswa        — Nilai siswa per semester
 * - daftar_kelas       — Daftar siswa dalam satu kelas
 * - kelas_saya         — Daftar kelas di tahun ajaran aktif
 * - risiko_siswa       — Analisis risiko siswa (AMAN/WASPADA/KRITIS)
 * - statistik_sekolah  — Statistik umum sekolah
 * - tahun_ajaran_aktif — Info tahun ajaran aktif
 */
import { prisma } from "../../lib/prisma";  // Prisma client untuk query database
import logger from "../../lib/logger";       // Pino logger instance

// ── Tool Definitions (OpenAI-compatible) ─────────────────────────────

/**
 * CHATBOT_TOOLS — Array definisi tool dalam format OpenAI function calling.
 *
 * Setiap tool didefinisikan dengan:
 * - type: "function" (constant)
 * - function.name: Nama tool (identifer untuk dipanggil LLM)
 * - function.description: Deskripsi kegunaan tool (LLM membaca ini untuk memutuskan)
 * - function.parameters: JSON Schema object parameter yang dibutuhkan
 * - function.parameters.required: Array parameter yang wajib diisi
 *
 * Format ini kompatibel dengan OpenAI API dan sebagian besar LLM API lainnya.
 */
export const CHATBOT_TOOLS = [
  /**
   * cari_siswa — Mencari siswa berdasarkan nama, NIS, atau NISN.
   * Mengembalikan daftar siswa yang cocok (max 10) dengan informasi dasar.
   */
  {
    type: "function" as const,
    function: {
      name: "cari_siswa",
      description: "Cari siswa berdasarkan nama atau NIS. Mengembalikan daftar siswa yang cocok.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Nama atau NIS siswa yang dicari",
          },
        },
        required: ["query"], // Parameter query wajib diisi
      },
    },
  },

  /**
   * detail_siswa — Melihat profil lengkap seorang siswa.
   * Informasi: nama, NIS, NISN, jenis kelamin, kelas, jumlah semester.
   */
  {
    type: "function" as const,
    function: {
      name: "detail_siswa",
      description: "Lihat profil lengkap seorang siswa termasuk kelas dan riwayat semester.",
      parameters: {
        type: "object",
        properties: {
          studentId: {
            type: "string",
            description: "ID siswa",
          },
        },
        required: ["studentId"], // Parameter studentId wajib diisi
      },
    },
  },

  /**
   * nilai_siswa — Melihat nilai-nilai seorang siswa di semua semester.
   * Informasi: nilai pengetahuan dan keterampilan per mata pelajaran, data kehadiran.
   */
  {
    type: "function" as const,
    function: {
      name: "nilai_siswa",
      description: "Lihat nilai-nilai seorang siswa di semua semester. Termasuk nilai pengetahuan dan keterampilan per mata pelajaran.",
      parameters: {
        type: "object",
        properties: {
          studentId: {
            type: "string",
            description: "ID siswa",
          },
        },
        required: ["studentId"], // Parameter studentId wajib diisi
      },
    },
  },

  /**
   * daftar_kelas — Melihat daftar siswa dalam satu kelas.
   * Informasi: nama dan NIS setiap siswa, diurutkan berdasarkan nama.
   */
  {
    type: "function" as const,
    function: {
      name: "daftar_kelas",
      description: "Lihat daftar siswa dalam satu kelas.",
      parameters: {
        type: "object",
        properties: {
          classId: {
            type: "string",
            description: "ID kelas",
          },
        },
        required: ["classId"], // Parameter classId wajib diisi
      },
    },
  },

  /**
   * kelas_saya — Melihat daftar kelas yang sedang aktif.
   * Informasi: tahun ajaran aktif, daftar kelas dengan jumlah siswa dan wali kelas.
   * Tidak memerlukan parameter.
   */
  {
    type: "function" as const,
    function: {
      name: "kelas_saya",
      description: "Lihat daftar kelas yang sedang aktif (tahun ajaran berjalan).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  /**
   * risiko_siswa — Melihat analisis risiko seorang siswa.
   * Mengambil data dari PredictedOutcome dengan modelType "RISK_CLASSIFICATION".
   * Level: AMAN / WASPADA / KRITIS.
   */
  {
    type: "function" as const,
    function: {
      name: "risiko_siswa",
      description: "Lihat analisis risiko seorang siswa (AMAN/WASPADA/KRITIS) berdasarkan nilai, absensi, dan prestasi.",
      parameters: {
        type: "object",
        properties: {
          studentId: {
            type: "string",
            description: "ID siswa",
          },
        },
        required: ["studentId"], // Parameter studentId wajib diisi
      },
    },
  },

  /**
   * statistik_sekolah — Melihat statistik umum sekolah.
   * Informasi: total siswa, total kelas, tahun ajaran aktif, draft AI pending review.
   * Tidak memerlukan parameter.
   */
  {
    type: "function" as const,
    function: {
      name: "statistik_sekolah",
      description: "Lihat statistik umum sekolah: jumlah siswa, kelas, tahun ajaran aktif, dan status administrasi.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  /**
   * tahun_ajaran_aktif — Melihat informasi tahun ajaran yang sedang aktif.
   * Informasi: tahun ajaran, status (aktif/diarsipkan), jumlah kelas.
   * Tidak memerlukan parameter.
   */
  {
    type: "function" as const,
    function: {
      name: "tahun_ajaran_aktif",
      description: "Lihat informasi tahun ajaran yang sedang aktif.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
] as const;

// ── Tool Handlers ────────────────────────────────────────────────────

/**
 * ToolResult — Struktur data yang dikembalikan oleh setiap tool handler.
 *
 * @property success - Apakah eksekusi tool berhasil
 * @property result  - String hasil (data atau pesan error)
 */
type ToolResult = { success: boolean; result: string };

/**
 * toolHandlers — Mapping nama tool ke fungsi handler async.
 *
 * Setiap handler:
 * - Menerima args (Record<string, string>) — parameter yang diparsing dari LLM
 * - Melakukan query ke database via Prisma
 * - Memformat hasil sebagai string yang mudah dibaca LLM
 * - Mengembalikan ToolResult { success, result }
 *
 * Catatan: Semua handler mengembalikan success: true meskipun data tidak ditemukan,
 * karena ini adalah informasi yang valid untuk LLM (bukan error teknis).
 */
const toolHandlers: Record<string, (args: Record<string, string>) => Promise<ToolResult>> = {
  /**
   * cari_siswa — Mencari siswa berdasarkan query string.
   * Mencocokkan name, nis, dan nisn secara case-insensitive.
   * Max 10 hasil.
   *
   * @param args.query - Kata kunci pencarian (nama/NIS/NISN)
   * @returns ToolResult dengan daftar siswa yang cocok
   */
  cari_siswa: async (args) => {
    // Ambil query dari arguments, default empty string jika tidak ada
    const query = args.query || "";
    logger.debug({ query }, "Chatbot tool: cari_siswa called");

    // Cari siswa dengan OR condition: name, nis, atau nisn mengandung query
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },  // Pencarian nama (case-insensitive)
          { nis: { contains: query } },                         // Pencarian NIS
          { nisn: { contains: query } },                        // Pencarian NISN
        ],
      },
      take: 10, // Batasi maksimal 10 hasil
      // Hanya ambil field yang diperlukan
      select: { id: true, nis: true, nisn: true, name: true, class: { select: { name: true } } },
    });

    // Jika tidak ada hasil, return pesan kosong
    if (students.length === 0) {
      logger.debug({ query }, "Chatbot tool: cari_siswa — no results found");
      return { success: true, result: "Tidak ada siswa yang cocok." };
    }

    // Format hasil sebagai list string (mudah dibaca LLM)
    const list = students
      .map((s) => `- ${s.name} (NIS: ${s.nis}, Kelas: ${s.class?.name || "-"}) [ID: ${s.id}]`)
      .join("\n");

    logger.info({ query, count: students.length }, "Chatbot tool: cari_siswa completed");
    return { success: true, result: `Ditemukan ${students.length} siswa:\n${list}` };
  },

  /**
   * detail_siswa — Melihat profil lengkap seorang siswa.
   *
   * @param args.studentId - UUID siswa
   * @returns ToolResult dengan informasi profil siswa
   */
  detail_siswa: async (args) => {
    const studentId = args.studentId;
    logger.debug({ studentId }, "Chatbot tool: detail_siswa called");

    // Cari siswa dengan relasi kelas
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { select: { name: true } } }, // Ambil nama kelas
    });

    // Jika tidak ditemukan, return pesan
    if (!student) {
      logger.debug({ studentId }, "Chatbot tool: detail_siswa — student not found");
      return { success: true, result: "Siswa tidak ditemukan." };
    }

    // Hitung jumlah semester record yang dimiliki siswa
    const semesterCount = await prisma.semesterRecord.count({ where: { studentId: student.id } });

    logger.info({ studentId, studentName: student.name }, "Chatbot tool: detail_siswa completed");
    return {
      success: true,
      result: [
        `Nama: ${student.name}`,
        `NIS: ${student.nis}`,
        `NISN: ${student.nisn}`,
        `Jenis Kelamin: ${student.gender}`,
        `Kelas: ${student.class?.name || "-"}`,
        `Jumlah Semester: ${semesterCount}`,
      ].join("\n"),
    };
  },

  /**
   * nilai_siswa — Melihat nilai-nilai seorang siswa.
   * Mengambil semua SemesterRecord, termasuk SubjectScore dan Attendance.
   * Diurutkan berdasarkan tahun ajaran dan semester.
   *
   * @param args.studentId - UUID siswa
   * @returns ToolResult dengan daftar nilai per semester
   */
  nilai_siswa: async (args) => {
    const studentId = args.studentId;
    logger.debug({ studentId }, "Chatbot tool: nilai_siswa called");

    // Ambil semua record semester siswa dengan relasi nilai dan absensi
    const records = await prisma.semesterRecord.findMany({
      where: { studentId },
      include: {
        academicYear: { select: { year: true } },  // Ambil tahun ajaran
        subjectScores: true,                         // Ambil nilai mata pelajaran
        attendance: true,                            // Ambil data kehadiran
      },
      orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }], // Urutkan berdasarkan tahun → semester
    });

    // Jika tidak ada data nilai
    if (records.length === 0) {
      logger.debug({ studentId }, "Chatbot tool: nilai_siswa — no records found");
      return { success: true, result: "Belum ada data nilai untuk siswa ini." };
    }

    // Format hasil per semester
    const lines: string[] = [];
    for (const r of records) {
      // Header semester: "2024/2025 - Semester Ganjil"
      lines.push(`\n${r.academicYear.year} - Semester ${r.semester === 1 ? "Ganjil" : "Genap"}:`);

      // Daftar nilai per mata pelajaran
      if (r.subjectScores.length > 0) {
        for (const sc of r.subjectScores) {
          lines.push(`  ${sc.subjectName}: Pengetahuan ${sc.knowledgeScore}, Keterampilan ${sc.skillsScore}`);
        }
      } else {
        lines.push("  Belum ada nilai");
      }

      // Data kehadiran (jika ada)
      if (r.attendance) {
        lines.push(`  Kehadiran: Sakit ${r.attendance.sick}, Izin ${r.attendance.permission}, Alpha ${r.attendance.absent}`);
      }
    }

    logger.info({ studentId, semesterCount: records.length }, "Chatbot tool: nilai_siswa completed");
    return { success: true, result: lines.join("\n") };
  },

  /**
   * daftar_kelas — Melihat daftar siswa dalam satu kelas.
   * Diurutkan berdasarkan nama siswa.
   *
   * @param args.classId - UUID kelas
   * @returns ToolResult dengan daftar siswa
   */
  daftar_kelas: async (args) => {
    const classId = args.classId;
    logger.debug({ classId }, "Chatbot tool: daftar_kelas called");

    // Ambil semua siswa dalam kelas, diurutkan berdasarkan nama
    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true, nis: true, name: true },
      orderBy: { name: "asc" },
    });

    // Jika kelas kosong
    if (students.length === 0) {
      logger.debug({ classId }, "Chatbot tool: daftar_kelas — no students found");
      return { success: true, result: "Kelas ini belum memiliki siswa." };
    }

    // Format daftar dengan numbering
    const list = students.map((s, i) => `${i + 1}. ${s.name} (NIS: ${s.nis})`).join("\n");

    logger.info({ classId, count: students.length }, "Chatbot tool: daftar_kelas completed");
    return { success: true, result: `Total ${students.length} siswa:\n${list}` };
  },

  /**
   * kelas_saya — Melihat daftar kelas di tahun ajaran aktif.
   * Tidak memerlukan parameter — otomatis mencari tahun ajaran dengan isActive: true.
   *
   * @returns ToolResult dengan daftar kelas
   */
  kelas_saya: async () => {
    logger.debug("Chatbot tool: kelas_saya called");

    // Cari tahun ajaran yang sedang aktif
    const academicYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!academicYear) {
      logger.debug("Chatbot tool: kelas_saya — no active academic year");
      return { success: true, result: "Belum ada tahun ajaran aktif." };
    }

    // Ambil semua kelas dalam tahun ajaran aktif dengan jumlah siswa dan wali kelas
    const classes = await prisma.class.findMany({
      where: { academicYearId: academicYear.id },
      include: {
        _count: { select: { students: true } },           // Hitung jumlah siswa per kelas
        homeroomTeacher: { select: { name: true } },       // Nama wali kelas
      },
      orderBy: { name: "asc" },
    });

    // Jika tidak ada kelas
    if (classes.length === 0) {
      logger.debug({ academicYearId: academicYear.id }, "Chatbot tool: kelas_saya — no classes found");
      return { success: true, result: "Belum ada kelas di tahun ajaran ini." };
    }

    // Format daftar kelas
    const list = classes
      .map((c) => `- ${c.name} (${c._count.students} siswa, Wali: ${c.homeroomTeacher?.name || "-"}) [ID: ${c.id}]`)
      .join("\n");

    logger.info({ academicYear: academicYear.year, classCount: classes.length }, "Chatbot tool: kelas_saya completed");
    return { success: true, result: `Tahun Ajaran: ${academicYear.year}\n${list}` };
  },

  /**
   * risiko_siswa — Melihat analisis risiko seorang siswa.
   * Mengambil data dari tabel PredictedOutcome (modelType: RISK_CLASSIFICATION).
   *
   * @param args.studentId - UUID siswa
   * @returns ToolResult dengan level risiko dan skor
   */
  risiko_siswa: async (args) => {
    const studentId = args.studentId;
    logger.debug({ studentId }, "Chatbot tool: risiko_siswa called");

    // Cari siswa
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true },
    });

    if (!student) {
      logger.debug({ studentId }, "Chatbot tool: risiko_siswa — student not found");
      return { success: true, result: "Siswa tidak ditemukan." };
    }

    // Ambil risk assessment terbaru dari PredictedOutcome
    const outcome = await prisma.predictedOutcome.findFirst({
      where: {
        studentId: student.id,
        modelType: "RISK_CLASSIFICATION", // Filter hanya untuk risk classification
        isActive: true,                   // Hanya data yang aktif
      },
      orderBy: { createdAt: "desc" }, // Ambil yang terbaru
    });

    // Jika belum ada analisis risiko
    if (!outcome) {
      logger.debug({ studentId }, "Chatbot tool: risiko_siswa — no risk assessment found");
      return { success: true, result: `Belum ada analisis risiko untuk ${student.name}.` };
    }

    logger.info({ studentId, studentName: student.name, riskLevel: outcome.label }, "Chatbot tool: risiko_siswa completed");
    return {
      success: true,
      result: [
        `Siswa: ${student.name}`,
        `Level Risiko: ${outcome.label || "-"}`,
        `Skor: ${outcome.score || 0}/100`,
        outcome.features ? `Detail: ${JSON.stringify(outcome.features)}` : "",
      ].join("\n"),
    };
  },

  /**
   * statistik_sekolah — Melihat statistik umum sekolah.
   * Query beberapa tabel secara paralel menggunakan Promise.all.
   *
   * @returns ToolResult dengan statistik sekolah
   */
  statistik_sekolah: async () => {
    logger.debug("Chatbot tool: statistik_sekolah called");

    // Eksekusi query secara paralel untuk efisiensi
    const [totalStudents, totalClasses, activeYear] = await Promise.all([
      prisma.student.count(),                                                // Total seluruh siswa
      prisma.class.count(),                                                  // Total seluruh kelas
      prisma.academicYear.findFirst({ where: { isActive: true } }),          // Tahun ajaran aktif
    ]);

    // Hitung draft AI yang belum direview (isFinal: false)
    const pendingDrafts = await prisma.aiSummary.count({ where: { isFinal: false } });

    logger.info({ totalStudents, totalClasses, activeYear: activeYear?.year, pendingDrafts }, "Chatbot tool: statistik_sekolah completed");
    return {
      success: true,
      result: [
        `Total Siswa: ${totalStudents}`,
        `Total Kelas: ${totalClasses}`,
        `Tahun Ajaran Aktif: ${activeYear?.year || "Belum diatur"}`,
        `Draft AI Pending Review: ${pendingDrafts}`,
      ].join("\n"),
    };
  },

  /**
   * tahun_ajaran_aktif — Melihat informasi tahun ajaran yang sedang aktif.
   *
   * @returns ToolResult dengan detail tahun ajaran aktif
   */
  tahun_ajaran_aktif: async () => {
    logger.debug("Chatbot tool: tahun_ajaran_aktif called");

    // Cari tahun ajaran aktif
    const active = await prisma.academicYear.findFirst({ where: { isActive: true } });

    if (!active) {
      logger.debug("Chatbot tool: tahun_ajaran_aktif — no active academic year");
      return { success: true, result: "Tidak ada tahun ajaran yang aktif saat ini." };
    }

    // Hitung jumlah kelas dalam tahun ajaran ini
    const classCount = await prisma.class.count({ where: { academicYearId: active.id } });

    logger.info({ academicYear: active.year, isArchived: active.isArchived, classCount }, "Chatbot tool: tahun_ajaran_aktif completed");
    return {
      success: true,
      result: [
        `Tahun Ajaran: ${active.year}`,
        `Status: ${active.isArchived ? "Diarsipkan" : "Aktif"}`,
        `Jumlah Kelas: ${classCount}`,
      ].join("\n"),
    };
  },
};

/**
 * executeToolCall — Fungsi publik untuk mengeksekusi tool berdasarkan nama.
 *
 * Dipanggil oleh chatbot.service.ts saat LLM meminta function calling.
 *
 * Alur:
 * 1. Cari handler berdasarkan toolName di toolHandlers.
 * 2. Jika handler tidak ditemukan, return error.
 * 3. Jika ditemukan, panggil handler dengan args yang sudah diparsing.
 * 4. Jika handler throw error, tangkap dan return sebagai error.
 *
 * @param toolName - Nama tool yang akan dieksekusi (harus ada di toolHandlers)
 * @param args     - Parameter untuk tool (key-value string)
 * @returns        - ToolResult { success, result }
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, string>
): Promise<ToolResult> {
  // Cari handler berdasarkan nama tool
  const handler = toolHandlers[toolName];

  // Jika tool tidak dikenal, return error
  if (!handler) {
    logger.warn({ toolName }, "Chatbot tool: unknown tool called");
    return { success: false, result: `Tool '${toolName}' tidak dikenal.` };
  }

  logger.debug({ toolName, args }, "Chatbot tool: executing tool handler");

  try {
    // Eksekusi handler dan dapatkan hasilnya
    const result = await handler(args);
    logger.debug({ toolName, success: result.success }, "Chatbot tool: tool handler executed successfully");
    return result;
  } catch (err: any) {
    // Tangkap error yang tidak terduga dari handler
    logger.error({ err, toolName, args }, "Chatbot tool: tool handler execution failed");
    return { success: false, result: `Gagal menjalankan ${toolName}: ${err.message}` };
  }
}
