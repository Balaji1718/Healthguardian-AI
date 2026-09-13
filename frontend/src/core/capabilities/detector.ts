import type { AppCapabilities, NotificationCapabilityState } from "./types";

/**
 * Pure, safe capability detection functions for HealthGuardian AI.
 * Never throws exceptions in SSR or restricted browser environments.
 */

export function detectIsMobileOrTablet(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua) || isIpadOS;
}

export function detectDirectCameraCapture(): boolean {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  // capture="environment" only opens the camera viewfinder on mobile/tablet platforms.
  // Desktop browsers (Windows, macOS, Linux) ignore capture and open the standard file chooser.
  const isMobileOrTablet = detectIsMobileOrTablet();
  const supportsCaptureAttr = "capture" in document.createElement("input");
  return isMobileOrTablet && supportsCaptureAttr;
}

export function detectCameraStreaming(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function",
  );
}

export function detectSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function detectSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function detectFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function detectIndexedDbSupport(): boolean {
  try {
    return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

export function detectIsIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isOtherIosBrowser = /CriOS|FxiOS|OPiOS|EdgiOS|mercury/i.test(ua);
  return isIos && !isOtherIosBrowser;
}

export function detectIsStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMatch = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const navStandalone = (navigator as unknown as { standalone?: boolean })?.standalone === true;
  return isStandaloneMatch || navStandalone;
}

export function detectCanWebPush(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function detectNotificationState(hasFcmToken = false): NotificationCapabilityState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  const permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission === "default") return "default";
  if (permission === "granted") {
    return hasFcmToken ? "fcm_active" : "granted_local";
  }

  return "unsupported";
}

export function detectCanWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function detectCanClipboardCopy(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);
}

export function detectTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const matchesCoarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return hasTouchPoints || matchesCoarse;
}

export function detectFinePointer(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(pointer: fine)")?.matches ?? true;
}

/**
 * Snapshot all current capabilities for the active environment.
 */
export function probeCapabilities(hasFcmToken = false): AppCapabilities {
  return {
    canDirectCameraCapture: detectDirectCameraCapture(),
    canStreamCamera: detectCameraStreaming(),
    canSpeechRecognize: detectSpeechRecognition(),
    canSpeechSynthesize: detectSpeechSynthesis(),
    canAccessFileSystem: detectFileSystemAccess(),
    hasIndexedDb: detectIndexedDbSupport(),
    notificationState: detectNotificationState(hasFcmToken),
    canWebPush: detectCanWebPush(),
    isIosSafari: detectIsIosSafari(),
    isStandalonePwa: detectIsStandalonePwa(),
    canWebShare: detectCanWebShare(),
    canClipboardCopy: detectCanClipboardCopy(),
    isTouchDevice: detectTouchDevice(),
    hasFinePointer: detectFinePointer(),
  };
}
