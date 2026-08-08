export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
}

export interface ProviderConfig {
  baseUrl?: string;
  apiKeyEnv?: string;
  mock?: boolean;
}

export interface GatewayConfig {
  routes?: Record<string, string>;
  defaultModel?: string;
}

export interface GatewayOptions {
  model?: string;
  fallbackModels?: string[];
  temperature?: number;
  provider?: ProviderConfig;
  gateway?: GatewayConfig;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface ToolDescriptor {
  name: string;
  description: string;
}
