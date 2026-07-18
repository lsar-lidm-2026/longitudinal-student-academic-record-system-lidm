/**
 * Chatbot Service — menangani percakapan multi-turn dengan tool calling.
 *
 * Flow:
 * 1. User kirim pesan
 * 2. LLM di-call dengan tools
 * 3. Jika LLM request tool calling → eksekusi tool → kirim hasil ke LLM
 * 4. Ulangi sampai LLM memberikan jawaban final (max 5 rounds)
 * 5. Kembalikan jawaban final ke user
 */
import {
  generateChatCompletionWithTools,
  type LlmMessage,
  type LlmToolMessage,
} from "../ai/llm.client";
import { CHATBOT_TOOLS, executeToolCall } from "./chatbot.tools";
import type { JwtPayload } from "../../common/types";

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

const MAX_TOOL_ROUNDS = 5;

interface ChatResult {
  reply: string;
}

export async function processMessage(
  user: JwtPayload,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatResult> {
  // Build message history
  const messages: Array<LlmMessage | LlmToolMessage> = [
    { role: "system", content: SYSTEM_PROMPT + `\n\nUser saat ini: ${user.name} (${user.role})` },
    ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await generateChatCompletionWithTools(messages, [...CHATBOT_TOOLS]);

    // If LLM wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Add assistant message with tool_calls
      messages.push({
        role: "assistant",
        content: response.content ?? "",
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const tc of response.tool_calls) {
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
            content: toolResult.success
              ? toolResult.result
              : `Error: ${toolResult.result}`,
          });
        }
      }

      // Continue loop — LLM will process tool results and either call more tools or give final answer
      continue;
    }

    // LLM gave a final text answer
    const reply = response.content?.trim();
    if (reply) {
      return { reply };
    }

    // Empty reply but no tool calls — should not happen
    return { reply: "Maaf, saya tidak bisa memproses pertanyaan Anda saat ini." };
  }

  // Hit max rounds without final answer
  return {
    reply: "Mohon maaf, proses terlalu panjang. Silakan coba pertanyaan yang lebih spesifik.",
  };
}
