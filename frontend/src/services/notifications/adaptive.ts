import { pushNotification } from "./notifications";
import { checkinIdForDate } from "@/services/firebase/repositories";
import { calculateAdaptiveEvidence } from "@/features/healthRisk/engine";
import { buildHealthContext } from "@/core/adaptive/context";
import type { DailyCheckin } from "@/models";
import { ENABLE_ADAPTIVE_V2 } from "@/core/constants/health";
import { ADAPTIVE_CONFIG } from "@/core/adaptive/config";

const DEDUPE_KEY = "hg_adaptive_notifications_state";

interface AdaptiveDedupeState {
  lastSent: Record<string, number>; // metric -> timestamp
  dailyCounts: Record<string, number>; // dateStr -> count
}

export async function syncAdaptiveNotifications(uid: string, checkins: DailyCheckin[]) {
  if (!ENABLE_ADAPTIVE_V2 || typeof window === "undefined" || checkins.length === 0) return;

  const evidences = calculateAdaptiveEvidence(checkins);
  const context = buildHealthContext(evidences);

  // We only trigger adaptive notifications for lifestyle metrics: sleepHours, waterGlasses, exerciseMinutes
  const lifestyleMetrics = ["sleepHours", "waterGlasses", "exerciseMinutes"];
  const deviations = context.supportingEvidence.filter(
    (e) =>
      lifestyleMetrics.includes(e.metric) &&
      e.confidence >= ADAPTIVE_CONFIG.notificationAlertConfidence &&
      e.deviation !== null &&
      e.deviation < 0,
  );

  if (deviations.length === 0) return;

  // Load state from localStorage
  let state: AdaptiveDedupeState = { lastSent: {}, dailyCounts: {} };
  try {
    const raw = window.localStorage.getItem(DEDUPE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    // default state
  }

  const todayStr = checkinIdForDate(new Date());
  const dailyCount = state.dailyCounts[todayStr] ?? 0;

  if (dailyCount >= 3) {
    // Daily limit of 3 notifications exceeded
    return;
  }

  // Find the most significant deviation to notify
  const toNotify = deviations.sort(
    (a, b) => b.confidence * Math.abs(b.deviation ?? 0) - a.confidence * Math.abs(a.deviation ?? 0),
  )[0];
  if (!toNotify || toNotify.deviation == null) return;

  const metric = toNotify.metric;
  const now = Date.now();
  const lastSentTime = state.lastSent[metric] ?? 0;

  // 24 hour cooldown check
  if (now - lastSentTime < 24 * 60 * 60 * 1000) {
    return;
  }

  // Construct non-alarmist explanation message without clinical details in the preview
  let title = "Your lifestyle patterns are changing";
  let message = "";

  if (metric === "sleepHours") {
    title = "Your sleep pattern is changing";
    message =
      "Your sleep has been below your usual pattern recently. Open HealthGuardian to review your trend.";
  } else if (metric === "waterGlasses") {
    title = "Your hydration levels are lower";
    message = "Your water intake has been below your usual baseline recently.";
  } else if (metric === "exerciseMinutes") {
    title = "Your physical activity has decreased";
    message = "Your daily active minutes have been below your usual pattern recently.";
  }

  // Send the notification
  await pushNotification(uid, {
    type: "pattern_alert",
    category: metric === "sleepHours" ? "sleep" : metric === "waterGlasses" ? "water" : "exercise",
    title,
    message,
    priority: "medium",
  });

  // Update localStorage state
  state.lastSent[metric] = now;
  state.dailyCounts[todayStr] = dailyCount + 1;
  window.localStorage.setItem(DEDUPE_KEY, JSON.stringify(state));
}
