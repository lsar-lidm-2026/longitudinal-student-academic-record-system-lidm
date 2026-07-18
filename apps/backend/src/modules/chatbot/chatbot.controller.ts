import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import { processMessage } from "./chatbot.service";
import { success, error as errorResponse } from "../../common/response";

export const chatbotController = new Elysia({ prefix: "/chatbot" })
  .use(requireAuth)
  .post(
    "/message",
    async ({ body, user }) => {
      try {
        const result = await processMessage(user, body.message, body.history || []);
        return success(result);
      } catch (e: any) {
        console.error("[Chatbot] Error:", e.message);
        return errorResponse("CHATBOT_ERROR", e.message || "Gagal memproses pesan");
      }
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
  .get("/tools", async () => {
    // Return available tools (for debugging/info)
    const { CHATBOT_TOOLS } = await import("./chatbot.tools");
    return success({
      tools: CHATBOT_TOOLS.map((t) => ({
        name: t.function.name,
        description: t.function.description,
      })),
    });
  });
