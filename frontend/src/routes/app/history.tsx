import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { useUid } from "@/features/auth/useAuth";
import { useCheckins, useHealthRecords } from "@/features/health/queries";
import { toDate } from "@/services/firebase/repositories";
import { cn } from "@/lib/utils";
import { formatSymptom } from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";
import { Badge } from "@/components/ui/badge";
import { FileText, Activity } from "lucide-react";

export const Route = createFileRoute("/app/history")({
  component: History,
  head: () => ({
    meta: [
      { title: "Health history — HealthGuardian AI" },
      {
        name: "description",
        content: "Review your logged sleep, hydration, activity, weight and readings over time.",
      },
      { property: "og:title", content: "Your health history" },
      {
        property: "og:description",
        content: "Review logged sleep, hydration, activity and readings over time.",
      },
    ],
  }),
});

export function History() {
  const uid = useUid();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useCheckins(uid, 120);
  const { data: healthRecordsData, isLoading: isLoadingRecords } = useHealthRecords(uid, undefined, 200);

  const [activeTab, setActiveTab] = useState<"checkins" | "biomarkers">("checkins");
  const [selectedBiomarker, setSelectedBiomarker] = useState<string>("all");
  const [metric, setMetric] = useState<
    "sleepHours" | "waterGlasses" | "exerciseMinutes" | "weightKg" | "systolicBP" | "bloodGlucose"
  >("sleepHours");

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const checkins = data ?? [];
  const points = [...checkins]
    .reverse()
    .map((c) => ({
      date: toDate(c.date)?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? "",
      value: c[metric] ?? null,
    }))
    .filter((p) => typeof p.value === "number");

  const metrics = [
    { key: "sleepHours", label: `${t("dashboard.sleep")} (h)` },
    { key: "waterGlasses", label: `${t("dashboard.water")} (${t("dashboard.glasses")})` },
    { key: "exerciseMinutes", label: `${t("dashboard.exercise")} (${t("dashboard.minutes")})` },
    { key: "weightKg", label: `${t("dashboard.weight")} (kg)` },
    { key: "systolicBP", label: t("dashboard.bloodPressure") },
    { key: "bloodGlucose", label: t("dashboard.bloodGlucose") },
  ] as const;

  const labRecords = useMemo(() => {
    return (healthRecordsData ?? []).filter((r) => r.sourceType === "medical_report");
  }, [healthRecordsData]);

  const uniqueBiomarkers = useMemo(() => {
    return Array.from(new Set(labRecords.map((r) => r.metric)));
  }, [labRecords]);

  const filteredLabRecords = useMemo(() => {
    if (selectedBiomarker === "all") return labRecords;
    return labRecords.filter((r) => r.metric === selectedBiomarker);
  }, [labRecords, selectedBiomarker]);

  const biomarkerChartPoints = useMemo(() => {
    if (selectedBiomarker === "all") return [];
    return [...filteredLabRecords]
      .reverse()
      .map((r) => ({
        date: toDate(r.recordedAt)?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? "",
        value: r.numericValue ?? null,
      }))
      .filter((p) => typeof p.value === "number");
  }, [filteredLabRecords, selectedBiomarker]);

  const getSourceLabel = (src?: string) => {
    switch (src) {
      case "quick_checkin":
        return `⚡ ${t("history.sourceQuick")}`;
      case "conversational":
        return `💬 ${t("history.sourceConversational")}`;
      case "voice":
        return `🎙️ ${t("history.sourceVoice")}`;
      case "file_import":
        return `📁 ${t("history.sourceFileImport")}`;
      case "ocr":
        return `📄 ${t("history.sourceOcr")}`;
      default:
        return `📋 ${t("history.sourceManual")}`;
    }
  };

  const getFlagBadge = (flag?: string) => {
    switch (flag) {
      case "high":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30">High</Badge>;
      case "low":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Low</Badge>;
      case "abnormal":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Abnormal</Badge>;
      case "normal":
        return <Badge className="bg-success/15 text-success border-success/30">Normal</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">Normal</Badge>;
    }
  };

  return (
    <div>
      <PageHeader title={t("history.title")} description={t("history.subtitle")} />

      {/* Top Tab Toggle */}
      <div className="flex items-center gap-2 mb-6 border-b pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("checkins")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
            activeTab === "checkins"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/60"
          )}
        >
          <Activity className="size-4" />
          <span>{t("history.dailyVitalsTab") || "Daily Vitals & Lifestyle"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("biomarkers")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
            activeTab === "biomarkers"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/60"
          )}
        >
          <FileText className="size-4" />
          <span>{t("history.verifiedBiomarkersTab") || "Verified Lab Biomarkers"}</span>
          {labRecords.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-background/20">
              {labRecords.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "checkins" ? (
        checkins.length === 0 ? (
          <EmptyState title={t("history.emptyTitle")} description={t("history.emptyDesc")} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {metrics.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer",
                    metric === m.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <section className="surface p-4 rounded-2xl border">
              {points.length < 2 ? (
                <p className="p-6 text-sm text-muted-foreground">{t("history.trendMinData")}</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "0.75rem",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="surface mt-4 overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("history.tableDate")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("history.tableSleep")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("history.tableWater")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("history.tableExercise")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("history.tableSymptoms")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("history.tableSource")}</th>
                  </tr>
                </thead>
                <tbody>
                  {checkins.slice(0, 30).map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">
                        {toDate(c.date)?.toLocaleDateString() ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.sleepHours != null ? `${c.sleepHours}h` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.waterGlasses != null ? `${c.waterGlasses}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.exerciseMinutes != null ? `${c.exerciseMinutes}m` : "—"}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {c.symptoms?.length
                          ? c.symptoms.map((s) => formatSymptom(s, t)).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          {getSourceLabel(c.source)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )
      ) : (
        /* Verified Lab Biomarkers Tab */
        labRecords.length === 0 ? (
          <EmptyState
            title="No Verified Lab Biomarkers Yet"
            description="Verified clinical biomarkers will automatically appear here once you review and confirm an uploaded medical report."
          />
        ) : (
          <div className="space-y-4">
            {/* Biomarker filter pills */}
            {uniqueBiomarkers.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBiomarker("all")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    selectedBiomarker === "all"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  All Biomarkers ({labRecords.length})
                </button>
                {uniqueBiomarkers.map((bio) => {
                  const count = labRecords.filter((r) => r.metric === bio).length;
                  return (
                    <button
                      key={bio}
                      type="button"
                      onClick={() => setSelectedBiomarker(bio)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                        selectedBiomarker === bio
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground",
                      )}
                    >
                      {bio} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Longitudinal Chart for Selected Biomarker */}
            {selectedBiomarker !== "all" && biomarkerChartPoints.length >= 2 && (
              <section className="surface p-4 rounded-2xl border">
                <div className="mb-2">
                  <h3 className="font-semibold text-sm text-foreground">{selectedBiomarker} Trend</h3>
                  <p className="text-xs text-muted-foreground">Longitudinal values from your confirmed medical reports.</p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={biomarkerChartPoints} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "0.75rem",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Biomarker Table */}
            <section className="surface overflow-x-auto rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Test / Biomarker</th>
                    <th className="px-4 py-2.5 font-medium">Value</th>
                    <th className="px-4 py-2.5 font-medium">Unit</th>
                    <th className="px-4 py-2.5 font-medium">Reference Interval</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Source Document</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLabRecords.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap">
                        {toDate(r.recordedAt)?.toLocaleDateString() ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        {r.metric}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-foreground">
                        {r.valueText || r.numericValue || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {r.unit || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {r.referenceText || (r.referenceLow != null ? `${r.referenceLow} - ${r.referenceHigh}` : "—")}
                      </td>
                      <td className="px-4 py-2.5">
                        {getFlagBadge(r.flag)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="size-3 text-primary" />
                          <span className="truncate max-w-[150px]">{r.sourceName || "Medical Report"}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )
      )}

      <Disclaimer />
    </div>
  );
}
