import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Phase 8 Multi-Provider Quota-Aware AI Router for HealthGuardian AI.
 *
 * Supported Providers:
 * 1. OpenRouter
 * 2. Groq
 * 3. NVIDIA NIM
 * 4. Mistral
 * 5. SambaNova
 * 6. Cohere
 * 7. Cerebras
 * 8. Local Fallback
 */

export const PROVIDER_COOLDOWN_MS = Number(process.env.PROVIDER_COOLDOWN_MS) || 60_000;
export const DEFAULT_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS) || 20_000;
export const MAX_RETRIES_PER_PROVIDER = 1; // 1 retry = max 2 attempts per provider

export const PROVIDER_REGISTRY = [
  {
    id: "openrouter",
    displayName: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openrouter/free",
    priority: 1,
    format: "openai",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
  {
    id: "groq",
    displayName: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "openai/gpt-oss-120b",
    priority: 2,
    format: "openai",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
  {
    id: "nvidia",
    displayName: "NVIDIA NIM",
    keyEnv: "NVIDIA_API_KEY",
    modelEnv: "NVIDIA_MODEL",
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    defaultModel: "meta/llama-3.2-11b-vision-instruct",
    priority: 3,
    format: "openai",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
  {
    id: "mistral",
    displayName: "Mistral AI",
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
    priority: 4,
    format: "openai",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
  {
    id: "sambanova",
    displayName: "SambaNova",
    keyEnv: "SAMBANOVA_API_KEY",
    modelEnv: "SAMBANOVA_MODEL",
    baseUrl: "https://api.sambanova.ai/v1/chat/completions",
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    priority: 5,
    format: "openai",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
  {
    id: "cohere",
    displayName: "Cohere",
    keyEnv: "COHERE_API_KEY",
    modelEnv: "COHERE_MODEL",
    baseUrl: "https://api.cohere.com/v2/chat",
    defaultModel: "command-r-plus-08-2024",
    priority: 6,
    format: "cohere",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
  {
    id: "cerebras",
    displayName: "Cerebras",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "gpt-oss-120b",
    priority: 7,
    format: "openai",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
  },
];

// In-memory provider state tracking (cooldown, failures, quota)
const providerStates = new Map();

function getInitialState(providerId) {
  return {
    providerId,
    failures: 0,
    consecutiveFailures: 0,
    lastFailureAt: null,
    cooldownUntil: 0,
    lastStatusCode: null,
    lastError: null,
    successCount: 0,
    requestCount: 0,
    quotaFailuresToday: 0,
    lastLatencyMs: 0,
  };
}

export function getProviderState(providerId) {
  if (!providerStates.has(providerId)) {
    providerStates.set(providerId, getInitialState(providerId));
  }
  return providerStates.get(providerId);
}

export function resetProviderStates() {
  providerStates.clear();
}

export function getProviderConfig(provider) {
  const apiKey = process.env[provider.keyEnv];
  const configuredModel = process.env[provider.modelEnv];
  return {
    ...provider,
    apiKey: apiKey ? apiKey.trim() : undefined,
    model: configuredModel ? configuredModel.trim() : provider.defaultModel,
    isConfigured: Boolean(apiKey && apiKey.trim().length > 0),
  };
}

export function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

export function isQuotaStatus(status, responseBody = "") {
  if (status === 402) return true;
  if (status === 429) return true;
  const lower = String(responseBody).toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("credit") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted")
  );
}

/**
 * Adapter building request body for each provider format.
 */
function buildRequestBody(provider, request, model) {
  if (provider.format === "cohere") {
    return {
      model,
      messages: request.messages.map((m) => ({
        role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 900,
      ...(request.json ? { response_format: { type: "json_object" } } : {}),
    };
  }

  // Standard OpenAI-compatible format (OpenRouter, Groq, NVIDIA, Mistral, SambaNova, Cerebras)
  return {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.3,
    max_tokens: request.maxTokens ?? 900,
    ...(request.json ? { response_format: { type: "json_object" } } : {}),
  };
}

/**
 * Adapter parsing response body from each provider format into standard internal response.
 */
function parseResponseBody(provider, data) {
  if (provider.format === "cohere") {
    const text =
      data?.message?.content?.[0]?.text ??
      data?.text ??
      data?.choices?.[0]?.message?.content ??
      null;
    return {
      content: typeof text === "string" ? text : null,
      usage: {
        inputTokens: data?.usage?.tokens?.input_tokens ?? data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.tokens?.output_tokens ?? data?.usage?.completion_tokens,
      },
    };
  }

  // Standard OpenAI-compatible response
  const content = data?.choices?.[0]?.message?.content ?? null;
  return {
    content: typeof content === "string" ? content : null,
    usage: {
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
    },
  };
}

/**
 * Execute a request to a single provider with timeout, retry, and cooldown tracking.
 */
export async function callProvider(provider, request) {
  const config = getProviderConfig(provider);
  const state = getProviderState(provider.id);
  state.requestCount += 1;

  if (!config.apiKey) {
    return {
      ok: false,
      error: `${provider.displayName}: not configured`,
      retryable: false,
      quotaRelated: false,
    };
  }

  // Check if provider is currently in cooldown
  const now = Date.now();
  if (state.cooldownUntil > now) {
    const remainingSec = Math.ceil((state.cooldownUntil - now) / 1000);
    return {
      ok: false,
      error: `${provider.displayName}: in cooldown for ${remainingSec}s`,
      retryable: false,
      quotaRelated: true,
    };
  }

  const maxAttempts = 1 + MAX_RETRIES_PER_PROVIDER; // 1 initial attempt + 1 retry

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs || DEFAULT_TIMEOUT_MS);
    const t0 = Date.now();

    try {
      const body = buildRequestBody(provider, request, config.model);
      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      };

      // Add custom headers if needed
      if (provider.id === "openrouter") {
        headers["HTTP-Referer"] = "https://healthguardian.ai";
        headers["X-Title"] = "HealthGuardian AI";
      }

      const response = await fetch(config.baseUrl, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify(body),
      });

      state.lastLatencyMs = Date.now() - t0;
      state.lastStatusCode = response.status;

      if (!response.ok) {
        let errBodyText = "";
        try {
          errBodyText = await response.text();
        } catch {
          // ignore
        }

        const isQuota = isQuotaStatus(response.status, errBodyText);
        const retryable = isRetryableStatus(response.status);

        state.failures += 1;
        state.consecutiveFailures += 1;
        state.lastFailureAt = Date.now();
        state.lastError = `HTTP ${response.status}`;

        if (isQuota) {
          state.quotaFailuresToday += 1;
          state.cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
          return {
            ok: false,
            error: `${provider.displayName}: HTTP ${response.status} (Quota/Rate Exceeded)`,
            status: response.status,
            retryable: false,
            quotaRelated: true,
          };
        }

        if (retryable && attempt + 1 < maxAttempts) {
          continue; // Execute 1 single retry
        }

        return {
          ok: false,
          error: `${provider.displayName}: HTTP ${response.status}`,
          status: response.status,
          retryable,
          quotaRelated: false,
        };
      }

      const data = await response.json();
      const parsed = parseResponseBody(provider, data);

      if (parsed.content === null || parsed.content.length === 0) {
        state.failures += 1;
        state.consecutiveFailures += 1;
        state.lastFailureAt = Date.now();
        state.lastError = "malformed response";

        if (attempt + 1 < maxAttempts) continue;

        return {
          ok: false,
          error: `${provider.displayName}: malformed or empty response`,
          retryable: true,
          quotaRelated: false,
        };
      }

      // Success: reset consecutive failures, clear cooldown
      state.consecutiveFailures = 0;
      state.cooldownUntil = 0;
      state.successCount += 1;
      state.lastError = null;

      return {
        ok: true,
        content: parsed.content,
        model: config.model,
        usage: parsed.usage,
        provider: provider.id,
        elapsedMs: state.lastLatencyMs,
      };
    } catch (error) {
      state.lastLatencyMs = Date.now() - t0;
      const isTimeout = error?.name === "AbortError";
      const reason = isTimeout ? "timeout" : "network error";

      state.failures += 1;
      state.consecutiveFailures += 1;
      state.lastFailureAt = Date.now();
      state.lastError = reason;

      if (attempt + 1 < maxAttempts) continue; // retry once

      return {
        ok: false,
        error: `${provider.displayName}: ${reason}`,
        retryable: true,
        quotaRelated: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    error: `${provider.displayName}: unavailable after retry`,
    retryable: true,
    quotaRelated: false,
  };
}

/**
 * Sequential quota-aware router with provider cooldown and single-retry policy.
 */
export async function routeCompletion(request) {
  const startedAt = Date.now();
  const attempted = [];
  let lastError = "No AI provider available.";

  // Sort configured providers by priority
  const sortedProviders = [...PROVIDER_REGISTRY].sort((a, b) => a.priority - b.priority);

  for (const provider of sortedProviders) {
    const config = getProviderConfig(provider);
    if (!config.isConfigured) continue;

    const state = getProviderState(provider.id);
    // If in cooldown, skip this provider to save latency and avoid repeated quota errors
    if (state.cooldownUntil > Date.now()) {
      continue;
    }

    attempted.push(provider.id);
    const result = await callProvider(provider, request);

    if (result.ok) {
      return {
        ok: true,
        content: result.content,
        provider: provider.id,
        model: result.model,
        attempted,
        fallbackOccurred: attempted.length > 1,
        elapsedMs: Date.now() - startedAt,
        usage: result.usage,
      };
    }

    lastError = result.error;
    // If non-retryable and NOT quota related (e.g. fatal request format), we can advance or halt
    // For quota errors (result.quotaRelated = true), we proceed immediately to the next provider
  }

  return {
    ok: false,
    content: "",
    provider: null,
    attempted,
    fallbackOccurred: true,
    elapsedMs: Date.now() - startedAt,
    error: lastError,
  };
}

/**
 * Returns safe public availability and configuration state of all providers.
 * Secrets/keys are NEVER exposed.
 */
export function providerAvailability() {
  return PROVIDER_REGISTRY.map((provider) => {
    const config = getProviderConfig(provider);
    const state = getProviderState(provider.id);
    const inCooldown = state.cooldownUntil > Date.now();
    return {
      name: provider.id,
      displayName: provider.displayName,
      configured: config.isConfigured,
      model: config.model,
      priority: provider.priority,
      inCooldown,
      supportsToolCalling: provider.supportsToolCalling,
      supportsStructuredOutput: provider.supportsStructuredOutput,
    };
  });
}

/**
 * Returns safe operational health metrics for all providers without leaking secrets.
 */
export function getProviderHealth() {
  return PROVIDER_REGISTRY.map((provider) => {
    const config = getProviderConfig(provider);
    const state = getProviderState(provider.id);
    const now = Date.now();
    const inCooldown = state.cooldownUntil > now;
    const cooldownRemainingSec = inCooldown ? Math.ceil((state.cooldownUntil - now) / 1000) : 0;

    return {
      provider: provider.id,
      displayName: provider.displayName,
      configured: config.isConfigured,
      available: config.isConfigured && !inCooldown,
      inCooldown,
      cooldownRemainingSec,
      consecutiveFailures: state.consecutiveFailures,
      totalFailures: state.failures,
      successCount: state.successCount,
      requestCount: state.requestCount,
      lastStatusCode: state.lastStatusCode,
      lastLatencyMs: state.lastLatencyMs,
      lastError: state.lastError,
    };
  });
}

/**
 * Diagnostic test for a specific provider using a minimal harmless ping.
 */
export async function testProvider(providerId) {
  const provider = PROVIDER_REGISTRY.find((p) => p.id === providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const startedAt = Date.now();
  const result = await callProvider(provider, {
    messages: [{ role: "user", content: "Reply with the word OK." }],
    temperature: 0,
    maxTokens: 15,
  });

  let status = "ERROR";
  if (result.ok) status = "CONNECTED";
  else if (result.quotaRelated) status = "QUOTA";
  else if (result.status === 401 || result.error?.includes("401") || result.error?.includes("not configured")) {
    status = "AUTH_FAILED";
  }

  return {
    provider: provider.id,
    displayName: provider.displayName,
    model: getProviderConfig(provider).model,
    status,
    latencyMs: Date.now() - startedAt,
    validResponse: result.ok,
    error: result.ok ? undefined : result.error,
  };
}
