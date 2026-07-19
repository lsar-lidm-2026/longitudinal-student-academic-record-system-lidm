/**
 * Logger — Centralized Pino Logger
 * =================================
 *
 * Cara Kerja:
 * 1. Membuat instance Pino logger dengan level dari env (LOG_LEVEL).
 * 2. Format: pretty-print saat development (Bun.env.NODE_ENV !== "production"),
 *    JSON stream saat production.
 * 3. Ekspor default logger instance untuk digunakan di seluruh backend.
 *
 * Alur:
 * - import logger dari "./lib/logger"
 * - logger.info("pesan") / logger.error({ err }, "pesan") / logger.warn(...) / logger.debug(...)
 * - Setiap log otomatis menyertakan timestamp, level, dan message.
 */

import pino from "pino";
import { env } from "../config/env";

const isProduction = Bun.env.NODE_ENV === "production";

const logger = pino({
  level: env.logLevel || "info",
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino/file",
          options: { destination: 1 },
        },
      }),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
