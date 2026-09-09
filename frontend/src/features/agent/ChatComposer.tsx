import React, { useRef, useEffect } from "react";
import { ArrowUp, FileText, Globe, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/locales/i18n";

interface ChatComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  online: boolean;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (fn: (prev: boolean) => boolean) => void;
  attachedReport?: { id: string; title: string } | null;
  onRemoveAttachment?: () => void;
}

/**
 * Modern, clean chat composer with Web Search toggle and report attachment preview.
 */
export function ChatComposer({
  input,
  setInput,
  onSend,
  busy,
  online,
  webSearchEnabled,
  setWebSearchEnabled,
  attachedReport,
  onRemoveAttachment,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    onSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !busy) {
        onSend(input);
      }
    }
  };

  return (
    <div className="sticky bottom-0 z-10 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-2">
      <div className="mx-auto max-w-3xl px-2 sm:px-4">
        {/* Optional Document Attachment Preview */}
        {attachedReport && (
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs shadow-xs">
              <FileText className="size-3.5 text-primary" />
              <span className="font-medium text-foreground max-w-[200px] truncate">
                {attachedReport.title}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Verified Local OCR ✓
              </Badge>
              {onRemoveAttachment && (
                <button
                  type="button"
                  onClick={onRemoveAttachment}
                  className="text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                  aria-label="Remove document attachment"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Box Card */}
        <form
          onSubmit={handleSubmit}
          className="relative flex flex-col rounded-2xl border bg-card p-2 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
        >
          <Textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!online || busy}
            placeholder={online ? t("assistant.composerPlaceholder") : t("common.offlineNotice")}
            className="min-h-[44px] max-h-36 resize-none border-0 bg-transparent px-3 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:outline-none placeholder:text-muted-foreground/70"
          />

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 px-2 pt-1 border-t border-border/40">
            {/* Left Controls: Web Search Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWebSearchEnabled((prev) => !prev)}
                className={cn(
                  "touch-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer min-h-[36px]",
                  webSearchEnabled
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={
                  webSearchEnabled
                    ? "Web Search is ON (external public health guidelines enabled)"
                    : "Web Search is OFF (private health records only)"
                }
                aria-pressed={webSearchEnabled}
              >
                <Globe
                  className={cn(
                    "size-3.5",
                    webSearchEnabled ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                />
                <span>{t("assistant.webSearch")}</span>
                {webSearchEnabled && (
                  <span className="ml-0.5 size-1.5 rounded-full bg-emerald-300 animate-pulse" />
                )}
              </button>
            </div>

            {/* Right Controls: Send Button */}
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim() || !online}
              className="touch-press size-10 rounded-full shadow-xs shrink-0 flex items-center justify-center"
              aria-label="Send message"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
            </Button>
          </div>
        </form>

        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {t("assistant.disclaimer")}
        </p>
      </div>
    </div>
  );
}
