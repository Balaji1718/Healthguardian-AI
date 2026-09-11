export interface WebSearchResultItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt?: string;
}

export interface WebSearchResponse {
  ok: boolean;
  query: string;
  results: WebSearchResultItem[];
  source?: string;
  error?: string;
}

/**
 * Executes a privacy-safe web search via the backend AI boundary.
 */
export async function performWebSearch(query: string): Promise<WebSearchResponse> {
  if (!query || !query.trim()) {
    return { ok: false, query: "", results: [], error: "Empty search query" };
  }

  try {
    const res = await fetch("/api/ai/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as WebSearchResponse;
    return {
      ok: Boolean(data?.ok),
      query: data?.query || query,
      results: Array.isArray(data?.results) ? data.results : [],
      ...(data?.source ? { source: data.source } : {}),
    };
  } catch (err) {
    // Graceful offline fallback with public health reference
    return {
      ok: true,
      query,
      results: [
        {
          title: "World Health Organization (WHO) Guidelines",
          url: "https://www.who.int/health-topics",
          domain: "who.int",
          snippet:
            "Evidence-based global public health guidelines and healthy living recommendations.",
          publishedAt: "2024",
        },
      ],
      source: "offline_fallback",
    };
  }
}
