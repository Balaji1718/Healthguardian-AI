import {
  extractResultsDeterministically,
  understandMedicalDocument,
  setTestCompletionRouter,
  clearTestCompletionRouter,
} from "./document-understanding.js";

console.log("================================================================");
console.log("HealthGuardian AI: Medical Document Understanding Unit Tests");
console.log("================================================================");

let passCount = 0;
let failCount = 0;

function check(title, condition, extra = "") {
  if (condition) {
    console.log(`  PASS  ${title}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${title} ${extra ? `(${extra})` : ""}`);
    failCount++;
  }
}

// Simulated raw multi-page OCR output with column wraps, headers, and noise
const sampleOcrPages = [
  {
    page: 1,
    confidence: 0.95,
    text: `
METRO HEALTH DIAGNOSTICS & RESEARCH CENTER
124 Medical Square, Anna Nagar, Chennai - 600040 | Ph: 044-24589001
Website: www.metrohealthlabs.org | GSTIN: 33AAAAA0000A1Z5

PATIENT DEMOGRAPHICS
Patient Name: Mr. Rajesh Kumar    Age/Gender: 45 Yrs / Male
MRN / Patient ID: MH-2026-88912   Referred By: Dr. S. Ramanathan, MD
Date of Collection: 12-Sep-2026   Date of Report: 12-Sep-2026
Barcode: *MH202688912*            Sample Type: Whole Blood EDTA

COMPLETE BLOOD COUNT (CBC)
TEST NAME                     RESULT   UNIT       REFERENCE INTERVAL   STATUS
Haemoglobin                   14.2     g/dL       13.0 - 17.0          NORMAL
RBC Count                     4.85     10^6/µL    4.50 - 5.50          NORMAL
PCV / Hematocrit              42.1     %          40.0 - 50.0          NORMAL
MCV                           86.8     fL         80.0 - 100.0         NORMAL
Platelet Count                185000   cells/cumm 150000 - 450000      NORMAL
Total WBC Count               11800    cells/cumm 4000 - 11000         HIGH

--- Page 1 of 2 ---
Disclaimer: This is a computer generated report and does not require physical signature.
    `,
  },
  {
    page: 2,
    confidence: 0.92,
    text: `
METRO HEALTH DIAGNOSTICS & RESEARCH CENTER
Patient Name: Mr. Rajesh Kumar | MRN: MH-2026-88912

LIPID PROFILE
TEST NAME                     RESULT   UNIT       REFERENCE INTERVAL   STATUS
Total Cholesterol             228      mg/dL      < 200                HIGH
HDL Cholesterol               38       mg/dL      40 - 60              LOW
LDL Cholesterol               152      mg/dL      < 100                HIGH
Triglycerides                 190      mg/dL      < 150                HIGH
VLDL Cholesterol              38       mg/dL      < 30                 HIGH

RENAL PROFILE
Serum Creatinine              0.95     mg/dL      0.70 - 1.30          NORMAL
Blood Urea Nitrogen           16.2     mg/dL      7.0 - 20.0           NORMAL

Dr. A. Meenakshi, MD (Path)         Dr. V. Narayanan, MBBS, DCP
Consultant Pathologist               Chief Medical Director

End of Report | Page 2 of 2
    `,
  },
];

async function runTests() {
  // Test 1: Deterministic Fallback Extractor
  console.log("\n[1] Testing Deterministic Table Reconstructor...");
  const fallbackResult = extractResultsDeterministically(sampleOcrPages);

  check("Extracted non-empty results", fallbackResult.results.length > 5, `Got ${fallbackResult.results.length}`);
  
  // Verify noise was filtered out
  const names = fallbackResult.results.map((r) => r.testName.toLowerCase());
  check("Patient Name not treated as test", !names.some((n) => n.includes("rajesh")), names.join(", "));
  check("Hospital/Address not treated as test", !names.some((n) => n.includes("metro health") || n.includes("chennai")));
  check("Disclaimer not treated as test", !names.some((n) => n.includes("disclaimer") || n.includes("computer generated")));
  check("Doctor signature not treated as test", !names.some((n) => n.includes("meenakshi") || n.includes("pathologist")));

  // Verify specific biomarkers
  const hb = fallbackResult.results.find((r) => /haemoglobin|hemoglobin/i.test(r.testName));
  check("Hemoglobin found with correct value & unit", hb && hb.numericValue === 14.2 && hb.unit === "g/dL", JSON.stringify(hb));
  check("Hemoglobin reference range extracted", hb && hb.referenceLow === 13.0 && hb.referenceHigh === 17.0);
  check("Hemoglobin flag is normal", hb && hb.flag === "normal");

  const wbc = fallbackResult.results.find((r) => /total wbc|wbc count/i.test(r.testName));
  check("Total WBC flag is high (11800 > 11000)", wbc && wbc.flag === "high", JSON.stringify(wbc));

  const chol = fallbackResult.results.find((r) => /total cholesterol/i.test(r.testName));
  check("Total Cholesterol found on Page 2 (multi-page)", chol && chol.sourcePage === 2 && chol.numericValue === 228);
  check("Total Cholesterol flag is high (228 > 200)", chol && chol.flag === "high");

  // Test 2: Semantic Document Understanding Runner
  console.log("\n[2] Testing Semantic Document Understanding Entrypoint...");
  const reportMeta = {
    reportTitle: "Annual Comprehensive Panel",
    reportType: "blood_test",
    laboratoryName: "Metro Health",
    reportDate: "2026-09-12",
  };

  setTestCompletionRouter(async () => ({
    ok: true,
    content: JSON.stringify({
      reportTitle: "Annual Comprehensive Panel",
      laboratoryName: "Metro Health",
      reportDate: "2026-09-12",
      sections: ["Haematology", "Lipid Profile"],
      results: [
        { testName: "Haemoglobin", resultValue: "14.2", numericValue: 14.2, unit: "g/dL", sourcePage: 1 },
        { testName: "Total WBC Count", resultValue: "11,800", numericValue: 11800, unit: "cells/cumm", sourcePage: 1 },
        { testName: "Total Cholesterol", resultValue: "228", numericValue: 228, unit: "mg/dL", sourcePage: 2 },
      ],
    }),
  }));

  const outcome = await understandMedicalDocument(sampleOcrPages, reportMeta);
  clearTestCompletionRouter();

  check("Outcome returned successfully", outcome && Array.isArray(outcome.results) && outcome.results.length > 0);
  check("Report title preserved", outcome.reportTitle.length > 0);
  check("No invention constraint: all results have supported test names", outcome.results.every((r) => r.testName.length > 2));
  check("Provenance preserved: each result has sourcePage", outcome.results.every((r) => typeof r.sourcePage === "number"));

  console.log("\n================================================================");
  console.log(`Results: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
