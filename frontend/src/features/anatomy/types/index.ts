/**
 * HealthGuardian AI — 3D Anatomical Dashboard Types
 * Defines semantic anatomical region identifiers, controlled status states, and traceability evidence.
 */

export type AnatomicalRegionId =
  | "organ_heart"
  | "organ_lungs"
  | "organ_brain"
  | "organ_liver"
  | "organ_stomach"
  | "organ_pancreas"
  | "organ_spleen"
  | "organ_kidneys"
  | "organ_bladder"
  | "bone_skull"
  | "bone_spine"
  | "bone_ribcage"
  | "bone_pelvis"
  | "bone_limbs"
  | "muscle_system"
  | "body_shell";

export type AnatomicalStatus = "NO_DATA" | "STABLE" | "ATTENTION" | "REVIEW_REQUIRED";

export interface AnatomicalMetricEvidence {
  metricName: string;
  recentValue: string | number;
  unit?: string | undefined;
  source: "Daily Check-in" | "Verified Medical Report" | "Adaptive Trend";
  timestamp?: string | Date | undefined;
  referenceRange?: string | undefined;
  interpretation?: string | undefined;
}

export interface AnatomicalRegionState {
  id: AnatomicalRegionId;
  nameKey: string;
  defaultName: string;
  category: "organ" | "bone" | "muscle" | "shell";
  status: AnatomicalStatus;
  statusLabelKey: string;
  defaultStatusLabel: string;
  whyExplanationKey: string;
  defaultWhyExplanation: string;
  explanation?: string | undefined;
  evidence: AnatomicalMetricEvidence[];
  lastUpdated?: string | undefined;
  hasData: boolean;
  colorHex: string;
  emissiveHex: string;
  system:
    | "cardiovascular"
    | "respiratory"
    | "nervous"
    | "digestive"
    | "metabolic"
    | "renal"
    | "skeletal"
    | "muscular"
    | "general";
}

export type AnatomicalLayerType = "organs" | "skeleton" | "muscles" | "shell";

export interface LayerVisibilityState {
  organs: boolean;
  skeleton: boolean;
  muscles: boolean;
  shell: boolean;
}

export type CameraPreset = "front" | "side" | "back" | "top";
