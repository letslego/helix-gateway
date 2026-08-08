import { completeWithFallback } from "./provider.js";
import type {
  ChatMessage,
  GatewayConfig,
  GatewayOptions,
  ProviderConfig,
  TokenUsage,
  ToolDescriptor,
} from "./types.js";

export type * from "./types.js";
export {
  complete,
  completeWithFallback,
  type ModelRequest,
  type ModelResponse,
} from "./provider.js";

export interface GatewayRouteResult {
  model: string;
  reason: string;
  chain: string[];
}

export interface GatewayRequest {
  messages: ChatMessage[];
  tools?: ToolDescriptor[];
  temperature?: number;
  routeText?: string;
}

export interface GatewayResponse {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage: TokenUsage;
  modelUsed: string;
  routed: GatewayRouteResult;
}

/** Local-first AI Gateway: intent routes + fallback chains + providers. */
export class HelixGateway {
  constructor(private config: GatewayOptions, private provider?: ProviderConfig) {}

  getConfig(): GatewayConfig {
    return this.config.gateway ?? {
      defaultModel: this.config.model ?? "mock/helix-demo",
      routes: {},
    };
  }

  resolve(text: string): GatewayRouteResult {
    const gateway = this.getConfig();
    const lower = text.toLowerCase();
    for (const [keyword, model] of Object.entries(gateway.routes ?? {})) {
      if (lower.includes(keyword.toLowerCase())) {
        return { model, reason: `route:${keyword}`, chain: modelChain(model, this.config) };
      }
    }
    const model = gateway.defaultModel ?? this.config.model ?? "mock/helix-demo";
    return { model, reason: "default", chain: modelChain(model, this.config) };
  }

  async complete(request: GatewayRequest): Promise<GatewayResponse> {
    const lastUser =
      request.routeText ??
      [...request.messages].reverse().find((m) => m.role === "user")?.content ??
      "";
    const routed = this.resolve(lastUser);
    const response = await completeWithFallback(
      routed.chain,
      {
        messages: request.messages,
        tools: request.tools ?? [],
        temperature: request.temperature ?? this.config.temperature ?? 0.2,
      },
      this.provider ?? this.config.provider ?? { mock: true },
    );
    return { ...response, routed };
  }
}

export function modelChain(primary: string, config: GatewayOptions): string[] {
  return [primary, ...(config.fallbackModels ?? []).filter((m) => m !== primary)];
}

export function defineGateway(config: GatewayConfig): GatewayConfig {
  return { defaultModel: config.defaultModel ?? "mock/helix-demo", routes: config.routes ?? {} };
}

export function resolveModel(message: string, config: GatewayOptions) {
  const routed = new HelixGateway(config).resolve(message);
  return { model: routed.model, reason: routed.reason };
}
