import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Bot,
  CalendarCheck,
  Compass,
  FileText,
  Gauge,
  Heart,
  LayoutGrid,
  LifeBuoy,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Stethoscope,
  Target,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { logout } from "@/services/firebase/auth";
import { GuidedTourModal } from "@/features/guide/GuidedTourModal";
import { NewUserGuidePrompt } from "@/features/guide/NewUserGuidePrompt";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { LanguageSelector } from "@/features/i18n/LanguageSelector";
import { useTranslation } from "@/locales/i18n";
import { ensureWebPushSubscribed, listenForForegroundPush } from "@/services/notifications/webPush";
import { showBrowserNotification } from "@/services/notifications/notifications";

export const NAV_SECTIONS = [
  {
    titleKey: "nav.sectionDaily",
    defaultTitle: "Daily Routine",
    items: [
      { to: "/app/dashboard", key: "nav.dashboard", defaultLabel: "Dashboard", icon: Gauge },
      {
        to: "/app/checkin",
        key: "nav.dailyCheckin",
        defaultLabel: "Daily Check-in",
        icon: CalendarCheck,
      },
      { to: "/app/assistant", key: "nav.assistant", defaultLabel: "AI Assistant", icon: Bot },
    ],
  },
  {
    titleKey: "nav.sectionIntelligence",
    defaultTitle: "Health Records & Insights",
    items: [
      { to: "/app/reports", key: "nav.reports", defaultLabel: "Medical Reports", icon: FileText },
      { to: "/app/risk", key: "nav.risk", defaultLabel: "Risk & Patterns", icon: Activity },
      { to: "/app/history", key: "nav.history", defaultLabel: "Health History", icon: LineChart },
      { to: "/app/goals", key: "nav.goals", defaultLabel: "Goals", icon: Target },
    ],
  },
  {
    titleKey: "nav.sectionSystem",
    defaultTitle: "Care & Settings",
    items: [
      {
        to: "/app/specialist",
        key: "nav.specialist",
        defaultLabel: "Specialist Guidance",
        icon: Stethoscope,
      },
      { to: "/app/guide", key: "nav.guide", defaultLabel: "Help & Guide", icon: Compass },
      { to: "/app/notifications", key: "nav.notifications", defaultLabel: "Notifications", icon: Bell },
      { to: "/app/support", key: "nav.support", defaultLabel: "Support", icon: LifeBuoy },
      { to: "/app/settings", key: "nav.settings", defaultLabel: "Profile & Privacy", icon: Settings },
    ],
  },
] as const;

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const user = useAppStore((s) => s.user);
  const online = useAppStore((s) => s.online);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();

  // Keep FCM device token synced and listen for real-time foreground pushes
  useEffect(() => {
    if (!user?.uid) return;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      // 1. Auto-subscribe device token to FCM
      await ensureWebPushSubscribed(user.uid);

      // 2. Listen for real-time foreground pushes while user is in the app
      unsubscribe = await listenForForegroundPush((payload) => {
        const title = payload.notification?.title || payload.data?.title || "HealthGuardian AI";
        const body = payload.notification?.body || payload.data?.body || "You have a new health alert.";

        // Audio & vibration alert
        void showBrowserNotification(title, body);

        // In-app interactive toast
        toast.info(title, {
          description: body,
          action: {
            label: "View",
            onClick: () => void navigate({ to: "/app/notifications" }),
          },
        });

        // Invalidate notifications query to update unread badge and notification center
        void qc.invalidateQueries({ queryKey: ["notifications"] });
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, qc, navigate]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      await logout();
      toast.success(t("common.signOutSuccess") || "Signed out successfully.");
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const nav = (
    <nav className="flex flex-col gap-4 p-3">
      {NAV_SECTIONS.map((section) => (
        <div key={section.titleKey} className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {t(section.titleKey) || section.defaultTitle}
          </div>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ to, key, defaultLabel, icon: Icon }) => {
              const active = path === to;
              const label = t(key) || defaultLabel;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors touch-press",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Mobile-First Header Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-3.5 backdrop-blur sm:px-4 lg:pl-[17rem]">
        <Link to="/app/dashboard" className="flex items-center gap-2 font-bold tracking-tight text-sm sm:text-base">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Heart className="size-4 text-primary fill-primary/20" />
          </div>
          <span>{t("common.appName")}</span>
        </Link>

        <div className="flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-medium text-warning-foreground">
              <WifiOff className="size-3" /> {t("common.offline")}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTourOpen(true)}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t("common.guidedTour")}</span>
          </Button>
          <LanguageSelector variant="header" />
          <ThemeToggle variant="compact" />
        </div>
      </header>

      {/* Desktop Persistent Sidebar (lg:) & Mobile Slide-Out Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar transition-transform lg:translate-x-0 flex flex-col justify-between shadow-xl lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-primary" />
            <span className="font-semibold tracking-tight">HealthGuardian AI</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="size-8 lg:hidden text-muted-foreground"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">{nav}</div>

        {user && (
          <div className="border-t p-3 shrink-0 flex items-center justify-between gap-2 bg-sidebar-accent/15">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {user.displayName || user.email?.split("@")[0] || "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user.email || ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer touch-press"
              title={t("common.signOut") || "Sign out"}
              aria-label={t("common.signOut") || "Sign out"}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-4xl px-3.5 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-6 lg:pb-8">
          {path === "/app/dashboard" && (
            <NewUserGuidePrompt onStartTour={() => setTourOpen(true)} />
          )}
          {children}
        </div>
      </main>

      {/* Native Mobile Bottom Navigation Bar (Thumb-Accessible) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t bg-card/95 backdrop-blur-md px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg"
      >
        <Link
          to="/app/dashboard"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] text-[10px] font-medium transition-colors touch-press",
            path === "/app/dashboard"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Gauge className="size-5 mb-0.5" />
          <span className="truncate max-w-[64px]">{t("nav.dashboard") || "Home"}</span>
        </Link>

        <Link
          to="/app/reports"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] text-[10px] font-medium transition-colors touch-press",
            path === "/app/reports"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FileText className="size-5 mb-0.5" />
          <span className="truncate max-w-[64px]">{t("nav.reports") || "Reports"}</span>
        </Link>

        {/* Center Floating Action Check-in Button */}
        <Link
          to="/app/checkin"
          className="relative -top-3 flex flex-col items-center group touch-press"
          aria-label={t("nav.dailyCheckin") || "Daily Check-in"}
        >
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full shadow-md transition-all duration-200",
              path === "/app/checkin"
                ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105"
                : "bg-primary text-primary-foreground shadow-primary/25 hover:scale-105",
            )}
          >
            <CalendarCheck className="size-6" />
          </div>
          <span
            className={cn(
              "text-[10px] mt-0.5 font-medium tracking-tight",
              path === "/app/checkin" ? "text-primary font-bold" : "text-muted-foreground",
            )}
          >
            {t("nav.dailyCheckin") || "Check-in"}
          </span>
        </Link>

        <Link
          to="/app/assistant"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] text-[10px] font-medium transition-colors touch-press",
            path === "/app/assistant"
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Bot className="size-5 mb-0.5" />
          <span className="truncate max-w-[64px]">{t("nav.assistant") || "Assistant"}</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] text-[10px] font-medium transition-colors touch-press cursor-pointer",
            open || (path !== "/app/dashboard" && path !== "/app/reports" && path !== "/app/checkin" && path !== "/app/assistant")
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-5 mb-0.5" />
          <span className="truncate max-w-[64px]">More</span>
        </button>
      </nav>

      <GuidedTourModal open={tourOpen} onOpenChange={setTourOpen} />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
