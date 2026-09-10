import { useEffect, useRef, useState, useCallback } from "react";

export interface SpeechLanguage {
  code: string;
  label: string;
  name: string;
}

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguage[] = [
  { code: "en-IN", label: "English", name: "English" },
  { code: "ta-IN", label: "தமிழ்", name: "தமிழ் (Tamil)" },
  { code: "hi-IN", label: "हिन्दी", name: "हिन्दी (Hindi)" },
];

export function detectSpeechLanguage(rawText: string, fallbackLanguage = "en-IN") {
  const text = (rawText || "").trim();

  if (!text) return fallbackLanguage;
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";

  return fallbackLanguage || "en-IN";
}

/**
 * Health-specific semantic improvements for speech transcripts.
 * Standardizes common health patterns while preserving meaning.
 */
function applyHealthSemanticImprovements(text: string): string {
  let improved = text;

  // Standardize common health phrases
  // "i/I (had|drank|consumed|took|had some)" + numbers + "glasses/cups of water" → "drank X glasses of water"
  improved = improved.replace(
    /\b(?:had|drank|consumed|took|i had|i drank)\s+(?:some\s+)?(\d+(?:\s*(?:to|-)\s*\d+)?)\s*(?:glasses|cups|gl?|g)\s+(?:of\s+)?water\b/gi,
    "drank $1 glasses of water",
  );

  // "slept X hours" / "sleep X" standardization
  improved = improved.replace(
    /\b(?:slept|sleep|got|had)\s+(?:around\s+|about\s+)?(\d+(?:\.\d)?\s*(?:to|-)\s*\d+(?:\.\d)?|\d+(?:\.\d)?)\s*hours?\s+(?:of\s+)?sleep\b/gi,
    "slept $1 hours",
  );

  // "walked/ran/exercised X minutes" standardization
  improved = improved.replace(
    /\b(?:walked|ran|exercised|did)\s+(?:for\s+|about\s+)?(\d+)\s*(?:minutes|mins|min)\b/gi,
    "exercised $1 minutes",
  );

  // "Blood pressure/BP X/Y" standardization
  improved = improved.replace(
    /\b(?:blood\s+)?pressure|bp\s+(\d+)\s*(?:over|\/)\s*(\d+)\b/gi,
    "blood pressure $1/$2",
  );

  // Common sentiment → wellbeing mapping
  improved = improved.replace(
    /\b(?:feeling\s+)?(?:great|wonderful|excellent|very\s+good)\b/gi,
    "feeling great",
  );
  improved = improved.replace(/\b(?:feeling\s+)?(?:pretty\s+good|good)\b/gi, "feeling good");
  improved = improved.replace(/\b(?:feeling\s+)?(?:okay|ok|alright|fine)\b/gi, "feeling okay");
  improved = improved.replace(/\b(?:feeling\s+)?(?:tired|fatigued|exhausted)\b/gi, "feeling tired");
  improved = improved.replace(
    /\b(?:feeling\s+)?(?:bad|terrible|awful|unwell|sick)\b/gi,
    "feeling not great",
  );

  // "Didn't eat/Had no food" → consistent phrasing
  improved = improved.replace(/\b(?:didn't|did not|no)\s+(?:eat|have|food)\b/gi, "skipped meals");

  // "Ate well/poorly" → consistent phrasing
  improved = improved.replace(
    /\b(?:ate|had)\s+(?:a\s+)?(?:good|healthy)\s+(?:meal|food)\b/gi,
    "ate well",
  );
  improved = improved.replace(
    /\b(?:ate|had)\s+(?:a\s+)?(?:poor|bad|unhealthy)\s+(?:meal|food)\b/gi,
    "ate poorly",
  );

  // "Symptom X" → consistent mention
  improved = improved.replace(
    /\b(?:experienced|had|felt)\s+(.+?)\b(?:symptom|issue|problem)\b/gi,
    "symptom $1",
  );

  // Remove redundant phrases
  improved = improved.replace(/\b(?:also|additionally|furthermore)\s+(?:i\s+)?/gi, "");
  improved = improved.replace(/\bthat's?\s+(?:it|all|everything)\s*\.?\s*$/gi, ".");

  return improved;
}

export function normalizeSpeechTranscript(rawText: string, preferredLanguage = "en-IN") {
  const text = (rawText || "").trim();
  if (!text) return "";

  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\b(um|uh|ah|like|you know|kind of|sort of|actually)\b/gi, "")
    .replace(/\s+([,.?!:;])/g, "$1")
    .replace(/([,.?!:;])(?=(?:[A-Za-z]|[\u0B80-\u0BFF]|[\u0900-\u097F]))/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return "";

  const normalizedLanguage = detectSpeechLanguage(cleaned, preferredLanguage);
  if (normalizedLanguage !== preferredLanguage && normalizedLanguage !== "en-IN") {
    return cleaned;
  }

  // Apply health-specific semantic improvements based on language
  let result = cleaned;
  if (preferredLanguage.startsWith("ta") || normalizedLanguage.startsWith("ta")) {
    result = result
      .replace(/\biniku\b|\bindru\b/gi, "இன்று")
      .replace(/\bhours?\b|\bhrs?\b/gi, "மணி நேரம்")
      .replace(/\bthoonginen\b|\bthoongina\b|\bslept\b/gi, "தூங்கினேன்")
      .replace(/\bthookam\b/gi, "தூக்கம்")
      .replace(/\bthanni\b|\bthanneer\b/gi, "தண்ணீர்")
      .replace(/\bkudichen\b|\bkudithen\b/gi, "குடித்தேன்")
      .replace(/\bwalk\s*paninen\b|\bnadanthen\b/gi, "நடைப்பயிற்சி செய்தேன்")
      .replace(/\bmins?\b|\bminutes?\b/gi, "நிமிடம்")
      .replace(/\bromba\b/gi, "மிகவும்")
      .replace(/\btired-?ah\s*iruku\b|\bsorva\s*iruku\b/gi, "சோர்வாக உணர்கிறேன்")
      .replace(/\bnalla\s*iruken\b/gi, "நன்றாக உணர்கிறேன்")
      .replace(/\bthalavali\b/gi, "தலைவலி")
      .replace(/\bkaichal\b/gi, "காய்ச்சல்");
  } else {
    result = result
      .replace(/\biniku\b|\bindru\b|இன்று/gi, "Today")
      .replace(/\bmani\s*neram\s*thoonginen\b|\bhours\s*thoonginen\b|மணி\s*நேரம்\s*தூங்கினேன்/gi, "hours of sleep")
      .replace(/\bthoonginen\b|\bthoongina\b|தூங்கினேன்/gi, "slept")
      .replace(/\bthookam\b|தூக்கம்/gi, "sleep")
      .replace(/\bthanni\b|\bthanneer\b|தண்ணீர்/gi, "water")
      .replace(/\bkudichen\b|\bkudithen\b|குடித்தேன்/gi, "drank")
      .replace(/\bwalk\s*paninen\b|\bnadanthen\b|நடந்தேன்/gi, "walked")
      .replace(/\bnimisham\b|\bnimudam\b|நிமிடம்/gi, "minutes")
      .replace(/\btired-?ah\s*iruku\b|\bsorva\s*iruku\b|சோர்வாக/gi, "feeling tired")
      .replace(/\bnalla\s*iruken\b|நன்றாக/gi, "feeling good");
    result = applyHealthSemanticImprovements(result);
  }

  // Fix capitalization after improvements
  result = result.replace(
    /(^|[.!?]\s+)((?:[a-z]|[\u0B80-\u0BFF]|[\u0900-\u097F]))/gi,
    (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`,
  );

  return result;
}

export async function improveTranscriptWithLanguage(
  text: string,
  targetLanguage = "en",
): Promise<string> {
  const clean = text.trim();
  if (!clean) return "";
  try {
    const res = await fetch("/api/ai/improve-transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, language: targetLanguage }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && typeof data.improvedText === "string") {
        return data.improvedText;
      }
    }
  } catch {
    // Fall back to local normalizeSpeechTranscript below
  }
  return normalizeSpeechTranscript(clean, targetLanguage);
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  language: string;
  setLanguage: (lang: string) => void;
  setTranscript: (text: string) => void;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string; confidence: number };
    };
  };
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("en-IN");

  const shouldKeepListeningRef = useRef(false);
  const baseTranscriptRef = useRef("");
  const isListeningRef = shouldKeepListeningRef;

  const updateLanguageFromText = useCallback(
    (rawText: string) => {
      const detected = detectSpeechLanguage(rawText, language);
      if (detected !== language) {
        setLanguage(detected);
      }
    },
    [language],
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const networkErrorRetryCountRef = useRef(0);

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as WindowWithSpeech).SpeechRecognition ||
      (window as unknown as WindowWithSpeech).webkitSpeechRecognition,
    );

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error if already stopped
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    isListeningRef.current = false;
    stopListening();
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    networkErrorRetryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [stopListening]);

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript("");
    networkErrorRetryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (!isSupported) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    try {
      const win = window as unknown as WindowWithSpeech;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        setError("Voice input is not supported in this browser.");
        return;
      }
      const instance: SpeechRecognitionInstance = new SpeechRecognitionClass();

      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = language;

      instance.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setError(null);
      };

      instance.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let interimChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result) {
            if (result.isFinal && result[0]) {
              finalChunk += result[0].transcript + " ";
            } else if (result[0]) {
              interimChunk += result[0].transcript;
            }
          }
        }

        if (finalChunk) {
          const cleanedFinal = normalizeSpeechTranscript(finalChunk, language);
          updateLanguageFromText(cleanedFinal);
          setTranscript((prev) => {
            const merged = prev ? `${prev.trim()} ${cleanedFinal}`.trim() : cleanedFinal;
            return normalizeSpeechTranscript(merged, language);
          });
        }

        const cleanedInterim = normalizeSpeechTranscript(interimChunk, language);
        if (cleanedInterim) {
          updateLanguageFromText(cleanedInterim);
        }
        setInterimTranscript(cleanedInterim);
      };

      instance.onerror = (event: { error: string; message?: string }) => {
        if (event.error === "no-speech") {
          // No-speech event is common in pauses; if user is still recording, keep going without throwing fatal error
          if (isListeningRef.current) {
            return;
          }
          setError("No speech was detected. Please try again or type naturally.");
        } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          isListeningRef.current = false;
          setError(
            "Microphone permission was denied. Please allow microphone access or type naturally.",
          );
        } else if (event.error === "network") {
          if (networkErrorRetryCountRef.current < 3) {
            setError("Speech service reconnecting...");
            networkErrorRetryCountRef.current += 1;
            retryTimeoutRef.current = window.setTimeout(
              () => {
                if (isListeningRef.current) {
                  try {
                    instance.start();
                  } catch {
                    // Ignore start error
                  }
                }
              },
              1000 + networkErrorRetryCountRef.current * 500,
            );
            return;
          } else {
            isListeningRef.current = false;
            setError(
              "Speech recognition service is unavailable. You can type naturally or use Quick Check-in.",
            );
          }
        } else {
          isListeningRef.current = false;
          setError(`Voice input error: ${event.error}. You can type naturally instead.`);
        }
        setIsListening(false);
      };

      instance.onend = () => {
        // Continuous extended recording: if listening is still requested, automatically restart recognition!
        if (isListeningRef.current) {
          try {
            instance.start();
            return;
          } catch {
            // Already started or restarting
          }
        }
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = instance;
      isListeningRef.current = true;
      instance.start();
    } catch {
      isListeningRef.current = false;
      setError(
        "Could not start speech recognition. Please check microphone permissions or type naturally.",
      );
      setIsListening(false);
    }
  }, [isSupported, language, updateLanguageFromText]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort on cleanup
        }
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    language,
    setLanguage,
    setTranscript,
    startListening,
    stopListening,
    reset,
  };
}
