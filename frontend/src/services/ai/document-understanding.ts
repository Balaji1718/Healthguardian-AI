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

export interface DocumentRegion {
  id: string;
  page: number;
  startLine: number;
  endLine: number;
  span: number;
  text: string;
  normalizedText: string;
  lines: string[];
}

export function normalizeForSearch(str: any): string {
  return String(str || "")
    .toLowerCase()
    .replace(/haem/g, "hem")
    .replace(/leuco/g, "leuko")
    .replace(/[^\w\d.%/<>+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds logical source regions from multi-page document OCR text.
 * Represents:
 * - Single-line regions (individual rows)
 * - Bounded multi-line window regions (spans of 2 to 3 lines) to support
 *   wrapped test names, values on subsequent lines, or wrapped ranges.
 * 
 * Each region preserves line provenance, page number, and source text.
 */
export function buildDocumentRegions(
  pages: Array<{ page: number; text: string; confidence?: number | null }>,
  options: { maxSpan?: number } = { maxSpan: 4 },
): DocumentRegion[] {
  const regions: DocumentRegion[] = [];
  if (!Array.isArray(pages) || pages.length === 0) return regions;

  const maxSpan = options.maxSpan || 4;

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageObj = pages[pIdx];
    const pageNum = pageObj?.page || pIdx + 1;
    const pageText = pageObj?.text || "";

    const rawLines = pageText.split(/\r?\n/);
    const lineEntries: Array<{ lineIndex: number; rawText: string; normalizedText: string; hasNumber: boolean }> = [];

    for (let lIdx = 0; lIdx < rawLines.length; lIdx++) {
      const lineStr = rawLines[lIdx].trim();
      if (lineStr.length > 0) {
        const hasNumber = /\d+(?:\.\d+)?/.test(lineStr);
        lineEntries.push({
          lineIndex: lIdx + 1,
          rawText: lineStr,
          normalizedText: normalizeForSearch(lineStr),
          hasNumber,
        });
      }
    }

    for (let i = 0; i < lineEntries.length; i++) {
      for (let span = 1; span <= maxSpan && i + span <= lineEntries.length; span++) {
        const spanLines = lineEntries.slice(i, i + span);

        // Disallow merging two independent lines that each have their own separate test row
        // If prevLine has a number and currLine starts with an independent test name (3+ letters) followed by a number,
        // they are two distinct test rows and must NOT be merged!
        if (span > 1) {
          let hasCrossRowMerge = false;
          for (let k = 1; k < spanLines.length; k++) {
            const prevLine = spanLines[k - 1];
            const currLine = spanLines[k];
            const prevHasNum = prevLine.hasNumber;
            const isRefContinuation = /^(?:ref|range|biological|interval|normal|adult|female|male|critical|\<|\>)/i.test(currLine.rawText);
            const currHasWordsAndNum = /[a-zA-Z]{3,}/.test(currLine.rawText) && currLine.hasNumber;
            if (prevHasNum && currHasWordsAndNum && !isRefContinuation) {
              hasCrossRowMerge = true;
              break;
            }
          }
          if (hasCrossRowMerge) {
            continue;
          }
        }

        const combinedText = spanLines.map((l) => l.rawText).join(" ");
        const startLine = spanLines[0].lineIndex;
        const endLine = spanLines[spanLines.length - 1].lineIndex;

        regions.push({
          id: `p${pageNum}_L${startLine}${span > 1 ? `-${endLine}` : ""}`,
          page: pageNum,
          startLine,
          endLine,
          span,
          text: combinedText,
          normalizedText: normalizeForSearch(combinedText),
          lines: spanLines.map((l) => l.rawText),
        });
      }
    }
  }

  return regions;
}

/**
 * Tests whether a value is present in a region's normalized text.
 * Checks raw string, numeric float/int, comma formatted thousands (11,800),
 * and comma decimals (14,2).
 */
export function valueMatchesInRegion(valStr: any, numVal: number | null | undefined, regionNorm: string): boolean {
  if (!regionNorm) return false;
  const cleanVal = normalizeForSearch(valStr);
  if (cleanVal && regionNorm.includes(cleanVal)) return true;

  if (numVal !== null && numVal !== undefined && Number.isFinite(numVal)) {
    const numStr = String(numVal);
    const numRegex = new RegExp(`(?:^|\\s)${numStr.replace(".", "\\.")}(?:$|\\s|%)`, "i");
    if (numRegex.test(regionNorm) || regionNorm.includes(numStr)) return true;

    // Thousands comma format e.g. 11800 -> 11,800 or normalized 11 800
    const commaFormatted = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (regionNorm.includes(normalizeForSearch(commaFormatted))) return true;

    // Comma decimal format e.g. 14.2 -> 14,2
    if (numStr.includes(".")) {
      const commaDecimal = numStr.replace(".", ",");
      if (regionNorm.includes(normalizeForSearch(commaDecimal))) return true;
    }
  }

  return false;
}

/**
 * Tests whether a unit is present in a region's normalized text.
 */
export function unitMatchesInRegion(unitStr: any, regionNorm: string): boolean {
  if (!regionNorm || !unitStr) return false;
  const normUnit = normalizeForSearch(unitStr).replace(/µ/g, "u");
  const regWithU = regionNorm.replace(/µ/g, "u");
  if (regWithU.includes(normUnit)) return true;

  // Split tokens for combined units e.g. "cells / cumm"
  const tokens = normUnit.split(" ").filter((t) => t.length > 0 && t !== "/");
  if (tokens.length > 1 && tokens.every((t) => regWithU.includes(t))) {
    return true;
  }

  return false;
}

/**
 * Tests whether a reference range is present in a region's normalized text.
 */
export function referenceMatchesInRegion(candidate: any, regionNorm: string): boolean {
  if (!regionNorm || !candidate) return false;

  const refTextNorm = normalizeForSearch(candidate.referenceText);
  if (refTextNorm && regionNorm.includes(refTextNorm)) return true;

  const lowStr = candidate.referenceLow !== null && candidate.referenceLow !== undefined ? String(candidate.referenceLow) : "";
  const highStr = candidate.referenceHigh !== null && candidate.referenceHigh !== undefined ? String(candidate.referenceHigh) : "";

  if (lowStr && highStr) {
    const lowIdx = regionNorm.indexOf(lowStr);
    if (lowIdx !== -1) {
      const windowNearLow = regionNorm.slice(Math.max(0, lowIdx - 10), lowIdx + 40);
      if (windowNearLow.includes(highStr)) return true;
    }
    const highIdx = regionNorm.indexOf(highStr);
    if (highIdx !== -1) {
      const windowNearHigh = regionNorm.slice(Math.max(0, highIdx - 40), highIdx + 20);
      if (windowNearHigh.includes(lowStr)) return true;
    }
  } else if (highStr && !lowStr) {
    if (
      regionNorm.includes(`< ${highStr}`) ||
      regionNorm.includes(`<${highStr}`) ||
      regionNorm.includes(highStr)
    ) {
      return true;
    }
  } else if (lowStr && !highStr) {
    if (
      regionNorm.includes(`> ${lowStr}`) ||
      regionNorm.includes(`>${lowStr}`) ||
      regionNorm.includes(lowStr)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the anchor source region corresponding to a candidate's test name.
 * Uses contextual row-level scoring (page, value, unit, reference range)
 * to disambiguate repeated identical test names across sections or pages.
 */
export function findAnchorRegion(
  candidate: any,
  regions: DocumentRegion[],
  _pages: any[],
): (DocumentRegion & { isAmbiguousChoice?: boolean }) | null {
  if (!candidate || !Array.isArray(regions) || regions.length === 0) return null;

  const normTestName = normalizeForSearch(candidate.testName);
  if (!normTestName || normTestName.length < 2) return null;

  const testTokens = normTestName.split(" ").filter((t) => t.length > 1);
  const specifiedPage = Number.isInteger(candidate.sourcePage) ? candidate.sourcePage : 1;

  const matchingRegions: Array<{ region: DocumentRegion; score: number; hasExact: boolean }> = [];

  for (const reg of regions) {
    const hasExact = reg.normalizedText.includes(normTestName);
    const hasTokens = testTokens.length > 0 && testTokens.every((tok) => reg.normalizedText.includes(tok));

    if (hasExact || hasTokens) {
      // Anchor must start at or contain the test name in its first line
      const firstLineNorm = normalizeForSearch(reg.lines[0]);
      const startsWithTest = testTokens.length > 0 && testTokens.some((tok) => firstLineNorm.includes(tok));
      if (!startsWithTest && reg.span > 1) {
        continue;
      }

      let score = 0;
      // Exact test name match strongly preferred
      if (hasExact) score += 10;
      else score += 5;

      // Target page alignment
      if (reg.page === specifiedPage) score += 8;

      // Prefer minimal span (compactness) when the region contains the test name
      score += (5 - reg.span);

      // Contextual evidence for multiple identical test names
      if (valueMatchesInRegion(candidate.resultValue, candidate.numericValue, reg.normalizedText)) score += 4;
      if (candidate.unit && unitMatchesInRegion(candidate.unit, reg.normalizedText)) score += 2;
      if (referenceMatchesInRegion(candidate, reg.normalizedText)) score += 2;

      matchingRegions.push({ region: reg, score, hasExact });
    }
  }

  if (matchingRegions.length === 0) return null;

  matchingRegions.sort((a, b) => b.score - a.score);
  const top = matchingRegions[0];

  if (
    matchingRegions.length > 1 &&
    matchingRegions[1].score === top.score &&
    matchingRegions[1].region.page === top.region.page &&
    matchingRegions[1].region.startLine !== top.region.startLine
  ) {
    return { ...top.region, isAmbiguousChoice: true };
  }

  return top.region;
}

/**
 * Reconciles an extracted candidate against the original source OCR pages
 * at the TEST-ROW / REGION level.
 * 
 * Core rule:
 * "The extracted test name, result value, unit, and reference range must be
 *  supported by the same logical source row/region."
 * 
 * Cross-row contamination (e.g. borrowing value, unit, or range from another row)
 * is strictly rejected from being marked source_supported.
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

  // Derive logical source regions across document
  const allRegions = buildDocumentRegions(pages, { maxSpan: 4 });

  // 1. Establish anchor region for testName FIRST
  const anchorRegion = findAnchorRegion(candidate, allRegions, pages);

  if (!anchorRegion) {
    groundingStatus.testName = "unsupported";
    groundingStatus.resultValue = "unsupported";
    groundingStatus.unit = candidate.unit ? "unsupported" : "not_applicable";
    groundingStatus.referenceRange = (candidate.referenceLow !== null && candidate.referenceLow !== undefined ||
      candidate.referenceHigh !== null && candidate.referenceHigh !== undefined ||
      candidate.referenceText)
      ? "unsupported"
      : "not_applicable";
    isAmbiguous = true;
    if (!ambiguousFields.includes("testName")) ambiguousFields.push("testName");
    ambiguityReasons.push(`Test name "${candidate.testName}" is not supported by source OCR`);

    candidate.flag = "unknown";
    candidate.isAmbiguous = isAmbiguous;
    candidate.ambiguousFields = ambiguousFields;
    candidate.ambiguityReason = ambiguityReasons.join("; ");
    candidate.groundingStatus = groundingStatus;
    return candidate;
  }

  // Record anchor region provenance
  candidate.sourceRegion = {
    page: anchorRegion.page,
    startLine: anchorRegion.startLine,
    endLine: anchorRegion.endLine,
    text: anchorRegion.text.trim(),
  };

  if (anchorRegion.isAmbiguousChoice) {
    groundingStatus.testName = "source_ambiguous";
    isAmbiguous = true;
    if (!ambiguousFields.includes("testName")) ambiguousFields.push("testName");
    ambiguityReasons.push(`Multiple identical test name regions found with ambiguous association`);
  } else if (anchorRegion.span > 1) {
    groundingStatus.testName = "partially_supported";
  } else {
    groundingStatus.testName = "source_supported";
  }

  if (anchorRegion.page !== specifiedPage && isPageValid) {
    groundingStatus.testName = "partially_supported";
    ambiguityReasons.push(`Test name "${candidate.testName}" appears on page ${anchorRegion.page}, not page ${specifiedPage}`);
    isAmbiguous = true;
  }

  const regionNorm = anchorRegion.normalizedText;

  // 2. Validate resultValue strictly against the anchor test-row region
  const rawVal = String(candidate.resultValue || "").trim();
  const valInAnchor = valueMatchesInRegion(candidate.resultValue, candidate.numericValue, regionNorm);

  if (valInAnchor) {
    groundingStatus.resultValue = "source_supported";
  } else {
    groundingStatus.resultValue = "unsupported";
    isAmbiguous = true;
    if (!ambiguousFields.includes("resultValue")) ambiguousFields.push("resultValue");
    ambiguityReasons.push(
      `Result value "${rawVal}" is not supported by source OCR in the test row region (page ${anchorRegion.page}, lines ${anchorRegion.startLine}-${anchorRegion.endLine})`
    );
  }

  // 3. Validate unit strictly against the anchor test-row region
  if (candidate.unit && candidate.unit.trim().length > 0) {
    const unitInAnchor = unitMatchesInRegion(candidate.unit, regionNorm);
    if (unitInAnchor) {
      groundingStatus.unit = "source_supported";
    } else {
      groundingStatus.unit = "unsupported";
      isAmbiguous = true;
      if (!ambiguousFields.includes("unit")) ambiguousFields.push("unit");
      ambiguityReasons.push(`Unit "${candidate.unit}" is not supported by source OCR in the test row region`);
    }
  } else {
    groundingStatus.unit = "not_applicable";
  }

  // 4. Validate referenceRange strictly against the anchor test-row region
  const hasRefBounds = candidate.referenceLow !== null && candidate.referenceLow !== undefined ||
    candidate.referenceHigh !== null && candidate.referenceHigh !== undefined ||
    (candidate.referenceText && candidate.referenceText.trim().length > 0);
  if (hasRefBounds) {
    const refInAnchor = referenceMatchesInRegion(candidate, regionNorm);
    if (refInAnchor) {
      groundingStatus.referenceRange = "source_supported";
    } else {
      groundingStatus.referenceRange = "unsupported";
      isAmbiguous = true;
      if (!ambiguousFields.includes("referenceRange")) ambiguousFields.push("referenceRange");
      ambiguityReasons.push(
        `Reference range "${candidate.referenceText || `${candidate.referenceLow}-${candidate.referenceHigh}`}" is not supported by source OCR in the test row region`
      );
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
    const hasPrintedIndicator = printedIndicatorRegex.test(regionNorm);

    if (hasPrintedIndicator && (rawFlag === "high" || rawFlag === "low" || rawFlag === "abnormal")) {
      resolvedFlag = rawFlag as any;
      groundingStatus.flag = "source_supported";
    } else if (rawFlag === "high" || rawFlag === "low" || rawFlag === "abnormal") {
      resolvedFlag = "unknown";
      isAmbiguous = true;
      if (!ambiguousFields.includes("flag")) ambiguousFields.push("flag");
      ambiguityReasons.push(`Flag "${rawFlag}" lacks supporting reference range or printed flag in the test row region`);
      groundingStatus.flag = "unsupported";
    } else if (/positive|reactive|present/i.test(candidate.resultValue) && regionNorm.includes(normalizeForSearch(candidate.resultValue))) {
      resolvedFlag = "abnormal";
      groundingStatus.flag = "source_supported";
    } else if (/negative|non-reactive|absent|nil/i.test(candidate.resultValue) && regionNorm.includes(normalizeForSearch(candidate.resultValue))) {
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
