import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("../frontend/node_modules/typescript");

console.log("Transpiling and loading Anatomy Mapping & Config modules via TypeScript 5.9.3...");

const configPath = path.resolve(__dirname, "../frontend/src/features/anatomy/config/anatomy-config.ts");
const mappingPath = path.resolve(__dirname, "../frontend/src/features/anatomy/mapping/anatomy-mapping.ts");

const rawConfig = await fs.readFile(configPath, "utf8");
const rawMapping = await fs.readFile(mappingPath, "utf8");

// Transpile config
const jsConfig = ts.transpileModule(rawConfig, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Transpile mapping
const jsMapping = ts.transpileModule(rawMapping, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Clean imports for execution sandbox
const cleanConfig = jsConfig
  .replace(/import\s+[^;]+from\s+"[^"]+";/g, "")
  .replace(/export\s+/g, "");

const cleanMapping = jsMapping
  .replace(/import\s+[^;]+from\s+"[^"]+";/g, "")
  .replace(/export\s+/g, "");

const sandbox = new Function(`
  ${cleanConfig}
  ${cleanMapping}
  return { ANATOMICAL_REGIONS, STATUS_COLORS, mapHealthDataToAnatomy };
`);

const { ANATOMICAL_REGIONS, STATUS_COLORS, mapHealthDataToAnatomy } = sandbox();

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`, err);
    throw err;
  }
}

console.log("\n[Test Category 1: Neutral NO_DATA Baseline]");

test("Empty inputs produce 16 defined region states", () => {
  const states = mapHealthDataToAnatomy([], [], []);
  const keys = Object.keys(states);
  assert.equal(keys.length, 16, "Must define exactly 16 anatomical regions");
});

test("Empty inputs produce strictly NO_DATA for all 16 regions (no false STABLE)", () => {
  const states = mapHealthDataToAnatomy([], [], []);
  for (const [id, state] of Object.entries(states)) {
    assert.equal(state.status, "NO_DATA", `Region ${id} must have status NO_DATA when empty`);
    assert.equal(state.colorHex.toLowerCase(), "#64748b", `Region ${id} must use neutral slate color #64748b`);
    assert.equal(state.hasData, false, `Region ${id} hasData must be false`);
  }
});

console.log("\n[Test Category 2: Boundary-Value Health Thresholds]");

test("Heart BP: 119/79 -> STABLE", () => {
  const checkins = [{ systolicBP: 119, diastolicBP: 79, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_heart.status, "STABLE");
});

test("Heart BP: 120/80 -> ATTENTION", () => {
  const checkins = [{ systolicBP: 120, diastolicBP: 80, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_heart.status, "ATTENTION");
});

test("Heart BP: 139/89 -> ATTENTION", () => {
  const checkins = [{ systolicBP: 139, diastolicBP: 89, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_heart.status, "ATTENTION");
});

test("Heart BP: 140/90 -> REVIEW_REQUIRED", () => {
  const checkins = [{ systolicBP: 140, diastolicBP: 90, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_heart.status, "REVIEW_REQUIRED");
});

test("Pancreas Glucose: 99 mg/dL -> STABLE", () => {
  const checkins = [{ bloodGlucose: 99, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_pancreas.status, "STABLE");
});

test("Pancreas Glucose: 100 mg/dL -> ATTENTION", () => {
  const checkins = [{ bloodGlucose: 100, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_pancreas.status, "ATTENTION");
});

test("Pancreas Glucose: 126 mg/dL -> REVIEW_REQUIRED", () => {
  const checkins = [{ bloodGlucose: 126, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_pancreas.status, "REVIEW_REQUIRED");
});

test("Liver ALT: normal report -> STABLE", () => {
  const labs = [{ testName: "ALT (SGPT)", resultValue: 35, unit: "U/L", flag: "normal", date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy([], labs, []);
  assert.equal(states.organ_liver.status, "STABLE");
});

test("Liver ALT: flagged high report -> REVIEW_REQUIRED", () => {
  const labs = [{ testName: "ALT (SGPT)", resultValue: 56, unit: "U/L", flag: "high", date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy([], labs, []);
  assert.equal(states.organ_liver.status, "REVIEW_REQUIRED");
});

test("Lungs exercise: 30 mins -> STABLE", () => {
  const checkins = [{ exerciseMinutes: 30, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_lungs.status, "STABLE");
});

test("Lungs exercise: 10 mins -> ATTENTION", () => {
  const checkins = [{ exerciseMinutes: 10, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_lungs.status, "ATTENTION");
});

test("Brain sleep: 8h -> STABLE", () => {
  const checkins = [{ sleepHours: 8, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_brain.status, "STABLE");
});

test("Brain sleep: 4.5h -> ATTENTION", () => {
  const checkins = [{ sleepHours: 4.5, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.equal(states.organ_brain.status, "ATTENTION");
});

test("Brain sleep pattern severity 2 -> REVIEW_REQUIRED", () => {
  const checkins = [{ sleepHours: 4.5, date: "2026-09-27" }];
  const patterns = [{ factor: "sleep deficit", detail: "Severe chronic sleep deficit detected.", severity: 2 }];
  const states = mapHealthDataToAnatomy(checkins, [], patterns);
  assert.equal(states.organ_brain.status, "REVIEW_REQUIRED");
});

console.log("\n[Test Category 3: Medical-Safety / Non-Diagnostic Language]");

test("All 16 explanations in empty state are purely descriptive/informational", () => {
  const states = mapHealthDataToAnatomy([], [], []);
  const forbiddenDiagnosticWords = [/diagnos/i, /disease/i, /infarction/i, /syndrome/i, /pathology/i];
  for (const [id, state] of Object.entries(states)) {
    for (const forbidden of forbiddenDiagnosticWords) {
      assert.equal(forbidden.test(state.explanation), false, `Empty explanation for ${id} must not contain diagnostic words: ${state.explanation}`);
    }
  }
});

test("Active warnings avoid prescriptive commands and suggest discussing with clinician", () => {
  const checkins = [{ systolicBP: 155, diastolicBP: 95, date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy(checkins, [], []);
  assert.ok(states.organ_heart.explanation.includes("clinician") || states.organ_heart.explanation.includes("threshold"));
  assert.equal(/you have hypertension/i.test(states.organ_heart.explanation), false);
});

console.log("\n[Test Category 4: Semantic Region Structure & Mesh Grouping]");

test("Spleen neutral educational note is preserved", () => {
  const states = mapHealthDataToAnatomy([], [], []);
  assert.ok(states.organ_spleen.explanation.toLowerCase().includes("spleen"));
});

test("Kidneys evidence structure includes bilateral mapping", () => {
  const labs = [{ testName: "Serum Creatinine", numericValue: 1.0, unit: "mg/dL", date: "2026-09-27" }];
  const states = mapHealthDataToAnatomy([], labs, []);
  assert.equal(states.organ_kidneys.status, "STABLE");
  assert.equal(states.organ_kidneys.evidence.length, 1);
});

console.log(`\n============================================================`);
console.log(`Total Anatomy Mapping Tests Executed: ${passCount}`);
console.log(`Passed: ${passCount} | Failed: 0`);
console.log(`============================================================`);
