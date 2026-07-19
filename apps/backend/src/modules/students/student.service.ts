/**
 * STUDENT SERVICE
 * ===============
 *
 * Cara kerja file ini:
 * Service layer untuk resource Student. Berisi logika bisnis untuk CRUD siswa,
 * termasuk validasi relasi (class), pengecekan duplikat (NIS/NISN),
 * dan query ke database via Prisma ORM.
 *
 * Alur lengkap per fungsi:
 *
 * 1. list(query)
 *    - Parse pagination params (page, limit) dari query string
 *    - Bangun filter where: opsional classId exact match + search name (case-insensitive)
 *    - Jalankan findMany + count secara paralel (Promise.all)
 *    - Return { data, page, limit, total } untuk paginated response
 *
 * 2. getById(id)
 *    - findUnique student by ID dengan include relasi class
 *    - Throw NotFoundError jika tidak ditemukan
 *    - Return student object
 *
 * 3. create(data)
 *    - Validasi classId: pastikan class exists
 *    - Validasi NIS unik: findUnique by nis, throw ConflictError jika duplikat
 *    - Validasi NISN unik: findUnique by nisn, throw ConflictError jika duplikat
 *    - Prisma.student.create dengan data lengkap
 *    - Return student yang baru dibuat
 *
 * 4. update(id, data)
 *    - getById(id) untuk memastikan student exists (throw NotFoundError jika tidak)
 *    - Jika classId disertakan, validasi class exists
 *    - Prisma.student.update dengan partial data
 *    - Return student yang diupdate
 */

import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../../common/error";
import { parsePagination, buildPagination } from "../../common/pagination";
import logger from "../../lib/logger";

/**
 * List students with optional class filter, search, and pagination.
 * @param query - Query params: page, limit, classId (exact match), search (name contains)
 */
export async function list(query: { page?: string; limit?: string; classId?: string; search?: string }) {
  logger.debug({ query }, "Student service: listing students");
  // Parse pagination parameters from query string (default page=1, limit=10)
  const { page, limit } = parsePagination(query);
  // Build where clause: filter by classId if provided
  const where: any = query.classId ? { classId: query.classId } : {};
  // Add name search filter (case-insensitive contains) if search term provided
  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }

  // Execute findMany and count in parallel for efficiency
  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        // Include related class info (id + name) for display
        class: {
          select: { id: true, name: true },
        },
      },
      // Default sort by name ascending
      orderBy: { name: "asc" },
      // Apply skip/take pagination
      ...buildPagination(page, limit),
    }),
    prisma.student.count({ where }),
  ]);

  logger.info({ total, page, limit }, "Student list retrieved");
  return { data, page, limit, total };
}

/**
 * Get a single student by ID.
 * @param id - Student UUID
 * @throws NotFoundError if student does not exist
 */
export async function getById(id: string) {
  logger.debug({ studentId: id }, "Student service: get by ID");
  const item = await prisma.student.findUnique({
    where: { id },
    include: {
      // Include related class info for display
      class: {
        select: { id: true, name: true },
      },
    },
  });
  // Throw structured error if student not found
  if (!item) {
    logger.warn({ studentId: id }, "Student not found");
    throw new NotFoundError("Student not found");
  }
  logger.debug({ studentId: id }, "Student retrieved successfully");
  return item;
}

/**
 * Create a new student with duplicate and relation validation.
 * @param data - Student creation payload (nis, nisn, name, gender, classId, birthDate?, address?, parentName?)
 * @throws NotFoundError if classId references a non-existent class
 * @throws ConflictError if NIS or NISN already exists
 */
export async function create(data: {
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  classId: string;
  birthDate?: string;   // Format: YYYY-MM-DD — FR-04
  address?: string;     // Alamat domisili — FR-04
  parentName?: string;  // Nama orang tua/wali — FR-04
}) {
  logger.info({ data }, "Student service: creating student");

  // Validate that the referenced class exists
  const classExists = await prisma.class.findUnique({ where: { id: data.classId } });
  if (!classExists) {
    logger.warn({ classId: data.classId }, "Class not found for student creation");
    throw new NotFoundError("Class not found");
  }

  // Check for duplicate NIS (unique constraint)
  const existingNis = await prisma.student.findUnique({ where: { nis: data.nis } });
  if (existingNis) {
    logger.warn({ nis: data.nis }, "Duplicate NIS on student creation");
    throw new ConflictError("NIS already exists");
  }

  // Check for duplicate NISN (unique constraint)
  const existingNisn = await prisma.student.findUnique({ where: { nisn: data.nisn } });
  if (existingNisn) {
    logger.warn({ nisn: data.nisn }, "Duplicate NISN on student creation");
    throw new ConflictError("NISN already exists");
  }

  // Build create payload — spread required fields + optional fields if present
  const createData: any = {
    nis: data.nis,
    nisn: data.nisn,
    name: data.name,
    gender: data.gender,
    classId: data.classId,
  };
  if (data.birthDate !== undefined) createData.birthDate = data.birthDate;
  if (data.address !== undefined) createData.address = data.address;
  if (data.parentName !== undefined) createData.parentName = data.parentName;

  const student = await prisma.student.create({ data: createData });
  logger.info({ studentId: student.id, nis: data.nis, nisn: data.nisn }, "Student created successfully");
  return student;
}

/**
 * Update an existing student with optional field overrides.
 * @param id - Student UUID
 * @param data - Partial update fields (nis, nisn, name, gender, classId, birthDate, address, parentName)
 * @throws NotFoundError if student or referenced class does not exist
 */
/**
 * BulkCreateResult — Hasil dari bulk create, berisi jumlah sukses/gagal dan detail error per baris.
 */
export interface BulkCreateResult {
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; nis?: string; nisn?: string; message: string }>;
}

/**
 * Bulk create students from an array of student data.
 * Setiap siswa diproses secara independen — error pada satu siswa tidak menggagalkan siswa lain.
 * Validasi per baris: class exists, NIS unik, NISN unik, field required.
 *
 * @param studentsData - Array data siswa untuk di-import
 * @returns BulkCreateResult dengan ringkasan sukses/gagal + detail error per baris
 */
export async function bulkCreate(
  studentsData: Array<{
    nis: string;
    nisn: string;
    name: string;
    gender: string;
    classId: string;
    birthDate?: string;   // Format: YYYY-MM-DD — FR-04
    address?: string;     // Alamat domisili — FR-04
    parentName?: string;  // Nama orang tua/wali — FR-04
  }>
): Promise<BulkCreateResult> {
  logger.info({ count: studentsData.length }, "Student service: bulk creating students");

  const result: BulkCreateResult = { successCount: 0, errorCount: 0, errors: [] };

  for (let i = 0; i < studentsData.length; i++) {
    const row = i + 1; // 1-indexed for error reporting
    const data = studentsData[i];

    try {
      // Validate required fields
      if (!data.name || !data.nis || !data.nisn || !data.gender || !data.classId) {
        const missing = [];
        if (!data.name) missing.push("name");
        if (!data.nis) missing.push("nis");
        if (!data.nisn) missing.push("nisn");
        if (!data.gender) missing.push("gender");
        if (!data.classId) missing.push("classId");
        throw new ValidationError(`Field wajib tidak lengkap: ${missing.join(", ")}`);
      }

      // Validate gender
      if (!["L", "P"].includes(data.gender)) {
        throw new ValidationError("Jenis kelamin harus L atau P");
      }

      // Validate class exists
      const classExists = await prisma.class.findUnique({ where: { id: data.classId } });
      if (!classExists) {
        throw new NotFoundError(`Kelas dengan ID ${data.classId} tidak ditemukan`);
      }

      // Check duplicate NIS
      const existingNis = await prisma.student.findUnique({ where: { nis: data.nis } });
      if (existingNis) {
        throw new ConflictError(`NIS "${data.nis}" sudah terdaftar`);
      }

      // Check duplicate NISN
      const existingNisn = await prisma.student.findUnique({ where: { nisn: data.nisn } });
      if (existingNisn) {
        throw new ConflictError(`NISN "${data.nisn}" sudah terdaftar`);
      }

      // Build create payload — required fields + optional fields if present
      const createPayload: any = {
        nis: data.nis,
        nisn: data.nisn,
        name: data.name,
        gender: data.gender,
        classId: data.classId,
      };
      if (data.birthDate !== undefined) createPayload.birthDate = data.birthDate;
      if (data.address !== undefined) createPayload.address = data.address;
      if (data.parentName !== undefined) createPayload.parentName = data.parentName;

      // Create student
      await prisma.student.create({ data: createPayload });
      result.successCount++;
      logger.debug({ row, nis: data.nis, nisn: data.nisn }, "Bulk create: student created");
    } catch (err: any) {
      result.errorCount++;
      const message = err.message || "Unknown error";
      result.errors.push({ row, nis: data.nis, nisn: data.nisn, message });
      logger.warn({ row, nis: data.nis, error: message }, "Bulk create: student failed");
    }
  }

  logger.info(
    { successCount: result.successCount, errorCount: result.errorCount },
    "Student service: bulk create completed"
  );
  return result;
}

export async function update(
  id: string,
  data: {
    nis?: string;
    nisn?: string;
    name?: string;
    gender?: string;
    classId?: string;
    birthDate?: string;   // Format: YYYY-MM-DD — FR-04
    address?: string;     // Alamat domisili — FR-04
    parentName?: string;  // Nama orang tua/wali — FR-04
  }
) {
  logger.info({ studentId: id, data }, "Student service: updating student");
  // Ensure student exists before attempting update
  await getById(id);

  // If classId is being changed, validate the new class exists
  if (data.classId) {
    const classExists = await prisma.class.findUnique({ where: { id: data.classId } });
    if (!classExists) {
      logger.warn({ classId: data.classId }, "Class not found for student update");
      throw new NotFoundError("Class not found");
    }
  }

  // Build update payload — only include fields that are explicitly provided
  const updateData: any = {};
  if (data.nis !== undefined) updateData.nis = data.nis;
  if (data.nisn !== undefined) updateData.nisn = data.nisn;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.classId !== undefined) updateData.classId = data.classId;
  if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.parentName !== undefined) updateData.parentName = data.parentName;

  const student = await prisma.student.update({ where: { id }, data: updateData });
  logger.info({ studentId: id }, "Student updated successfully");
  return student;
}

/**
 * remove — Menghapus siswa berdasarkan ID.
 * Hanya ADMINISTRATOR dan OPERATOR_SEKOLAH yang bisa menghapus.
 * @param id - ID siswa yang akan dihapus
 * @param deletedById - ID user yang melakukan penghapusan (untuk audit log)
 */
export async function remove(id: string, deletedById: string) {
  logger.warn({ studentId: id, deletedById }, "Removing student");

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new NotFoundError("Siswa tidak ditemukan");

  await prisma.student.delete({ where: { id } });

  logger.info({ studentId: id, nis: student.nis, name: student.name }, "Student removed successfully");
  return { message: "Siswa berhasil dihapus" };
}
