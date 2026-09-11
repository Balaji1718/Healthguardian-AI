import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, "..", "frontend", "src", "locales");
const enPath = path.join(localesDir, "en.json");
const taPath = path.join(localesDir, "ta.json");
const hiPath = path.join(localesDir, "hi.json");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("\n============================================================");
console.log("HEALTHGUARDIAN AI — RUNTIME LOCALIZATION AUDIT SUITE");
console.log("============================================================\n");

// 1. Load locale JSON files
assert(fs.existsSync(enPath), "en.json exists");
assert(fs.existsSync(taPath), "ta.json exists");
assert(fs.existsSync(hiPath), "hi.json exists");

const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
const ta = JSON.parse(fs.readFileSync(taPath, "utf-8"));
const hi = JSON.parse(fs.readFileSync(hiPath, "utf-8"));

// 2. Flatten keys helper
function getAllKeys(obj, prefix = "") {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys = keys.concat(getAllKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getAllKeys(en);
const taKeys = getAllKeys(ta);
const hiKeys = getAllKeys(hi);

console.log(`\n[Key Statistics] Total keys in en.json: ${enKeys.length}`);
console.log(`[Key Statistics] Total keys in ta.json: ${taKeys.length}`);
console.log(`[Key Statistics] Total keys in hi.json: ${hiKeys.length}\n`);

// 3. Check full parity
const missingInTa = enKeys.filter((k) => !taKeys.includes(k));
const missingInHi = enKeys.filter((k) => !hiKeys.includes(k));

assert(missingInTa.length === 0, `All en.json keys exist in ta.json (missing: ${missingInTa.join(", ") || "none"})`);
assert(missingInHi.length === 0, `All en.json keys exist in hi.json (missing: ${missingInHi.join(", ") || "none"})`);

// 4. Verify critical namespaces exist
const requiredNamespaces = [
  "common",
  "landing",
  "nav",
  "auth",
  "dashboard",
  "checkin",
  "review",
  "folder",
  "preview",
  "reports",
  "risk",
  "history",
  "goals",
  "notifications",
  "specialist",
  "support",
  "settings",
  "guide",
  "tour",
  "emergency",
  "languages",
  "units",
];

console.log("\n[Namespace Parity Validation]");
for (const ns of requiredNamespaces) {
  assert(en[ns] !== undefined, `Namespace '${ns}' exists in en.json`);
  assert(ta[ns] !== undefined, `Namespace '${ns}' exists in ta.json`);
  assert(hi[ns] !== undefined, `Namespace '${ns}' exists in hi.json`);
}

// 5. Verify all 12 Tour steps
console.log("\n[Guided Tour Steps Completeness (12 Steps)]");
assert(en.tour && en.tour.steps, "en.tour.steps exists");
assert(ta.tour && ta.tour.steps, "ta.tour.steps exists");
assert(hi.tour && hi.tour.steps, "hi.tour.steps exists");

for (let i = 1; i <= 12; i++) {
  const stepKey = String(i);
  const stepEn = en.tour?.steps?.[stepKey];
  const stepTa = ta.tour?.steps?.[stepKey];
  const stepHi = hi.tour?.steps?.[stepKey];

  assert(stepEn !== undefined, `Tour step ${i} defined in en.json`);
  assert(stepTa !== undefined, `Tour step ${i} defined in ta.json`);
  assert(stepHi !== undefined, `Tour step ${i} defined in hi.json`);

  if (stepEn && stepTa && stepHi) {
    assert(!!stepTa.title && stepTa.title !== stepEn.title, `Tour step ${i} title localized in Tamil: "${stepTa.title}"`);
    assert(!!stepHi.title && stepHi.title !== stepEn.title, `Tour step ${i} title localized in Hindi: "${stepHi.title}"`);
    assert(!!stepTa.description && stepTa.description !== stepEn.description, `Tour step ${i} description localized in Tamil`);
    assert(!!stepHi.description && stepHi.description !== stepEn.description, `Tour step ${i} description localized in Hindi`);
    assert(!!stepTa.actionPrompt && stepTa.actionPrompt !== stepEn.actionPrompt, `Tour step ${i} actionPrompt localized in Tamil`);
    assert(!!stepHi.actionPrompt && stepHi.actionPrompt !== stepEn.actionPrompt, `Tour step ${i} actionPrompt localized in Hindi`);
    assert(!!stepTa.keyTakeaway && stepTa.keyTakeaway !== stepEn.keyTakeaway, `Tour step ${i} keyTakeaway localized in Tamil`);
    assert(!!stepHi.keyTakeaway && stepHi.keyTakeaway !== stepEn.keyTakeaway, `Tour step ${i} keyTakeaway localized in Hindi`);
  }
}

// 6. Verify Risk & Patterns page localization
console.log("\n[Risk & Patterns Engine Keys]");
const riskKeys = [
  "title",
  "subtitle",
  "saveAnalysis",
  "baselinesTitle",
  "contextHelp",
  "up",
  "down",
  "stable",
  "unknown",
  "needsData",
  "personalBaseline",
  "recentActivity",
  "deviation",
  "records",
  "confidence",
  "logMinEntries",
  "noPatternsTitle",
  "noPatternsDesc",
  "addCheckin",
  "safetyCritical",
  "worthWatching",
  "savedSuccess",
  "saveError",
];

for (const rk of riskKeys) {
  assert(en.risk?.[rk] !== undefined, `Risk key 'risk.${rk}' exists in en.json`);
  assert(ta.risk?.[rk] !== undefined, `Risk key 'risk.${rk}' exists in ta.json`);
  assert(hi.risk?.[rk] !== undefined, `Risk key 'risk.${rk}' exists in hi.json`);
}

// 7. Verify source files use useTranslation
console.log("\n[Source Code Integration Audit]");
const sourceFilesToCheck = [
  "frontend/src/routes/index.tsx",
  "frontend/src/routes/auth.tsx",
  "frontend/src/routes/app/dashboard.tsx",
  "frontend/src/routes/app/checkin.tsx",
  "frontend/src/routes/app/risk.tsx",
  "frontend/src/routes/app/assistant.tsx",
  "frontend/src/features/agent/ChatComposer.tsx",
  "frontend/src/features/guide/GuidedTourModal.tsx",
  "frontend/src/features/guide/GuideSectionCard.tsx",
  "frontend/src/components/common/States.tsx",
  "frontend/src/routes/app/history.tsx",
  "frontend/src/routes/app/reports.tsx",
  "frontend/src/routes/app/goals.tsx",
  "frontend/src/routes/app/notifications.tsx",
  "frontend/src/routes/app/support.tsx",
  "frontend/src/routes/app/settings.tsx",
  "frontend/src/routes/app/guide.tsx",
];

for (const relPath of sourceFilesToCheck) {
  const fullPath = path.join(__dirname, "..", relPath);
  assert(fs.existsSync(fullPath), `File exists: ${relPath}`);
  const content = fs.readFileSync(fullPath, "utf-8");
  assert(
    content.includes("useTranslation") || content.includes("useAppStore"),
    `${relPath} imports and utilizes localization hook / store`,
  );
}

console.log("\n============================================================");
console.log(`TOTAL AUDIT ASSERTIONS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log("============================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
