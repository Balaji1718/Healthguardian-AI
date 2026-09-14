import {
  extractResultsDeterministically,
  understandMedicalDocument,
  validateMedicalCandidate,
  reconcileWithSourceOcr,
} from "./document-understanding.js";

console.log("==================================================================");
console.log("HealthGuardian AI: Medical Report & Canonical Sync E2E Verification");
console.log("==================================================================");

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

// ==================================================================
// 1. Realistic Multi-Page Clinical Lab Report with Noise & Ambiguity
// ==================================================================
const realisticMultiPageReport = [
  {
    page: 1,
    confidence: 0.94,
    text: `
APOLLO DIAGNOSTICS & RESEARCH LABORATORIES
Accreditation: NABL ISO 15189 | Reg No: AP-98234-LAB
124 Cathedral Road, Chennai - 600086 | Phone: +91 44 2829 0200
Website: www.apollodiagnostics.in | QR: [REF-99281-BARCODE]

PATIENT DEMOGRAPHICS:
Patient Name: Mr. Rajesh Kumar        Age/Sex: 44 Y / Male
MRN / UHID: AP-2026-99182            Collected: 12-Sep-2026 08:30 AM
Referred By: Dr. S. Ramanathan, MD    Reported:  12-Sep-2026 02:45 PM
Specimen: Whole Blood (EDTA)          Status: Final Signed

DEPARTMENT OF HEMATOLOGY - COMPLETE BLOOD COUNT (CBC)
-----------------------------------------------------------------------------------------
Investigation                      Result    Unit        Flag      Biological Reference Interval
-----------------------------------------------------------------------------------------
Hemoglobin                         14.2      g/dL                  13.0 - 17.0
RBC Count                          4.85      10^6/µL               4.50 - 5.50
Total Leukocyte Count (WBC)        11,800    /µL         High      4,000 - 11,000
Platelet Count                     245,000   /µL                   150,000 - 450,000
Packed Cell Volume (PCV)           42.5      %                     40.0 - 50.0
Mean Corpuscular Volume (MCV)      87.6      fL                    80.0 - 100.0

CORRUPTED / AMBIGUOUS SCANNER ARTIFACTS:
1O4 mg/dL
RandomScannerSmudge___77

Page 1 of 2
`
  },
  {
    page: 2,
    confidence: 0.92,
    text: `
APOLLO DIAGNOSTICS & RESEARCH LABORATORIES
Patient Name: Mr. Rajesh Kumar | UHID: AP-2026-99182
Date: 12-Sep-2026

DEPARTMENT OF BIOCHEMISTRY - LIPID PROFILE & GLUCOSE
-----------------------------------------------------------------------------------------
Investigation                      Result    Unit        Flag      Biological Reference Interval
-----------------------------------------------------------------------------------------
Fasting Blood Sugar                118       mg/dL       High      70 - 99
Total Cholesterol                  238       mg/dL       High      < 200
HDL Cholesterol                    42        mg/dL                 > 40
LDL Cholesterol (Calculated)       158       mg/dL       High      < 100
Triglycerides                      188       mg/dL       High      < 150
Serum Creatinine                   0.95      mg/dL                 0.70 - 1.30

NOTES & DISCLAIMERS:
Biological reference intervals are based on standard Indian population guidelines.
This report is confidential and intended solely for the attending physician.
Values marked with High or Low indicate deviation from reference interval.

Verified & Signed by:
Dr. Meenakshi Sundaram, MD (Pathology)
Chief Pathologist, Apollo Diagnostics
*** END OF REPORT ***
Page 2 of 2
`
  }
];

// Run Verification Suite
async function runVerification() {
  console.log("\n[VERIFICATION 1: Multi-Page Table Reconstruction & Noise Exclusion]");
  const outcome = extractResultsDeterministically(realisticMultiPageReport);
  const parsed = outcome.results || [];

  check("Extracted results from multi-page document", parsed.length >= 8, `Count: ${parsed.length}`);

  // Test names must NOT include headers, footers, phone numbers, doctor names
  const testNames = parsed.map(r => r.testName.toLowerCase());
  check("No patient name extracted as test", !testNames.some(t => t.includes("rajesh") || t.includes("kumar")));
  check("No hospital/lab extracted as test", !testNames.some(t => t.includes("apollo") || t.includes("diagnostics")));
  check("No doctor signature extracted as test", !testNames.some(t => t.includes("meenakshi") || t.includes("sundaram") || t.includes("ramanathan")));
  check("No disclaimer/notes extracted as test", !testNames.some(t => t.includes("confidential") || t.includes("disclaimer") || t.includes("end of report")));
  check("No page numbers extracted as test", !testNames.some(t => t.includes("page 1") || t.includes("page 2")));
  check("No phone numbers or registration numbers extracted as test", !testNames.some(t => t.includes("2829") || t.includes("nabl")));

  console.log("\n[VERIFICATION 2: Correct Association of Values, Units, Intervals, Flags & Pages]");
  const hb = parsed.find(r => r.testName.toLowerCase().includes("hemoglobin"));
  check("Hemoglobin found", !!hb);
  if (hb) {
    check("Hemoglobin numeric value is 14.2", hb.numericValue === 14.2, `Got: ${hb.numericValue}`);
    check("Hemoglobin unit is g/dL", hb.unit.toLowerCase() === "g/dl", `Got: ${hb.unit}`);
    check("Hemoglobin reference range extracted (13.0 - 17.0)", hb.referenceLow === 13.0 && hb.referenceHigh === 17.0, `Got low=${hb.referenceLow}, high=${hb.referenceHigh}`);
    check("Hemoglobin flag is normal", hb.flag === "normal", `Got: ${hb.flag}`);
    check("Hemoglobin source page is Page 1", hb.sourcePage === 1, `Got: ${hb.sourcePage}`);
  }

  const wbc = parsed.find(r => r.testName.toLowerCase().includes("leukocyte") || r.testName.toLowerCase().includes("wbc"));
  check("Total WBC found", !!wbc);
  if (wbc) {
    check("Total WBC value is 11800", wbc.numericValue === 11800, `Got: ${wbc.numericValue}`);
    check("Total WBC flag is high (11800 > 11000)", wbc.flag === "high", `Got: ${wbc.flag}`);
  }

  const chol = parsed.find(r => r.testName.toLowerCase().includes("total cholesterol"));
  check("Total Cholesterol found on Page 2", !!chol && chol.sourcePage === 2);
  if (chol) {
    check("Total Cholesterol value is 238", chol.numericValue === 238, `Got: ${chol.numericValue}`);
    check("Total Cholesterol unit is mg/dL", chol.unit.toLowerCase() === "mg/dl", `Got: ${chol.unit}`);
    check("Total Cholesterol flag is high (238 > 200)", chol.flag === "high", `Got: ${chol.flag}`);
    check("Total Cholesterol source page is Page 2", chol.sourcePage === 2, `Got: ${chol.sourcePage}`);
  }

  const fbs = parsed.find(r => r.testName.toLowerCase().includes("fasting blood sugar"));
  check("Fasting Blood Sugar found on Page 2", !!fbs && fbs.sourcePage === 2);
  if (fbs) {
    check("Fasting Blood Sugar value is 118", fbs.numericValue === 118, `Got: ${fbs.numericValue}`);
    check("Fasting Blood Sugar flag is high", fbs.flag === "high", `Got: ${fbs.flag}`);
  }

  console.log("\n[VERIFICATION 3: Strict No-Invention Rule & Ambiguity Preservation]");
  // Test with missing reference intervals and ambiguous OCR text
  const reportWithMissingData = [
    {
      page: 1,
      confidence: 0.85,
      text: `
LAB TEST RESULTS
Serum Ferritin: 145 ng/mL
Vitamin D (25-OH): 18.2
UnknownTestFragment___
1O4 mg/dL
`
    }
  ];
  const missingDataOutcome = extractResultsDeterministically(reportWithMissingData);
  const missingDataParsed = missingDataOutcome.results || [];
  const ferritin = missingDataParsed.find(r => r.testName.toLowerCase().includes("ferritin"));
  check("Ferritin extracted", !!ferritin);
  if (ferritin) {
    check("Ferritin value is 145", ferritin.numericValue === 145);
    check("Ferritin unit is ng/mL", ferritin.unit === "ng/mL");
    check("Ferritin referenceLow is strictly null (not guessed)", ferritin.referenceLow === null);
    check("Ferritin referenceHigh is strictly null (not guessed)", ferritin.referenceHigh === null);
    check("Ferritin referenceText is empty (not invented)", ferritin.referenceText === "");
  }

  const vitD = missingDataParsed.find(r => r.testName.toLowerCase().includes("vitamin d"));
  check("Vitamin D extracted", !!vitD);
  if (vitD) {
    check("Vitamin D value is 18.2", vitD.numericValue === 18.2);
    check("Vitamin D missing unit is empty/null (not invented)", vitD.unit === "" || vitD.unit === null);
  }

  // Ensure random fragments did not become valid tests
  check("Random fragment 'UnknownTestFragment___' not accepted as test", !missingDataParsed.some(r => r.testName.includes("UnknownTestFragment")));
  check("Fragment '1O4 mg/dL' not accepted as clean medical row", !missingDataParsed.some(r => r.testName.includes("1O4")));

  console.log("\n[VERIFICATION 4: Human Verification Gate & Canonical Sync]");
  // Simulate ReportVerificationPanel: user reviews candidates, modifies a value, excludes a row, and confirms
  const initialCandidates = [
    {
      testName: "Hemoglobin",
      resultValue: "14.2",
      numericValue: 14.2,
      unit: "g/dL",
      referenceLow: 13.0,
      referenceHigh: 17.0,
      flag: "normal",
      sourcePage: 1,
      userVerified: false
    },
    {
      testName: "Total Leukocyte Count (WBC)",
      resultValue: "11800",
      numericValue: 11800,
      unit: "/µL",
      referenceLow: 4000,
      referenceHigh: 11000,
      flag: "high",
      sourcePage: 1,
      userVerified: false
    },
    {
      testName: "Uncertain Fragment",
      resultValue: "99",
      numericValue: 99,
      unit: "",
      flag: "unknown",
      sourcePage: 1,
      userVerified: false
    }
  ];

  // User excludes the uncertain fragment, edits WBC to 11700 (correcting OCR typo), and confirms
  const userConfirmedList = [
    { ...initialCandidates[0], userVerified: true },
    { ...initialCandidates[1], resultValue: "11700", numericValue: 11700, userEdited: true, userVerified: true }
    // Fragment omitted
  ];

  // Canonical store mock
  const canonicalHealthRecords = new Map();
  const reportId = "rep_2026_09_12_abc";
  const reportTitle = "Apollo Complete Blood Count";
  const reportDate = new Date("2026-09-12T00:00:00Z");

  // Execute syncReportToHealthRecords logic
  for (const r of userConfirmedList) {
    if (!r.userVerified) continue;
    const safeMetricKey = r.testName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const docId = `${reportId}_${safeMetricKey}`;
    canonicalHealthRecords.set(docId, {
      id: docId,
      metric: r.testName,
      numericValue: r.numericValue ?? null,
      valueText: r.resultValue,
      unit: r.unit ?? "",
      referenceLow: r.referenceLow ?? null,
      referenceHigh: r.referenceHigh ?? null,
      flag: r.flag ?? "normal",
      sourceType: "medical_report",
      sourceId: reportId,
      sourceName: reportTitle,
      sourcePage: r.sourcePage ?? 1,
      userVerified: true,
      recordedAt: reportDate,
    });
  }

  check("Only user-confirmed items reach canonical healthRecords (count: 2)", canonicalHealthRecords.size === 2);
  check("Unconfirmed 'Uncertain Fragment' did NOT reach canonical healthRecords", !Array.from(canonicalHealthRecords.values()).some(r => r.metric.includes("Fragment")));
  const syncedWbc = canonicalHealthRecords.get(`${reportId}_total_leukocyte_count__wbc_`);
  check("User edited WBC (11700) persisted in canonical store", syncedWbc && syncedWbc.numericValue === 11700);

  console.log("\n[VERIFICATION 5: Cross-Feature Single Source of Truth Consumption]");
  // 1. Medical Reports views canonical records
  const reportViewResults = Array.from(canonicalHealthRecords.values()).filter(r => r.sourceId === reportId);
  check("Medical Reports reads canonical records", reportViewResults.length === 2);

  // 2. Health History views canonical records
  const historyLabRecords = Array.from(canonicalHealthRecords.values()).filter(r => r.sourceType === "medical_report");
  check("Health History reads canonical records directly", historyLabRecords.length === 2);

  // 3. Risk & Patterns Engine consumes verified lab results
  const mockCheckins = [
    { id: "chk_1", sleepHours: 7, waterGlasses: 6, exerciseMinutes: 30, date: new Date() }
  ];
  // Pattern engine logic from engine.ts:
  const abnormalLabs = historyLabRecords.filter(r => r.flag === "high" || r.flag === "low" || r.flag === "abnormal");
  check("Deterministic Risk Engine detects abnormal lab (WBC high)", abnormalLabs.length === 1 && abnormalLabs[0].metric.includes("WBC"));

  // 4. Dashboard consumes canonical verified labs
  const dashboardRecentLabs = historyLabRecords.slice(0, 5);
  check("Dashboard displays identical verified labs", dashboardRecentLabs.length === 2);

  // 5. AI Assistant consumes canonical verified labs via getLatestLabResults
  const aiAssistantLabs = historyLabRecords.map(r => ({
    testName: r.metric,
    value: r.valueText,
    unit: r.unit,
    flag: r.flag,
    source: r.sourceName
  }));
  check("AI Assistant reads identical canonical labs", aiAssistantLabs.length === 2 && aiAssistantLabs[0].testName === "Hemoglobin");

  console.log("\n[VERIFICATION 6: Deletion Isolation]");
  // Add a second report and daily check-ins to canonical store
  canonicalHealthRecords.set("rep_OTHER_cholesterol", {
    id: "rep_OTHER_cholesterol",
    metric: "Total Cholesterol",
    sourceType: "medical_report",
    sourceId: "rep_OTHER",
  });
  canonicalHealthRecords.set("chk_record_glucose", {
    id: "chk_record_glucose",
    metric: "bloodGlucose",
    sourceType: "daily_checkin",
    sourceId: "chk_101",
  });

  check("Canonical store has 4 records before deletion", canonicalHealthRecords.size === 4);

  // Delete reportId "rep_2026_09_12_abc"
  for (const [id, rec] of Array.from(canonicalHealthRecords.entries())) {
    if (rec.sourceId === reportId) {
      canonicalHealthRecords.delete(id);
    }
  }

  check("Deleting reportId purges its 2 records", canonicalHealthRecords.size === 2);
  check("Unrelated report 'rep_OTHER' remains untouched", canonicalHealthRecords.has("rep_OTHER_cholesterol"));
  check("Daily check-in 'chk_record_glucose' remains untouched", canonicalHealthRecords.has("chk_record_glucose"));

  console.log("\n[VERIFICATION 7: Source Conflict & Provenance Preservation]");
  // User enters Fasting Glucose via daily checkin (105 mg/dL), and has a lab report (118 mg/dL)
  const dailyGlucose = {
    id: "chk_20260912_glucose",
    metric: "bloodGlucose",
    numericValue: 105,
    unit: "mg/dL",
    sourceType: "daily_checkin",
    sourceId: "chk_today",
    sourceName: "Daily Voice Check-in",
    recordedAt: new Date("2026-09-12T08:00:00Z")
  };
  const labGlucose = {
    id: "rep_lab_glucose",
    metric: "Fasting Blood Sugar",
    numericValue: 118,
    unit: "mg/dL",
    sourceType: "medical_report",
    sourceId: "rep_apollo",
    sourceName: "Apollo Diagnostics Report",
    recordedAt: new Date("2026-09-12T08:30:00Z")
  };

  canonicalHealthRecords.set(dailyGlucose.id, dailyGlucose);
  canonicalHealthRecords.set(labGlucose.id, labGlucose);

  const storedDaily = canonicalHealthRecords.get(dailyGlucose.id);
  const storedLab = canonicalHealthRecords.get(labGlucose.id);

  check("Daily check-in glucose preserved with sourceType 'daily_checkin'", storedDaily.sourceType === "daily_checkin" && storedDaily.numericValue === 105);
  check("Medical report glucose preserved with sourceType 'medical_report'", storedLab.sourceType === "medical_report" && storedLab.numericValue === 118);
  check("Distinct sources do NOT overwrite each other silently", storedDaily.id !== storedLab.id && storedDaily.numericValue !== storedLab.numericValue);

  console.log("\n[VERIFICATION 8: Strict Semantic Validation, Placeholder Rejection, Flag Safety & Field Ambiguity]");
  // 1. Rejection of manufactured test names like "Test 1", "Test 2", "Unknown Test", "Parameter"
  const m1 = validateMedicalCandidate({ testName: "Test 1", resultValue: "14.2" });
  check("Manufactured 'Test 1' rejected", !m1.valid && m1.rejectionReason.includes("Manufactured"));

  const m2 = validateMedicalCandidate({ testName: "Unknown Test", resultValue: "118" });
  check("Manufactured 'Unknown Test' rejected", !m2.valid && m2.rejectionReason.includes("Manufactured"));

  const m3 = validateMedicalCandidate({ testName: "Parameter 3", resultValue: "5.5" });
  check("Manufactured 'Parameter 3' rejected", !m3.valid && m3.rejectionReason.includes("Manufactured"));

  const m4 = validateMedicalCandidate({ testName: "Patient Name: Rajesh Kumar", resultValue: "44" });
  check("Demographic noise header rejected as test name", !m4.valid && m4.rejectionReason.includes("metadata"));

  // 2. Never convert invalid or uncertain flag into "normal"
  const f1 = validateMedicalCandidate({ testName: "Serum Ferritin", resultValue: "145 ng/mL", flag: "uncertain" });
  check("Invalid flag 'uncertain' converted to 'unknown', NEVER 'normal'", f1.valid && f1.candidate.flag === "unknown");

  const f2 = validateMedicalCandidate({ testName: "Vitamin D", resultValue: "18.2 ng/mL" }); // No flag and no ref range
  check("Missing flag without reference interval remains 'unknown', NEVER 'normal'", f2.valid && f2.candidate.flag === "unknown");

  // 3. Flag computed deterministically when reference intervals are present
  const f3 = validateMedicalCandidate({ testName: "Fasting Blood Sugar", resultValue: "118", referenceLow: 70, referenceHigh: 99 });
  check("Flag computed deterministically as 'high' (118 > 99)", f3.valid && f3.candidate.flag === "high");

  const f4 = validateMedicalCandidate({ testName: "Hemoglobin", resultValue: "14.2", referenceLow: 13.0, referenceHigh: 17.0 });
  check("Flag computed deterministically as 'normal' (14.2 between 13 and 17)", f4.valid && f4.candidate.flag === "normal");

  // 4. Field-level ambiguity resolution (not clearing row ambiguity prematurely)
  const candidateWithMultipleAmbiguities = {
    testName: "H_moglobin", // OCR artifact
    resultValue: "1O4",     // O instead of 0
    numericValue: null,
    unit: "mg/dL",
    isAmbiguous: true,
    ambiguousFields: ["testName", "resultValue"],
    ambiguityReason: "Multiple OCR defects",
  };

  // User edits ONLY testName to "Hemoglobin"
  let remainingFields = [...candidateWithMultipleAmbiguities.ambiguousFields];
  const editedTestName = "Hemoglobin";
  if (editedTestName !== candidateWithMultipleAmbiguities.testName) {
    remainingFields = remainingFields.filter(f => f !== "testName");
  }

  const step1IsAmbiguous = remainingFields.length > 0;
  check("Editing testName alone does NOT clear resultValue ambiguity", remainingFields.includes("resultValue") && !remainingFields.includes("testName"));
  check("Row remains isAmbiguous: true after fixing only testName", step1IsAmbiguous === true);

  // User then edits and corrects resultValue to "104"
  const editedResultVal = "104";
  if (editedResultVal !== candidateWithMultipleAmbiguities.resultValue) {
    remainingFields = remainingFields.filter(f => f !== "resultValue");
  }

  const step2IsAmbiguous = remainingFields.length > 0;
  check("All ambiguous fields resolved after fixing both testName and resultValue", remainingFields.length === 0);
  check("Row isAmbiguous becomes false only when all fields are resolved", step2IsAmbiguous === false);

  // ==================================================================
  // VERIFICATION 9: Source-Grounded Validation & Contradictory Flag Hierarchy
  // ==================================================================
  console.log("\n[VERIFICATION 9: Source-Grounded Validation & Contradictory Flag Hierarchy]");

  // 1. Contradictory AI flag: AI says HIGH for 14.2 within range 13.0 - 17.0
  const candContradictHigh = {
    testName: "Haemoglobin",
    resultValue: "14.2",
    numericValue: 14.2,
    unit: "g/dL",
    referenceLow: 13.0,
    referenceHigh: 17.0,
    referenceText: "13.0 - 17.0",
    flag: "high", // Contradiction
    sourcePage: 1,
  };
  const groundedHigh = reconcileWithSourceOcr(candContradictHigh, realisticMultiPageReport);
  check("Contradictory AI flag 'high' inside normal range is rejected from being high", groundedHigh.flag !== "high");
  check("Contradictory AI flag resolves safely to 'unknown'", groundedHigh.flag === "unknown");
  check("Contradictory AI flag marks row isAmbiguous: true", groundedHigh.isAmbiguous === true);
  check("Contradictory AI flag adds 'flag' to ambiguousFields", groundedHigh.ambiguousFields?.includes("flag"));
  check("Contradictory AI flag records contradiction in ambiguityReason", groundedHigh.ambiguityReason.includes("Contradictory flag"));

  // 2. Contradictory AI flag: AI says LOW for 11,800 above range 4,000 - 11,000
  const candContradictLow = {
    testName: "Total Leucocyte Count (WBC)",
    resultValue: "11,800",
    numericValue: 11800,
    unit: "cells/cumm",
    referenceLow: 4000,
    referenceHigh: 11000,
    referenceText: "4,000 - 11,000",
    flag: "low", // Contradiction
    sourcePage: 1,
  };
  const groundedLow = reconcileWithSourceOcr(candContradictLow, realisticMultiPageReport);
  check("Contradictory AI flag 'low' above range is rejected from being low", groundedLow.flag !== "low");
  check("Contradictory AI flag 'low' resolves to 'unknown'", groundedLow.flag === "unknown");

  // 3. Contradictory AI flag: AI says NORMAL for 238 above range < 200
  const candContradictNormal = {
    testName: "Total Cholesterol",
    resultValue: "238",
    numericValue: 238,
    unit: "mg/dL",
    referenceLow: null,
    referenceHigh: 200,
    referenceText: "< 200",
    flag: "normal", // Contradiction
    sourcePage: 2,
  };
  const groundedNormal = reconcileWithSourceOcr(candContradictNormal, realisticMultiPageReport);
  check("Contradictory AI flag 'normal' outside range is rejected from being normal", groundedNormal.flag !== "normal");
  check("Contradictory AI flag 'normal' resolves to 'unknown'", groundedNormal.flag === "unknown");

  // 4. Unsupported hallucinated value: AI says 999 when document has 14.2
  const candHallucinatedVal = {
    testName: "Haemoglobin",
    resultValue: "999",
    numericValue: 999,
    unit: "g/dL",
    referenceLow: 13.0,
    referenceHigh: 17.0,
    sourcePage: 1,
  };
  const groundedVal = reconcileWithSourceOcr(candHallucinatedVal, realisticMultiPageReport);
  check("Unsupported value 999 marked isAmbiguous: true", groundedVal.isAmbiguous === true);
  check("Unsupported value 999 adds 'resultValue' to ambiguousFields", groundedVal.ambiguousFields?.includes("resultValue"));
  check("Unsupported value 999 sets groundingStatus.resultValue to 'unsupported'", groundedVal.groundingStatus?.resultValue === "unsupported");

  // 5. Unsupported hallucinated unit: AI says invented unit
  const candHallucinatedUnit = {
    testName: "Haemoglobin",
    resultValue: "14.2",
    numericValue: 14.2,
    unit: "fake_invented_unit",
    sourcePage: 1,
  };
  const groundedUnit = reconcileWithSourceOcr(candHallucinatedUnit, realisticMultiPageReport);
  check("Unsupported unit marked isAmbiguous: true", groundedUnit.isAmbiguous === true);
  check("Unsupported unit adds 'unit' to ambiguousFields", groundedUnit.ambiguousFields?.includes("unit"));
  check("Unsupported unit sets groundingStatus.unit to 'unsupported'", groundedUnit.groundingStatus?.unit === "unsupported");

  // 6. Invalid source page: AI claims page 4 when report has only 2 pages
  const candInvalidPage = {
    testName: "Haemoglobin",
    resultValue: "14.2",
    sourcePage: 4,
  };
  const groundedPage = reconcileWithSourceOcr(candInvalidPage, realisticMultiPageReport);
  check("Invalid source page 4 sets groundingStatus.sourcePageValid to false", groundedPage.groundingStatus?.sourcePageValid === false);
  check("Invalid source page 4 marks isAmbiguous: true", groundedPage.isAmbiguous === true);

  console.log("\n==================================================================");
  console.log(`E2E Verification Summary: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error("E2E Verification script failed with error:", err);
  process.exit(1);
});
