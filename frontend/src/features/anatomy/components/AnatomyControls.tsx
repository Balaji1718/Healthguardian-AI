import { RotateCcw, Accessibility } from "lucide-react";
import { useTranslation } from "@/locales/i18n";
import type { CameraPreset, LayerVisibilityState } from "../types";

interface AnatomyControlsProps {
  onReset: () => void;
  onPreset: (preset: CameraPreset) => void;
  layers: LayerVisibilityState;
  onToggleLayer: (layer: keyof LayerVisibilityState) => void;
  is2DActive?: boolean;
  onToggle2D?: () => void;
  activePreset?: CameraPreset;
  showShellToggle?: boolean;
}

export function AnatomyControls({
  onReset,
  onPreset,
  layers,
  onToggleLayer,
  is2DActive,
  onToggle2D,
  activePreset = "front",
  showShellToggle = true,
}: AnatomyControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Top-Left Secondary Controls HUD */}
      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1 p-1 rounded-xl bg-background/70 backdrop-blur-md border border-border/40 shadow-sm transition-all text-xs">
        {/* Reset Camera Button */}
        <button
          type="button"
          onClick={onReset}
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors touch-press"
          title={t("dashboard.anatomy.resetView") || "Reset View"}
          aria-label={t("dashboard.anatomy.resetView") || "Reset View"}
        >
          <RotateCcw className="size-3.5" />
        </button>

        <div className="h-3.5 w-px bg-border/60 mx-0.5" />

        {/* View Presets */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Camera Presets">
          {(["front", "side", "back"] as CameraPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPreset(preset)}
              className={`h-6 px-2 rounded-md text-[11px] font-medium transition-colors touch-press ${
                activePreset === preset
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {preset === "front"
                ? t("dashboard.anatomy.frontView") || "Front"
                : preset === "side"
                  ? t("dashboard.anatomy.sideView") || "Side"
                  : t("dashboard.anatomy.backView") || "Back"}
            </button>
          ))}
        </div>

        <div className="h-3.5 w-px bg-border/60 mx-0.5" />

        {/* Layer Toggles */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Anatomical Layers">
          <button
            type="button"
            onClick={() => onToggleLayer("organs")}
            className={`h-6 px-2 rounded-md text-[11px] font-medium transition-all touch-press ${
              layers.organs
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 line-through"
            }`}
            title="Toggle Vital Organs"
          >
            {t("dashboard.anatomy.layerOrgans") || "Organs"}
          </button>

          <button
            type="button"
            onClick={() => onToggleLayer("skeleton")}
            className={`h-6 px-2 rounded-md text-[11px] font-medium transition-all touch-press ${
              layers.skeleton
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 line-through"
            }`}
            title="Toggle Skeleton"
          >
            {t("dashboard.anatomy.layerSkeleton") || "Bones"}
          </button>

          {showShellToggle && (
            <button
              type="button"
              onClick={() => onToggleLayer("shell")}
              className={`h-6 px-2 rounded-md text-[11px] font-medium transition-all touch-press ${
                layers.shell
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 line-through"
              }`}
              title="Toggle Body Shell"
            >
              {t("dashboard.anatomy.layerShell") || "Body Shell"}
            </button>
          )}
        </div>
      </div>

      {/* Top-Right Secondary Fallback / Accessibility Button */}
      {onToggle2D && (
        <div className="absolute top-3.5 right-3.5 z-10">
          <button
            type="button"
            onClick={onToggle2D}
            className={`h-7 px-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all shadow-xs backdrop-blur-md touch-press ${
              is2DActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background/70 border-border/40 text-muted-foreground hover:text-foreground hover:bg-background/90"
            }`}
            title="Switch between 3D view and accessible 2D view"
            aria-label="Toggle accessible 2D anatomical map"
          >
            <Accessibility className="size-3.5" />
            <span className="hidden sm:inline">{is2DActive ? "3D Body" : "2D View"}</span>
          </button>
        </div>
      )}

      {/* Bottom-Left Non-Intrusive Status Legend */}
      <div className="absolute bottom-3.5 left-3.5 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-background/60 backdrop-blur-md border border-border/30 text-[10px] text-muted-foreground shadow-xs pointer-events-none">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-slate-400" />
          <span>{t("dashboard.anatomy.statusNoData") || "No data yet"}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>{t("dashboard.anatomy.statusStable") || "Stable"}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-500" />
          <span>{t("dashboard.anatomy.statusAttention") || "Attention"}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-rose-500" />
          <span>{t("dashboard.anatomy.statusReview") || "Review"}</span>
        </span>
      </div>
    </>
  );
}
