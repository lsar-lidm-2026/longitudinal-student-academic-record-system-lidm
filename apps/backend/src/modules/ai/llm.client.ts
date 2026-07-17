import { env } from "../../config/env";

interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LlmResponse {
  choices: { message: { content: string } }[];
}

/**
 * Client untuk LLM API dengan format OpenAI-compatible.
 * Support custom endpoint (OpenAI, Gemini via proxy, atau LLM lokal).
 */
export async function generateChatCompletion(
  messages: LlmMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llmApiKey}`,
    },
    body: JSON.stringify({
      model: env.llmModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as LlmResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return content.trim();
}
