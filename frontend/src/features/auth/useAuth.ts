import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { isFirebaseConfigured, initAppCheck } from "@/services/firebase/config";
import { watchAuth } from "@/services/firebase/auth";
import { registerWebPush } from "@/services/notifications/webPush";

/** Single auth subscriber; mounted once by the app layout. */
export function useAuthListener() {
  const setUser = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }

    void initAppCheck();
    const unsub = watchAuth((u) => {
      setUser(u);
      setAuthLoading(false);
      if (u && typeof Notification !== "undefined" && Notification.permission === "granted") {
        void registerWebPush(u.uid);
      }
    });

    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setAuthLoading, setOnline, setUser]);

  const user = useAppStore((s) => s.user);
  const loading = useAppStore((s) => s.authLoading);
  return { user, loading };
}

export function useUid(): string | null {
  return useAppStore((s) => s.user?.uid ?? null);
}
