/**
 * Tool definitions untuk chatbot.
 * Setiap tool adalah fungsi nyata yang bisa dipanggil LLM via tool calling.
 */
import { prisma } from "../../lib/prisma";

// ── Tool Definitions (OpenAI-compatible) ─────────────────────────────

export const CHATBOT_TOOLS = [
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
        required: ["query"],
      },
    },
  },
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
        required: ["studentId"],
      },
    },
  },
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
        required: ["studentId"],
      },
    },
  },
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
        required: ["classId"],
      },
    },
  },
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
        required: ["studentId"],
      },
    },
  },
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

type ToolResult = { success: boolean; result: string };

const toolHandlers: Record<string, (args: Record<string, string>) => Promise<ToolResult>> = {
  cari_siswa: async (args) => {
    const query = args.query || "";
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { nis: { contains: query } },
          { nisn: { contains: query } },
        ],
      },
      take: 10,
      select: { id: true, nis: true, nisn: true, name: true, class: { select: { name: true } } },
    });
    if (students.length === 0) return { success: true, result: "Tidak ada siswa yang cocok." };
    const list = students
      .map((s) => `- ${s.name} (NIS: ${s.nis}, Kelas: ${s.class?.name || "-"}) [ID: ${s.id}]`)
      .join("\n");
    return { success: true, result: `Ditemukan ${students.length} siswa:\n${list}` };
  },

  detail_siswa: async (args) => {
    const student = await prisma.student.findUnique({
      where: { id: args.studentId },
      include: { class: { select: { name: true } } },
    });
    if (!student) return { success: true, result: "Siswa tidak ditemukan." };
    const semesterCount = await prisma.semesterRecord.count({ where: { studentId: student.id } });
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

  nilai_siswa: async (args) => {
    const records = await prisma.semesterRecord.findMany({
      where: { studentId: args.studentId },
      include: {
        academicYear: { select: { year: true } },
        subjectScores: true,
        attendance: true,
      },
      orderBy: [{ academicYear: { year: "asc" } }, { semester: "asc" }],
    });
    if (records.length === 0) return { success: true, result: "Belum ada data nilai untuk siswa ini." };

    const lines: string[] = [];
    for (const r of records) {
      lines.push(`\n${r.academicYear.year} - Semester ${r.semester === 1 ? "Ganjil" : "Genap"}:`);
      if (r.subjectScores.length > 0) {
        for (const sc of r.subjectScores) {
          lines.push(`  ${sc.subjectName}: Pengetahuan ${sc.knowledgeScore}, Keterampilan ${sc.skillsScore}`);
        }
      } else {
        lines.push("  Belum ada nilai");
      }
      if (r.attendance) {
        lines.push(`  Kehadiran: Sakit ${r.attendance.sick}, Izin ${r.attendance.permission}, Alpha ${r.attendance.absent}`);
      }
    }
    return { success: true, result: lines.join("\n") };
  },

  daftar_kelas: async (args) => {
    const students = await prisma.student.findMany({
      where: { classId: args.classId },
      select: { id: true, nis: true, name: true },
      orderBy: { name: "asc" },
    });
    if (students.length === 0) return { success: true, result: "Kelas ini belum memiliki siswa." };
    const list = students.map((s, i) => `${i + 1}. ${s.name} (NIS: ${s.nis})`).join("\n");
    return { success: true, result: `Total ${students.length} siswa:\n${list}` };
  },

  kelas_saya: async () => {
    const academicYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!academicYear) return { success: true, result: "Belum ada tahun ajaran aktif." };

    const classes = await prisma.class.findMany({
      where: { academicYearId: academicYear.id },
      include: { _count: { select: { students: true } }, homeroomTeacher: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    if (classes.length === 0) return { success: true, result: "Belum ada kelas di tahun ajaran ini." };
    const list = classes
      .map((c) => `- ${c.name} (${c._count.students} siswa, Wali: ${c.homeroomTeacher?.name || "-"}) [ID: ${c.id}]`)
      .join("\n");
    return { success: true, result: `Tahun Ajaran: ${academicYear.year}\n${list}` };
  },

  risiko_siswa: async (args) => {
    const student = await prisma.student.findUnique({
      where: { id: args.studentId },
      select: { id: true, name: true },
    });
    if (!student) return { success: true, result: "Siswa tidak ditemukan." };

    // Ambil risk assessment dari PredictedOutcome
    const outcome = await prisma.predictedOutcome.findFirst({
      where: { studentId: student.id, modelType: "RISK_CLASSIFICATION", isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!outcome) return { success: true, result: `Belum ada analisis risiko untuk ${student.name}.` };

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

  statistik_sekolah: async () => {
    const [totalStudents, totalClasses, activeYear] = await Promise.all([
      prisma.student.count(),
      prisma.class.count(),
      prisma.academicYear.findFirst({ where: { isActive: true } }),
    ]);
    const pendingDrafts = await prisma.aiSummary.count({ where: { isFinal: false } });

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

  tahun_ajaran_aktif: async () => {
    const active = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!active) return { success: true, result: "Tidak ada tahun ajaran yang aktif saat ini." };

    const classCount = await prisma.class.count({ where: { academicYearId: active.id } });
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

export async function executeToolCall(
  toolName: string,
  args: Record<string, string>
): Promise<ToolResult> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return { success: false, result: `Tool '${toolName}' tidak dikenal.` };
  }
  try {
    return await handler(args);
  } catch (err: any) {
    return { success: false, result: `Gagal menjalankan ${toolName}: ${err.message}` };
  }
}
