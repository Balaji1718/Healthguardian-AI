import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUid } from "@/features/auth/useAuth";
import { useNotificationsQuery } from "@/features/health/queries";
import {
  dismiss,
  markRead,
  notificationPermission,
  requestNotificationPermission,
} from "@/services/notifications/notifications";
import { toDate } from "@/services/firebase/repositories";
import { ContextualHelp } from "@/features/guide/ContextualHelp";
import {
  formatNotificationMessage,
  formatNotificationPriority,
  formatNotificationTitle,
} from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";
import { registerWebPush } from "@/services/notifications/webPush";

export const Route = createFileRoute("/app/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notifications — HealthGuardian AI" },
      {
        name: "description",
        content: "Reminders and context-aware alerts raised from your own health data.",
      },
      { property: "og:title", content: "Your health notifications" },
      {
        property: "og:description",
        content: "Reminders and alerts raised from your own health data.",
      },
    ],
  }),
});

export function NotificationsPage() {
  const uid = useUid();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useNotificationsQuery(uid);

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const enable = async () => {
    const res = await requestNotificationPermission();
    if (res === "granted") {
      const push = uid ? await registerWebPush(uid) : { ok: false };
      toast.success(push.ok ? "Alerts enabled on this device." : "Browser alerts enabled.");
    }
    else if (res === "unsupported") toast.error(t("common.error"));
    else toast.warning(t("common.offlineNotice"));
  };

  const items = (data ?? []).filter((n) => n.status !== "dismissed");
  const permission = notificationPermission();

  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.subtitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ContextualHelp content="Alerts are for awareness, not emergency monitoring. Notifications never expose private clinical details." />
            {permission !== "granted" && (
              <Button variant="outline" size="sm" onClick={() => void enable()}>
                <BellRing className="mr-2 size-4" /> {t("notifications.enableAlerts")}
              </Button>
            )}
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title={t("notifications.emptyTitle")}
          description={t("notifications.emptyDesc")}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="surface grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                <Bell className="mt-0.5 size-4 text-primary" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="min-w-0 flex-1 font-medium">{formatNotificationTitle(n, t)}</p>
                    <Badge
                      variant={n.priority === "high" ? "destructive" : "secondary"}
                      className="shrink-0 capitalize"
                    >
                      {formatNotificationPriority(n.priority, t)}
                    </Badge>
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {formatNotificationMessage(n, t)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {toDate(n.createdAt ?? null)?.toLocaleString() ?? ""}
                  </p>
                </div>
                {n.id && (
                  <div className="flex flex-wrap gap-1 sm:justify-end">
                  {n.status !== "read" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await markRead(uid!, n.id!);
                        await qc.invalidateQueries({ queryKey: ["notifications"] });
                      }}
                    >
                      {t("notifications.markRead")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await dismiss(uid!, n.id!);
                      await qc.invalidateQueries({ queryKey: ["notifications"] });
                    }}
                  >
                    {t("notifications.dismiss")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Disclaimer />
    </div>
  );
}
