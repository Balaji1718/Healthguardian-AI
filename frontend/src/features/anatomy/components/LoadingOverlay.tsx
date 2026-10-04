import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/locales/i18n";

interface LoadingOverlayProps {
  isLoading: boolean;
  progress: number;
  error: string | null;
  onRetry: () => void;
}

export function LoadingOverlay({ isLoading, progress, error, onRetry }: LoadingOverlayProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/90 backdrop-blur-md p-6 text-center animate-in fade-in duration-300">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">
          {t("dashboard.anatomy.modelLoadError") || "The interactive body view couldn't be loaded."}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {t("common.pageLoadErrorDesc") || "You can try refreshing or use the 2D anatomical map."}
        </p>
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-4 gap-2 text-xs font-semibold"
        >
          <RefreshCw className="size-3.5" />
          <span>{t("dashboard.anatomy.retryLoading") || "Retry"}</span>
        </Button>
      </div>
    );
  }

  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/70 backdrop-blur-xs p-6 text-center animate-in fade-in duration-300 pointer-events-none">
      <div className="relative flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
      <p className="mt-3 text-xs font-semibold text-foreground tracking-wide">
        {t("dashboard.anatomy.loadingModel") || "Preparing your interactive health view…"}
      </p>
      {progress > 0 && progress < 100 && (
        <div className="mt-2 w-32 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
