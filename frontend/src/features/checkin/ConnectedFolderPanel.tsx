import { useEffect, useState, useCallback, useMemo } from "react";
import {
  FolderOpen,
  RefreshCw,
  Unlink,
  FileText,
  FileCheck,
  Loader2,
  CheckSquare,
  Square,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  type ConnectedFileEntry,
  type FolderStatus,
  getStoredFolderHandle,
  removeFolderHandle,
  scanFolderFiles,
  verifyFolderPermission,
  acknowledgeFolderFiles,
  classifyDocumentContent,
  extractDocumentCheckinData,
} from "@/services/localStorage/folderAccess";
import { runOcr } from "@/services/ocr/ocr";
import { validateFile } from "@/services/localStorage/documents";
import { FilePreviewModal } from "@/features/checkin/FilePreviewModal";
import { FileThumbnail } from "@/features/checkin/FileThumbnail";

export interface ConnectedFolderPanelProps {
  onCheckinExtracted: (text: string, source: "file_import" | "ocr", filename: string) => void;
  onNavigateToReports?: () => void;
}

const PAGE_SIZE = 50;

export function ConnectedFolderPanel({
  onCheckinExtracted,
  onNavigateToReports,
}: ConnectedFolderPanelProps) {
  const [status, setStatus] = useState<FolderStatus>({
    isConnected: false,
    hasPermission: false,
    folderName: null,
    files: [],
    supportedCount: 0,
    newCount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [viewingFiles, setViewingFiles] = useState(false);
  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<string | null>(null);

  // Search, filter & pagination state for large folders
  const [searchQuery, setSearchQuery] = useState("");
  const [onlySupported, setOnlySupported] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Preview Modal state
  const [previewEntry, setPreviewEntry] = useState<ConnectedFileEntry | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Check stored handle on mount
  const checkStoredFolder = useCallback(async () => {
    const handle = await getStoredFolderHandle();
    if (!handle) {
      setStatus({
        isConnected: false,
        hasPermission: false,
        folderName: null,
        files: [],
        supportedCount: 0,
        newCount: 0,
      });
      return;
    }

    const hasPermission = await verifyFolderPermission(handle, false);
    if (!hasPermission) {
      setStatus({
        isConnected: true,
        hasPermission: false,
        folderName: handle.name || "Health Folder",
        files: [],
        supportedCount: 0,
        newCount: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const { files, newCount } = await scanFolderFiles(handle);
      const supported = files.filter((f) => f.isSupported).length;
      setStatus({
        isConnected: true,
        hasPermission: true,
        folderName: handle.name || "Health Folder",
        files,
        supportedCount: supported,
        newCount,
      });
    } catch (err) {
      console.warn("Failed to scan stored folder:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkStoredFolder();

    const handleFolderUpdated = () => {
      void checkStoredFolder();
    };

    window.addEventListener("healthguardian:folder-updated", handleFolderUpdated);
    return () => {
      window.removeEventListener("healthguardian:folder-updated", handleFolderUpdated);
    };
  }, [checkStoredFolder]);

  // Reconnect / request permission for existing handle
  const handleReconnect = async () => {
    const handle = await getStoredFolderHandle();
    if (!handle) return;
    setLoading(true);
    const granted = await verifyFolderPermission(handle, true);
    if (granted) {
      await checkStoredFolder();
      toast.success("Folder access restored.");
    } else {
      toast.error("Permission not granted. Please reconnect the folder.");
    }
    setLoading(false);
  };

  // Disconnect folder
  const handleDisconnect = async () => {
    await removeFolderHandle();
    setStatus({
      isConnected: false,
      hasPermission: false,
      folderName: null,
      files: [],
      supportedCount: 0,
      newCount: 0,
    });
    setViewingFiles(false);
    setSelectedFilenames([]);
    setIsPreviewOpen(false);
    setPreviewEntry(null);
    toast.success("Health folder disconnected.");
  };

  // Refresh files with actual live directory re-scan and state reconciliation
  const handleRefresh = async () => {
    setLoading(true);
    const handle = await getStoredFolderHandle();
    if (!handle) {
      setStatus({
        isConnected: false,
        hasPermission: false,
        folderName: null,
        files: [],
        supportedCount: 0,
        newCount: 0,
      });
      toast.error("No connected folder found. Please connect a folder first.");
      setLoading(false);
      return;
    }

    try {
      // User gesture allows requesting permission if demoted by Chromium
      const granted = await verifyFolderPermission(handle, true);
      if (!granted) {
        setStatus((prev) => ({ ...prev, hasPermission: false }));
        toast.error("Folder read permission was revoked or denied. Please click Reconnect.");
        setLoading(false);
        return;
      }

      // Re-scan directory from live directory handle
      const { files, newCount, removedCount } = await scanFolderFiles(handle);
      const supported = files.filter((f) => f.isSupported).length;

      setStatus((prev) => ({
        ...prev,
        isConnected: true,
        hasPermission: true,
        folderName: handle.name || prev.folderName || "Health Folder",
        files,
        supportedCount: supported,
        newCount,
      }));

      // Reset page to 1 so newly discovered files (sorted to top) are immediately visible
      setCurrentPage(1);

      // Reconcile selected filenames: purge any that no longer exist
      const existingNames = new Set(files.map((f) => f.name));
      setSelectedFilenames((prev) => prev.filter((name) => existingNames.has(name)));

      // Reconcile preview entry: close preview if removed, otherwise update entry metadata
      setPreviewEntry((prev) => {
        if (!prev) return null;
        const matching = files.find((f) => f.name === prev.name);
        if (!matching) {
          setIsPreviewOpen(false);
          toast.info(`The file "${prev.name}" was removed from the connected folder.`);
          return null;
        }
        return matching;
      });

      // Clear, informative feedback
      if (newCount > 0 && removedCount > 0) {
        toast.info(`Folder refreshed: ${newCount} added, ${removedCount} removed.`);
      } else if (newCount > 0) {
        toast.info(`${newCount} new health file${newCount > 1 ? "s" : ""} found in folder.`);
      } else if (removedCount > 0) {
        toast.info(`${removedCount} file${removedCount > 1 ? "s were" : " was"} removed from folder.`);
      } else if (files.length === 0) {
        toast.info("Folder refreshed: connected directory is currently empty.");
      } else {
        toast.success("Folder refreshed. All files are up to date.");
      }
    } catch (err) {
      console.error("Folder re-scan error:", err);
      toast.error("Failed to re-scan folder. The directory may have moved or become inaccessible.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered files calculation
  const filteredFiles = useMemo(() => {
    let list = status.files;
    if (onlySupported) {
      list = list.filter((f) => f.isSupported);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [status.files, onlySupported, searchQuery]);

  // Paginated files
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, onlySupported]);

  // Toggle selection
  const toggleSelectFile = (filename: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFilenames((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleNames = paginatedFiles.filter((f) => f.isSupported).map((f) => f.name);
    const allSelected = visibleNames.every((name) => selectedFilenames.includes(name));

    if (allSelected) {
      setSelectedFilenames((prev) => prev.filter((name) => !visibleNames.includes(name)));
    } else {
      setSelectedFilenames((prev) => Array.from(new Set([...prev, ...visibleNames])));
    }
  };

  // Open Preview Modal
  const handleOpenFilePreview = (entry: ConnectedFileEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreviewEntry(entry);
    setIsPreviewOpen(true);
  };

  // Single file import handler (used from Preview Modal)
  const handleImportSingleFile = async (entry: ConnectedFileEntry) => {
    if (!entry.fileHandle) return;
    setProcessingFiles(true);
    try {
      const file = await entry.fileHandle.getFile();
      const valErr = validateFile(file);
      if (valErr) {
        toast.error(`${entry.name}: ${valErr}`);
        return;
      }

      setProcessingProgress(`Running on-device OCR on ${entry.name}...`);
      const outcome = await runOcr(file, file.type);
      const combinedText = outcome.pages
        .map((p) => p.text)
        .join("\n")
        .trim();

      if (!combinedText) {
        toast.warning(`No text could be recognized from ${entry.name}.`);
        return;
      }

      const docType = classifyDocumentContent(combinedText);
      const extractedDoc = extractDocumentCheckinData(combinedText, entry.name, 1);

      if ((docType === "medical_report" || docType === "mixed") && onNavigateToReports) {
        toast.info(
          `${entry.name} contains medical report data. You can review it under Medical Reports, or confirm relevant check-in numbers here.`,
        );
      }

      if (extractedDoc.extractedCount === 0 && docType === "medical_report") {
        toast.info(
          `No lifestyle check-in metrics found. You can review this full report in Medical Reports.`,
        );
      }

      onCheckinExtracted(combinedText, "file_import", entry.name);
      await acknowledgeFolderFiles([entry]);
      setIsPreviewOpen(false);
      toast.success(`Extracted information from ${entry.name}. Please review values.`);
    } catch (err) {
      console.error("Error importing file:", err);
      toast.error("Failed to process file. You can enter values in Detailed Check-in.");
    } finally {
      setProcessingFiles(false);
      setProcessingProgress(null);
    }
  };

  // Batch process selected files
  const handleImportSelected = async () => {
    if (selectedFilenames.length === 0) {
      toast.error("Please select at least one file to import.");
      return;
    }

    const selectedEntries = status.files.filter((f) => selectedFilenames.includes(f.name));
    setProcessingFiles(true);

    try {
      for (let i = 0; i < selectedEntries.length; i++) {
        const entry = selectedEntries[i];
        if (!entry || !entry.fileHandle) continue;

        setProcessingProgress(`Reading ${entry.name} (${i + 1}/${selectedEntries.length})...`);
        const file = await entry.fileHandle.getFile();

        const validationErr = validateFile(file);
        if (validationErr) {
          toast.error(`${entry.name}: ${validationErr}`);
          continue;
        }

        setProcessingProgress(`Running on-device OCR on ${entry.name}...`);
        const outcome = await runOcr(file, file.type);
        const combinedText = outcome.pages
          .map((p) => p.text)
          .join("\n")
          .trim();

        if (!combinedText) {
          toast.warning(`No text could be recognized from ${entry.name}.`);
          continue;
        }

        const docType = classifyDocumentContent(combinedText);
        if (docType === "medical_report" && onNavigateToReports) {
          toast.info(
            `${entry.name} appears to be a lab/medical report. You can review it under Medical Reports.`,
          );
        }

        onCheckinExtracted(combinedText, "file_import", entry.name);
        toast.success(`Extracted information from ${entry.name}. Please review values.`);
        break; // Process one check-in document at a time to allow human verification
      }

      await acknowledgeFolderFiles(selectedEntries);
      await handleRefresh();
      setViewingFiles(false);
      setSelectedFilenames([]);
    } catch (err) {
      console.error("Error importing files:", err);
      toast.error("Failed to process selected file. You can enter values manually.");
    } finally {
      setProcessingFiles(false);
      setProcessingProgress(null);
    }
  };

  if (!status.isConnected) {
    return null;
  }

  return (
    <div className="rounded-2xl border bg-card/70 backdrop-blur-md p-3.5 shadow-xs text-xs space-y-3 transition-all">
      {/* File Preview Modal */}
      <FilePreviewModal
        entry={previewEntry}
        allFiles={filteredFiles}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onImportFile={handleImportSingleFile}
        isImporting={processingFiles}
      />

      {/* Compact Folder Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FolderOpen className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span>{status.folderName || "Health Folder"}</span>
              {status.hasPermission ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 text-success border-success/30 bg-success/5"
                >
                  Connected ✓
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5"
                >
                  Needs Permission
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {status.hasPermission ? (
                <>
                  {status.supportedCount} supported health files
                  {status.newCount > 0 && (
                    <span className="font-semibold text-primary ml-1.5">
                      ({status.newCount} new)
                    </span>
                  )}
                </>
              ) : (
                "Permission expired. Reconnect to access files."
              )}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {status.hasPermission ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingFiles(!viewingFiles)}
                className="text-xs h-7 px-2.5 gap-1"
                aria-label="View connected health files"
              >
                <FileText className="size-3.5" />
                <span>{viewingFiles ? "Hide files" : "View files"}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="text-xs h-7 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
                title="Scan and refresh folder contents"
                aria-label="Scan and refresh folder contents"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                <span>{loading ? "Scanning..." : "Refresh"}</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReconnect}
              disabled={loading}
              className="text-xs h-7 px-2.5 gap-1 text-primary border-primary/30"
              aria-label="Reconnect health folder"
            >
              <RefreshCw className="size-3.5" /> Reconnect
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDisconnect}
            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Disconnect folder"
            aria-label="Disconnect folder"
          >
            <Unlink className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expandable File List & Inspection Panel */}
      {viewingFiles && status.hasPermission && (
        <div className="border-t pt-3 space-y-3 animate-in fade-in duration-150">
          {/* Header Controls: Search & Select All */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter by filename…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs pl-8 pr-2"
                />
              </div>

              <Button
                type="button"
                variant={onlySupported ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlySupported(!onlySupported)}
                className="text-[11px] h-7 px-2 gap-1"
                title="Toggle supported files only"
              >
                <Filter className="size-3" />
                <span>Supported only</span>
              </Button>
            </div>

            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="text-[11px] text-primary hover:underline font-medium shrink-0"
            >
              {paginatedFiles
                .filter((f) => f.isSupported)
                .every((f) => selectedFilenames.includes(f.name))
                ? "Deselect visible"
                : "Select visible"}
            </button>
          </div>

          {filteredFiles.length === 0 ? (
            <p className="text-muted-foreground text-[11px] py-4 text-center">
              {searchQuery
                ? `No files matching "${searchQuery}"`
                : "No files found in this folder."}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 divide-y divide-border/20">
              {paginatedFiles.map((file) => {
                const isSelected = selectedFilenames.includes(file.name);
                return (
                  <div
                    key={file.name}
                    onClick={(e) => handleOpenFilePreview(file, e)}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/60 border border-transparent"
                    }`}
                  >
                    {/* Left: Checkbox + Thumbnail + Filename */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => toggleSelectFile(file.name, e)}
                        disabled={!file.isSupported}
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-0.5"
                        title={isSelected ? "Deselect" : "Select for import"}
                        aria-label={`Select ${file.name}`}
                      >
                        {file.isSupported ? (
                          isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )
                        ) : (
                          <Square className="size-4 text-muted-foreground/30 cursor-not-allowed" />
                        )}
                      </button>

                      {/* Lazy Thumbnail */}
                      <FileThumbnail entry={file} className="size-7" />

                      {/* Filename & Type */}
                      <div className="min-w-0 flex-1">
                        <span
                          className="font-medium text-foreground text-xs truncate block group-hover:text-primary transition-colors"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {file.type || "Document"} · {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>

                    {/* Right: Badges & Preview Action Icon */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {file.isNew && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 text-primary border-primary/30 bg-primary/10"
                        >
                          New
                        </Badge>
                      )}
                      {file.isChanged && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 text-amber-500 border-amber-500/30"
                        >
                          Changed
                        </Badge>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleOpenFilePreview(file, e)}
                        className="size-7 text-muted-foreground group-hover:text-foreground"
                        title="Preview file"
                        aria-label={`Preview ${file.name}`}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls for Large Folders */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t text-[11px] text-muted-foreground">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length}{" "}
                files
              </span>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="size-6"
                  title="Previous page"
                >
                  <ChevronLeft className="size-3" />
                </Button>
                <span className="font-mono text-[10px] px-1">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="size-6"
                  title="Next page"
                >
                  <ChevronRight className="size-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Footer: Batch Import Selected */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <span className="text-[11px] text-muted-foreground">
              {selectedFilenames.length} file{selectedFilenames.length === 1 ? "" : "s"} selected
            </span>

            <Button
              type="button"
              size="sm"
              disabled={selectedFilenames.length === 0 || processingFiles}
              onClick={handleImportSelected}
              className="text-xs h-8 px-3.5 gap-1.5 font-medium shadow-xs"
            >
              {processingFiles ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <FileCheck className="size-3.5" /> Import Selected →
                </>
              )}
            </Button>
          </div>

          {processingProgress && (
            <p className="text-[11px] text-primary italic font-medium pt-1">{processingProgress}</p>
          )}
        </div>
      )}
    </div>
  );
}
