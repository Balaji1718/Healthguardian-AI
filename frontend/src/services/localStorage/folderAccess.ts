import { openDB, type IDBPDatabase } from "idb";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "./documents";

const DB_NAME = "healthguardian-local";
const STORE_HANDLES = "folder_handles";
const HANDLE_KEY = "health_folder_handle";
const STORE_METADATA = "folder_file_meta";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is browser-only");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(d, oldVersion) {
        if (!d.objectStoreNames.contains("documents")) {
          d.createObjectStore("documents", { keyPath: "id" });
        }
        if (!d.objectStoreNames.contains("cache")) {
          d.createObjectStore("cache");
        }
        if (!d.objectStoreNames.contains(STORE_HANDLES)) {
          d.createObjectStore(STORE_HANDLES);
        }
        if (!d.objectStoreNames.contains(STORE_METADATA)) {
          d.createObjectStore(STORE_METADATA, { keyPath: "name" });
        }
      },
    });
  }
  return dbPromise;
}

export interface ConnectedFileEntry {
  name: string;
  size: number;
  lastModified: number;
  type: string;
  isSupported: boolean;
  isNew?: boolean;
  isChanged?: boolean;
  fileHandle?: FileSystemFileHandle;
}

export interface FolderStatus {
  isConnected: boolean;
  hasPermission: boolean;
  folderName: string | null;
  files: ConnectedFileEntry[];
  supportedCount: number;
  newCount: number;
  error?: string | null;
}

export const SUPPORTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

export function isFileSupported(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Check if the browser supports the File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Save directory handle to IndexedDB
 */
export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const d = await getDb();
  await d.put(STORE_HANDLES, handle, HANDLE_KEY);
}

/**
 * Retrieve stored directory handle from IndexedDB
 */
export async function getStoredFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const d = await getDb();
    const handle = (await d.get(STORE_HANDLES, HANDLE_KEY)) as
      FileSystemDirectoryHandle | undefined;
    return handle ?? null;
  } catch (err) {
    console.warn("Could not retrieve folder handle from IndexedDB:", err);
    return null;
  }
}

/**
 * Clear stored directory handle from IndexedDB (Disconnect)
 */
export async function removeFolderHandle(): Promise<void> {
  try {
    const d = await getDb();
    await d.delete(STORE_HANDLES, HANDLE_KEY);
    await d.clear(STORE_METADATA);
  } catch (err) {
    console.warn("Could not remove folder handle:", err);
  }
}

/**
 * Query or request permission for a directory handle
 */
export async function verifyFolderPermission(
  handle: FileSystemDirectoryHandle,
  requestIfNeeded = false,
): Promise<boolean> {
  try {
    const opts = { mode: "read" as const };
    // @ts-expect-error queryPermission exists on FileSystemHandle in modern browsers
    if ((await handle.queryPermission(opts)) === "granted") {
      return true;
    }
    if (requestIfNeeded) {
      // @ts-expect-error requestPermission exists on FileSystemHandle in modern browsers
      if ((await handle.requestPermission(opts)) === "granted") {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn("Failed to check directory permission:", err);
    return false;
  }
}

/**
 * Scan files inside the directory handle and detect new / changed files
 */
export async function scanFolderFiles(
  handle: FileSystemDirectoryHandle,
): Promise<{ files: ConnectedFileEntry[]; newCount: number }> {
  const d = await getDb();
  const knownMeta = new Map<string, { size: number; lastModified: number }>();

  try {
    const allMeta = (await d.getAll(STORE_METADATA)) as Array<{
      name: string;
      size: number;
      lastModified: number;
    }>;
    for (const item of allMeta) {
      knownMeta.set(item.name, { size: item.size, lastModified: item.lastModified });
    }
  } catch {
    // Ignore metadata load errors
  }

  const entries: ConnectedFileEntry[] = [];
  let newCount = 0;

  try {
    // @ts-expect-error values() iterator is supported on FileSystemDirectoryHandle
    for await (const entry of handle.values()) {
      if (entry.kind === "file") {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const supported = isFileSupported(file.name);

        let isNew = false;
        let isChanged = false;

        if (supported) {
          const prev = knownMeta.get(file.name);
          if (!prev) {
            isNew = true;
            newCount++;
          } else if (prev.lastModified !== file.lastModified || prev.size !== file.size) {
            isChanged = true;
          }
        }

        entries.push({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          type: file.type || "application/octet-stream",
          isSupported: supported,
          isNew,
          isChanged,
          fileHandle,
        });
      }
    }
  } catch (err) {
    console.error("Error reading directory contents:", err);
  }

  // Sort files: supported first, then new/changed first, then alphabetical
  entries.sort((a, b) => {
    if (a.isSupported !== b.isSupported) return a.isSupported ? -1 : 1;
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { files: entries, newCount };
}

/**
 * Mark current scanned files as acknowledged in metadata store
 */
export async function acknowledgeFolderFiles(files: ConnectedFileEntry[]): Promise<void> {
  const d = await getDb();
  const tx = d.transaction(STORE_METADATA, "readwrite");
  for (const f of files) {
    if (f.isSupported) {
      await tx.store.put({
        name: f.name,
        size: f.size,
        lastModified: f.lastModified,
        lastSeenAt: Date.now(),
      });
    }
  }
  await tx.done;
}

/**
 * Classify whether document text looks like a Medical Lab Report, Daily Check-in / Lifestyle Info, or Mixed
 */
export function classifyDocumentContent(
  text: string,
): "medical_report" | "daily_checkin" | "mixed" | "unknown" {
  const lower = text.toLowerCase();

  const medicalKeywords = [
    "reference range",
    "haemoglobin",
    "hemoglobin",
    "platelet",
    "cholesterol",
    "triglyceride",
    "creatinine",
    "bilirubin",
    "fasting glucose",
    "hba1c",
    "wbc count",
    "rbc count",
    "pathology",
    "laboratory report",
    "specimen",
    "lipid profile",
    "thyroid",
    "tsh",
    "cbc",
    "complete blood count",
    "differential count",
    "serum",
  ];

  const checkinKeywords = [
    "sleep",
    "hours slept",
    "water intake",
    "glasses of water",
    "exercise",
    "steps",
    "blood pressure",
    "heart rate",
    "daily log",
    "mood",
    "symptoms",
    "feeling",
    "diet",
    "workout",
    "weight",
    "systolic",
    "diastolic",
  ];

  let medScore = 0;
  for (const kw of medicalKeywords) {
    if (lower.includes(kw)) medScore += 2;
  }

  let checkinScore = 0;
  for (const kw of checkinKeywords) {
    if (lower.includes(kw)) checkinScore += 2;
  }

  if (medScore >= 2 && checkinScore >= 2) {
    return "mixed";
  }
  if (medScore >= 2 && medScore > checkinScore) {
    return "medical_report";
  }
  if (checkinScore >= 2 && checkinScore >= medScore) {
    return "daily_checkin";
  }

  return "unknown";
}

export interface DocumentExtractionResult {
  data: {
    sleepHours?: number | null;
    waterGlasses?: number | null;
    exerciseMinutes?: number | null;
    exerciseType?: string | null;
    weightKg?: number | null;
    systolicBP?: number | null;
    diastolicBP?: number | null;
    bloodGlucose?: number | null;
    bloodGlucoseUnit?: "mg/dL" | "mmol/L";
    wellbeing?: string | null;
    symptoms?: string[];
    tags?: string[];
    notes?: string | null;
  };
  fieldConfidence: Record<string, "high" | "medium" | "low">;
  isAmbiguous: boolean;
  ambiguityReasons: string[];
  detectedDate: string | null;
  multiDatesDetected: string[];
  extractedCount: number;
  sourceFilename?: string;
  sourcePage?: number;
}

/**
 * Intelligent deterministic extractor for scanned health documents and tables.
 * Treats text strictly as untrusted data (prompt injection defense).
 */
export function extractDocumentCheckinData(
  text: string,
  filename?: string,
  page?: number,
): DocumentExtractionResult {
  const norm = text || "";
  const lower = norm.toLowerCase();

  const res: DocumentExtractionResult = {
    data: {
      sleepHours: null,
      waterGlasses: null,
      exerciseMinutes: null,
      exerciseType: null,
      weightKg: null,
      systolicBP: null,
      diastolicBP: null,
      bloodGlucose: null,
      bloodGlucoseUnit: "mg/dL",
      wellbeing: null,
      symptoms: [],
      tags: [],
      notes: null,
    },
    fieldConfidence: {},
    isAmbiguous: false,
    ambiguityReasons: [],
    detectedDate: null,
    multiDatesDetected: [],
    extractedCount: 0,
    ...(filename ? { sourceFilename: filename } : {}),
    ...(page != null ? { sourcePage: page } : {}),
  };

  // 1. Date Extraction (ISO, DD Month YYYY, DD/MM/YYYY)
  const datePatterns = [
    /(?:report\s*date|collected|date|specimen\s*date|recorded\s*on)[:\s|]+(\d{4}[-/]\d{1,2}[-/]\d{1,2})/gi,
    /(?:report\s*date|collected|date|specimen\s*date|recorded\s*on)[:\s|]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi,
    /\b(\d{4}-\d{2}-\d{2})\b/g,
  ];

  const foundDates: string[] = [];
  for (const pat of datePatterns) {
    const matches = Array.from(norm.matchAll(pat));
    for (const m of matches) {
      if (m[1]) foundDates.push(m[1].trim());
    }
  }

  const uniqueDates = Array.from(new Set(foundDates));
  if (uniqueDates.length > 1) {
    res.multiDatesDetected = uniqueDates;
    res.isAmbiguous = true;
    res.ambiguityReasons.push(
      `Multiple dates detected (${uniqueDates.slice(0, 3).join(", ")}). Please verify the measurement date.`,
    );
  } else if (uniqueDates.length === 1 && uniqueDates[0]) {
    res.detectedDate = uniqueDates[0];
  }

  // 2. Sleep extraction (table rows, key-value, colon/pipe/tab)
  const sleepMatch =
    norm.match(
      /(?:sleep|hours\s*slept|sleep\s*duration)\s*[:|=|\t]\s*(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)?/i,
    ) ||
    norm.match(/(?:slept|sleep)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)/i) ||
    norm.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|h)\s*(?:of\s*)?sleep/i);

  if (sleepMatch && sleepMatch[1]) {
    res.data.sleepHours = Number(sleepMatch[1]);
    res.fieldConfidence["sleepHours"] = "high";
    res.extractedCount++;
  } else if (
    /(?:sleep|slept)\s*[:|=|\t]?\s*(?:between\s+\d+\s+and\s+\d+|\d+\s*-\s*\d+\s*hours)/i.test(norm)
  ) {
    res.isAmbiguous = true;
    res.ambiguityReasons.push("Sleep duration is specified as a range. Please verify exact hours.");
  }

  // 3. Water extraction
  const waterMatch =
    norm.match(
      /(?:water|water\s*intake|hydration)\s*[:|=|\t]\s*(\d+)\s*(?:glasses|glass|cups|bottles)?/i,
    ) ||
    norm.match(/(\d+)\s*(?:glasses|glass|cups)\s*(?:of\s*)?water/i) ||
    norm.match(/(?:drank|had)\s*(\d+)\s*(?:glasses|glass|cups)\s*(?:of\s*)?water/i);

  if (waterMatch && waterMatch[1]) {
    res.data.waterGlasses = Number(waterMatch[1]);
    res.fieldConfidence["waterGlasses"] = "high";
    res.extractedCount++;
  }

  // 4. Exercise extraction
  const exerciseMatch =
    norm.match(
      /(?:exercise|workout|activity|walking|running)\s*[:|=|\t]\s*(\d+)\s*(?:minutes|mins|min|m)?/i,
    ) ||
    norm.match(/(?:walked|ran|jogged|exercised)\s*(?:for\s*)?(\d+)\s*(?:minutes|mins|m)/i) ||
    norm.match(/(\d+)\s*(?:minutes|mins|m)\s*(?:of\s*)?(?:exercise|walking|running|workout)/i);

  if (exerciseMatch && exerciseMatch[1]) {
    res.data.exerciseMinutes = Number(exerciseMatch[1]);
    res.fieldConfidence["exerciseMinutes"] = "high";
    res.extractedCount++;
  }

  // Exercise type
  if (/\b(walk|walking|walked)\b/i.test(norm)) res.data.exerciseType = "Walking";
  else if (/\b(run|running|ran|jogging)\b/i.test(norm)) res.data.exerciseType = "Running";
  else if (/\b(swim|swimming)\b/i.test(norm)) res.data.exerciseType = "Swimming";
  else if (/\b(gym|strength|weights|workout)\b/i.test(norm))
    res.data.exerciseType = "Strength Training";
  else if (/\b(cycling|bike|biking)\b/i.test(norm)) res.data.exerciseType = "Cycling";

  // 5. Weight extraction (kg / lbs) - Range check takes precedence
  if (
    /(?:weight|wt)\s*[:|=|\t]?\s*(?:approximately\s+\d+|\d+\s*[-–]\s*\d+)/i.test(norm) ||
    /\b\d+\s*[-–]\s*\d+\s*(?:kg|kgs)\b/i.test(norm)
  ) {
    res.isAmbiguous = true;
    res.ambiguityReasons.push(
      "Weight is specified as an approximate range. Please verify exact weight.",
    );
  } else {
    const weightMatch =
      norm.match(/(?:weight|body\s*weight|wt)\s*[:|=|\t]\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)?/i) ||
      norm.match(/\b(?:weight|wt)[:\s]+(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/i) ||
      norm.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs)\b/i);

    if (weightMatch && weightMatch[1]) {
      res.data.weightKg = Number(weightMatch[1]);
      res.fieldConfidence["weightKg"] = "high";
      res.extractedCount++;
    }
  }

  // 6. Blood Pressure parsing (128/82 mmHg or Systolic 128, Diastolic 82 or Table rows)
  const bpSlashMatch =
    norm.match(
      /(?:bp|blood\s*pressure|nibt|vitals|pressure)\s*[:|=|\t|]?\s*(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\s*(?:mmhg)?/i,
    ) || norm.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\s*mmhg\b/i);

  if (bpSlashMatch && bpSlashMatch[1] && bpSlashMatch[2]) {
    res.data.systolicBP = Number(bpSlashMatch[1]);
    res.data.diastolicBP = Number(bpSlashMatch[2]);
    res.fieldConfidence["systolicBP"] = "high";
    res.fieldConfidence["diastolicBP"] = "high";
    res.extractedCount += 2;
  } else {
    const sysMatch = norm.match(/(?:systolic|sys)(?:\s*bp)?\s*[:|=|\t|]+\s*(\d{2,3})/i);
    const diaMatch = norm.match(/(?:diastolic|dia)(?:\s*bp)?\s*[:|=|\t|]+\s*(\d{2,3})/i);
    if (sysMatch && sysMatch[1] && diaMatch && diaMatch[1]) {
      res.data.systolicBP = Number(sysMatch[1]);
      res.data.diastolicBP = Number(diaMatch[1]);
      res.fieldConfidence["systolicBP"] = "high";
      res.fieldConfidence["diastolicBP"] = "high";
      res.extractedCount += 2;
    }
  }

  // 7. Blood Glucose (fasting, random, postprandial) & Table parsing
  // Matches: "Glucose | 104 | mg/dL" or "Blood Glucose: 104 mg/dL" or "Glucose: 1O4 mg/dL" (OCR typo with 'O')
  const glucoseMatch =
    norm.match(
      /(?:fasting\s*glucose|blood\s*glucose|glucose|fbs|rbs|ppbs|sugar)\s*[:|=|\t|]+\s*(\d{2,3}(?:\.\d+)?)\s*(mg\/dl|mmol\/l)?/i,
    ) || norm.match(/(?:glucose|fbs)\s*\|\s*(\d{2,3}(?:\.\d+)?)\s*\|\s*(mg\/dl|mmol\/l)?/i);

  const ocrTypoMatch = norm.match(
    /(?:fasting\s*glucose|blood\s*glucose|glucose)\s*[:|=|\t|]+\s*([0-9oO]{2,3})\s*(mg\/dl|mmol\/l)?/i,
  );

  if (glucoseMatch && glucoseMatch[1]) {
    res.data.bloodGlucose = Number(glucoseMatch[1]);
    res.data.bloodGlucoseUnit = glucoseMatch[2]?.toLowerCase() === "mmol/l" ? "mmol/L" : "mg/dL";
    res.fieldConfidence["bloodGlucose"] = "high";
    res.extractedCount++;
  } else if (ocrTypoMatch && ocrTypoMatch[1] && /[oO]/.test(ocrTypoMatch[1])) {
    // Flag possible OCR letter-digit substitution (e.g. 1O4 -> 104)
    const corrected = Number(ocrTypoMatch[1].replace(/o/gi, "0"));
    if (!Number.isNaN(corrected) && corrected > 30 && corrected < 600) {
      res.data.bloodGlucose = corrected;
      res.data.bloodGlucoseUnit = "mg/dL";
      res.fieldConfidence["bloodGlucose"] = "medium";
      res.isAmbiguous = true;
      res.ambiguityReasons.push(
        `Glucose reading '${ocrTypoMatch[1]}' contains possible OCR character defect. Please verify this value.`,
      );
      res.extractedCount++;
    }
  }

  // 8. Wellbeing & Mood extraction
  if (/\b(feeling great|felt great|super good|amazing)\b/i.test(lower)) {
    res.data.wellbeing = "great";
    res.fieldConfidence["wellbeing"] = "high";
  } else if (/\b(feeling good|felt good|pretty good)\b/i.test(lower)) {
    res.data.wellbeing = "good";
    res.fieldConfidence["wellbeing"] = "high";
  } else if (/\b(feeling okay|felt okay|was okay|fine)\b/i.test(lower)) {
    res.data.wellbeing = "okay";
    res.fieldConfidence["wellbeing"] = "high";
  } else if (/\b(tired|exhausted|fatigued|sleepy)\b/i.test(lower)) {
    res.data.wellbeing = "tired";
    res.fieldConfidence["wellbeing"] = "high";
  } else if (/\b(not great|felt bad|unwell|sick)\b/i.test(lower)) {
    res.data.wellbeing = "not_great";
    res.fieldConfidence["wellbeing"] = "high";
  }

  // 9. Symptoms extraction
  const symptomKeywords: Record<string, string> = {
    headache: "headache",
    fever: "fever",
    cough: "cough",
    nausea: "nausea",
    dizziness: "dizziness",
    fatigue: "fatigue",
    backpain: "back_pain",
    "back pain": "back_pain",
    soreness: "muscle_ache",
  };

  const detectedSymptoms: string[] = [];
  for (const [kw, symKey] of Object.entries(symptomKeywords)) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      if (!detectedSymptoms.includes(symKey)) {
        detectedSymptoms.push(symKey);
      }
    }
  }
  if (detectedSymptoms.length > 0) {
    res.data.symptoms = detectedSymptoms;
    res.fieldConfidence["symptoms"] = "high";
  }

  return res;
}
