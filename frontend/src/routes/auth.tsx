import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authSchema, registerSchema } from "@/core/validation/schemas";
import {
  login,
  register,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
} from "@/services/firebase/auth";
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

  // Email OTP recovery state
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "password">("email");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSessionToken, setResetSessionToken] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (mode) setAuthMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/app/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  // Cooldown countdown timer for OTP requests
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isFirebaseConfigured) return <FirebaseSetupNotice />;

  if (loading || user) {
    return (
      <AppLoadingScreen label={t("auth.checkingSession")} sublabel={t("auth.restoringProfile")} />
    );
  }

  const changeMode = (next: "login" | "register" | "forgot") => {
    setAuthMode(next);
    setForgotStep("email");
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetSessionToken(null);
    setErrors({});
    setShowPassword(false);
    setShowNewPassword(false);
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

  // Step 1: Send OTP to email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: t("auth.invalidEmail") });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await sendPasswordResetOtp(email);
      if (!res.ok) {
        if (res.cooldownRemainingSeconds) {
          setCooldownSeconds(res.cooldownRemainingSeconds);
        }
        toast.error(res.error || "Unable to send verification code. Please try again.");
        return;
      }
      setCooldownSeconds(60);
      setForgotStep("otp");
      toast.success(res.message || t("auth.otpSentNotice"));
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Verify 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrors({ otp: "Please enter the 6-digit verification code." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await verifyPasswordResetOtp(form.email.trim(), cleanOtp);
      if (!res.ok || !res.resetSessionToken) {
        if (res.attemptsLeft !== undefined) {
          setAttemptsRemaining(res.attemptsLeft);
        }
        toast.error(res.error || "Invalid verification code.");
        return;
      }
      setResetSessionToken(res.resetSessionToken);
      setForgotStep("password");
      toast.success(res.message || "Code verified successfully.");
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Set new password using single-use reset token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetSessionToken) {
      toast.error("Session expired. Please request a new verification code.");
      setForgotStep("email");
      return;
    }
    if (newPassword.length < 8) {
      setErrors({ newPassword: "Password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: t("auth.passwordMismatch") });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await resetPasswordWithToken(resetSessionToken, newPassword);
      if (!res.ok) {
        toast.error(res.error || "Password reset failed. Please start again.");
        setForgotStep("email");
        return;
      }
      toast.success(t("auth.passwordResetSuccess"));
      // Transition back to login mode with email preserved
      setAuthMode("login");
      setForgotStep("email");
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      setResetSessionToken(null);
      void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
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

              {/* Step 1: Request OTP */}
              {forgotStep === "email" && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground">
                      {t("auth.forgotPassword")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter your email to receive a secure 6-digit verification code.
                    </p>
                  </div>

                  <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
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

                    <Button type="submit" className="w-full" disabled={busy || cooldownSeconds > 0}>
                      {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {cooldownSeconds > 0
                        ? `Wait ${cooldownSeconds}s to resend`
                        : t("auth.sendOtp")}
                    </Button>
                  </form>
                </div>
              )}

              {/* Step 2: Enter 6-digit OTP */}
              {forgotStep === "otp" && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <KeyRound className="size-5 text-primary" /> {t("auth.verifyOtp")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("auth.otpSentNotice")}{" "}
                      <span className="font-medium text-foreground">{form.email}</span>.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="otp-input">{t("auth.otpCode")}</Label>
                      <Input
                        id="otp-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        placeholder="••••••"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="text-center font-mono text-2xl tracking-[0.3em] font-semibold h-12"
                      />
                      {errors["otp"] && <p className="text-xs text-destructive">{errors["otp"]}</p>}
                      {attemptsRemaining !== null && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {attemptsRemaining} {attemptsRemaining === 1 ? "attempt" : "attempts"}{" "}
                          remaining before code lockout.
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={busy || otpCode.length !== 6}
                    >
                      {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t("auth.verifyOtp")}
                    </Button>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setForgotStep("email")}
                        className="text-muted-foreground hover:text-foreground underline cursor-pointer"
                      >
                        Change email
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={busy || cooldownSeconds > 0}
                        className={`inline-flex items-center gap-1 font-medium cursor-pointer ${
                          cooldownSeconds > 0
                            ? "text-muted-foreground cursor-not-allowed opacity-60"
                            : "text-primary hover:underline"
                        }`}
                      >
                        <RefreshCw className="size-3" />
                        {cooldownSeconds > 0
                          ? `Resend in ${cooldownSeconds}s`
                          : t("auth.resendOtp")}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 3: Enter New Password */}
              {forgotStep === "password" && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" /> {t("auth.setNewPassword")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter a new secure password with at least 8 characters.
                    </p>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-3 my-auto text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showNewPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                      {errors["newPassword"] && (
                        <p className="text-xs text-destructive">{errors["newPassword"]}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-new-password">{t("auth.confirmPassword")}</Label>
                      <Input
                        id="confirm-new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      {errors["confirmPassword"] && (
                        <p className="text-xs text-destructive">{errors["confirmPassword"]}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={busy || newPassword.length < 8}
                    >
                      {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {t("auth.setNewPassword")}
                    </Button>
                  </form>
                </div>
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
