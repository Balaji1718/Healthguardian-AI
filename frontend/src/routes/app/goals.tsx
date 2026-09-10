import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUid } from "@/features/auth/useAuth";
import { useGoals } from "@/features/health/queries";
import { goalSchema } from "@/core/validation/schemas";
import { GOAL_TYPES } from "@/core/constants/health";
import { createGoal, deleteGoal, updateGoal } from "@/services/firebase/repositories";
import { ContextualHelp } from "@/features/guide/ContextualHelp";
import { formatGoalProgress, formatGoalTitle } from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";

export const Route = createFileRoute("/app/goals")({
  component: GoalsPage,
  head: () => ({
    meta: [
      { title: "Health goals — HealthGuardian AI" },
      {
        name: "description",
        content: "Set realistic lifestyle goals and track progress from your own check-ins.",
      },
      { property: "og:title", content: "Your health goals" },
      {
        property: "og:description",
        content: "Set realistic lifestyle goals and track progress over time.",
      },
    ],
  }),
});

export function GoalsPage() {
  const uid = useUid();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useGoals(uid);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    goalType: "exercise",
    targetValue: "",
    unit: "",
    frequency: "daily",
    targetDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removeCompleted, setRemoveCompleted] = useState(() => {
    try {
      return window.localStorage.getItem("hg_remove_completed_goals") === "true";
    } catch {
      return false;
    }
  });

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    const parsed = goalSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await createGoal(uid, {
        title: form.title,
        goalType: form.goalType,
        targetValue: parsed.data.targetValue,
        unit: form.unit || undefined,
        frequency: form.frequency,
        startDate: new Date(),
        targetDate: form.targetDate ? new Date(`${form.targetDate}T00:00:00`) : undefined,
        status: "active",
        progressValue: 0,
      });
      await qc.invalidateQueries({ queryKey: ["goals"] });
      setOpen(false);
      setForm({
        title: "",
        goalType: "exercise",
        targetValue: "",
        unit: "",
        frequency: "daily",
        targetDate: "",
      });
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const complete = async (id: string) => {
    if (!uid) return;
    try {
      if (removeCompleted) {
        await deleteGoal(uid, id);
        toast.success("Completed goal automatically removed.");
      } else {
        await updateGoal(uid, id, { status: "completed" });
        toast.success("Goal marked complete!", {
          action: {
            label: "Auto-remove next time",
            onClick: () => {
              setRemoveCompleted(true);
              try {
                window.localStorage.setItem("hg_remove_completed_goals", "true");
              } catch {}
              toast.success("Completed goals will be automatically removed from now on.");
            },
          },
        });
      }
      await qc.invalidateQueries({ queryKey: ["goals"] });
    } catch {
      toast.error(t("common.error"));
    }
  };

  const remove = async (id: string) => {
    if (!uid || !window.confirm("Delete this goal permanently?")) return;
    try {
      await deleteGoal(uid, id);
      await qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal deleted.");
    } catch {
      toast.error(t("common.error"));
    }
  };

  const goals = data ?? [];

  return (
    <div>
      <PageHeader
        title={t("goals.title")}
        description={t("goals.subtitle")}
        action={
          <div className="flex items-center gap-2">
            <ContextualHelp content="Progress is calculated strictly from your daily check-in logs. AI suggestions always require your approval." />
            <Button onClick={() => setOpen((v) => !v)}>
              <Plus className="mr-2 size-4" /> {t("goals.newGoalBtn")}
            </Button>
          </div>
        }
      />

      {open && (
        <form onSubmit={submit} className="surface mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">{t("goals.goalTitle")}</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Walk 30 minutes a day"
            />
            {errors["title"] && <p className="text-xs text-destructive">{errors["title"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goalType">{t("goals.category")}</Label>
            <select
              id="goalType"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={form.goalType}
              onChange={(e) => setForm({ ...form, goalType: e.target.value })}
            >
              {GOAL_TYPES.map((gt) => (
                <option key={gt} value={gt}>
                  {gt.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="frequency">{t("goals.frequency")}</Label>
            <select
              id="frequency"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              {["daily", "weekly", "monthly"].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="targetValue">{t("goals.targetNumber")}</Label>
            <Input
              id="targetValue"
              type="number"
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit">{t("goals.unitOptional")}</Label>
            <Input
              id="unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="minutes, glasses, kg"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />} {t("goals.createGoal")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("goals.cancel")}
            </Button>
          </div>
        </form>
      )}

      <label className="mb-4 flex items-start gap-3 rounded-lg border bg-card/60 p-3 text-sm">
        <input
          type="checkbox"
          checked={removeCompleted}
          onChange={(event) => {
            const enabled = event.target.checked;
            setRemoveCompleted(enabled);
            try {
              window.localStorage.setItem("hg_remove_completed_goals", String(enabled));
            } catch {
              // Ignore storage errors; the current choice still applies this session.
            }
          }}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="block font-medium">Automatically remove completed goals</span>
          <span className="text-xs text-muted-foreground">
            When enabled, marking a goal complete permanently deletes it after your explicit opt-in.
          </span>
        </span>
      </label>

      {goals.length === 0 ? (
        <EmptyState title={t("goals.emptyTitle")} description={t("goals.emptyDesc")} />
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id} className="surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Target className="size-4 text-primary" /> {formatGoalTitle(g.title, t)}
                </span>
                <Badge
                  variant={g.status === "active" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {t(`goals.status.${g.status}`) || g.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatGoalProgress(g, t)}</p>
              {g.targetValue != null && (
                <Progress
                  className="mt-3"
                  value={Math.min(100, (g.progressValue / g.targetValue) * 100)}
                />
              )}
              {g.status === "active" && g.id && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-0 text-xs"
                    onClick={() => void complete(g.id!)}
                  >
                    {t("goals.markComplete")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-0 text-xs text-destructive hover:text-destructive"
                    onClick={() => void remove(g.id!)}
                  >
                    <Trash2 className="mr-1.5 size-3.5" /> Delete
                  </Button>
                </div>
              )}
              {g.status !== "active" && g.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 px-0 text-xs text-destructive hover:text-destructive"
                  onClick={() => void remove(g.id!)}
                >
                  <Trash2 className="mr-1.5 size-3.5" /> Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Disclaimer />
    </div>
  );
}
