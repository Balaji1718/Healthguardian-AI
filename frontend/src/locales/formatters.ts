/**
 * Pure localization formatters for dynamic strings and enums across HealthGuardian AI.
 * Ensures zero unintended English strings remain in user-facing viewports when Tamil or Hindi is selected.
 */

import type { DetectedPattern } from "@/features/healthRisk/engine";
import type { AppNotification, HealthGoal } from "@/models";

type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Localizes a risk factor identifier into a user-facing title.
 */
export function formatFactorTitle(factor: string, t: TranslationFn): string {
  const key = `risk.factors.${factor}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;

  // Fallback map for any factors not in standard keys
  switch (factor) {
    case "sleep_decline":
      return t("risk.factors.sleep_decline");
    case "short_sleep":
      return t("risk.factors.short_sleep");
    case "low_activity":
      return t("risk.factors.low_activity");
    case "no_activity":
      return t("risk.factors.no_activity");
    case "low_hydration":
      return t("risk.factors.low_hydration");
    case "weight_increase_pattern":
      return t("risk.factors.weight_increase_pattern");
    case "elevated_blood_pressure":
      return t("risk.factors.elevated_blood_pressure");
    case "elevated_fasting_glucose":
      return t("risk.factors.elevated_fasting_glucose");
    case "frequent_headaches":
      return t("risk.factors.frequent_headaches");
    case "repeated_symptoms":
      return t("risk.factors.repeated_symptoms");
    case "lab_abnormalities":
      return t("risk.factors.lab_abnormalities");
    default:
      return factor;
  }
}

/**
 * Localizes dynamic pattern detail text based on regex matching or structured params.
 */
export function formatPatternDetail(
  pattern: DetectedPattern | { factor?: string; detail?: string; message?: string },
  t: TranslationFn,
): string {
  const text = pattern.message || pattern.detail || "";
  if (!text) return "";

  // 1. Sleep deviation: "Recent sleep is 2.0h lower than your usual pattern of 8.0h."
  const sleepDevMatch = text.match(
    /Recent sleep is ([\d.]+)h lower than your usual pattern of ([\d.]+)h\./i,
  );
  if (sleepDevMatch) {
    return t("risk.patternDetails.sleepDev", { dev: sleepDevMatch[1], baseline: sleepDevMatch[2] });
  }

  // 2. Activity deviation: "Recent activity is 15 min/day below your usual pattern of 40 min."
  const actDevMatch = text.match(
    /Recent activity is ([\d.]+) min\/day below your usual pattern of ([\d.]+) min\./i,
  );
  if (actDevMatch) {
    return t("risk.patternDetails.lowActivityDev", {
      dev: actDevMatch[1],
      baseline: actDevMatch[2],
    });
  }

  // 3. Water deviation: "Recent water intake is 2.0 glasses below your usual pattern of 7.0 glasses."
  const waterDevMatch = text.match(
    /Recent water(?: intake)? is ([\d.]+) glasses below your usual pattern of ([\d.]+) glasses\./i,
  );
  if (waterDevMatch) {
    return t("risk.patternDetails.waterDev", { dev: waterDevMatch[1], baseline: waterDevMatch[2] });
  }

  // 4. Sleep decline: "Sleep went from 8.0h to 6.0h across your last 4 entries."
  const sleepDeclineMatch = text.match(
    /Sleep went from ([\d.]+)h to ([\d.]+)h across your last (\d+) entries\./i,
  );
  if (sleepDeclineMatch) {
    return t("risk.patternDetails.sleepDecline", {
      start: sleepDeclineMatch[1],
      end: sleepDeclineMatch[2],
      count: sleepDeclineMatch[3],
    });
  }

  // 5. Sleep average: "Average sleep is 5.5h."
  const sleepAvgMatch = text.match(/Average sleep is ([\d.]+)h\./i);
  if (sleepAvgMatch) {
    return t("risk.patternDetails.sleepAvg", { avg: sleepAvgMatch[1] });
  }

  // 6. No activity: "No activity logged in recent entries."
  if (/no activity logged/i.test(text)) {
    return t("risk.patternDetails.noActivity");
  }

  // 7. Activity average: "Average 15 min/day recently."
  const actAvgMatch = text.match(/Average ([\d.]+) min\/day recently\./i);
  if (actAvgMatch) {
    return t("risk.patternDetails.lowActivityAvg", { avg: actAvgMatch[1] });
  }

  // 8. Water average: "Average 3.5 glasses/day recently."
  const waterAvgMatch = text.match(/Average ([\d.]+) glasses\/day recently\./i);
  if (waterAvgMatch) {
    return t("risk.patternDetails.waterAvg", { avg: waterAvgMatch[1] });
  }

  // 9. Weight increase: "Weight increased by 2.5kg over your last 5 entries."
  const weightMatch = text.match(/Weight increased by ([\d.]+)kg over your last (\d+) entries\./i);
  if (weightMatch) {
    return t("risk.patternDetails.weightIncrease", { gain: weightMatch[1], count: weightMatch[2] });
  }

  // 10. Elevated BP: "Recent readings average 135/88 mmHg."
  const bpMatch = text.match(/Recent readings average (\d+)\/(\d+) mmHg\./i);
  if (bpMatch) {
    return t("risk.patternDetails.elevatedBP", { sys: bpMatch[1], dia: bpMatch[2] });
  }

  // 11. Elevated Glucose: "Recent fasting readings average 115 mg/dL."
  const glucoseMatch = text.match(/Recent fasting readings average ([\d.]+) mg\/dL\./i);
  if (glucoseMatch) {
    return t("risk.patternDetails.elevatedGlucose", { avg: glucoseMatch[1] });
  }

  // 12. Frequent headaches: "Headache logged 3 times in the last 14 days."
  const headacheMatch = text.match(/Headache logged (\d+) times in the last (\d+) days\./i);
  if (headacheMatch) {
    return t("risk.patternDetails.frequentHeadaches", {
      count: headacheMatch[1],
      days: headacheMatch[2],
    });
  }

  // 13. Repeated symptoms: "Fatigue logged 3 times recently."
  const symptomMatch = text.match(/(.+) logged (\d+) times recently\./i);
  if (symptomMatch) {
    return t("risk.patternDetails.repeatedSymptoms", {
      symptom: symptomMatch[1],
      count: symptomMatch[2],
    });
  }

  // 14. Lab abnormalities: "2 lab test(s) outside normal reference range."
  const labMatch = text.match(/(\d+) lab test\(s\) outside normal reference range\./i);
  if (labMatch) {
    return t("risk.patternDetails.labAbnormal", { count: labMatch[1] });
  }

  return text;
}

/**
 * Localizes adaptive explanation signals such as:
 * "Recent sleep is 2.0 hours below your usual pattern of 8.0 hours."
 */
export function formatAdaptiveSignal(signal: string, t: TranslationFn): string {
  if (!signal) return "";

  // Pattern: Recent [metric] is [dev][unit] [above/below] your usual pattern of [baseline][unit].
  const signalMatch = signal.match(
    /Recent (.+?) is ([\d.]+)\s*(\w+)? (above|below) your usual pattern of ([\d.]+)\s*(\w+)?\./i,
  );

  if (signalMatch) {
    const rawMetric = signalMatch[1].trim().toLowerCase();
    const dev = signalMatch[2];
    const unit = signalMatch[3] || "";
    const direction = signalMatch[4].toLowerCase();
    const baseline = signalMatch[5];

    if (rawMetric.includes("sleep")) {
      return direction === "below"
        ? t("risk.patternDetails.sleepDev", { dev, baseline })
        : t("adaptive.signals.sleepAbove", { dev, baseline });
    }
    if (rawMetric.includes("water") || rawMetric.includes("hydration")) {
      return direction === "below"
        ? t("risk.patternDetails.waterDev", { dev, baseline })
        : t("adaptive.signals.waterAbove", { dev, baseline });
    }
    if (rawMetric.includes("exercise") || rawMetric.includes("activity")) {
      return direction === "below"
        ? t("risk.patternDetails.lowActivityDev", { dev, baseline })
        : t("adaptive.signals.activityAbove", { dev, baseline });
    }

    return t("adaptive.signals.genericDeviation", {
      metric: rawMetric,
      dev,
      unit,
      direction: direction === "below" ? t("risk.down") : t("risk.up"),
      baseline,
    });
  }

  return formatPatternDetail({ detail: signal }, t);
}

/**
 * Localizes General Health Score contributions dynamically.
 */
export function formatScoreContribution(
  c: { label: string; delta: number },
  t: TranslationFn,
): string {
  const text = c.label;
  if (!text) return "";

  // "Recent sleep is 2.0h lower than your usual pattern of 8.0h."
  const sleepMatch = text.match(
    /Recent sleep is ([\d.]+)h lower than your usual pattern of ([\d.]+)h\./i,
  );
  if (sleepMatch) {
    return t("dashboard.contributions.sleepLower", { dev: sleepMatch[1], baseline: sleepMatch[2] });
  }

  // "Recent activity is 15 min/day below your usual pattern of 40 min."
  const actMatch = text.match(
    /Recent activity is ([\d.]+) min\/day below your usual pattern of ([\d.]+) min\./i,
  );
  if (actMatch) {
    return t("dashboard.contributions.activityBelow", { dev: actMatch[1], baseline: actMatch[2] });
  }

  // "Recent water intake is 2.0 glasses below your usual pattern of 7.0 glasses."
  const waterMatch = text.match(
    /Recent water(?: intake)? is ([\d.]+) glasses below your usual pattern of ([\d.]+) glasses\./i,
  );
  if (waterMatch) {
    return t("dashboard.contributions.waterBelow", { dev: waterMatch[1], baseline: waterMatch[2] });
  }

  // "5 check-ins in the last week"
  const checkinsMatch = text.match(/(\d+) check-ins in the last week/i);
  if (checkinsMatch) {
    return t("dashboard.contributions.checkinsCount", { count: checkinsMatch[1] });
  }

  // Static positive contributions
  if (/sleep duration has been consistent/i.test(text)) {
    return t("dashboard.contributions.sleepConsistent");
  }
  if (/hydration target met consistently/i.test(text)) {
    return t("dashboard.contributions.hydrationMet");
  }
  if (/activity baseline maintained/i.test(text)) {
    return t("dashboard.contributions.activityTargetMet");
  }

  return text;
}

/**
 * Localizes notification titles and messages dynamically.
 */
export function formatNotificationTitle(n: AppNotification, t: TranslationFn): string {
  const title = n.title;
  if (!title) return "";

  if (/physical activity has decreased/i.test(title)) {
    return t("notifications.templates.activityDecreasedTitle");
  }
  if (/something in your health data may need attention/i.test(title)) {
    return t("notifications.templates.patternAttentionTitle");
  }
  if (/sleep pattern is changing/i.test(title) || /lifestyle patterns are changing/i.test(title)) {
    return t("notifications.templates.sleepChangingTitle");
  }
  if (/hydration levels are lower/i.test(title)) {
    return t("notifications.templates.hydrationLowerTitle");
  }

  return title;
}

export function formatNotificationMessage(n: AppNotification, t: TranslationFn): string {
  const msg = n.message;
  if (!msg) return "";

  if (/daily active minutes have been below your usual pattern/i.test(msg)) {
    return t("notifications.templates.activityDecreasedBody");
  }
  if (/open healthguardian to review the pattern/i.test(msg)) {
    return t("notifications.templates.patternAttentionBody");
  }
  if (/sleep has been below your usual pattern/i.test(msg)) {
    return t("notifications.templates.sleepChangingBody");
  }
  if (/water intake has been below your usual baseline/i.test(msg)) {
    return t("notifications.templates.hydrationLowerBody");
  }

  return msg;
}

/**
 * Localizes notification priority badges.
 */
export function formatNotificationPriority(priority: string, t: TranslationFn): string {
  const key = `notifications.priorities.${priority.toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : priority;
}

/**
 * Localizes goal titles and templates.
 */
export function formatGoalTitle(title: string, t: TranslationFn): string {
  if (!title) return "";

  if (/drink 8 glasses of water/i.test(title)) {
    return t("goals.templates.drinkWater");
  }
  if (/daily 30 min brisk walk/i.test(title) || /walk 30 min/i.test(title)) {
    return t("goals.templates.walkDaily");
  }
  if (/sleep 7-8 hours/i.test(title) || /sleep regular/i.test(title)) {
    return t("goals.templates.sleepRegular");
  }

  return title;
}

/**
 * Localizes goal progress string: "daily · 0/8 glasses"
 */
export function formatGoalProgress(goal: HealthGoal, t: TranslationFn): string {
  const frequencyLabel =
    goal.frequency === "daily"
      ? t("goals.frequencyDaily")
      : goal.frequency === "weekly"
        ? t("goals.frequencyWeekly")
        : goal.frequency;

  const unitLabel = goal.unit ? t(`units.${goal.unit}`) || goal.unit : "";

  return `${frequencyLabel} · ${goal.progressValue ?? 0}/${goal.targetValue ?? 0} ${unitLabel}`.trim();
}

/**
 * Localizes support request form enums.
 */
export function formatSupportType(type: string, t: TranslationFn): string {
  const key = `support.types.${type}`;
  const translated = t(key);
  return translated !== key ? translated : type.replace(/_/g, " ");
}

export function formatSupportPriority(priority: string, t: TranslationFn): string {
  const key = `support.priorities.${priority}`;
  const translated = t(key);
  return translated !== key ? translated : priority;
}

export function formatSupportStatus(status: string, t: TranslationFn): string {
  const key = `support.status.${status}`;
  const translated = t(key);
  return translated !== key ? translated : status.replace(/_/g, " ");
}

/**
 * Localizes guide section categories and navigation buttons.
 */
export function formatGuideCategory(category: string, t: TranslationFn): string {
  const key = `guide.categories.${category}`;
  const translated = t(key);
  return translated !== key ? translated : category.replace(/_/g, " ");
}

export function formatGuideButton(
  routeToOpen: string | undefined,
  defaultLabel: string | undefined,
  t: TranslationFn,
): string {
  if (!routeToOpen) return defaultLabel || "";
  switch (routeToOpen) {
    case "/app/dashboard":
      return t("nav.dashboard");
    case "/app/checkin":
      return t("nav.checkin");
    case "/app/history":
      return t("nav.history");
    case "/app/reports":
      return t("nav.reports");
    case "/app/risk":
      return t("nav.risk");
    case "/app/assistant":
      return t("nav.assistant");
    case "/app/goals":
      return t("nav.goals");
    case "/app/notifications":
      return t("nav.notifications");
    case "/app/support":
      return t("nav.support");
    case "/app/settings":
      return t("nav.settings");
    case "/app/guide":
      return t("nav.guide");
    default:
      return defaultLabel || "";
  }
}

/**
 * Localizes symptoms, food quality, wellbeing, specialties, and report types.
 */
export function formatSymptom(symptom: string, t: TranslationFn): string {
  const clean = symptom.toLowerCase().trim();
  const key = `symptoms.${clean}`;
  const translated = t(key);
  return translated !== key ? translated : symptom.replace(/_/g, " ");
}

export function formatWellbeing(wellbeing: string, t: TranslationFn): string {
  const clean = wellbeing.toLowerCase().trim();
  const key = `wellbeing.${clean}`;
  const translated = t(key);
  return translated !== key ? translated : wellbeing.replace(/_/g, " ");
}

export function formatFoodQuality(quality: string, t: TranslationFn): string {
  const clean = quality.toLowerCase().trim();
  const key = `foodQuality.${clean}`;
  const translated = t(key);
  return translated !== key ? translated : quality.replace(/_/g, " ");
}

export function formatSpecialty(specialty: string, t: TranslationFn): string {
  const key = `specialties.${specialty}`;
  const translated = t(key);
  return translated !== key ? translated : specialty;
}

export function formatReportType(reportType: string, t: TranslationFn): string {
  const key = `reports.types.${reportType}`;
  const translated = t(key);
  return translated !== key ? translated : reportType.replace(/_/g, " ");
}

export function formatUrgency(urgency: string, t: TranslationFn): string {
  if (urgency === "high") return t("specialist.urgencyHigh") || urgency;
  if (urgency === "moderate") return t("specialist.urgencyModerate") || urgency;
  if (urgency === "low") return t("specialist.urgencyLow") || urgency;
  return urgency;
}
