/**
 * Auth Service — Business logic untuk autentikasi dan manajemen user
 * ===================================================================
 *
 * Cara Kerja:
 * 1. Fungsi-fungsi di sini dipanggil oleh auth.controller.ts (dan sebagian oleh users.controller.ts).
 * 2. Semua operasi database dilakukan melalui Prisma Client.
 * 3. Password di-hash menggunakan bcrypt via lib/hash, JWT di-generate via lib/jwt.
 * 4. Error dikembalikan sebagai instance dari kelas AppError (UnauthorizedError, NotFoundError, ConflictError).
 *
 * Alur Lengkap:
 * - login(input) → cari user by username → verifikasi password → generate JWT + refresh token → return AuthResult
 * - getMe(userId) → cari user by id (select terbatas) → throw NotFoundError jika tidak ditemukan
 * - createUser(input) → cek duplikat username → hash password → buat user di DB → return user (tanpa password)
 * - listUsers() → findAll user (select terbatas) → sorted by createdAt desc
 * - refresh(refreshToken) → verify token → cek user masih aktif → generate token pair baru
 * - updateUser(id, data) → cek user exists → update field name/role/isActive → return user
 * - toggleUserStatus(id) → cek user exists → toggle isActive → return user
 */

import logger from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { verifyPassword, hashPassword } from "../../lib/hash";
import { generateToken, generateRefreshToken } from "../../lib/jwt";
import { UnauthorizedError, NotFoundError, ConflictError } from "../../common/error";
import type { JwtPayload } from "../../common/types";
import type { Role } from "../../generated/prisma/client";

// ── Type Definitions ─────────────────────────────────────────────────────────

/**
 * Input untuk login: username + password
 */
export interface LoginInput {
  username: string;
  password: string;
}

/**
 * Input untuk membuat user baru
 */
export interface CreateUserInput {
  username: string;
  password: string;
  name: string;
  role: Role;
}

/**
 * Hasil autentikasi: accessToken (JWT), refreshToken, dan data user (JwtPayload)
 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: JwtPayload;
}

// ── Login ────────────────────────────────────────────────────────────────────

/**
 * login — Memverifikasi kredensial dan menghasilkan token JWT + refresh token.
 *
 * Alur:
 * 1. Cari user berdasarkan username.
 * 2. Jika user tidak ditemukan atau tidak aktif → throw UnauthorizedError.
 * 3. Verifikasi password dengan bcrypt.
 * 4. Generate JWT access token dan refresh token.
 * 5. Return AuthResult { accessToken, refreshToken, user }.
 *
 * @param input  - { username, password }
 * @returns      - Promise<AuthResult>
 * @throws       - UnauthorizedError jika kredensial salah
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  logger.info({ username: input.username }, "auth.service.login — start");

  // Cari user berdasarkan username (unique constraint)
  const user = await prisma.user.findUnique({
    where: { username: input.username },
  });

  // Cek: user tidak ditemukan atau akun dinonaktifkan
  if (!user || !user.isActive) {
    logger.warn({ username: input.username }, "auth.service.login — user not found or inactive");
    throw new UnauthorizedError("Invalid username or password");
  }

  // Verifikasi password dengan bcrypt
  const valid = await verifyPassword(input.password, user.password);
  if (!valid) {
    logger.warn({ username: input.username }, "auth.service.login — wrong password");
    throw new UnauthorizedError("Invalid username or password");
  }

  // Siapkan JWT payload dari data user — termasuk refreshTokenVersion
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role as Role,
    name: user.name,
    refreshTokenVersion: user.refreshTokenVersion,
  };

  logger.info({ userId: user.id, version: user.refreshTokenVersion }, "auth.service.login — success, generating tokens");

  // Generate token pair dan return
  return {
    accessToken: generateToken(payload),
    refreshToken: generateRefreshToken(payload),
    user: payload,
  };
}

// ── Get Current User ─────────────────────────────────────────────────────────

/**
 * getMe — Mengambil profil user berdasarkan userId (tanpa password).
 *
 * @param userId - UUID user yang sedang login
 * @returns      - Promise<User> dengan select terbatas (tanpa password)
 * @throws       - NotFoundError jika user tidak ditemukan
 */
export async function getMe(userId: string) {
  logger.debug({ userId }, "auth.service.getMe — start");

  // Cari user dengan select terbatas (tanpa field password)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Lempar error jika user tidak ditemukan
  if (!user) {
    logger.warn({ userId }, "auth.service.getMe — user not found");
    throw new NotFoundError("User not found");
  }

  logger.debug({ userId }, "auth.service.getMe — success");
  return user;
}

// ── Create User ──────────────────────────────────────────────────────────────

/**
 * createUser — Membuat user baru (hanya untuk role ADMINISTRATOR).
 *
 * Alur:
 * 1. Cek duplikat username → ConflictError jika sudah ada.
 * 2. Hash password dengan bcrypt.
 * 3. Simpan user baru ke database.
 * 4. Return user tanpa field password.
 *
 * @param input - { username, password, name, role }
 * @returns     - Promise<User> (tanpa password)
 * @throws      - ConflictError jika username sudah terdaftar
 */
export async function createUser(input: CreateUserInput) {
  logger.info({ username: input.username }, "auth.service.createUser — start");

  // Cek apakah username sudah digunakan
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
  });

  if (existing) {
    logger.warn({ username: input.username }, "auth.service.createUser — username already exists");
    throw new ConflictError("Username already exists");
  }

  // Hash password sebelum disimpan ke database
  const hashed = await hashPassword(input.password);

  logger.info({ username: input.username, role: input.role }, "auth.service.createUser — creating user");

  // Simpan user baru, return tanpa password
  return prisma.user.create({
    data: {
      username: input.username,
      password: hashed,
      name: input.name,
      role: input.role,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

// ── List Users ───────────────────────────────────────────────────────────────

/**
 * listUsers — Mengambil daftar semua user (tanpa password), diurutkan dari terbaru.
 *
 * @returns - Promise<User[]> array of users
 */
export async function listUsers() {
  logger.debug("auth.service.listUsers — start");

  // Ambil semua user dengan select terbatas, urut descending createdAt
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  logger.debug({ count: users.length }, "auth.service.listUsers — success");
  return users;
}

// ── Refresh Token ────────────────────────────────────────────────────────────

/**
 * refresh — Memverifikasi refresh token dan menghasilkan token pair baru.
 *
 * Alur:
 * 1. Import verifyToken secara dinamis.
 * 2. Verifikasi refresh token → decode payload.
 * 3. Cari user berdasarkan userId dari token.
 * 4. Jika user tidak ditemukan atau tidak aktif → throw UnauthorizedError.
 * 5. Generate token pair baru.
 * 6. Return AuthResult { accessToken, refreshToken, user }.
 *
 * @param refreshToken - Refresh token string dari client
 * @returns            - Promise<AuthResult>
 * @throws             - UnauthorizedError jika token invalid/expired
 */
export async function refresh(refreshToken: string) {
  logger.info("auth.service.refresh — start");

  try {
    // Dynamic import untuk avoid circular dependency
    const { verifyToken } = await import("../../lib/jwt");
    // Verifikasi refresh token → decode JWT payload
    const decoded = verifyToken(refreshToken);

    logger.debug({ userId: decoded.userId }, "auth.service.refresh — token verified, checking user");

    // Cari user berdasarkan userId dari token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    // Cek: user tidak ditemukan atau akun dinonaktifkan
    if (!user || !user.isActive) {
      logger.warn({ userId: decoded.userId }, "auth.service.refresh — user invalid or inactive");
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Validasi refreshTokenVersion — jika token curian dipakai, versi tidak akan cocok
    if (decoded.refreshTokenVersion !== undefined && decoded.refreshTokenVersion !== user.refreshTokenVersion) {
      logger.warn(
        { userId: user.id, tokenVersion: decoded.refreshTokenVersion, dbVersion: user.refreshTokenVersion },
        "auth.service.refresh — refresh token version mismatch (possible token reuse)"
      );
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Increment refreshTokenVersion untuk menginvalidasi token lama
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenVersion: { increment: 1 } },
    });

    // Siapkan JWT payload baru dengan versi yang sudah diincrement
    const payload: JwtPayload = {
      userId: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role as Role,
      name: updatedUser.name,
      refreshTokenVersion: updatedUser.refreshTokenVersion,
    };

    logger.info({ userId: user.id, newVersion: updatedUser.refreshTokenVersion }, "auth.service.refresh — success, version incremented, generating new tokens");

    // Generate token pair baru
    return {
      accessToken: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
      user: payload,
    };
  } catch {
    // Tangkap semua error (token expired, invalid signature, user not found, dll)
    logger.warn("auth.service.refresh — failed: invalid or expired token");
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}

// ── Update User ──────────────────────────────────────────────────────────────

/**
 * updateUser — Memperbarui data user (name, role, isActive).
 *
 * @param id   - UUID user yang akan diupdate
 * @param data - { name?, role?, isActive? }
 * @returns    - Promise<User> (tanpa password)
 * @throws     - NotFoundError jika user tidak ditemukan
 */
export async function updateUser(
  id: string,
  data: { name?: string; role?: Role; isActive?: boolean; password?: string }
) {
  logger.info({ userId: id, updates: { ...data, password: data.password ? "(redacted)" : undefined } }, "auth.service.updateUser — start");

  // Pastikan user ada sebelum diupdate
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    logger.warn({ userId: id }, "auth.service.updateUser — user not found");
    throw new NotFoundError("User not found");
  }

  // Bangun data update — hanya set field yang disediakan
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Hash password jika disertakan
  if (data.password) {
    updateData.password = await Bun.password.hash(data.password, { algorithm: "bcrypt", cost: 10 });
    logger.info({ userId: id }, "auth.service.updateUser — password changed");
  }

  logger.info({ userId: id, fields: Object.keys(updateData) }, "auth.service.updateUser — updating user");

  // Update user dengan data yang sudah dibangun
  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

// ── Toggle User Status ───────────────────────────────────────────────────────

/**
 * toggleUserStatus — Mengaktifkan/menonaktifkan akun user (toggle isActive).
 *
 * @param id - UUID user yang akan di-toggle statusnya
 * @returns  - Promise<User> (tanpa password)
 * @throws   - NotFoundError jika user tidak ditemukan
 */
export async function toggleUserStatus(id: string) {
  logger.info({ userId: id }, "auth.service.toggleUserStatus — start");

  // Pastikan user ada
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    logger.warn({ userId: id }, "auth.service.toggleUserStatus — user not found");
    throw new NotFoundError("User not found");
  }

  const newStatus = !user.isActive;
  logger.info({ userId: id, newStatus }, "auth.service.toggleUserStatus — toggling status");

  // Toggle nilai isActive
  return prisma.user.update({
    where: { id },
    data: { isActive: newStatus },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}
