import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Plus,
  Mic,
  ArrowUp,
  FolderPlus,
  Upload,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VoiceRecorderWaveform } from "@/features/checkin/VoiceRecorderWaveform";
import {
  isFileSystemAccessSupported,
  saveFolderHandle,
} from "@/services/localStorage/folderAccess";
import { toast } from "sonner";

import { useTranslation } from "@/locales/i18n";

interface UnifiedCheckinComposerProps {
  onTextSubmit: (text: string) => void;
  onVoiceTranscriptReady: (transcript: string, language: string) => void;
  onFileSelect: (file: File) => void;
  onOpenDetailed?: () => void;
  onFolderConnected?: () => void;
  extracting: boolean;
}

const LOCALIZED_PLACEHOLDERS: Record<string, string[]> = {
  en: [
    "Type your health update (e.g., Slept 7 hours, drank 6 glasses of water, walked 30 min)...",
    "Tell us what changed today...",
    "Log your sleep, water, exercise, or symptoms...",
    "Describe your day naturally in English or your preferred language...",
  ],
  ta: [
    "உங்கள் இன்றைய உடல்நிலை அல்லது மாற்றத்தை எழுதுங்கள்...",
    "இன்றைய தூக்கம், தண்ணீர், உடற்பயிற்சி அல்லது அறிகுறிகளைப் பதிவு செய்க...",
    "உங்கள் நாளை தமிழில் இயல்பாக விவரிக்கவும்...",
  ],
  hi: [
    "आज की स्वास्थ्य जानकारी या बदलाव लिखें...",
    "नींद, पानी, व्यायाम या लक्षणों की जानकारी लिखें...",
    "अपने दिन की स्थिति हिन्दी में सामान्य रूप से लिखें...",
  ],
};

export function UnifiedCheckinComposer({
  onTextSubmit,
  onVoiceTranscriptReady,
  onFileSelect,
  onOpenDetailed,
  onFolderConnected,
  extracting,
}: UnifiedCheckinComposerProps) {
  const { language, t } = useTranslation();
  const [inputText, setInputText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activePlaceholders = LOCALIZED_PLACEHOLDERS[language] || LOCALIZED_PLACEHOLDERS.en;

  // Rotate placeholders subtly every 6 seconds when input is empty
  useEffect(() => {
    if (inputText.trim()) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % activePlaceholders.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [inputText, activePlaceholders.length]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || extracting) return;
    onTextSubmit(clean);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle Connect Health Folder action
  const handleConnectFolder = async () => {
    if (!isFileSystemAccessSupported()) {
      toast.info(
        "Connected folders are not supported in this browser. You can use 'Add from device' instead.",
      );
      fileInputRef.current?.click();
      return;
    }

    try {
      // @ts-expect-error window.showDirectoryPicker supported in Chromium browsers
      const handle = await window.showDirectoryPicker({
        id: "healthguardian-folder",
        mode: "read",
      });

      await saveFolderHandle(handle);
      toast.success(`Connected health folder: ${handle.name}`);
      if (onFolderConnected) onFolderConnected();
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name !== "AbortError") {
        console.warn("Folder picker error:", err);
        toast.error("Failed to connect folder. Please try again.");
      }
    }
  };

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0]) {
      onFileSelect(files[0]);
    }
    // reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Hidden file input fallback */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        aria-hidden="true"
      />

      {/* Voice Recording Active Mode (WhatsApp-style) */}
      {isRecordingVoice ? (
        <VoiceRecorderWaveform
          onTranscriptReady={(transcript, lang) => {
            setIsRecordingVoice(false);
            onVoiceTranscriptReady(transcript, lang);
          }}
          onCancel={() => setIsRecordingVoice(false)}
        />
      ) : (
        /* Default State: Single Compact Composer Bar */
        <div className="relative rounded-2xl border bg-card/90 backdrop-blur-md p-2 shadow-xs hover:border-primary/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Expandable Action Menu (+) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
                  aria-label="Check-in options and file attachment"
                >
                  <Plus className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 text-xs">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Capture Options
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setIsRecordingVoice(true)} className="gap-2.5 py-2 cursor-pointer">
                  <Mic className="size-4 text-primary" />
                  <div>
                    <span className="font-medium block">Voice Check-in</span>
                    <span className="text-[10px] text-muted-foreground">
                      Multilingual voice dictation (up to 5m)
                    </span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleConnectFolder}
                  className="gap-2.5 py-2 cursor-pointer"
                >
                  <FolderPlus className="size-4 text-primary" />
                  <div>
                    <span className="font-medium block">Connect health folder</span>
                    <span className="text-[10px] text-muted-foreground">
                      Persistent local files
                    </span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2.5 py-2 cursor-pointer"
                >
                  <Upload className="size-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium block">Add from device</span>
                    <span className="text-[10px] text-muted-foreground">Upload PDF or photo</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Natural Language Text Input / Textarea */}
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activePlaceholders[placeholderIndex] || activePlaceholders[0]}
                disabled={extracting}
                className="w-full bg-transparent border-0 resize-none py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
                aria-label="Health check-in message"
              />
            </div>

            {/* Direct Microphone Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsRecordingVoice(true)}
              disabled={extracting}
              className="size-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
              title="Start voice check-in"
              aria-label="Start voice check-in"
            >
              <Mic className="size-4" />
            </Button>

            {/* Submit / Extract Button */}
            <Button
              type="submit"
              size="icon"
              disabled={!inputText.trim() || extracting}
              className="size-9 rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 shrink-0 disabled:opacity-30 transition-all"
              aria-label="Extract health update"
            >
              {extracting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
