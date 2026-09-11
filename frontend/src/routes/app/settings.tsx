import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Loader2, LogOut, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUid } from "@/features/auth/useAuth";
import { useHealthProfile, useProfile } from "@/features/health/queries";
import { healthProfileSchema, profileSchema, toList } from "@/core/validation/schemas";
import {
  deleteAllHealthData,
  listCheckins,
  listGoals,
  listReports,
  saveHealthProfile,
  saveProfile,
} from "@/services/firebase/repositories";
import { deleteAllLocalDocuments } from "@/services/localStorage/documents";
import { deleteAccount, getFirebaseAuth, logout, resetPassword } from "@/services/firebase/auth";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { LanguageSelector } from "@/features/i18n/LanguageSelector";
import { useTranslation } from "@/locales/i18n";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Profile & privacy — HealthGuardian AI" },
      {
        name: "description",
        content: "Manage your profile, export your data, and delete everything permanently.",
      },
      { property: "og:title", content: "Profile and privacy controls" },
      {
        property: "og:description",
        content: "Manage your profile, export your data and delete it permanently.",
      },
    ],
  }),
});

function SettingsPage() {
  const uid = useUid();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const profile = useProfile(uid);
  const health = useHealthProfile(uid);
  const [p, setP] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    heightCm: "",
    preferredLanguage: "en",
    timezone: "Asia/Kolkata",
  });
  const [h, setH] = useState({
    knownConditions: "",
    allergies: "",
    familyHistory: "",
    currentMedications: "",
    bloodGroup: "",
    emergencyNotes: "",
  });
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const currentUserEmail = getFirebaseAuth().currentUser?.email ?? "";

  const handleSendPasswordReset = async () => {
    if (!currentUserEmail) {
      toast.error(t("auth.invalidEmail") || "No email found for this account.");
      return;
    }
    setSendingReset(true);
    try {
      await resetPassword(currentUserEmail);
      toast.success(
        t("settings.passwordResetSent") ||
          `Password reset instructions have been sent to ${currentUserEmail}`,
      );
    } catch {
      toast.error(t("common.error") || "Could not send password recovery email.");
    } finally {
      setSendingReset(false);
    }
  };

  useEffect(() => {
    if (profile.data) {
      setP((cur) => ({
        ...cur,
        firstName: profile.data?.firstName ?? "",
        lastName: profile.data?.lastName ?? "",
        gender: profile.data?.gender ?? "",
        heightCm: profile.data?.heightCm?.toString() ?? "",
        preferredLanguage: profile.data?.preferredLanguage ?? "en",
        timezone: profile.data?.timezone ?? "Asia/Kolkata",
      }));
    }
    if (health.data) {
      setH({
        knownConditions: (health.data.knownConditions ?? []).join(", "),
        allergies: (health.data.allergies ?? []).join(", "),
        familyHistory: (health.data.familyHistory ?? []).join(", "),
        currentMedications: (health.data.currentMedications ?? []).join(", "),
        bloodGroup: health.data.bloodGroup ?? "",
        emergencyNotes: health.data.emergencyNotes ?? "",
      });
    }
  }, [profile.data, health.data]);

  const save = async () => {
    if (!uid) return;
    const parsedP = profileSchema.safeParse(p);
    const parsedH = healthProfileSchema.safeParse(h);
    if (!parsedP.success || !parsedH.success) {
      toast.error(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      await saveProfile(uid, {
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender || undefined,
        heightCm: parsedP.data.heightCm,
        preferredLanguage: p.preferredLanguage,
        timezone: p.timezone,
      });
      await saveHealthProfile(uid, {
        knownConditions: toList(h.knownConditions),
        allergies: toList(h.allergies),
        familyHistory: toList(h.familyHistory),
        currentMedications: toList(h.currentMedications),
        bloodGroup: h.bloodGroup || undefined,
        emergencyNotes: h.emergencyNotes || undefined,
        healthPreferences: {},
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["healthProfile"] });
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    if (!uid) return;
    const [checkins, reports, goals] = await Promise.all([
      listCheckins(uid, 500),
      listReports(uid),
      listGoals(uid),
    ]);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            profile: profile.data,
            healthProfile: health.data,
            checkins,
            reports: reports.map((r) => ({ ...r, fileRef: undefined })),
            goals,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthguardian-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wipe = async () => {
    if (!uid) return;
    if (
      !window.confirm(
        t("settings.confirmDeleteRecords") ||
          "Permanently delete all check-ins, medical reports, goals, and guidance?",
      )
    )
      return;
    try {
      await deleteAllHealthData(uid);
      await deleteAllLocalDocuments(uid);
      await qc.invalidateQueries();
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const removeAccount = async () => {
    if (!password) {
      toast.error(
        t("settings.enterPasswordToDelete") || "Enter your password to confirm account deletion.",
      );
      return;
    }
    if (
      !window.confirm(
        t("settings.confirmDeleteAccount") || "Delete your account and every record permanently?",
      )
    )
      return;
    if (!uid) {
      toast.error("Not signed in");
      return;
    }
    try {
      await deleteAllHealthData(uid);
      await deleteAllLocalDocuments(uid);
      await deleteAccount(password);
      await navigate({ to: "/", replace: true });
    } catch {
      toast.error(
        t("settings.deleteAccountError") ||
          "Could not delete the account. Check your password and try again.",
      );
    }
  };

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

      <section className="surface grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">{t("common.aboutYou")}</h2>
        <Text
          id="firstName"
          label={t("common.firstName")}
          value={p.firstName}
          onChange={(v) => setP({ ...p, firstName: v })}
        />
        <Text
          id="lastName"
          label={t("common.lastName")}
          value={p.lastName}
          onChange={(v) => setP({ ...p, lastName: v })}
        />
        <Text
          id="gender"
          label={t("common.gender")}
          value={p.gender}
          onChange={(v) => setP({ ...p, gender: v })}
        />
        <Text
          id="heightCm"
          label={t("common.heightCm")}
          value={p.heightCm}
          onChange={(v) => setP({ ...p, heightCm: v })}
          type="number"
        />
      </section>

      <section className="surface mt-4 grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">{t("common.healthBackground")}</h2>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          {t("common.healthBackgroundDisclaimer")}
        </p>
        <Text
          id="knownConditions"
          label={t("common.knownConditions")}
          value={h.knownConditions}
          onChange={(v) => setH({ ...h, knownConditions: v })}
        />
        <Text
          id="allergies"
          label={t("common.allergies")}
          value={h.allergies}
          onChange={(v) => setH({ ...h, allergies: v })}
        />
        <Text
          id="familyHistory"
          label={t("common.familyHistory")}
          value={h.familyHistory}
          onChange={(v) => setH({ ...h, familyHistory: v })}
        />
        <Text
          id="currentMedications"
          label={t("common.currentMedications")}
          value={h.currentMedications}
          onChange={(v) => setH({ ...h, currentMedications: v })}
        />
        <Text
          id="bloodGroup"
          label={t("common.bloodGroup")}
          value={h.bloodGroup}
          onChange={(v) => setH({ ...h, bloodGroup: v })}
        />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="emergencyNotes">{t("common.emergencyNotes")}</Label>
          <Textarea
            id="emergencyNotes"
            rows={3}
            value={h.emergencyNotes}
            onChange={(e) => setH({ ...h, emergencyNotes: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} {t("common.saveChanges")}
          </Button>
        </div>
      </section>

      <section className="surface mt-4 space-y-3 p-6">
        <LanguageSelector variant="settings" />
      </section>

      <section className="surface mt-4 space-y-3 p-6">
        <h2 className="font-medium">{t("common.appearanceTheme")}</h2>
        <p className="text-sm text-muted-foreground">{t("common.appearanceThemeDesc")}</p>
        <div className="pt-1">
          <ThemeToggle variant="buttons" />
        </div>
      </section>

      {/* Account Security & Password Recovery */}
      <section className="surface mt-4 space-y-3 p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="font-medium text-foreground">{t("settings.securityTitle")}</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("settings.securityDesc")}
        </p>

        <div className="rounded-xl border bg-muted/40 p-4 space-y-3 max-w-lg">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("settings.registeredEmail")}
            </Label>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="size-4 text-primary" />
              <span>{currentUserEmail || t("common.unknown")}</span>
            </div>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              disabled={sendingReset || !currentUserEmail}
              onClick={() => void handleSendPasswordReset()}
            >
              {sendingReset ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <KeyRound className="size-3.5" />
              )}
              {t("settings.passwordResetButton")}
            </Button>
          </div>
        </div>
      </section>

      <section className="surface mt-4 space-y-3 p-6">
        <h2 className="font-medium">{t("common.yourData")}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportData()}>
            <Download className="mr-2 size-4" /> {t("common.exportEverything")}
          </Button>
          <Button variant="outline" onClick={() => void wipe()}>
            <Trash2 className="mr-2 size-4" /> {t("common.deleteAllHealthData")}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await logout();
              await navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="mr-2 size-4" /> {t("common.signOut")}
          </Button>
        </div>
      </section>

      <section className="surface mt-4 space-y-3 border-destructive/40 p-6">
        <h2 className="font-medium text-destructive">{t("common.deleteYourAccount")}</h2>
        <p className="text-sm text-muted-foreground">{t("common.deleteAccountNotice")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t("common.confirmWithPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button variant="destructive" onClick={() => void removeAccount()}>
            {t("common.deleteAccount")}
          </Button>
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}

function Text({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
