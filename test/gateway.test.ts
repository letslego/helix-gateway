import assert from "node:assert/strict";
import { test } from "node:test";
import { HelixGateway, defineGateway } from "../src/index.js";

test("routes by intent", async () => {
  const gw = new HelixGateway({
    model: "mock/helix-demo",
    fallbackModels: ["openai/gpt-4.1-mini"],
    gateway: defineGateway({ defaultModel: "mock/helix-demo", routes: { weather: "mock/helix-demo" } }),
    provider: { mock: true },
  });
  const routed = gw.resolve("weather in Paris");
  assert.equal(routed.reason, "route:weather");
  const res = await gw.complete({ messages: [{ role: "user", content: "hi" }] });
  assert.ok(res.content.includes("Gateway mock"));
});
