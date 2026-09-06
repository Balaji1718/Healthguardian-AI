/**
 * HealthGuardian AI - Adaptive Multilingual Conversational Health Extraction
 *
 * Implements bounded, deterministic extraction of daily health metrics from free-form text,
 * voice transcripts, connected folder docs, and multilingual/Tanglish/Hinglish utterances.
 *
 * Core Principles:
 * 1. Phonetic & Conversational Intelligence: Interprets speech recognition noise, Tanglish, and Hinglish.
 * 2. Strict Safety Gate: Detects emergent medical triggers deterministically before LLM processing.
 * 3. Bounded Schema & Immutability: Only extracts values and generates clean, enhanced summaries.
 */

import { z } from "zod";
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

export const extractionSchema = z.object({
  wellbeing: z.enum(["great", "good", "okay", "tired", "not_great"]).nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  waterGlasses: z.number().min(0).max(30).nullable().optional(),
  exerciseMinutes: z.number().min(0).max(600).nullable().optional(),
  exerciseType: z.string().max(60).nullable().optional(),
  foodQuality: z.string().max(60).nullable().optional(),
  weightKg: z.number().min(20).max(400).nullable().optional(),
  systolicBP: z.number().min(60).max(260).nullable().optional(),
  diastolicBP: z.number().min(30).max(200).nullable().optional(),
  bloodGlucose: z.number().min(1).max(900).nullable().optional(),
  bloodGlucoseUnit: z.enum(["mg/dL", "mmol/L"]).nullable().optional(),
  symptoms: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(1000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fieldConfidence: z.record(z.enum(["high", "medium", "low"])).default({}),
  isAmbiguous: z.boolean().default(false),
  ambiguityReason: z.string().nullable().optional(),
}).strict();

const SYSTEM_EXTRACTION_PROMPT = `You are an intelligent, empathetic, adaptive health data extraction and natural language understanding assistant for HealthGuardian AI.
Your task is to understand, enhance, and extract lifestyle metrics, symptoms, and health entries from the user's natural free-form speech, voice transcripts, or text.
You support multilingual, code-switched, and colloquial utterances in English, Tamil, Tanglish, Hindi, and Hinglish.

NON-STRICT, CONTEXTUAL NATURAL LANGUAGE UNDERSTANDING:
1. DO NOT BE RIGID OR STRICT WITH PARTICULAR KEYWORDS. People communicate in diverse, informal, and conversational ways:
   - Sleep intervals: "went to bed at 11 and woke up at 7" -> sleepHours: 8
   - Sleep idioms: "slept like a rock" -> wellbeing: "great", sleepHours: 8; "kann moodala" / "didn't sleep at all" / "thoongave illa" -> sleepHours: 0, wellbeing: "tired", tags: ["Poor sleep"]
   - Hydration: "tender coconut and 2 cups of tea" -> foodQuality: "Tender coconut & tea", waterGlasses: 3; "lots of fluids" / "thanni neraya kudichen" -> waterGlasses: 8
   - Activities: "gardening for an hour" -> exerciseType: "Gardening", exerciseMinutes: 60; "took the stairs" / "walk paninen" / "walking ponen" -> exerciseType: "Walking", exerciseMinutes: 30
   - Wellbeing & Symptoms: "feeling under the weather" -> wellbeing: "not_great"; "mandai idikudhu" / "thalavali" -> symptoms: ["headache"], wellbeing: "not_great"
   - Blood Pressure / Glucose: infer systolic, diastolic, glucose from conversational phrases like "sugar was 110", "bp 120 80".
2. Extract all stated or clearly implied values into the schema. If a metric was NOT mentioned or implied, set it to null.
3. If an explicit 0 is stated (e.g., "no water", "தூங்கவில்லை", "உடற்பயிற்சி செய்யவில்லை", "पानी नहीं पिया"), set value to 0.
4. If a value is ambiguous or uncertain, set isAmbiguous: true and provide a helpful ambiguityReason.
5. In the "notes" field, provide a CLEAN, INTELLIGENT, AND ENHANCED natural summary of what the user communicated IN THE TARGET APPLICATION LANGUAGE specified in the context.
   - If target language is "ta" (Tamil), write the notes in pure, grammatically sound Tamil script.
   - If target language is "hi" (Hindi), write the notes in pure Devanagari Hindi.
   - If target language is "en" (English), write the notes in natural English.
6. NEVER generate medical diagnoses or prescribe medications.
7. Return pure structured JSON matching the schema.`;

// Tamil Number Word Map (Native + Tanglish / Phonetic)
const TAMIL_NUMBERS = {
  "அரை": 0.5,
  "ஒன்று": 1,
  "ஒரு": 1,
  "இரண்டு": 2,
  "ரெண்டு": 2,
  "மூன்று": 3,
  "மூணு": 3,
  "நான்கு": 4,
  "நாலு": 4,
  "ஐந்து": 5,
  "அஞ்சு": 5,
  "ஆறு": 6,
  "ஏழு": 7,
  "எட்டு": 8,
  "ஒன்பது": 9,
  "பத்து": 10,
  "இருபது": 20,
  "முப்பது": 30,
  "நாற்பது": 40,
  "ஐம்பது": 50,
  "அறுபது": 60,
  "aaru": 6,
  "army": 6,
  "ezhu": 7,
  "ettu": 8,
  "rendu": 2,
  "endglass": "2 glass",
  "end": 2,
  "moonu": 3,
  "naalu": 4,
  "anju": 5,
  "onnu": 1,
  "oru": 1,
  "pathu": 10,
};

// Hindi Number Word Map (Native + Hinglish / Phonetic)
const HINDI_NUMBERS = {
  "आधा": 0.5,
  "एक": 1,
  "दो": 2,
  "तीन": 3,
  "चार": 4,
  "पाँच": 5,
  "पांच": 5,
  "छह": 6,
  "छः": 6,
  "सात": 7,
  "आठ": 8,
  "नौ": 9,
  "दस": 10,
  "बीस": 20,
  "तीस": 30,
  "चालीस": 40,
  "पचास": 50,
  "साठ": 60,
  "adha": 0.5,
  "ek": 1,
  "do": 2,
  "teen": 3,
  "char": 4,
  "paanch": 5,
  "che": 6,
  "saat": 7,
  "aath": 8,
  "nau": 9,
  "das": 10,
  "bees": 20,
  "tees": 30,
};

function normalizeMultilingualNumbers(text) {
  let res = text;
  for (const [word, num] of Object.entries(TAMIL_NUMBERS)) {
    res = res.replace(new RegExp(`\\b${word}\\b|${word}`, "gi"), String(num));
  }
  for (const [word, num] of Object.entries(HINDI_NUMBERS)) {
    res = res.replace(new RegExp(`\\b${word}\\b|${word}`, "gi"), String(num));
  }
  return res;
}

/**
 * Intelligent deterministic rule-based extractor used as fallback or offline validator.
 * Supports English, Tamil, Tanglish, Hindi, and Hinglish.
 */
export function extractWithRules(text, targetLang = "en") {
  const normRaw = (text || "")
    .toLowerCase()
    .replace(/\bzero\b/gi, "0")
    .replace(/\bno water\b/gi, "0 glasses water")
    .replace(/\bno exercise\b/gi, "0 minutes exercise")
    .replace(/உடற்பயிற்சி\s*செய்யவில்லை/g, "0 நிமிடம் உடற்பயிற்சி")
    .replace(/தூங்கவில்லை|தூங்கவே\s*இல்லை/g, "0 மணி நேரம் தூக்கம்")
    .replace(/व्यायाम\s*नहीं\s*किया|कसरत\s*नहीं\s*की/g, "0 मिनट व्यायाम")
    .replace(/नींद\s*नहीं\s*आई|सोया\s*नहीं/g, "0 घंटे नींद");
  const norm = normalizeMultilingualNumbers(normRaw);

  const res = {
    wellbeing: null,
    sleepHours: null,
    waterGlasses: null,
    exerciseMinutes: null,
    exerciseType: null,
    foodQuality: null,
    weightKg: null,
    systolicBP: null,
    diastolicBP: null,
    bloodGlucose: null,
    bloodGlucoseUnit: "mg/dL",
    symptoms: [],
    tags: [],
    notes: null,
    date: null,
    fieldConfidence: {},
    isAmbiguous: false,
    ambiguityReason: null,
  };

  // Ambiguity check
  if (/(between\s+\d+\s+and\s+\d+|\d+\s*-\s*\d+\s*hours|\d+\s+or\s+\d+\s+hours|somewhere\s+between|exercised\s+a\s+lot|a\s+few\s+glasses|நிறைய\s*உடற்பயிற்சி|काफी\s*व्यायाम|थोड़ा\s*पानी)/i.test(norm)) {
    res.isAmbiguous = true;
    res.ambiguityReason = "Range or approximate value detected in your description. Please review or adjust values.";
  }

  // Wellbeing (English, Tamil, Hindi, Tanglish, Hinglish)
  if (/\b(feeling great|felt great|feel great|super good|amazing|super-?ah)\b/i.test(norm) || /(சிறப்பாக|மிகவும்\s*நன்றாக|बहुत\s*अच्छा|शानदार|badhiya|shandar)/i.test(norm)) {
    res.wellbeing = "great";
    res.fieldConfidence.wellbeing = "high";
  } else if (/\b(feeling good|felt good|feel good|pretty good|nalla\s*iruk|nalla\s*irundh|super)\b/i.test(norm) || /(நன்றாக|நல்லா|நல்லாயிருக்கேன்|अच्छा|बढ़िया|ठीक\s*ठाक|accha|nalla)/i.test(norm)) {
    res.wellbeing = "good";
    res.fieldConfidence.wellbeing = "high";
  } else if (/\b(feeling okay|felt okay|feel okay|was okay|okay|alright|fine|paravala)\b/i.test(norm) || /(பரவாயில்லை|ठीक|सामान्य|theek)/i.test(norm)) {
    res.wellbeing = "okay";
    res.fieldConfidence.wellbeing = "high";
  } else if (/\b(tired|exhausted|sleepy|drained|fatigued|sorva|thakan|tired-?ah|romba\s*tired)\b/i.test(norm) || /(சோர்வாக|களைப்பாக|சோர்வு|थका|थकान|कमजोरी|thaka|sorva)/i.test(norm)) {
    res.wellbeing = "tired";
    res.fieldConfidence.wellbeing = "high";
  } else if (/\b(not great|felt bad|feeling down|unwell|terrible|udambu\s*mudiyala|seri\s*illa)\b/i.test(norm) || /(மோசமாக|உடல்நலமில்லை|உடம்பு\s*முடியவில்லை|खराब|तबीयत\s*खराब|बीमार|kharab)/i.test(norm)) {
    res.wellbeing = "not_great";
    res.fieldConfidence.wellbeing = "high";
  }

  // Explicit Zero Sleep checks (colloquial & Tanglish)
  if (/\b(thoongave\s*illa|kann\s*moodala|thookame\s*illa|couldn't\s*sleep|did\s*not\s*sleep|no\s*sleep|zero\s*sleep)\b/i.test(norm)) {
    res.sleepHours = 0;
    res.fieldConfidence.sleepHours = "high";
    if (!res.wellbeing) res.wellbeing = "tired";
    res.tags.push("Poor sleep");
  }

  // Sleep intervals (e.g. "slept from 11 to 7", "slept 11pm to 7am")
  if (res.sleepHours === null) {
    const intervalMatch = norm.match(/(?:slept|bed)\s*(?:from|at)?\s*(\d{1,2})(?::\d{2})?\s*(?:pm|am)?\s*(?:to|till|until)\s*(\d{1,2})(?::\d{2})?\s*(?:am|pm)?/i);
    if (intervalMatch && intervalMatch[1] && intervalMatch[2]) {
      const start = Number(intervalMatch[1]);
      const end = Number(intervalMatch[2]);
      let diff = end >= start ? end - start : (12 - start) + end;
      if (diff > 0 && diff <= 16) {
        res.sleepHours = diff;
        res.fieldConfidence.sleepHours = "medium";
      }
    }
  }

  // Sleep (English, Tamil, Hindi, Tanglish, Hinglish)
  if (res.sleepHours === null) {
    const sleepMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)\s*(?:of\s*)?sleep/i) ||
                       norm.match(/(?:slept|sleep|rested|thoonginen|thoonga|thookam|tong|soya|neend)\s*[:=-]?\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hours|hrs|h|mani|nehra|ghante|ghanta)?/i) ||
                       norm.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)\s*(?:thoonginen|thookam|thoongina|soya|rest)?/i) ||
                       norm.match(/(\d+(?:\.\d+)?)\s*(?:மணி\s*நேரம்|மணி|நேரம்|nehra|mani|hours?)\s*(?:தூங்கினேன்|தூக்கம்|tong|thoong|sleep)?/i) ||
                       norm.match(/(?:தூங்கினேன்|தூக்கம்|tong|thoong)\s*(\d+(?:\.\d+)?)\s*(?:மணி\s*நேரம்|மணி|நேரம்|nehra|mani)?/i) ||
                       norm.match(/(\d+(?:\.\d+)?)\s*(?:घंटे|घंटा|ghante|ghanta)\s*(?:सोया|नींद|की\s*नींद|soya|neend)?/i) ||
                       norm.match(/(?:सोया|नींद|घंटे|soya|neend)\s*(\d+(?:\.\d+)?)\s*(?:घंटे|घंटा|ghante|ghanta)?/i);
    if (sleepMatch && (sleepMatch[1] || sleepMatch[2])) {
      const val = Number(sleepMatch[1] || sleepMatch[2]);
      if (!isNaN(val) && val >= 0 && val <= 24) {
        res.sleepHours = val;
        res.fieldConfidence.sleepHours = res.isAmbiguous ? "medium" : "high";
      }
    } else if (/\b(half an hour|30 mins?)\s*(?:of\s*)?sleep\b/i.test(norm) || /(அரை\s*மணி\s*நேரம்\s*தூங்கினேன்|ஆधा\s*घंटा\s*सोया|adha\s*ghanta\s*soya)/.test(norm)) {
      res.sleepHours = 0.5;
      res.fieldConfidence.sleepHours = "high";
    }
  }

  // Water & Beverages (English, Tamil, Hindi, Tanglish, Hinglish)
  const waterMatch = norm.match(/(?:drank|drink|had|water|thanni|thanneer|paani|pani)\s*[:=-]?\s*(?:about\s*)?(\d+)\s*(?:glasses|glass|cups|bottles|bottil|g)?\s*(?:of\s*(?:water|thanni))?/i) ||
                     norm.match(/(\d+)\s*(?:glasses|glass|cups|bottles|bottil|g)\s*(?:of\s*)?(?:water|thanni|thanneer|paani|pani|kaafi|kaapi|coffee|tea|puducherry|kudithen|kudichen|piya)?/i) ||
                     norm.match(/(?:paani|pani|water|thanni|thanneer)\s*(\d+)\s*(?:glasses|glass|cups|bottles)?/i) ||
                     norm.match(/(\d+)\s*(?:கிளாஸ்|டம்ளர்|குவளை|பாட்டில்)\s*(?:தண்ணீர்|காபி|டீ)?/) ||
                     norm.match(/(?:தண்ணீர்|காபி|டீ)\s*(\d+)\s*(?:கிளாஸ்|டம்ளர்|குவளை|பாட்டில்)?/) ||
                     norm.match(/(\d+)\s*(?:ग्लास|गिलास|कप|बोतल)\s*(?:पानी|चाय|कॉफी)?/) ||
                     norm.match(/(?:पानी|चाय|कॉफी)\s*(\d+)\s*(?:ग्लास|गिलास)?/);
  if (waterMatch && waterMatch[1]) {
    res.waterGlasses = Number(waterMatch[1]);
    res.fieldConfidence.waterGlasses = res.isAmbiguous ? "medium" : "high";
  }

  // Food Quality & Beverages
  if (/(?:kaafi|kaapi|coffee|காபி|कॉफी)/i.test(norm)) {
    res.foodQuality = "Coffee / Beverage";
  } else if (/(?:tea|டீ|chai|चाय)/i.test(norm)) {
    res.foodQuality = "Tea / Beverage";
  } else if (/(?:tender coconut|elani|ilani|இளநீர்)/i.test(norm)) {
    res.foodQuality = "Tender Coconut";
  }

  // Exercise (English, Tamil, Hindi, Tanglish, Hinglish)
  const exerciseMatch = norm.match(/(?:walked|ran|jogged|exercised|exercise|worked out|workout|activity|cycling|swimming|walk\s*paninen|walking\s*ponen|nadanthen|velai\s*senjen|chala|dauda)\s*[:=-]?\s*(?:for\s*)?(\d+)\s*(?:minutes|mins|m|min|nimisham|nimudam)/i) ||
                        norm.match(/(\d+)\s*(?:minutes|mins|m|min|nimisham|nimisam|nimudam)\s*(?:of\s*)?(?:exercise|walking|running|workout|activity|walk|walk\s*paninen|nadanthen|chala|dauda)/i) ||
                        norm.match(/(\d+)\s*(?:நிமிடம்|நிமிடங்கள்|நிமிஷம்|நிமிசங்கள்)\s*(?:நடந்தேன்|ஓடினேன்|உடற்பயிற்சி|நடைபயிற்சி|போனேன்|சென்றேன்)/) ||
                        norm.match(/(?:நடந்தேன்|ஓடினேன்|உடற்பயிற்சி|நடைபயிற்சி)\s*(\d+)\s*(?:நிமிடம்|நிமிடங்கள்|நிமிஷம்|நிமிசங்கள்)/) ||
                        norm.match(/(\d+)\s*(?:मिनट)\s*(?:चला|दौड़ा|घूमा|कसरत|व्यायाम)/) ||
                        norm.match(/(?:चला|दौड़ा|घूमा|कसरत|व्यायाम)\s*(\d+)\s*(?:मिनट)?/);
  if (exerciseMatch && exerciseMatch[1]) {
    res.exerciseMinutes = Number(exerciseMatch[1]);
    res.fieldConfidence.exerciseMinutes = res.isAmbiguous ? "medium" : "high";
  } else if (/\b(walked for half an hour|half an hour walk|half an hour exercise)\b/i.test(norm) || /(அரை\s*மணி\s*நேரம்\s*நடந்தேன்|ஆधा\s*घंटा\s*चला)/.test(norm)) {
    res.exerciseMinutes = 30;
    res.fieldConfidence.exerciseMinutes = "high";
  }

  // Exercise type
  if (/\b(walk|walking|walked|nadanthen|walk\s*paninen|walking\s*ponen)\b/i.test(norm) || /(நடந்தேன்|நடைபயிற்சி|போனேன்|चला|पैदल|walk)/.test(norm)) res.exerciseType = "Walking";
  else if (/\b(run|running|ran|jogging|odinen)\b/i.test(norm) || /(ஓடினேன்|दौड़ा|जॉगिंग)/.test(norm)) res.exerciseType = "Running";
  else if (/\b(swim|swimming|neechal)\b/i.test(norm) || /(நீச்சல்|तैराकी)/.test(norm)) res.exerciseType = "Swimming";
  else if (/\b(gym|strength|weights|kasrat)\b/i.test(norm) || /(ஜிம்|உடற்பயிற்சி|जिम|कसरत)/.test(norm)) res.exerciseType = "Strength Training";
  else if (/\b(cycling|bike|biking)\b/i.test(norm) || /(சைக்கிள்|साइकिल)/.test(norm)) res.exerciseType = "Cycling";
  else if (/\b(yoga|dhyanam|meditation)\b/i.test(norm) || /(யோகா|தியானம்|योग)/.test(norm)) res.exerciseType = "Yoga";

  // Blood Pressure
  const bpMatch = norm.match(/\b(?:bp|blood pressure|இரத்த\s*அழுத்தம்|ரத்த\s*அழுத்தம்|रक्तचाप)(?:[a-zA-Z\s]{0,25}?(?:was|is))?\s*[:=-]?\s*(\d{2,3})\s*(?:\/|over|மற்றும்|और|\s+)\s*(\d{2,3})\b/i) ||
                  norm.match(/\b(?:bp|blood pressure|இரத்த\s*அழுத்தம்|ரத்த\s*அழுத்தம்|रक्तचाप)\s*(?:was|is)?\s*[:=-]?\s*(\d{2,3})\s*(?:\/|over|மற்றும்|और|\s+)\s*(\d{2,3})\b/i);
  if (bpMatch && bpMatch[1] && bpMatch[2]) {
    res.systolicBP = Number(bpMatch[1]);
    res.diastolicBP = Number(bpMatch[2]);
    res.fieldConfidence.systolicBP = "high";
    res.fieldConfidence.diastolicBP = "high";
  }

  // Blood Glucose
  const glucoseMatch = norm.match(/\b(?:glucose|blood sugar|sugar|சர்க்கரை|ரத்த\s*சர்க்கரை|रक्त\s*शर्करा|शुगर)\s*(?:was|is)?\s*(\d{2,3})\b/i);
  if (glucoseMatch && glucoseMatch[1]) {
    res.bloodGlucose = Number(glucoseMatch[1]);
    res.fieldConfidence.bloodGlucose = "high";
  }

  // Weight
  const weightMatch = norm.match(/(?:weight|எடை|वजन)\s*(?:was|is)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:kg|கிலோ|किलो)?/i);
  if (weightMatch && weightMatch[1]) {
    res.weightKg = Number(weightMatch[1]);
    res.fieldConfidence.weightKg = "high";
  }

  // Context tags
  if (/\b(travel|traveling|flight|trip|transit)\b/i.test(norm) || /(பயணம்|यात्रा)/.test(norm)) res.tags.push("Traveling");
  if (/\b(busy day|hectic|lots of work|meetings)\b/i.test(norm) || /(வேலை\s*அதிகம்|அலுவலகம்|व्यस्त|काम\s*ज्यादा)/.test(norm)) res.tags.push("Busy day");
  if (/\b(poor sleep|insomnia|restless|bad sleep)\b/i.test(norm) || /(சரியான\s*தூக்கமில்லை|खराब\s*नींद)/.test(norm)) res.tags.push("Poor sleep");
  if (/\b(more active|long walk|workout session)\b/i.test(norm) || /(அதிக\s*நடை|सक्रिय)/.test(norm)) res.tags.push("More active");
  if (/\b(eating differently|fasting|heavy meal|diet change)\b/i.test(norm) || /(விருந்து|உணவு\s*மாற்றம்|उपवास|व्रत)/.test(norm)) res.tags.push("Eating differently");

  // Symptoms (English, Tamil, Hindi, Tanglish)
  if (/\b(headache|migraine|thalavali|mandai\s*vali)\b/i.test(norm) || /(தலைவலி|மண்டை\s*வலி|सिरदर्द|सिर\s*में\s*दर्द)/.test(norm)) res.symptoms.push("headache");
  if (/\b(fatigue|tiredness|sorva|udambu\s*vali)\b/i.test(norm) || /(சோர்வு|அசதி|थकान)/.test(norm)) res.symptoms.push("fatigue");
  if (/\b(nausea|upset stomach|vomiting)\b/i.test(norm) || /(குமட்டல்|வாந்தி|जी\s*मिचलाना|उल्टी\s*जैसा)/.test(norm)) res.symptoms.push("nausea");
  if (/\b(dizziness|dizzy|lightheaded|thalai\s*suthu)\b/i.test(norm) || /(தலைச்சுற்றல்|चक्कर)/.test(norm)) res.symptoms.push("dizziness");
  if (/\b(fever|kaichal)\b/i.test(norm) || /(காய்ச்சல்|बुखार)/.test(norm)) res.symptoms.push("fever");
  if (/\b(cough|irumal)\b/i.test(norm) || /(இருமல்|खांसी)/.test(norm)) res.symptoms.push("cough");
  if (/\b(joint pain|mootu\s*vali)\b/i.test(norm) || /(மூட்டு\s*வலி|जोड़ों\s*का\s*दर्द)/.test(norm)) res.symptoms.push("joint_pain");

  // Target-Language Specific Clean Summary
  const isTamilTarget = targetLang === "ta" || /[\u0B80-\u0BFF]/.test(text);
  const isHindiTarget = targetLang === "hi" || /[\u0900-\u097F]/.test(text);

  if (text && text.trim()) {
    const parts = [];
    if (isTamilTarget) {
      if (res.sleepHours != null) parts.push(`~${res.sleepHours} மணி நேரம் தூக்கம்`);
      if (res.waterGlasses != null) parts.push(`${res.waterGlasses} கிளாஸ் தண்ணீர்`);
      if (res.exerciseMinutes != null) parts.push(`${res.exerciseMinutes} நிமிடம் ${res.exerciseType === "Walking" ? "நடைப்பயிற்சி" : "உடற்பயிற்சி"}`);
      if (res.wellbeing) parts.push(`உடல்நிலை: ${res.wellbeing === "great" ? "மிக நன்று" : res.wellbeing === "good" ? "நன்று" : res.wellbeing === "tired" ? "சோர்வு" : "பரவாயில்லை"}`);
      if (res.symptoms.length > 0) parts.push(`அறிகுறிகள்: ${res.symptoms.join(", ")}`);
      res.notes = parts.length > 0 ? parts.join(". ") + "." : text.trim();
    } else if (isHindiTarget) {
      if (res.sleepHours != null) parts.push(`~${res.sleepHours} घंटे नींद`);
      if (res.waterGlasses != null) parts.push(`${res.waterGlasses} गिलास पानी`);
      if (res.exerciseMinutes != null) parts.push(`${res.exerciseMinutes} मिनट ${res.exerciseType === "Walking" ? "सैर" : "व्यायाम"}`);
      if (res.wellbeing) parts.push(`स्वास्थ्य: ${res.wellbeing === "great" ? "शानदार" : res.wellbeing === "good" ? "अच्छा" : res.wellbeing === "tired" ? "थकान" : "सामान्य"}`);
      if (res.symptoms.length > 0) parts.push(`लक्षण: ${res.symptoms.join(", ")}`);
      res.notes = parts.length > 0 ? parts.join(". ") + "।" : text.trim();
    } else {
      // English
      if (res.sleepHours != null) parts.push(`Slept ~${res.sleepHours} hours`);
      if (res.waterGlasses != null) parts.push(`Had ${res.waterGlasses} glasses ${res.foodQuality ? `(${res.foodQuality})` : "water"}`);
      else if (res.foodQuality) parts.push(`Had ${res.foodQuality}`);
      if (res.exerciseMinutes != null) parts.push(`${res.exerciseType || "Exercise"} for ${res.exerciseMinutes} mins`);
      if (res.wellbeing) parts.push(`Felt ${res.wellbeing}`);
      if (res.symptoms.length > 0) parts.push(`Symptoms: ${res.symptoms.join(", ")}`);
      res.notes = parts.length > 0 ? parts.join(". ") + "." : text.trim();
    }
  }

  return res;
}

/**
 * Converts and improves transcripts from Tanglish, Hinglish, or informal speech
 * into clean, natural text in the application's active language.
 */
export async function convertAndImproveTranscript(userText, targetLanguage = "en") {
  const text = (userText || "").trim();
  if (!text) return { ok: false, error: "Text is required." };

  const isTamil = targetLanguage === "ta";
  const isHindi = targetLanguage === "hi";

  // 1. Try LLM Conversion via Router
  try {
    const prompt = `You are a health transcript normalizer and language converter for HealthGuardian AI.
Your task is to take the user's spoken health update (which may be in Tanglish, Hinglish, colloquial Tamil, Hindi, or English) and convert it into clean, grammatically sound, natural text in the target language: "${targetLanguage}".

RULES:
- If target language is "ta" (Tamil): Convert Tanglish or English health phrases into proper Tamil script. (e.g. "Iniku 7 hours thoonginen, 6 glass thanni kudichen" -> "இன்று 7 மணி நேரம் தூங்கினேன், 6 டம்ளர் தண்ணீர் குடித்தேன்").
- If target language is "en" (English): Convert Tanglish, Hindi, or mixed words into natural English. (e.g. "Iniku 7 hours thoonginen, 6 glass thanni kudichen" -> "Today I slept 7 hours and drank 6 glasses of water").
- If target language is "hi" (Hindi): Convert Hinglish or mixed words into clean Devanagari Hindi.
- Keep all numerical values, times, symptoms, and health details intact.
- Never invent metrics that were not mentioned.
- Output ONLY the improved text, nothing else.`;

    const aiRes = await routeCompletion({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      maxTokens: 300,
    });

    if (aiRes?.ok && typeof aiRes.text === "string" && aiRes.text.trim()) {
      return {
        ok: true,
        improvedText: aiRes.text.trim().replace(/^["']|["']$/g, ""),
        targetLanguage,
        provider: aiRes.provider,
      };
    }
  } catch {
    // Fall back to rule-based conversion below
  }

  // 2. Offline / Deterministic Rule-Based Fallback
  let fallback = text;

  if (isTamil) {
    // Convert common Tanglish health words to Tamil script
    const tanglishToTamil = [
      [/\biniku\b|\bindru\b/gi, "இன்று"],
      [/\bhours?\b|\bhrs?\b/gi, "மணி நேரம்"],
      [/\bthoonginen\b|\bthoongina\b|\bslept\b/gi, "தூங்கினேன்"],
      [/\bthookam\b|\bsleep\b/gi, "தூக்கம்"],
      [/\bglass\b|\bglasses\b/gi, "கிளாஸ்"],
      [/\bthanni\b|\bthanneer\b|\bwater\b/gi, "தண்ணீர்"],
      [/\bkudichen\b|\bkudithen\b|\bdrank\b/gi, "குடித்தேன்"],
      [/\bmins?\b|\bminutes?\b/gi, "நிமிடம்"],
      [/\bwalk\s*paninen\b|\bwalked\b|\bnadanthen\b/gi, "நடைப்பயிற்சி செய்தேன்"],
      [/\bromba\b|\bvery\b/gi, "மிகவும்"],
      [/\btired-?ah\s*iruku\b|\btired\b|\bsorva\s*iruku\b/gi, "சோர்வாக உணர்கிறேன்"],
      [/\bnalla\s*iruken\b|\bfeeling\s*good\b/gi, "நன்றாக உணர்கிறேன்"],
      [/\bthalavali\b|\bheadache\b/gi, "தலைவலி"],
      [/\bkaichal\b|\bfever\b/gi, "காய்ச்சல்"],
      [/\birumal\b|\bcough\b/gi, "இருமல்"],
    ];
    for (const [pattern, rep] of tanglishToTamil) {
      fallback = fallback.replace(pattern, rep);
    }
  } else if (!isHindi) {
    // Target is English: convert common Tanglish/Tamil to clean English
    const tanglishToEn = [
      [/\biniku\b|\bindru\b|இன்று/gi, "Today"],
      [/\bmani\s*neram\s*thoonginen\b|\bhours\s*thoonginen\b|மணி\s*நேரம்\s*தூங்கினேன்/gi, "hours of sleep"],
      [/\bthoonginen\b|\bthoongina\b|தூங்கினேன்/gi, "slept"],
      [/\bthookam\b|தூக்கம்/gi, "sleep"],
      [/\bglass\s*thanni\s*kudichen\b|\bglass\s*thanni\b|கிளாஸ்\s*தண்ணீர்/gi, "glasses of water"],
      [/\bthanni\b|\bthanneer\b|தண்ணீர்/gi, "water"],
      [/\bkudichen\b|\bkudithen\b|குடித்தேன்/gi, "drank"],
      [/\bnimisham\b|\bnimudam\b|நிமிடம்/gi, "minutes"],
      [/\bwalk\s*paninen\b|\bnadanthen\b|நடந்தேன்|நடைப்பயிற்சி/gi, "walked"],
      [/\bromba\b|மிகவும்/gi, "very"],
      [/\btired-?ah\s*iruku\b|\bsorva\s*iruku\b|சோர்வாக/gi, "feeling tired"],
      [/\bnalla\s*iruken\b|நன்றாக/gi, "feeling good"],
      [/\bthalavali\b|தலைவலி/gi, "headache"],
      [/\bkaichal\b|காய்ச்சல்/gi, "fever"],
      [/\birumal\b|இருமல்/gi, "cough"],
    ];
    for (const [pattern, rep] of tanglishToEn) {
      fallback = fallback.replace(pattern, rep);
    }
  }

  return {
    ok: true,
    improvedText: fallback.trim(),
    targetLanguage,
    provider: "rule_fallback",
  };
}

/**
 * Executes bounded conversational extraction using the AI provider router with safe rule-based fallback.
 */
export async function extractConversationalCheckin(userText, language = "en") {
  const text = (userText || "").trim();
  if (!text) {
    return { ok: false, error: "Please enter your check-in description." };
  }

  // 1. Safety Gate Check
  const emergency = checkEmergencySymptoms(text);
  if (emergency) {
    return {
      ok: false,
      emergency: true,
      emergencyMessage: emergency,
    };
  }

  // 2. Try LLM Extraction via Router
  try {
    const messages = [
      { role: "system", content: `${SYSTEM_EXTRACTION_PROMPT}\nTarget application language: ${language}` },
      { role: "user", content: text },
    ];

    const aiRes = await routeCompletion({
      messages,
      temperature: 0.1,
      maxTokens: 500,
      json: true,
    });

    if (aiRes?.ok && typeof aiRes.text === "string") {
      let rawJson;
      try {
        rawJson = JSON.parse(aiRes.text);
      } catch {
        const cleaned = aiRes.text.replace(/```(?:json)?/g, "").trim();
        rawJson = JSON.parse(cleaned);
      }

      const validated = extractionSchema.safeParse(rawJson);
      if (validated.success) {
        return {
          ok: true,
          data: validated.data,
          provider: aiRes.provider,
          source: "conversational",
        };
      }
    }
  } catch (err) {
    // Fall through to deterministic rule-based extractor
  }

  // 3. Fallback to Rule-Based Extractor
  const ruleData = extractWithRules(text, language);
  const validatedRule = extractionSchema.safeParse(ruleData);
  if (validatedRule.success) {
    return {
      ok: true,
      data: validatedRule.data,
      provider: "rule_fallback",
      source: "conversational",
    };
  }

  return {
    ok: false,
    error: "I couldn't understand that check-in clearly. You can edit the text or use Quick Check-in.",
  };
}
