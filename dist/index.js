import { completeWithFallback } from "./provider.js";
export { complete, completeWithFallback, } from "./provider.js";
/** Local-first AI Gateway: intent routes + fallback chains + providers. */
export class HelixGateway {
    config;
    provider;
    constructor(config, provider) {
        this.config = config;
        this.provider = provider;
    }
    getConfig() {
        return this.config.gateway ?? {
            defaultModel: this.config.model ?? "mock/helix-demo",
            routes: {},
        };
    }
    resolve(text) {
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
    async complete(request) {
        const lastUser = request.routeText ??
            [...request.messages].reverse().find((m) => m.role === "user")?.content ??
            "";
        const routed = this.resolve(lastUser);
        const response = await completeWithFallback(routed.chain, {
            messages: request.messages,
            tools: request.tools ?? [],
            temperature: request.temperature ?? this.config.temperature ?? 0.2,
        }, this.provider ?? this.config.provider ?? { mock: true });
        return { ...response, routed };
    }
}
export function modelChain(primary, config) {
    return [primary, ...(config.fallbackModels ?? []).filter((m) => m !== primary)];
}
export function defineGateway(config) {
    return { defaultModel: config.defaultModel ?? "mock/helix-demo", routes: config.routes ?? {} };
}
export function resolveModel(message, config) {
    const routed = new HelixGateway(config).resolve(message);
    return { model: routed.model, reason: routed.reason };
}
//# sourceMappingURL=index.js.map