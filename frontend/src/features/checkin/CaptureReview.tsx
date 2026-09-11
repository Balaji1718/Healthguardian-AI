import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Edit3,
  Loader2,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  FileText,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatSymptom } from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";
import type { CheckinSource, DailyCheckin } from "@/models";
import type { HealthInterpretationResult } from "@/services/ai/interpretation";

export interface CaptureReviewProps {
  date: string;
  data: Partial<DailyCheckin>;
  source: CheckinSource;
  fieldConfidence?: Record<string, "high" | "medium" | "low">;
  isAmbiguous?: boolean;
  ambiguityReasons?: string[];
  sourceDocument?: string;
  sourcePage?: number;
  inputUtterance?: string;
  interpretation?: HealthInterpretationResult | null;
  analysis?: {
    enhancedSummary?: string | null;
    conditionInsights?: string[];
    riskPatterns?: string[];
    historySuggestions?: string[];
  } | null;
  onEdit?: () => void;
  onConfirm: (includedData?: Partial<DailyCheckin>) => Promise<void>;
  onUpdateField?: (field: string, value: string) => void;
  busy: boolean;
}

const WELLBEING_LABELS: Record<string, { label: string; icon: string }> = {
  great: { label: "Great", icon: "😊" },
  good: { label: "Good", icon: "🙂" },
  okay: { label: "Okay", icon: "😐" },
  tired: { label: "Tired", icon: "😴" },
  not_great: { label: "Not great", icon: "🙁" },
};

export function CaptureReview({
  date,
  data,
  source,
  fieldConfidence = {},
  isAmbiguous = false,
  ambiguityReasons = [],
  sourceDocument,
  sourcePage,
  inputUtterance,
  interpretation,
  analysis,
  onEdit,
  onConfirm,
  onUpdateField,
  busy,
}: CaptureReviewProps) {
  const { t } = useTranslation();
  const [showAdditionalMetrics, setShowAdditionalMetrics] = useState(false);

  // Local review state holding current confirmed/edited values
  const [editedValues, setEditedValues] = useState<Partial<DailyCheckin>>(() => ({ ...data }));
  // Track which field is currently being edited in-place: null | fieldId
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [draftSecondary, setDraftSecondary] = useState<string>("");

  // Synchronize when parent data updates
  useEffect(() => {
    setEditedValues((prev) => ({ ...data, ...prev }));
  }, [data]);

  // Track which fields the user has explicitly selected/included for save
  const [includedFields, setIncludedFields] = useState<Record<string, boolean>>({
    date: true,
    wellbeing: Boolean(data.wellbeing),
    sleepHours: data.sleepHours != null,
    waterGlasses: data.waterGlasses != null,
    exerciseMinutes: data.exerciseMinutes != null,
    weightKg: data.weightKg != null,
    bloodPressure: data.systolicBP != null && data.diastolicBP != null,
    bloodGlucose: data.bloodGlucose != null,
    symptoms: Boolean(data.symptoms && data.symptoms.length > 0),
    tags: Boolean(data.tags && data.tags.length > 0),
    notes: Boolean(data.notes),
    observations: Boolean(data.observations && data.observations.length > 0),
  });

  const toggleField = (fieldKey: string) => {
    setIncludedFields((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  const startEditField = (fieldId: string) => {
    let initialVal = "";
    let secondaryVal = "";

    switch (fieldId) {
      case "sleepHours":
        initialVal = editedValues.sleepHours != null ? String(editedValues.sleepHours) : "";
        break;
      case "waterGlasses":
        initialVal = editedValues.waterGlasses != null ? String(editedValues.waterGlasses) : "";
        break;
      case "exerciseMinutes":
        initialVal = editedValues.exerciseMinutes != null ? String(editedValues.exerciseMinutes) : "";
        secondaryVal = editedValues.exerciseType || "";
        break;
      case "weightKg":
        initialVal = editedValues.weightKg != null ? String(editedValues.weightKg) : "";
        break;
      case "bloodPressure":
        initialVal = editedValues.systolicBP != null ? String(editedValues.systolicBP) : "";
        secondaryVal = editedValues.diastolicBP != null ? String(editedValues.diastolicBP) : "";
        break;
      case "bloodGlucose":
        initialVal = editedValues.bloodGlucose != null ? String(editedValues.bloodGlucose) : "";
        secondaryVal = editedValues.bloodGlucoseUnit || "mg/dL";
        break;
      case "wellbeing":
        initialVal = editedValues.wellbeing || "good";
        break;
      case "notes":
        initialVal = editedValues.notes || "";
        break;
      default:
        initialVal = "";
    }

    setDraftValue(initialVal);
    setDraftSecondary(secondaryVal);
    setEditingFieldId(fieldId);
  };

  const cancelEdit = () => {
    setEditingFieldId(null);
    setDraftValue("");
    setDraftSecondary("");
  };

  const saveEditField = (fieldId: string) => {
    const updated = { ...editedValues };

    switch (fieldId) {
      case "sleepHours": {
        const val = draftValue.trim();
        const num = val ? parseFloat(val) : null;
        updated.sleepHours = num != null && !isNaN(num) ? num : null;
        onUpdateField?.("sleepHours", updated.sleepHours != null ? String(updated.sleepHours) : "");
        break;
      }
      case "waterGlasses": {
        const val = draftValue.trim();
        const num = val ? parseInt(val, 10) : null;
        updated.waterGlasses = num != null && !isNaN(num) ? num : null;
        onUpdateField?.("waterGlasses", updated.waterGlasses != null ? String(updated.waterGlasses) : "");
        break;
      }
      case "exerciseMinutes": {
        const val = draftValue.trim();
        const num = val ? parseInt(val, 10) : null;
        updated.exerciseMinutes = num != null && !isNaN(num) ? num : null;
        updated.exerciseType = draftSecondary.trim() || undefined;
        onUpdateField?.("exerciseMinutes", updated.exerciseMinutes != null ? String(updated.exerciseMinutes) : "");
        onUpdateField?.("exerciseType", updated.exerciseType || "");
        break;
      }
      case "weightKg": {
        const val = draftValue.trim();
        const num = val ? parseFloat(val) : null;
        updated.weightKg = num != null && !isNaN(num) ? num : null;
        onUpdateField?.("weightKg", updated.weightKg != null ? String(updated.weightKg) : "");
        break;
      }
      case "bloodPressure": {
        const sys = draftValue.trim() ? parseInt(draftValue.trim(), 10) : null;
        const dia = draftSecondary.trim() ? parseInt(draftSecondary.trim(), 10) : null;
        updated.systolicBP = sys != null && !isNaN(sys) ? sys : null;
        updated.diastolicBP = dia != null && !isNaN(dia) ? dia : null;
        onUpdateField?.("systolicBP", updated.systolicBP != null ? String(updated.systolicBP) : "");
        onUpdateField?.("diastolicBP", updated.diastolicBP != null ? String(updated.diastolicBP) : "");
        break;
      }
      case "bloodGlucose": {
        const val = draftValue.trim();
        const num = val ? parseFloat(val) : null;
        updated.bloodGlucose = num != null && !isNaN(num) ? num : null;
        updated.bloodGlucoseUnit = draftSecondary.trim() || "mg/dL";
        onUpdateField?.("bloodGlucose", updated.bloodGlucose != null ? String(updated.bloodGlucose) : "");
        onUpdateField?.("bloodGlucoseUnit", updated.bloodGlucoseUnit);
        break;
      }
      case "wellbeing": {
        updated.wellbeing = draftValue.trim() || undefined;
        onUpdateField?.("wellbeing", updated.wellbeing || "");
        break;
      }
      case "notes": {
        updated.notes = draftValue.trim() || undefined;
        onUpdateField?.("notes", updated.notes || "");
        break;
      }
    }

    setEditedValues(updated);
    setIncludedFields((prev) => ({ ...prev, [fieldId]: true }));
    setEditingFieldId(null);
  };

  const wellbeingObj = editedValues.wellbeing ? WELLBEING_LABELS[editedValues.wellbeing] : undefined;

  // Build field review items using local edited values
  const items = useMemo(
    () => [
      {
        id: "date",
        label: t("history.tableDate"),
        value: date,
        hasValue: true,
        canExclude: false,
        confidence: fieldConfidence.date || "high",
      },
      {
        id: "wellbeing",
        label: t("checkin.howYouFeel"),
        value: wellbeingObj
          ? `${wellbeingObj.icon} ${t(`wellbeing.${editedValues.wellbeing}`) || wellbeingObj.label}`
          : editedValues.wellbeing
            ? t(`wellbeing.${editedValues.wellbeing}`) || editedValues.wellbeing
            : t("dashboard.notLogged"),
        hasValue: Boolean(editedValues.wellbeing),
        canExclude: true,
        confidence: fieldConfidence.wellbeing || "high",
      },
      {
        id: "sleepHours",
        label: t("dashboard.sleep"),
        value:
          editedValues.sleepHours != null
            ? `${editedValues.sleepHours} ${t("units.hours")}`
            : t("dashboard.notLogged"),
        hasValue: editedValues.sleepHours != null,
        canExclude: true,
        confidence: fieldConfidence.sleepHours || "high",
      },
      {
        id: "waterGlasses",
        label: t("dashboard.water"),
        value:
          editedValues.waterGlasses != null
            ? `${editedValues.waterGlasses} ${t("units.glasses")}`
            : t("dashboard.notLogged"),
        hasValue: editedValues.waterGlasses != null,
        canExclude: true,
        confidence: fieldConfidence.waterGlasses || "high",
      },
      {
        id: "exerciseMinutes",
        label: t("dashboard.exercise"),
        value:
          editedValues.exerciseMinutes != null
            ? `${editedValues.exerciseMinutes} ${t("units.mins")} ${editedValues.exerciseType ? `(${editedValues.exerciseType})` : ""}`
            : t("dashboard.notLogged"),
        hasValue: editedValues.exerciseMinutes != null,
        canExclude: true,
        confidence: fieldConfidence.exerciseMinutes || "high",
      },
      {
        id: "weightKg",
        label: t("dashboard.weight"),
        value:
          editedValues.weightKg != null ? `${editedValues.weightKg} ${t("units.kg")}` : t("dashboard.notLogged"),
        hasValue: editedValues.weightKg != null,
        canExclude: true,
        confidence: fieldConfidence.weightKg || "high",
      },
      {
        id: "bloodPressure",
        label: t("dashboard.bloodPressure"),
        value:
          editedValues.systolicBP != null && editedValues.diastolicBP != null
            ? `${editedValues.systolicBP}/${editedValues.diastolicBP} ${t("units.mmHg")}`
            : t("dashboard.notLogged"),
        hasValue: editedValues.systolicBP != null && editedValues.diastolicBP != null,
        canExclude: true,
        confidence: fieldConfidence.systolicBP || "high",
      },
      {
        id: "bloodGlucose",
        label: t("dashboard.bloodGlucose"),
        value:
          editedValues.bloodGlucose != null
            ? `${editedValues.bloodGlucose} ${editedValues.bloodGlucoseUnit || "mg/dL"}`
            : t("dashboard.notLogged"),
        hasValue: editedValues.bloodGlucose != null,
        canExclude: true,
        confidence: fieldConfidence.bloodGlucose || "high",
      },
    ],
    [date, editedValues, wellbeingObj, fieldConfidence, t],
  );

  const loggedItems = useMemo(() => items.filter((i) => i.hasValue), [items]);
  const unloggedItems = useMemo(() => items.filter((i) => !i.hasValue), [items]);

  // Compute final payload with only user-included fields
  const handleConfirmAction = async () => {
    const finalPayload: Partial<DailyCheckin> = {
      date,
      wellbeing: includedFields.wellbeing ? (editedValues.wellbeing ?? null) : null,
      sleepHours: includedFields.sleepHours ? (editedValues.sleepHours ?? null) : null,
      waterGlasses: includedFields.waterGlasses ? (editedValues.waterGlasses ?? null) : null,
      exerciseMinutes: includedFields.exerciseMinutes ? (editedValues.exerciseMinutes ?? null) : null,
      exerciseType: includedFields.exerciseMinutes ? (editedValues.exerciseType ?? null) : null,
      foodQuality: editedValues.foodQuality ?? null,
      weightKg: includedFields.weightKg ? (editedValues.weightKg ?? null) : null,
      systolicBP: includedFields.bloodPressure ? (editedValues.systolicBP ?? null) : null,
      diastolicBP: includedFields.bloodPressure ? (editedValues.diastolicBP ?? null) : null,
      bloodGlucose: includedFields.bloodGlucose ? (editedValues.bloodGlucose ?? null) : null,
      bloodGlucoseUnit: editedValues.bloodGlucoseUnit ?? "mg/dL",
      symptoms: includedFields.symptoms ? (editedValues.symptoms ?? []) : [],
      tags: includedFields.tags ? (editedValues.tags ?? []) : [],
      notes: includedFields.notes ? (editedValues.notes ?? null) : null,
      observations: includedFields.observations ? (editedValues.observations ?? []) : [],
    };

    await onConfirm(finalPayload);
  };

  const getConfidenceBadge = (level?: "high" | "medium" | "low") => {
    if (level === "low") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
        >
          {t("review.lowConfidence")}
        </Badge>
      );
    }
    if (level === "medium") {
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 text-blue-500 border-blue-500/30 bg-blue-500/10"
        >
          {t("review.medConfidence")}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 text-success border-success/30 bg-success/10"
      >
        {t("review.highConfidence")}
      </Badge>
    );
  };

  const renderFieldItem = (item: (typeof items)[0]) => {
    const isIncluded = includedFields[item.id] ?? true;
    const isHighlighted = item.hasValue && isIncluded;
    const isEditing = editingFieldId === item.id;

    if (isEditing) {
      return (
        <div
          key={item.id}
          className="p-3 rounded-xl border border-primary/50 bg-card shadow-sm space-y-2 col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-primary">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">Editing value</span>
          </div>

          {item.id === "wellbeing" ? (
            <div className="flex flex-wrap gap-1">
              {Object.entries(WELLBEING_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDraftValue(k)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                    draftValue === k
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          ) : item.id === "exerciseMinutes" ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="600"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  placeholder="Minutes"
                  className="h-8 text-xs"
                  autoFocus
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">mins</span>
              </div>
              <Input
                type="text"
                value={draftSecondary}
                onChange={(e) => setDraftSecondary(e.target.value)}
                placeholder="Activity type (e.g. Walking, Gym)"
                className="h-8 text-xs"
              />
            </div>
          ) : item.id === "bloodPressure" ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="50"
                max="250"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                placeholder="Systolic (120)"
                className="h-8 text-xs"
                autoFocus
              />
              <span className="text-xs text-muted-foreground">/</span>
              <Input
                type="number"
                min="30"
                max="150"
                value={draftSecondary}
                onChange={(e) => setDraftSecondary(e.target.value)}
                placeholder="Diastolic (80)"
                className="h-8 text-xs"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step={item.id === "sleepHours" || item.id === "weightKg" ? "0.1" : "1"}
                min="0"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                placeholder="Enter value"
                className="h-8 text-xs"
                autoFocus
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {item.id === "sleepHours"
                  ? "hours"
                  : item.id === "waterGlasses"
                    ? "glasses"
                    : item.id === "weightKg"
                      ? "kg"
                      : item.id === "bloodGlucose"
                        ? "mg/dL"
                        : ""}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
            <button
              type="button"
              onClick={cancelEdit}
              className="touch-press px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="size-3" /> Cancel
            </button>
            <button
              type="button"
              onClick={() => saveEditField(item.id)}
              className="touch-press px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 shadow-2xs"
            >
              <Check className="size-3" /> Save
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`p-3 rounded-xl border text-xs transition-all relative group ${
          isHighlighted
            ? "bg-card border-border shadow-2xs"
            : isIncluded
              ? "bg-muted/30 border-border/40 text-muted-foreground"
              : "bg-muted/10 border-border/20 opacity-50 line-through"
        }`}
      >
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[11px] text-muted-foreground font-medium">{item.label}</span>
          <div className="flex items-center gap-1">
            {item.hasValue && isIncluded && getConfidenceBadge(item.confidence)}
            
            {/* In-place edit button */}
            {item.canExclude && (
              <button
                type="button"
                onClick={() => startEditField(item.id)}
                className="touch-press size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/80 transition-colors ml-0.5"
                title="Edit this value in place"
                aria-label={`Edit ${item.label}`}
              >
                <Edit3 className="size-3.5" />
              </button>
            )}

            {/* Include/Exclude Toggle */}
            {item.canExclude && item.hasValue && (
              <button
                type="button"
                onClick={() => toggleField(item.id)}
                className="touch-press size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors ml-0.5"
                title={isIncluded ? t("review.excludeField") : t("review.includeField")}
                aria-label={`${isIncluded ? "Exclude" : "Include"} ${item.label}`}
              >
                {isIncluded ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <X className="size-4" />
                )}
              </button>
            )}
          </div>
        </div>

        <span
          className={`font-semibold block ${
            isHighlighted ? "text-foreground" : "text-muted-foreground/80 italic no-underline"
          }`}
        >
          {item.value}
        </span>
      </div>
    );
  };

  return (
    <div className="surface p-5 sm:p-6 space-y-5 max-w-xl mx-auto rounded-2xl shadow-xs border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              {t("review.gateTitle")}
            </h2>
            <Badge
              variant="outline"
              className="gap-1 text-[10px] text-primary border-primary/30 bg-primary/5"
            >
              <ShieldCheck className="size-3" /> {t("review.gateBadge")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("review.gateNotice")}</p>
        </div>
      </div>

      {/* Raw Spoken/Typed Input vs Extracted Understanding */}
      {inputUtterance && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-primary text-[11px]">
            <Sparkles className="size-3.5" />
            <span>{t("review.spokenInputLabel") || "What you spoke / typed:"}</span>
          </div>
          <p className="text-foreground text-xs leading-relaxed italic pl-5">"{inputUtterance}"</p>
        </div>
      )}

      {/* Ambiguity Notices (if any) */}
      {isAmbiguous && ambiguityReasons.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-0.5">
            <span className="font-semibold block">{t("review.verifyNotice")}</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {ambiguityReasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 1. Understood Health Priorities (Major Points) */}
      {interpretation?.majorPoints && interpretation.majorPoints.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 text-xs space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-primary text-xs">
              <Sparkles className="size-4 text-primary" />
              <span>Understood Health Priorities</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">
              Major Points
            </Badge>
          </div>

          <div className="space-y-1.5 pt-0.5">
            {interpretation.majorPoints.map((point, idx) => (
              <div key={idx} className="flex items-start gap-2 text-foreground font-medium text-xs leading-relaxed">
                <span className="text-primary mt-0.5 font-bold">•</span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          {interpretation.secondaryDetails && interpretation.secondaryDetails.length > 0 && (
            <div className="pt-2 border-t border-primary/15 text-muted-foreground text-[11px] space-y-0.5">
              <span className="font-semibold text-foreground/80 block">Secondary Context:</span>
              {interpretation.secondaryDetails.map((sec, idx) => (
                <p key={idx} className="italic pl-2">{sec}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Contextual Missing Info & Continuity Prompts */}
      {interpretation?.missingInformation && interpretation.missingInformation.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
            <HelpCircle className="size-3.5" />
            <span>Suggested Continuity Context</span>
          </div>
          {interpretation.missingInformation.map((missing, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
              <p className="leading-relaxed">{missing.prompt}</p>
            </div>
          ))}
        </div>
      )}

      {/* 3. Explicit Stated Health Metrics (Adaptive Display) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider text-[11px]">
            Explicit Stated Metrics
          </span>
          <span className="text-[10px] text-muted-foreground">
            {loggedItems.length} active
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {loggedItems.map((item) => renderFieldItem(item))}
        </div>

        {/* Expandable Additional Metrics (Avoids rigid wall of "Not logged" boxes) */}
        {unloggedItems.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdditionalMetrics((prev) => !prev)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors py-1"
            >
              {showAdditionalMetrics ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              <span>
                {showAdditionalMetrics
                  ? "Hide unlogged metrics"
                  : `+ Add other metrics (${unloggedItems.length} available)`}
              </span>
            </button>

            {showAdditionalMetrics && (
              <div className="grid gap-2.5 sm:grid-cols-2 pt-2 animate-in fade-in duration-150">
                {unloggedItems.map((item) => renderFieldItem(item))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Chips (if any) */}
      {data.tags && data.tags.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Context tags:</span>
            <button
              type="button"
              onClick={() => toggleField("tags")}
              className="text-[11px] text-primary hover:underline"
            >
              {includedFields.tags ? "Exclude" : "Include"}
            </button>
          </div>
          {includedFields.tags && (
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-medium px-2 py-0.5">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Symptoms (if any) */}
      {data.symptoms && data.symptoms.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("review.loggedSymptoms") || "Logged symptoms:"}
            </span>
            <button
              type="button"
              onClick={() => toggleField("symptoms")}
              className="text-[11px] text-primary hover:underline"
            >
              {includedFields.symptoms
                ? t("review.exclude") || "Exclude"
                : t("review.include") || "Include"}
            </button>
          </div>
          {includedFields.symptoms && (
            <div className="flex flex-wrap gap-1.5">
              {data.symptoms.map((sym, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs capitalize text-destructive border-destructive/30 bg-destructive/5 px-2 py-0.5"
                >
                  {formatSymptom(sym, t)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {data.observations && data.observations.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Additional details understood:</span>
            <button
              type="button"
              onClick={() => toggleField("observations")}
              className="text-[11px] text-primary hover:underline"
            >
              {includedFields.observations ? "Exclude" : "Include"}
            </button>
          </div>
          {includedFields.observations && (
            <ul className="space-y-1 text-muted-foreground">
              {data.observations.map((observation, index) => (
                <li key={`${observation.label}-${index}`}>
                  <span className="font-medium text-foreground">{observation.label}</span>
                  {observation.valueText ? `: ${observation.valueText}` : ""}
                  {observation.temporalContext ? ` (${observation.temporalContext})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Notes (if any or when editing notes) */}
      {(editedValues.notes || editingFieldId === "notes") && (
        <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground block">{t("checkin.notes")}:</span>
            <div className="flex items-center gap-1">
              {editingFieldId !== "notes" && (
                <button
                  type="button"
                  onClick={() => startEditField("notes")}
                  className="touch-press size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/80 transition-colors"
                  title="Edit notes"
                  aria-label="Edit notes"
                >
                  <Edit3 className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleField("notes")}
                className="text-[11px] text-primary hover:underline ml-1"
              >
                {includedFields.notes
                  ? t("review.excludeField") || "Exclude"
                  : t("review.includeField") || "Include"}
              </button>
            </div>
          </div>
          {editingFieldId === "notes" ? (
            <div className="space-y-2 pt-1">
              <textarea
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                placeholder="Add or update notes..."
                rows={3}
                className="w-full rounded-lg border border-primary/40 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="touch-press px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="size-3" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveEditField("notes")}
                  className="touch-press px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 shadow-2xs"
                >
                  <Check className="size-3" /> Save
                </button>
              </div>
            </div>
          ) : (
            includedFields.notes && (
              <p className="text-muted-foreground leading-relaxed italic">{editedValues.notes}</p>
            )
          )}
        </div>
      )}

      {/* 4. Contextual Health Analysis & Inferences (Separated Provenance) */}
      {((interpretation?.inferredContext && interpretation.inferredContext.length > 0) || (analysis?.conditionInsights && analysis.conditionInsights.length > 0)) && (
        <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs animate-in fade-in">
          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
            <div className="flex items-center gap-1.5 text-primary font-semibold">
              <Sparkles className="size-4" />
              <span>AI Health Analysis & Contextual Inferences</span>
            </div>
            <Badge variant="outline" className="text-[9px] text-muted-foreground border-muted-foreground/30">
              Unconfirmed Inferences
            </Badge>
          </div>

          {/* Inferred Contexts */}
          {interpretation?.inferredContext && interpretation.inferredContext.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Contextual Observations
              </span>
              <div className="space-y-1">
                {interpretation.inferredContext.map((inf, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-card/60 border border-border/40 text-[11px] space-y-0.5">
                    <span className="font-medium text-foreground block">{inf.topic}</span>
                    <p className="text-muted-foreground leading-relaxed">{inf.inference}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis?.conditionInsights && analysis.conditionInsights.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                Condition & Recovery
              </span>
              <ul className="space-y-1 pl-3.5 list-disc text-muted-foreground text-[11px]">
                {analysis.conditionInsights.map((insight, idx) => (
                  <li key={idx} className="leading-relaxed">{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis?.riskPatterns && analysis.riskPatterns.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-primary/10">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider block">
                Risk Pattern Observations
              </span>
              <ul className="space-y-1 pl-3.5 list-disc text-muted-foreground text-[11px]">
                {analysis.riskPatterns.map((pattern, idx) => (
                  <li key={idx} className="leading-relaxed">{pattern}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis?.historySuggestions && analysis.historySuggestions.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-primary/10">
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                Health Continuity Suggestions
              </span>
              <ul className="space-y-1 pl-3.5 list-disc text-muted-foreground text-[11px]">
                {analysis.historySuggestions.map((sug, idx) => (
                  <li key={idx} className="leading-relaxed">{sug}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Provenance & Source Document Attribution Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {sourceDocument ? (
            <FileText className="size-3.5 text-primary" />
          ) : (
            <Sparkles className="size-3.5 text-primary" />
          )}
          <span>
            {t("review.sourceLabel")}:{" "}
            <strong className="text-primary capitalize">{source.replace(/_/g, " ")}</strong>
            {sourceDocument && (
              <span className="ml-1 text-foreground font-mono text-[11px]">
                ({sourceDocument}
                {sourcePage ? ` · Page ${sourcePage}` : ""})
              </span>
            )}
          </span>
        </div>
        <span className="flex items-center gap-1 font-medium text-success text-[11px]">
          <CheckCircle2 className="size-3" /> {t("review.readyToVerify")}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const target = loggedItems[0]?.id || "sleepHours";
            startEditField(target);
          }}
          disabled={busy}
          className="touch-press text-xs h-10 gap-1.5 text-muted-foreground hover:text-foreground w-full sm:w-auto"
        >
          <Edit3 className="size-4" /> {t("review.editValues")}
        </Button>

        <Button
          type="button"
          onClick={() => void handleConfirmAction()}
          disabled={busy}
          className="touch-press text-sm min-h-[48px] sm:min-h-[40px] px-6 gap-2 font-semibold shadow-xs bg-primary text-primary-foreground w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("common.saving")}
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" /> {t("review.confirmAndSave")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
