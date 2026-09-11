import { ALGORITHM_VERSION } from "@/core/constants/health";
import {
  buildAssessments,
  calculateAdaptiveEvidence,
  calculatePersonalBaseline,
  calculateHealthScore,
  detectPatterns,
  suggestSpecialty,
} from "@/features/healthRisk/engine";
import { buildHealthContext } from "@/core/adaptive/context";
import type { DailyCheckin, Goal } from "@/models";
import {
  createGoal,
  createNotification,
  createSupportRequest,
  getHealthProfile,
  getProfile,
  getReport,
  listCheckins,
  listGoals,
  listHealthRecords,
  listNotifications,
  listResults,
  listVerifiedResults,
  saveAssessment,
  toDate,
} from "@/services/firebase/repositories";

export interface ToolContext {
  uid: string;
}

export interface ToolResult {
  ok: boolean;
  data: unknown;
  summary: string;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  args: string;
  /** Whether this tool reads or mutates data. */
  readOrWrite: "read" | "write";
  /** Tools that mutate data must be confirmed by the user first. */
  requiresConfirmation?: boolean;
  /** All tools require the authenticated UID — this is always true; kept explicit for the agent registry. */
  authorizationRequired: boolean;
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Redacts identifying details before anything is summarised for an LLM. */
function minimalCheckin(c: DailyCheckin) {
  return {
    date: toDate(c.date)?.toISOString().slice(0, 10),
    sleepHours: c.sleepHours ?? null,
    waterGlasses: c.waterGlasses ?? null,
    exerciseMinutes: c.exerciseMinutes ?? null,
    foodQuality: c.foodQuality ?? null,
    weightKg: c.weightKg ?? null,
    wellbeing: c.wellbeing ?? null,
    symptoms: c.symptoms ?? [],
    systolicBP: c.systolicBP ?? null,
    diastolicBP: c.diastolicBP ?? null,
    bloodGlucose: c.bloodGlucose ?? null,
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "getUserProfile",
    description: "Basic non-identifying profile context: age band, gender, timezone, language.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const p = await getProfile(uid);
      if (!p) return { ok: false, data: null, summary: "No profile found.", error: "not_found" };
      const dob = toDate(p.dateOfBirth ?? null);
      const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86400000)) : null;
      // Names are deliberately excluded from agent context (privacy minimisation).
      const data = {
        ageYears: age,
        gender: p.gender ?? null,
        heightCm: p.heightCm ?? null,
        language: p.preferredLanguage,
      };
      return {
        ok: true,
        data,
        summary: `Profile: age ${age ?? "unknown"}, gender ${p.gender ?? "unknown"}.`,
      };
    },
  },
  {
    name: "getHealthProfile",
    description:
      "Known conditions, allergies, family history, medications (read-only) and preferences.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const hp = await getHealthProfile(uid);
      if (!hp)
        return { ok: false, data: null, summary: "No health profile found.", error: "not_found" };
      return {
        ok: true,
        data: {
          knownConditions: hp.knownConditions ?? [],
          allergies: hp.allergies ?? [],
          familyHistory: hp.familyHistory ?? [],
          medicationCount: (hp.currentMedications ?? []).length,
          preferences: hp.healthPreferences ?? {},
        },
        summary: `Conditions: ${(hp.knownConditions ?? []).join(", ") || "none recorded"}.`,
      };
    },
  },
  {
    name: "getDailyCheckins",
    description: "Recent daily check-ins. Args: { days?: number }",
    args: '{ "days": 14 }',
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }, args) {
      const days = Math.min(90, num(args["days"], 14));
      const all = await listCheckins(uid, 90);
      const cutoff = Date.now() - days * 86400000;
      const items = all
        .filter((c) => (toDate(c.date)?.getTime() ?? 0) >= cutoff)
        .map(minimalCheckin);
      return {
        ok: true,
        data: items,
        summary: `${items.length} check-ins in the last ${days} days.`,
      };
    },
  },
  {
    name: "getHealthHistory",
    description:
      "Normalised longitudinal metric history. Args: { metric?: string, limit?: number }",
    args: '{ "metric": "weight", "limit": 60 }',
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }, args) {
      const metric = str(args["metric"]);
      const records = await listHealthRecords(
        uid,
        metric || undefined,
        Math.min(200, num(args["limit"], 60)),
      );
      const data = records.map((r) => ({
        metric: r.metric,
        value: r.numericValue ?? r.valueText ?? null,
        unit: r.unit ?? "",
        at: toDate(r.recordedAt)?.toISOString().slice(0, 10),
        source: r.sourceType,
      }));
      return {
        ok: true,
        data,
        summary: `${data.length} history records${metric ? ` for ${metric}` : ""}.`,
      };
    },
  },
  {
    name: "getMedicalReport",
    description: "Metadata of one medical report. Args: { reportId: string }",
    args: '{ "reportId": "..." }',
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }, args) {
      const id = str(args["reportId"]);
      if (!id)
        return { ok: false, data: null, summary: "reportId is required.", error: "bad_args" };
      // Ownership: the path is scoped to the authenticated uid, so cross-user reads are impossible.
      const report = await getReport(uid, id);
      if (!report)
        return { ok: false, data: null, summary: "Report not found.", error: "not_found" };
      const all = await listResults(uid, id);
      return {
        ok: true,
        data: {
          reportTitle: report.reportTitle,
          reportType: report.reportType,
          reportDate: toDate(report.reportDate)?.toISOString().slice(0, 10),
          verificationStatus: report.verificationStatus,
          ocrStatus: report.ocrStatus,
          totalResults: all.length,
          verifiedResults: all.filter((r) => r.userVerified).length,
        },
        summary: `Report "${report.reportTitle}" (${report.verificationStatus}).`,
      };
    },
  },
  {
    name: "getVerifiedMedicalResults",
    description: "User-verified structured lab results only. Args: { reportId: string }",
    args: '{ "reportId": "..." }',
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }, args) {
      const id = str(args["reportId"]);
      if (!id)
        return { ok: false, data: null, summary: "reportId is required.", error: "bad_args" };
      const results = await listVerifiedResults(uid, id);
      const data = results.map((r) => ({
        testName: r.testName,
        value: r.resultValue,
        unit: r.unit ?? "",
        reference:
          r.referenceText ||
          (r.referenceLow != null ? `${r.referenceLow} - ${r.referenceHigh}` : ""),
        flag: r.flag ?? "unknown",
      }));
      return { ok: true, data, summary: `${data.length} verified results.` };
    },
  },
  {
    name: "calculatePersonalBaseline",
    description:
      "Calculate personal baselines, recent deviations, missing-data ratios and confidence from the user's history.",
    args: '{ "metric": "sleepHours" }',
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }, args) {
      const checkins = await listCheckins(uid, 90);
      const metric = str(args["metric"]);
      const allowed = [
        "sleepHours",
        "waterGlasses",
        "exerciseMinutes",
        "weightKg",
        "systolicBP",
        "diastolicBP",
        "bloodGlucose",
      ];
      if (metric && !allowed.includes(metric)) {
        return { ok: false, data: null, summary: "Unknown baseline metric.", error: "bad_args" };
      }
      const data = metric
        ? calculatePersonalBaseline(
            checkins,
            metric as Parameters<typeof calculatePersonalBaseline>[1],
          )
        : calculateAdaptiveEvidence(checkins);
      return {
        ok: true,
        data,
        summary: metric
          ? `Personal baseline calculated for ${metric}.`
          : "Personal evidence calculated for available metrics.",
      };
    },
  },
  {
    name: "getHealthContext",
    description:
      "Get full adaptive health context including personal baselines, recent deviations, supporting/conflicting evidence, confidence, and explanation signals.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const checkins = await listCheckins(uid, 90);
      const evidence = calculateAdaptiveEvidence(checkins);
      const context = buildHealthContext(evidence);
      return {
        ok: true,
        data: context,
        summary: `Computed health context for ${evidence.length} metrics. Significant signals: ${context.explanationSignals.join(" | ") || "None"}`,
      };
    },
  },
  {
    name: "detectPatterns",
    description: "Deterministic lifestyle pattern detection over recent check-ins.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const checkins = await listCheckins(uid, 60);
      const patterns = detectPatterns(checkins);
      return {
        ok: true,
        data: patterns,
        summary: patterns.length
          ? patterns.map((p) => `${p.factor}: ${p.detail}`).join(" | ")
          : "No notable patterns detected.",
      };
    },
  },
  {
    name: "calculateRisk",
    description:
      "Deterministic risk assessment + general health score. Args: { persist?: boolean }",
    args: '{ "persist": false }',
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }, args) {
      const checkins = await listCheckins(uid, 60);
      const patterns = detectPatterns(checkins);
      const score = calculateHealthScore(checkins, patterns);
      const assessments = buildAssessments(patterns, checkins.map((c) => c.id!).filter(Boolean));
      if (args["persist"] === true) {
        for (const a of assessments) await saveAssessment(uid, a);
      }
      return {
        ok: true,
        data: { score, assessments, algorithmVersion: ALGORITHM_VERSION },
        summary: `General Health Score ${score.score}/100 (${score.band}); ${assessments.length} risk categories.`,
      };
    },
  },
  {
    name: "getGoals",
    description: "The user's health goals.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const goals = await listGoals(uid);
      const data = goals.map((g) => ({
        id: g.id,
        title: g.title,
        type: g.goalType,
        status: g.status,
        progress: g.progressValue,
        target: g.targetValue ?? null,
        unit: g.unit ?? "",
      }));
      return {
        ok: true,
        data,
        summary: `${data.filter((g) => g.status === "active").length} active goals.`,
      };
    },
  },
  {
    name: "createGoal",
    description:
      "Create a health goal. Requires explicit user confirmation. Args: { title, goalType, targetValue?, unit?, frequency? }",
    args: '{ "title": "Sleep 7h", "goalType": "sleep", "targetValue": 7, "unit": "h", "frequency": "daily" }',
    readOrWrite: "write",
    requiresConfirmation: true,
    authorizationRequired: true,
    async run({ uid }, args) {
      const title = str(args["title"]);
      if (!title)
        return { ok: false, data: null, summary: "A goal title is required.", error: "bad_args" };
      const goal: Goal = {
        goalType: str(args["goalType"]) || "custom",
        title,
        description: str(args["description"]),
        targetValue: typeof args["targetValue"] === "number" ? args["targetValue"] : null,
        unit: str(args["unit"]),
        frequency: str(args["frequency"]) || "daily",
        startDate: new Date(),
        status: "active",
        progressValue: 0,
      };
      const id = await createGoal(uid, goal);
      return { ok: true, data: { id }, summary: `Goal "${title}" created.` };
    },
  },
  {
    name: "getSpecialistGuidance",
    description: "Suggests a specialist category from deterministic patterns. Never a diagnosis.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const checkins = await listCheckins(uid, 60);
      const patterns = detectPatterns(checkins);
      const suggestion = suggestSpecialty(patterns);
      return {
        ok: true,
        data: suggestion,
        summary: suggestion
          ? `Possible relevant specialty: ${suggestion.specialty} (${suggestion.urgency}) — ${suggestion.basis}`
          : "No specific specialist category is indicated by the current information.",
      };
    },
  },
  {
    name: "createNotification",
    description:
      "Creates an in-app reminder. Requires user confirmation. Args: { title, message, type, category, priority }",
    args: '{ "title": "Evening walk", "message": "Time for your walk", "type": "goal_reminder", "category": "exercise", "priority": "low" }',
    readOrWrite: "write",
    requiresConfirmation: true,
    authorizationRequired: true,
    async run({ uid }, args) {
      const title = str(args["title"]);
      if (!title)
        return { ok: false, data: null, summary: "A title is required.", error: "bad_args" };
      const id = await createNotification(uid, {
        type: str(args["type"]) || "general_reminder",
        category: str(args["category"]) || "general",
        title,
        // Sensitive clinical detail is intentionally kept out of notification text.
        message:
          str(args["message"]).slice(0, 160) || "You have a health reminder in HealthGuardian.",
        priority: (["low", "medium", "high"].includes(str(args["priority"]))
          ? str(args["priority"])
          : "low") as "low" | "medium" | "high",
        status: "pending",
      });
      return { ok: true, data: { id }, summary: `Reminder "${title}" created.` };
    },
  },
  {
    name: "getNotificationState",
    description: "Pending/unread notification counts and browser permission state.",
    args: "{}",
    readOrWrite: "read",
    authorizationRequired: true,
    async run({ uid }) {
      const items = await listNotifications(uid, 50);
      const permission =
        typeof Notification !== "undefined" ? Notification.permission : "unsupported";
      const pending = items.filter(
        (n) => n.status === "pending" || n.status === "scheduled",
      ).length;
      return {
        ok: true,
        data: { total: items.length, pending, permission },
        summary: `${pending} pending notifications, browser permission: ${permission}.`,
      };
    },
  },
  {
    name: "createSupportRequest",
    description:
      "Raises a human support / accountability request. Requires user confirmation. Args: { type, reason, message, priority }",
    args: '{ "type": "accountability", "reason": "Need help staying consistent", "message": "...", "priority": "normal" }',
    readOrWrite: "write",
    requiresConfirmation: true,
    authorizationRequired: true,
    async run({ uid }, args) {
      const reason = str(args["reason"]);
      if (!reason)
        return { ok: false, data: null, summary: "A reason is required.", error: "bad_args" };
      const id = await createSupportRequest(uid, {
        type: str(args["type"]) || "accountability",
        reason,
        message: str(args["message"]),
        status: "open",
        priority: (["low", "normal", "high"].includes(str(args["priority"]))
          ? str(args["priority"])
          : "normal") as "low" | "normal" | "high",
      });
      return { ok: true, data: { id }, summary: "Support request created." };
    },
  },
  {
    name: "webSearch",
    description:
      "Search current public health guidelines, recommendations, and evidence-based web resources. Args: { query: string }",
    args: '{ "query": "daily physical activity guidelines" }',
    readOrWrite: "read",
    authorizationRequired: true,
    requiresConfirmation: false,
    async run(_ctx, args) {
      const query = str(args["query"]).trim();
      if (!query)
        return { ok: false, data: null, summary: "A search query is required.", error: "bad_args" };
      try {
        const { performWebSearch } = await import("@/services/ai/web-search");
        const res = await performWebSearch(query);
        if (!res.ok || res.results.length === 0) {
          return {
            ok: false,
            data: { query, results: [] },
            summary: `No web results found for "${query}".`,
          };
        }
        return {
          ok: true,
          data: { query: res.query, results: res.results },
          summary: `Retrieved ${res.results.length} web sources for "${query}". Top source: ${res.results[0]?.title ?? ""} (${res.results[0]?.domain ?? ""}).`,
        };
      } catch (err) {
        return {
          ok: false,
          data: null,
          summary: "Web search could not be completed.",
          error: String(err),
        };
      }
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
