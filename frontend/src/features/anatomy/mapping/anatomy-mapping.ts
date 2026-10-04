import type { DailyCheckin, MedicalResult } from "@/models";
import type { DetectedPattern } from "@/features/healthRisk/engine";
import { ANATOMICAL_REGIONS, STATUS_COLORS } from "../config/anatomy-config";
import type {
  AnatomicalMetricEvidence,
  AnatomicalRegionId,
  AnatomicalRegionState,
  AnatomicalStatus,
} from "../types";

/**
 * Deterministically maps existing canonical HealthGuardian records into anatomical region states.
 * Reuses existing check-in entries, verified lab biomarkers, and detected risk patterns without
 * altering health formulas or creating duplicate database collections.
 */
export function mapHealthDataToAnatomy(
  checkins: DailyCheckin[] = [],
  verifiedResults: MedicalResult[] = [],
  patterns: DetectedPattern[] = [],
): Record<AnatomicalRegionId, AnatomicalRegionState> {
  const latestCheckin = checkins[0];
  const regionStates: Partial<Record<AnatomicalRegionId, AnatomicalRegionState>> = {};

  // Helper to format date
  const formatTimestamp = (dateVal?: string | Date | { toDate?: () => Date } | null) => {
    if (!dateVal) return undefined;
    if (
      typeof dateVal === "object" &&
      typeof (dateVal as { toDate?: () => Date }).toDate === "function"
    ) {
      return (dateVal as { toDate: () => Date }).toDate().toLocaleDateString();
    }
    const d = new Date(dateVal as string | Date);
    return isNaN(d.getTime()) ? undefined : d.toLocaleDateString();
  };

  // Helper to find matching verified lab tests by name/synonym
  const findLabTest = (aliases: string[]): MedicalResult | undefined => {
    return verifiedResults.find((r) => {
      const name = (r.testName || "").toLowerCase();
      return aliases.some((alias) => name.includes(alias.toLowerCase()));
    });
  };

  // Helper to find relevant patterns by keyword
  const findPattern = (keywords: string[]): DetectedPattern | undefined => {
    return patterns.find((p) => {
      const text = `${p.factor || ""} ${p.detail || ""}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw.toLowerCase()));
    });
  };

  // 1. HEART / CARDIOVASCULAR
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No cardiovascular readings recorded yet.";

    if (latestCheckin?.systolicBP != null) {
      const sys = latestCheckin.systolicBP;
      const dia = latestCheckin.diastolicBP ?? 80;
      evidence.push({
        metricName: "Blood Pressure",
        recentValue: `${sys}/${dia}`,
        unit: "mmHg",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "< 120/80 mmHg",
        interpretation:
          sys < 120
            ? "Normal blood pressure range"
            : sys <= 129
              ? "Elevated blood pressure"
              : "Above standard resting threshold",
      });

      if (sys >= 140 || dia >= 90) {
        status = "REVIEW_REQUIRED";
        explanation =
          "Recent blood pressure reading is above the standard guideline threshold. Consider discussing persistent readings with your clinician.";
      } else if (sys >= 120 || dia >= 80) {
        status = "ATTENTION";
        explanation =
          "Recent blood pressure is in the elevated range compared to standard resting targets.";
      } else {
        status = "STABLE";
        explanation = "Recent blood pressure reading is within the optimal resting range.";
      }
    }

    // Check for heart rate in checkin
    const hrObservation = latestCheckin?.observations?.find(
      (o) => o.label.toLowerCase().includes("heart") || o.label.toLowerCase().includes("pulse"),
    );
    const restingHr =
      hrObservation?.numericValue ??
      ((latestCheckin as Record<string, unknown> | undefined)?.["restingHeartRate"] as
        number | undefined);

    if (restingHr != null) {
      evidence.push({
        metricName: "Resting Heart Rate",
        recentValue: restingHr,
        unit: hrObservation?.unit || "bpm",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin?.date),
        referenceRange: "60–100 bpm",
      });
    }

    // Check verified lipid panel
    const lipidTest = findLabTest(["cholesterol", "lipid", "ldl", "triglyceride"]);
    if (lipidTest) {
      evidence.push({
        metricName: lipidTest.testName,
        recentValue: lipidTest.resultValue,
        unit: lipidTest.unit,
        source: "Verified Medical Report",
        referenceRange: lipidTest.referenceText,
        interpretation: lipidTest.flag ? `Lab flag: ${lipidTest.flag}` : "Verified lab value",
      });
      if (lipidTest.flag === "high" || lipidTest.flag === "abnormal") {
        status = "REVIEW_REQUIRED";
        explanation = `Verified lab panel includes elevated ${lipidTest.testName}. Review with your physician.`;
      }
    }

    // Check for existing BP pattern
    const bpPattern = findPattern(["bp", "blood pressure", "hypertension"]);
    if (bpPattern && status !== "REVIEW_REQUIRED") {
      status = bpPattern.severity === 2 ? "REVIEW_REQUIRED" : "ATTENTION";
      explanation = bpPattern.detail || "A multi-day blood pressure trend has been identified.";
    }

    regionStates.organ_heart = buildRegionState("organ_heart", status, explanation, evidence);
  }

  // 2. LUNGS / RESPIRATORY
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No pulmonary or respiratory entries recorded yet.";

    if (latestCheckin?.exerciseMinutes != null) {
      const mins = latestCheckin.exerciseMinutes;
      evidence.push({
        metricName: "Physical / Aerobic Activity",
        recentValue: mins,
        unit: "mins",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "≥ 30 mins/day",
        interpretation:
          mins >= 30
            ? "Meets daily physical activity baseline"
            : "Below daily physical activity target",
      });
      status = mins >= 20 ? "STABLE" : "ATTENTION";
      explanation =
        mins >= 20
          ? "Recorded physical activity supports healthy cardiopulmonary ventilation."
          : "Recent physical activity is below standard daily cardiovascular recommendations.";
    }

    regionStates.organ_lungs = buildRegionState("organ_lungs", status, explanation, evidence);
  }

  // 3. BRAIN / NERVOUS SYSTEM
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No sleep or stress records available yet.";

    if (latestCheckin?.sleepHours != null) {
      const sleep = latestCheckin.sleepHours;
      evidence.push({
        metricName: "Sleep Duration",
        recentValue: sleep,
        unit: "hours",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "7–9 hours",
        interpretation:
          sleep >= 7
            ? "Optimal restorative sleep"
            : sleep >= 6
              ? "Mild sleep deficit"
              : "Significant sleep deficit",
      });

      if (sleep < 5.5) {
        status = "ATTENTION";
        explanation =
          "Recent sleep duration was below recommended rest targets. Chronic sleep debt impacts recovery and focus.";
      } else if (sleep >= 7 && sleep <= 9.5) {
        status = "STABLE";
        explanation = "Recent sleep duration meets optimal healthy restoration guidelines.";
      } else {
        status = "STABLE";
        explanation = "Sleep recorded within acceptable baseline limits.";
      }
    }

    const sleepPattern = findPattern(["sleep", "insomnia", "circadian"]);
    if (sleepPattern) {
      status = sleepPattern.severity === 2 ? "REVIEW_REQUIRED" : "ATTENTION";
      explanation = sleepPattern.detail || "A persistent sleep irregularity pattern was detected.";
    }

    regionStates.organ_brain = buildRegionState("organ_brain", status, explanation, evidence);
  }

  // 4. LIVER / HEPATIC
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No verified hepatic or liver function lab tests recorded.";

    const liverTest = findLabTest([
      "alt",
      "ast",
      "sgpt",
      "sgot",
      "bilirubin",
      "albumin",
      "alkaline phosphatase",
    ]);
    if (liverTest) {
      evidence.push({
        metricName: liverTest.testName,
        recentValue: liverTest.resultValue,
        unit: liverTest.unit,
        source: "Verified Medical Report",
        referenceRange: liverTest.referenceText,
        interpretation: liverTest.flag ? `Lab status: ${liverTest.flag}` : "Verified",
      });

      if (liverTest.flag === "high" || liverTest.flag === "abnormal") {
        status = "REVIEW_REQUIRED";
        explanation = `Verified lab report indicates flagged ${liverTest.testName} level. Consult your healthcare provider.`;
      } else {
        status = "STABLE";
        explanation = `Verified ${liverTest.testName} is within normal reference laboratory limits.`;
      }
    }

    regionStates.organ_liver = buildRegionState("organ_liver", status, explanation, evidence);
  }

  // 5. STOMACH & DIGESTIVE TRACT
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No digestive or hydration entries recorded yet.";

    if (latestCheckin?.waterGlasses != null) {
      const glasses = latestCheckin.waterGlasses;
      evidence.push({
        metricName: "Hydration Balance",
        recentValue: glasses,
        unit: "glasses",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "8 glasses/day",
      });
      status = glasses >= 6 ? "STABLE" : "ATTENTION";
      explanation =
        glasses >= 6
          ? "Daily fluid intake supports healthy digestion and metabolic hydration."
          : "Hydration was below the standard 8 glasses recommendation.";
    }

    regionStates.organ_stomach = buildRegionState("organ_stomach", status, explanation, evidence);
  }

  // 6. PANCREAS / GLYCEMIC CONTROL
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No blood glucose or HbA1c records available.";

    // Check check-in glucose
    if (latestCheckin?.bloodGlucose != null) {
      const bg = latestCheckin.bloodGlucose;
      evidence.push({
        metricName: "Fasting Blood Glucose",
        recentValue: bg,
        unit: "mg/dL",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "< 100 mg/dL (fasting)",
      });

      if (bg >= 126) {
        status = "REVIEW_REQUIRED";
        explanation =
          "Recorded blood glucose is in the elevated range. Clinical verification is recommended.";
      } else if (bg >= 100) {
        status = "ATTENTION";
        explanation = "Recorded blood glucose indicates elevated pre-meal glycemic levels.";
      } else {
        status = "STABLE";
        explanation = "Blood glucose reading is within normal fasting guidelines.";
      }
    }

    // Check verified lab HbA1c or Glucose
    const glucoseTest = findLabTest(["glucose", "hba1c", "glycated", "sugar"]);
    if (glucoseTest) {
      evidence.push({
        metricName: glucoseTest.testName,
        recentValue: glucoseTest.resultValue,
        unit: glucoseTest.unit,
        source: "Verified Medical Report",
        referenceRange: glucoseTest.referenceText,
        interpretation: glucoseTest.flag ? `Lab status: ${glucoseTest.flag}` : "Verified",
      });

      if (glucoseTest.flag === "high" || glucoseTest.flag === "abnormal") {
        status = "REVIEW_REQUIRED";
        explanation = `Verified report shows flagged ${glucoseTest.testName}. Medical review advised.`;
      } else if (status === "NO_DATA") {
        status = "STABLE";
        explanation = `Verified ${glucoseTest.testName} is within normal reference limits.`;
      }
    }

    regionStates.organ_pancreas = buildRegionState("organ_pancreas", status, explanation, evidence);
  }

  // 7. KIDNEYS / RENAL SYSTEM
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No renal lab tests or hydration entries recorded.";

    if (latestCheckin?.waterGlasses != null) {
      const glasses = latestCheckin.waterGlasses;
      evidence.push({
        metricName: "Daily Hydration",
        recentValue: glasses,
        unit: "glasses",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "8 glasses/day",
      });
      status = glasses >= 6 ? "STABLE" : "ATTENTION";
      explanation =
        glasses >= 6
          ? "Adequate daily fluid intake facilitates normal kidney filtration."
          : "Low fluid intake recorded. Sufficient hydration is essential for renal health.";
    }

    const renalTest = findLabTest(["creatinine", "egfr", "bun", "urea", "uric acid"]);
    if (renalTest) {
      evidence.push({
        metricName: renalTest.testName,
        recentValue: renalTest.resultValue,
        unit: renalTest.unit,
        source: "Verified Medical Report",
        referenceRange: renalTest.referenceText,
        interpretation: renalTest.flag ? `Lab flag: ${renalTest.flag}` : "Verified",
      });

      if (renalTest.flag === "high" || renalTest.flag === "low" || renalTest.flag === "abnormal") {
        status = "REVIEW_REQUIRED";
        explanation = `Verified lab indicates ${renalTest.testName} outside standard reference limits.`;
      } else {
        status = "STABLE";
        explanation = `Verified ${renalTest.testName} confirms normal renal filtration markers.`;
      }
    }

    regionStates.organ_kidneys = buildRegionState("organ_kidneys", status, explanation, evidence);
  }

  // 7b. SPLEEN: retained as a selectable anatomical region without unsupported health inference.
  regionStates.organ_spleen = buildRegionState(
    "organ_spleen",
    "NO_DATA",
    "No spleen-specific HealthGuardian data is currently supported.",
    [],
  );

  // 8. URINARY BLADDER
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No fluid balance or urinary records available.";

    if (latestCheckin?.waterGlasses != null) {
      evidence.push({
        metricName: "Fluid Intake Consistency",
        recentValue: latestCheckin.waterGlasses,
        unit: "glasses",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
      });
      status = latestCheckin.waterGlasses >= 5 ? "STABLE" : "ATTENTION";
      explanation = "Hydration volume reflects regular fluid circulation.";
    }

    regionStates.organ_bladder = buildRegionState("organ_bladder", status, explanation, evidence);
  }

  // 9. SKELETON & SPINE
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No activity or mobility metrics recorded.";

    if (latestCheckin?.exerciseMinutes != null) {
      evidence.push({
        metricName: "Daily Physical Movement",
        recentValue: latestCheckin.exerciseMinutes,
        unit: "mins",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
      });
      status = "STABLE";
      explanation = "Regular movement maintains joint mobility and bone mineral density.";
    }

    const boneState = buildRegionState("bone_spine", status, explanation, evidence);
    regionStates.bone_spine = boneState;
    regionStates.bone_skull = buildRegionState("bone_skull", status, explanation, evidence);
    regionStates.bone_ribcage = buildRegionState("bone_ribcage", status, explanation, evidence);
    regionStates.bone_pelvis = buildRegionState("bone_pelvis", status, explanation, evidence);
    regionStates.bone_limbs = buildRegionState("bone_limbs", status, explanation, evidence);
  }

  // 10. MUSCULOSKELETAL SYSTEM
  {
    const evidence: AnatomicalMetricEvidence[] = [];
    let status: AnatomicalStatus = "NO_DATA";
    let explanation = "No exercise or step count data logged.";

    if (latestCheckin?.exerciseMinutes != null) {
      const mins = latestCheckin.exerciseMinutes;
      evidence.push({
        metricName: "Exercise Duration",
        recentValue: mins,
        unit: "mins",
        source: "Daily Check-in",
        timestamp: formatTimestamp(latestCheckin.date),
        referenceRange: "≥ 30 mins",
      });
      status = mins >= 25 ? "STABLE" : "ATTENTION";
      explanation =
        mins >= 25
          ? "Active exercise logged; supports muscle tone and metabolic activity."
          : "Recorded exercise time is below daily physical conditioning targets.";
    }

    regionStates.muscle_system = buildRegionState("muscle_system", status, explanation, evidence);
  }

  // 11. BODY TRANSLUCENT SHELL
  {
    regionStates.body_shell = buildRegionState(
      "body_shell",
      "NO_DATA",
      "Anatomical reference envelope for 3D spatial orientation. No direct biometric measurements recorded.",
      [],
    );
  }

  return regionStates as Record<AnatomicalRegionId, AnatomicalRegionState>;
}

function buildRegionState(
  id: AnatomicalRegionId,
  status: AnatomicalStatus,
  explanation: string,
  evidence: AnatomicalMetricEvidence[],
): AnatomicalRegionState {
  const meta = ANATOMICAL_REGIONS[id];
  const colorConfig = STATUS_COLORS[status];
  const hasData = status !== "NO_DATA" && evidence.length > 0;

  const statusLabels: Record<AnatomicalStatus, { key: string; text: string }> = {
    NO_DATA: { key: "dashboard.anatomy.statusNoData", text: "No data yet" },
    STABLE: { key: "dashboard.anatomy.statusStable", text: "Stable Pattern" },
    ATTENTION: { key: "dashboard.anatomy.statusAttention", text: "Attention" },
    REVIEW_REQUIRED: { key: "dashboard.anatomy.statusReview", text: "Review Required" },
  };

  return {
    id,
    nameKey: meta.nameKey,
    defaultName: meta.defaultName,
    category: meta.category,
    status,
    statusLabelKey: statusLabels[status].key,
    defaultStatusLabel: statusLabels[status].text,
    whyExplanationKey: `dashboard.anatomy.why_${id}`,
    defaultWhyExplanation: explanation,
    explanation,
    evidence,
    lastUpdated: evidence[0]?.timestamp ? String(evidence[0].timestamp) : undefined,
    hasData,
    colorHex: colorConfig.hex,
    emissiveHex: colorConfig.emissive,
    system: meta.system,
  };
}
