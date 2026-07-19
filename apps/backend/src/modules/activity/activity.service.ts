/**
 * ACTIVITY SERVICE — Business Logic untuk Activity Log
 * ======================================================
 *
 * Cara Kerja:
 * 1. Fungsi `list()` mengambil data ClassAuditLog terbaru dari database.
 * 2. Menggabungkan data dengan relasi Class, User (changedBy), dan User (teacher)
 *    untuk membentuk deskripsi aktivitas yang bermakna.
 * 3. Format output: array objek { id, action, description, userName, timestamp }.
 *
 * Alur Lengkap:
 * - Controller GET /activity → panggil activityService.list(limit) →
 *   Query audit log dari DB → Lookup nama teacher dari ID →
 *   Build deskripsi dari previousTeacherId / newTeacherId → Return array aktivitas
 *
 * Dependencies:
 * - ../../lib/prisma: Prisma client untuk query database
 * - ../../lib/logger: Pino logger untuk logging terstruktur
 */

import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";

/**
 * Jumlah aktivitas terbaru yang akan diambil secara default.
 * Cukup 20 untuk menampilkan activity feed di dashboard.
 */
const DEFAULT_LIMIT = 20;

/**
 * Antarmuka item aktivitas yang dikembalikan ke client.
 */
export interface ActivityItem {
  id: string;
  /** Kode aksi machine-readable: ASSIGN_TEACHER | CHANGE_TEACHER */
  action: string;
  /** Deskripsi human-readable dalam Bahasa Indonesia */
  description: string;
  /** Nama user yang melakukan perubahan */
  userName: string;
  /** Timestamp ISO string */
  timestamp: string;
}

/**
 * list — Mengambil aktivitas terbaru dari ClassAuditLog.
 *
 * Alur:
 * 1. Query ClassAuditLog terbaru dengan include class dan changedBy user.
 * 2. Kumpulkan semua teacher ID dari newTeacherId dan previousTeacherId.
 * 3. Fetch nama-nama teacher dalam satu batch query.
 * 4. Bentuk array ActivityItem dengan deskripsi yang bermakna.
 *
 * @param limit  - Jumlah maksimal aktivitas yang diambil (default 20).
 * @returns      - Promise<ActivityItem[]>
 */
export async function list(limit: number = DEFAULT_LIMIT): Promise<ActivityItem[]> {
  logger.debug({ limit }, "activity.service.list — fetching recent audit logs");

  // Ambil audit log terbaru dengan relasi class dan user
  const logs = await prisma.classAuditLog.findMany({
    take: Math.min(limit, 100), // Batasi maksimal 100
    orderBy: { changedAt: "desc" },
    include: {
      // Nama kelas untuk deskripsi ("Kelas 4A", dll)
      class: {
        select: { id: true, name: true },
      },
      // Nama admin/user yang melakukan perubahan
      changedBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (logs.length === 0) {
    logger.debug("activity.service.list — no audit logs found");
    return [];
  }

  logger.debug({ count: logs.length }, "activity.service.list — audit logs fetched, fetching teacher names");

  // Kumpulkan semua teacher ID dari newTeacherId dan previousTeacherId
  // untuk di-lookup namanya dalam satu query
  const teacherIds = new Set<string>();
  for (const log of logs) {
    if (log.newTeacherId) teacherIds.add(log.newTeacherId);
    if (log.previousTeacherId) teacherIds.add(log.previousTeacherId);
  }

  // Fetch nama-nama teacher (User) dalam satu batch
  const teacherMap = new Map<string, string>();
  if (teacherIds.size > 0) {
    const teachers = await prisma.user.findMany({
      where: { id: { in: Array.from(teacherIds) } },
      select: { id: true, name: true },
    });
    for (const t of teachers) {
      teacherMap.set(t.id, t.name);
    }
    logger.debug({ teacherCount: teacherMap.size }, "activity.service.list — teacher names resolved");
  }

  // Bentuk array ActivityItem dengan deskripsi yang bermakna
  const activities: ActivityItem[] = logs.map((log) => {
    // Tentukan action: ASSIGN_TEACHER jika tidak ada previousTeacherId (penunjukan pertama)
    // atau CHANGE_TEACHER jika ada perubahan dari guru sebelumnya
    const action = log.previousTeacherId ? "CHANGE_TEACHER" : "ASSIGN_TEACHER";

    // Dapatkan nama guru baru dan guru sebelumnya (jika ada)
    const newTeacherName = log.newTeacherId ? teacherMap.get(log.newTeacherId) || "Unknown" : "Unknown";
    const previousTeacherName = log.previousTeacherId
      ? teacherMap.get(log.previousTeacherId) || "Unknown"
      : null;

    // Bangun deskripsi dalam Bahasa Indonesia yang informatif
    const className = log.class.name;
    const adminName = log.changedBy.name;
    let description: string;

    if (action === "ASSIGN_TEACHER") {
      // Penunjukan wali kelas pertama kali
      description = `${adminName} menunjuk ${newTeacherName} sebagai wali kelas ${className}`;
    } else {
      // Perubahan wali kelas
      description = `${adminName} mengganti wali kelas ${className} dari ${previousTeacherName} menjadi ${newTeacherName}`;
    }

    return {
      id: log.id,
      action,
      description,
      userName: log.changedBy.name,
      timestamp: log.changedAt.toISOString(),
    };
  });

  logger.info({ count: activities.length }, "activity.service.list — activities formatted successfully");
  return activities;
}
