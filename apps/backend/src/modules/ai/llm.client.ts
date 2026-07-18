import { env } from "../../config/env";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface LlmToolMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

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

interface LlmResponse {
  choices: LlmResponseChoice[];
}

/**
 * Standard chat completion — returns plain text.
 */
export async function generateChatCompletion(
  messages: LlmMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const result = await generateChatCompletionRaw(messages, options);
  return result.content ?? "";
}

/**
 * Chat completion dengan tool calling support.
 * Returns full response message (content + tool_calls if any).
 */
export async function generateChatCompletionWithTools(
  messages: Array<LlmMessage | LlmToolMessage>,
  tools?: LlmToolDefinition[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string | null; tool_calls: LlmResponseChoice["message"]["tool_calls"] }> {
  const result = await generateChatCompletionRaw(messages, options, tools);
  return result;
}

async function generateChatCompletionRaw(
  messages: Array<LlmMessage | LlmToolMessage>,
  options?: { temperature?: number; maxTokens?: number },
  tools?: LlmToolDefinition[]
): Promise<{ content: string | null; tool_calls: LlmResponseChoice["message"]["tool_calls"] }> {
  const body: Record<string, unknown> = {
    model: env.llmModel,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llmApiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as LlmResponse;
  const message = data.choices?.[0]?.message;

  if (!message) {
    throw new Error("LLM returned empty response");
  }

  return {
    content: message.content ?? null,
    tool_calls: message.tool_calls,
  };
}
