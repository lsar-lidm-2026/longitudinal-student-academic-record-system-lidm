/**
 * Frontend Logger — Utility for structured browser-side logging.
 * ==============================================================
 *
 * Cara Kerja:
 * 1. Logger membungkus console API dengan format terstruktur: timestamp, level, module, pesan.
 * 2. Level bisa diatur via NEXT_PUBLIC_LOG_LEVEL (debug | info | warn | error).
 *    Default: "info" — level debug hanya tampil di development.
 * 3. Setiap log menyertakan namespace/module untuk memudahkan tracing.
 *
 * Alur:
 * - import logger from "@/lib/logger" (atau relative path)
 * - logger.info("ModuleName", "Pesan", { optionalContext })
 * - logger.error("ModuleName", "Pesan", { err, ...context })
 * - logger.warn("ModuleName", "Pesan", { ...context })
 * - logger.debug("ModuleName", "Pesan", { ...context })
 *
 * Contoh:
 *   logger.info("StudentService", "Fetching student list", { classId, page });
 *   logger.error("StudentForm", "Save failed", { err, studentId });
 *
 * @module Logger
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Baca log level dari env, fallback ke "info" */
function getConfiguredLevel(): LogLevel {
  if (typeof window === "undefined") return "info";
  const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) return envLevel;
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

const currentLevel = getConfiguredLevel();
const currentLevelNum = LOG_LEVELS[currentLevel];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevelNum;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function toPlainObject(obj: unknown): Record<string, unknown> {
  if (obj instanceof Error) {
    return { message: obj.message, name: obj.name, stack: obj.stack };
  }
  if (obj && typeof obj === "object") return obj as Record<string, unknown>;
  return { value: obj };
}

/**
 * FrontendLogger — structured console logging wrapper.
 * Semua method menerima (module, message, context?) sebagai argumen standar.
 */
export const logger = {
  debug(module: string, message: string, context?: Record<string, unknown>) {
    if (!shouldLog("debug")) return;
    const ts = formatTimestamp();
    if (context) {
      console.debug(`[${ts}] [DEBUG] [${module}] ${message}`, toPlainObject(context));
    } else {
      console.debug(`[${ts}] [DEBUG] [${module}] ${message}`);
    }
  },

  info(module: string, message: string, context?: Record<string, unknown>) {
    if (!shouldLog("info")) return;
    const ts = formatTimestamp();
    if (context) {
      console.info(`[${ts}] [INFO] [${module}] ${message}`, toPlainObject(context));
    } else {
      console.info(`[${ts}] [INFO] [${module}] ${message}`);
    }
  },

  warn(module: string, message: string, context?: Record<string, unknown>) {
    if (!shouldLog("warn")) return;
    const ts = formatTimestamp();
    if (context) {
      console.warn(`[${ts}] [WARN] [${module}] ${message}`, toPlainObject(context));
    } else {
      console.warn(`[${ts}] [WARN] [${module}] ${message}`);
    }
  },

  error(module: string, message: string, context?: Record<string, unknown>) {
    if (!shouldLog("error")) return;
    const ts = formatTimestamp();
    if (context) {
      console.error(`[${ts}] [ERROR] [${module}] ${message}`, toPlainObject(context));
    } else {
      console.error(`[${ts}] [ERROR] [${module}] ${message}`);
    }
  },
};

export default logger;
