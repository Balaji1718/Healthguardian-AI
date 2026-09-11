import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, Mic, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, OfflineNotice } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { checkinSchema } from "@/core/validation/schemas";
import { checkinIdForDate, getCheckin, saveCheckin } from "@/services/firebase/repositories";
import { useUid } from "@/features/auth/useAuth";
import { useAppStore } from "@/store/app";
import { CaptureReview } from "@/features/checkin/CaptureReview";
import {
  extractCheckinFromText,
  type CheckinExtractionResult,
} from "@/services/ai/conversational-checkin";
import type { HealthInterpretationResult } from "@/services/ai/interpretation";
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

function Checkin() {
  const uid = useUid();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const online = useAppStore((s) => s.online);
  const { t, language } = useTranslation();

  // Pure AI-driven check-in workspace: "composer" | "review"
  const [mode, setMode] = useState<"composer" | "review">("composer");
  const [activeSource, setActiveSource] = useState<CheckinSource>("conversational");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<FormState>(EMPTY);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [observations, setObservations] = useState<DailyCheckin["observations"]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
  const [analysisResult, setAnalysisResult] = useState<
    CheckinExtractionResult["analysis"] | undefined
  >();
  const [interpretationResult, setInterpretationResult] = useState<
    HealthInterpretationResult | undefined
  >();

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
      setObservations(existing.observations ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, date]);

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
      observations,
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
    setAnalysisResult(undefined);
    setInterpretationResult(undefined);
    setSourceDoc(
      docFilename
        ? docPage != null
          ? { name: docFilename, page: docPage }
          : { name: docFilename }
        : undefined,
    );

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
            "I couldn't understand that check-in clearly. Please try speaking or typing with more details.",
        );
        return;
      }

      if (res.interpretation) {
        setInterpretationResult(res.interpretation);
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
      setObservations(
        (extracted.observations ?? []).map((o) => ({
          ...o,
          valueText: o.valueText || undefined,
          severity: o.severity || undefined,
          unit: o.unit || undefined,
          numericValue: o.numericValue ?? undefined,
          temporalContext: o.temporalContext || undefined,
        })),
      );

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

      if (extracted.analysis) {
        setAnalysisResult(extracted.analysis);
      }

      setActiveSource(src);
      setMode("review");
      toast.success("Check-in extracted. Please review and confirm your values.");
    } catch {
      toast.error("Extraction error. Please try speaking or typing again.");
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
        setMode("composer");
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

  // Update a single check-in form field in place without restarting session
  const handleUpdateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Confirm and save checkin to Firestore with full cross-screen reactive invalidation
  const handleConfirmSave = async (includedData?: Partial<DailyCheckin>) => {
    if (!uid || busy) return;
    setBusy(true);

    try {
      const fallbackData = getParsedData();
      const dataToSave = includedData || fallbackData;
      if (!dataToSave || Object.keys(dataToSave).length === 0) {
        toast.error("No valid check-in data to save. Please review your entries.");
        return;
      }

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
    } catch (err) {
      console.error("Failed to save check-in:", err);
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
          title={mode === "review" ? t("checkin.reviewTitle") : t("checkin.title")}
          description={mode === "review" ? t("checkin.reviewSubtitle") : t("checkin.subtitle")}
        />

        {mode !== "composer" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode("composer")}
            className="text-xs h-8 touch-press"
          >
            ← {t("checkin.backToQuick")}
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
            onEnhanceSubmit={(text) => executeExtraction(text, "conversational", language)}
            onVoiceTranscriptReady={(transcript, lang) => {
              const cleanLang = lang.startsWith("ta") ? "ta" : lang.startsWith("hi") ? "hi" : "en";
              void executeExtraction(transcript, "voice", cleanLang);
            }}
            onFileSelect={handleDeviceFileSelect}
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
          analysis={analysisResult}
          interpretation={interpretationResult}
          onUpdateField={handleUpdateField}
          onConfirm={handleConfirmSave}
          busy={busy}
        />
      )}

      <Disclaimer />
    </div>
  );
}
