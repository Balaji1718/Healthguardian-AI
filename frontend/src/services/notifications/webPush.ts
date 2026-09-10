import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseApp } from "@/services/firebase/config";
import { saveDeviceToken } from "@/services/firebase/repositories";

const vapidKey =
  (import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string | undefined) ||
  "BJxNK47Xb8JEcj6Ut7IrngcjbGJWWyO1sjp5nyx_xN2gOFBP6CiKy-LrJKEBzKr3LEKUJolBj8Pbxp1Nwsq3ZQM";

export async function registerWebPush(uid: string): Promise<{
  ok: boolean;
  token?: string;
  reason?: string;
}> {
  if (typeof window === "undefined" || !vapidKey || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "web_push_not_configured" };
  }

  if (!(await isSupported())) return { ok: false, reason: "browser_not_supported" };

  const permission = Notification.permission;
  if (permission !== "granted") return { ok: false, reason: "permission_not_granted" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, reason: "token_unavailable" };

    // 1. Client-side Firestore token persistence
    try {
      await saveDeviceToken(uid, token);
    } catch (e) {
      console.warn("Client Firestore token save error:", e);
    }

    // 2. Server-side Firebase Admin persistence (bypasses any client rule limits)
    try {
      await fetch("/api/notifications/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token }),
      });
    } catch (e) {
      console.warn("Server token registration error:", e);
    }

    return { ok: true, token };
  } catch (error) {
    console.warn("Web push registration failed:", error);
    return { ok: false, reason: "registration_failed" };
  }
}

export async function ensureWebPushSubscribed(uid: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof Notification === "undefined" || !uid) return false;
  if (Notification.permission === "granted") {
    const res = await registerWebPush(uid);
    return res.ok;
  }
  return false;
}

export async function listenForForegroundPush(
  onNotification: (payload: MessagePayload) => void,
): Promise<(() => void) | null> {
  if (typeof window === "undefined" || !(await isSupported())) return null;

  try {
    const messaging = getMessaging(getFirebaseApp());
    return onMessage(messaging, onNotification);
  } catch (error) {
    console.warn("Foreground push listener unavailable:", error);
    return null;
  }
}