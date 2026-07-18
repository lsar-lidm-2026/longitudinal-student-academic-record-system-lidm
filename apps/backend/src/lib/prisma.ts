import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function createPrismaClient() {
  const url = process.env.DATABASE_URL!;

  const poolConfig: pg.PoolConfig = {
    connectionString: url,
    // Pool kecil — pooling di-handle PgBouncer di server
    max: 5,
    // Tutup koneksi idle setelah 1 menit
    idleTimeoutMillis: 60000,
    // Gagal cepat kalau PgBouncer unreachable
    connectionTimeoutMillis: 5000,
    // TCP keepalive biar koneksi Tailscale nggak putus
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Biarin proses exit kalau lagi idle
    allowExitOnIdle: true,
    // Recycle koneksi setelah 10000 kali query (cegah memory leak)
    maxUses: 10000,
  };

  const adapter = new PrismaPg(poolConfig, {
    schema: "public",
    // Log & recover dari pool-level errors
    onPoolError: (err) => {
      console.error("[DB] Pool error:", err.message);
    },
    onConnectionError: (err) => {
      console.error("[DB] Connection error:", err.message);
    },
  });

  return new PrismaClient({ adapter }) as PrismaClient;
}

export const prisma =
  globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Cek koneksi DB — ping & ukur latensi */
export async function checkDbHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err?.message ?? "Unknown error",
    };
  }
}
