import type { ChatMessage, ProviderConfig, TokenUsage, ToolDescriptor } from "./types.js";
export interface ModelRequest {
    model: string;
    messages: ChatMessage[];
    tools: ToolDescriptor[];
    temperature: number;
}
export interface ModelResponse {
    content: string;
    toolCalls: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
    usage: TokenUsage;
    modelUsed: string;
}
export declare function completeWithFallback(models: string[], request: Omit<ModelRequest, "model">, provider: ProviderConfig): Promise<ModelResponse>;
export declare function complete(request: ModelRequest, provider: ProviderConfig): Promise<ModelResponse>;
//# sourceMappingURL=provider.d.ts.map