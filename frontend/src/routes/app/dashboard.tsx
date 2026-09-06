import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Droplets,
  FileText,
  Footprints,
  Heart,
  Loader2,
  Mic,
  Moon,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Disclaimer,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineNotice,
} from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUid } from "@/features/auth/useAuth";
import { useAnalysis, useGoals } from "@/features/health/queries";
import { useAppStore } from "@/store/app";
import { syncPatternNotifications } from "@/services/notifications/notifications";
import { syncAdaptiveNotifications } from "@/services/notifications/adaptive";
import { calculateAdaptiveEvidence } from "@/features/healthRisk/engine";
import { buildHealthContext } from "@/core/adaptive/context";
import { toDate } from "@/services/firebase/repositories";
import { SCORE_BANDS, ENABLE_ADAPTIVE_V2 } from "@/core/constants/health";
import {
  isSampleProfileActive,
  loadSampleHealthProfile,
  clearSampleHealthProfile,
} from "@/services/sampleData/sampleProfile";

import {
  formatAdaptiveSignal,
  formatGoalTitle,
  formatPatternDetail,
  formatScoreContribution,
} from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — HealthGuardian AI" },
      {
        name: "description",
        content: "Personalized health summary and adaptive biomarker patterns.",
      },
      { property: "og:title", content: "HealthGuardian Dashboard" },
      {
        property: "og:description",
        content: "Track your vitals, score, and adaptive health baselines.",
      },
    ],
  }),
});

function Dashboard() {
  const uid = useUid();
  const qc = useQueryClient();
  const online = useAppStore((s) => s.online);
  const { t } = useTranslation();
  const { checkins, patterns, score, isLoading, isError, refetch } = useAnalysis(uid);
  const goals = useGoals(uid);

  const [loadingDemo, setLoadingDemo] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);

  const adaptiveEvidence = calculateAdaptiveEvidence(checkins);
  const healthContext = buildHealthContext(adaptiveEvidence);
  const adaptiveInsights = healthContext.explanationSignals;

  useEffect(() => {
    if (uid) {
      if (patterns.length) void syncPatternNotifications(uid, patterns);
      if (checkins.length) void syncAdaptiveNotifications(uid, checkins);
    }
  }, [uid, patterns, checkins]);

  const today = new Date().toDateString();
  const doneToday = checkins.some((c) => toDate(c.date)?.toDateString() === today);
  const last = checkins[0];
  const isSampleActive = isSampleProfileActive();

  const handleLoadSample = async () => {
    if (!uid) return;
    setLoadingDemo(true);
    try {
      await loadSampleHealthProfile(uid);
      await qc.invalidateQueries({ queryKey: ["analysis", uid] });
      await qc.invalidateQueries({ queryKey: ["goals", uid] });
      await refetch();
      toast.success(t("dashboard.sampleLoaded") || "Sample health profile loaded! Explore your dashboard.");
    } catch (e) {
      toast.error("Failed to load sample data. Please try again.");
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleClearSample = async () => {
    if (!uid) return;
    setClearingDemo(true);
    try {
      await clearSampleHealthProfile(uid);
      await qc.invalidateQueries({ queryKey: ["analysis", uid] });
      await qc.invalidateQueries({ queryKey: ["goals", uid] });
      await refetch();
      toast.success(t("dashboard.sampleCleared") || "Sample data cleared. Ready for your personal records!");
    } catch (e) {
      toast.error("Failed to clear sample data. Please try again.");
    } finally {
      setClearingDemo(false);
    }
  };

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      {!online && <OfflineNotice />}

      {/* Sample Profile Banner (if viewing demo data) */}
      {isSampleActive && checkins.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t("dashboard.sampleBanner")}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 text-foreground cursor-pointer"
            onClick={handleClearSample}
            disabled={clearingDemo}
          >
            {clearingDemo ? (
              <>
                <Loader2 className="mr-1.5 size-3 animate-spin" />
                <span>{t("dashboard.clearingSample")}</span>
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 size-3 text-destructive" />
                <span>{t("dashboard.clearSample")}</span>
              </>
            )}
          </Button>
        </div>
      )}

      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
        action={
          <Button asChild>
            <Link to="/app/checkin">
              <CalendarCheck className="mr-2 size-4" />
              {doneToday ? t("dashboard.updateToday") : t("dashboard.logNow")}
            </Link>
          </Button>
        }
      />

      {checkins.length === 0 ? (
        <div className="space-y-6">
          {/* Welcome & 3-Step Quick Start Hub */}
          <div className="surface rounded-2xl p-6 sm:p-8 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 space-y-6">
            <div className="max-w-2xl space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-1">
                <Heart className="size-3.5" />
                <span>Quick Start Guide</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {t("dashboard.onboardingTitle")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("dashboard.onboardingSubtitle")}
              </p>
            </div>

            {/* 3 Step Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Step 1 */}
              <div className="rounded-xl border bg-card/80 p-4 flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors">
                <div className="space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <CalendarCheck className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("dashboard.stepCheckinTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("dashboard.stepCheckinDesc")}
                  </p>
                </div>
                <Button asChild size="sm" className="w-full gap-1.5">
                  <Link to="/app/checkin">
                    <Mic className="size-3.5" />
                    <span>{t("dashboard.stepCheckinCta")}</span>
                  </Link>
                </Button>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border bg-card/80 p-4 flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors">
                <div className="space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FileText className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("dashboard.stepReportTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("dashboard.stepReportDesc")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full gap-1.5">
                  <Link to="/app/reports">
                    <FileText className="size-3.5 text-primary" />
                    <span>{t("dashboard.stepReportCta")}</span>
                  </Link>
                </Button>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border bg-card/80 p-4 flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors">
                <div className="space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Bot className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("dashboard.stepAssistantTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("dashboard.stepAssistantDesc")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full gap-1.5">
                  <Link to="/app/assistant">
                    <Bot className="size-3.5 text-purple-500" />
                    <span>{t("dashboard.stepAssistantCta")}</span>
                  </Link>
                </Button>
              </div>
            </div>

            {/* 1-Click Demo Mode Card */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">
                    {t("dashboard.tryDemo")}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  {t("dashboard.tryDemoDesc")}
                </p>
              </div>
              <Button
                onClick={handleLoadSample}
                disabled={loadingDemo}
                className="gap-2 shrink-0 shadow-xs cursor-pointer"
              >
                {loadingDemo ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{t("dashboard.loadingDemo")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>{t("dashboard.loadDemoButton")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* What HealthGuardian Tracks For You (Preview Cards) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("dashboard.whatYouWillSeeTitle")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="surface p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Activity className="size-4 text-primary" />
                  <span>{t("dashboard.previewScore")}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  A calculated 0–100 wellness metric reflecting sleep consistency, hydration, exercise, and vitals.
                </p>
              </div>
              <div className="surface p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Zap className="size-4 text-amber-500" />
                  <span>{t("dashboard.previewPatterns")}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Automatic local pattern detection alerts you to rising BP trends or chronic sleep debt early.
                </p>
              </div>
              <div className="surface p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Droplets className="size-4 text-blue-500" />
                  <span>{t("dashboard.previewVitals")}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  7-day and 30-day visual historical charts so you can see trends over time and share with your doctor.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <section className="surface p-6 md:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("dashboard.scoreTitle")}
              </h2>
              <Badge variant="secondary">
                {t(`dashboard.bands.${score.band}`) || SCORE_BANDS[score.band]}
              </Badge>
            </div>
            <p className="mt-2 text-5xl font-semibold tracking-tight">{score.score}</p>
            <Progress value={score.score} className="mt-4" />
            <p className="mt-3 text-xs text-muted-foreground">{t("dashboard.scoreDisclaimer")}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {score.contributions.slice(0, 5).map((c, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{formatScoreContribution(c, t)}</span>
                  <span className={c.delta < 0 ? "text-destructive" : "text-success"}>
                    {c.delta > 0 ? `+${c.delta}` : c.delta}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("dashboard.recentEntry")}
            </h2>
            <p className="mt-1 text-sm">{last ? toDate(last.date)?.toLocaleDateString() : "—"}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <Metric
                icon={Moon}
                label={t("dashboard.sleep")}
                value={last?.sleepHours != null ? `${last.sleepHours} h` : t("dashboard.notLogged")}
              />
              <Metric
                icon={Droplets}
                label={t("dashboard.water")}
                value={
                  last?.waterGlasses != null
                    ? `${last.waterGlasses} ${t("units.glasses")}`
                    : t("dashboard.notLogged")
                }
              />
              <Metric
                icon={Footprints}
                label={t("dashboard.exercise")}
                value={
                  last?.exerciseMinutes != null
                    ? `${last.exerciseMinutes} ${t("units.mins")}`
                    : t("dashboard.notLogged")
                }
              />
            </dl>
          </section>

          <section className="surface p-6 md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="size-4" /> {t("dashboard.patternsDetected")}
              </h2>
              <Link to="/app/risk" className="text-sm text-primary hover:underline">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            {ENABLE_ADAPTIVE_V2 && adaptiveInsights.length > 0 && (
              <div className="mb-4 space-y-2 mt-3">
                {adaptiveInsights.slice(0, 2).map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border-l-4 border-primary bg-muted/40 px-3 py-2.5 text-sm text-foreground font-medium"
                  >
                    <span>{formatAdaptiveSignal(insight, t)}</span>
                  </div>
                ))}
              </div>
            )}
            {patterns.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("dashboard.noPatterns")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {patterns.slice(0, 4).map((p) => (
                  <li
                    key={p.factor}
                    className="flex items-start gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                  >
                    <span
                      className={
                        p.severity === 2
                          ? "mt-1.5 size-2 shrink-0 rounded-full bg-destructive"
                          : "mt-1.5 size-2 shrink-0 rounded-full bg-warning"
                      }
                    />
                    <span>{formatPatternDetail(p, t)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="size-4" /> {t("dashboard.activeGoals")}
            </h2>
            {(goals.data ?? []).filter((g) => g.status === "active").length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("dashboard.noActiveGoals")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {(goals.data ?? [])
                  .filter((g) => g.status === "active")
                  .slice(0, 3)
                  .map((g) => (
                    <li key={g.id}>
                      <p className="text-sm font-medium">{formatGoalTitle(g.title, t)}</p>
                      <Progress
                        className="mt-1.5"
                        value={
                          g.targetValue ? Math.min(100, (g.progressValue / g.targetValue) * 100) : 0
                        }
                      />
                    </li>
                  ))}
              </ul>
            )}
            <Button asChild variant="ghost" size="sm" className="mt-4 px-0">
              <Link to="/app/goals">
                {t("dashboard.manageGoals")} <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </section>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Moon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" /> {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
