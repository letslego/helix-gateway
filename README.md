# @letslego/helix-gateway

Local-first **AI Gateway** for the Helix ecosystem.

- Intent-based model routing
- Fallback chains across providers
- OpenAI-compatible + mock adapters
- Estimated token/cost accounting

```bash
npm install @letslego/helix-gateway
```

```ts
import { HelixGateway, defineGateway } from "@letslego/helix-gateway";

const gateway = new HelixGateway({
  gateway: defineGateway({
    defaultModel: "mock/helix-demo",
    routes: { research: "openai/gpt-4.1-mini" },
  }),
  fallbackModels: ["anthropic/claude-sonnet"],
  provider: { mock: true },
});

const res = await gateway.complete({
  messages: [{ role: "user", content: "research Paris" }],
});
```

## Ecosystem

| Package | Role |
| --- | --- |
| [@letslego/helix](https://github.com/letslego/helix) | Agent framework |
| [@letslego/helix-workflow](https://github.com/letslego/helix-workflow) | Durable workflows |
| [@letslego/helix-gateway](https://github.com/letslego/helix-gateway) | AI Gateway |
| [@letslego/helix-sandbox](https://github.com/letslego/helix-sandbox) | Isolated compute |
| [@letslego/helix-connect](https://github.com/letslego/helix-connect) | Credential brokering |
| [@letslego/helix-channels](https://github.com/letslego/helix-channels) | Delivery surfaces |

Overview: https://letslego.github.io/helix-ecosystem/


## License

Apache-2.0 © LetsLego
