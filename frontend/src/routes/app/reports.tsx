import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, FileText, Image as ImageIcon, Loader2, ScanLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer, EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUid } from "@/features/auth/useAuth";
import { useReports, useResults } from "@/features/health/queries";
import { reportMetaSchema } from "@/core/validation/schemas";
import { useCapabilities } from "@/core/capabilities";
import {
  ALLOWED_MIME,
  deleteLocalDocument,
  getLocalDocument,
  saveLocalDocument,
  validateFile,
} from "@/services/localStorage/documents";
import { computeFlag, runOcr } from "@/services/ocr/ocr";
import {
  understandMedicalReport,
  type StructuredBiomarkerCandidate,
} from "@/services/ai/document-understanding";
import { ReportVerificationPanel } from "@/features/reports/ReportVerificationPanel";
import {
  createReport,
  deleteReport,
  saveResult,
  updateReport,
  syncReportToHealthRecords,
  toDate,
} from "@/services/firebase/repositories";
import type { MedicalReport, MedicalResult } from "@/models";
import { ContextualHelp } from "@/features/guide/ContextualHelp";
import { formatReportType } from "@/locales/formatters";
import { useTranslation } from "@/locales/i18n";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Medical reports — HealthGuardian AI" },
      {
        name: "description",
        content:
          "Read lab reports on your own device and confirm each extracted value before it is saved.",
      },
      { property: "og:title", content: "Medical reports, read on your device" },
      {
        property: "og:description",
        content: "On-device OCR with human verification before any value is stored.",
      },
    ],
  }),
});

const REPORT_TYPES = [
  "blood_test",
  "urine_test",
  "imaging",
  "prescription",
  "discharge_summary",
  "other",
];

export function ReportsPage() {
  const uid = useUid();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { canDirectCameraCapture } = useCapabilities();
  const { data, isLoading, isError, refetch } = useReports(uid);
  const [file, setFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState({
    reportTitle: "",
    reportType: "blood_test",
    reportDate: new Date().toISOString().slice(0, 10),
    laboratoryName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const [candidates, setCandidates] = useState<StructuredBiomarkerCandidate[]>([]);
  const [parsedSections, setParsedSections] = useState<string[]>([]);
  const [parsedWarnings, setParsedWarnings] = useState<string[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !file) {
      toast.error("Choose a PDF or image of your report first.");
      return;
    }
    const fileError = validateFile(file);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    const parsed = reportMetaSchema.safeParse(meta);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    setProgress(5);
    setProgressLabel(t("reports.readingReport") || "Reading report document...");
    let localFileId = "";
    let reportId = "";
    try {
      localFileId = await saveLocalDocument(uid, file);
      const report: MedicalReport = {
        reportTitle: meta.reportTitle,
        reportType: meta.reportType,
        documentType: file.type === "application/pdf" ? "pdf" : "image",
        reportDate: new Date(`${meta.reportDate}T00:00:00`),
        laboratoryName: meta.laboratoryName || undefined,
        ocrStatus: "processing",
        verificationStatus: "pending",
        localFileId,
      };
      reportId = await createReport(uid, report);
      setActiveReport(reportId);

      // Phase 1: Document reading & character extraction
      const outcome = await runOcr(file, file.type, (p) => {
        setProgress(Math.round(5 + p * 45));
      });

      // Phase 2: Semantic Document Understanding & Table Reconstruction
      setProgress(55);
      setProgressLabel(t("reports.understandingStructure") || "Understanding report structure & table layout...");
      const docOutcome = await understandMedicalReport(outcome.pages, meta);

      // Phase 3: Organizing & Checking
      setProgress(85);
      setProgressLabel(t("reports.organizingResults") || "Checking extracted information & preparing review...");

      setCandidates(docOutcome.candidates);
      setParsedSections(docOutcome.sections || []);
      setParsedWarnings(docOutcome.warnings || []);

      await updateReport(uid, reportId, {
        ocrStatus: docOutcome.candidates.length ? "completed" : "failed",
        pageCount: outcome.pages.length,
      });
      await qc.invalidateQueries({ queryKey: ["reports"] });

      setProgress(100);
      toast[docOutcome.candidates.length ? "success" : "warning"](
        docOutcome.candidates.length
          ? t("reports.valuesReadPrompt", { count: docOutcome.candidates.length }) ||
              `${docOutcome.candidates.length} value(s) structured. Please verify each one before saving.`
          : t("reports.textNotReadWarning") ||
              "The text could not be read reliably. You can still keep the document and enter values manually.",
      );
    } catch (err) {
      if (uid && reportId) await updateReport(uid, reportId, { ocrStatus: "failed" });
      if (uid && localFileId) await deleteLocalDocument(uid, localFileId);
      toast.error(
        (err as Error).message ||
          t("reports.readingFailed") ||
          "Reading the document failed on this device.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
      setProgressLabel("");
    }
  };

  const handleConfirmVerifiedCandidates = async (confirmed: StructuredBiomarkerCandidate[]) => {
    if (!uid || !activeReport) return;
    setBusy(true);
    try {
      const confirmedResults: MedicalResult[] = [];
      for (const c of confirmed) {
        const flag = c.flag && c.flag !== "unknown"
          ? c.flag
          : computeFlag(
              c.numericValue ?? null,
              c.referenceLow ?? null,
              c.referenceHigh ?? null,
            );
        const resObj: MedicalResult = {
          ...c,
          flag,
          userVerified: true,
          verifiedAt: new Date(),
        };
        const savedId = await saveResult(uid, activeReport, resObj);
        confirmedResults.push({ ...resObj, id: savedId });
      }

      // Synchronize atomically into canonical healthRecords collection!
      const reportDate = new Date(`${meta.reportDate}T00:00:00`);
      await syncReportToHealthRecords(uid, activeReport, reportDate, confirmedResults, meta.reportTitle);

      await updateReport(uid, activeReport, {
        verificationStatus: "verified",
        verifiedAt: new Date(),
      });

      // Synchronize across all relevant query caches
      await qc.invalidateQueries({ queryKey: ["reports"] });
      await qc.invalidateQueries({ queryKey: ["healthRecords", uid] });
      await qc.invalidateQueries({ queryKey: ["analysis", uid] });
      await qc.invalidateQueries({ queryKey: ["assessments", uid] });

      setCandidates([]);
      setFile(null);
      setActiveReport(null);
      toast.success(t("common.success") || "Report verified and saved to your health record!");
    } catch (err) {
      console.error("Confirmation error:", err);
      toast.error(t("common.error") || "Failed to save verified report.");
    } finally {
      setBusy(false);
    }
  };

  const removeReport = async (r: MedicalReport) => {
    if (!uid || !r.id) return;
    await deleteReport(uid, r.id);
    await deleteLocalDocument(uid, r.localFileId);
    await qc.invalidateQueries({ queryKey: ["reports"] });
    toast.success(t("common.success"));
  };

  const openLocal = async (r: MedicalReport) => {
    if (!uid) return;
    const doc = await getLocalDocument(uid, r.localFileId);
    if (!doc) {
      toast.error(
        "The file is no longer on this device. Documents are never uploaded, so it cannot be recovered here.",
      );
      return;
    }
    const url = URL.createObjectURL(doc.blob);
    const win = window.open(url, "_blank", "noopener");
    if (!win || win.closed || typeof win.closed === "undefined") {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name || "medical-report";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div>
      <PageHeader title={t("reports.title")} description={t("reports.subtitle")} />

      <form onSubmit={upload} className="surface space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="reportTitle">{t("reports.reportTitle")}</Label>
            <Input
              id="reportTitle"
              value={meta.reportTitle}
              onChange={(e) => setMeta({ ...meta, reportTitle: e.target.value })}
              placeholder={t("reports.reportNamePlaceholder") || "Annual blood panel"}
            />
            {errors["reportTitle"] && (
              <p className="text-xs text-destructive">{errors["reportTitle"]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reportType">{t("reports.reportType")}</Label>
            <select
              id="reportType"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={meta.reportType}
              onChange={(e) => setMeta({ ...meta, reportType: e.target.value })}
            >
              {REPORT_TYPES.map((typeKey) => (
                <option key={typeKey} value={typeKey}>
                  {formatReportType(typeKey, t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reportDate">{t("reports.reportDate")}</Label>
            <Input
              id="reportDate"
              type="date"
              value={meta.reportDate}
              onChange={(e) => setMeta({ ...meta, reportDate: e.target.value })}
            />
            {errors["reportDate"] && (
              <p className="text-xs text-destructive">{errors["reportDate"]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab">{t("reports.labName")}</Label>
            <Input
              id="lab"
              value={meta.laboratoryName}
              onChange={(e) => setMeta({ ...meta, laboratoryName: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t("reports.uploadBoxTitle") || "Upload Report"}
            </Label>
            <ContextualHelp content={t("reports.contextHelp")} />
          </div>

          {/* Mobile direct camera capture input (only wired if supported) */}
          {canDirectCameraCapture && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) setFile(selected);
              }}
            />
          )}
          {/* Universal file input (PDF or images) */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME.join(",")}
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) setFile(selected);
            }}
          />
          {/* Dedicated image picker for desktop environments without capture attribute */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) setFile(selected);
            }}
          />

          {!file ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {canDirectCameraCapture ? (
                /* Mobile / Tablet: Real rear camera scan supported */
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="touch-press flex min-h-[56px] items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3.5 text-primary transition-colors hover:bg-primary/10 hover:border-primary cursor-pointer"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <Camera className="size-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {t("reports.takePhoto") || "Take Photo of Report"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Direct mobile camera scan
                    </p>
                  </div>
                </button>
              ) : (
                /* Desktop / Laptop: Explicit image upload without misleading camera claim */
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="touch-press flex min-h-[56px] items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3.5 text-primary transition-colors hover:bg-primary/10 hover:border-primary cursor-pointer"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <ImageIcon className="size-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {t("reports.uploadImage") || "Select Report Image"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      PNG, JPG, or WEBP photo of report
                    </p>
                  </div>
                </button>
              )}

              {/* Universal PDF / File Upload Action */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="touch-press flex min-h-[56px] items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-3.5 transition-colors hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground shrink-0">
                  <Upload className="size-5" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t("reports.chooseFile") || "Upload PDF or File"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t("reports.uploadBoxHint") || "PDF, PNG, JPG up to 15 MB"}
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {file.type.startsWith("image/") ? (
                    <Camera className="size-5" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
                    {file.type.split("/")[1]?.toUpperCase() || "FILE"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setFile(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          )}
        </div>

        {progress !== null && (
          <div className="space-y-2 rounded-xl border bg-muted/40 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-primary">
              <span className="flex items-center gap-2">
                <ScanLine className="size-4 animate-pulse shrink-0" />
                <span>{progressLabel || t("reports.readingProgress", { progress })}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          type="submit"
          disabled={busy || !file}
          className="w-full sm:w-auto min-h-[48px] touch-press text-base sm:text-sm"
        >
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}{" "}
          {t("reports.readAndExtract")}
        </Button>
      </form>

      {candidates.length > 0 && (
        <ReportVerificationPanel
          candidates={candidates}
          reportTitle={meta.reportTitle || "Medical Report"}
          reportDate={meta.reportDate}
          laboratoryName={meta.laboratoryName}
          sections={parsedSections}
          warnings={parsedWarnings}
          busy={busy}
          onConfirmAll={handleConfirmVerifiedCandidates}
          onCancel={() => {
            setCandidates([]);
            setFile(null);
          }}
        />
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("reports.title")}</h2>
        {(data ?? []).length === 0 ? (
          <EmptyState
            title={t("reports.noReportsTitle")}
            description={t("reports.noReportsDesc")}
          />
        ) : (
          <ul className="space-y-2">
            {(data ?? []).map((r) => (
              <li
                key={r.id}
                className="surface flex flex-col sm:flex-row sm:items-center gap-3 p-4"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm sm:text-base">{r.reportTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {toDate(r.reportDate)?.toLocaleDateString() ?? "—"} ·{" "}
                      {formatReportType(r.reportType, t)}
                    </p>
                  </div>
                  <Badge
                    variant={r.verificationStatus === "verified" ? "default" : "secondary"}
                    className="shrink-0 text-xs"
                  >
                    {r.verificationStatus === "verified"
                      ? t("reports.statusVerified")
                      : t("reports.statusPending")}
                  </Badge>
                </div>

                <div className="flex items-center justify-end gap-2 border-t pt-2 sm:border-t-0 sm:pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[36px] flex-1 sm:flex-none text-xs"
                    onClick={() => void openLocal(r)}
                  >
                    {t("preview.previewBtn") || "Open"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[36px] text-destructive hover:bg-destructive/10 text-xs"
                    onClick={() => void removeReport(r)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VerifiedValues uid={uid} reportId={(data ?? [])[0]?.id ?? null} />

      <Disclaimer />
    </div>
  );
}

function VerifiedValues({ uid, reportId }: { uid: string | null; reportId: string | null }) {
  const { data } = useResults(uid, reportId);
  const verified = (data ?? []).filter((r) => r.userVerified);
  if (!reportId || verified.length === 0) return null;
  return (
    <section className="surface mt-6 p-4 sm:p-0 sm:overflow-x-auto">
      <div className="sm:hidden space-y-2.5">
        <h3 className="font-semibold text-sm text-muted-foreground mb-2">Verified Biomarkers</h3>
        {verified.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{r.testName}</p>
              {r.flag && (
                <Badge
                  variant={
                    r.flag === "high" ? "destructive" : r.flag === "low" ? "secondary" : "outline"
                  }
                  className="capitalize text-[10px]"
                >
                  {r.flag}
                </Badge>
              )}
            </div>
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>
                Value:{" "}
                <strong className="text-foreground text-sm">
                  {r.resultValue} {r.unit ?? ""}
                </strong>
              </span>
              <span>
                Ref:{" "}
                {r.referenceLow != null && r.referenceHigh != null
                  ? `${r.referenceLow}–${r.referenceHigh}`
                  : (r.referenceText ?? "—")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <table className="hidden sm:table w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-2.5 font-medium">Test</th>
            <th className="px-4 py-2.5 font-medium">Value</th>
            <th className="px-4 py-2.5 font-medium">Reference</th>
            <th className="px-4 py-2.5 font-medium">Flag</th>
          </tr>
        </thead>
        <tbody>
          {verified.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="px-4 py-2.5">{r.testName}</td>
              <td className="px-4 py-2.5">
                {r.resultValue} {r.unit ?? ""}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.referenceLow != null && r.referenceHigh != null
                  ? `${r.referenceLow}–${r.referenceHigh}`
                  : (r.referenceText ?? "—")}
              </td>
              <td className="px-4 py-2.5 capitalize">{r.flag ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
