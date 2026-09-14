import { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  Edit2,
  Check,
  X,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/locales/i18n";
import type { StructuredBiomarkerCandidate } from "@/services/ai/document-understanding";

export interface ReportVerificationPanelProps {
  candidates: StructuredBiomarkerCandidate[];
  reportTitle: string;
  reportDate?: string | undefined;
  laboratoryName?: string | null | undefined;
  sections?: string[] | undefined;
  warnings?: string[] | undefined;
  busy: boolean;
  onConfirmAll: (confirmed: StructuredBiomarkerCandidate[]) => Promise<void>;
  onCancel: () => void;
}

export function ReportVerificationPanel({
  candidates: initialCandidates,
  reportTitle,
  reportDate,
  laboratoryName,
  sections = [],
  warnings = [],
  busy,
  onConfirmAll,
  onCancel,
}: ReportVerificationPanelProps) {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<StructuredBiomarkerCandidate[]>(initialCandidates);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<StructuredBiomarkerCandidate | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [newRow, setNewRow] = useState<Partial<StructuredBiomarkerCandidate>>({
    testName: "",
    resultValue: "",
    unit: "",
    referenceText: "",
    flag: "unknown",
  });

  // Group candidates by section
  const availableSections = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidates) {
      if (c.section) s.add(c.section);
    }
    return Array.from(s);
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (selectedSection === "all") return candidates;
    return candidates.filter((c) => c.section === selectedSection);
  }, [candidates, selectedSection]);

  const ambiguousCount = useMemo(() => {
    return candidates.filter((c) => c.isAmbiguous).length;
  }, [candidates]);

  // Start editing row
  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...candidates[index]! });
  };

  // Field label formatter for diagnostic notices
  const formatFieldLabel = (field: string): string => {
    switch (field) {
      case "testName":
        return "Test Name";
      case "resultValue":
        return "Result Value";
      case "unit":
        return "Unit";
      case "referenceRange":
        return "Reference Range";
      case "flag":
        return "Status Flag";
      default:
        return field;
    }
  };

  // Save edited row with strict field-level ambiguity resolution
  const saveEdit = () => {
    if (editingIndex === null || !editDraft) return;
    const original = candidates[editingIndex]!;
    const cleanNum = editDraft.resultValue.replace(/,/g, "").replace(/^[<>]=?\s*/, "").trim();
    const num = /^-?\d+(\.\d+)?$/.test(cleanNum) ? Number.parseFloat(cleanNum) : null;

    // Field-level ambiguity resolution: only clear ambiguity for fields that were actually edited/corrected
    let remainingAmbiguousFields = Array.isArray(original.ambiguousFields)
      ? [...original.ambiguousFields]
      : [];

    if (editDraft.testName.trim() !== original.testName.trim() && editDraft.testName.trim().length >= 2) {
      remainingAmbiguousFields = remainingAmbiguousFields.filter((f) => f !== "testName");
    }
    if (editDraft.resultValue.trim() !== original.resultValue.trim() && editDraft.resultValue.trim().length > 0) {
      remainingAmbiguousFields = remainingAmbiguousFields.filter((f) => f !== "resultValue");
    }
    if ((editDraft.unit || "").trim() !== (original.unit || "").trim()) {
      remainingAmbiguousFields = remainingAmbiguousFields.filter((f) => f !== "unit");
    }
    if (
      (editDraft.referenceText || "").trim() !== (original.referenceText || "").trim() ||
      editDraft.referenceLow !== original.referenceLow ||
      editDraft.referenceHigh !== original.referenceHigh
    ) {
      remainingAmbiguousFields = remainingAmbiguousFields.filter((f) => f !== "referenceRange");
    }
    if (editDraft.flag !== original.flag) {
      remainingAmbiguousFields = remainingAmbiguousFields.filter((f) => f !== "flag");
    }

    // Safety: recalculate flag if reference bounds are provided and flag was unknown
    let nextFlag = editDraft.flag || "unknown";
    if (nextFlag === "unknown" && num !== null) {
      if (editDraft.referenceLow != null && num < editDraft.referenceLow) nextFlag = "low";
      else if (editDraft.referenceHigh != null && num > editDraft.referenceHigh) nextFlag = "high";
      else if (
        editDraft.referenceLow != null &&
        editDraft.referenceHigh != null &&
        num >= editDraft.referenceLow &&
        num <= editDraft.referenceHigh
      )
        nextFlag = "normal";
    }

    const isStillAmbiguous = remainingAmbiguousFields.length > 0;
    const nextReason = isStillAmbiguous
      ? `Needs verification in: ${remainingAmbiguousFields.map((f) => formatFieldLabel(f)).join(", ")}`
      : "";

    setCandidates((prev) =>
      prev.map((c, i) =>
        i === editingIndex
          ? {
              ...editDraft,
              numericValue: num,
              flag: nextFlag,
              userEdited: true,
              isAmbiguous: isStillAmbiguous,
              ambiguousFields: remainingAmbiguousFields,
              ambiguityReason: nextReason,
            }
          : c,
      ),
    );
    setEditingIndex(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  // Delete row
  const removeRow = (index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  // Add new row manually
  const handleAddNewRow = () => {
    if (!newRow.testName?.trim() || !newRow.resultValue?.trim()) return;
    const cleanNum = newRow.resultValue.replace(/,/g, "").replace(/^[<>]=?\s*/, "").trim();
    const num = /^-?\d+(\.\d+)?$/.test(cleanNum) ? Number.parseFloat(cleanNum) : null;

    const row: StructuredBiomarkerCandidate = {
      testName: newRow.testName.trim(),
      resultValue: newRow.resultValue.trim(),
      numericValue: num,
      unit: (newRow.unit || "").trim(),
      referenceText: (newRow.referenceText || "").trim(),
      flag: newRow.flag || "unknown",
      userVerified: true,
      userEdited: true,
      sourcePage: 1,
      section: selectedSection !== "all" ? selectedSection : "Manual Entry",
      isAmbiguous: false,
      ambiguousFields: [],
    };

    setCandidates((prev) => [...prev, row]);
    setNewRow({
      testName: "",
      resultValue: "",
      unit: "",
      referenceText: "",
      flag: "unknown",
    });
    setShowAddForm(false);
  };

  const getFlagBadge = (flag?: string) => {
    switch (flag) {
      case "high":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20">High</Badge>;
      case "low":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Low</Badge>;
      case "abnormal":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20">Abnormal</Badge>;
      case "normal":
        return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">Normal</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">Unspecified</Badge>;
    }
  };

  return (
    <div className="surface mt-6 p-4 sm:p-6 space-y-5 rounded-2xl border shadow-xs animate-in fade-in duration-200">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary shrink-0" />
            <h2 className="font-semibold text-base sm:text-lg text-foreground">
              {t("reports.verifyModalTitle") || "Review Extracted Report Data"}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("reports.verifyModalDesc") ||
              "Confirm that all biomarkers, values, units, and reference ranges match your printed document before saving to your verified health record."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium">
            {candidates.length} {candidates.length === 1 ? "value" : "values"}
          </Badge>
          {ambiguousCount > 0 && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 px-2.5 py-1 text-xs">
              <AlertTriangle className="size-3 shrink-0" />
              {ambiguousCount} needs attention
            </Badge>
          )}
        </div>
      </div>

      {/* Report Context Banner */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border">
        <div>
          <span className="font-medium text-foreground">Report:</span> {reportTitle}
        </div>
        {reportDate && (
          <div>
            <span className="font-medium text-foreground">Date:</span> {reportDate}
          </div>
        )}
        {laboratoryName && (
          <div>
            <span className="font-medium text-foreground">Lab:</span> {laboratoryName}
          </div>
        )}
      </div>

      {/* Warnings / Fallback Alerts */}
      {warnings.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs space-y-1">
          {warnings.map((w, idx) => (
            <p key={idx} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* Section Filter */}
      {availableSections.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedSection("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              selectedSection === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Panels ({candidates.length})
          </button>
          {availableSections.map((sec) => {
            const count = candidates.filter((c) => c.section === sec).length;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedSection === sec
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {sec} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Candidates List / Table */}
      <div className="space-y-2">
        {filteredCandidates.map((c, idx) => {
          const globalIdx = candidates.indexOf(c);
          const isEditing = editingIndex === globalIdx;

          if (isEditing && editDraft) {
            return (
              <div
                key={globalIdx}
                className="p-3.5 rounded-xl border-2 border-primary/50 bg-primary/5 space-y-3 shadow-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <Label className="text-[11px] text-muted-foreground">Test / Biomarker Name</Label>
                      {editDraft.ambiguousFields?.includes("testName") && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/15 px-1 rounded">Needs review</span>
                      )}
                    </div>
                    <Input
                      value={editDraft.testName}
                      onChange={(e) => setEditDraft({ ...editDraft, testName: e.target.value })}
                      className={`h-8 text-xs font-medium ${editDraft.ambiguousFields?.includes("testName") ? "border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}`}
                      placeholder="e.g. Haemoglobin"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <Label className="text-[11px] text-muted-foreground">Result Value</Label>
                      {editDraft.ambiguousFields?.includes("resultValue") && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/15 px-1 rounded">Needs review</span>
                      )}
                    </div>
                    <Input
                      value={editDraft.resultValue}
                      onChange={(e) => setEditDraft({ ...editDraft, resultValue: e.target.value })}
                      className={`h-8 text-xs font-semibold ${editDraft.ambiguousFields?.includes("resultValue") ? "border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}`}
                      placeholder="e.g. 14.2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <Label className="text-[11px] text-muted-foreground">Unit</Label>
                      {editDraft.ambiguousFields?.includes("unit") && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/15 px-1 rounded">Needs review</span>
                      )}
                    </div>
                    <Input
                      value={editDraft.unit || ""}
                      onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })}
                      className={`h-8 text-xs ${editDraft.ambiguousFields?.includes("unit") ? "border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}`}
                      placeholder="e.g. g/dL"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <Label className="text-[11px] text-muted-foreground">Reference Range</Label>
                      {editDraft.ambiguousFields?.includes("referenceRange") && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/15 px-1 rounded">Needs review</span>
                      )}
                    </div>
                    <Input
                      value={editDraft.referenceText || ""}
                      onChange={(e) => setEditDraft({ ...editDraft, referenceText: e.target.value })}
                      className={`h-8 text-xs ${editDraft.ambiguousFields?.includes("referenceRange") ? "border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/5" : ""}`}
                      placeholder="e.g. 13.0 - 17.0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground">Status Flag:</Label>
                    <select
                      value={editDraft.flag || "unknown"}
                      onChange={(e) => setEditDraft({ ...editDraft, flag: e.target.value })}
                      className="h-7 text-xs rounded-md border bg-background px-2"
                    >
                      <option value="unknown">Unspecified</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                      <option value="abnormal">Abnormal</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      className="h-7 text-xs px-2.5"
                    >
                      <X className="size-3.5 mr-1" /> Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveEdit}
                      className="h-7 text-xs px-3"
                    >
                      <Check className="size-3.5 mr-1" /> Done
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={globalIdx}
              className={`p-3 rounded-xl border transition-all ${
                c.isAmbiguous
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border/60 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Test details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{c.testName}</span>
                    {getFlagBadge(c.flag)}
                    {c.section && (
                      <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {c.section}
                      </span>
                    )}
                    {c.sourcePage && (
                      <span className="text-[10px] text-muted-foreground/70">
                        Page {c.sourcePage}
                      </span>
                    )}
                  </div>

                  {/* Ambiguity notice */}
                  {c.isAmbiguous && (
                    <div className="space-y-1 pt-0.5">
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                        <AlertTriangle className="size-3 shrink-0" />
                        {c.ambiguityReason || "Unclear OCR read. Please verify fields before saving."}
                      </p>
                      {c.ambiguousFields && c.ambiguousFields.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.ambiguousFields.map((f) => (
                            <span
                              key={f}
                              className="text-[9px] px-1.5 py-0.2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono"
                            >
                              Check {formatFieldLabel(f)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Values & Range */}
                <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-foreground">
                      {c.resultValue} {c.unit && <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>}
                    </div>
                    {c.referenceText && (
                      <div className="text-[11px] text-muted-foreground">
                        Ref: {c.referenceText}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(globalIdx)}
                      className="size-8 text-muted-foreground hover:text-foreground"
                      title="Edit this value"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRow(globalIdx)}
                      className="size-8 text-muted-foreground hover:text-destructive"
                      title="Remove this row"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Row Button / Drawer */}
      {!showAddForm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="text-xs gap-1.5 h-8 border-dashed"
        >
          <Plus className="size-3.5" /> Add Missing Test Row
        </Button>
      ) : (
        <div className="p-3.5 rounded-xl border border-dashed border-primary/40 bg-muted/30 space-y-3">
          <p className="text-xs font-medium text-foreground">Add Missing Biomarker from Report</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <Label className="text-[11px] text-muted-foreground">Test Name</Label>
              <Input
                value={newRow.testName}
                onChange={(e) => setNewRow({ ...newRow, testName: e.target.value })}
                className="h-8 text-xs font-medium"
                placeholder="e.g. Fasting Blood Sugar"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Value</Label>
              <Input
                value={newRow.resultValue}
                onChange={(e) => setNewRow({ ...newRow, resultValue: e.target.value })}
                className="h-8 text-xs font-semibold"
                placeholder="e.g. 95"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Unit</Label>
              <Input
                value={newRow.unit}
                onChange={(e) => setNewRow({ ...newRow, unit: e.target.value })}
                className="h-8 text-xs"
                placeholder="e.g. mg/dL"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Reference Range</Label>
              <Input
                value={newRow.referenceText}
                onChange={(e) => setNewRow({ ...newRow, referenceText: e.target.value })}
                className="h-8 text-xs"
                placeholder="e.g. 70 - 100"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddNewRow}
              disabled={!newRow.testName?.trim() || !newRow.resultValue?.trim()}
              className="h-7 text-xs"
            >
              Add Row
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="w-full sm:w-auto h-10 text-xs text-muted-foreground"
        >
          Cancel & Retain Original Document
        </Button>

        <Button
          type="button"
          onClick={() => void onConfirmAll(candidates)}
          disabled={busy || candidates.length === 0}
          className="w-full sm:w-auto h-10 text-xs font-semibold gap-2 shadow-sm"
        >
          <CheckCircle2 className="size-4" />
          Confirm and Save Verified Health Data ({candidates.length})
        </Button>
      </div>
    </div>
  );
}
