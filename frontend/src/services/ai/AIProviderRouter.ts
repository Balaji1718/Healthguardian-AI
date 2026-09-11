import { buildDeterministicFallbackResponse } from "./fallback";
import { AIProvider } from "./AIProvider";
import { CerebrasProvider } from "./CerebrasProvider";
import { GroqProvider } from "./GroqProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import type { AIRequest, AIResult, ProviderName } from "./types";

export class AIProviderRouter {
  private readonly providers: AIProvider[] = [
    new OpenRouterProvider(),
    new GroqProvider(),
    new CerebrasProvider(),
  ];

  async invoke(request: AIRequest): Promise<AIResult> {
    const attempted: ProviderName[] = [];
    const startedAt = Date.now();

    for (const provider of this.providers) {
      attempted.push(provider.name);
      const result = await provider.invoke(request);

      if (result.ok) {
        return {
          ...result,
          attempted,
          fallbackOccurred: false,
          elapsedMs: Date.now() - startedAt,
        };
      }

      const errStr = typeof result.error === "string" ? result.error.toLowerCase() : "";
      const retryable =
        Boolean(errStr) &&
        ["timeout", "network", "rate limit", "server", "malformed", "HTTP 429", "HTTP 5"].some(
          (fragment) => errStr.includes(fragment.toLowerCase()),
        );

      if (!retryable) {
        break;
      }
    }

    const fallback = buildDeterministicFallbackResponse();
    return {
      ...fallback,
      attempted,
      elapsedMs: Date.now() - startedAt,
    };
  }

  getStatus() {
    return this.providers.map((provider) => provider.getStatus());
  }
}

export const aiProviderRouter = new AIProviderRouter();
