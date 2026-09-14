import { routeCompletion } from "./ai-provider-router.js";

/**
 * HealthGuardian AI - Semantic Medical Document Understanding Layer
 * 
 * Reconstructs the canonical structure and meaning of lab/medical reports from
 * unstructured OCR text across multiple pages.
 * 
 * Enforces:
 * - Table boundary detection & multi-page stitching
 * - Extraction of test names, values, units, reference intervals, flags
 * - Exclusion of noise, scanner artifacts, patient headers, addresses, disclaimers
 * - Strict NO-INVENTION rule: never invent missing values, ranges, or units
 * - Explicit field-level confidence & ambiguity flagging
 * - Deterministic fallback parser if AI providers are unreachable
 */

const DOCUMENT_UNDERSTANDING_SYSTEM_PROMPT = `You are HealthGuardian's Medical Document Understanding and Normalization Engine.
Your job is to read multi-page OCR output from a clinical or laboratory medical report and reconstruct its clean, structured tabular representation.

CRITICAL INSTRUCTIONS & NEGATIVE CONSTRAINTS (NO-INVENTION RULE):
1. NO INVENTION OF VALUES: Extract ONLY values, units, and reference ranges explicitly supported by the text.
   - If a reference range is not printed on the document, leave referenceLow: null, referenceHigh: null, referenceText: "". DO NOT substitute standard population reference ranges!
   - If a unit is not present, set unit: "". DO NOT manufacture units!
   - If a test name or value is illegible, corrupted, or cannot be safely mapped, set isAmbiguous: true, explain why in ambiguityReason, and list the field in ambiguousFields.
   - NEVER manufacture missing or sequential test names such as "Test 1", "Test 2", "Unknown Test", "Parameter", etc. If an OCR row does not contain a genuine medical test, OMIT IT COMPLETELY.
2. NOISE & METADATA FILTERING:
   - Completely exclude patient demographics (Name, Age, Gender, MRN, Ref By, Date of Collection).
   - Completely exclude laboratory metadata (Lab name, logo, phone, address, doctor signatures, QR codes, registration numbers).
   - Completely exclude legal disclaimers and footer notes ("Values are biological in nature...", "Not valid for medico-legal purposes...").
   - These must NEVER become biomarker test rows!
3. MULTI-COLUMN & MULTI-PAGE TABLE STITCHING:
   - Reports often layout columns as: [TEST NAME] [RESULT] [FLAG / STATUS] [UNIT] [REFERENCE INTERVAL].
   - Tables frequently span across page 1 and page 2, where column headings may only appear on page 1.
   - Reconstruct the rows across pages as one continuous, coherent table.
4. FIELD NORMALIZATION:
   - testName: Standardized clinical test name (e.g. "Hemoglobin", "Total Cholesterol", "Serum Creatinine", "HbA1c", "Fasting Blood Sugar", "TSH", "Platelet Count"). Preserve specific qualifiers like "HDL", "LDL", "Direct", "Total".
   - resultValue: Clean textual representation (e.g., "13.5", "5.8", "Negative", "Trace", "1+").
   - numericValue: Float number if numeric (e.g., 13.5); null if non-numeric (e.g., "Negative").
   - unit: Clean standard unit (e.g. "g/dL", "mg/dL", "%", "U/L", "mmol/L", "cells/cumm", "10^3/µL").
   - referenceLow / referenceHigh: Numeric bounds if a range is stated (e.g. "13.0 - 17.0" -> low: 13.0, high: 17.0; "< 200" -> low: null, high: 200).
   - referenceText: The exact printed reference interval text from the report.
   - flag: "normal" | "high" | "low" | "abnormal" | "unknown" (only if printed e.g. "H", "L", "*", or clearly outside printed range. If uncertain or without reference intervals, leave as "unknown". NEVER convert uncertain flags into "normal").
   - section: The panel or department heading (e.g., "Complete Blood Count", "Lipid Profile", "Renal Function Test", "Biochemistry").
   - sourcePage: Page number (1-indexed) where the test appeared.
   - isAmbiguous: boolean. Set to true if the OCR was fragmented, digits are suspicious (e.g., 'O' vs '0', 'l' vs '1'), or test name was partially cut off.
   - ambiguityReason: Clear explanation if ambiguous, or "" if clear.
   - ambiguousFields: Array of field names that are uncertain, e.g. ["testName"], ["resultValue"], ["referenceRange"], ["unit"].
   - confidence: "high" | "medium" | "low".

OUTPUT FORMAT:
Return pure, valid JSON with this exact schema:
{
  "reportTitle": "Detected or confirmed title (e.g. Complete Blood Count & Lipid Profile)",
  "laboratoryName": "Laboratory name if detected, or null",
  "reportDate": "YYYY-MM-DD or null if not detected",
  "sections": ["Section 1", "Section 2"],
  "results": [
    {
      "testName": "Hemoglobin",
      "resultValue": "14.2",
      "numericValue": 14.2,
      "unit": "g/dL",
      "referenceLow": 13.0,
      "referenceHigh": 17.0,
      "referenceText": "13.0 - 17.0",
      "flag": "normal",
      "section": "Complete Blood Count",
      "sourcePage": 1,
      "confidence": "high",
      "isAmbiguous": false,
      "ambiguityReason": "",
      "ambiguousFields": []
    }
  ],
  "excludedMetadata": [
    "List of filtered non-medical text summaries (e.g. Lab address, Doctor signatures)"
  ],
  "warnings": []
}`;

/**
 * Deterministic fallback extractor for medical reports if AI completion is unavailable.
 */
let testCompletionRouter = null;

export function setTestCompletionRouter(fn) {
  testCompletionRouter = fn;
}

export function clearTestCompletionRouter() {
  testCompletionRouter = null;
}

/**
 * Normalizes text for search and proximity matching.
 * Cleans punctuation, normalizes whitespace, and lowercases.
 */
export function normalizeForSearch(str) {
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
export function buildDocumentRegions(pages, options = { maxSpan: 4 }) {
  const regions = [];
  if (!Array.isArray(pages) || pages.length === 0) return regions;

  const maxSpan = options.maxSpan || 4;

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageObj = pages[pIdx];
    const pageNum = pageObj?.page || pIdx + 1;
    const pageText = pageObj?.text || "";

    const rawLines = pageText.split(/\r?\n/);
    const lineEntries = [];

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
export function valueMatchesInRegion(valStr, numVal, regionNorm) {
  if (!regionNorm) return false;
  const cleanVal = normalizeForSearch(valStr);
  if (cleanVal && regionNorm.includes(cleanVal)) return true;

  if (numVal !== null && numVal !== undefined && Number.isFinite(numVal)) {
    const numStr = String(numVal);
    // Boundary check for numeric string
    const numRegex = new RegExp(`(?:^|\\s)${numStr.replace(".", "\\.")}(?:$|\\s|%)`, "i");
    if (numRegex.test(regionNorm) || regionNorm.includes(numStr)) return true;

    // Comma formatted thousands e.g. 11,800 or 245,000
    const commaFormatted = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (regionNorm.includes(normalizeForSearch(commaFormatted))) return true;

    // Comma decimal OCR substitution e.g. "14,2"
    if (numStr.includes(".")) {
      const commaDecimal = numStr.replace(".", ",");
      if (regionNorm.includes(commaDecimal)) return true;
    }
  }
  return false;
}

/**
 * Tests whether a unit is present in a region's normalized text.
 */
export function unitMatchesInRegion(unitStr, regionNorm) {
  if (!unitStr || !regionNorm) return false;
  const normUnit = normalizeForSearch(unitStr).replace(/µ/g, "u");
  const regNormU = regionNorm.replace(/µ/g, "u");
  return regNormU.includes(normUnit);
}

/**
 * Tests whether a reference range is present in a region's normalized text.
 */
export function referenceMatchesInRegion(candidate, regionNorm) {
  if (!regionNorm) return false;

  // Exact reference text match
  if (candidate.referenceText && candidate.referenceText.trim().length > 0) {
    const refTextNorm = normalizeForSearch(candidate.referenceText);
    if (regionNorm.includes(refTextNorm)) return true;
  }

  const lowStr = candidate.referenceLow !== null && candidate.referenceLow !== undefined
    ? String(candidate.referenceLow)
    : "";
  const highStr = candidate.referenceHigh !== null && candidate.referenceHigh !== undefined
    ? String(candidate.referenceHigh)
    : "";

  // Both bounds specified: must appear together in the same region
  if (lowStr && highStr) {
    if (regionNorm.includes(lowStr) && regionNorm.includes(highStr)) {
      const lowIdx = regionNorm.indexOf(lowStr);
      const textNearLow = regionNorm.slice(Math.max(0, lowIdx - 10), lowIdx + 40);
      if (textNearLow.includes(highStr) || regionNorm.includes(`${lowStr} ${highStr}`)) {
        return true;
      }
    }
  } else if (highStr && !lowStr) {
    // Upper bound only e.g. < 200
    if (regionNorm.includes(`< ${highStr}`) || regionNorm.includes(`<${highStr}`) || regionNorm.includes(highStr)) {
      return true;
    }
  } else if (lowStr && !highStr) {
    // Lower bound only e.g. > 60
    if (regionNorm.includes(`> ${lowStr}`) || regionNorm.includes(`>${lowStr}`) || regionNorm.includes(lowStr)) {
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
export function findAnchorRegion(candidate, regions, pages) {
  if (!candidate || !Array.isArray(regions) || regions.length === 0) return null;

  const normTestName = normalizeForSearch(candidate.testName);
  if (!normTestName || normTestName.length < 2) return null;

  const testTokens = normTestName.split(" ").filter((t) => t.length > 1);
  const specifiedPage = Number.isInteger(candidate.sourcePage) ? candidate.sourcePage : 1;

  // Filter regions containing the test name
  const matchingRegions = [];

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

  // Sort by score descending
  matchingRegions.sort((a, b) => b.score - a.score);

  const top = matchingRegions[0];

  // Disambiguation check for multiple identical test names
  if (
    matchingRegions.length > 1 &&
    matchingRegions[1].score === top.score &&
    matchingRegions[1].region.page === top.region.page &&
    matchingRegions[1].region.startLine !== top.region.startLine
  ) {
    // Both regions are on the same page and equally plausible without distinguishing evidence
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
export function reconcileWithSourceOcr(candidate, pages) {
  if (!candidate || !Array.isArray(pages) || pages.length === 0) {
    return candidate;
  }

  const numPages = pages.length;
  const specifiedPage = Number.isInteger(candidate.sourcePage) ? candidate.sourcePage : 1;
  const isPageValid = specifiedPage >= 1 && specifiedPage <= numPages;

  const groundingStatus = {
    testName: "unsupported",
    resultValue: "unsupported",
    unit: "not_applicable",
    referenceRange: "not_applicable",
    flag: "unknown",
    sourcePageValid: isPageValid,
  };

  const ambiguousFields = Array.isArray(candidate.ambiguousFields)
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
    groundingStatus.referenceRange = (candidate.referenceLow !== null || candidate.referenceHigh !== null || candidate.referenceText)
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
  const hasRefBounds = candidate.referenceLow !== null || candidate.referenceHigh !== null || (candidate.referenceText && candidate.referenceText.trim().length > 0);
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
  // A. Numeric value + valid reference interval -> deterministic math is authoritative.
  //    Contradictory AI flag -> never silently accept AI! Flag becomes "unknown", ambiguousFields includes "flag", contradiction recorded.
  // B. No numeric reference interval -> check if document explicitly printed indicator (e.g. "H", "L", "*").
  // C. Qualitative results (Positive -> abnormal, Negative -> normal) when explicit.
  // D. No reference interval + no printed indicator -> strictly "unknown".
  const rawFlag = String(candidate.flag || "").toLowerCase().trim();
  const num = candidate.numericValue;
  const refLow = candidate.referenceLow;
  const refHigh = candidate.referenceHigh;

  let resolvedFlag = "unknown";

  if (num !== null && (refLow !== null || refHigh !== null)) {
    let mathFlag = "normal";
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
      resolvedFlag = rawFlag;
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
 * Deterministic fallback extractor for medical reports if AI completion is unavailable.
 * Hardened for difficult OCR layouts:
 * - Column spacing, multiple spaces, tabs, pipe delimiters
 * - Common OCR punctuation corruption (comma decimals, formatted thousands)
 * - Section headings & repeated table headers
 * - Wrapped test names and wrapped reference ranges
 * - Strict NO-INVENTION rule
 */
export function extractResultsDeterministically(pages) {
  const UNIT_PATTERNS = [
    "mg/dL", "mg/dl", "g/dL", "g/dl", "mmol/L", "mmol/l", "IU/mL", "IU/ml",
    "U/L", "u/l", "ng/mL", "ng/ml", "pg/mL", "µg/dL", "mcg/dL", "%", "mmHg",
    "cells/µL", "cells/cumm", "10^3/µL", "/µL", "fL", "pg", "mIU/L", "uIU/mL",
  ];
  const unitRegexPart = UNIT_PATTERNS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  const results = [];
  const seenTests = new Set();

  const metadataNoiseRegex = /^(patient|name|age|gender|sex|date|doctor|referred|specimen|sample|barcode|reg|mrn|lab|hospital|page|report|phone|email|address|consultant|pathologist|signature|disclaimer|biological|abnormal|normal|reference|units?|method|department)\b/i;
  const tableHeaderNoiseRegex = /^(test\s*name|investigation|parameter|analyte|test\s*description)[\s|:]+(result|value|observed|findings)/i;

  const testNamePrefixRegex = /^(total|direct|indirect|fasting|fasting\s*blood|random\s*blood|post\s*prandial|serum|blood|urine|mean|red\s*cell|white\s*blood|absolute)\s*$/i;

  for (const pageObj of pages) {
    const pageNum = pageObj.page || 1;
    const text = pageObj.text || "";
    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    // Pre-processing: stitch wrapped lines (wrapped test names or wrapped reference ranges)
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      let current = rawLines[i];

      // Check if current line is a wrapped test name prefix e.g. "Total" or "Fasting Blood"
      if (
        (testNamePrefixRegex.test(current) || (/^[a-zA-Z\s]{2,20}$/.test(current) && !/\d/.test(current) && !metadataNoiseRegex.test(current))) &&
        i + 1 < rawLines.length
      ) {
        const next = rawLines[i + 1];
        if (!metadataNoiseRegex.test(next) && /\d/.test(next)) {
          current = `${current} ${next}`;
          i++;
        }
      }

      // Check if current line ends with a wrapped reference range dash e.g. "150,000 -"
      if (/[-–to<]$/.test(current) && i + 1 < rawLines.length) {
        const next = rawLines[i + 1];
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

      // Section header detection
      if (
        /^(complete blood count|cbc|lipid profile|liver function|renal function|renal profile|kidney function|thyroid profile|urine routine|urine analysis|biochemistry|haematology|hematology|serology)\b/i.test(
          rawLine,
        )
      ) {
        currentSection = rawLine.replace(/[:\-]/g, "").trim();
        continue;
      }

      // Ignore administrative noise and repeated table headers
      if (metadataNoiseRegex.test(rawLine) || tableHeaderNoiseRegex.test(rawLine)) continue;

      // Normalize tabs, pipe delimiters, multiple spaces
      let line = rawLine.replace(/\|/g, "  ").replace(/\t+/g, "  ");

      // Handle comma decimal OCR corruption e.g. "14,2" -> "14.2" (not thousands like "11,800")
      line = line.replace(/(\b\d{1,2}),(\d{1,2}\b)/g, "$1.$2");

      // Extract row: [Test Name] [Value] [Unit?] [Reference Range?]
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

      let refLow = null;
      let refHigh = null;
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

      // Compute flag deterministically
      let flag = "unknown";
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

      const candidate = {
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
        confidence: "medium",
        isAmbiguous: false,
        ambiguityReason: "",
        ambiguousFields: [],
      };

      // Grounding reconciliation
      reconcileWithSourceOcr(candidate, pages);

      results.push(candidate);
    }
  }

  return {
    reportTitle: "Laboratory Report",
    laboratoryName: null,
    reportDate: null,
    sections: Array.from(new Set(results.map((r) => r.section))),
    results,
    excludedMetadata: ["Filtered administrative headers, metadata & scanner noise"],
    warnings: [],
  };
}

/**
 * Strict semantic validation of AI-produced medical rows before they enter review.
 * - Rejects manufactured test names like "Test 1" or placeholders
 * - Rejects non-medical headers, disclaimers, or noise
 * - Enforces flag safety: never converts uncertain/missing flag into "normal"
 * - Normalizes field-level ambiguity tracking
 */
export function validateMedicalCandidate(raw, defaultPage = 1) {
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

  // Reject administrative / demographic noise as test name
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

  // Clean numeric value
  const cleanNumStr = rawResultVal.replace(/,/g, "").replace(/^[<>]=?\s*/, "");
  const num = /^-?\d+(\.\d+)?$/.test(cleanNumStr)
    ? Number.parseFloat(cleanNumStr)
    : (typeof raw.numericValue === "number" && Number.isFinite(raw.numericValue) ? raw.numericValue : null);

  const refLow = typeof raw.referenceLow === "number" && Number.isFinite(raw.referenceLow) ? raw.referenceLow : null;
  const refHigh = typeof raw.referenceHigh === "number" && Number.isFinite(raw.referenceHigh) ? raw.referenceHigh : null;
  const refText = String(raw.referenceText || "").trim();

  // Rule 2: Never convert an invalid/uncertain AI flag into "normal"
  let flag = "unknown";
  const rawFlag = String(raw.flag || "").toLowerCase().trim();

  if (rawFlag === "high" || rawFlag === "low" || rawFlag === "abnormal") {
    flag = rawFlag;
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
  const ambiguousFields = Array.isArray(raw.ambiguousFields)
    ? raw.ambiguousFields.filter((f) => ["testName", "resultValue", "unit", "referenceRange", "flag"].includes(f))
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
      confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "high",
      isAmbiguous,
      ambiguityReason,
      ambiguousFields,
    },
  };
}

/**
 * Main AI document understanding function.
 * Leverages the multi-provider quota-aware router for semantic table reconstruction.
 * Supports injected/mock completion router for deterministic testing without external API costs.
 */
export async function understandMedicalDocument(pages, reportMeta = {}, options = {}) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return {
      reportTitle: reportMeta.reportTitle || "Medical Report",
      laboratoryName: reportMeta.laboratoryName || null,
      reportDate: reportMeta.reportDate || null,
      sections: [],
      results: [],
      excludedMetadata: [],
      warnings: ["No pages provided for document understanding."],
    };
  }

  // Format document text per page
  const formattedPages = pages.map((p, idx) => {
    return `--- PAGE ${p.page || idx + 1} (OCR Confidence: ${Math.round((p.confidence || 0.9) * 100)}%) ---\n${p.text || ""}\n`;
  }).join("\n");

  const userPrompt = `DOCUMENT CONTEXT:
Report Title Provided by User: ${reportMeta.reportTitle || "Unknown"}
Report Type: ${reportMeta.reportType || "General Lab"}
Report Date: ${reportMeta.reportDate || "Not specified"}
Laboratory Name Provided: ${reportMeta.laboratoryName || "Not specified"}

DOCUMENT OCR TEXT:
${formattedPages}

Please analyze this medical document text, reconstruct its table structure, isolate and exclude noise/headers, extract all valid test rows with their exact values, units, reference intervals, and flags, and return the structured JSON.`;

  const routerFn = options.completionRouter || testCompletionRouter || routeCompletion;

  try {
    const aiResponse = await routerFn({
      messages: [
        { role: "system", content: DOCUMENT_UNDERSTANDING_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 3500,
      json: true,
    });

    const responseContent = aiResponse?.content || aiResponse?.text;

    if (aiResponse && (aiResponse.ok !== false) && responseContent) {
      let parsed = null;
      try {
        parsed = JSON.parse(responseContent);
      } catch (e) {
        const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          parsed = JSON.parse(jsonMatch[1]);
        }
      }

      if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
        const cleanedResults = [];
        const validationExcluded = [];

        for (const rawRow of parsed.results) {
          const valRes = validateMedicalCandidate(rawRow);
          if (valRes.valid && valRes.candidate) {
            // Source-grounding reconciliation against original OCR pages
            const groundedCandidate = reconcileWithSourceOcr(valRes.candidate, pages);

            // Rejection rule: If neither testName nor resultValue is supported in the document,
            // reject the row from normal candidate flow as ungrounded hallucination
            if (
              groundedCandidate.groundingStatus?.testName === "unsupported" &&
              groundedCandidate.groundingStatus?.resultValue === "unsupported"
            ) {
              validationExcluded.push(
                `Ungrounded AI hallucination rejected: "${groundedCandidate.testName}" with value "${groundedCandidate.resultValue}" has no support in source OCR.`
              );
              continue;
            }

            cleanedResults.push(groundedCandidate);
          } else if (valRes.rejectionReason) {
            validationExcluded.push(valRes.rejectionReason);
          }
        }

        if (cleanedResults.length > 0) {
          return {
            reportTitle: parsed.reportTitle || reportMeta.reportTitle || "Medical Report",
            laboratoryName: parsed.laboratoryName || reportMeta.laboratoryName || null,
            reportDate: parsed.reportDate || reportMeta.reportDate || null,
            sections: Array.isArray(parsed.sections) ? parsed.sections : Array.from(new Set(cleanedResults.map((r) => r.section))),
            results: cleanedResults,
            excludedMetadata: [
              ...(Array.isArray(parsed.excludedMetadata) ? parsed.excludedMetadata : []),
              ...validationExcluded,
            ],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
            provider: aiResponse.provider || "ai",
          };
        }
      }
    }
  } catch (err) {
    console.warn("AI document understanding failed, executing deterministic fallback:", err?.message || err);
  }

  // Graceful deterministic fallback
  const fallback = extractResultsDeterministically(pages);
  return {
    ...fallback,
    reportTitle: reportMeta.reportTitle || fallback.reportTitle,
    laboratoryName: reportMeta.laboratoryName || fallback.laboratoryName,
    reportDate: reportMeta.reportDate || fallback.reportDate,
    warnings: ["Semantic AI analysis was unavailable. Results were structured using deterministic table heuristics."],
    provider: "deterministic_fallback",
  };
}
