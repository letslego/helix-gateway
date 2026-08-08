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

const COST_PER_1K: Record<string, { in: number; out: number }> = {
  "mock/helix-demo": { in: 0, out: 0 },
  "openai/gpt-4.1-mini": { in: 0.0004, out: 0.0016 },
  "openai/gpt-4.1": { in: 0.002, out: 0.008 },
  "anthropic/claude-sonnet": { in: 0.003, out: 0.015 },
};

function estimateCost(model: string, prompt: number, completion: number): number {
  const rates = COST_PER_1K[model] ?? { in: 0.001, out: 0.003 };
  return (prompt / 1000) * rates.in + (completion / 1000) * rates.out;
}

function roughTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
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

export async function complete(
  request: ModelRequest,
  provider: ProviderConfig,
): Promise<ModelResponse> {
  if (provider.mock || request.model.startsWith("mock/")) {
    return mockComplete(request);
  }

  const apiKeyEnv = provider.apiKeyEnv ?? "OPENAI_API_KEY";
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing API key in env ${apiKeyEnv}`);
  }

  const baseUrl = (provider.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const body = {
    model: request.model.replace(/^openai\//, ""),
    temperature: request.temperature,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    })),
    tools: request.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToRoughJsonSchema(t),
      },
    })),
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Provider HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices: Array<{
      message: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const message = json.choices[0]?.message;
  const promptTokens = json.usage?.prompt_tokens ?? roughTokens(JSON.stringify(request.messages));
  const completionTokens =
    json.usage?.completion_tokens ?? roughTokens(message?.content ?? "");
  const totalTokens = json.usage?.total_tokens ?? promptTokens + completionTokens;

  return {
    content: message?.content ?? "",
    toolCalls: (message?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
    })),
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateCost(request.model, promptTokens, completionTokens),
    },
    modelUsed: request.model,
  };
}

function zodToRoughJsonSchema(tool: ToolDescriptor): Record<string, unknown> {
  // Keep schema export light; Zod shapes are validated at execute time.
  return {
    type: "object",
    additionalProperties: true,
    description: tool.description,
  };
}

function mockComplete(request: ModelRequest): ModelResponse {
  const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content.toLowerCase() ?? "";
  const toolNames = new Set(request.tools.map((t) => t.name));

  // After tools have returned, craft a helpful summary (must run before
  // intent matching, or demos will loop on the original user text).
  const toolResults = request.messages.filter((m) => m.role === "tool");
  if (toolResults.length > 0) {
    const snippets = toolResults.map((m) => m.content).join("\n");
    return {
      content: craftSummary(snippets, lastUser?.content ?? ""),
      toolCalls: [],
      usage: usageFor(request, 160, 90),
      modelUsed: request.model,
    };
  }

  // Deterministic demo behavior for travel agent and weather examples.
  if (toolNames.has("search_flights") && /trip|flight|travel|paris|tokyo|rome/.test(text)) {
    const city =
      text.includes("tokyo") ? "Tokyo" : text.includes("rome") ? "Rome" : "Paris";
    return {
      content: "",
      toolCalls: [
        {
          id: "call_flights",
          name: "search_flights",
          arguments: { destination: city, cabin: "economy" },
        },
        {
          id: "call_weather",
          name: "get_weather",
          arguments: { city },
        },
      ],
      usage: usageFor(request, 120, 40),
      modelUsed: request.model,
    };
  }

  if (toolNames.has("get_weather") && /weather|forecast|temperature/.test(text)) {
    const cityMatch = text.match(/in ([a-z\s]+)/i);
    const city = cityMatch?.[1]?.trim().replace(/\?$/, "") || "San Francisco";
    return {
      content: "",
      toolCalls: [
        {
          id: "call_weather",
          name: "get_weather",
          arguments: { city },
        },
      ],
      usage: usageFor(request, 80, 20),
      modelUsed: request.model,
    };
  }

  return {
    content:
      "I'm Helix's demo model. Ask me about weather or planning a trip, and I'll use tools to help.",
    toolCalls: [],
    usage: usageFor(request, 60, 30),
    modelUsed: request.model,
  };
}

function usageFor(request: ModelRequest, prompt: number, completion: number): TokenUsage {
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: prompt + completion,
    estimatedCostUsd: estimateCost(request.model, prompt, completion),
  };
}

function craftSummary(toolJson: string, userText: string): string {
  try {
    const blocks = toolJson
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];

    const weather = blocks.find((b) => "temperatureF" in b || "condition" in b);
    const flights = blocks.find((b) => Array.isArray(b.options));

    if (flights && weather) {
      const options = flights.options as Array<Record<string, unknown>>;
      const top = options[0];
      return [
        `Here's a concise plan based on your request (“${userText.trim()}”).`,
        "",
        `Weather in ${weather.city}: ${weather.condition}, ${weather.temperatureF}°F.`,
        `Top flight option: ${top.airline} ${top.flight} — $${top.priceUsd}, ${top.duration}.`,
        "",
        "I stored this preference in memory so future sessions can reuse it.",
        "Approve any booking tool call before money moves — Helix parks until you decide.",
      ].join("\n");
    }

    if (weather) {
      return `Weather for ${weather.city}: ${weather.condition}, ${weather.temperatureF}°F (mock data).`;
    }
  } catch {
    // fall through
  }
  return `I finished the tool work. Results:\n${toolJson}`;
}
