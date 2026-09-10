import type { Timestamp } from "firebase/firestore";

export type TS = Timestamp | Date | null;

export interface UserRoot {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  accountStatus: string;
  createdAt?: TS | undefined;
  updatedAt?: TS | undefined;
  lastActiveAt?: TS | undefined;
}

export interface Profile {
  firstName: string;
  lastName: string;
  dateOfBirth?: TS | undefined;
  gender?: string | undefined;
  heightCm?: number | null | undefined;
  preferredLanguage: string;
  timezone: string;
  createdAt?: TS | undefined;
  updatedAt?: TS | undefined;
}

export interface HealthProfile {
  knownConditions: string[];
  allergies: string[];
  familyHistory: string[];
  currentMedications: string[];
  bloodGroup?: string | undefined;
  baselineWeightKg?: number | null | undefined;
  baselineHeightCm?: number | null | undefined;
  healthPreferences: {
    dietType?: string | undefined;
    exercisePreference?: string | undefined;
    preferredReminderTime?: string | undefined;
  };
  emergencyNotes?: string | undefined;
  updatedAt?: TS | undefined;
}

export type CheckinSource =
  "manual" | "quick_checkin" | "voice" | "conversational" | "ocr" | "file_import" | "device_import";

export type CheckinVerificationStatus = "user_verified" | "unverified";

export interface HealthObservation {
  id?: string | undefined;
  category: string;
  label: string;
  valueText?: string | undefined;
  numericValue?: number | null | undefined;
  unit?: string | undefined;
  temporalContext?: string | undefined;
  severity?: string | undefined;
  confidence: "high" | "medium" | "low";
  sourceText: string;
  userConfirmed?: boolean | undefined;
}

export interface DailyCheckin {
  id?: string | undefined;
  date: TS;
  sleepHours?: number | null | undefined;
  waterGlasses?: number | null | undefined;
  exerciseMinutes?: number | null | undefined;
  exerciseType?: string | undefined;
  foodQuality?: string | undefined;
  weightKg?: number | null | undefined;
  symptoms: string[];
  wellbeing?: string | undefined;
  systolicBP?: number | null | undefined;
  diastolicBP?: number | null | undefined;
  bloodGlucose?: number | null | undefined;
  bloodGlucoseUnit?: string | undefined;
  notes?: string | undefined;
  observations?: HealthObservation[] | undefined;
  tags?: string[] | undefined;
  source?: CheckinSource | undefined;
  verificationStatus?: CheckinVerificationStatus | undefined;
  createdAt?: TS | undefined;
  updatedAt?: TS | undefined;
}

export type OcrStatus = "pending" | "processing" | "completed" | "failed";
export type VerificationStatus = "pending" | "verified" | "rejected";

export interface MedicalReport {
  id?: string | undefined;
  reportTitle: string;
  reportType: string;
  documentType: string;
  reportDate: TS;
  laboratoryName?: string | undefined;
  uploadedAt?: TS | undefined;
  ocrStatus: OcrStatus;
  verificationStatus: VerificationStatus;
  verifiedAt?: TS | undefined;
  localFileId: string;
  pageCount?: number | null | undefined;
  notes?: string | undefined;
}

export interface MedicalResult {
  id?: string | undefined;
  testName: string;
  resultValue: string;
  numericValue?: number | null | undefined;
  unit?: string | undefined;
  referenceLow?: number | null | undefined;
  referenceHigh?: number | null | undefined;
  referenceText?: string | undefined;
  flag?: string | undefined;
  ocrConfidence?: number | null | undefined;
  userVerified: boolean;
  verifiedAt?: TS | undefined;
  sourcePage?: number | null | undefined;
  createdAt?: TS | undefined;
}

export interface HealthRecord {
  id?: string | undefined;
  metric: string;
  numericValue?: number | null | undefined;
  valueText?: string | undefined;
  unit?: string | undefined;
  sourceType: "daily_checkin" | "medical_report" | "verified_manual_entry";
  sourceId: string;
  recordedAt: TS;
  createdAt?: TS | undefined;
}

export interface RiskAssessment {
  id?: string | undefined;
  assessmentType: string;
  riskCategory: string;
  riskLevel: "low" | "moderate" | "high";
  score: number;
  factors: string[];
  sourceRecordIds: string[];
  algorithmVersion: string;
  generatedBy: string;
  createdAt?: TS | undefined;
}

export interface Goal {
  id?: string | undefined;
  goalType: string;
  title: string;
  description?: string | undefined;
  targetValue?: number | null | undefined;
  unit?: string | undefined;
  frequency: string;
  startDate: TS;
  targetDate?: TS | undefined;
  status: "active" | "completed" | "paused" | "cancelled";
  progressValue: number;
  createdAt?: TS | undefined;
  updatedAt?: TS | undefined;
}

export interface AppNotification {
  id?: string | undefined;
  type: string;
  category: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "scheduled" | "delivered" | "read" | "dismissed" | "cancelled";
  scheduledAt?: TS | undefined;
  deliveredAt?: TS | undefined;
  relatedRecordId?: string | undefined;
  createdAt?: TS | undefined;
}

export interface AgentSession {
  id?: string | undefined;
  title: string;
  userIntent: string;
  status: "active" | "completed" | "failed" | "cancelled";
  contextSummary?: string | undefined;
  startedAt?: TS | undefined;
  lastActivityAt?: TS | undefined;
  createdAt?: TS | undefined;
}

export interface AgentMessage {
  id?: string | undefined;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: TS | undefined;
  toolName?: string | undefined;
  toolStatus?: string | undefined;
  relatedRecordIds?: string[] | undefined;
}

export interface SpecialistGuidance {
  id?: string | undefined;
  reason: string;
  suggestedSpecialty: string;
  urgency: string;
  basis: string;
  relatedAssessmentId?: string | undefined;
  userAcknowledged: boolean;
  createdAt?: TS | undefined;
}

export interface SupportRequest {
  id?: string | undefined;
  type: string;
  reason: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "cancelled";
  priority: "low" | "normal" | "high";
  createdAt?: TS | undefined;
  updatedAt?: TS | undefined;
}
