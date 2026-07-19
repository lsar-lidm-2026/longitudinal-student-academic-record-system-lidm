/**
 * Prisma Client Singleton & DB Health Check
 * ==========================================
 *
 * Cara Kerja:
 * 1. Memuat environment variables via `load-env`.
 * 2. Mengekspor singleton `PrismaClient` yang aman untuk hot-reload (globalThis caching).
 * 3. `createAdapter()` membuat koneksi pool via `@prisma/adapter-pg` dengan konfigurasi
 *    optimal untuk PgBouncer, Tailscale, dan production.
 * 4. `createPrismaClient()` menginisialisasi PrismaClient dengan adapter tersebut.
 * 5. `checkDbHealth()` melakukan ping SELECT 1 dan mengukur latensi.
 *
 * Alur:
 * - import { prisma } dari file ini untuk semua query database.
 * - import { checkDbHealth } untuk endpoint health-check.
 * - Di development, instance disimpan di globalThis agar hot-reload tidak membuat instance baru.
 */

import "../config/load-env";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import logger from "./logger";

/**
 * Global singleton holder untuk PrismaClient.
 * Digunakan untuk mencegah multiple instance saat hot-reload (Bun --watch).
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Membuat koneksi adapter PostgreSQL dengan pool config optimal.
 * @param url - DATABASE_URL yang akan diparse untuk menentukan protocol.
 * @returns Instance PrismaPg adapter.
 * @throws Error jika protocol bukan postgres/postgresql.
 */
function createAdapter(url: string) {
  // Ekstrak protocol dari URL database (postgres:, postgresql:, dll)
  const protocol = new URL(url).protocol.replace(":", "");

  if (protocol === "postgres" || protocol === "postgresql") {
    // Konfigurasi pool koneksi — dioptimalkan untuk PgBouncer + Tailscale
    const poolConfig: pg.PoolConfig = {
      connectionString: url,
      // Pool kecil — pooling di-handle PgBouncer di server
      max: 5,
      // Tutup koneksi idle setelah 1 menit
      idleTimeoutMillis: 60000,
      // Gagal cepat kalau PgBouncer unreachable
      connectionTimeoutMillis: 15000,
      // TCP keepalive biar koneksi Tailscale nggak putus
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Biarin proses exit kalau lagi idle
      allowExitOnIdle: true,
      // Recycle koneksi setelah 10000 kali query (cegah memory leak)
      maxUses: 10000,
    };

    logger.info(
      { protocol: "postgresql", maxPool: poolConfig.max, idleTimeout: poolConfig.idleTimeoutMillis },
      "Creating PrismaPg adapter with pool config"
    );

    return new PrismaPg(poolConfig, {
      schema: "public",
      // Log & recover dari pool-level errors
      onPoolError: (err) => {
        logger.error({ err }, "PostgreSQL pool error occurred");
      },
      onConnectionError: (err) => {
        logger.error({ err }, "PostgreSQL connection error occurred");
      },
    });
  }

  // Protocol tidak dikenal — lempar error
  logger.error({ protocol }, "Unsupported DATABASE_URL protocol");
  throw new Error(`Unsupported DATABASE_URL protocol: ${protocol}`);
}

/**
 * Membuat PrismaClient baru dengan adapter dari DATABASE_URL.
 * @returns PrismaClient instance yang siap digunakan.
 */
export function createPrismaClient() {
  // Baca DATABASE_URL — prioritaskan Bun.env, fallback ke process.env
  const url = Bun.env.DATABASE_URL || process.env.DATABASE_URL;

  if (!url) {
    logger.fatal("DATABASE_URL is not set — cannot initialize Prisma");
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  logger.info("Initializing new PrismaClient instance");
  return new PrismaClient({ adapter: createAdapter(url) }) as PrismaClient;
}

/** Singleton PrismaClient — gunakan instance yang sudah ada atau buat baru */
export const prisma =
  globalForPrisma.prisma || createPrismaClient();

// Di non-production, simpan instance ke globalThis untuk reuse saat hot-reload
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Cek koneksi DB — ping & ukur latensi */
export async function checkDbHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    // Kirim query ping untuk memvalidasi koneksi database masih hidup
    await prisma.$queryRaw`SELECT 1`;
    const latency = Math.round(performance.now() - start);
    logger.info({ latencyMs: latency }, "Database health check succeeded");
    return { ok: true, latencyMs: latency };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    logger.error({ err, latencyMs: latency }, "Database health check failed");
    return {
      ok: false,
      latencyMs: latency,
      error: err?.message ?? "Unknown error",
    };
  }
}
