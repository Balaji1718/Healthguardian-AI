import {
  createNotification,
  listNotifications,
  updateNotification,
} from "@/services/firebase/repositories";
import type { AppNotification } from "@/models";
import type { DetectedPattern } from "@/features/healthRisk/engine";

/**
 * Notification strategy (free-tier, no Cloud Functions):
 * - in-app notification centre (always works)
 * - browser Notification API when the user grants permission
 * - event-driven: created when the app detects something while it is open
 *
 * TODO (limitation): true server-pushed background notifications need FCM +
 * a server to send them. Without paid/always-on infrastructure the app does
 * NOT claim 24/7 monitoring; reminders surface in-app and when the app is open.
 */

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

const APP_NOTIFICATION_ICON = "/pwa-192.png";

export async function showBrowserNotification(title: string, body: string): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;

  // 1. Try Service Worker showNotification (works on mobile Chrome, Android PWA, modern mobile browsers)
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          body,
          icon: APP_NOTIFICATION_ICON,
          badge: APP_NOTIFICATION_ICON,
          vibrate: [200, 100, 200],
          tag: "healthguardian-alert",
          data: { url: "/app/notifications" },
        });
        return true;
      }
    } catch {
      // Fall through to Desktop Notification constructor
    }
  }

  // 2. Desktop Notification API fallback
  try {
    const notif = new Notification(title, {
      body,
      icon: APP_NOTIFICATION_ICON,
      tag: "healthguardian-alert",
    });
    notif.onclick = () => {
      window.focus();
      if (window.location.pathname !== "/app/notifications") {
        window.location.href = "/app/notifications";
      }
    };
    return true;
  } catch {
    return false;
  }
}

export async function pushNotification(
  uid: string,
  n: Omit<AppNotification, "status"> & { status?: AppNotification["status"] },
) {
  const delivered = await showBrowserNotification(n.title, n.message);
  return createNotification(uid, {
    ...n,
    status: delivered ? "delivered" : (n.status ?? "pending"),
    ...(delivered ? { deliveredAt: new Date() } : {}),
  } as AppNotification);
}

export async function sendTestNotification(uid: string, lang = "en"): Promise<boolean> {
  const titles: Record<string, string> = {
    en: "HealthGuardian AI Notification Test",
    ta: "HealthGuardian AI அறிவிப்பு சோதனை",
    hi: "HealthGuardian AI अधिसूचना परीक्षण",
  };
  const bodies: Record<string, string> = {
    en: "Notifications are working properly on this device. You will receive health reminders and trend insights here.",
    ta: "இந்தச் சாதனத்தில் அறிவிப்புகள் சரியாகச் செயல்படுகின்றன. உங்கள் சுகாதார நினைவூட்டல்கள் இங்கே தோன்றும்.",
    hi: "इस डिवाइस पर सूचनाएं ठीक से काम कर रही हैं। आपको स्वास्थ्य अनुस्मारक यहां प्राप्त होंगे।",
  };

  const title = titles[lang] || titles.en;
  const message = bodies[lang] || bodies.en;

  const delivered = await showBrowserNotification(title, message);
  if (uid) {
    await createNotification(uid, {
      type: "reminder",
      category: "lifestyle",
      title,
      message,
      priority: "low",
      status: delivered ? "delivered" : "pending",
      ...(delivered ? { deliveredAt: new Date() } : {}),
    } as AppNotification);
  }
  return delivered;
}

export function scheduleDelayedNotification(
  uid: string,
  delaySeconds = 5,
  lang = "en",
  onDelivered?: (delivered: boolean) => void,
): void {
  setTimeout(async () => {
    const delivered = await sendTestNotification(uid, lang);
    onDelivered?.(delivered);
  }, delaySeconds * 1000);
}

const DEDUPE_KEY = "hg_pattern_alerts";

/** Context-aware alerts, deduplicated per day so we never spam the user. */
export async function syncPatternNotifications(uid: string, patterns: DetectedPattern[]) {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  let seen: Record<string, string> = {};
  try {
    seen = JSON.parse(window.localStorage.getItem(DEDUPE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    seen = {};
  }
  for (const p of patterns.filter((x) => x.severity >= 1)) {
    const key = `${uid}:${p.factor}`;
    if (seen[key] === today) continue;
    seen[key] = today;
    await pushNotification(uid, {
      type: "pattern_alert",
      category: p.category,
      title: "Something in your health data may need attention",
      message: "Open HealthGuardian to review the pattern we noticed in your recent entries.",
      priority: p.severity === 2 ? "high" : "medium",
    });
  }
  window.localStorage.setItem(DEDUPE_KEY, JSON.stringify(seen));
}

export async function markRead(uid: string, id: string) {
  await updateNotification(uid, id, { status: "read" });
}

export async function dismiss(uid: string, id: string) {
  await updateNotification(uid, id, { status: "dismissed" });
}

export const loadNotifications = listNotifications;
