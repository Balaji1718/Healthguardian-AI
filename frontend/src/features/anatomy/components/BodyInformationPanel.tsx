import {
  X,
  ArrowRight,
  ShieldCheck,
  Activity,
  Calendar,
  Info,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/locales/i18n";
import type { AnatomicalRegionState } from "../types";
import { STATUS_COLORS } from "../config/anatomy-config";

interface BodyInformationPanelProps {
  region: AnatomicalRegionState | null;
  onClose: () => void;
  className?: string;
}

export function BodyInformationPanel({
  region,
  onClose,
  className = "",
}: BodyInformationPanelProps) {
  const { t } = useTranslation();

  // When no organ is selected, return null so 100% of the canvas is unobstructed
  if (!region || region.id === "body_shell") {
    return null;
  }

  const statusConfig = STATUS_COLORS[region.status];
  const isReview = region.status === "REVIEW_REQUIRED";
  const isAttention = region.status === "ATTENTION";
  const hasData = region.hasData && region.status !== "NO_DATA";

  const translatedName = region.nameKey ? t(region.nameKey) : undefined;
  const displayName =
    translatedName && translatedName !== region.nameKey ? translatedName : region.defaultName;

  const translatedStatus = statusConfig.labelKey ? t(statusConfig.labelKey) : undefined;
  const statusLabel =
    translatedStatus && translatedStatus !== statusConfig.labelKey
      ? translatedStatus
      : statusConfig.defaultLabel;

  const translatedWhy = region.whyExplanationKey ? t(region.whyExplanationKey) : undefined;
  const whyExplanation =
    translatedWhy && translatedWhy !== region.whyExplanationKey
      ? translatedWhy
      : region.explanation || region.defaultWhyExplanation;

  return (
    <div
      className={`rounded-2xl border bg-card/90 backdrop-blur-xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between space-y-3.5 border-border/70 animate-in fade-in slide-in-from-right-4 duration-300 ${className}`}
      role="region"
      aria-label={`${displayName} health details`}
    >
      {/* Header with Title and Close Button */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {region.category === "organ"
                ? "Vital Organ"
                : region.category === "bone"
                  ? "Skeletal Structure"
                  : "Musculoskeletal System"}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
              {displayName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 flex items-center justify-center transition-colors shrink-0 touch-press"
            title="Close information panel"
            aria-label="Close information panel"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Status Indicator Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs font-semibold px-2.5 py-0.5 border ${
              isReview
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : isAttention
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : hasData
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-muted/60 text-muted-foreground border-border/60"
            }`}
          >
            <span
              className="size-1.5 rounded-full mr-1.5 shrink-0"
              style={{ backgroundColor: statusConfig.hex }}
            />
            {statusLabel}
          </Badge>

          {region.lastUpdated && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              <span>{region.lastUpdated}</span>
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="space-y-3 text-xs flex-1 overflow-y-auto pr-0.5">
        {/* Why this is shown */}
        <div className="space-y-1">
          <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
            <Info className="size-3.5 text-primary" />
            <span>{t("dashboard.anatomy.whyShown") || "Why this is shown"}</span>
          </h4>
          <p className="text-muted-foreground leading-relaxed text-[11px]">{whyExplanation}</p>
        </div>

        {/* Evidence Metrics List */}
        {region.evidence.length > 0 ? (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
              <Activity className="size-3.5 text-primary" />
              <span>{t("dashboard.anatomy.recordedEvidence") || "Recorded Data & Source"}</span>
            </h4>
            <div className="space-y-1.5">
              {region.evidence.map((ev, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-muted/40 border border-border/50 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground">{ev.metricName}</span>
                    <span className="font-mono font-bold text-foreground">
                      {ev.recentValue} {ev.unit || ""}
                    </span>
                  </div>
                  {ev.referenceRange && (
                    <p className="text-[10px] text-muted-foreground">
                      Reference: <span className="font-medium">{ev.referenceRange}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span>Source: {ev.source}</span>
                    {ev.timestamp && (
                      <span>
                        {ev.timestamp instanceof Date
                          ? ev.timestamp.toLocaleDateString()
                          : String(ev.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-[11px] text-muted-foreground space-y-1.5">
            <p>
              {t("dashboard.anatomy.noDataYet") ||
                "No data yet. Log a check-in or upload a report to track this area."}
            </p>
          </div>
        )}
      </div>

      {/* Action Footer Navigation */}
      <div className="pt-2 border-t border-border/50 flex items-center gap-2">
        <Button asChild size="sm" className="w-full text-xs h-8 gap-1.5 shadow-xs">
          <Link to="/app/checkin">
            <Activity className="size-3.5" />
            <span>{t("dashboard.logNow") || "Log Daily Check-in"}</span>
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="text-xs h-8 px-2.5">
          <Link to="/app/reports" title="View Lab Reports">
            <FileText className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
