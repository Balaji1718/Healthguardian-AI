import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUid } from "@/features/auth/useAuth";
import { useSupportRequests } from "@/features/health/queries";
import { supportSchema } from "@/core/validation/schemas";
import { createSupportRequest, toDate } from "@/services/firebase/repositories";
import {
  formatSupportPriority,
  formatSupportStatus,
  formatSupportType,
} from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";
import { getFirebaseAuth } from "@/services/firebase/auth";

export const Route = createFileRoute("/app/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support — HealthGuardian AI" },
      {
        name: "description",
        content: "Raise a question or issue about your HealthGuardian AI account and data.",
      },
      { property: "og:title", content: "HealthGuardian support" },
      {
        property: "og:description",
        content: "Raise a question or issue about your account and data.",
      },
    ],
  }),
});

export function SupportPage() {
  const uid = useUid();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSupportRequests(uid);
  const [form, setForm] = useState({
    type: "question",
    reason: "",
    message: "",
    priority: "normal" as "low" | "normal" | "high",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    const parsed = supportSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const requestId = await createSupportRequest(uid, {
        type: form.type,
        reason: form.reason,
        message: form.message,
        status: "open",
        priority: form.priority,
      });
      let emailDelivered = false;
      try {
        const emailResponse = await fetch("/api/support/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            userEmail: getFirebaseAuth().currentUser?.email ?? "",
            userName: getFirebaseAuth().currentUser?.displayName ?? "",
            requestId,
          }),
        });
        const emailResult = (await emailResponse.json()) as { delivered?: boolean };
        emailDelivered = emailResult.delivered === true;
      } catch {
        emailDelivered = false;
      }
      await qc.invalidateQueries({ queryKey: ["support"] });
      setForm({ type: "question", reason: "", message: "", priority: "normal" });
      toast.success(
        emailDelivered
          ? "Support request sent to the HealthGuardian support team."
          : "Support request saved. Email delivery is pending server configuration.",
      );
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("support.title")} description={t("support.subtitle")} />

      <form onSubmit={submit} className="surface grid gap-4 p-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="type">{t("support.type")}</Label>
          <select
            id="type"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {["question", "bug", "data_correction", "account", "feedback"].map((typeKey) => (
              <option key={typeKey} value={typeKey}>
                {formatSupportType(typeKey, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priority">{t("support.priority")}</Label>
          <select
            id="priority"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value as "low" | "normal" | "high" })
            }
          >
            {["low", "normal", "high"].map((prioKey) => (
              <option key={prioKey} value={prioKey}>
                {formatSupportPriority(prioKey, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="reason">{t("support.summary")}</Label>
          <Input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          {errors["reason"] && <p className="text-xs text-destructive">{errors["reason"]}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="message">{t("support.details")}</Label>
          <Textarea
            id="message"
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LifeBuoy className="mr-2 size-4" />
            )}{" "}
            {t("support.submitBtn")}
          </Button>
        </div>
      </form>

      <section className="mt-8 space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          {t("support.requestsHistory")}
        </h2>
        {(data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("support.noRequests")}</p>
        ) : (
          (data ?? []).map((r) => (
            <article key={r.id} className="surface flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{r.reason}</span>
              <Badge variant="secondary" className="capitalize">
                {formatSupportStatus(r.status, t)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {toDate(r.createdAt ?? null)?.toLocaleDateString() ?? ""}
              </span>
            </article>
          ))
        )}
      </section>

      <Disclaimer />
    </div>
  );
}
