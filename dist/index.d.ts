import type { ChatMessage, GatewayConfig, GatewayOptions, ProviderConfig, TokenUsage, ToolDescriptor } from "./types.js";
export type * from "./types.js";
export { complete, completeWithFallback, type ModelRequest, type ModelResponse, } from "./provider.js";
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
    toolCalls: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
    usage: TokenUsage;
    modelUsed: string;
    routed: GatewayRouteResult;
}
/** Local-first AI Gateway: intent routes + fallback chains + providers. */
export declare class HelixGateway {
    private config;
    private provider?;
    constructor(config: GatewayOptions, provider?: ProviderConfig | undefined);
    getConfig(): GatewayConfig;
    resolve(text: string): GatewayRouteResult;
    complete(request: GatewayRequest): Promise<GatewayResponse>;
}
export declare function modelChain(primary: string, config: GatewayOptions): string[];
export declare function defineGateway(config: GatewayConfig): GatewayConfig;
export declare function resolveModel(message: string, config: GatewayOptions): {
    model: string;
    reason: string;
};
//# sourceMappingURL=index.d.ts.map