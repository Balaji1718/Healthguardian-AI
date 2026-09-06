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
import { useState, type ReactNode } from "react";
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
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/90 px-3 backdrop-blur sm:px-4 lg:pl-[17rem]">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
        <Link to="/app/dashboard" className="flex items-center gap-2 lg:hidden">
          <Heart className="size-5 text-primary" />
          <span className="font-semibold">{t("common.appName")}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-xs font-medium text-warning-foreground">
              <WifiOff className="size-3.5" /> {t("common.offline")}
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

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar transition-transform lg:translate-x-0 flex flex-col justify-between",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4 shrink-0">
          <Heart className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">HealthGuardian AI</span>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
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
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
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
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-3 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4">
          {path === "/app/dashboard" && (
            <NewUserGuidePrompt onStartTour={() => setTourOpen(true)} />
          )}
          {children}
        </div>
      </main>

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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
