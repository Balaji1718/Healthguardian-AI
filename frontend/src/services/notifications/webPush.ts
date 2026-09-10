import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseApp } from "@/services/firebase/config";
import { saveDeviceToken } from "@/services/firebase/repositories";

const vapidKey = import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string | undefined;

export async function registerWebPush(uid: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (typeof window === "undefined" || !vapidKey || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "web_push_not_configured" };
  }

  if (!(await isSupported())) return { ok: false, reason: "browser_not_supported" };

  const permission = Notification.permission;
  if (permission !== "granted") return { ok: false, reason: "permission_not_granted" };

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, reason: "token_unavailable" };
    await saveDeviceToken(uid, token);
    return { ok: true };
  } catch (error) {
    console.warn("Web push registration failed:", error);
    return { ok: false, reason: "registration_failed" };
  }
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