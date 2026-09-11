import { z } from "zod";
import type { HealthInterpretationResult } from "./interpretation";

const healthObservationSchema = z.object({
  category: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  valueText: z.string().max(300).nullable().optional(),
  numericValue: z.number().nullable().optional(),
  unit: z.string().max(30).nullable().optional(),
  temporalContext: z.string().max(120).nullable().optional(),
  severity: z.string().max(30).nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  sourceText: z.string().max(500),
  userConfirmed: z.boolean().default(false),
});

export const extractedCheckinSchema = z
  .object({
    wellbeing: z.enum(["great", "good", "okay", "tired", "not_great"]).nullable().optional(),
    sleepHours: z.number().min(0).max(24).nullable().optional(),
    waterGlasses: z.number().min(0).max(30).nullable().optional(),
    exerciseMinutes: z.number().min(0).max(600).nullable().optional(),
    exerciseType: z.string().max(60).nullable().optional(),
    foodQuality: z.string().max(160).nullable().optional(),
    weightKg: z.number().min(20).max(400).nullable().optional(),
    systolicBP: z.number().min(60).max(260).nullable().optional(),
    diastolicBP: z.number().min(30).max(200).nullable().optional(),
    bloodGlucose: z.number().min(1).max(900).nullable().optional(),
    bloodGlucoseUnit: z.enum(["mg/dL", "mmol/L"]).nullable().optional(),
    symptoms: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    notes: z.string().max(1000).nullable().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    fieldConfidence: z.record(z.enum(["high", "medium", "low"])).default({}),
    isAmbiguous: z.boolean().default(false),
    ambiguityReason: z.string().nullable().optional(),
    observations: z.array(healthObservationSchema).default([]),
    analysis: z
      .object({
        enhancedSummary: z.string().nullable().optional(),
        conditionInsights: z.array(z.string()).default([]),
        riskPatterns: z.array(z.string()).default([]),
        historySuggestions: z.array(z.string()).default([]),
      })
      .nullable()
      .optional(),
  })
  .strict();

export type ExtractedCheckinData = z.infer<typeof extractedCheckinSchema>;

export interface ExtractionResponse {
  ok: boolean;
  data?: ExtractedCheckinData | undefined;
  interpretation?: HealthInterpretationResult | undefined;
  error?: string | undefined;
  emergency?: boolean | undefined;
  emergencyMessage?: string | undefined;
  provider?: string | undefined;
}

/**
 * Client service to extract structured checkin fields from natural language text.
 */
export async function extractCheckinFromText(
  userText: string,
  language = "en",
): Promise<ExtractionResponse> {
  const text = (userText || "").trim();
  if (!text) {
    return { ok: false, error: "Please enter your check-in description." };
  }

  try {
    const res = await fetch("/api/ai/extract-checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });

    if (!res.ok) {
      return {
        ok: false,
        error:
          "I couldn't understand that check-in clearly. You can edit the text or use Quick Check-in.",
      };
    }

    const payload = (await res.json()) as ExtractionResponse;
    if (payload.emergency) {
      return {
        ok: false,
        emergency: true,
        emergencyMessage: payload.emergencyMessage,
      };
    }

    if (payload.ok && payload.data) {
      const validated = extractedCheckinSchema.safeParse(payload.data);
      if (validated.success) {
        return {
          ok: true,
          data: validated.data,
          interpretation: payload.interpretation,
          provider: payload.provider,
        };
      }
    }

    return {
      ok: false,
      error:
        "I couldn't understand that check-in clearly. You can edit the text or use Quick Check-in.",
    };
  } catch {
    return {
      ok: false,
      error: "Network unavailable. You can use Quick Check-in to log offline.",
    };
  }
}
