import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  FileText,
  HelpCircle,
  Loader2,
  Mic,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, OfflineNotice } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { checkinSchema } from "@/core/validation/schemas";
import { COMMON_SYMPTOMS, FOOD_QUALITY_OPTIONS, WELLBEING_OPTIONS } from "@/core/constants/health";
import { checkinIdForDate, getCheckin, saveCheckin } from "@/services/firebase/repositories";
import { useUid } from "@/features/auth/useAuth";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";
import { formatSymptom } from "@/locales/formatters";
import { ContextualHelp } from "@/features/guide/ContextualHelp";
import { CaptureReview } from "@/features/checkin/CaptureReview";
import { extractCheckinFromText } from "@/services/ai/conversational-checkin";
import { UnifiedCheckinComposer } from "@/features/checkin/UnifiedCheckinComposer";
import { ConnectedFolderPanel } from "@/features/checkin/ConnectedFolderPanel";
import { runOcr } from "@/services/ocr/ocr";
import { validateFile } from "@/services/localStorage/documents";
import { useTranslation } from "@/locales/i18n";
import type { CheckinSource, DailyCheckin } from "@/models";

export const Route = createFileRoute("/app/checkin")({
  component: Checkin,
  head: () => ({
    meta: [
      { title: "Daily Check-in — HealthGuardian AI" },
      {
        name: "description",
        content:
          "Compact unified check-in workspace: natural typing, voice dictation, connected health folder discovery, and clinical verification.",
      },
      { property: "og:title", content: "Daily Health Check-in" },
      {
        property: "og:description",
        content: "Log sleep, hydration, activity and symptoms with verified accuracy.",
      },
    ],
  }),
});

type FormState = Record<string, string>;
const EMPTY: FormState = {
  sleepHours: "",
  waterGlasses: "",
  exerciseMinutes: "",
  exerciseType: "",
  foodQuality: "",
  weightKg: "",
  wellbeing: "",
  systolicBP: "",
  diastolicBP: "",
  bloodGlucose: "",
  bloodGlucoseUnit: "mg/dL",
  notes: "",
};

const WELLBEING_PILLS = [
  { value: "great", label: "Great", icon: "😊" },
  { value: "good", label: "Good", icon: "🙂" },
  { value: "okay", label: "Okay", icon: "😐" },
  { value: "tired", label: "Tired", icon: "😴" },
  { value: "not_great", label: "Not great", icon: "🙁" },
];

function Checkin() {
  const uid = useUid();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const online = useAppStore((s) => s.online);
  const { t, language } = useTranslation();

  // Primary capture view: "composer" | "detailed" | "review"
  const [mode, setMode] = useState<"composer" | "detailed" | "review">("composer");
  const [activeSource, setActiveSource] = useState<CheckinSource>("conversational");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<FormState>(EMPTY);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Extraction & safety warning state
  const [extracting, setExtracting] = useState(false);
  const [emergencyWarning, setEmergencyWarning] = useState<string | null>(null);
  const [ambiguityWarning, setAmbiguityWarning] = useState<string | null>(null);
  const [sourceDoc, setSourceDoc] = useState<{ name?: string; page?: number } | undefined>();
  const [fieldConfidenceMap, setFieldConfidenceMap] = useState<
    Record<string, "high" | "medium" | "low">
  >({});
  const [ambiguityReasonsList, setAmbiguityReasonsList] = useState<string[]>([]);
  const [rawInputUtterance, setRawInputUtterance] = useState<string>("");

  // Pre-fill when an entry already exists for the chosen date
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      const existing = await getCheckin(uid, checkinIdForDate(new Date(`${date}T00:00:00`)));
      if (cancelled || !existing) return;

      setForm({
        sleepHours: existing.sleepHours != null ? existing.sleepHours.toString() : "",
        waterGlasses: existing.waterGlasses != null ? existing.waterGlasses.toString() : "",
        exerciseMinutes:
          existing.exerciseMinutes != null ? existing.exerciseMinutes.toString() : "",
        exerciseType: existing.exerciseType ?? "",
        foodQuality: existing.foodQuality ?? "",
        weightKg: existing.weightKg != null ? existing.weightKg.toString() : "",
        wellbeing: existing.wellbeing ?? "",
        systolicBP: existing.systolicBP != null ? existing.systolicBP.toString() : "",
        diastolicBP: existing.diastolicBP != null ? existing.diastolicBP.toString() : "",
        bloodGlucose: existing.bloodGlucose != null ? existing.bloodGlucose.toString() : "",
        bloodGlucoseUnit: existing.bloodGlucoseUnit ?? "mg/dL",
        notes: existing.notes ?? "",
      });
      setSymptoms(existing.symptoms ?? []);
      setSelectedTags(existing.tags ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, date]);

  const setField = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const adjustNumeric = (key: string, step: number, min = 0, max = 100) => {
    setForm((f) => {
      const current = f[key] === "" ? min : Number(f[key]);
      const next = Math.min(max, Math.max(min, current + step));
      return { ...f, [key]: String(next) };
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleSymptom = (s: string) => {
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const getParsedData = (): Partial<DailyCheckin> => {
    const parsed = checkinSchema.safeParse({
      ...form,
      tags: selectedTags,
      source: activeSource,
      verificationStatus: "user_verified",
    });

    if (!parsed.success) return {};
    const d = parsed.data;

    return {
      sleepHours: d.sleepHours,
      waterGlasses: d.waterGlasses,
      exerciseMinutes: d.exerciseMinutes,
      exerciseType: form["exerciseType"] || undefined,
      foodQuality: form["foodQuality"] || undefined,
      weightKg: d.weightKg,
      wellbeing: form["wellbeing"] || undefined,
      systolicBP: d.systolicBP,
      diastolicBP: d.diastolicBP,
      bloodGlucose: d.bloodGlucose,
      bloodGlucoseUnit: d.bloodGlucose != null ? form["bloodGlucoseUnit"] : undefined,
      notes: form["notes"] || undefined,
      symptoms,
      tags: selectedTags,
      source: activeSource,
      verificationStatus: "user_verified",
    };
  };

  const validateAndGetParsedData = (): Partial<DailyCheckin> | null => {
    const parsed = checkinSchema.safeParse({
      ...form,
      tags: selectedTags,
      source: activeSource,
      verificationStatus: "user_verified",
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      toast.error("Please correct the highlighted values.");
      return null;
    }

    setErrors({});
    const d = parsed.data;

    if ((d.systolicBP == null) !== (d.diastolicBP == null)) {
      setErrors({ systolicBP: "Enter both blood pressure numbers, or leave both blank." });
      toast.error("Enter both blood pressure numbers, or leave both blank.");
      return null;
    }

    return {
      sleepHours: d.sleepHours,
      waterGlasses: d.waterGlasses,
      exerciseMinutes: d.exerciseMinutes,
      exerciseType: form["exerciseType"] || undefined,
      foodQuality: form["foodQuality"] || undefined,
      weightKg: d.weightKg,
      wellbeing: form["wellbeing"] || undefined,
      systolicBP: d.systolicBP,
      diastolicBP: d.diastolicBP,
      bloodGlucose: d.bloodGlucose,
      bloodGlucoseUnit: d.bloodGlucose != null ? form["bloodGlucoseUnit"] : undefined,
      notes: form["notes"] || undefined,
      symptoms,
      tags: selectedTags,
      source: activeSource,
      verificationStatus: "user_verified",
    };
  };

  // Conversational / Voice / OCR check-in extraction pipeline
  const executeExtraction = async (
    text: string,
    src: "conversational" | "voice" | "ocr" | "file_import",
    lang = "en",
    docFilename?: string,
    docPage?: number,
  ) => {
    const cleanText = text.trim();
    if (!cleanText) {
      toast.error("Please provide your check-in description first.");
      return;
    }

    setExtracting(true);
    setRawInputUtterance(cleanText);
    setEmergencyWarning(null);
    setAmbiguityWarning(null);
    setAmbiguityReasonsList([]);
    setSourceDoc(docFilename ? { name: docFilename, page: docPage } : undefined);

    try {
      const res = await extractCheckinFromText(cleanText, lang);

      if (res.emergency) {
        setEmergencyWarning(res.emergencyMessage || "Urgent medical attention recommended.");
        toast.error("Immediate medical attention recommended. Check emergency instructions.");
        return;
      }

      if (!res.ok || !res.data) {
        toast.error(
          res.error ||
            "I couldn't understand that check-in clearly. You can edit the text or use Detailed Check-in.",
        );
        return;
      }

      const extracted = res.data;

      // Populate form state with extracted values (missing remain empty string)
      setForm({
        ...EMPTY,
        sleepHours: extracted.sleepHours != null ? extracted.sleepHours.toString() : "",
        waterGlasses: extracted.waterGlasses != null ? extracted.waterGlasses.toString() : "",
        exerciseMinutes:
          extracted.exerciseMinutes != null ? extracted.exerciseMinutes.toString() : "",
        exerciseType: extracted.exerciseType ?? "",
        foodQuality: extracted.foodQuality ?? "",
        weightKg: extracted.weightKg != null ? extracted.weightKg.toString() : "",
        wellbeing: extracted.wellbeing ?? "",
        systolicBP: extracted.systolicBP != null ? extracted.systolicBP.toString() : "",
        diastolicBP: extracted.diastolicBP != null ? extracted.diastolicBP.toString() : "",
        bloodGlucose: extracted.bloodGlucose != null ? extracted.bloodGlucose.toString() : "",
        bloodGlucoseUnit: extracted.bloodGlucoseUnit ?? "mg/dL",
        notes: extracted.notes ?? cleanText,
      });

      if (extracted.tags && Array.isArray(extracted.tags)) {
        setSelectedTags(extracted.tags);
      }
      if (extracted.symptoms && Array.isArray(extracted.symptoms)) {
        setSymptoms(extracted.symptoms);
      }
      if (extracted.date) {
        setDate(extracted.date);
      }

      if (extracted.fieldConfidence) {
        setFieldConfidenceMap(
          extracted.fieldConfidence as Record<string, "high" | "medium" | "low">,
        );
      } else {
        setFieldConfidenceMap({});
      }

      if (extracted.isAmbiguous && extracted.ambiguityReason) {
        setAmbiguityWarning(extracted.ambiguityReason);
        setAmbiguityReasonsList([extracted.ambiguityReason]);
      }

      setActiveSource(src);
      setMode("review");
      toast.success("Check-in extracted. Please review and confirm your values.");
    } catch {
      toast.error("Extraction error. You can use Detailed Check-in instead.");
    } finally {
      setExtracting(false);
    }
  };

  // Device file upload with on-device OCR
  const handleDeviceFileSelect = async (file: File) => {
    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }

    setExtracting(true);
    toast.info(`Processing ${file.name} with on-device OCR...`);

    try {
      const outcome = await runOcr(file, file.type);
      const text = outcome.pages
        .map((p) => p.text)
        .join("\n")
        .trim();

      if (!text) {
        toast.warning("No readable text found in this file. Please enter values manually.");
        setMode("detailed");
        return;
      }

      await executeExtraction(text, "ocr", "en", file.name, 1);
    } catch (e) {
      console.error("OCR Error:", e);
      toast.error("Could not read file. You can enter values in Detailed Check-in.");
    } finally {
      setExtracting(false);
    }
  };

  // Confirm and save checkin to Firestore with full cross-screen reactive invalidation
  const handleConfirmSave = async (includedData?: Partial<DailyCheckin>) => {
    if (!uid || busy) return;
    const fallbackData = validateAndGetParsedData();
    const dataToSave = includedData || fallbackData;
    if (!dataToSave) return;

    setBusy(true);
    try {
      await saveCheckin(uid, new Date(`${date}T00:00:00`), {
        ...dataToSave,
        source: activeSource,
        verificationStatus: "user_verified",
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["checkins"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["risk"] }),
        qc.invalidateQueries({ queryKey: ["baselines"] }),
        qc.invalidateQueries({ queryKey: ["goals"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["guidance"] }),
      ]);
      toast.success(
        online
          ? "Today's check-in was saved."
          : "Saved locally — it will sync when you are back online.",
      );
      await navigate({ to: "/app/dashboard" });
    } catch {
      toast.error("Could not save your check-in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {!online && <OfflineNotice />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <PageHeader
          title={
            mode === "detailed"
              ? t("checkin.detailedTitle")
              : mode === "review"
                ? t("checkin.reviewTitle")
                : t("checkin.title")
          }
          description={
            mode === "detailed"
              ? t("checkin.detailedSubtitle")
              : mode === "review"
                ? t("checkin.reviewSubtitle")
                : t("checkin.subtitle")
          }
        />

        {mode !== "composer" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode("composer")}
            className="text-xs h-8"
          >
            {t("checkin.backToQuick")}
          </Button>
        )}
      </div>

      {/* Emergency Safety Banner */}
      {emergencyWarning && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border-2 border-destructive text-destructive animate-pulse">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">{t("emergency.warningTitle")}</h3>
            <p className="text-xs leading-relaxed font-medium">{emergencyWarning}</p>
            <p className="text-xs text-muted-foreground pt-1">{t("emergency.disclaimer")}</p>
          </div>
        </div>
      )}

      {/* Ambiguity Warning Banner */}
      {ambiguityWarning && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-0.5">
            <span className="font-semibold block">{t("review.verifyNotice")}</span>
            <p className="leading-relaxed">{ambiguityWarning}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. UNIFIED COMPACT COMPOSER WORKSPACE (PRIMARY MODE)                      */}
      {/* ========================================================================= */}
      {mode === "composer" && (
        <div className="space-y-5 pt-2">
          {/* Main Unified Input Bar */}
          <UnifiedCheckinComposer
            onTextSubmit={(text) => executeExtraction(text, "conversational", language)}
            onVoiceTranscriptReady={(transcript, lang) => {
              const cleanLang = lang.startsWith("ta") ? "ta" : lang.startsWith("hi") ? "hi" : "en";
              void executeExtraction(transcript, "voice", cleanLang);
            }}
            onFileSelect={handleDeviceFileSelect}
            onOpenDetailed={() => {
              setActiveSource("manual");
              setMode("detailed");
            }}
            extracting={extracting}
          />

          {/* Connected Folder Panel (underneath the composer) */}
          <ConnectedFolderPanel
            onCheckinExtracted={(text, src) => executeExtraction(text, src, language)}
            onNavigateToReports={() => navigate({ to: "/app/reports" })}
          />

          {/* Quick Context & Guide Tips */}
          <div className="grid gap-3 sm:grid-cols-3 pt-4 text-xs text-muted-foreground">
            <div className="p-3 rounded-xl border bg-card/40 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Mic className="size-3.5 text-primary" />{" "}
                {t("checkin.features.multilingualVoiceTitle")}
              </span>
              <p className="text-[11px] leading-relaxed">
                {t("checkin.features.multilingualVoiceDesc")}
              </p>
            </div>

            <div className="p-3 rounded-xl border bg-card/40 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />{" "}
                {t("checkin.features.naturalTypingTitle")}
              </span>
              <p className="text-[11px] leading-relaxed">
                {t("checkin.features.naturalTypingDesc")}
              </p>
            </div>

            <div className="p-3 rounded-xl border bg-card/40 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" />{" "}
                {t("checkin.features.folderOcrTitle")}
              </span>
              <p className="text-[11px] leading-relaxed">{t("checkin.features.folderOcrDesc")}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNIVERSAL CAPTURE REVIEW GATE (Phase 10A Verification Gate)             */}
      {/* ========================================================================= */}
      {mode === "review" && (
        <CaptureReview
          date={date}
          data={getParsedData()}
          source={activeSource}
          fieldConfidence={fieldConfidenceMap}
          isAmbiguous={Boolean(ambiguityWarning || ambiguityReasonsList.length > 0)}
          ambiguityReasons={
            ambiguityReasonsList.length > 0
              ? ambiguityReasonsList
              : ambiguityWarning
                ? [ambiguityWarning]
                : []
          }
          sourceDocument={sourceDoc?.name}
          sourcePage={sourceDoc?.page}
          inputUtterance={rawInputUtterance}
          onEdit={() => setMode("detailed")}
          onConfirm={handleConfirmSave}
          busy={busy}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. DETAILED CLINICAL CHECK-IN FORM                                        */}
      {/* ========================================================================= */}
      {mode === "detailed" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = validateAndGetParsedData();
            if (data) {
              setMode("review");
            }
          }}
          className="space-y-6"
        >
          {/* Date Picker */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-card/60">
            <div className="space-y-0.5">
              <Label htmlFor="checkin-date" className="text-xs font-semibold">
                Log Date
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Select the day this health entry applies to.
              </p>
            </div>
            <Input
              id="checkin-date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 text-xs"
            />
          </div>

          {/* Wellbeing / Mood Selector */}
          <section className="surface space-y-3 p-4 sm:p-6 rounded-2xl border">
            <h2 className="font-semibold text-sm text-foreground">{t("dashboard.wellbeing") || "How are you feeling today?"}</h2>
            <div className="flex flex-wrap gap-2">
              {WELLBEING_PILLS.map((pill) => {
                const active = form.wellbeing === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setField("wellbeing", active ? "" : pill.value)}
                    className={cn(
                      "touch-press flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                        : "hover:bg-muted text-muted-foreground bg-card",
                    )}
                  >
                    <span className="text-base">{pill.icon}</span>
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Daily Habits */}
          <section className="surface space-y-4 p-4 sm:p-6 rounded-2xl border">
            <h2 className="font-semibold text-sm text-foreground">Core Daily Habits</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sleepHours">Sleep (hours)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustNumeric("sleepHours", -0.5, 0, 24)}
                    className="touch-press size-10 rounded-xl"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="sleepHours"
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    placeholder="e.g. 7.5"
                    value={form.sleepHours}
                    onChange={(e) => setField("sleepHours", e.target.value)}
                    className="h-10 text-center text-sm font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustNumeric("sleepHours", 0.5, 0, 24)}
                    className="touch-press size-10 rounded-xl"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="waterGlasses">Water (glasses)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustNumeric("waterGlasses", -1, 0, 30)}
                    className="touch-press size-10 rounded-xl"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="waterGlasses"
                    type="number"
                    min="0"
                    max="30"
                    placeholder="e.g. 8"
                    value={form.waterGlasses}
                    onChange={(e) => setField("waterGlasses", e.target.value)}
                    className="h-10 text-center text-sm font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustNumeric("waterGlasses", 1, 0, 30)}
                    className="touch-press size-10 rounded-xl"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exerciseMinutes">Exercise (min)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustNumeric("exerciseMinutes", -5, 0, 360)}
                    className="touch-press size-10 rounded-xl"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="exerciseMinutes"
                    type="number"
                    min="0"
                    max="360"
                    placeholder="e.g. 30"
                    value={form.exerciseMinutes}
                    onChange={(e) => setField("exerciseMinutes", e.target.value)}
                    className="h-10 text-center text-sm font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustNumeric("exerciseMinutes", 5, 0, 360)}
                    className="touch-press size-10 rounded-xl"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Vitals & Biomarkers */}
          <section className="surface space-y-4 p-6 rounded-2xl border">
            <h2 className="font-semibold text-sm text-foreground">{t("dashboard.recentVitals")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="weightKg">{t("dashboard.weight")} (kg)</Label>
                <Input
                  id="weightKg"
                  type="number"
                  step="0.1"
                  min="20"
                  max="400"
                  placeholder="e.g. 70.5"
                  value={form.weightKg}
                  onChange={(e) => setField("weightKg", e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="systolicBP">{t("dashboard.bloodPressure")} (Systolic mmHg)</Label>
                <Input
                  id="systolicBP"
                  type="number"
                  min="60"
                  max="260"
                  placeholder="e.g. 120"
                  value={form.systolicBP}
                  onChange={(e) => setField("systolicBP", e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="diastolicBP">{t("dashboard.bloodPressure")} (Diastolic mmHg)</Label>
                <Input
                  id="diastolicBP"
                  type="number"
                  min="30"
                  max="200"
                  placeholder="e.g. 80"
                  value={form.diastolicBP}
                  onChange={(e) => setField("diastolicBP", e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="bloodGlucose">{t("dashboard.bloodGlucose")}</Label>
                <Input
                  id="bloodGlucose"
                  type="number"
                  step="0.1"
                  min="1"
                  max="900"
                  placeholder="e.g. 95"
                  value={form.bloodGlucose}
                  onChange={(e) => setField("bloodGlucose", e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bloodGlucoseUnit">Glucose unit</Label>
                <select
                  id="bloodGlucoseUnit"
                  value={form.bloodGlucoseUnit}
                  onChange={(e) => setField("bloodGlucoseUnit", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="mg/dL">mg/dL</option>
                  <option value="mmol/L">mmol/L</option>
                </select>
              </div>
            </div>
          </section>

          {/* Symptoms */}
          <section className="surface space-y-4 p-6 rounded-2xl border">
            <h2 className="font-semibold text-sm text-foreground">{t("checkin.symptoms")}</h2>
            <div className="flex flex-wrap gap-2">
              {COMMON_SYMPTOMS.map((s) => {
                const active = symptoms.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    className={cn(
                      "touch-press flex min-h-[36px] items-center rounded-full border px-3.5 py-1.5 text-xs capitalize transition-colors cursor-pointer",
                      active
                        ? "border-destructive bg-destructive/10 text-destructive font-medium shadow-xs"
                        : "hover:bg-muted text-muted-foreground bg-card",
                    )}
                  >
                    {formatSymptom(s, t)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          <section className="surface space-y-4 p-4 sm:p-6 rounded-2xl border">
            <h2 className="font-semibold text-sm text-foreground">{t("checkin.notes")}</h2>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Any additional context about your day…"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className="text-xs resize-none"
            />
          </section>

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("composer")}
              className="touch-press text-xs h-10 w-full sm:w-auto"
            >
              Cancel
            </Button>

            <Button type="submit" className="touch-press gap-2 font-semibold shadow-xs text-sm min-h-[48px] px-6 w-full sm:w-auto">
              <ShieldCheck className="size-4" /> Review & Confirm →
            </Button>
          </div>
        </form>
      )}

      <Disclaimer />
    </div>
  );
}
