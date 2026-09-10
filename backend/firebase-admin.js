import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let adminApp;

function getAdminApp() {
  if (adminApp) return adminApp;

  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "service-account.json");
    if (fs.existsSync(saPath)) {
      try {
        const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
        projectId = sa.project_id;
        clientEmail = sa.client_email;
        privateKey = sa.private_key;
      } catch (err) {
        console.warn("Failed to load service-account.json:", err.message);
      }
    }
  }

  if (!projectId || !clientEmail || !privateKey) return null;

  adminApp = getApps()[0] ?? initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return adminApp;
}

export async function sendUserPush(uid, title, body, data = {}) {
  const app = getAdminApp();
  if (!app) return { delivered: false, reason: "firebase_admin_not_configured" };

  const snapshot = await getFirestore(app)
    .collection("users")
    .doc(uid)
    .collection("deviceTokens")
    .get();
  const tokens = snapshot.docs.map((entry) => entry.data().token).filter(Boolean);
  if (!tokens.length) return { delivered: false, reason: "no_registered_devices" };

  const result = await getMessaging(app).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "86400",
      },
      notification: {
        title,
        body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        requireInteraction: true,
      },
      fcmOptions: { link: "/app/notifications" },
    },
    android: {
      priority: "high",
    },
  });

  const staleTokens = result.responses
    .map((response, index) => ({ response, token: tokens[index] }))
    .filter(({ response }) => response.error?.code === "messaging/registration-token-not-registered")
    .map(({ token }) => token);
  await Promise.all(staleTokens.map((token) => snapshot.docs.find((entry) => entry.data().token === token)?.ref.delete()));

  return {
    delivered: result.successCount > 0,
    successCount: result.successCount,
    failureCount: result.failureCount,
  };
}