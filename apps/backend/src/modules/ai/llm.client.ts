/**
 * LLM Client
 * ===========
 * Cara Kerja:
 *   1. HTTP client untuk OpenAI-compatible Chat Completions API.
 *   2. Membaca konfigurasi dari env: llmBaseUrl, llmApiKey, llmModel.
 *   3. Tiga public function:
 *      - `generateChatCompletion` — chat biasa, return plain text content.
 *      - `generateChatCompletionWithTools` — chat dengan tool calling,
 *        return object { content, tool_calls }.
 *      - `generateChatStreamWithTools` — streaming chat dengan tool calling,
 *        yield string chunks, return { tool_calls } jika ada.
 *   4. Internal `generateChatCompletionRaw`:
 *      - Membangun request body (model, messages, temperature, max_tokens, stream: false, tools opsional)
 *      - HTTP POST ke `${llmBaseUrl}/chat/completions` dengan timeout 30 detik
 *      - Fallback: jika API memaksa streaming meski stream: false,
 *        parse SSE (Server-Sent Events) chunks manual (lines 103-147)
 *      - Parse JSON response (normal), validasi choices[0].message
 *   5. `generateChatStreamWithTools`:
 *      - Streaming dengan `stream: true`, yield setiap delta content
 *      - Parse tool_calls dari delta secara incremental (akumulasi arguments)
 *      - Return { tool_calls } setelah stream selesai jika ada tool calls
 *
 * Alur Lengkap:
 *   Caller → generateChatCompletion / generateChatCompletionWithTools
 *     → generateChatCompletionRaw (non-streaming)
 *     → build body → fetch → parse JSON / SSE fallback → return content & tool_calls
 *
 *   Caller → generateChatStreamWithTools (streaming)
 *     → build body (stream: true) → fetch → ReadableStream reader
 *     → parse SSE chunks → yield delta content → return { tool_calls }
 *
 * Types:
 *   - LlmMessage        : pesan system/user/assistant (dengan optional tool_calls)
 *   - LlmToolMessage    : hasil eksekusi tool (role: "tool")
 *   - LlmToolDefinition : definisi tool untuk dikirim ke API (OpenAI function calling format)
 */

import { env } from "../../config/env";
import logger from "../../lib/logger";

/**
 * Interface untuk pesan standar chat completion.
 * role: "system" | "user" | "assistant"
 * content: teks pesan
 * tool_calls: opsional, daftar panggilan tool dari assistant
 */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

/**
 * Interface untuk hasil eksekusi tool.
 * role: "tool"
 * content: hasil yang dikembalikan oleh tool
 * tool_call_id: ID dari tool_call yang dipanggil (untuk mencocokkan response)
 */
export interface LlmToolMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

/**
 * Interface untuk mendefinisikan tool yang tersedia bagi LLM.
 * Mengikuti format OpenAI function calling.
 */
export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Internal: satu choice dari response LLM (non-streaming).
 * Berisi message (content + optional tool_calls) dan finish_reason.
 */
interface LlmResponseChoice {
  message: {
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason: string;
}

/**
 * Internal: struktur response dari LLM API (non-streaming).
 * Berisi array of choices.
 */
interface LlmResponse {
  choices: LlmResponseChoice[];
}

/**
 * Standard chat completion — returns plain text.
 *
 * @param messages — Array pesan (system, user, assistant)
 * @param options — Suhu (temperature) dan max token (maxTokens)
 * @returns string — Konten teks dari response LLM (atau empty string jika null)
 */
export async function generateChatCompletion(
  messages: LlmMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  // Delegasi ke raw function, ambil content saja
  const result = await generateChatCompletionRaw(messages, options);
  return result.content ?? "";
}

/**
 * Chat completion dengan tool calling support.
 * Returns full response message (content + tool_calls if any).
 *
 * @param messages — Array pesan termasuk tool results
 * @param tools — Array definisi tool yang tersedia
 * @param options — Suhu dan max token opsional
 * @returns { content, tool_calls } — Response lengkap dari LLM
 */
export async function generateChatCompletionWithTools(
  messages: Array<LlmMessage | LlmToolMessage>,
  tools?: LlmToolDefinition[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string | null; tool_calls: LlmResponseChoice["message"]["tool_calls"] }> {
  // Delegasi ke raw function dengan parameter tools
  const result = await generateChatCompletionRaw(messages, options, tools);
  return result;
}

/**
 * Internal raw function untuk memanggil LLM Chat Completions API (non-streaming).
 * Membangun request, melakukan HTTP fetch, mem-parse response.
 * Fallback: jika API memaksa streaming meski stream: false,
 * parse SSE (Server-Sent Events) chunks secara manual.
 *
 * @param messages — Array pesan (LlmMessage | LlmToolMessage)
 * @param options — Suhu dan max token opsional
 * @param tools — Tool definitions opsional (untuk function calling)
 * @returns { content, tool_calls } — Response ter-parse
 * @throws Error jika HTTP error, parse error, atau response kosong
 */
async function generateChatCompletionRaw(
  messages: Array<LlmMessage | LlmToolMessage>,
  options?: { temperature?: number; maxTokens?: number },
  tools?: LlmToolDefinition[]
): Promise<{ content: string | null; tool_calls: LlmResponseChoice["message"]["tool_calls"] }> {
  // Bangun request body — hanya set field yang diperlukan
  const body: Record<string, unknown> = {
    model: env.llmModel,                       // Model dari environment variable
    messages,                                   // Array pesan percakapan
    temperature: options?.temperature ?? 0.7,   // Default suhu 0.7
    max_tokens: options?.maxTokens ?? 2048,     // Default max 2048 token
    stream: false,                              // Force disable streaming
  };

  // Jika ada tool definitions, tambahkan ke body
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto"; // Biarkan LLM memutuskan tool mana yang dipakai
  }

  logger.debug(
    { model: env.llmModel, messageCount: messages.length, hasTools: !!(tools && tools.length > 0) },
    "generateChatCompletionRaw — sending request to LLM"
  );

  // HTTP POST ke endpoint Chat Completions
  const response = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llmApiKey}`, // API Key untuk autentikasi
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000), // Timeout 30 detik
  });

  // Baca raw response sebagai text (untuk logging jika error atau SSE fallback)
  const rawText = await response.text();

  // Jika HTTP status tidak OK, throw error dengan detail
  if (!response.ok) {
    logger.error({ status: response.status, rawText: rawText.substring(0, 500) }, "LLM API returned error status");
    throw new Error(`LLM API error (${response.status}): ${rawText}`);
  }

  // Fallback: Jika API memaksa stream (SSE) meski stream: false, parse SSE chunks manual
  // Ciri: response dimulai dengan "data: " (Server-Sent Events format)
  if (rawText.trim().startsWith("data: ")) {
    logger.warn("LLM API returned SSE stream despite stream:false — parsing chunks manually");
    let finalContent = "";                                      // Akumulasi content dari delta
    const toolCallsMap = new Map<number, any>();                 // Map index → tool_call partial

    // Split response per line, parse setiap SSE chunk
    const lines = rawText.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip jika bukan data: atau marker [DONE]
      if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;

      try {
        // Ambil JSON setelah prefix "data: "
        const chunk = JSON.parse(trimmed.slice(6));
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        // Akumulasi content text
        if (delta.content) {
          finalContent += delta.content;
        }

        // Akumulasi tool_calls (arguments bisa datang dalam beberapa chunk)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsMap.has(tc.index)) {
              // First chunk untuk tool call ini — buat entry baru
              toolCallsMap.set(tc.index, {
                id: tc.id,
                type: tc.type || "function",
                function: { name: tc.function?.name || "", arguments: tc.function?.arguments || "" }
              });
            } else {
              // Chunk lanjutan — append arguments
              const existing = toolCallsMap.get(tc.index);
              if (tc.function?.arguments) {
                existing.function.arguments += tc.function.arguments;
              }
            }
          }
        }
      } catch (e) {
        // Abaikan parse error untuk chunk individual — tetap lanjut ke line berikutnya
        logger.debug({ err: e, line: trimmed.substring(0, 200) }, "Failed to parse SSE chunk");
      }
    }

    // Konversi Map ke array jika ada tool calls
    const tool_calls = toolCallsMap.size > 0 ? Array.from(toolCallsMap.values()) : undefined;
    logger.debug(
      { contentLength: finalContent.length, toolCallCount: tool_calls?.length ?? 0 },
      "SSE fallback parsed successfully"
    );
    return {
      content: finalContent.length > 0 ? finalContent : null,
      tool_calls
    };
  }

  // Normal path: Parse JSON response (non-streaming)
  let data: LlmResponse;
  try {
    data = JSON.parse(rawText) as LlmResponse;
  } catch (err: any) {
    logger.error({ err, rawText: rawText.substring(0, 500) }, "Failed to parse LLM API response JSON");
    throw new Error(`LLM API parsing error: Failed to parse JSON. Raw response: ${rawText.substring(0, 500)}...`);
  }

  // Ambil message dari choice pertama
  const message = data.choices?.[0]?.message;

  // Validasi: harus ada message
  if (!message) {
    logger.error({ data }, "LLM returned empty response — no message in choices[0]");
    throw new Error("LLM returned empty response");
  }

  logger.debug(
    { contentLength: message.content?.length ?? 0, hasToolCalls: !!(message.tool_calls && message.tool_calls.length > 0) },
    "generateChatCompletionRaw — LLM response received successfully"
  );

  // Return content (bisa null) dan tool_calls (bisa undefined)
  return {
    content: message.content ?? null,
    tool_calls: message.tool_calls,
  };
}

/**
 * Chat completion streaming dengan tool calling support.
 * AsyncGenerator yang yield string chunks (delta content) dan
 * return { tool_calls } setelah stream selesai jika ada tool calls.
 *
 * Karena tool calling saat streaming lebih kompleks (arguments dikirim
 * dalam beberapa chunk), implementasi ini mengakumulasi arguments
 * secara incremental menggunakan Map<index, partial>.
 *
 * @param messages — Array pesan termasuk tool results
 * @param tools — Array definisi tool yang tersedia
 * @param options — Suhu dan max token opsional
 * @yields string — Setiap delta content chunk
 * @returns { tool_calls } — Array tool calls lengkap jika ada, atau void
 * @throws Error jika HTTP error atau tidak ada response body
 */
export async function* generateChatStreamWithTools(
  messages: Array<LlmMessage | LlmToolMessage>,
  tools?: LlmToolDefinition[],
  options?: { temperature?: number; maxTokens?: number }
): AsyncGenerator<string, { tool_calls?: LlmResponseChoice["message"]["tool_calls"] } | void, unknown> {
  // Bangun request body dengan stream: true
  const body: Record<string, unknown> = {
    model: env.llmModel,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
    stream: true,                              // Enable streaming
  };

  // Jika ada tool definitions, tambahkan
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  logger.debug(
    { model: env.llmModel, messageCount: messages.length, hasTools: !!(tools && tools.length > 0) },
    "generateChatStreamWithTools — starting streaming request"
  );

  // HTTP POST dengan streaming
  const response = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llmApiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000), // Timeout lebih panjang untuk stream (60 detik)
  });

  // Jika HTTP error
  if (!response.ok) {
    const rawText = await response.text();
    logger.error({ status: response.status, rawText: rawText.substring(0, 500) }, "LLM API stream error");
    throw new Error(`LLM API stream error (${response.status}): ${rawText}`);
  }

  // Validasi response.body harus ada
  if (!response.body) {
    throw new Error("No response body for stream");
  }

  // Setup ReadableStream reader dan decoder
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";                              // Buffer untuk akumulasi partial lines

  // Map untuk akumulasi tool_calls arguments (key: index)
  const toolCallsMap = new Map<number, any>();
  let hasYieldedText = false;                   // Flag apakah sudah pernah yield content

  try {
    // Loop baca stream sampai selesai
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;                          // Stream selesai

      // Decode chunk dan tambahkan ke buffer
      buffer += decoder.decode(value, { stream: true });
      // Split per line, sisakan partial line terakhir di buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      // Proses setiap line (SSE format: "data: {...}")
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;

        try {
          // Parse JSON dari SSE data
          const chunk = JSON.parse(trimmed.slice(6));
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          // Jika ada tool calls dari LLM (saat streaming)
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallsMap.has(tc.index)) {
                // First chunk untuk tool call ini
                toolCallsMap.set(tc.index, {
                  id: tc.id,
                  type: tc.type || "function",
                  function: { name: tc.function?.name || "", arguments: tc.function?.arguments || "" },
                });
              } else {
                // Chunk lanjutan — append arguments
                const existing = toolCallsMap.get(tc.index);
                if (tc.function?.arguments) {
                  existing.function.arguments += tc.function.arguments;
                }
              }
            }
          }

          // Jika ada content (text) — yield ke consumer
          if (delta.content) {
            hasYieldedText = true;
            yield delta.content;
          }
        } catch (e) {
          // Abaikan parse error untuk chunk individual
          logger.debug({ err: e, line: trimmed.substring(0, 200) }, "Failed to parse SSE stream chunk");
        }
      }
    }
  } finally {
    // Pastikan reader direlease meski ada error
    reader.releaseLock();
  }

  logger.debug(
    { hasYieldedText, toolCallCount: toolCallsMap.size },
    "generateChatStreamWithTools — stream complete"
  );

  // Jika ada tool calls, return sebagai return value generator
  if (toolCallsMap.size > 0) {
    return { tool_calls: Array.from(toolCallsMap.values()) };
  }
}
