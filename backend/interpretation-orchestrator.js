import { routeCompletion } from "./ai-provider-router.js";

// Deterministic emergency safety check (English, Tamil, Hindi)
const EMERGENCY_PATTERNS = [
  /\b(chest pain|heart attack|angina|pressure in chest|crushing chest)\b/i,
  /\b(cannot breathe|can't breathe|severe shortness of breath|gasping for air|struggling to breathe)\b/i,
  /\b(fainted|passed out|loss of consciousness|blacked out)\b/i,
  /\b(stroke|sudden numbness|face drooping|slurred speech|facial droop)\b/i,
  /\b(coughing up blood|vomiting blood|severe allergic reaction|anaphylaxis)\b/i,
  /(நெஞ்சு\s*வலி|மாரடைப்பு|மூச்சுத்\s*திணறல்|மூச்சு\s*விட\s*முடியவில்லை|மயங்கி\s*விழு)/,
  /(सीने\s*में\s*दर्द|दिल\s*का\s*दौरा|सांस\s*लेने\s*में\s*कठिनाई|सांस\s*फूल|दम\s*घुट|बेहोश|खून\s*की\s*उल्टी|लकवा)/,
];

export function checkEmergencySymptoms(text) {
  if (!text || typeof text !== "string") return null;
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(text)) {
      return "If these symptoms are severe, sudden, worsening, or happening now, seek urgent medical attention or contact local emergency services. I cannot diagnose the cause. Do not wait for this app or an AI response in an emergency.";
    }
  }
  return null;
}

const INTERPRETATION_SYSTEM_PROMPT = `You are the central Interpretation & Orchestration Layer for HealthGuardian AI, a preventive-health application.
Your role is NOT simply to extract fixed fields or match keywords. Your role is to deeply UNDERSTAND what the user is communicating, prioritize what matters, determine what the system needs, and structure actionable information while preserving strict distinctions.

CRITICAL DISTINCTIONS YOU MUST MAINTAIN:
1. Transcript / Input: What was literally spoken or typed.
2. Interpretation: What the user meant and is trying to communicate.
3. Explicit Facts: Information explicitly and unambiguously stated by the user.
4. Inferred Context: Plausible background or physiological context derived from the input (must ALWAYS remain marked as an unconfirmed inference, never an established user fact).
5. Ambiguities: Things that are vague, uncertain, or could have multiple interpretations.
6. System Needs: What HealthGuardian should actually do with this input (e.g. record a checkin, check post-workout hydration, adjust a goal, monitor a symptom, explain a report).
7. Missing Information: Key pieces of information not provided that are relevant or important before taking safe action.
8. Prioritization: Major health points must be ranked first; minor secondary remarks come later.

INTERPRETATION & METRIC CALCULATION RULES:
- Sleep bed-to-wake time: If user says "slept at 11:30 PM and woke up today 6:10 AM", compute the exact elapsed hours:
  11:30 PM to 6:10 AM = 6 hours and 40 minutes = 6.67 hours (round to 6.7).
  DO NOT confuse exercise hours or any other duration with sleep hours!
- Exercise: "do exercise for 1 hours" -> exerciseMinutes: 60, exerciseType: "Exercise".
- Nutrition: "eat 4 dosa and one cup of coffee" -> foodQuality: "4 dosas & 1 cup coffee".
- Vitals / Measurements: Only extract systolic, diastolic, glucose, weight if explicitly stated or clearly quantified.
- NEVER invent values, symptoms, medications, or diagnoses.
- For missing fields, assign null. Do NOT assume 0 unless the user explicitly stated "no water", "zero exercise", "didn't sleep", etc.

OUTPUT FORMAT:
Return pure, valid JSON with this exact schema:
{
  "mainIntent": "daily_checkin",
  "summary": "1-2 sentence coherent summary of what the user communicated",
  "majorPoints": [
    "Prioritized key point 1 (e.g., Slept 6.7 hours from 11:30 PM to 6:10 AM)",
    "Prioritized key point 2 (e.g., Completed 60-minute morning workout)"
  ],
  "secondaryDetails": [
    "Secondary contextual detail (e.g., Breakfast consisted of 4 dosas and coffee)"
  ],
  "explicitFacts": [
    { "field": "sleepHours", "value": 6.7, "sourceText": "slept at 11:30PM and i woke up today 6:10 AM", "confidence": "high" },
    { "field": "exerciseMinutes", "value": 60, "sourceText": "do exercise for 1 hours", "confidence": "high" },
    { "field": "foodQuality", "value": "4 dosas & coffee", "sourceText": "eat 4 dosa and coffee", "confidence": "high" }
  ],
  "inferredContext": [
    {
      "topic": "Nutrition Balance",
      "inference": "Carbohydrate-rich breakfast with caffeine; protein intake was limited.",
      "confirmed": false
    },
    {
      "topic": "Hydration Need",
      "inference": "60 minutes of exercise increases fluid replacement needs.",
      "confirmed": false
    }
  ],
  "ambiguities": [],
  "systemNeeds": [
    "record_daily_checkin",
    "prompt_post_workout_hydration"
  ],
  "missingInformation": [
    {
      "field": "waterGlasses",
      "prompt": "Did you drink water this morning, especially after your 60-minute workout?",
      "priority": "recommended"
    }
  ],
  "extractedCheckin": {
    "wellbeing": null,
    "sleepHours": 6.7,
    "waterGlasses": null,
    "exerciseMinutes": 60,
    "exerciseType": "Exercise",
    "foodQuality": "4 dosas & coffee",
    "weightKg": null,
    "systolicBP": null,
    "diastolicBP": null,
    "bloodGlucose": null,
    "bloodGlucoseUnit": "mg/dL",
    "symptoms": [],
    "tags": ["Exercise", "Breakfast"],
    "notes": "Slept 6.7 hrs (11:30 PM - 6:10 AM). 60 min workout. Had 4 dosas & coffee.",
    "date": null,
    "fieldConfidence": {
      "sleepHours": "high",
      "exerciseMinutes": "high",
      "foodQuality": "high"
    },
    "isAmbiguous": false,
    "ambiguityReason": null,
    "observations": [],
    "analysis": {
      "enhancedSummary": "User slept 6.7 hours (11:30 PM to 6:10 AM), completed a 60-minute workout, and had a breakfast of 4 dosas with coffee.",
      "conditionInsights": [
        "Sleep duration of 6.7 hours provides adequate rest, approaching the 7–8 hour target.",
        "60 minutes of exercise supports cardiovascular conditioning and metabolic energy."
      ],
      "riskPatterns": [
        "Workout without documented fluid intake may cause mild post-exercise dehydration.",
        "High-carbohydrate breakfast without substantial protein may cause a mid-morning glucose dip."
      ],
      "historySuggestions": [
        "Ensure 2-3 glasses of water post-workout.",
        "Consider adding protein (such as sambar or eggs) to balance carbohydrate meals."
      ]
    }
  }
}`;

/**
 * Intelligent deterministic fallback when LLM is unavailable.
 * Splits clauses properly and parses bed-wake intervals and exercise independently without cross-field interference.
 */
export function interpretWithRules(text, targetLang = "en") {
  const norm = (text || "").toLowerCase().trim();

  const majorPoints = [];
  const secondaryDetails = [];
  const explicitFacts = [];
  const inferredContext = [];
  const missingInformation = [];
  const ambiguities = [];
  const systemNeeds = ["record_daily_checkin"];

  let sleepHours = null;
  let exerciseMinutes = null;
  let exerciseType = null;
  let foodQuality = null;
  let waterGlasses = null;
  let wellbeing = null;

  // 1. Bed-to-wake time interval parser (handles intervening words like "today", "at", "around")
  const bedWakeRegex = /(?:slept|bed|went to bed)\s*(?:at|from|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:and\s*(?:i\s*)?(?:woke(?:\s*up)?|got\s*up)|to|till|until)\s*(?:today\s*)?(?:at|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const bedWakeMatch = norm.match(bedWakeRegex);

  if (bedWakeMatch && bedWakeMatch[1] && bedWakeMatch[4]) {
    let h1 = Number(bedWakeMatch[1]);
    const m1 = bedWakeMatch[2] ? Number(bedWakeMatch[2]) : 0;
    const p1 = (bedWakeMatch[3] || "").toLowerCase();
    if (p1 === "pm" && h1 < 12) h1 += 12;
    if (p1 === "am" && h1 === 12) h1 = 0;
    const startDec = h1 + m1 / 60;

    let h2 = Number(bedWakeMatch[4]);
    const m2 = bedWakeMatch[5] ? Number(bedWakeMatch[5]) : 0;
    const p2 = (bedWakeMatch[6] || "").toLowerCase();
    if (p2 === "pm" && h2 < 12) h2 += 12;
    if (p2 === "am" && h2 === 12) h2 = 0;
    const endDec = h2 + m2 / 60;

    let diff = endDec >= startDec ? endDec - startDec : (24 - startDec) + endDec;
    diff = Math.round(diff * 10) / 10;
    if (diff > 0 && diff <= 18) {
      sleepHours = diff;
      majorPoints.push(`Slept ${diff} hours (${bedWakeMatch[1]}:${bedWakeMatch[2] || "00"} ${p1.toUpperCase() || "PM"} to ${bedWakeMatch[4]}:${bedWakeMatch[5] || "00"} ${p2.toUpperCase() || "AM"})`);
      explicitFacts.push({ field: "sleepHours", value: diff, sourceText: bedWakeMatch[0], confidence: "high" });
    }
  }

  // 2. Direct sleep duration (ONLY if bed-wake interval not found)
  if (sleepHours === null) {
    const directSleepMatch = norm.match(/(?:slept|sleep|rested)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)\b(?!.*exercise)/i);
    if (directSleepMatch && directSleepMatch[1]) {
      sleepHours = Number(directSleepMatch[1]);
      majorPoints.push(`Slept ${sleepHours} hours`);
      explicitFacts.push({ field: "sleepHours", value: sleepHours, sourceText: directSleepMatch[0], confidence: "high" });
    }
  }

  // 3. Exercise parser (hours or minutes)
  const exerciseHourMatch = norm.match(/(?:exercised|exercise|worked out|workout|activity|walked|walking|running|gym)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)/i) ||
                            norm.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\s*(?:of\s*)?(?:exercise|workout|walking|running|gym)/i);
  if (exerciseHourMatch && exerciseHourMatch[1]) {
    exerciseMinutes = Math.round(Number(exerciseHourMatch[1]) * 60);
    exerciseType = "Exercise";
    majorPoints.push(`Completed ${exerciseMinutes} minutes of exercise`);
    explicitFacts.push({ field: "exerciseMinutes", value: exerciseMinutes, sourceText: exerciseHourMatch[0], confidence: "high" });
  } else {
    const exerciseMinMatch = norm.match(/(?:walked|ran|jogged|exercised|exercise|worked out|workout|activity)\s*(?:for\s*)?(\d+)\s*(?:minutes|mins|m|min)\b/i);
    if (exerciseMinMatch && exerciseMinMatch[1]) {
      exerciseMinutes = Number(exerciseMinMatch[1]);
      exerciseType = "Exercise";
      majorPoints.push(`Completed ${exerciseMinutes} minutes of exercise`);
      explicitFacts.push({ field: "exerciseMinutes", value: exerciseMinutes, sourceText: exerciseMinMatch[0], confidence: "high" });
    }
  }

  // 4. Food & Nutrition
  const foodParts = [];
  const dosaMatch = norm.match(/(\d+)?\s*(?:dosa|dosai|தோசை)/i);
  if (dosaMatch) foodParts.push(`${dosaMatch[1] ? dosaMatch[1] + " " : ""}dosa`);
  const idliMatch = norm.match(/(\d+)?\s*(?:idli|idly|இட்லி)/i);
  if (idliMatch) foodParts.push(`${idliMatch[1] ? idliMatch[1] + " " : ""}idli`);
  if (/\b(coffee|kaapi|kaafi|காபி|कॉफी)\b/i.test(norm)) foodParts.push("coffee");
  if (/\b(tea|chai|டீ|चाय)\b/i.test(norm)) foodParts.push("tea");
  if (foodParts.length > 0) {
    foodQuality = foodParts.join(" & ");
    secondaryDetails.push(`Breakfast/Meal: ${foodQuality}`);
    explicitFacts.push({ field: "foodQuality", value: foodQuality, sourceText: foodParts.join(", "), confidence: "high" });
  }

  // 5. Water
  const waterMatch = norm.match(/(\d+)\s*(?:glasses|glass|cups|bottles)\s*(?:of\s*)?water/i);
  if (waterMatch && waterMatch[1]) {
    waterGlasses = Number(waterMatch[1]);
    majorPoints.push(`Drank ${waterGlasses} glasses of water`);
    explicitFacts.push({ field: "waterGlasses", value: waterGlasses, sourceText: waterMatch[0], confidence: "high" });
  } else if (exerciseMinutes && exerciseMinutes >= 30) {
    missingInformation.push({
      field: "waterGlasses",
      prompt: "Did you drink water this morning, especially following your workout?",
      priority: "recommended",
    });
    inferredContext.push({
      topic: "Post-workout hydration",
      inference: "Significant physical activity without logged water indicates fluid replenishment is needed.",
      confirmed: false,
    });
  }

  const notes = [
    sleepHours != null ? `Slept ${sleepHours}h.` : null,
    exerciseMinutes != null ? `Exercise for ${exerciseMinutes} mins.` : null,
    foodQuality ? `Meal: ${foodQuality}.` : null,
    waterGlasses != null ? `Water: ${waterGlasses} glasses.` : null,
  ].filter(Boolean).join(" ") || text;

  const conditionInsights = [];
  if (sleepHours != null) {
    if (sleepHours >= 7 && sleepHours <= 9) {
      conditionInsights.push(`Sleep duration of ${sleepHours}h meets optimal restorative recovery targets.`);
    } else if (sleepHours < 7) {
      conditionInsights.push(`Sleep duration of ${sleepHours}h is slightly below the 7–8 hour target.`);
    } else {
      conditionInsights.push(`Sleep duration of ${sleepHours}h recorded.`);
    }
  }
  if (exerciseMinutes != null) {
    conditionInsights.push(`Completed ${exerciseMinutes} mins of exercise, supporting cardiovascular conditioning.`);
  }

  const riskPatterns = [];
  if (sleepHours != null && sleepHours < 7) {
    riskPatterns.push("Late sleep onset may contribute to circadian misalignment.");
  }
  if (exerciseMinutes != null && waterGlasses == null) {
    riskPatterns.push("Exercise without logged fluid intake may cause mild hydration deficit.");
  }

  const historySuggestions = [];
  if (exerciseMinutes != null) {
    historySuggestions.push("Maintain morning physical activity and hydrate adequately.");
  }

  return {
    mainIntent: "daily_checkin",
    summary: notes,
    majorPoints: majorPoints.length > 0 ? majorPoints : [text],
    secondaryDetails,
    explicitFacts,
    inferredContext,
    ambiguities,
    systemNeeds,
    missingInformation,
    extractedCheckin: {
      wellbeing,
      sleepHours,
      waterGlasses,
      exerciseMinutes,
      exerciseType,
      foodQuality,
      weightKg: null,
      systolicBP: null,
      diastolicBP: null,
      bloodGlucose: null,
      bloodGlucoseUnit: "mg/dL",
      symptoms: [],
      tags: exerciseMinutes ? ["Exercise"] : [],
      notes,
      date: null,
      fieldConfidence: {
        ...(sleepHours != null ? { sleepHours: "high" } : {}),
        ...(exerciseMinutes != null ? { exerciseMinutes: "high" } : {}),
        ...(foodQuality != null ? { foodQuality: "high" } : {}),
        ...(waterGlasses != null ? { waterGlasses: "high" } : {}),
      },
      isAmbiguous: false,
      ambiguityReason: null,
      observations: [],
      analysis: {
        enhancedSummary: notes,
        conditionInsights,
        riskPatterns,
        historySuggestions,
      },
    },
  };
}

function extractJsonBlock(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const slice = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // Strip trailing commas before } or ]
        const noTrailing = slice
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        try {
          return JSON.parse(noTrailing);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Main entry point: Interprets user input across all 6 stages.
 * Employs LLM understanding first, with fallback to intelligent context-aware rule interpretation.
 */
export async function interpretUserInput(userText, language = "en", userContext = {}) {
  const text = (userText || "").trim();
  if (!text) {
    return { ok: false, error: "Please enter your health update or question." };
  }

  // 1. Safety Pre-Check Gate
  const emergency = checkEmergencySymptoms(text);
  if (emergency) {
    return {
      ok: false,
      emergency: true,
      emergencyMessage: emergency,
    };
  }

  // 2. LLM Semantic Understanding via Provider Router
  try {
    const messages = [
      {
        role: "system",
        content: `${INTERPRETATION_SYSTEM_PROMPT}\nTarget language: ${language}\nExisting health context: ${JSON.stringify(userContext || {})}\nCRITICAL: Output MUST be strictly valid RFC 8259 JSON only, without comments or markdown.`,
      },
      {
        role: "user",
        content: text,
      },
    ];

    const aiRes = await routeCompletion({
      messages,
      temperature: 0.1,
      maxTokens: 850,
      json: true,
    });

    // Support both .content and .text from router
    const rawContent = aiRes?.content || aiRes?.text;
    if (aiRes?.ok && typeof rawContent === "string") {
      const parsed = extractJsonBlock(rawContent);

      if (parsed && (parsed.mainIntent || parsed.extractedCheckin || parsed.majorPoints)) {
        return {
          ok: true,
          provider: aiRes.provider || "ai_router",
          source: "conversational",
          interpretation: {
            mainIntent: parsed.mainIntent || "daily_checkin",
            summary: parsed.summary || parsed.extractedCheckin?.notes || text,
            majorPoints: Array.isArray(parsed.majorPoints) ? parsed.majorPoints : [],
            secondaryDetails: Array.isArray(parsed.secondaryDetails) ? parsed.secondaryDetails : [],
            explicitFacts: Array.isArray(parsed.explicitFacts) ? parsed.explicitFacts : [],
            inferredContext: Array.isArray(parsed.inferredContext) ? parsed.inferredContext : [],
            ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities : [],
            systemNeeds: Array.isArray(parsed.systemNeeds) ? parsed.systemNeeds : ["record_daily_checkin"],
            missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : [],
          },
          data: parsed.extractedCheckin || parsed,
        };
      }
    }
  } catch (err) {
    console.warn("LLM interpretation failed, falling back to rule engine:", err?.message);
  }

  // 3. Fallback: Context-Aware Rule Interpretation
  const ruleResult = interpretWithRules(text, language);
  return {
    ok: true,
    provider: "rule_fallback",
    source: "conversational",
    interpretation: {
      mainIntent: ruleResult.mainIntent,
      summary: ruleResult.summary,
      majorPoints: ruleResult.majorPoints,
      secondaryDetails: ruleResult.secondaryDetails,
      explicitFacts: ruleResult.explicitFacts,
      inferredContext: ruleResult.inferredContext,
      ambiguities: ruleResult.ambiguities,
      systemNeeds: ruleResult.systemNeeds,
      missingInformation: ruleResult.missingInformation,
    },
    data: ruleResult.extractedCheckin,
  };
}
