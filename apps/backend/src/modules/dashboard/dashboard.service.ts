/**
 * Dashboard Service — Logika Bisnis Ringkasan Dashboard dan Status Administratif
 * ==============================================================================
 *
 * Cara Kerja:
 * 1. getSummary: Berdasarkan role, hitung total siswa, kelas, tahun aktif, dan draft AI pending.
 *    - ADMINISTRATOR / KEPALA_SEKOLAH: data seluruh sekolah.
 *    - GURU: data terbatas pada kelas yang diampu.
 *    - OPERATOR_SEKOLAH: data seluruh sekolah (tanpa pendingAiDrafts).
 * 2. getAdministrativeStatus: Untuk setiap kelas (atau kelas yang diampu), hitung:
 *    - Jumlah siswa, jumlah semester record, jumlah nilai, draft AI pending.
 *    - Persentase kelengkapan (completeness).
 *
 * Alur:
 * 1. Service menerima userId dan role.
 * 2. getSummary: percabangan role → query Prisma paralel → return data.
 * 3. getAdministrativeStatus: tentukan classIds → query per kelas → hitung completeness → return.
 */

import { prisma } from "../../lib/prisma";
import type { Role } from "../../generated/prisma/client";
import logger from "../../lib/logger";

/**
 * getSummary — Mengembalikan ringkasan data dashboard berdasarkan role user.
 *
 * Untuk ADMINISTRATOR / KEPALA_SEKOLAH:
 * - Total siswa, total kelas, tahun aktif, total draft AI yang belum final.
 *
 * Untuk GURU:
 * - Kelas yang diampu, total siswa di kelas tersebut, tahun aktif, draft AI pending.
 *
 * Untuk OPERATOR_SEKOLAH:
 * - Total siswa, total kelas, tahun aktif.
 *
 * @param userId - ID user yang sedang terautentikasi.
 * @param role - Role user (ADMINISTRATOR | OPERATOR_SEKOLAH | GURU | KEPALA_SEKOLAH).
 * @returns Objek ringkasan sesuai role.
 */
export async function getSummary(userId: string, role: Role) {
  logger.info({ userId, role }, "Fetching dashboard summary");

  // === ADMINISTRATOR / KEPALA_SEKOLAH: akses data seluruh sekolah ===
  if (role === "ADMINISTRATOR" || role === "KEPALA_SEKOLAH") {
    // Eksekusi 4 query secara paralel untuk efisiensi
    const [totalStudents, activeYear, pendingAiDrafts] = await Promise.all([
      prisma.student.count(),                                          // Total seluruh siswa
      prisma.academicYear.findFirst({ where: { isActive: true } }),   // Tahun ajaran aktif
      prisma.aiSummary.count({ where: { isFinal: false } }),           // Draft AI yang belum final
    ]);
    // Total kelas HANYA dari tahun ajaran aktif — bukan semua tahun
    const totalClasses = activeYear
      ? await prisma.class.count({ where: { academicYearId: activeYear.id } })
      : 0;

    logger.info({ userId, role, totalStudents, totalClasses, activeYear: activeYear?.year, pendingAiDrafts }, "Summary fetched for admin/kepsek");
    return {
      totalStudents,                    // Jumlah total siswa
      totalClasses,                     // Jumlah total kelas
      activeYear: activeYear?.year || null, // Tahun ajaran aktif (null jika tidak ada)
      pendingAiDrafts,                  // Jumlah draft AI yang perlu direview
    };
  }

  // === GURU: akses data terbatas pada kelas yang diampu ===
  if (role === "GURU") {
    // Ambil kelas-kelas yang diampu oleh guru ini
    const managedClasses = await prisma.class.findMany({
      where: { homeroomTeacherId: userId },
      select: { id: true, name: true },
    });

    const classIds = managedClasses.map((c) => c.id); // Array ID kelas yang diampu

    // Eksekusi 3 query paralel dengan filter classIds
    const [totalStudents, activeYear, pendingAiDrafts] = await Promise.all([
      prisma.student.count({ where: { classId: { in: classIds } } }),           // Siswa di kelas yang diampu
      prisma.academicYear.findFirst({ where: { isActive: true } }),              // Tahun ajaran aktif
      prisma.aiSummary.count({
        where: {
          isFinal: false,                                                        // Hanya draft yang belum final
          semesterRecord: {
            student: { classId: { in: classIds } },                              // Dari siswa di kelas yang diampu
          },
        },
      }),
    ]);

    logger.info({ userId, role, managedClassCount: managedClasses.length, totalStudents, activeYear: activeYear?.year, pendingAiDrafts }, "Summary fetched for guru");
    return {
      managedClasses,                   // Daftar kelas yang diampu [{ id, name }]
      totalStudents,                    // Total siswa di semua kelas yang diampu
      activeYear: activeYear?.year || null,
      pendingAiDrafts,                  // Draft AI pending di kelas yang diampu
    };
  }

  // === OPERATOR_SEKOLAH: akses data seluruh sekolah (tanpa pendingAiDrafts) ===
  const [totalStudents, activeYear] = await Promise.all([
    prisma.student.count(),
    prisma.academicYear.findFirst({ where: { isActive: true } }),
  ]);
  const totalClasses = activeYear
    ? await prisma.class.count({ where: { academicYearId: activeYear.id } })
    : 0;

  logger.info({ userId, role, totalStudents, totalClasses, activeYear: activeYear?.year }, "Summary fetched for operator");
  return { totalStudents, totalClasses, activeYear: activeYear?.year || null };
}

/**
 * getAdministrativeStatus — Mengembalikan status kelengkapan data per kelas.
 *
 * Untuk setiap kelas (seluruh sekolah untuk admin/kepsek, atau kelas yang diampu untuk guru),
 * hitung:
 * - Jumlah siswa, jumlah semester record, jumlah nilai, draft AI pending.
 * - Persentase completeness (based on semester records / total students).
 *
 * @param userId - ID user yang sedang terautentikasi.
 * @param role - Role user (ADMINISTRATOR | GURU | KEPALA_SEKOLAH).
 * @returns Array of { classId, className, academicYear, homeroomTeacher, totalStudents, ... }.
 */
export async function getAdministrativeStatus(userId: string, role: Role) {
  logger.info({ userId, role }, "Fetching administrative status");

  // === Tentukan kelas mana yang akan diperiksa ===
  let classIds: string[];

  if (role === "ADMINISTRATOR" || role === "KEPALA_SEKOLAH") {
    // Admin/Kepsek: periksa kelas di tahun ajaran AKTIF saja
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) {
      logger.warn("No active academic year found for administrative status");
      return [];
    }
    const allClasses = await prisma.class.findMany({
      where: { academicYearId: activeYear.id },
      select: { id: true },
    });
    classIds = allClasses.map((c) => c.id);
    logger.debug({ classCount: classIds.length, academicYear: activeYear.year }, "Admin/Kepsek: checking active-year classes only");
  } else {
    // GURU: hanya kelas yang diampu
    const managedClasses = await prisma.class.findMany({
      where: { homeroomTeacherId: userId },
      select: { id: true },
    });
    classIds = managedClasses.map((c) => c.id);
    logger.debug({ classCount: classIds.length }, "Guru: checking managed classes only");
  }

  // === Untuk setiap kelas, hitung statistik dan kelengkapan data ===
  const results = await Promise.all(
    classIds.map(async (classId) => {
      logger.debug({ classId }, "Processing class for administrative status");

      // Ambil informasi kelas (nama, tahun ajaran, wali kelas, jumlah siswa)
      const classInfo = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          academicYear: { select: { year: true } },           // Tahun ajaran
          homeroomTeacher: { select: { name: true } },         // Nama wali kelas
          _count: { select: { students: true } },              // Jumlah siswa di kelas
        },
      });

      // Ambil daftar siswa di kelas ini (hanya ID)
      const students = await prisma.student.findMany({
        where: { classId },
        select: { id: true },
      });

      // Hitung statistik kelengkapan
      const totalStudents = students.length;                                          // Total siswa di kelas
      const withRecords = await prisma.semesterRecord.count({                         // Jumlah total semester record
        where: { studentId: { in: students.map((s) => s.id) } },
      });
      const withScores = await prisma.subjectScore.count({                           // Jumlah total nilai
        where: {
          semesterRecord: { student: { classId } },
        },
      });
      const pendingAiDrafts = await prisma.aiSummary.count({                         // Jumlah draft AI yang belum final
        where: {
          isFinal: false,
          semesterRecord: { student: { classId } },
        },
      });

      // Persentase kelengkapan: (total records / total students) * 100, dibatasi maks 100
      const completeness = totalStudents > 0
        ? Math.min(Math.round((withRecords / totalStudents) * 100), 100)
        : 0;

      logger.debug({ classId, totalStudents, withRecords, withScores, pendingAiDrafts, completeness }, "Class stats computed");

      return {
        classId,                                           // ID kelas
        className: classInfo?.name || "Unknown",           // Nama kelas
        academicYear: classInfo?.academicYear.year || "",  // Tahun ajaran
        homeroomTeacher: classInfo?.homeroomTeacher?.name || "Belum di-assign", // Nama wali kelas
        totalStudents,                                     // Jumlah siswa
        totalRecords: withRecords,                         // Total semester record
        totalScores: withScores,                           // Total nilai mata pelajaran
        pendingAiDrafts,                                   // Draft AI yang perlu direview
        completeness,                                      // Persentase kelengkapan (0-100%)
      };
    })
  );

  logger.info({ userId, role, classCount: results.length }, "Administrative status fetched successfully");
  return results;
}

/**
 * ActivityItem — Tipe data item aktivitas yang dikembalikan ke frontend.
 */
export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  userName: string;
  timestamp: string;
}

/**
 * getActivities — Mengembalikan daftar aktivitas terbaru dari seluruh sistem.
 *
 * Sumber data:
 * 1. AiSummary — pembuatan draft AI baru.
 * 2. ClassAuditLog — perubahan wali kelas.
 *
 * @param userId - ID user yang sedang terautentikasi.
 * @param role - Role user.
 * @returns Array of ActivityItem — maksimal 10 item terbaru.
 */
export async function getActivities(userId: string, role: Role): Promise<ActivityItem[]> {
  logger.info({ userId, role }, "Fetching recent activities");

  // Query paralel dari dua sumber data
  const [aiSummaries, auditLogs] = await Promise.all([
    // 1. Ambil 10 AI Summary terbaru (draft yang belum final)
    prisma.aiSummary.findMany({
      where: { isFinal: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        summaryType: true,
        createdAt: true,
        semesterRecord: {
          select: {
            student: { select: { name: true } },
            semester: true,
          },
        },
      },
    }),
    // 2. Ambil 10 ClassAuditLog terbaru
    prisma.classAuditLog.findMany({
      orderBy: { changedAt: "desc" },
      take: 10,
      select: {
        id: true,
        changedAt: true,
        class: { select: { name: true } },
        changedBy: { select: { name: true } },
      },
    }),
  ]);

  // Transform AiSummary → ActivityItem
  const aiActivities: ActivityItem[] = aiSummaries.map((s) => {
    const studentName = s.semesterRecord?.student?.name || "Unknown";
    const semesterLabel = s.semesterRecord?.semester === 1 ? "Ganjil" : "Genap";
    return {
      id: `ai-${s.id}`,
      action: "AI_DRAFT_CREATED",
      description: `Draft AI untuk ${studentName} (Semester ${semesterLabel}) dibuat`,
      userName: "Sistem AI",
      timestamp: s.createdAt.toISOString(),
    };
  });

  // Transform ClassAuditLog → ActivityItem
  const auditActivities: ActivityItem[] = auditLogs.map((log) => ({
    id: `audit-${log.id}`,
    action: "TEACHER_CHANGED",
    description: `Wali kelas ${log.class?.name || "Unknown"} diperbarui`,
    userName: log.changedBy?.name || "Sistem",
    timestamp: log.changedAt.toISOString(),
  }));

  // Gabung, urutkan berdasarkan timestamp (descending), ambil 10 teratas
  const allActivities = [...aiActivities, ...auditActivities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  logger.info({ userId, role, activityCount: allActivities.length }, "Activities fetched successfully");
  return allActivities;
}
