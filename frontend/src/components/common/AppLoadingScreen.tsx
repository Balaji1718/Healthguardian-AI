import { Heart } from "lucide-react";
import { useTranslation } from "@/locales/i18n";

export interface AppLoadingScreenProps {
  label?: string;
  sublabel?: string;
}

export function AppLoadingScreen({ label, sublabel }: AppLoadingScreenProps) {
  const { t } = useTranslation();

  const title = label || t("auth.checkingSession") || "Preparing your health workspace...";
  const subtitle = sublabel || t("common.appName") || "HealthGuardian AI";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-4 select-none animate-in fade-in duration-200"
    >
      <div className="flex flex-col items-center max-w-sm text-center">
        {/* Glowing Brand Icon */}
        <div className="relative mb-5">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary to-cyan-500 opacity-40 blur-sm animate-pulse" />
          <div className="relative flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-cyan-500 text-white shadow-lg">
            <Heart className="size-7 sm:size-8 fill-white/20 stroke-[2.2]" />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-1">
          {subtitle}
        </h1>

        {/* Status Message */}
        <p className="text-xs sm:text-sm text-muted-foreground mb-6 font-medium">
          {title}
        </p>

        {/* Sleek Progress Bar */}
        <div className="w-44 h-1.5 bg-muted rounded-full overflow-hidden relative">
          <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-gradient-to-r from-primary to-cyan-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
