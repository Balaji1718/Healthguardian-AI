import type { ExtractedCheckinData } from "./conversational-checkin";

export interface ExplicitFact {
  field: string;
  value: unknown;
  sourceText: string;
  confidence: "high" | "medium" | "low";
}

export interface InferredContext {
  topic: string;
  inference: string;
  confirmed: boolean;
}

export interface MissingInfoItem {
  field: string;
  prompt: string;
  priority: "recommended" | "optional" | "urgent";
}

export interface HealthInterpretationResult {
  mainIntent: "daily_checkin" | "symptom_concern" | "health_query" | "habit_goal" | "general_update";
  summary: string;
  majorPoints: string[];
  secondaryDetails: string[];
  explicitFacts: ExplicitFact[];
  inferredContext: InferredContext[];
  ambiguities: string[];
  systemNeeds: string[];
  missingInformation: MissingInfoItem[];
}

export interface InterpretResponse {
  ok: boolean;
  data?: ExtractedCheckinData;
  interpretation?: HealthInterpretationResult;
  error?: string;
  emergency?: boolean;
  emergencyMessage?: string;
  provider?: string;
  source?: string;
}

/**
 * Sends natural user input through the 6-stage Interpretation & Orchestration pipeline.
 */
export async function interpretNaturalInput(
  userText: string,
  language = "en",
  userContext: Record<string, unknown> = {},
): Promise<InterpretResponse> {
  const text = (userText || "").trim();
  if (!text) {
    return { ok: false, error: "Please enter your health update or description." };
  }

  try {
    const res = await fetch("/api/ai/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language, userContext }),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: "I couldn't interpret that message clearly. You can edit the text and try again.",
      };
    }

    const payload = (await res.json()) as InterpretResponse;
    return payload;
  } catch (err: unknown) {
    console.error("Interpretation fetch error:", err);
    return {
      ok: false,
      error: "Unable to reach the interpretation service. Please check your network.",
    };
  }
}
