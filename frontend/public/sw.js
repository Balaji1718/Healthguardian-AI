const CACHE_NAME = "healthguardian-v1";

importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAxktJXjwdMsqYN0rXBtF-C1AQQVBeT8Dg",
  authDomain: "healthguardian-ai-6d525.firebaseapp.com",
  projectId: "healthguardian-ai-6d525",
  messagingSenderId: "314747195030",
  appId: "1:314747195030:web:83fbc3482daf59edb7bcb7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "HealthGuardian AI";
  const body = payload.notification?.body || payload.data?.body || "You have a new health update.";
  self.registration.showNotification(title, {
    body,
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    tag: payload.data?.tag || "healthguardian-alert",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => "focus" in client);
      if (existing) return existing.focus();
      return clients.openWindow("/app/notifications");
    }),
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache
        .addAll([
          "/",
          "/index.html",
          "/manifest.webmanifest",
          "/favicon-16.png",
          "/favicon-32.png",
          "/apple-touch-icon.png",
          "/pwa-192.png",
          "/pwa-512.png",
        ])
        .catch((err) => {
          console.warn("Pre-caching assets failed (expected in dev environment):", err);
        });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
});

self.addEventListener("fetch", (event) => {
  // Skip cross-origin or non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== "GET") {
    return;
  }

  // Skip API calls
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the response if it's a valid GET request
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) return response;
          // Fallback to index.html for SPA routes offline
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      }),
  );
});
