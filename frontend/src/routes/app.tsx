import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/common/States";
import { useAuthListener } from "@/features/auth/useAuth";
import { isFirebaseConfigured } from "@/services/firebase/config";
import { FirebaseSetupNotice } from "@/components/common/FirebaseSetupNotice";

import { AppLoadingScreen } from "@/components/common/AppLoadingScreen";
import { useTranslation } from "@/locales/i18n";
import { listCheckins } from "@/services/firebase/repositories";
import { syncAdaptiveNotifications } from "@/services/notifications/adaptive";

export const Route = createFileRoute("/app")({
  // Firebase auth state lives in the browser; the protected shell is client-rendered.
  ssr: false,
  component: AppLayout,
  head: () => ({
    meta: [
      { title: "HealthGuardian AI — Preventive health workspace" },
      {
        name: "description",
        content:
          "Track daily health, verify medical reports and review preventive health patterns.",
      },
      { property: "og:title", content: "HealthGuardian AI" },
      { property: "og:description", content: "Your private preventive health workspace." },
    ],
  }),
});

function AppLayout() {
  const { user, loading } = useAuthListener();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user && isFirebaseConfigured && location.pathname !== "/auth") {
      void navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  // Proactive background evaluation of adaptive notifications across the app workspace
  useEffect(() => {
    if (user?.uid) {
      void listCheckins(user.uid, 30)
        .then((checkins) => {
          if (checkins.length) void syncAdaptiveNotifications(user.uid, checkins);
        })
        .catch(() => {});
    }
  }, [user?.uid]);

  if (!isFirebaseConfigured) return <FirebaseSetupNotice />;
  if (loading || !user) return <AppLoadingScreen />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
