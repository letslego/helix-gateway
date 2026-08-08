import type { ChatMessage, ProviderConfig, TokenUsage, ToolDescriptor } from "./types.js";

export interface ModelRequest {
  model: string;
  messages: ChatMessage[];
  tools: ToolDescriptor[];
  temperature: number;
}

export interface ModelResponse {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage: TokenUsage;
  modelUsed: string;
}

const COST: Record<string, { in: number; out: number }> = {
  "mock/helix-demo": { in: 0, out: 0 },
  "openai/gpt-4.1-mini": { in: 0.0004, out: 0.0016 },
};

function estimate(model: string, p: number, c: number) {
  const r = COST[model] ?? { in: 0.001, out: 0.003 };
  return (p / 1000) * r.in + (c / 1000) * r.out;
}

export async function completeWithFallback(
  models: string[],
  request: Omit<ModelRequest, "model">,
  provider: ProviderConfig,
): Promise<ModelResponse> {
  const errors: string[] = [];
  for (const model of models) {
    try {
      return await complete({ ...request, model }, provider);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

export async function complete(request: ModelRequest, provider: ProviderConfig): Promise<ModelResponse> {
  if (provider.mock || request.model.startsWith("mock/")) {
    const last = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return {
      content: `Gateway mock reply to: ${last.slice(0, 120)}`,
      toolCalls: [],
      usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60, estimatedCostUsd: 0 },
      modelUsed: request.model,
    };
  }
  const apiKeyEnv = provider.apiKeyEnv ?? "OPENAI_API_KEY";
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) throw new Error(`Missing API key in env ${apiKeyEnv}`);
  const baseUrl = (provider.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: request.model.replace(/^openai\//, ""),
      temperature: request.temperature,
      messages: request.messages,
      tools: request.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: { type: "object" } },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Provider HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json() as any;
  const message = json.choices?.[0]?.message;
  const prompt = json.usage?.prompt_tokens ?? 1;
  const completion = json.usage?.completion_tokens ?? 1;
  return {
    content: message?.content ?? "",
    toolCalls: (message?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    })),
    usage: {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: prompt + completion,
      estimatedCostUsd: estimate(request.model, prompt, completion),
    },
    modelUsed: request.model,
  };
}
