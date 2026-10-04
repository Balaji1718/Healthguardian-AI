import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const backendDir = path.resolve("backend");
const files = fs.readdirSync(backendDir)
  .filter((f) => f.startsWith("test-") && f.endsWith(".js"))
  .sort();

console.log(`Found ${files.length} backend test suites.\n`);

const results = [];

for (const file of files) {
  process.stdout.write(`Executing ${file} ... `);
  const start = Date.now();
  const res = spawnSync("node", [path.join(backendDir, file)], {
    cwd: path.resolve("."),
    encoding: "utf-8",
    env: { ...process.env },
    timeout: 60000,
  });
  const duration = Date.now() - start;
  const passed = res.status === 0;
  results.push({
    file,
    status: res.status,
    passed,
    durationMs: duration,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  });
  console.log(`${passed ? "✅ PASS" : "❌ FAIL (exit " + res.status + ")"} (${duration}ms)`);
}

console.log("\n================ SUMMARY ================");
const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = total - passed;
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  console.log("\nFailed suites details:");
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`\n--- ${r.file} (Exit: ${r.status}) ---`);
    if (r.stdout) console.log(r.stdout.slice(-1000));
    if (r.stderr) console.error(r.stderr.slice(-1000));
  }
}

fs.writeFileSync("test-backend-results.json", JSON.stringify(results, null, 2));
console.log("\nSaved results to test-backend-results.json");
process.exit(failed === 0 ? 0 : 1);
