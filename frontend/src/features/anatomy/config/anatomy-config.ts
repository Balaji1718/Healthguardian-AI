import type { AnatomicalRegionId, AnatomicalRegionState } from "../types";

export interface RegionMetadata {
  id: AnatomicalRegionId;
  nameKey: string;
  defaultName: string;
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
  category: "organ" | "bone" | "muscle" | "shell";
  defaultPosition: [number, number, number];
  defaultScale: [number, number, number];
  baseColor: string;
  descriptionKey: string;
  defaultDescription: string;
}

export const ANATOMICAL_REGIONS: Record<AnatomicalRegionId, RegionMetadata> = {
  organ_heart: {
    id: "organ_heart",
    nameKey: "dashboard.anatomy.heart",
    defaultName: "Heart / Cardiovascular",
    system: "cardiovascular",
    category: "organ",
    defaultPosition: [0.03, 0.48, 0.04],
    defaultScale: [1, 1, 1],
    baseColor: "#e11d48", // Crimson Red
    descriptionKey: "dashboard.anatomy.heartDesc",
    defaultDescription:
      "Central cardiovascular pump; related to blood pressure, resting heart rate, and lipid consistency.",
  },
  organ_lungs: {
    id: "organ_lungs",
    nameKey: "dashboard.anatomy.lungs",
    defaultName: "Lungs / Respiratory",
    system: "respiratory",
    category: "organ",
    defaultPosition: [0.0, 0.48, -0.02],
    defaultScale: [1, 1, 1],
    baseColor: "#0ea5e9", // Sky Blue
    descriptionKey: "dashboard.anatomy.lungsDesc",
    defaultDescription:
      "Primary respiratory gas exchange; reflects aerobic exercise capacity and blood oxygenation.",
  },
  organ_brain: {
    id: "organ_brain",
    nameKey: "dashboard.anatomy.brain",
    defaultName: "Brain / Nervous System",
    system: "nervous",
    category: "organ",
    defaultPosition: [0.0, 0.88, 0.02],
    defaultScale: [0.0011, 0.0011, 0.0011], // Scaled from mm to meters
    baseColor: "#a855f7", // Purple
    descriptionKey: "dashboard.anatomy.brainDesc",
    defaultDescription:
      "Central nervous system; associated with sleep duration, circadian regularity, and recorded stress levels.",
  },
  organ_liver: {
    id: "organ_liver",
    nameKey: "dashboard.anatomy.liver",
    defaultName: "Liver / Hepatic",
    system: "digestive",
    category: "organ",
    defaultPosition: [-0.04, 0.36, 0.01],
    defaultScale: [1, 1, 1],
    baseColor: "#b45309", // Warm Amber
    descriptionKey: "dashboard.anatomy.liverDesc",
    defaultDescription:
      "Hepatic metabolic and filtering organ; correlated with verified liver enzyme panels and metabolic markers.",
  },
  organ_stomach: {
    id: "organ_stomach",
    nameKey: "dashboard.anatomy.stomach",
    defaultName: "Stomach & Digestion",
    system: "digestive",
    category: "organ",
    defaultPosition: [0.05, 0.34, 0.02],
    defaultScale: [0.001, 0.001, 0.001],
    baseColor: "#f97316", // Orange
    descriptionKey: "dashboard.anatomy.stomachDesc",
    defaultDescription:
      "Upper gastrointestinal tract; associated with daily meal habits, hydration consistency, and check-in digestive notes.",
  },
  organ_pancreas: {
    id: "organ_pancreas",
    nameKey: "dashboard.anatomy.pancreas",
    defaultName: "Pancreas / Glycemic Control",
    system: "metabolic",
    category: "organ",
    defaultPosition: [0.02, 0.33, 0.01],
    defaultScale: [1, 1, 1],
    baseColor: "#eab308", // Golden Yellow
    descriptionKey: "dashboard.anatomy.pancreasDesc",
    defaultDescription:
      "Endocrine glucose regulation; directly linked to fasting blood glucose and HbA1c lab records.",
  },
  organ_spleen: {
    id: "organ_spleen",
    nameKey: "dashboard.anatomy.spleen",
    defaultName: "Spleen / Immune System",
    system: "general",
    category: "organ",
    defaultPosition: [-0.08, 0.34, -0.02],
    defaultScale: [1, 1, 1],
    baseColor: "#7c3aed",
    descriptionKey: "dashboard.anatomy.spleenDesc",
    defaultDescription:
      "Anatomical spleen reference region. No supported HealthGuardian spleen-specific data is currently available.",
  },
  organ_kidneys: {
    id: "organ_kidneys",
    nameKey: "dashboard.anatomy.kidneys",
    defaultName: "Kidneys / Renal System",
    system: "renal",
    category: "organ",
    defaultPosition: [0.06, 0.3, -0.03],
    defaultScale: [1, 1, 1],
    baseColor: "#06b6d4", // Cyan
    descriptionKey: "dashboard.anatomy.kidneysDesc",
    defaultDescription:
      "Renal fluid and electrolyte filtration; associated with daily water intake and verified creatinine/BUN tests.",
  },
  organ_bladder: {
    id: "organ_bladder",
    nameKey: "dashboard.anatomy.bladder",
    defaultName: "Urinary Bladder",
    system: "renal",
    category: "organ",
    defaultPosition: [0.0, 0.1, 0.02],
    defaultScale: [1, 1, 1],
    baseColor: "#14b8a6", // Teal
    descriptionKey: "dashboard.anatomy.bladderDesc",
    defaultDescription:
      "Lower urinary tract; reflects daily hydration balance and fluid excretion regularity.",
  },
  bone_skull: {
    id: "bone_skull",
    nameKey: "dashboard.anatomy.skull",
    defaultName: "Cranium & Facial Bones",
    system: "skeletal",
    category: "bone",
    defaultPosition: [0.0, 0.88, 0.0],
    defaultScale: [1, 1, 1],
    baseColor: "#e2e8f0", // Bone White
    descriptionKey: "dashboard.anatomy.skullDesc",
    defaultDescription: "Protective cranial structure and facial skeletal framework.",
  },
  bone_spine: {
    id: "bone_spine",
    nameKey: "dashboard.anatomy.spine",
    defaultName: "Vertebral Column / Spine",
    system: "skeletal",
    category: "bone",
    defaultPosition: [0.0, 0.45, -0.04],
    defaultScale: [1, 1, 1],
    baseColor: "#e2e8f0", // Bone White
    descriptionKey: "dashboard.anatomy.spineDesc",
    defaultDescription:
      "Cervical, thoracic, and lumbar axial skeleton; correlates with daily mobility, exercise, and posture.",
  },
  bone_ribcage: {
    id: "bone_ribcage",
    nameKey: "dashboard.anatomy.ribcage",
    defaultName: "Rib Cage & Thorax",
    system: "skeletal",
    category: "bone",
    defaultPosition: [0.0, 0.48, 0.0],
    defaultScale: [1, 1, 1],
    baseColor: "#e2e8f0", // Bone White
    descriptionKey: "dashboard.anatomy.ribcageDesc",
    defaultDescription:
      "Thoracic skeletal enclosure protecting the heart and pulmonary structures.",
  },
  bone_pelvis: {
    id: "bone_pelvis",
    nameKey: "dashboard.anatomy.pelvis",
    defaultName: "Pelvic Girdle",
    system: "skeletal",
    category: "bone",
    defaultPosition: [0.0, 0.15, 0.0],
    defaultScale: [1, 1, 1],
    baseColor: "#e2e8f0", // Bone White
    descriptionKey: "dashboard.anatomy.pelvisDesc",
    defaultDescription:
      "Pelvic bone architecture supporting abdominal viscera and lower limb articulation.",
  },
  bone_limbs: {
    id: "bone_limbs",
    nameKey: "dashboard.anatomy.limbs",
    defaultName: "Limb Skeletal Structure",
    system: "skeletal",
    category: "bone",
    defaultPosition: [0.0, 0.0, 0.0],
    defaultScale: [1, 1, 1],
    baseColor: "#e2e8f0", // Bone White
    descriptionKey: "dashboard.anatomy.limbsDesc",
    defaultDescription:
      "Long bones of upper and lower extremities facilitating daily movement and step activity.",
  },
  muscle_system: {
    id: "muscle_system",
    nameKey: "dashboard.anatomy.muscles",
    defaultName: "Musculoskeletal System",
    system: "muscular",
    category: "muscle",
    defaultPosition: [0.0, 0.0, 0.0],
    defaultScale: [1, 1, 1],
    baseColor: "#f43f5e", // Muscle Rose
    descriptionKey: "dashboard.anatomy.musclesDesc",
    defaultDescription:
      "Major skeletal muscle groups; related to active exercise minutes, step count, and physical fatigue.",
  },
  body_shell: {
    id: "body_shell",
    nameKey: "dashboard.anatomy.bodyShell",
    defaultName: "Translucent Human Shell",
    system: "general",
    category: "shell",
    defaultPosition: [0.0, 0.0, 0.0],
    defaultScale: [1, 1, 1],
    baseColor: "#38bdf8", // Translucent Sky Blue
    descriptionKey: "dashboard.anatomy.bodyShellDesc",
    defaultDescription:
      "Translucent anatomical surface outline providing spatial depth and body context.",
  },
};

export const STATUS_COLORS = {
  NO_DATA: {
    hex: "#64748b", // Slate 500 (Clean, neutral)
    emissive: "#334155",
    badgeVariant: "outline" as const,
    labelKey: "dashboard.anatomy.statusNoData",
    defaultLabel: "No data yet",
  },
  STABLE: {
    hex: "#10b981", // Emerald 500 (Normal, stable)
    emissive: "#059669",
    badgeVariant: "default" as const,
    labelKey: "dashboard.anatomy.statusStable",
    defaultLabel: "Stable Pattern",
  },
  ATTENTION: {
    hex: "#f59e0b", // Amber 500 (Attention)
    emissive: "#d97706",
    badgeVariant: "secondary" as const,
    labelKey: "dashboard.anatomy.statusAttention",
    defaultLabel: "Attention",
  },
  REVIEW_REQUIRED: {
    hex: "#ef4444", // Rose/Red 500 (Review required)
    emissive: "#b91c1c",
    badgeVariant: "destructive" as const,
    labelKey: "dashboard.anatomy.statusReview",
    defaultLabel: "Review Required",
  },
};
