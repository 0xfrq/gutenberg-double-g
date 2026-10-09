import { useMemo, useSyncExternalStore } from "react";

// Per-book reading position, stored in a cookie per book so the reader can
// resume and the library can show progress. Key: `reader-progress:{bookId}`.

export type BookProgress = {
  cfi: string; // epub.js CFI — exact position for resuming
  page: number; // human-readable page number
  total: number;
  updatedAt?: number; // ms timestamp of the last save (older saves lack it)
};

const PREFIX = "reader-progress:";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isProgress(value: unknown): value is BookProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cfi === "string" &&
    typeof candidate.page === "number" &&
    typeof candidate.total === "number"
  );
}

export function parseProgressCookies(cookieString: string) {
  const progress = new Map<string, BookProgress>();
  if (!cookieString) return progress;
  for (const part of cookieString.split("; ")) {
    if (!part.startsWith(PREFIX)) continue;
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(part.slice(separator + 1)));
      if (isProgress(parsed)) progress.set(part.slice(PREFIX.length, separator), parsed);
    } catch {
      // ignore a malformed cookie rather than breaking the library
    }
  }
  return progress;
}

export function loadProgress(bookId: string): BookProgress | null {
  if (typeof document === "undefined") return null;
  return parseProgressCookies(document.cookie).get(bookId) ?? null;
}

export function saveProgress(bookId: string, progress: BookProgress) {
  document.cookie = `${PREFIX}${bookId}=${encodeURIComponent(JSON.stringify(progress))}; max-age=${MAX_AGE}; path=/; SameSite=Lax`;
}

export function progressPercent(progress: BookProgress | null | undefined) {
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress.page / progress.total) * 100)));
}

// Cookies have no change event; re-read when the tab regains attention
// (e.g. coming back from the reader).
function subscribe(onChange: () => void) {
  window.addEventListener("focus", onChange);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export function useReadingProgress() {
  const cookies = useSyncExternalStore(
    subscribe,
    () => document.cookie,
    () => ""
  );
  return useMemo(() => parseProgressCookies(cookies), [cookies]);
}
