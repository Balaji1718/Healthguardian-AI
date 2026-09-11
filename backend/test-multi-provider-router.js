import assert from "node:assert/strict";
import {
  callProvider,
  getProviderHealth,
  getProviderState,
  providerAvailability,
  PROVIDER_REGISTRY,
  resetProviderStates,
  routeCompletion,
} from "./ai-provider-router.js";

// Ensure mock environment is clean and isolated from ambient production keys
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;

// Ensure mock keys are present for mock router testing
process.env.OPENROUTER_API_KEY = "mock-openrouter-key";
process.env.GROQ_API_KEY = "mock-groq-key";
process.env.NVIDIA_API_KEY = "mock-nvidia-key";
process.env.MISTRAL_API_KEY = "mock-mistral-key";
process.env.SAMBANOVA_API_KEY = "mock-sambanova-key";
process.env.COHERE_API_KEY = "mock-cohere-key";
process.env.CEREBRAS_API_KEY = "mock-cerebras-key";

const request = { messages: [{ role: "user", content: "synthetic multi-provider test" }] };

function mockResponse(content, status = 200) {
  return new Response(typeof content === "string" ? content : JSON.stringify(content), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getProviderIdFromUrl(url) {
  if (url.includes("openrouter.ai")) return "openrouter";
  if (url.includes("groq.com")) return "groq";
  if (url.includes("nvidia.com")) return "nvidia";
  if (url.includes("mistral.ai")) return "mistral";
  if (url.includes("sambanova.ai")) return "sambanova";
  if (url.includes("cohere.com")) return "cohere";
  if (url.includes("cerebras.ai")) return "cerebras";
  if (url.includes("api.openai.com")) return "openai";
  for (const p of PROVIDER_REGISTRY) {
    if (url.includes(p.baseUrl)) return p.id;
  }
  return "unknown";
}

let passCount = 0;
let failCount = 0;

async function runMockTest(testId, description, handler, expectedAsserts) {
  resetProviderStates();
  const calls = [];
  let activeConcurrent = 0;
  let maxConcurrent = 0;

  globalThis.fetch = async (url, options) => {
    const providerId = getProviderIdFromUrl(url);
    calls.push(providerId);
    activeConcurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, activeConcurrent);
    try {
      const callNumberForProvider = calls.filter((c) => c === providerId).length;
      return await handler(providerId, callNumberForProvider, options);
    } finally {
      activeConcurrent -= 1;
    }
  };

  try {
    const result = await expectedAsserts.action();
    if (expectedAsserts.expectedCalls) {
      assert.deepEqual(calls, expectedAsserts.expectedCalls, `${testId}: call sequence mismatch`);
    }
    if ("expectedProvider" in expectedAsserts) {
      assert.equal(result.provider, expectedAsserts.expectedProvider, `${testId}: provider mismatch`);
    }
    if (expectedAsserts.assertFn) {
      expectedAsserts.assertFn(result, calls);
    }
    if (calls.length > 0) {
      assert.equal(maxConcurrent, 1, `${testId}: provider calls must be sequential`);
    }
    console.log(`PASS - ${testId}: ${description} (Calls: ${calls.join(" -> ") || "none"}, Provider: ${result.provider})`);
    passCount += 1;
  } catch (err) {
    console.error(`FAIL - ${testId}: ${description} - ${err.message}`);
    failCount += 1;
    throw err;
  }
}

console.log("Starting Phase 8 Multi-Provider Quota-Aware Router Mock Tests...\n");

// 1. OpenRouter success -> OpenRouter selected, no fallback
await runMockTest(
  "TEST-01",
  "OpenRouter succeeds -> OpenRouter selected without fallback",
  async (provider) =>
    provider === "openrouter"
      ? mockResponse({ choices: [{ message: { content: "openrouter ok" } }] })
      : mockResponse("unexpected", 500),
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter"],
    expectedProvider: "openrouter",
  },
);

// 2. OpenRouter 429 -> Groq succeeds
await runMockTest(
  "TEST-02",
  "OpenRouter 429 (Rate Limit) -> enters cooldown -> routes to Groq",
  async (provider) =>
    provider === "openrouter"
      ? mockResponse("rate limit exceeded", 429)
      : mockResponse({ choices: [{ message: { content: "groq ok" } }] }),
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter", "groq"],
    expectedProvider: "groq",
  },
);

// 3. OpenRouter timeout -> 1 retry -> Groq succeeds
await runMockTest(
  "TEST-03",
  "OpenRouter timeout -> retries once -> routes to Groq",
  async (provider, callNum) => {
    if (provider === "openrouter") {
      const err = new Error("AbortError");
      err.name = "AbortError";
      throw err;
    }
    return mockResponse({ choices: [{ message: { content: "groq ok" } }] });
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter", "openrouter", "groq"],
    expectedProvider: "groq",
  },
);

// 4. Groq 429 -> NVIDIA succeeds
await runMockTest(
  "TEST-04",
  "OpenRouter 503 (2 attempts) -> Groq 429 -> NVIDIA NIM succeeds",
  async (provider) => {
    if (provider === "openrouter") return mockResponse("busy", 503);
    if (provider === "groq") return mockResponse("rate limited", 429);
    if (provider === "nvidia") return mockResponse({ choices: [{ message: { content: "nvidia ok" } }] });
    return mockResponse("unexpected", 500);
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter", "openrouter", "groq", "nvidia"],
    expectedProvider: "nvidia",
  },
);

// 5. NVIDIA quota error -> Mistral succeeds
await runMockTest(
  "TEST-05",
  "OpenRouter 503 -> Groq 503 -> NVIDIA 402 (Quota) -> Mistral succeeds",
  async (provider) => {
    if (provider === "openrouter" || provider === "groq") return mockResponse("error", 500);
    if (provider === "nvidia") return mockResponse("payment required/quota", 402);
    if (provider === "mistral") return mockResponse({ choices: [{ message: { content: "mistral ok" } }] });
    return mockResponse("error", 500);
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter", "openrouter", "groq", "groq", "nvidia", "mistral"],
    expectedProvider: "mistral",
  },
);

// 6. Mistral failure -> SambaNova succeeds
await runMockTest(
  "TEST-06",
  "Prior providers fail -> Mistral 429 -> SambaNova succeeds",
  async (provider) => {
    if (["openrouter", "groq", "nvidia"].includes(provider)) return mockResponse("busy", 503);
    if (provider === "mistral") return mockResponse("rate limit", 429);
    if (provider === "sambanova") return mockResponse({ choices: [{ message: { content: "sambanova ok" } }] });
    return mockResponse("error", 500);
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: [
      "openrouter", "openrouter",
      "groq", "groq",
      "nvidia", "nvidia",
      "mistral",
      "sambanova",
    ],
    expectedProvider: "sambanova",
  },
);

// 7. SambaNova failure -> Cohere succeeds
await runMockTest(
  "TEST-07",
  "Prior providers fail -> SambaNova 429 -> Cohere v2 format succeeds",
  async (provider) => {
    if (["openrouter", "groq", "nvidia", "mistral"].includes(provider)) return mockResponse("busy", 503);
    if (provider === "sambanova") return mockResponse("rate limit", 429);
    if (provider === "cohere") {
      return mockResponse({
        message: { content: [{ type: "text", text: "cohere v2 ok" }] },
        usage: { tokens: { input_tokens: 15, output_tokens: 8 } },
      });
    }
    return mockResponse("error", 500);
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: [
      "openrouter", "openrouter",
      "groq", "groq",
      "nvidia", "nvidia",
      "mistral", "mistral",
      "sambanova",
      "cohere",
    ],
    expectedProvider: "cohere",
    assertFn: (result) => {
      assert.equal(result.content, "cohere v2 ok");
      assert.equal(result.usage?.inputTokens, 15);
    },
  },
);

// 8. Cohere failure -> Cerebras succeeds
await runMockTest(
  "TEST-08",
  "Prior providers fail -> Cohere 429 -> Cerebras succeeds",
  async (provider) => {
    if (["openrouter", "groq", "nvidia", "mistral", "sambanova"].includes(provider)) return mockResponse("error", 500);
    if (provider === "cohere") return mockResponse("rate limit", 429);
    if (provider === "cerebras") return mockResponse({ choices: [{ message: { content: "cerebras ok" } }] });
    return mockResponse("error", 500);
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: [
      "openrouter", "openrouter",
      "groq", "groq",
      "nvidia", "nvidia",
      "mistral", "mistral",
      "sambanova", "sambanova",
      "cohere",
      "cerebras",
    ],
    expectedProvider: "cerebras",
  },
);

// 9. All providers fail -> local fallback
await runMockTest(
  "TEST-09",
  "All providers fail -> returns safe deterministic fallback without unhandled throw",
  async () => mockResponse("service unavailable", 503),
  {
    action: () => routeCompletion(request),
    expectedProvider: null,
    assertFn: (result, calls) => {
      assert.equal(result.ok, false);
      assert.equal(result.fallbackOccurred, true);
      assert.equal(calls.length, 14); // 7 providers * 2 attempts each
    },
  },
);

// 10. Cooldown verification: provider in cooldown is skipped on next request
await runMockTest(
  "TEST-10",
  "Provider entering cooldown is skipped on subsequent routing request",
  async (provider) => {
    if (provider === "openrouter") return mockResponse("quota exceeded", 429);
    return mockResponse({ choices: [{ message: { content: "groq ok" } }] });
  },
  {
    action: async () => {
      // First call puts OpenRouter in cooldown
      const first = await routeCompletion(request);
      assert.equal(first.provider, "groq");

      const stateOpenRouter = getProviderState("openrouter");
      assert.equal(stateOpenRouter.quotaFailuresToday, 1);
      assert.equal(stateOpenRouter.cooldownUntil > Date.now(), true);

      // Second call: OpenRouter should be SKIPPED immediately without any fetch call
      const second = await routeCompletion(request);
      assert.equal(second.provider, "groq");
      return second;
    },
    assertFn: (_result, calls) => {
      // 1st request calls: openrouter, groq. 2nd request calls: groq (openrouter skipped due to cooldown)
      assert.deepEqual(calls, ["openrouter", "groq", "groq"]);
    },
  },
);

// 11. Non-retryable client error (400) -> do not retry same provider, advance to next
await runMockTest(
  "TEST-11",
  "Non-retryable 400 error does not retry the same provider and advances to next",
  async (provider) => {
    if (provider === "openrouter") return mockResponse("bad request schema", 400);
    return mockResponse({ choices: [{ message: { content: "groq ok" } }] });
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter", "groq"],
    expectedProvider: "groq",
  },
);

// 12. Malformed provider response (empty content) -> retries once, then advances
await runMockTest(
  "TEST-12",
  "Malformed empty provider response retries once then advances",
  async (provider) => {
    if (provider === "openrouter") return mockResponse({ choices: [{ message: { content: "" } }] });
    return mockResponse({ choices: [{ message: { content: "groq ok" } }] });
  },
  {
    action: () => routeCompletion(request),
    expectedCalls: ["openrouter", "openrouter", "groq"],
    expectedProvider: "groq",
  },
);

// 13. State reset and success count increment
await runMockTest(
  "TEST-13",
  "Successful completion updates provider state counters correctly",
  async (provider) => mockResponse({ choices: [{ message: { content: "ok" } }] }),
  {
    action: async () => {
      const result = await routeCompletion(request);
      const state = getProviderState("openrouter");
      assert.equal(state.successCount, 1);
      assert.equal(state.consecutiveFailures, 0);
      assert.equal(state.cooldownUntil, 0);
      return result;
    },
    expectedProvider: "openrouter",
  },
);

// 14. Provider health reporting does NOT leak API secrets
await runMockTest(
  "TEST-14",
  "getProviderHealth() returns operational metrics and NEVER leaks secret keys",
  async () => mockResponse({ choices: [{ message: { content: "ok" } }] }),
  {
    action: async () => {
      await routeCompletion(request);
      const health = getProviderHealth();
      assert.equal(health.length, PROVIDER_REGISTRY.length);
      for (const h of health) {
        assert.equal("apiKey" in h, false, `Secret leaked in health for ${h.provider}`);
        assert.equal("authorization" in h, false);
        assert.equal(typeof h.configured, "boolean");
        assert.equal(typeof h.available, "boolean");
      }
      return { provider: "openrouter" };
    },
  },
);

// 15. Provider availability reporting does NOT leak API secrets
await runMockTest(
  "TEST-15",
  "providerAvailability() returns capability and public config without secrets",
  async () => mockResponse({ choices: [{ message: { content: "ok" } }] }),
  {
    action: async () => {
      const avail = providerAvailability();
      assert.equal(avail.length, PROVIDER_REGISTRY.length);
      for (const a of avail) {
        assert.equal("apiKey" in a, false);
        assert.equal(typeof a.configured, "boolean");
        assert.equal(typeof a.supportsToolCalling, "boolean");
        assert.equal(typeof a.supportsStructuredOutput, "boolean");
      }
      return { provider: "openrouter" };
    },
  },
);

// 16. Provider priority ordering matches specification
await runMockTest(
  "TEST-16",
  "Provider priority ordering strictly matches Phase 8 specification",
  async () => mockResponse({ choices: [{ message: { content: "ok" } }] }),
  {
    action: async () => {
      const sorted = [...PROVIDER_REGISTRY].sort((a, b) => a.priority - b.priority);
      const expectedIds = PROVIDER_REGISTRY.some((p) => p.id === "openai")
        ? ["openai", "openrouter", "groq", "nvidia", "mistral", "sambanova", "cohere", "cerebras"]
        : ["openrouter", "groq", "nvidia", "mistral", "sambanova", "cohere", "cerebras"];
      assert.deepEqual(sorted.map((p) => p.id), expectedIds);
      return { provider: "openrouter" };
    },
  },
);

// 17. Single retry limit strictly enforced (never 3 attempts per provider)
await runMockTest(
  "TEST-17",
  "Single retry limit strictly enforced: exactly 2 attempts maximum per provider",
  async () => mockResponse("temporary failure", 503),
  {
    action: () => routeCompletion(request),
    assertFn: (_res, calls) => {
      const countPerProvider = {};
      for (const c of calls) countPerProvider[c] = (countPerProvider[c] || 0) + 1;
      for (const [p, count] of Object.entries(countPerProvider)) {
        assert.equal(count <= 2, true, `Provider ${p} had ${count} calls (> 2)`);
      }
    },
  },
);

// 18. Cohere request adapter builds correct format
await runMockTest(
  "TEST-18",
  "Cohere adapter correctly maps messages and JSON formatting",
  async (provider, _callNum, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, "command-r-plus-08-2024");
    assert.equal(Array.isArray(body.messages), true);
    assert.equal(body.messages[0].role, "user");
    return mockResponse({
      message: { content: [{ type: "text", text: "cohere adapter verified" }] },
    });
  },
  {
    action: () => {
      const cohereProvider = PROVIDER_REGISTRY.find((p) => p.id === "cohere");
      return callProvider(cohereProvider, {
        messages: [{ role: "user", content: "test cohere adapter" }],
        json: true,
      });
    },
    assertFn: (result) => {
      assert.equal(result.ok, true);
      assert.equal(result.content, "cohere adapter verified");
    },
  },
);

globalThis.fetch = fetch;

console.log("\n============================================================");
console.log(`Phase 8 Multi-Provider Router Mock Tests Results`);
console.log(`============================================================`);
console.log(`  PASS: ${passCount}`);
console.log(`  FAIL: ${failCount}`);
console.log(`  Total: ${passCount + failCount}`);
console.log(`============================================================\n`);

if (failCount > 0) {
  process.exit(1);
}
