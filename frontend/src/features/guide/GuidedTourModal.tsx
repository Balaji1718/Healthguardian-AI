import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { GUIDED_TOUR_STEPS } from "./guide-data";
import { useTranslation } from "@/locales/i18n";

interface GuidedTourModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStepIndex?: number;
}

export function GuidedTourModal({
  open,
  onOpenChange,
  initialStepIndex = 0,
}: GuidedTourModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);

  useEffect(() => {
    if (open && initialStepIndex !== undefined) {
      setCurrentStepIndex(initialStepIndex);
    }
  }, [open, initialStepIndex]);

  const step = GUIDED_TOUR_STEPS[currentStepIndex] ?? GUIDED_TOUR_STEPS[0]!;
  const totalSteps = GUIDED_TOUR_STEPS.length;
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  const stepNum = step.stepNumber;
  const stepTitle = t(`tour.steps.${stepNum}.title`) || step.title;
  const stepTargetLabel = t(`tour.steps.${stepNum}.targetLabel`) || step.targetLabel;
  const stepDescription = t(`tour.steps.${stepNum}.description`) || step.description;
  const stepActionPrompt = t(`tour.steps.${stepNum}.actionPrompt`) || step.actionPrompt;
  const stepKeyTakeaway = t(`tour.steps.${stepNum}.keyTakeaway`) || step.keyTakeaway;

  const handleNext = () => {
    if (currentStepIndex + 1 < totalSteps) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Completed tour
      try {
        localStorage.setItem("hasCompletedGuide", "true");
      } catch {
        // ignore
      }
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleOpenFeature = () => {
    onOpenChange(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: step.targetRoute as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0 border shadow-xl bg-card">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge
              variant="outline"
              className="gap-1 px-2.5 py-0.5 font-semibold text-xs border-primary/30 text-primary bg-primary/10"
            >
              <Compass className="size-3.5" />
              <span>{t("tour.badge")}</span>
            </Badge>
            <span className="text-xs font-mono text-muted-foreground font-medium">
              {t("tour.stepCounter", { current: step.stepNumber, total: totalSteps })}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{stepTitle}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {t("tour.targetPage")}: <strong className="text-foreground">{stepTargetLabel}</strong> (
            {step.targetRoute})
          </DialogDescription>

          <div className="mt-3">
            <Progress value={progressPercent} className="h-1.5 bg-muted" />
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 pt-4 space-y-4 text-xs sm:text-sm">
          <p className="leading-relaxed text-foreground/90 font-medium">{stepDescription}</p>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5 shrink-0" />
              <span>{t("tour.recommendedAction")}:</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{stepActionPrompt}</p>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
            <span>
              <strong>{t("tour.keyTakeaway")}:</strong> {stepKeyTakeaway}
            </span>
          </div>
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 p-4 bg-muted/20 border-t">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground h-8"
            >
              <X className="size-3.5 mr-1" />
              <span>{t("tour.skipTour")}</span>
            </Button>

            {currentStepIndex > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="text-xs h-8 gap-1"
              >
                <ArrowLeft className="size-3.5" />
                <span>{t("tour.back")}</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenFeature}
              className="text-xs h-8 gap-1.5 text-primary hover:text-primary/90"
            >
              <span>{t("tour.goTo", { target: stepTargetLabel })}</span>
              <ExternalLink className="size-3.5" />
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleNext}
              className="text-xs h-8 gap-1.5 font-semibold"
            >
              <span>
                {currentStepIndex + 1 === totalSteps ? t("tour.finishTour") : t("tour.nextStep")}
              </span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
