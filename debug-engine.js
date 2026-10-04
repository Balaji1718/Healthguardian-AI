




/**
 * Deterministic, versioned health pattern + risk engine.
 * No LLM is involved here: arithmetic and pattern detection are local and reproducible.
 */



const asc = (checkins) =>
  [...checkins].sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0));

const series = (checkins, key) =>
  asc(checkins)
    .map((c) => c[key])
    .filter((v) => typeof v === "number" && !Number.isNaN(v));





const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Computes personal evidence only. It deliberately has no clinical thresholds;
 * deterministic safety rules remain in the existing rule engine below.
 */
function calculatePersonalBaseline(
  checkins,
  metric,
  recentCount = 5,
) {
  const minReqs = {
    sleepHours: 5,
    waterGlasses: 5,
    exerciseMinutes: 5,
    weightKg: 3,
    systolicBP: 3,
    diastolicBP: 3,
    bloodGlucose: 3,
  };
  const minReq = minReqs[metric] ?? 5;
  const ordered = asc(checkins);
  const values = ordered
    .map((c) => c[metric])
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  const missingRatio = ordered.length ? 1 - values.length / ordered.length : 1;

  if (values.length < minReq) {
    return {
      metric,
      baseline: null,
      recentMedian: null,
      recentMean: null,
      deviation: null,
      rateOfChange: null,
      direction: "unknown",
      evidenceCount: values.length,
      missingRatio,
      confidence: 0,
    };
  }

  const recent = values.slice(-recentCount);
  const baselineValues = values.slice(0, Math.max(0, values.length - recent.length));

  if (baselineValues.length < ADAPTIVE_CONFIG.minBaselineObservations) {
    return {
      metric,
      baseline: null,
      recentMedian: median(recent),
      recentMean: recent.length
        ? recent.reduce((sum, value) => sum + value, 0) / recent.length
        : null,
      deviation: null,
      rateOfChange: null,
      direction: "unknown",
      evidenceCount: values.length,
      missingRatio,
      confidence: 0,
    };
  }

  const baselineValuesForComparison = baselineValues;
  const baseline = median(baselineValuesForComparison);
  const recentMedian = median(recent);
  const recentMean = recent.length
    ? recent.reduce((sum, value) => sum + value, 0) / recent.length
    : null;
  const deviation = baseline != null && recentMedian != null ? recentMedian - baseline : null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const rateOfChange =
    first != null && last != null && recent.length > 1
      ? (last - first) / (recent.length - 1)
      : null;
  const direction =
    deviation == null ? "unknown" : deviation > 0 ? "up" : deviation < 0 ? "down" : "stable";

  // calculate v2 confidence
  const countScore = Math.min(values.length, 10) / 10;
  const trendScore = rateOfChange != null ? Math.min(Math.abs(rateOfChange) / 2, 1) : 0;
  const confidence = Math.max(
    0,
    Math.min(1, 0.5 * countScore + 0.3 * (1 - missingRatio) + 0.2 * trendScore),
  );

  return {
    metric,
    baseline,
    recentMedian,
    recentMean,
    deviation,
    rateOfChange,
    direction,
    evidenceCount: values.length,
    missingRatio,
    confidence,
  };
}

function calculateAdaptiveEvidence(checkins) {
  return [
    "sleepHours",
    "waterGlasses",
    "exerciseMinutes",
    "weightKg",
    "systolicBP",
    "diastolicBP",
    "bloodGlucose",
  ].map((metric) => calculatePersonalBaseline(checkins, metric ));
}

function detectPatterns(
  checkins,
  verifiedResults = [],
) {
  const patterns = [];
  const t = THRESHOLDS;

  /* sleep */
  const sleepEvidence = calculatePersonalBaseline(checkins, "sleepHours");
  if (
    sleepEvidence.baseline !== null &&
    sleepEvidence.confidence >= ADAPTIVE_CONFIG.uiAlertConfidence
  ) {
    const dev = sleepEvidence.deviation ?? 0;
    if (dev <= -2.5) {
      patterns.push({
        factor: "short_sleep",
        category: "sleep",
        detail: `Recent sleep is ${Math.abs(dev).toFixed(1)}h lower than your usual pattern of ${sleepEvidence.baseline.toFixed(1)}h.`,
        severity: 2,
      });
    } else if (dev <= -1.5) {
      patterns.push({
        factor: "short_sleep",
        category: "sleep",
        detail: `Recent sleep is ${Math.abs(dev).toFixed(1)}h lower than your usual pattern of ${sleepEvidence.baseline.toFixed(1)}h.`,
        severity: 1,
      });
    }
    // Also run decline check
    const sleep = series(checkins, "sleepHours");
    if (sleep.length >= t.checkin.minCheckinsForTrend) {
      const window = sleep.slice(-t.sleep.declineWindow);
      if (
        window.length >= 3 &&
        window[0] - window[window.length - 1] >= t.sleep.declineDeltaHours
      ) {
        patterns.push({
          factor: "sleep_decline",
          category: "sleep",
          detail: `Sleep went from ${window[0]}h to ${window[window.length - 1]}h across your last ${window.length} entries.`,
          severity: 1,
        });
      }
    }
  } else {
    const sleep = series(checkins, "sleepHours");
    if (sleep.length >= t.checkin.minCheckinsForTrend) {
      const window = sleep.slice(-t.sleep.declineWindow);
      if (
        window.length >= 3 &&
        window[0] - window[window.length - 1] >= t.sleep.declineDeltaHours
      ) {
        patterns.push({
          factor: "sleep_decline",
          category: "sleep",
          detail: `Sleep went from ${window[0]}h to ${window[window.length - 1]}h across your last ${window.length} entries.`,
          severity: 1,
        });
      }
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      if (avg < t.sleep.veryLowHours) {
        patterns.push({
          factor: "short_sleep",
          category: "sleep",
          detail: `Average sleep is ${avg.toFixed(1)}h.`,
          severity: 2,
        });
      } else if (avg < t.sleep.lowHours) {
        patterns.push({
          factor: "short_sleep",
          category: "sleep",
          detail: `Average sleep is ${avg.toFixed(1)}h.`,
          severity: 1,
        });
      }
    }
  }

  /* exercise */
  const exerciseEvidence = calculatePersonalBaseline(checkins, "exerciseMinutes");
  if (
    exerciseEvidence.baseline !== null &&
    exerciseEvidence.confidence >= ADAPTIVE_CONFIG.uiAlertConfidence
  ) {
    const dev = exerciseEvidence.deviation ?? 0;
    if (exerciseEvidence.recentMedian === 0) {
      patterns.push({
        factor: "no_activity",
        category: "exercise",
        detail: "No activity logged in recent entries.",
        severity: 2,
      });
    } else if (dev <= -15) {
      patterns.push({
        factor: "low_activity",
        category: "exercise",
        detail: `Recent activity is ${Math.abs(dev).toFixed(0)} min/day below your usual pattern of ${exerciseEvidence.baseline.toFixed(0)} min.`,
        severity: 1,
      });
    }
  } else {
    const ex = series(checkins, "exerciseMinutes");
    if (ex.length >= t.checkin.minCheckinsForTrend) {
      const w = ex.slice(-t.exercise.lowActivityWindow);
      const avg = w.reduce((a, b) => a + b, 0) / w.length;
      if (avg === 0) {
        patterns.push({
          factor: "no_activity",
          category: "exercise",
          detail: "No activity logged in recent entries.",
          severity: 2,
        });
      } else if (avg < t.exercise.inactiveDailyMinutes) {
        patterns.push({
          factor: "low_activity",
          category: "exercise",
          detail: `Average ${avg.toFixed(0)} min/day recently.`,
          severity: 1,
        });
      }
    }
  }

  /* hydration */
  const waterEvidence = calculatePersonalBaseline(checkins, "waterGlasses");
  if (
    waterEvidence.baseline !== null &&
    waterEvidence.confidence >= ADAPTIVE_CONFIG.uiAlertConfidence
  ) {
    const dev = waterEvidence.deviation ?? 0;
    if (dev <= -2.0) {
      patterns.push({
        factor: "low_hydration",
        category: "water",
        detail: `Recent water intake is ${Math.abs(dev).toFixed(1)} glasses below your usual pattern of ${waterEvidence.baseline.toFixed(1)} glasses.`,
        severity: 1,
      });
    }
  } else {
    const water = series(checkins, "waterGlasses");
    if (water.length >= t.checkin.minCheckinsForTrend) {
      const avg = water.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, water.length);
      if (avg < t.water.lowGlasses) {
        patterns.push({
          factor: "low_hydration",
          category: "water",
          detail: `Average ${avg.toFixed(1)} glasses/day.`,
          severity: 1,
        });
      }
    }
  }

  /* weight */
  const weight = series(checkins, "weightKg");
  if (weight.length >= 3) {
    const w = weight.slice(-t.weight.increaseWindow);
    const delta = w[w.length - 1] - w[0];
    if (delta >= t.weight.increaseKg) {
      patterns.push({
        factor: "weight_increase_pattern",
        category: "weight",
        detail: `Weight increased by ${delta.toFixed(1)} kg across your last ${w.length} recorded entries.`,
        severity: 1,
      });
    }
  }

  /* blood pressure */
  const recent = asc(checkins).slice(-10);
  const highBp = recent.filter(
    (c) =>
      (typeof c.systolicBP === "number" && c.systolicBP >= t.bloodPressure.elevatedSystolic) ||
      (typeof c.diastolicBP === "number" && c.diastolicBP >= t.bloodPressure.elevatedDiastolic),
  );
  if (highBp.length >= 2) {
    const severe = highBp.some(
      (c) =>
        (c.systolicBP ?? 0) >= t.bloodPressure.highSystolic ||
        (c.diastolicBP ?? 0) >= t.bloodPressure.highDiastolic,
    );
    patterns.push({
      factor: "elevated_blood_pressure",
      category: "vitals",
      detail: `${highBp.length} readings above the usual range.`,
      severity: severe ? 2 : 1,
    });
  }

  /* glucose (mg/dL only; mmol/L is converted) */
  const glucose = recent
    .filter((c) => typeof c.bloodGlucose === "number")
    .map((c) => (c.bloodGlucoseUnit === "mmol/L" ? c.bloodGlucose * 18 : c.bloodGlucose));
  const highGlucose = glucose.filter((g) => g >= t.glucoseMgDl.elevatedFasting);
  if (highGlucose.length >= 2) {
    patterns.push({
      factor: "elevated_glucose",
      category: "vitals",
      detail: `${highGlucose.length} readings at or above ${t.glucoseMgDl.elevatedFasting} mg/dL.`,
      severity: highGlucose.some((g) => g >= t.glucoseMgDl.highFasting) ? 2 : 1,
    });
  }

  /* repeated symptoms */
  const counts = new Map();
  const cutoff = Date.now() - t.symptoms.windowDays * 86400000;
  for (const c of checkins) {
    const d = toDate(c.date)?.getTime() ?? 0;
    if (d < cutoff) continue;
    for (const s of c.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  for (const [symptom, n] of counts) {
    if (n >= t.symptoms.repeatedCountInWindow) {
      patterns.push({
        factor: "repeated_symptom",
        category: "symptoms",
        detail: `"${symptom.replace(/_/g, " ")}" reported ${n} times in the last ${t.symptoms.windowDays} days.`,
        severity: 1,
      });
    }
  }

  /* food quality */
  const foods = asc(checkins)
    .slice(-5)
    .map((c) => c.foodQuality)
    .filter(Boolean);
  if (
    foods.length >= 3 &&
    foods.filter((f) => f === "poor" || f === "fair").length >= foods.length - 1
  ) {
    patterns.push({
      factor: "poor_food_quality",
      category: "food",
      detail: "Most recent meals were logged as poor or fair.",
      severity: 1,
    });
  }

  /* check-in consistency */
  const windowStart = Date.now() - t.checkin.consistencyWindowDays * 86400000;
  const inWindow = checkins.filter((c) => (toDate(c.date)?.getTime() ?? 0) >= windowStart).length;
  if (checkins.length > 0 && inWindow < 3) {
    patterns.push({
      factor: "low_checkin_consistency",
      category: "general",
      detail: `${inWindow} check-ins in the last ${t.checkin.consistencyWindowDays} days.`,
      severity: 0,
    });
  }

  /* verified lab results only */
  for (const r of verifiedResults) {
    if (r.userVerified && (r.flag === "high" || r.flag === "low")) {
      patterns.push({
        factor: "abnormal_verified_lab",
        category: "health_report",
        detail: `${r.testName}: ${r.resultValue}${r.unit ? " " + r.unit : ""} is outside the printed reference range.`,
        severity: 1,
      });
    }
  }

  return patterns;
}



/**
 * General Health Score — a wellness / risk-awareness indicator.
 * This is NOT a medical or diagnostic score.
 */
function calculateHealthScore(
  checkins,
  patterns,
) {
  const contributions = [];
  let score = 100;

  if (checkins.length === 0) {
    return {
      score: 0,
      band: "needs_attention",
      contributions: [{ label: "No check-ins recorded yet", delta: 0 }],
    };
  }

  for (const p of patterns) {
    const delta = p.severity === 2 ? -14 : p.severity === 1 ? -8 : -3;
    score += delta;
    contributions.push({ label: p.detail, delta });
  }

  const recentDays = checkins.filter(
    (c) =>
      (toDate(c.date)?.getTime() ?? 0) >=
      Date.now() - THRESHOLDS.checkin.consistencyWindowDays * 86400000,
  ).length;
  const consistencyBonus = Math.min(10, recentDays * 2);
  score += consistencyBonus;
  contributions.push({
    label: `${recentDays} check-ins in the last week`,
    delta: consistencyBonus,
  });

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band =
    score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "needs_attention";
  return { score, band, contributions };
}

function buildAssessments(
  patterns,
  sourceRecordIds,
) {
  const byCategory = new Map();
  for (const p of patterns) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  const out = [];
  for (const [category, list] of byCategory) {
    const maxSeverity = Math.max(...list.map((p) => p.severity));
    const riskLevel = maxSeverity === 2 ? "high" : maxSeverity === 1 ? "moderate" : "low";
    out.push({
      assessmentType: "lifestyle_pattern",
      riskCategory: category,
      riskLevel,
      score: Math.min(100, list.length * 20 + maxSeverity * 20),
      factors: list.map((p) => p.factor),
      sourceRecordIds,
      algorithmVersion: ALGORITHM_VERSION,
      generatedBy: "deterministic_engine",
    });
  }
  return out;
}

/** Maps deterministic factors to a specialist category. Never a diagnosis. */
function suggestSpecialty(
  patterns,
) {
  const factors = new Set(patterns.map((p) => p.factor));
  const high = patterns.some((p) => p.severity === 2);
  if (factors.has("elevated_blood_pressure"))
    return {
      specialty: "Cardiology",
      urgency: high ? "soon" : "routine",
      basis: "Repeated blood pressure readings above the usual range.",
    };
  if (factors.has("elevated_glucose"))
    return {
      specialty: "Endocrinology",
      urgency: high ? "soon" : "routine",
      basis: "Repeated glucose readings above the usual range.",
    };
  if (factors.has("abnormal_verified_lab"))
    return {
      specialty: "General Physician",
      urgency: "routine",
      basis: "A verified lab value is outside its printed reference range.",
    };
  if (factors.has("repeated_symptom"))
    return {
      specialty: "General Physician",
      urgency: "routine",
      basis: "The same symptom has been reported repeatedly.",
    };
  if (factors.has("weight_increase_pattern") || factors.has("poor_food_quality"))
    return {
      specialty: "Nutrition & Dietetics",
      urgency: "routine",
      basis: "Weight and food-quality patterns in your check-ins.",
    };
  if (factors.has("short_sleep") || factors.has("sleep_decline"))
    return {
      specialty: "General Physician",
      urgency: "routine",
      basis: "A sustained change in sleep duration.",
    };
  return null;
}
