import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { reportRuntimeError } from "../lib/runtime-reporting";
import { useTheme } from "@/features/theme/theme";

import { useTranslation } from "@/locales/i18n";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {t("common.pageNotFound") || "Page not found"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common.pageNotFoundDesc") ||
            "The page you're looking for doesn't exist or has been moved."}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.goHome") || "Go home"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const pageLoadErrorText = t("common.pageLoadError");
  const pageLoadErrorDescText = t("common.pageLoadErrorDesc");
  const retryText = t("common.retry");
  const goHomeText = t("common.goHome");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {pageLoadErrorText && pageLoadErrorText !== "common.pageLoadError"
            ? pageLoadErrorText
            : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pageLoadErrorDescText && pageLoadErrorDescText !== "common.pageLoadErrorDesc"
            ? pageLoadErrorDescText
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
          >
            {retryText && retryText !== "common.retry" ? retryText : "Try again"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {goHomeText && goHomeText !== "common.goHome" ? goHomeText : "Go home"}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HealthGuardian AI" },
      {
        name: "description",
        content:
          "HealthGuardian AI helps you track health habits, review reports, and understand preventive patterns early.",
      },
      { name: "author", content: "HealthGuardian AI" },
      { property: "og:title", content: "HealthGuardian AI" },
      {
        property: "og:description",
        content:
          "HealthGuardian AI helps you track health habits, review reports, and understand preventive patterns early.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/logo-mark-1024.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@HealthGuardianAI" },
    ],
    links: [
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
