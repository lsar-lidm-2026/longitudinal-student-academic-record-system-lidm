/**
 * Chatbot Controller — REST endpoints untuk chatbot AI asisten LSAR.
 * ==================================================================
 *
 * Cara Kerja:
 * 1. Semua endpoint dilindungi oleh middleware `requireAuth` (JWT).
 * 2. Endpoint POST /chatbot/message menerima pesan user dan riwayat percakapan.
 * 3. Pesan diteruskan ke `chatbot.service.processMessage()` yang menangani
 *    multi-turn conversation dengan tool calling ke LLM.
 * 4. Endpoint GET /chatbot/tools mengembalikan daftar tools yang tersedia untuk debugging.
 * 5. Response dikembalikan dalam format standar `{ success, data }`.
 *
 * Alur Lengkap (POST /message):
 * 1. Client mengirim POST request dengan body { message, history? }.
 * 2. Middleware `requireAuth` memverifikasi JWT token.
 * 3. Validasi body menggunakan Elysia t.Object (message wajib, history opsional).
 * 4. Controller memanggil `processMessage(user, message, history)`.
 * 5. Service menangani percakapan multi-turn dengan LLM (max 5 rounds tool calling).
 * 6. Controller mengembalikan response { reply: string }.
 *
 * Endpoints:
 * - POST /chatbot/message   — Kirim pesan ke chatbot AI
 * - GET  /chatbot/tools     — Lihat daftar tools yang tersedia (debug/info)
 */
import { Elysia, t } from "elysia";               // Elysia web framework + validation
import { requireAuth } from "../../middleware/auth"; // JWT auth middleware
import { processMessage, processMessageStream } from "./chatbot.service";   // Chatbot business logic
import { success, error as errorResponse } from "../../common/response"; // Standar response formatter
import logger from "../../lib/logger";                  // Pino logger instance

/**
 * ChatbotController — instance Elysia dengan prefix "/chatbot".
 *
 * Semua route di grup ini membutuhkan autentikasi JWT.
 * Hanya menyediakan dua endpoint: kirim pesan dan lihat tools.
 */
export const chatbotController = new Elysia({ prefix: "/chatbot" })
  .use(requireAuth)

  /**
   * POST /chatbot/message
   *
   * Menerima pesan dari user, memprosesnya melalui LLM dengan tool calling.
   * Mendukung riwayat percakapan multi-turn (history array).
   *
   * @param body.message - Pesan teks dari user (min 1 karakter)
   * @param body.history - Riwayat percakapan sebelumnya (opsional, array of {role, content})
   * @param user         - JwtPayload dari middleware auth (termasuk id, name, role)
   * @returns            - { reply: string } — Balasan dari AI
   */
  .post(
    "/message",
    async ({ body, user }) => {
      logger.info({ userId: user.userId, role: user.role, messageLength: body.message.length, historyLength: body.history?.length }, "Chatbot controller: processing message");
      try {
        // Panggil service untuk memproses pesan melalui LLM dengan tool calling
        const result = await processMessage(user, body.message, body.history || []);
        logger.info({ userId: user.userId, replyLength: result.reply.length }, "Chatbot controller: message processed successfully");
        return success(result);
      } catch (e: any) {
        // Tangkap error dari service layer (AI error, timeout, dll)
        logger.error({ err: e, userId: user.userId }, "Chatbot controller: message processing failed");
        return errorResponse("CHATBOT_ERROR", e.message || "Gagal memproses pesan");
      }
    },
    {
      // Validasi body menggunakan Elysia t.Object
      body: t.Object({
        message: t.String({ minLength: 1 }),         // Pesan user, wajib, minimal 1 karakter
        history: t.Optional(                          // Riwayat percakapan, opsional
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]), // Peran: user atau assistant
              content: t.String(),                                         // Isi pesan
            })
          )
        ),
      }),
    }
  )

  /**
   * POST /chatbot/stream
   * 
   * Endpoint yang mendukung Server-Sent Events (SSE) streaming.
   */
  .post(
    "/stream",
    ({ body, user }) => {
      logger.info({ userId: user.userId, role: user.role, messageLength: body.message.length }, "Chatbot controller: processing stream message");
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = processMessageStream(user, body.message, body.history || []);
            for await (const chunk of generator) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          } catch (e: any) {
            logger.error({ err: e, userId: user.userId }, "Chatbot controller: stream processing failed");
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: e.message || "Gagal memproses pesan" })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1 }),
        history: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]),
              content: t.String(),
            })
          )
        ),
      }),
    }
  )

  /**
   * GET /chatbot/tools
   *
   * Mengembalikan daftar tools yang tersedia untuk chatbot.
   * Berguna untuk debugging dan informasi.
   *
   * @returns - { tools: Array<{ name, description }> }
   */
  .get("/tools", async () => {
    logger.info("Chatbot controller: listing available tools");
    // Dynamic import untuk menghindari circular dependency
    const { CHATBOT_TOOLS } = await import("./chatbot.tools");
    // Mapping tools hanya mengambil name dan description (tidak termasuk parameters)
    const tools = CHATBOT_TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
    }));
    logger.info({ toolCount: tools.length }, "Chatbot controller: tools listed successfully");
    return success({ tools });
  });
