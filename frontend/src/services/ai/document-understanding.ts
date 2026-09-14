import type { MedicalResult } from "@/models";

export type AmbiguousFieldType = "testName" | "resultValue" | "unit" | "referenceRange" | "flag";

export interface StructuredBiomarkerCandidate extends Omit<MedicalResult, "userVerified"> {
  userVerified: boolean;
  section?: string;
  aiConfidence?: "high" | "medium" | "low";
  isAmbiguous?: boolean;
  ambiguityReason?: string;
  ambiguousFields?: AmbiguousFieldType[];
  groundingStatus?: Record<string, string>;
}

export interface DocumentUnderstandingResult {
  ok: boolean;
  reportTitle?: string;
  laboratoryName?: string | null;
  reportDate?: string | null;
  sections?: string[];
  candidates: StructuredBiomarkerCandidate[];
  excludedMetadata?: string[];
  warnings?: string[];
  provider?: string;
  error?: string;
}

/**
 * Reconciles an extracted candidate against the original source OCR pages.
 * Enforces:
 * - Validity of sourcePage within supplied document range
 * - Source evidence for testName, resultValue, unit, and referenceRange
 * - Strict flag-resolution hierarchy (deterministic math overrides AI claims)
 * - Field-level ambiguity tracking and diagnostic reasons
 */
export function reconcileWithSourceOcr(
  candidate: StructuredBiomarkerCandidate,
  pages: Array<{ page: number; text: string; confidence?: number | null }>,
): StructuredBiomarkerCandidate {
  if (!candidate || !Array.isArray(pages) || pages.length === 0) {
    return candidate;
  }

  const numPages = pages.length;
  const specifiedPage = Number.isInteger(candidate.sourcePage) ? (candidate.sourcePage as number) : 1;
  const isPageValid = specifiedPage >= 1 && specifiedPage <= numPages;

  const groundingStatus: Record<string, string> = {
    testName: "unsupported",
    resultValue: "unsupported",
    unit: "not_applicable",
    referenceRange: "not_applicable",
    flag: "unknown",
    sourcePageValid: isPageValid ? "valid" : "invalid",
  };

  const ambiguousFields: AmbiguousFieldType[] = Array.isArray(candidate.ambiguousFields)
    ? [...candidate.ambiguousFields]
    : [];
  let isAmbiguous = Boolean(candidate.isAmbiguous);
  const ambiguityReasons = candidate.ambiguityReason ? [candidate.ambiguityReason] : [];

  if (!isPageValid) {
    isAmbiguous = true;
    if (!ambiguousFields.includes("testName")) ambiguousFields.push("testName");
    ambiguityReasons.push(`Specified source page ${specifiedPage} does not exist in document (document has ${numPages} pages)`);
  }

  const targetPageObj = isPageValid ? pages[specifiedPage - 1] : null;
  const targetPageText = targetPageObj ? (targetPageObj.text || "") : "";
  const allDocText = pages.map((p) => p.text || "").join("\n");

  const normalizeForSearch = (str: any) =>
    String(str || "")
      .toLowerCase()
      .replace(/[^\w\d.%/<>+-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normTarget = normalizeForSearch(targetPageText);
  const normAll = normalizeForSearch(allDocText);

  // 1. Verify testName
  const normTestName = normalizeForSearch(candidate.testName);
  const testTokens = normTestName.split(" ").filter((t) => t.length > 1);

  if (normTarget.includes(normTestName)) {
    groundingStatus.testName = "source_supported";
  } else if (normAll.includes(normTestName)) {
    groundingStatus.testName = "source_supported";
    if (isPageValid && !normTarget.includes(normTestName)) {
      groundingStatus.testName = "partially_supported";
      ambiguityReasons.push(`Test name "${candidate.testName}" appears on another page, not page ${specifiedPage}`);
      isAmbiguous = true;
    }
  } else if (testTokens.length > 0 && testTokens.every((tok) => normTarget.includes(tok) || normAll.includes(tok))) {
    groundingStatus.testName = "partially_supported";
  } else {
    groundingStatus.testName = "unsupported";
    isAmbiguous = true;
    if (!ambiguousFields.includes("testName")) ambiguousFields.push("testName");
    ambiguityReasons.push(`Test name "${candidate.testName}" is not supported by source OCR`);
  }

  // 2. Verify resultValue
  const rawVal = String(candidate.resultValue || "").trim();
  const cleanVal = normalizeForSearch(rawVal);
  const numValStr = candidate.numericValue !== null && candidate.numericValue !== undefined
    ? String(candidate.numericValue)
    : "";
  const commaFormatted = numValStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const valueMatchesInText = (text: string) => {
    if (!text) return false;
    const norm = normalizeForSearch(text);
    if (cleanVal && norm.includes(cleanVal)) return true;
    if (numValStr && norm.includes(numValStr)) return true;
    if (commaFormatted && norm.includes(normalizeForSearch(commaFormatted))) return true;
    if (numValStr.includes(".")) {
      const commaDecimal = numValStr.replace(".", ",");
      if (norm.includes(commaDecimal)) return true;
    }
    return false;
  };

  const targetHasVal = valueMatchesInText(targetPageText);
  const allHasVal = valueMatchesInText(allDocText);

  if (targetHasVal) {
    groundingStatus.resultValue = "source_supported";
  } else if (allHasVal) {
    groundingStatus.resultValue = "partially_supported";
    ambiguityReasons.push(`Result value "${rawVal}" found on a different page than page ${specifiedPage}`);
    isAmbiguous = true;
    if (!ambiguousFields.includes("resultValue")) ambiguousFields.push("resultValue");
  } else {
    groundingStatus.resultValue = "unsupported";
    isAmbiguous = true;
    if (!ambiguousFields.includes("resultValue")) ambiguousFields.push("resultValue");
    ambiguityReasons.push(`Result value "${rawVal}" is not supported by source OCR on page ${specifiedPage}`);
  }

  // 3. Verify unit
  if (candidate.unit && candidate.unit.trim().length > 0) {
    const normUnit = normalizeForSearch(candidate.unit).replace(/µ/g, "u");
    const docWithU = normAll.replace(/µ/g, "u");
    if (docWithU.includes(normUnit)) {
      groundingStatus.unit = "source_supported";
    } else {
      groundingStatus.unit = "unsupported";
      isAmbiguous = true;
      if (!ambiguousFields.includes("unit")) ambiguousFields.push("unit");
      ambiguityReasons.push(`Unit "${candidate.unit}" is not supported by source OCR`);
    }
  } else {
    groundingStatus.unit = "not_applicable";
  }

  // 4. Verify referenceRange
  const hasRefBounds = candidate.referenceLow !== null && candidate.referenceLow !== undefined ||
    candidate.referenceHigh !== null && candidate.referenceHigh !== undefined ||
    (candidate.referenceText && candidate.referenceText.trim().length > 0);
  if (hasRefBounds) {
    const refTextNorm = normalizeForSearch(candidate.referenceText);
    const lowStr = candidate.referenceLow !== null && candidate.referenceLow !== undefined ? String(candidate.referenceLow) : "";
    const highStr = candidate.referenceHigh !== null && candidate.referenceHigh !== undefined ? String(candidate.referenceHigh) : "";

    let refSupported = false;
    if (refTextNorm && normAll.includes(refTextNorm)) {
      refSupported = true;
    } else if (lowStr && highStr) {
      // Both bounds specified: must appear in close proximity (within 35 chars) in source text
      const lowIdx = normAll.indexOf(lowStr);
      if (lowIdx !== -1) {
        const textNearLow = normAll.slice(Math.max(0, lowIdx - 10), lowIdx + 40);
        if (textNearLow.includes(highStr)) {
          refSupported = true;
        }
      }
    } else if (highStr && !lowStr) {
      if (normAll.includes(`< ${highStr}`) || normAll.includes(`<${highStr}`) || normAll.includes(highStr)) {
        refSupported = true;
      }
    } else if (lowStr && !highStr) {
      if (normAll.includes(`> ${lowStr}`) || normAll.includes(`>${lowStr}`) || normAll.includes(lowStr)) {
        refSupported = true;
      }
    }

    if (refSupported) {
      groundingStatus.referenceRange = "source_supported";
    } else {
      groundingStatus.referenceRange = "unsupported";
      isAmbiguous = true;
      if (!ambiguousFields.includes("referenceRange")) ambiguousFields.push("referenceRange");
      ambiguityReasons.push(`Reference range "${candidate.referenceText || `${candidate.referenceLow}-${candidate.referenceHigh}`}" is not supported by source OCR`);
    }
  } else {
    groundingStatus.referenceRange = "not_applicable";
  }

  // 5. Strict Flag-Resolution Hierarchy
  const rawFlag = String(candidate.flag || "").toLowerCase().trim();
  const num = candidate.numericValue ?? null;
  const refLow = candidate.referenceLow ?? null;
  const refHigh = candidate.referenceHigh ?? null;

  let resolvedFlag: "normal" | "high" | "low" | "abnormal" | "unknown" = "unknown";

  if (num !== null && (refLow !== null || refHigh !== null)) {
    let mathFlag: "normal" | "high" | "low" = "normal";
    if (refLow !== null && refHigh !== null) {
      if (num < refLow) mathFlag = "low";
      else if (num > refHigh) mathFlag = "high";
      else mathFlag = "normal";
    } else if (refLow !== null && refHigh === null) {
      if (num < refLow) mathFlag = "low";
      else mathFlag = "normal";
    } else if (refLow === null && refHigh !== null) {
      if (num > refHigh) mathFlag = "high";
      else mathFlag = "normal";
    }

    const isAiContradiction = (
      (rawFlag === "high" && mathFlag !== "high") ||
      (rawFlag === "low" && mathFlag !== "low") ||
      (rawFlag === "normal" && mathFlag !== "normal") ||
      (rawFlag === "abnormal" && mathFlag === "normal")
    );

    if (isAiContradiction) {
      resolvedFlag = "unknown";
      isAmbiguous = true;
      if (!ambiguousFields.includes("flag")) ambiguousFields.push("flag");
      ambiguityReasons.push(
        `Contradictory flag: AI reported "${rawFlag}" but reference range calculation indicates "${mathFlag}"`
      );
      groundingStatus.flag = "contradictory";
    } else {
      resolvedFlag = mathFlag;
      groundingStatus.flag = "calculated";
    }
  } else {
    const printedIndicatorRegex = /\b(high|low|abnormal|\*|\(h\)|\(l\))\b/i;
    const hasPrintedIndicator = printedIndicatorRegex.test(targetPageText);

    if (hasPrintedIndicator && (rawFlag === "high" || rawFlag === "low" || rawFlag === "abnormal")) {
      resolvedFlag = rawFlag as any;
      groundingStatus.flag = "source_supported";
    } else if (rawFlag === "high" || rawFlag === "low" || rawFlag === "abnormal") {
      resolvedFlag = "unknown";
      isAmbiguous = true;
      if (!ambiguousFields.includes("flag")) ambiguousFields.push("flag");
      ambiguityReasons.push(`Flag "${rawFlag}" lacks supporting reference range or printed flag in source document`);
      groundingStatus.flag = "unsupported";
    } else if (/positive|reactive|present/i.test(candidate.resultValue)) {
      resolvedFlag = "abnormal";
      groundingStatus.flag = "source_supported";
    } else if (/negative|non-reactive|absent|nil/i.test(candidate.resultValue)) {
      resolvedFlag = "normal";
      groundingStatus.flag = "source_supported";
    } else {
      resolvedFlag = "unknown";
      groundingStatus.flag = "unknown";
    }
  }

  candidate.flag = resolvedFlag;
  candidate.isAmbiguous = isAmbiguous;
  candidate.ambiguousFields = ambiguousFields;
  candidate.ambiguityReason = ambiguityReasons.join("; ");
  candidate.groundingStatus = groundingStatus;

  return candidate;
}

/**
 * Strict semantic validation of AI-produced or extracted medical rows.
 * - Rejects manufactured test names like "Test 1" or placeholders
 * - Rejects non-medical headers, disclaimers, or noise
 * - Enforces flag safety: never converts uncertain/missing flag into "normal"
 * - Normalizes field-level ambiguity tracking
 */
export function validateMedicalCandidate(
  raw: any,
  defaultPage = 1,
): { valid: boolean; candidate?: StructuredBiomarkerCandidate; rejectionReason?: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, rejectionReason: "Row is not an object" };
  }

  const rawTestName = String(raw.testName || "").trim();
  const rawResultVal = String(raw.resultValue != null ? raw.resultValue : "").trim();

  // Rule 1: Never manufacture missing test names such as "Test 1", "Test 2", "Parameter 3", etc.
  const manufacturedPattern = /^(test|parameter|investigation|sample|biomarker|row|item)\s*\d*$|^(unknown\s*test|unnamed)$/i;
  if (!rawTestName || manufacturedPattern.test(rawTestName)) {
    return { valid: false, rejectionReason: `Manufactured or placeholder test name rejected: "${rawTestName}"` };
  }

  // Reject administrative / demographic noise
  const metadataNoiseRegex = /^(patient|name|age|gender|sex|date|doctor|referred|specimen|sample|barcode|reg|mrn|lab|hospital|page|report|phone|email|address|consultant|pathologist|signature|disclaimer|biological|reference\s*interval|units?|method|department)\b/i;
  if (metadataNoiseRegex.test(rawTestName)) {
    return { valid: false, rejectionReason: `Administrative header/metadata rejected as test: "${rawTestName}"` };
  }

  // Reject adversarial / prompt-injection fragments or code markers
  if (
    /(system\s*override|ignore\s*previous|instruction|fake\s*injected|prompt\s*injection)/i.test(rawTestName) ||
    /[{}"[\]]/.test(rawTestName)
  ) {
    return { valid: false, rejectionReason: `Adversarial or prompt-injection content rejected: "${rawTestName}"` };
  }

  if (rawTestName.length < 2 || /^[^a-zA-Z]+$/.test(rawTestName)) {
    return { valid: false, rejectionReason: `Invalid characters in test name: "${rawTestName}"` };
  }

  if (!rawResultVal || rawResultVal === "---" || rawResultVal === "N/A" || rawResultVal === "-") {
    return { valid: false, rejectionReason: `Missing or empty result value for test "${rawTestName}"` };
  }

  const cleanNumStr = rawResultVal.replace(/,/g, "").replace(/^[<>]=?\s*/, "");
  const num = /^-?\d+(\.\d+)?$/.test(cleanNumStr)
    ? Number.parseFloat(cleanNumStr)
    : (typeof raw.numericValue === "number" && Number.isFinite(raw.numericValue) ? raw.numericValue : null);

  const refLow = typeof raw.referenceLow === "number" && Number.isFinite(raw.referenceLow) ? raw.referenceLow : null;
  const refHigh = typeof raw.referenceHigh === "number" && Number.isFinite(raw.referenceHigh) ? raw.referenceHigh : null;
  const refText = String(raw.referenceText || "").trim();

  // Rule 2: Never convert an invalid/uncertain AI flag into "normal"
  let flag: "normal" | "high" | "low" | "abnormal" | "unknown" = "unknown";
  const rawFlag = String(raw.flag || "").toLowerCase().trim();

  if (rawFlag === "high" || rawFlag === "low" || rawFlag === "abnormal") {
    flag = rawFlag as any;
  } else if (num !== null && (refLow !== null || refHigh !== null)) {
    if (refLow !== null && num < refLow) flag = "low";
    else if (refHigh !== null && num > refHigh) flag = "high";
    else if (refLow !== null && refHigh !== null && num >= refLow && num <= refHigh) flag = "normal";
    else if (refLow !== null && refHigh === null && num >= refLow) flag = "normal";
    else if (refLow === null && refHigh !== null && num <= refHigh) flag = "normal";
  } else if (/positive|reactive|present/i.test(rawResultVal)) {
    flag = "abnormal";
  } else if (/negative|non-reactive|absent|nil/i.test(rawResultVal)) {
    flag = "normal";
  } else if (rawFlag === "normal" && (refLow !== null || refHigh !== null)) {
    flag = "normal";
  } else {
    flag = "unknown";
  }

  // Field-level ambiguity tracking
  const ambiguousFields: AmbiguousFieldType[] = Array.isArray(raw.ambiguousFields)
    ? raw.ambiguousFields.filter((f: any) => ["testName", "resultValue", "unit", "referenceRange", "flag"].includes(f))
    : [];

  let isAmbiguous = Boolean(raw.isAmbiguous);
  let ambiguityReason = String(raw.ambiguityReason || "").trim();

  if (/[_~|\\{}[\]]/.test(rawTestName) || rawTestName.length < 3) {
    if (!ambiguousFields.includes("testName")) ambiguousFields.push("testName");
    isAmbiguous = true;
    if (!ambiguityReason) ambiguityReason = "Test name contains OCR artifacts or unclear characters";
  }

  if (/[oOlI]/.test(rawResultVal) && /\d/.test(rawResultVal)) {
    if (!ambiguousFields.includes("resultValue")) ambiguousFields.push("resultValue");
    isAmbiguous = true;
    if (!ambiguityReason) ambiguityReason = "Value contains possible letter-number OCR confusion (e.g. O instead of 0)";
  }

  if (isAmbiguous && ambiguousFields.length === 0) {
    if (/name/i.test(ambiguityReason)) ambiguousFields.push("testName");
    else if (/value|digit|number/i.test(ambiguityReason)) ambiguousFields.push("resultValue");
    else if (/unit/i.test(ambiguityReason)) ambiguousFields.push("unit");
    else if (/range|interval/i.test(ambiguityReason)) ambiguousFields.push("referenceRange");
    else ambiguousFields.push("resultValue");
  }

  return {
    valid: true,
    candidate: {
      testName: rawTestName,
      resultValue: rawResultVal,
      numericValue: num,
      unit: String(raw.unit || "").trim(),
      referenceLow: refLow,
      referenceHigh: refHigh,
      referenceText: refText,
      flag,
      section: String(raw.section || "General Results").trim(),
      sourcePage: Number.isInteger(raw.sourcePage) ? raw.sourcePage : defaultPage,
      ocrConfidence: typeof raw.ocrConfidence === "number" ? raw.ocrConfidence : 0.95,
      aiConfidence: ["high", "medium", "low"].includes(raw.aiConfidence || raw.confidence)
        ? raw.aiConfidence || raw.confidence
        : "high",
      isAmbiguous,
      ambiguityReason,
      ambiguousFields,
      userVerified: false,
    },
  };
}

/**
 * Universal client-side deterministic table fallback parser if offline
 */
export function extractCandidatesLocally(
  pages: Array<{ page: number; text: string; confidence?: number | null }>,
): StructuredBiomarkerCandidate[] {
  const UNIT_PATTERNS = [
    "mg/dL", "mg/dl", "g/dL", "g/dl", "mmol/L", "mmol/l", "IU/mL", "IU/ml",
    "U/L", "u/l", "ng/mL", "ng/ml", "pg/mL", "µg/dL", "mcg/dL", "%", "mmHg",
    "cells/µL", "cells/cumm", "10^3/µL", "/µL", "fL", "pg", "mIU/L", "uIU/mL",
  ];
  const unitRegexPart = UNIT_PATTERNS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const metadataNoiseRegex = /^(patient|name|age|gender|sex|date|doctor|referred|specimen|sample|barcode|reg|mrn|lab|hospital|page|report|phone|email|address|consultant|pathologist|signature|disclaimer|biological|abnormal|normal|reference|units?|method|department)\b/i;
  const tableHeaderNoiseRegex = /^(test\s*name|investigation|parameter|analyte|test\s*description)[\s|:]+(result|value|observed|findings)/i;
  const testNamePrefixRegex = /^(total|direct|indirect|fasting|post\s*prandial|serum|blood|urine|mean|red\s*cell|white\s*blood|absolute)\s*$/i;

  const results: StructuredBiomarkerCandidate[] = [];
  const seenTests = new Set<string>();

  for (const p of pages) {
    const pageNum = p.page || 1;
    const text = p.text || "";
    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      let current = rawLines[i]!;

      // Check if current line is a wrapped test name prefix e.g. "Total" or "Fasting Blood"
      if (
        (testNamePrefixRegex.test(current) || (/^[a-zA-Z\s]{2,20}$/.test(current) && !/\d/.test(current) && !metadataNoiseRegex.test(current))) &&
        i + 1 < rawLines.length
      ) {
        const next = rawLines[i + 1]!;
        if (!metadataNoiseRegex.test(next) && /\d/.test(next)) {
          current = `${current} ${next}`;
          i++;
        }
      }

      if (/[-–to<]$/.test(current) && i + 1 < rawLines.length) {
        const next = rawLines[i + 1]!;
        if (/^\d/.test(next)) {
          current = `${current} ${next}`;
          i++;
        }
      }

      lines.push(current);
    }

    let currentSection = "General Lab Results";

    for (const rawLine of lines) {
      if (rawLine.length < 3) continue;

      if (/^(complete blood count|cbc|lipid profile|liver function|renal function|renal profile|kidney function|thyroid profile|urine routine|urine analysis|biochemistry|haematology|hematology|serology)\b/i.test(rawLine)) {
        currentSection = rawLine.replace(/[:\-]/g, "").trim();
        continue;
      }

      if (metadataNoiseRegex.test(rawLine) || tableHeaderNoiseRegex.test(rawLine)) continue;

      let line = rawLine.replace(/\|/g, "  ").replace(/\t+/g, "  ");
      line = line.replace(/(\b\d{1,2}),(\d{1,2}\b)/g, "$1.$2");

      const numPatternPart = `(?:[<>]=?\\s*)?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)`;
      const rowPattern = new RegExp(
        `^([A-Za-z][A-Za-z0-9 ()\\-\\./%'+]{2,40}?)[\\s:.\\-]+(${numPatternPart}|Negative|Positive|Trace|Nil|Present|Absent|Reactive|Non-Reactive)\\s*(${unitRegexPart})?\\s*(.*)$`,
        "i",
      );

      const m = rowPattern.exec(line);
      if (!m) continue;

      const rawTestName = (m[1] || "").replace(/\s+/g, " ").trim();
      if (!rawTestName || metadataNoiseRegex.test(rawTestName) || rawTestName.length < 2) continue;

      const testKey = rawTestName.toLowerCase();
      if (seenTests.has(testKey)) continue;
      seenTests.add(testKey);

      const resultValue = (m[2] || "").trim();
      const cleanNumStr = resultValue.replace(/,/g, "").replace(/^[<>]=?\s*/, "");
      const numericVal = /^-?\d+(\.\d+)?$/.test(cleanNumStr) ? Number.parseFloat(cleanNumStr) : null;
      const unit = (m[3] || "").trim();
      const tail = (m[4] || "").trim();

      let refLow: number | null = null;
      let refHigh: number | null = null;
      let refText = "";

      const numGroup = `(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)`;
      const rangeMatch = new RegExp(`(${numGroup})\\s*[-–to]{1,2}\\s*(${numGroup})`, "i").exec(tail);
      const upperOnlyMatch = new RegExp(`(?:<|less than|up to)\\s*(${numGroup})`, "i").exec(tail);
      const lowerOnlyMatch = new RegExp(`(?:>|greater than)\\s*(${numGroup})`, "i").exec(tail);

      if (rangeMatch) {
        refLow = Number.parseFloat(rangeMatch[1].replace(/,/g, ""));
        refHigh = Number.parseFloat(rangeMatch[2].replace(/,/g, ""));
        refText = rangeMatch[0];
      } else if (upperOnlyMatch) {
        refHigh = Number.parseFloat(upperOnlyMatch[1].replace(/,/g, ""));
        refText = upperOnlyMatch[0];
      } else if (lowerOnlyMatch) {
        refLow = Number.parseFloat(lowerOnlyMatch[1].replace(/,/g, ""));
        refText = lowerOnlyMatch[0];
      } else if (tail.length > 0 && tail.length < 30 && /\d/.test(tail)) {
        refText = tail;
      }

      let flag: "normal" | "high" | "low" | "abnormal" | "unknown" = "unknown";
      if (/\b(high|abnormal|\*)\b/i.test(tail)) {
        flag = "high";
      } else if (/\b(low)\b/i.test(tail)) {
        flag = "low";
      } else if (numericVal !== null && (refLow !== null || refHigh !== null)) {
        if (refLow !== null && numericVal < refLow) flag = "low";
        else if (refHigh !== null && numericVal > refHigh) flag = "high";
        else if (refLow !== null && refHigh !== null && numericVal >= refLow && numericVal <= refHigh) flag = "normal";
        else if (refLow !== null && refHigh === null && numericVal >= refLow) flag = "normal";
        else if (refLow === null && refHigh !== null && numericVal <= refHigh) flag = "normal";
      } else if (/positive|reactive|present/i.test(resultValue)) {
        flag = "abnormal";
      } else if (/negative|non-reactive|absent|nil/i.test(resultValue)) {
        flag = "normal";
      }

      const valRes = validateMedicalCandidate(
        {
          testName: rawTestName,
          resultValue,
          numericValue: numericVal,
          unit,
          referenceLow: refLow,
          referenceHigh: refHigh,
          referenceText: refText,
          flag,
          section: currentSection,
          sourcePage: pageNum,
          ocrConfidence: p.confidence ?? 0.9,
          aiConfidence: "medium",
          isAmbiguous: false,
          ambiguityReason: "",
        },
        pageNum,
      );

      if (valRes.valid && valRes.candidate) {
        const grounded = reconcileWithSourceOcr(valRes.candidate, pages);
        results.push(grounded);
      }
    }
  }

  return results;
}

/**
 * Sends multi-page OCR text to the backend semantic document understanding service.
 * Automatically falls back to client-side deterministic table reconstruction if offline.
 */
export async function understandMedicalReport(
  pages: Array<{ page: number; text: string; confidence: number | null }>,
  reportMeta: {
    reportTitle?: string;
    reportType?: string;
    laboratoryName?: string;
    reportDate?: string;
  } = {},
): Promise<DocumentUnderstandingResult> {
  if (!pages || pages.length === 0) {
    return { ok: false, candidates: [], error: "No document pages available to analyze." };
  }

  try {
    const res = await fetch("/api/ai/understand-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pages: pages.map((p) => ({
          page: p.page,
          text: p.text,
          confidence: p.confidence ?? 0.9,
        })),
        reportMeta,
      }),
    });

    if (res.ok) {
      const body = await res.json();
      if (body && body.ok && body.data) {
        const d = body.data;
        const rawResults = Array.isArray(d.results) ? d.results : [];
        const candidates: StructuredBiomarkerCandidate[] = [];
        const rejectedReasons: string[] = [];

        for (const raw of rawResults) {
          const valRes = validateMedicalCandidate(raw);
          if (valRes.valid && valRes.candidate) {
            const grounded = reconcileWithSourceOcr(valRes.candidate, pages);
            if (
              grounded.groundingStatus?.testName === "unsupported" &&
              grounded.groundingStatus?.resultValue === "unsupported"
            ) {
              rejectedReasons.push(
                `Ungrounded AI hallucination rejected: "${grounded.testName}" with value "${grounded.resultValue}" has no support in source OCR.`
              );
              continue;
            }
            candidates.push(grounded);
          } else if (valRes.rejectionReason) {
            rejectedReasons.push(valRes.rejectionReason);
          }
        }

        return {
          ok: true,
          reportTitle: d.reportTitle,
          laboratoryName: d.laboratoryName,
          reportDate: d.reportDate,
          sections: d.sections || [],
          candidates,
          excludedMetadata: [...(d.excludedMetadata || []), ...rejectedReasons],
          warnings: d.warnings || [],
          provider: d.provider,
        };
      }
    }
  } catch (err) {
    console.warn("Backend document understanding request failed; using client fallback:", err);
  }

  // Graceful client-side fallback
  const fallbackCandidates = extractCandidatesLocally(pages);
  return {
    ok: true,
    reportTitle: reportMeta.reportTitle,
    laboratoryName: reportMeta.laboratoryName,
    reportDate: reportMeta.reportDate,
    sections: Array.from(new Set(fallbackCandidates.map((c) => c.section || "General Results"))),
    candidates: fallbackCandidates,
    warnings: ["Processed using local deterministic table heuristics."],
    provider: "local_heuristic_fallback",
  };
}
