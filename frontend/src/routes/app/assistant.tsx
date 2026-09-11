import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Compass,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Disclaimer } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUid } from "@/features/auth/useAuth";
import {
  deterministicEmergencyResponse,
  runAgent,
  type AgentOutcome,
  type PendingAction,
} from "@/features/agent/agent";
import { TOOL_MAP } from "@/features/agent/tools";
import { addMessage, createSession, updateSession } from "@/services/firebase/repositories";
import { useAppStore } from "@/store/app";
import { ContextualHelp } from "@/features/guide/ContextualHelp";
import { MarkdownContent } from "@/features/agent/MarkdownContent";
import { SourceCardList } from "@/features/agent/SourceCardList";
import { SafeActivityPanel } from "@/features/agent/SafeActivityPanel";
import { ChatComposer } from "@/features/agent/ChatComposer";
import { useTranslation } from "@/locales/i18n";

export const Route = createFileRoute("/app/assistant")({
  component: Assistant,
  head: () => ({
    meta: [
      { title: "AI Assistant — HealthGuardian AI" },
      {
        name: "description",
        content:
          "Conversational health assistant grounded in your own records and evidence-based public guidelines.",
      },
      { property: "og:title", content: "HealthGuardian AI Assistant" },
      {
        property: "og:description",
        content: "Grounded conversational health assistant with verified web search.",
      },
    ],
  }),
});

interface Bubble {
  role: "user" | "assistant";
  content: string;
  outcome?: AgentOutcome | undefined;
  timestamp?: Date;
}

function getStarterPrompts(t: (key: string) => string) {
  return [
    {
      icon: "📊",
      label: t("assistant.starterPrompts.weeklyOverview.label"),
      prompt: t("assistant.starterPrompts.weeklyOverview.prompt"),
    },
    {
      icon: "🌙",
      label: t("assistant.starterPrompts.sleepTrends.label"),
      prompt: t("assistant.starterPrompts.sleepTrends.prompt"),
    },
    {
      icon: "📋",
      label: t("assistant.starterPrompts.medicalReports.label"),
      prompt: t("assistant.starterPrompts.medicalReports.prompt"),
    },
    {
      icon: "🎯",
      label: t("assistant.starterPrompts.activeGoals.label"),
      prompt: t("assistant.starterPrompts.activeGoals.prompt"),
    },
    {
      icon: "🌐",
      label: t("assistant.starterPrompts.activityGuidelines.label"),
      prompt: t("assistant.starterPrompts.activityGuidelines.prompt"),
      enableWebSearch: true,
    },
    {
      icon: "💧",
      label: t("assistant.starterPrompts.hydrationAdvice.label"),
      prompt: t("assistant.starterPrompts.hydrationAdvice.prompt"),
      enableWebSearch: true,
    },
  ];
}

function Assistant() {
  const uid = useUid();
  const online = useAppStore((s) => s.online);
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("Thinking…");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (textToSend?: string, searchActiveOverride?: boolean) => {
    const text = (textToSend ?? input).trim();
    if (!text || !uid || busy) return;
    const isSearchActive = searchActiveOverride ?? webSearchEnabled;

    setInput("");
    setPending(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: text, timestamp: new Date() }]);
    setBusy(true);

    // Dynamic loading phase indicator
    setLoadingPhase(
      isSearchActive
        ? t("assistant.searchingWeb") || "Searching verified medical guidelines…"
        : t("assistant.analyzingRecords") || "Analyzing your health records…",
    );

    try {
      const emergency = Boolean(deterministicEmergencyResponse(text, undefined, language));
      let sid = sessionId;
      if (!emergency) {
        if (!sid) {
          sid = await createSession(uid, {
            title: text.slice(0, 60),
            userIntent: "general_conversation",
            status: "active",
          });
          setSessionId(sid);
        }
        await addMessage(uid, sid, { role: "user", content: text });
      }

      const outcome = await runAgent({
        uid,
        message: text,
        history,
        webSearchEnabled: isSearchActive,
        language,
      });

      setMessages((m) => [
        ...m,
        { role: "assistant", content: outcome.reply, outcome, timestamp: new Date() },
      ]);
      setPending(outcome.pendingAction);

      if (!emergency && sid) {
        await addMessage(uid, sid, {
          role: "assistant",
          content: outcome.reply,
          relatedRecordIds: outcome.relatedRecordIds,
        });
        await updateSession(uid, sid, { userIntent: outcome.intent, lastActivityAt: new Date() });
      }

      if (!outcome.aiAvailable) {
        toast.warning(
          t("assistant.fallbackWarning") ||
            "The AI provider was temporarily unavailable, so I answered using your stored records and deterministic rules.",
        );
      }
    } catch {
      toast.error(
        t("assistant.generalError") ||
          "The assistant could not complete that request right now. Please try again.",
      );
    } finally {
      setBusy(false);
      setLoadingPhase(t("assistant.thinking") || "Thinking…");
    }
  };

  const confirmPending = async () => {
    if (!uid || !pending) return;
    const tool = TOOL_MAP.get(pending.tool);
    if (!tool) return;
    setBusy(true);
    try {
      const result = await tool.run({ uid }, pending.args);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: result.ok ? `Done — ${result.summary}` : `I couldn't do that: ${result.summary}`,
          timestamp: new Date(),
        },
      ]);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectStarter = (starter: ReturnType<typeof getStarterPrompts>[number]) => {
    if (starter.enableWebSearch) {
      setWebSearchEnabled(true);
    }
    void send(starter.prompt, starter.enableWebSearch);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPending(null);
    setSessionId(null);
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-between">
      {/* Top Header */}
      <div className="mx-auto w-full max-w-3xl px-2 sm:px-4 pt-1 pb-3">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                HealthGuardian AI
              </h1>
              <Badge
                variant="outline"
                className="gap-1 text-[10px] font-semibold text-primary border-primary/30 bg-primary/5"
              >
                <Sparkles className="size-2.5" /> {t("assistant.controlledAgentic")}
              </Badge>
              <ContextualHelp content={t("assistant.groundedContextHelp")} />
            </div>
            <p className="text-xs text-muted-foreground">{t("assistant.subtitle")}</p>
          </div>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1"
            >
              <RefreshCw className="size-3" /> {t("assistant.newChat") || "New chat"}
            </Button>
          )}
        </div>
      </div>

      {/* Main Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Empty State: Welcoming Screen with Starter Prompts */}
          {messages.length === 0 && (
            <div className="my-auto py-6 sm:py-12 space-y-5">
              <div className="text-center space-y-2 max-w-md mx-auto">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                  <Bot className="size-6" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("assistant.welcomeHeading")}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("assistant.welcomeSubtext")}
                </p>
              </div>

              {/* Starter Chips: Swipeable Carousel on Mobile, Grid on Desktop */}
              <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-2.5 -mx-2 px-2 pb-2 sm:grid sm:grid-cols-2 sm:mx-0 sm:px-0 sm:pb-0 pt-2">
                {getStarterPrompts(t).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectStarter(item)}
                    className="touch-press flex w-[78vw] max-w-[290px] shrink-0 snap-center sm:w-auto items-start gap-3 rounded-2xl border bg-card/70 p-3.5 text-left shadow-xs hover:border-primary/50 hover:bg-card transition-all cursor-pointer group"
                  >
                    <span className="text-xl shrink-0 pt-0.5">{item.icon}</span>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 justify-between">
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </span>
                        {item.enableWebSearch && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5">
                            <Globe className="size-2" /> Web
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Bubbles */}
          {messages.map((m, i) => (
            <div key={i} className="space-y-2">
              {m.role === "user" ? (
                /* User Message Bubble */
                <div className="flex justify-end gap-2.5 pl-8 sm:pl-16">
                  <div className="rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-xs max-w-full">
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                  <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                </div>
              ) : (
                /* Assistant Message Bubble */
                <div className="flex justify-start gap-3 pr-4 sm:pr-12">
                  <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    <Bot className="size-4 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0 rounded-2xl rounded-tl-xs border bg-card/90 px-4 py-3.5 shadow-xs text-sm">
                    {/* Render Clean Markdown Response */}
                    <MarkdownContent content={m.content} />

                    {/* Sources Citation List (if web search was used) */}
                    {m.outcome?.sources && m.outcome.sources.length > 0 && (
                      <SourceCardList sources={m.outcome.sources} />
                    )}

                    {/* Compact Developer/Transparency Activity Panel */}
                    {m.outcome && <SafeActivityPanel outcome={m.outcome} />}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Dynamic Loading State */}
          {busy && (
            <div className="flex justify-start gap-3 pr-12">
              <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-xs border bg-card/80 px-4 py-3 text-xs text-muted-foreground shadow-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="font-medium">{loadingPhase}</span>
              </div>
            </div>
          )}

          {/* Pending Action Confirmation Card */}
          {pending && (
            <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    Action Requires Confirmation
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pending.description ||
                      "The assistant wants to perform an authorized action on your account."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-primary/10">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPending(null)}
                  disabled={busy}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void confirmPending()}
                  disabled={busy}
                  className="text-xs h-7 gap-1"
                >
                  <CheckCircle2 className="size-3" /> Yes, proceed
                </Button>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Quick Suggestion Chips on mobile & desktop */}
      {messages.length > 0 && !busy && (
        <div className="mx-auto w-full max-w-3xl px-2 sm:px-4">
          <div className="flex items-center gap-1.5 overflow-x-auto snap-x no-scrollbar py-1">
            {getStarterPrompts(t)
              .slice(0, 4)
              .map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectStarter(item)}
                  className="touch-press inline-flex shrink-0 snap-start items-center gap-1 rounded-full border bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Chat Composer */}
      <ChatComposer
        input={input}
        setInput={setInput}
        onSend={(txt) => void send(txt)}
        busy={busy}
        online={online}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
      />
    </div>
  );
}
