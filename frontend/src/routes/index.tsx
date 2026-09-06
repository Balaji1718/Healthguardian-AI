import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  FileText,
  Heart,
  LineChart,
  Lock,
  Mic,
  Moon,
  Shield,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MEDICAL_DISCLAIMER } from "@/core/constants/health";
import { LanguageSelector } from "@/features/i18n/LanguageSelector";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useTranslation } from "@/locales/i18n";
import { useAuthListener } from "@/features/auth/useAuth";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "HealthGuardian AI — Preventive health, privately" },
      {
        name: "description",
        content:
          "Your private preventive health companion: voice check-ins, on-device lab report reading, deterministic risk pattern detection, and a safe AI assistant.",
      },
      { property: "og:title", content: "HealthGuardian AI — Preventive Health Intelligence" },
      {
        property: "og:description",
        content:
          "Daily check-ins, on-device medical report reading, and preventive health insights you control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

export function Landing() {
  const { t } = useTranslation();
  const { user, loading } = useAuthListener();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/app/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const steps = [
    {
      num: "01",
      title: t("landing.step1Title"),
      desc: t("landing.step1Desc"),
      icon: Mic,
      tag: t("landing.step1Tag"),
    },
    {
      num: "02",
      title: t("landing.step2Title"),
      desc: t("landing.step2Desc"),
      icon: Activity,
      tag: t("landing.step2Tag"),
    },
    {
      num: "03",
      title: t("landing.step3Title"),
      desc: t("landing.step3Desc"),
      icon: Bot,
      tag: t("landing.step3Tag"),
    },
  ];

  const pillars = [
    {
      icon: Mic,
      title: t("landing.pillar1Title"),
      badge: t("landing.pillar1Badge"),
      desc: t("landing.pillar1Desc"),
      mockUi: (
        <div className="mt-5 rounded-xl border bg-background/50 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between text-muted-foreground border-b pb-2">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {t("landing.mockPillar1Header")}
            </span>
            <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {t("landing.mockPillar1Lang")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 py-1">
            <span className="h-2 w-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="h-4 w-1 rounded-full bg-emerald-500/80 animate-pulse" />
            <span className="h-6 w-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="h-3 w-1 rounded-full bg-emerald-500/60 animate-pulse" />
            <span className="h-5 w-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="h-2 w-1 rounded-full bg-emerald-500/70 animate-pulse" />
            <span className="text-[11px] text-muted-foreground ml-2 italic">
              {t("landing.mockPillar1Quote")}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-primary font-medium text-[11px]">
              <Moon className="size-3" /> {t("landing.mockPillar1Tag1")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-blue-600 dark:text-blue-400 font-medium text-[11px]">
              <Droplets className="size-3" /> {t("landing.mockPillar1Tag2")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
              <Activity className="size-3" /> {t("landing.mockPillar1Tag3")}
            </span>
          </div>
        </div>
      ),
    },
    {
      icon: FileText,
      title: t("landing.pillar2Title"),
      badge: t("landing.pillar2Badge"),
      desc: t("landing.pillar2Desc"),
      mockUi: (
        <div className="mt-5 rounded-xl border bg-background/50 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" /> {t("landing.mockPillar2Header")}
            </span>
            <Badge variant="outline" className="text-[10px] bg-background text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              {t("landing.mockPillar2Badge")}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 border">
              <span className="text-muted-foreground font-medium">{t("landing.mockPillar2Item1")}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t("landing.mockPillar2Val1")}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2 border border-amber-500/20">
              <span className="text-foreground font-medium">{t("landing.mockPillar2Item2")}</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{t("landing.mockPillar2Val2")}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: LineChart,
      title: t("landing.pillar3Title"),
      badge: t("landing.pillar3Badge"),
      desc: t("landing.pillar3Desc"),
      mockUi: (
        <div className="mt-5 rounded-xl border bg-background/50 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground font-medium">{t("landing.mockPillar3Label")}</span>
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 font-semibold">
              {t("landing.mockPillar3Score")}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden p-0.5 border">
              <div className="h-full bg-emerald-500 rounded-full w-[86%]" />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
              <span>0</span>
              <span>50</span>
              <span className="font-semibold text-foreground">86</span>
              <span>100</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground pt-1 border-t">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span className="font-medium text-foreground">{t("landing.mockPillar3Insight")}</span>
          </div>
        </div>
      ),
    },
    {
      icon: Bot,
      title: t("landing.pillar4Title"),
      badge: t("landing.pillar4Badge"),
      desc: t("landing.pillar4Desc"),
      mockUi: (
        <div className="mt-5 rounded-xl border bg-background/50 p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="size-6 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Bot className="size-3.5" />
            </div>
            <span className="font-semibold text-foreground">{t("landing.mockPillar4Bot")}</span>
            <Shield className="size-3 text-emerald-500 ml-auto" />
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground leading-relaxed border italic">
            {t("landing.mockPillar4Msg")}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
            <span className="font-medium">{t("landing.mockPillar4Foot1")}</span>
            <span className="font-semibold text-primary">{t("landing.mockPillar4Foot2")}</span>
          </div>
        </div>
      ),
    },
  ];

  const faqs = [
    { q: t("landing.faq1Q"), a: t("landing.faq1A") },
    { q: t("landing.faq2Q"), a: t("landing.faq2A") },
    { q: t("landing.faq3Q"), a: t("landing.faq3A") },
    { q: t("landing.faq4Q"), a: t("landing.faq4A") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-lg">
          <Heart className="size-5 text-primary" /> {t("common.appName")}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSelector variant="header" />
          <ThemeToggle variant="compact" />
          <Button asChild variant="secondary" size="sm">
            {user ? (
              <Link to="/app/dashboard">{t("nav.dashboard") || "Dashboard"}</Link>
            ) : (
              <Link to="/auth">{t("landing.signIn")}</Link>
            )}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hg-hero mx-auto max-w-6xl w-[calc(100%-2.5rem)] rounded-3xl px-6 py-14 sm:px-12 sm:py-18">
        <p className="text-sm font-medium opacity-90">{t("landing.tagline")}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mt-5 max-w-2xl text-base opacity-95 leading-relaxed">{t("landing.heroDescription")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <Button asChild size="lg" variant="secondary">
              <Link to="/app/dashboard">
                {t("nav.dashboard") || "Dashboard"}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" variant="secondary">
                <Link to="/auth" search={{ mode: "register" }}>
                  {t("landing.createAccount")}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
              >
                <Link to="/auth">{t("landing.alreadyHaveAccount")}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Reassurance Micro-Badges inside Hero */}
        <div className="mt-10 flex flex-wrap items-center gap-4 text-xs opacity-90">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> {t("landing.trustZeroUploads")}
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3.5" /> {t("landing.trustOffline")}
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> {t("landing.trustSafe")}
          </span>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section className="mx-auto max-w-6xl w-full px-5 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("landing.howItWorksTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("landing.howItWorksSubtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.num} className="surface flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-2xl font-bold text-muted-foreground/40">
                      {step.num}
                    </span>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {step.tag}
                  </Badge>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4 Core Pillars Showcase */}
      <section className="mx-auto max-w-6xl w-full px-5 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("landing.pillarTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("landing.pillarSubtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className="surface flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {pillar.badge}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
                {pillar.mockUi}
              </article>
            );
          })}
        </div>
      </section>

      {/* Privacy Architecture Section */}
      <section className="mx-auto max-w-6xl w-full px-5 py-12">
        <div className="surface p-6 sm:p-8">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-3 text-xs">
              {t("landing.privacyBadge")}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t("landing.privacyTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("landing.privacySubtitle")}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/50 p-5 space-y-2">
              <Lock className="size-5 text-primary mb-2" />
              <h4 className="text-sm font-semibold text-foreground">{t("landing.privacy1Title")}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("landing.privacy1Desc")}</p>
            </div>
            <div className="rounded-xl border bg-background/50 p-5 space-y-2">
              <CheckCircle2 className="size-5 text-emerald-500 mb-2" />
              <h4 className="text-sm font-semibold text-foreground">{t("landing.privacy2Title")}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("landing.privacy2Desc")}</p>
            </div>
            <div className="rounded-xl border bg-background/50 p-5 space-y-2">
              <ShieldCheck className="size-5 text-primary mb-2" />
              <h4 className="text-sm font-semibold text-foreground">{t("landing.privacy3Title")}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("landing.privacy3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) */}
      <section className="mx-auto max-w-3xl w-full px-5 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("landing.faqTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("landing.faqSubtitle")}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={faq.q} className="surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="flex w-full items-center justify-between p-5 text-left font-semibold text-foreground text-sm sm:text-base gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Bottom CTA */}
      <section className="mx-auto max-w-6xl w-full px-5 py-8">
        <div className="surface p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-muted-foreground">
            {t("landing.ctaSubtitle")}
          </p>
          <div className="mt-6">
            <Button asChild size="lg" variant="default">
              <Link to="/auth" search={{ mode: "register" }}>
                <span>{t("landing.createAccount")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl w-full px-5 py-10 text-xs text-muted-foreground text-center space-y-3">
        <p className="leading-relaxed max-w-3xl mx-auto">
          {t("common.medicalDisclaimer") || MEDICAL_DISCLAIMER}
        </p>
        <p className="pt-2">
          &copy; {new Date().getFullYear()} {t("common.appName")}. {t("landing.allRightsReserved")}
        </p>
      </footer>
    </div>
  );
}
