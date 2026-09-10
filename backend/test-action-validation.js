import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We read the actual action-validation.ts code and mock its imports dynamically
// so we don't have to load the browser/Firebase environment dependencies in Node.
const tsPath = path.resolve(__dirname, "..", "frontend", "src", "features", "agent", "action-validation.ts");
let tsContent = await fs.readFile(tsPath, "utf8");

// Mock the imports and exports so Node can run it
tsContent = tsContent
  .replace(/import\s+\{\s*z\s*\}\s+from\s+"[^"]+";/g, "")
  .replace(/import\s+\{\s*TOOL_MAP\s*\}\s+from\s+"[^"]+";/g, "")
  .replace("export function validateAction", "function validateAction")
  .replace(": Record<string, z.ZodType<Record<string, unknown>>> =", " =")
  .replace(": { ok: true; action: ValidatedAction } | { ok: false; error: string }", "")
  .replace(/function validateAction\([\s\S]*?\)/, "function validateAction(raw)")
  .replace("export type ValidatedAction = z.infer<typeof actionSchema>;", "");

// Mock TOOL_MAP with realistic tools matching tools.ts
const mockedTools = [
  "getUserProfile",
  "getHealthProfile",
  "getDailyCheckins",
  "getHealthHistory",
  "getMedicalReport",
  "getVerifiedMedicalResults",
  "calculatePersonalBaseline",
  "detectPatterns",
  "calculateRisk",
  "getGoals",
  "createGoal",
  "getSpecialistGuidance",
  "createNotification",
  "getNotificationState",
  "createSupportRequest",
  "webSearch",
];
const TOOL_MAP = new Map(mockedTools.map((name) => [name, { name }]));

// Evaluate the file code within this context
import { z } from "zod";
const context = { z, TOOL_MAP };
const fn = new Function(
  "z",
  "TOOL_MAP",
  tsContent + "\nreturn { validateAction, toolArgumentSchemas, actionSchema };"
);
const { validateAction } = fn(z, TOOL_MAP);

async function runTest(testId, name, input, expectedOk, expectedError) {
  const res = validateAction(input);
  try {
    assert.equal(res.ok, expectedOk, `${testId} (${name}): expected ok=${expectedOk}`);
    if (!expectedOk) {
      assert.ok(res.error, `${testId} (${name}): expected error message`);
      if (expectedError) {
        assert.ok(res.error.includes(expectedError), `${testId} (${name}): error "${res.error}" should contain "${expectedError}"`);
      }
    }
    console.log(`${testId} - PASS: ${name}`);
  } catch (err) {
    console.error(`${testId} - FAIL: ${name}. ${err.message}`);
    throw err;
  }
}

console.log("Starting Structured Action Validation Tests...");

// 1. Valid Actions
await runTest(
  "VALID-001",
  "Valid tool action with correct arguments",
  { action: "tool", tool: "getMedicalReport", args: { reportId: "rep123" } },
  true
);

await runTest(
  "VALID-002",
  "Valid ask action with message only",
  { action: "ask", message: "How are you feeling?" },
  true
);

await runTest(
  "VALID-003",
  "Valid answer action with message only",
  { action: "answer", message: "You are within normal baseline ranges." },
  true
);

await runTest(
  "VALID-004",
  "Valid propose action with message, tool and correct args",
  {
    action: "propose",
    tool: "createGoal",
    args: { title: "Walk daily", goalType: "exercise" },
    message: "Would you like me to set a walking goal?",
  },
  true
);

// 2. Malformed JSON / Invalid types
await runTest(
  "ERR-001",
  "Malformed shape (missing action)",
  { tool: "getMedicalReport", args: { reportId: "rep123" } },
  false,
  "Malformed or unsupported action"
);

await runTest(
  "ERR-002",
  "Invalid action type",
  { action: "invalid_action", message: "test" },
  false,
  "Malformed or unsupported action"
);

// 3. Unknown Tool
await runTest(
  "ERR-003",
  "Unknown tool name in tool action",
  { action: "tool", tool: "unknown_medical_tool", args: {} },
  false,
  "Unknown tool"
);

// 4. Invalid Arguments (wrong types)
await runTest(
  "ERR-004",
  "Wrong argument type (number instead of string)",
  { action: "tool", tool: "getMedicalReport", args: { reportId: 12345 } },
  false,
  "Invalid tool arguments"
);

await runTest(
  "ERR-005",
  "Wrong argument type in enum value",
  { action: "tool", tool: "calculatePersonalBaseline", args: { metric: "invalidMetric" } },
  false,
  "Invalid tool arguments"
);

// 5. Missing required arguments
await runTest(
  "ERR-006",
  "Missing required argument reportId",
  { action: "tool", tool: "getVerifiedMedicalResults", args: {} },
  false,
  "Invalid tool arguments"
);

// 6. Empty / Null action
await runTest(
  "ERR-007",
  "Empty action object",
  {},
  false,
  "Malformed or unsupported action"
);

// 7. Unexpected arguments where strict validation is appropriate
await runTest(
  "ERR-008",
  "Unexpected argument in getMedicalReport (strict rejection)",
  { action: "tool", tool: "getMedicalReport", args: { reportId: "rep123", extraField: "hack" } },
  false,
  "Invalid tool arguments"
);

await runTest(
  "ERR-009",
  "Unexpected argument in getUserProfile (strict rejection)",
  { action: "tool", tool: "getUserProfile", args: { unnecessary: "value" } },
  false,
  "Invalid tool arguments"
);

// 8. Missing message in ask/answer/propose
await runTest(
  "ERR-010",
  "Missing message in ask action",
  { action: "ask" },
  false,
  "Message is required"
);

await runTest(
  "ERR-011",
  "Including tool or args in ask action",
  { action: "ask", message: "Hello", tool: "getUserProfile" },
  false,
  "Only tool/propose actions may include a tool or arguments"
);

console.log("All Structured Action Validation Tests completed successfully.");
