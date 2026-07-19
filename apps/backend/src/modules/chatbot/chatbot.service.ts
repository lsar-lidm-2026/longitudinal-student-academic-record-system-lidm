/**
 * Chatbot Service — menangani percakapan multi-turn dengan tool calling.
 * =====================================================================
 *
 * Cara Kerja:
 * 1. Menerima pesan user, riwayat percakapan, dan data user dari controller.
 * 2. Membangun array messages untuk LLM: system prompt + riwayat (max 6) + pesan baru.
 * 3. Melakukan loop tool calling (max MAX_TOOL_ROUNDS = 5 iterasi):
 *    a. Panggil LLM dengan tools yang tersedia.
 *    b. Jika LLM meminta tool calling → eksekusi tool → kirim hasil ke LLM.
 *    c. Jika LLM memberikan jawaban final → return reply.
 * 4. Jika mencapai max rounds tanpa jawaban final → return pesan error.
 *
 * Alur Lengkap:
 * 1. Controller panggil processMessage(user, message, history).
 * 2. Service bangun messages array dengan SYSTEM_PROMPT + konteks user.
 * 3. Loop tool calling:
 *    - generateChatCompletionWithTools() → response dari LLM.
 *    - Jika ada tool_calls: eksekusi setiap tool, push hasil ke messages.
 *    - Jika tidak ada tool_calls: ambil content sebagai jawaban final.
 * 4. Return ChatResult { reply }.
 *
 * Fungsi:
 * - processMessage — Entry point utama, memproses percakapan dengan LLM
 */
import {
  generateChatCompletionWithTools,
  type LlmMessage,
  type LlmToolMessage,
} from "../ai/llm.client";                        // LLM client untuk chat completion dengan tools
import { CHATBOT_TOOLS, executeToolCall } from "./chatbot.tools"; // Definisi dan eksekutor tools
import type { JwtPayload } from "../../common/types";              // JWT payload type
import logger from "../../lib/logger";                              // Pino logger instance

/**
 * SYSTEM_PROMPT — Instruksi sistem untuk LLM.
 *
 * Mendefinisikan persona AI:
 * - Nama: Asisten LSAR (Longitudinal Student Academic Record)
 * - Tugas: Membantu guru/operator mengakses data akademik siswa
 * - Topik: Data siswa, nilai, risiko, statistik, tahun ajaran, kelas
 * - Aturan: Gunakan tools, jawab dalam Bahasa Indonesia, hanya membaca (read-only)
 * - Tambahan: Konteks user (nama, role) ditambahkan secara dinamis per request
 */
const SYSTEM_PROMPT = `Anda adalah asisten AI untuk sistem LSAR (Longitudinal Student Academic Record).
Anda membantu guru dan operator sekolah mengakses data akademik siswa.

Anda bisa menjawab pertanyaan tentang:
- Data siswa (nama, NIS, kelas)
- Nilai siswa
- Analisis risiko siswa
- Statistik sekolah
- Tahun ajaran
- Kelas dan siswa di dalamnya

Gunakan tools yang tersedia untuk mengambil data yang diperlukan.
Jika tool mengembalikan ID siswa, gunakan ID tersebut untuk tool berikutnya.
Selalu jawab dalam Bahasa Indonesia yang ramah dan informatif.
Jika ada error, sampaikan dengan sopan dan tawarkan solusi.

Anda adalah asisten yang HELPful dan TIDAK boleh mengubah data apapun — hanya membaca.`;

/**
 * MAX_TOOL_ROUNDS — Batas maksimum iterasi tool calling.
 *
 * Mencegah infinite loop jika LLM terus-menerus memanggil tools
 * tanpa memberikan jawaban final.
 */
const MAX_TOOL_ROUNDS = 5;

/**
 * ChatResult — Struktur data yang dikembalikan setelah pesan diproses.
 *
 * @property reply - Teks balasan dari AI
 */
interface ChatResult {
  reply: string;
}

/**
 * processMessage — Entry point utama untuk memproses percakapan user dengan LLM.
 *
 * Alur:
 * 1. Bangun array messages: system prompt (dengan konteks user) + riwayat (max 6) + pesan baru.
 * 2. Loop hingga MAX_TOOL_ROUNDS:
 *    a. Panggil generateChatCompletionWithTools dengan messages dan tools.
 *    b. Jika LLM merespon dengan tool_calls → eksekusi setiap tool, push hasil ke messages.
 *    c. Jika LLM merespon dengan content (tanpa tool_calls) → return sebagai jawaban final.
 * 3. Jika loop habis tanpa jawaban final → return pesan timeout.
 *
 * @param user    - JwtPayload dari middleware auth (id, name, role, dll)
 * @param message - Pesan teks dari user
 * @param history - Riwayat percakapan sebelumnya (max 6 pesan terakhir digunakan)
 * @returns       - ChatResult { reply }
 */
export async function processMessage(
  user: JwtPayload,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatResult> {
  logger.info({ userId: user.userId, role: user.role, messageLength: message.length, historyLength: history.length }, "Chatbot service: processing message");

  // Build message history untuk dikirim ke LLM
  // Format: system prompt (dengan konteks user) → riwayat (max 6 terakhir) → pesan baru
  const messages: Array<LlmMessage | LlmToolMessage> = [
    // System prompt dengan konteks user yang sedang login
    { role: "system", content: SYSTEM_PROMPT + `\n\nUser saat ini: ${user.name} (${user.role})` },
    // Riwayat percakapan: hanya 6 pesan terakhir untuk menghemat konteks
    ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    // Pesan baru dari user
    { role: "user", content: message },
  ];

  logger.debug({ userId: user.userId, totalMessages: messages.length }, "Chatbot service: messages built for LLM");

  // Loop tool calling — maksimal MAX_TOOL_ROUNDS iterasi
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logger.debug({ userId: user.userId, round: round + 1, maxRounds: MAX_TOOL_ROUNDS }, "Chatbot service: LLM call round started");

    // Panggil LLM dengan messages dan tools yang tersedia
    const response = await generateChatCompletionWithTools(messages, [...CHATBOT_TOOLS]);

    // Jika LLM ingin memanggil tools (function calling)
    if (response.tool_calls && response.tool_calls.length > 0) {
      logger.info({ userId: user.userId, round: round + 1, toolCallCount: response.tool_calls.length }, "Chatbot service: LLM requested tool calls");

      // Tambahkan pesan assistant dengan tool_calls ke riwayat
      messages.push({
        role: "assistant",
        content: response.content ?? "",
        tool_calls: response.tool_calls,
      });

      // Eksekusi setiap tool call yang diminta LLM
      for (const tc of response.tool_calls) {
        // Hanya proses tool call bertipe "function"
        if (tc.type === "function") {
          // Parse arguments JSON dari string ke object
          let args: Record<string, string> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            // Jika parsing gagal, gunakan object kosong
            args = {};
          }

          logger.debug({ userId: user.userId, round: round + 1, toolName: tc.function.name, args }, "Chatbot service: executing tool call");

          // Eksekusi tool dan dapatkan hasilnya
          const toolResult = await executeToolCall(tc.function.name, args);

          logger.debug({ userId: user.userId, round: round + 1, toolName: tc.function.name, success: toolResult.success }, "Chatbot service: tool execution completed");

          // Tambahkan hasil tool ke riwayat pesan
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult.success
              ? toolResult.result           // Hasil sukses
              : `Error: ${toolResult.result}`, // Pesan error
          });
        }
      }

      // Lanjut ke iterasi berikutnya — LLM akan memproses hasil tools
      // dan bisa memanggil tools lagi atau memberikan jawaban final
      continue;
    }

    // LLM memberikan jawaban teks final (tanpa tool calls)
    const reply = response.content?.trim();
    if (reply) {
      logger.info({ userId: user.userId, round: round + 1, replyLength: reply.length }, "Chatbot service: LLM gave final answer");
      return { reply };
    }

    // Seharusnya tidak terjadi: response kosong tanpa tool calls
    logger.warn({ userId: user.userId, round: round + 1 }, "Chatbot service: LLM returned empty response without tool calls");
    return { reply: "Maaf, saya tidak bisa memproses pertanyaan Anda saat ini." };
  }

  // Loop selesai tanpa jawaban final — timeout
  logger.warn({ userId: user.userId, maxRounds: MAX_TOOL_ROUNDS }, "Chatbot service: max tool rounds reached without final answer");
  return {
    reply: "Mohon maaf, proses terlalu panjang. Silakan coba pertanyaan yang lebih spesifik.",
  };
}

/**
 * processMessageStream — Memproses percakapan dan mengembalikan AsyncGenerator untuk streaming.
 */
import { generateChatStreamWithTools } from "../ai/llm.client";

export async function* processMessageStream(
  user: JwtPayload,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): AsyncGenerator<string, void, unknown> {
  logger.info({ userId: user.userId, messageLength: message.length }, "Chatbot service: processing message (stream)");

  const messages: Array<LlmMessage | LlmToolMessage> = [
    { role: "system", content: SYSTEM_PROMPT + `\n\nUser saat ini: ${user.name} (${user.role})` },
    ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = generateChatStreamWithTools(messages, [...CHATBOT_TOOLS]);
    let finalToolCalls: any = null;
    let assistantContent = "";

    // Consume stream manually to get return value (tool_calls)
    while (true) {
      const { done, value } = await stream.next();
      if (done) {
        if (value && typeof value === "object" && value.tool_calls) {
          finalToolCalls = value.tool_calls;
        }
        break;
      }
      if (typeof value === "string") {
        assistantContent += value;
        yield value;
      }
    }

    // Jika ada tool calls
    if (finalToolCalls && finalToolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: finalToolCalls,
      });

      for (const tc of finalToolCalls) {
        if (tc.type === "function") {
          let args: Record<string, string> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            args = {};
          }

          const toolResult = await executeToolCall(tc.function.name, args);

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult.success ? toolResult.result : `Error: ${toolResult.result}`,
          });
        }
      }
      // Lanjut ronde berikutnya (karena butuh LLM evaluasi tool result)
      continue;
    }

    // Tidak ada tool calls, berarti LLM sudah memberikan final response
    if (assistantContent.trim()) {
      return;
    }

    // Fallback jika kosong
    yield "Maaf, saya tidak bisa memproses pertanyaan Anda saat ini.";
    return;
  }

  yield "Mohon maaf, proses terlalu panjang. Silakan coba pertanyaan yang lebih spesifik.";
}

