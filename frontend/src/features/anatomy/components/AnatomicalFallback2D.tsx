import { Activity, ShieldCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/locales/i18n";
import type { AnatomicalRegionId, AnatomicalRegionState } from "../types";
import { STATUS_COLORS } from "../config/anatomy-config";

interface AnatomicalFallback2DProps {
  regionStates: Record<AnatomicalRegionId, AnatomicalRegionState>;
  selectedRegion: AnatomicalRegionState | null;
  onSelectRegion: (region: AnatomicalRegionState | null) => void;
  onSwitchTo3D?: (() => void) | undefined;
  className?: string | undefined;
}

export function AnatomicalFallback2D({
  regionStates,
  selectedRegion,
  onSelectRegion,
  onSwitchTo3D,
  className = "",
}: AnatomicalFallback2DProps) {
  const { t } = useTranslation();

  const interactiveRegions: AnatomicalRegionId[] = [
    "organ_brain",
    "organ_heart",
    "organ_lungs",
    "organ_liver",
    "organ_stomach",
    "organ_pancreas",
    "organ_spleen",
    "organ_kidneys",
    "organ_bladder",
    "bone_spine",
    "bone_skull",
    "muscle_system",
  ];

  return (
    <div
      className={`rounded-2xl border bg-card/80 backdrop-blur-md p-4 sm:p-6 shadow-sm space-y-4 ${className}`}
      role="region"
      aria-label="2D Anatomical Map"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {t("dashboard.anatomy.fallbackTitle") || "Anatomical Health Map"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.anatomy.fallbackSubtitle") ||
              "Accessible 2D anatomical view of your recorded biomarkers and habits."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" /> Stable
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" /> Attention
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" /> Review
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-slate-400" /> No data
          </span>
        </div>
      </div>

      {onSwitchTo3D && (
        <button
          type="button"
          onClick={onSwitchTo3D}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          {t("dashboard.anatomy.switchTo3D") || "Switch to 3D view"}
        </button>
      )}

      {/* Grid of Interactive Anatomical Cards */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {interactiveRegions.map((id) => {
          const region = regionStates[id];
          if (!region) return null;
          const isSelected = selectedRegion?.id === id;
          const statusConfig = STATUS_COLORS[region.status];

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectRegion(region)}
              className={`p-3 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary ${
                isSelected
                  ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                  : "bg-card hover:bg-muted/50 border-border/70"
              }`}
              aria-pressed={isSelected}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusConfig.hex }}
                  />
                  <h4 className="text-xs font-semibold text-foreground truncate">
                    {t(region.nameKey) || region.defaultName}
                  </h4>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {region.hasData
                    ? `${region.evidence[0]?.metricName}: ${region.evidence[0]?.recentValue} ${region.evidence[0]?.unit || ""}`
                    : t("dashboard.anatomy.noDataYet") || "No data yet"}
                </p>
              </div>

              <Badge
                variant={statusConfig.badgeVariant}
                className="shrink-0 text-[10px] px-1.5 py-0 font-medium"
              >
                {region.status === "STABLE" && <ShieldCheck className="mr-0.5 size-2.5" />}
                {region.status === "ATTENTION" && <Activity className="mr-0.5 size-2.5" />}
                {region.status === "REVIEW_REQUIRED" && (
                  <AlertTriangle className="mr-0.5 size-2.5" />
                )}
                {t(region.statusLabelKey) || region.defaultStatusLabel}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
