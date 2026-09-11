import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Heart, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authSchema, registerSchema } from "@/core/validation/schemas";
import { login, register, resetPassword } from "@/services/firebase/auth";
import { isFirebaseConfigured } from "@/services/firebase/config";
import { FirebaseSetupNotice } from "@/components/common/FirebaseSetupNotice";
import { useAuthListener } from "@/features/auth/useAuth";
import { MEDICAL_DISCLAIMER } from "@/core/constants/health";
import { LanguageSelector } from "@/features/i18n/LanguageSelector";
import { useTranslation } from "@/locales/i18n";
import { AppLoadingScreen } from "@/components/common/AppLoadingScreen";

const searchSchema = z.object({ mode: z.enum(["login", "register", "forgot"]).optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — HealthGuardian AI" },
      {
        name: "description",
        content: "Access your private HealthGuardian AI preventive health workspace.",
      },
      { property: "og:title", content: "Sign in to HealthGuardian AI" },
      { property: "og:description", content: "Access your private preventive health workspace." },
    ],
  }),
});

function friendlyError(e: unknown, t: (k: string) => string): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "That email and password combination did not match.";
  if (code.includes("email-already-in-use")) return "An account already exists with this email.";
  if (code.includes("weak-password"))
    return t("auth.passwordTooShort") || "Choose a stronger password (at least 6 characters).";
  if (code.includes("network")) return "You appear to be offline. Sign-in needs a connection.";
  if (code.includes("too-many-requests"))
    return "Too many attempts. Please wait a moment and try again.";
  return (e as Error)?.message ?? "Something went wrong. Please try again.";
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuthListener();
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">(mode || "login");
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (mode) setAuthMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/app/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  if (!isFirebaseConfigured) return <FirebaseSetupNotice />;

  if (loading || user) {
    return (
      <AppLoadingScreen label={t("auth.checkingSession")} sublabel={t("auth.restoringProfile")} />
    );
  }

  const changeMode = (next: "login" | "register" | "forgot") => {
    setAuthMode(next);
    setErrors({});
    setShowPassword(false);
    setResetSent(false);
    void navigate({
      to: "/auth",
      search: { mode: next },
      replace: true,
    });
  };

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const isRegister = authMode === "register";
    const schema = isRegister ? registerSchema : authSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (isRegister) {
        await register(form.email, form.password, form.displayName);
        toast.success(t("auth.signUpSuccess"));
      } else {
        await login(form.email, form.password);
        toast.success(t("auth.signInSuccess"));
      }
      await navigate({ to: "/app/dashboard", replace: true });
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: t("auth.invalidEmail") });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await resetPassword(email);
      setResetSent(true);
      toast.success(t("auth.resetEmailSent"));
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Heart className="size-5 text-primary" /> {t("common.appName")}
          </Link>
          <LanguageSelector variant="auth" />
        </div>

        <div className="surface p-6">
          {authMode === "forgot" ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => changeMode("login")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="size-3.5" /> {t("auth.backToSignIn")}
              </button>

              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {t("auth.forgotPassword")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email to receive password recovery instructions.
                </p>
              </div>

              {resetSent ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-medium text-sm">
                    <CheckCircle2 className="size-4" /> Recovery Email Sent
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("auth.resetEmailSent")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => changeMode("login")}
                  >
                    {t("auth.backToSignIn")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={submitForgot} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">{t("auth.email")}</Label>
                    <div className="relative">
                      <Input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="pr-10"
                      />
                      <Mail className="absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {errors["email"] && (
                      <p className="text-xs text-destructive">{errors["email"]}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {t("auth.sendResetEmail")}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground">
                {authMode === "register" ? t("auth.createAccount") : t("auth.welcome")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

              <form className="mt-5 space-y-4" onSubmit={submitAuth} noValidate>
                {authMode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName">{t("auth.fullName")}</Label>
                    <Input
                      id="displayName"
                      value={form.displayName}
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    />
                    {errors["displayName"] && (
                      <p className="text-xs text-destructive">{errors["displayName"]}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  {errors["email"] && <p className="text-xs text-destructive">{errors["email"]}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    {authMode === "login" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        onClick={() => changeMode("forgot")}
                      >
                        {t("auth.forgotPassword")}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={authMode === "register" ? "new-password" : "current-password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors["password"] && (
                    <p className="text-xs text-destructive">{errors["password"]}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {authMode === "register" ? t("auth.createAccount") : t("auth.signIn")}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm border-t pt-3">
                <button
                  type="button"
                  className="text-primary hover:underline text-xs font-medium cursor-pointer"
                  onClick={() => changeMode(authMode === "register" ? "login" : "register")}
                >
                  {authMode === "register"
                    ? t("auth.alreadyHaveAccount")
                    : t("auth.dontHaveAccount")}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground text-center">
          {t("common.medicalDisclaimer")}
        </p>
      </div>
    </div>
  );
}
