import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

// Helper to load and strip a TypeScript file for Node.js evaluation
async function loadTsFile(filePath, exportsToReturn) {
  let content = await fs.readFile(filePath, "utf8");
  
  // Strip imports, generic types, and export statements
  content = content
    .replace(/import\s+[^;]+from\s+"[^"]+";/g, "")
    .replace(/import\s+type\s+[^;]+;/g, "")
    .replace(/export\s+function/g, "function")
    .replace(/export\s+const/g, "const")
    .replace(/:\s*\{\s*recentWindowSize[\s\S]*?\}/g, "") // ADAPTIVE_CONFIG type annotation
    .replace(/:\s*\{\s*recentWindowSize[\s\S]*?\}/g, "") // ADAPTIVE_CONFIG type annotation
    .replace(/:\s*AdaptiveMetricEvidence\[\]/g, "")
    .replace(/:\s*AdaptiveMetricEvidence/g, "")
    .replace(/:\s*AdaptiveMetric/g, "")
    .replace(/:\s*DailyCheckin\[\]/g, "")
    .replace(/:\s*HealthContext/g, "")
    .replace(/:\s*number\s*\|\s*null/g, "")
    .replace(/:\s*number\[\]/g, "") // Moved up before : number
    .replace(/:\s*string\[\]/g, "") // Moved up before : string
    .replace(/:\s*number/g, "")
    .replace(/:\s*string/g, "")
    .replace(/:\s*boolean/g, "")
    .replace(/:\s*any/g, "")
    .replace(/:\s*v\s*is\s*number/g, "")
    .replace(/:\s*Array<[^>]+>/g, "")
    .replace(/as\s+AdaptiveMetric/g, "")
    .replace(/:\s*["']up["']\s*\|\s*["']down["']\s*\|\s*["']stable["']\s*\|\s*["']unknown["']/g, "")
    .replace(/export\s+type\s+[^;]+;/g, "")
    .replace(/([a-zA-Z0-9_\]\)])!/g, "$1");

  return content;
}

console.log("Loading and compiling Adaptive Health Intelligence v2 modules...");

const srcDir = path.resolve("..", "frontend", "src", "core", "adaptive");

const configContent = await loadTsFile(path.join(srcDir, "config.ts"));
const baselineContent = await loadTsFile(path.join(srcDir, "baseline.ts"));
const trendContent = await loadTsFile(path.join(srcDir, "trend.ts"));
const deviationContent = await loadTsFile(path.join(srcDir, "deviation.ts"));
const confidenceContent = await loadTsFile(path.join(srcDir, "confidence.ts"));
const contextContent = await loadTsFile(path.join(srcDir, "context.ts"));

// Mock toDate and constants
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Combine all code into one executable block
const fullCode = [
  "const ENABLE_ADAPTIVE_V2 = true;",
  configContent,
  baselineContent,
  trendContent,
  deviationContent,
  confidenceContent,
  contextContent,
  "return { ADAPTIVE_CONFIG, calculateMedian, calculatePersonalBaseline, calculateAdaptiveEvidence, calculateRateOfChange, determineDirection, calculateDeviation, calculateRelativeDeviation, calculateConfidence, buildHealthContext };"
].join("\n");

// Compile functions
const fn = new Function("toDate", fullCode);
const {
  ADAPTIVE_CONFIG,
  calculateMedian,
  calculatePersonalBaseline,
  calculateAdaptiveEvidence,
  calculateRateOfChange,
  determineDirection,
  calculateDeviation,
  calculateRelativeDeviation,
  calculateConfidence,
  buildHealthContext
} = fn(toDate);

console.log("Adaptive v2 Modules successfully compiled. Running unit tests...\n");

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ------------------------------------------------------------
// TEST 1 — Insufficient Evidence Requirements
// ------------------------------------------------------------
console.log("[Test 1: Insufficient Evidence Requirements]");
const sparseCheckins = [
  { date: "2026-07-01", sleepHours: 7.0 },
  { date: "2026-07-02", sleepHours: 8.0 },
];
// Config requires min 5 for sleepHours
const resSparse = calculatePersonalBaseline(sparseCheckins, "sleepHours");
check("sparse baseline should be null", resSparse.baseline, null);
check("sparse confidence should be 0", resSparse.confidence, 0);
check("sparse direction should be unknown", resSparse.direction, "unknown");

// ------------------------------------------------------------
// TEST 2 — Explicit Zeros vs Null (Missing Data)
// ------------------------------------------------------------
console.log("\n[Test 2: Explicit Zeros vs Null (Missing Data)]");
const zeroCheckins = [
  { date: "2026-07-01", sleepHours: 0 },
  { date: "2026-07-02", sleepHours: 0 },
  { date: "2026-07-03", sleepHours: 0 },
  { date: "2026-07-04", sleepHours: 0 },
  { date: "2026-07-05", sleepHours: 0 },
];
const resZero = calculatePersonalBaseline(zeroCheckins, "sleepHours");
check("median of explicit zeros is 0", resZero.recentMedian, 0);
check("baseline of zeros is null (insufficient history)", resZero.baseline, null);

const zero10Checkins = [
  { date: "2026-07-01", sleepHours: 0 },
  { date: "2026-07-02", sleepHours: 0 },
  { date: "2026-07-03", sleepHours: 0 },
  { date: "2026-07-04", sleepHours: 0 },
  { date: "2026-07-05", sleepHours: 0 },
  { date: "2026-07-06", sleepHours: 0 },
  { date: "2026-07-07", sleepHours: 0 },
  { date: "2026-07-08", sleepHours: 0 },
  { date: "2026-07-09", sleepHours: 0 },
  { date: "2026-07-10", sleepHours: 0 },
];
const resZero10 = calculatePersonalBaseline(zero10Checkins, "sleepHours");
check("baseline of 10 zeros is 0", resZero10.baseline, 0);

// ------------------------------------------------------------
// TEST 3 — Personalization Comparison (User A vs User B)
// ------------------------------------------------------------
console.log("\n[Test 3: Personalization (User A vs User B)]");
// User A: baseline sleep = 8h, recent = 6h
const userACheckins = [
  { date: "2026-07-01", sleepHours: 8 },
  { date: "2026-07-02", sleepHours: 8 },
  { date: "2026-07-03", sleepHours: 8 },
  { date: "2026-07-04", sleepHours: 8 },
  { date: "2026-07-05", sleepHours: 8 },
  // recent window
  { date: "2026-07-06", sleepHours: 6 },
  { date: "2026-07-07", sleepHours: 6 },
  { date: "2026-07-08", sleepHours: 6 },
  { date: "2026-07-09", sleepHours: 6 },
  { date: "2026-07-10", sleepHours: 6 },
];

// User B: baseline sleep = 6h, recent = 6h
const userBCheckins = [
  { date: "2026-07-01", sleepHours: 6 },
  { date: "2026-07-02", sleepHours: 6 },
  { date: "2026-07-03", sleepHours: 6 },
  { date: "2026-07-04", sleepHours: 6 },
  { date: "2026-07-05", sleepHours: 6 },
  // recent window
  { date: "2026-07-06", sleepHours: 6 },
  { date: "2026-07-07", sleepHours: 6 },
  { date: "2026-07-08", sleepHours: 6 },
  { date: "2026-07-09", sleepHours: 6 },
  { date: "2026-07-10", sleepHours: 6 },
];

const resA = calculatePersonalBaseline(userACheckins, "sleepHours");
const resB = calculatePersonalBaseline(userBCheckins, "sleepHours");

check("User A baseline should be 8.0", resA.baseline, 8.0);
check("User A deviation should be -2.0", resA.deviation, -2.0);
check("User A direction should be down", resA.direction, "down");

check("User B baseline should be 6.0", resB.baseline, 6.0);
check("User B deviation should be 0", resB.deviation, 0);
check("User B direction should be stable", resB.direction, "stable");

// ------------------------------------------------------------
// TEST 4 — Confidence Calculations
// ------------------------------------------------------------
console.log("\n[Test 4: Confidence Calculations]");
const c1 = calculateConfidence(10, 0, null); // perfect coverage
check("perfect 10 coverage without trend confidence >= 0.8", c1 >= 0.8, true);

const c2 = calculateConfidence(3, 0.5, null); // low coverage, few samples
check("poor coverage and low samples confidence is lower than perfect", c2 < c1, true);

// ------------------------------------------------------------
// TEST 5 — Context & Explanation Signals
// ------------------------------------------------------------
console.log("\n[Test 5: Context & Explanation Signals]");
const evidences = [
  resA, // sleep downward deviation -2.0h (supporting/decline)
  {
    metric: "waterGlasses",
    baseline: 8.0,
    recentMedian: 9.0,
    recentMean: 9.0,
    deviation: 1.0,
    rateOfChange: null,
    direction: "up",
    evidenceCount: 10,
    missingRatio: 0,
    confidence: 0.8
  } // water upward deviation +1.0 glasses (conflicting/improvement)
];

const context = buildHealthContext(evidences);
check("context overallConfidence should be average of both confidences", context.overallConfidence, (resA.confidence + 0.8) / 2);
check("context supportingEvidence should contain sleepHours", context.supportingEvidence[0]?.metric, "sleepHours");
check("context conflictingEvidence should contain waterGlasses", context.conflictingEvidence[0]?.metric, "waterGlasses");
check("context explanationSignals has sleep pattern", context.explanationSignals.some(s => s.includes("Recent sleep is 2.0 hours below your usual pattern of 8.0 hours")), true);
check("context explanationSignals has water pattern", context.explanationSignals.some(s => s.includes("Recent water is 1.0 glasses above your usual pattern of 8.0 glasses")), true);

// ------------------------------------------------------------
// TEST 6 — F-005 Emergency Gate Normalization
// ------------------------------------------------------------
console.log("\n[Test 6: F-005 Emergency Gate Normalization]");

const agentPath = path.resolve("..", "frontend", "src", "features", "agent", "agent.ts");
const agentRaw = await fs.readFile(agentPath, "utf8");

function cleanFn(code) {
  return code
    .replace(/export\s+/g, "")
    .replace(/(\w+)\s*\?\s*:/g, "$1:")
    .replace(/(\w+)\s*\?/g, "$1")
    .replace(/:\s*string\s*\|\s*null/g, "")
    .replace(/:\s*string\[\]/g, "")
    .replace(/:\s*string/g, "")
    .replace(/:\s*Partial<[^>]+>\s*\|\s*Record<[^>]+>\s*\|\s*null/g, "")
    .replace(/:\s*["']en["']\s*\|\s*["']ta["']\s*\|\s*["']hi["']/g, "")
    .replace(/\bas\s+string/g, "");
}

const normAndEmerg = agentRaw.slice(
  agentRaw.indexOf("function normalizeText"),
  agentRaw.indexOf("/* ------------------------------- agent loop -------------------------------- */")
);
const sanitize = agentRaw.slice(
  agentRaw.indexOf("function sanitizeAssistantReply"),
  agentRaw.indexOf("function finish")
);

const agentContent = cleanFn(normAndEmerg + "\n\n" + sanitize);

// Compile emergency & sanitize functions safely
const agentFn = new Function(
  `
  ${agentContent}
  return { normalizeText, deterministicEmergencyResponse, sanitizeAssistantReply };
  `
);
const { normalizeText, deterministicEmergencyResponse, sanitizeAssistantReply } = agentFn();

// Emergency phrases
const emergencyCases = [
  "chest pain",
  "Chest Pain",
  "CHEST PAIN",
  "chestpain",
  "chest-pain",
  "chest_pain",
  "fainted",
  "severe shortness of breath",
  "I fainted",
  "cannot breathe"
];
for (const phrase of emergencyCases) {
  const res = deterministicEmergencyResponse(phrase);
  check(`'${phrase}' should trigger emergency response`, typeof res === "string" && res.includes("urgent medical attention"), true);
}

// Non-emergency cases
const nonEmergencyCases = [
  "pain in my chest",
  "fatigue only",
  "poor sleep only",
  "I slept badly last night",
  "headache"
];
for (const phrase of nonEmergencyCases) {
  const res = deterministicEmergencyResponse(phrase);
  check(`'${phrase}' should NOT trigger emergency response`, res, null);
}

// ------------------------------------------------------------
// TEST 7 — F-004 AI Response Sanitization & Fallback
// ------------------------------------------------------------
console.log("\n[Test 7: F-004 AI Response Sanitization & Fallback]");

const fallbackMsg = "I couldn't process that request reliably. Please try again.";

check("raw XML tool tags returns fallback", sanitizeAssistantReply("<tool_call>getDailyCheckins</tool_call>"), fallbackMsg);
check("raw internal safety text returns fallback", sanitizeAssistantReply("User Safety: safe"), fallbackMsg);
check("safety label inside text returns fallback", sanitizeAssistantReply("The model determined user safety: safe for now."), fallbackMsg);
check("raw JSON action string returns fallback", sanitizeAssistantReply('{"action":"tool","tool":"getDailyCheckins"}'), fallbackMsg);
check("clean Markdown response passes through", sanitizeAssistantReply("You logged 8 hours of sleep."), "You logged 8 hours of sleep.");

// ------------------------------------------------------------
// TEST 8 — F-003 Sparse Baseline Protection Progression
// ------------------------------------------------------------
console.log("\n[Test 8: F-003 Sparse Baseline Protection Progression]");

// Test history lengths from 1 to 10
for (let i = 1; i <= 10; i++) {
  const checkins = [];
  for (let j = 0; j < i; j++) {
    // Seed high-normal historical and recent entries
    checkins.push({ date: `2026-07-${10 + j}`, sleepHours: j < i - 5 ? 8.0 : 6.0 });
  }
  
  const ev = calculatePersonalBaseline(checkins, "sleepHours");
  
  // Enforce baseline is null and confidence is 0 for checkins <= 7 (historical baseline count < 3)
  if (i <= 7) {
    check(`For ${i} check-ins, baseline should be null`, ev.baseline, null);
    check(`For ${i} check-ins, confidence should be 0`, ev.confidence, 0);
  } else {
    check(`For ${i} check-ins, baseline should be computed`, typeof ev.baseline === "number", true);
    check(`For ${i} check-ins, confidence should be > 0`, ev.confidence > 0, true);
  }
}

// ------------------------------------------------------------
// TEST 9 — Centralized Thresholds Verification
// ------------------------------------------------------------
console.log("\n[Test 9: Centralized Thresholds Verification]");
check("centralized uiAlertConfidence should be 0.6", ADAPTIVE_CONFIG.uiAlertConfidence, 0.6);
check("centralized notificationAlertConfidence should be 0.7", ADAPTIVE_CONFIG.notificationAlertConfidence, 0.7);
check("centralized minBaselineObservations should be 3", ADAPTIVE_CONFIG.minBaselineObservations, 3);

// ------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`Adaptive Health Intelligence v2 Unit Test Results`);
console.log(`${"=".repeat(60)}`);
console.log(`  PASS: ${passed}`);
console.log(`  FAIL: ${failed}`);
console.log(`  Total: ${passed + failed}`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
