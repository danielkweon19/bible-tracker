import { useEffect } from "react";

const CHECK_INTERVAL_MS = 60 * 1000;
const RESUME_RECHECK_MS = 1500;

export function useAppUpdate() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let checking = false;
    let checkQueued = false;
    let resumeTimer: number | null = null;

    async function checkForUpdate() {
      if (checking) {
        checkQueued = true;
        return;
      }
      checking = true;

      try {
        await updateServiceWorker().catch(() => undefined);

        const response = await fetch(`/version.json?check=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) return;

        const release: unknown = await response.json();
        const latestBuildId = readBuildId(release);
        if (latestBuildId && latestBuildId !== __BUILD_ID__) {
          const nextUrl = buildRefreshUrl(window.location.href, latestBuildId);

          // Prime WebKit with the current document before leaving a restored app snapshot.
          await fetch(nextUrl, {
            cache: "reload",
            credentials: "same-origin"
          }).catch(() => undefined);
          window.location.replace(nextUrl);
        }
      } catch {
        // Stay on the current build while offline and check again later.
      } finally {
        checking = false;
        if (checkQueued) {
          checkQueued = false;
          window.setTimeout(() => void checkForUpdate(), 0);
        }
      }
    }

    const checkAfterResume = () => {
      void checkForUpdate();
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => void checkForUpdate(), RESUME_RECHECK_MS);
    };
    const interval = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);

    checkAfterResume();
    document.addEventListener("visibilitychange", checkAfterResume);
    window.addEventListener("focus", checkAfterResume);
    window.addEventListener("pageshow", checkAfterResume);
    window.addEventListener("online", checkAfterResume);

    return () => {
      window.clearInterval(interval);
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", checkAfterResume);
      window.removeEventListener("focus", checkAfterResume);
      window.removeEventListener("pageshow", checkAfterResume);
      window.removeEventListener("online", checkAfterResume);
    };
  }, []);
}

async function updateServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none"
  });
  await registration.update();
}

export function buildRefreshUrl(currentUrl: string, buildId: string, nonce = Date.now()): string {
  const nextUrl = new URL(currentUrl);
  nextUrl.searchParams.set("_update", buildId);
  nextUrl.searchParams.set("_refresh", nonce.toString(36));
  return nextUrl.toString();
}

export function readBuildId(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "buildId" in value &&
    typeof value.buildId === "string"
  ) {
    return value.buildId;
  }
  return null;
}
