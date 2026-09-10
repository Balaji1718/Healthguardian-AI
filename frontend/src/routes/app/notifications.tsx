import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Filter,
  Inbox,
  Trash2,
} from "lucide-react";
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
import { ensureWebPushSubscribed, registerWebPush } from "@/services/notifications/webPush";
import { cn } from "@/lib/utils";

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
  const { t, language } = useTranslation();
  const { data, isLoading, isError, refetch } = useNotificationsQuery(uid);
  const [filter, setFilter] = useState<"all" | "unread" | "high">("all");
  const [isProcessing, setIsProcessing] = useState(false);

  const permission = notificationPermission();

  // Auto-sync FCM device token when permission is granted
  useEffect(() => {
    if (uid && permission === "granted") {
      void ensureWebPushSubscribed(uid);
    }
  }, [uid, permission]);

  const enable = async () => {
    const res = await requestNotificationPermission();
    if (res === "granted") {
      const push = uid ? await registerWebPush(uid) : { ok: false };
      toast.success(push.ok ? "Alerts enabled on this device." : "Browser alerts enabled.");
    } else if (res === "unsupported") {
      toast.error(t("common.error"));
    } else {
      toast.warning(t("common.offlineNotice"));
    }
  };

  const allItems = useMemo(
    () => (data ?? []).filter((n) => n.status !== "dismissed"),
    [data],
  );

  const unreadCount = useMemo(
    () => allItems.filter((n) => n.status !== "read").length,
    [allItems],
  );

  const filteredItems = useMemo(() => {
    if (filter === "unread") return allItems.filter((n) => n.status !== "read");
    if (filter === "high") return allItems.filter((n) => n.priority === "high");
    return allItems;
  }, [allItems, filter]);

  const markAllAsRead = async () => {
    if (!uid || unreadCount === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const unreadList = allItems.filter((n) => n.status !== "read" && n.id);
      await Promise.all(unreadList.map((n) => markRead(uid, n.id!)));
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read.");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const dismissAll = async () => {
    if (!uid || allItems.length === 0 || isProcessing) return;
    if (!window.confirm("Clear all notifications?")) return;
    setIsProcessing(true);
    try {
      const itemsToDismiss = allItems.filter((n) => n.id);
      await Promise.all(itemsToDismiss.map((n) => dismiss(uid, n.id!)));
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications cleared.");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatRelativeTime = (date: Date | null) => {
    if (!date) return "";
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-12">
      {/* Mobile-First Header */}
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("notifications.title")}
            </h1>
            {unreadCount > 0 && (
              <Badge className="h-5 px-1.5 text-[11px] font-semibold bg-primary text-primary-foreground">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("notifications.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <ContextualHelp content="Alerts are for awareness, not emergency monitoring. Notifications never expose private clinical details." />
          
          {permission !== "granted" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => void enable()}
              className="h-8 text-xs gap-1.5 rounded-full touch-press shadow-xs"
              disabled={isProcessing}
            >
              <BellRing className="size-3.5" />
              <span>{t("notifications.enableAlerts")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Filter Tabs & Bulk Actions Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all touch-press",
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all touch-press flex items-center gap-1.5",
              filter === "unread"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="size-1.5 rounded-full bg-amber-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("high")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all touch-press",
              filter === "high"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Priority
          </button>
        </div>

        {allItems.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                disabled={isProcessing}
                className="h-8 text-[11px] text-primary hover:text-primary font-medium px-2 touch-press"
                title="Mark all as read"
              >
                <CheckCheck className="size-3.5 mr-1" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissAll}
              disabled={isProcessing}
              className="h-8 text-[11px] text-muted-foreground hover:text-destructive px-2 touch-press"
              title="Clear all"
            >
              <Trash2 className="size-3.5 mr-1" />
              <span className="hidden sm:inline">Clear all</span>
            </Button>
          </div>
        )}
      </div>

      {/* Notifications Mobile List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border bg-card/60 p-8 text-center space-y-3">
          <div className="size-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Inbox className="size-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {filter === "unread" ? "No unread notifications" : t("notifications.emptyTitle")}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
              {filter === "unread"
                ? "You are completely caught up with your daily health logs and alerts."
                : t("notifications.emptyDesc")}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filteredItems.map((n) => {
            const isUnread = n.status !== "read";
            const createdDate = toDate(n.createdAt ?? null);

            return (
              <li
                key={n.id}
                className={cn(
                  "rounded-2xl border p-3.5 transition-all shadow-xs relative overflow-hidden",
                  isUnread
                    ? "bg-card border-primary/30 shadow-primary/5 ring-1 ring-primary/10"
                    : "bg-card/70 border-border/70 text-muted-foreground",
                )}
              >
                {/* Unread Accent Bar */}
                {isUnread && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}

                <div className="flex items-start gap-3">
                  {/* Category / Priority Icon Badge */}
                  <div
                    className={cn(
                      "size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      n.priority === "high"
                        ? "bg-destructive/10 text-destructive"
                        : isUnread
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {n.priority === "high" ? (
                      <BellRing className="size-4" />
                    ) : (
                      <Bell className="size-4" />
                    )}
                  </div>

                  {/* Notification Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isUnread && (
                          <span className="size-2 rounded-full bg-primary shrink-0" />
                        )}
                        <h2 className="text-xs font-semibold text-foreground truncate">
                          {formatNotificationTitle(n, t)}
                        </h2>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-medium flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {formatRelativeTime(createdDate)}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/85 leading-relaxed break-words">
                      {formatNotificationMessage(n, t)}
                    </p>

                    {/* Mobile 1-Tap Actions Row */}
                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/40">
                      {isUnread && n.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await markRead(uid!, n.id!);
                            await qc.invalidateQueries({ queryKey: ["notifications"] });
                            toast.success("Marked as read");
                          }}
                          className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 rounded-lg touch-press"
                        >
                          <Check className="size-3" />
                          <span>{t("notifications.markRead") || "Mark read"}</span>
                        </Button>
                      )}
                      {n.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await dismiss(uid!, n.id!);
                            await qc.invalidateQueries({ queryKey: ["notifications"] });
                          }}
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg touch-press"
                        >
                          <Trash2 className="size-3" />
                          <span>{t("notifications.dismiss") || "Dismiss"}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Disclaimer />
    </div>
  );
}
