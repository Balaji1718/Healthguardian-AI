import { useState, useMemo } from "react";
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
  onEdit: () => void;
  onConfirm: (includedData?: Partial<DailyCheckin>) => Promise<void>;
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
  busy,
}: CaptureReviewProps) {
  const { t } = useTranslation();
  const [showAdditionalMetrics, setShowAdditionalMetrics] = useState(false);
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

  const wellbeingObj = data.wellbeing ? WELLBEING_LABELS[data.wellbeing] : undefined;

  // Build field review items
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
          ? `${wellbeingObj.icon} ${t(`wellbeing.${data.wellbeing}`) || wellbeingObj.label}`
          : data.wellbeing
            ? t(`wellbeing.${data.wellbeing}`) || data.wellbeing
            : t("dashboard.notLogged"),
        hasValue: Boolean(data.wellbeing),
        canExclude: true,
        confidence: fieldConfidence.wellbeing || "high",
      },
      {
        id: "sleepHours",
        label: t("dashboard.sleep"),
        value:
          data.sleepHours != null
            ? `${data.sleepHours} ${t("units.hours")}`
            : t("dashboard.notLogged"),
        hasValue: data.sleepHours != null,
        canExclude: true,
        confidence: fieldConfidence.sleepHours || "high",
      },
      {
        id: "waterGlasses",
        label: t("dashboard.water"),
        value:
          data.waterGlasses != null
            ? `${data.waterGlasses} ${t("units.glasses")}`
            : t("dashboard.notLogged"),
        hasValue: data.waterGlasses != null,
        canExclude: true,
        confidence: fieldConfidence.waterGlasses || "high",
      },
      {
        id: "exerciseMinutes",
        label: t("dashboard.exercise"),
        value:
          data.exerciseMinutes != null
            ? `${data.exerciseMinutes} ${t("units.mins")} ${data.exerciseType ? `(${data.exerciseType})` : ""}`
            : t("dashboard.notLogged"),
        hasValue: data.exerciseMinutes != null,
        canExclude: true,
        confidence: fieldConfidence.exerciseMinutes || "high",
      },
      {
        id: "weightKg",
        label: t("dashboard.weight"),
        value:
          data.weightKg != null ? `${data.weightKg} ${t("units.kg")}` : t("dashboard.notLogged"),
        hasValue: data.weightKg != null,
        canExclude: true,
        confidence: fieldConfidence.weightKg || "high",
      },
      {
        id: "bloodPressure",
        label: t("dashboard.bloodPressure"),
        value:
          data.systolicBP != null && data.diastolicBP != null
            ? `${data.systolicBP}/${data.diastolicBP} ${t("units.mmHg")}`
            : t("dashboard.notLogged"),
        hasValue: data.systolicBP != null && data.diastolicBP != null,
        canExclude: true,
        confidence: fieldConfidence.systolicBP || "high",
      },
      {
        id: "bloodGlucose",
        label: t("dashboard.bloodGlucose"),
        value:
          data.bloodGlucose != null
            ? `${data.bloodGlucose} ${data.bloodGlucoseUnit || "mg/dL"}`
            : t("dashboard.notLogged"),
        hasValue: data.bloodGlucose != null,
        canExclude: true,
        confidence: fieldConfidence.bloodGlucose || "high",
      },
    ],
    [date, data, wellbeingObj, fieldConfidence, t],
  );

  const loggedItems = useMemo(() => items.filter((i) => i.hasValue), [items]);
  const unloggedItems = useMemo(() => items.filter((i) => !i.hasValue), [items]);

  // Compute final payload with only user-included fields
  const handleConfirmAction = async () => {
    const finalPayload: Partial<DailyCheckin> = {
      date,
      wellbeing: includedFields.wellbeing ? (data.wellbeing ?? null) : null,
      sleepHours: includedFields.sleepHours ? (data.sleepHours ?? null) : null,
      waterGlasses: includedFields.waterGlasses ? (data.waterGlasses ?? null) : null,
      exerciseMinutes: includedFields.exerciseMinutes ? (data.exerciseMinutes ?? null) : null,
      exerciseType: includedFields.exerciseMinutes ? (data.exerciseType ?? null) : null,
      weightKg: includedFields.weightKg ? (data.weightKg ?? null) : null,
      systolicBP: includedFields.bloodPressure ? (data.systolicBP ?? null) : null,
      diastolicBP: includedFields.bloodPressure ? (data.diastolicBP ?? null) : null,
      bloodGlucose: includedFields.bloodGlucose ? (data.bloodGlucose ?? null) : null,
      bloodGlucoseUnit: data.bloodGlucoseUnit ?? "mg/dL",
      symptoms: includedFields.symptoms ? (data.symptoms ?? []) : [],
      tags: includedFields.tags ? (data.tags ?? []) : [],
      notes: includedFields.notes ? (data.notes ?? null) : null,
      observations: includedFields.observations ? (data.observations ?? []) : [],
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
            {item.canExclude && item.hasValue && (
              <button
                type="button"
                onClick={() => toggleField(item.id)}
                className="touch-press size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors ml-1"
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

      {/* Notes (if any) */}
      {data.notes && (
        <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground block">{t("checkin.notes")}:</span>
            <button
              type="button"
              onClick={() => toggleField("notes")}
              className="text-[11px] text-primary hover:underline"
            >
              {includedFields.notes
                ? t("review.excludeField") || "Exclude"
                : t("review.includeField") || "Include"}
            </button>
          </div>
          {includedFields.notes && (
            <p className="text-muted-foreground leading-relaxed italic">{data.notes}</p>
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
          onClick={onEdit}
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
