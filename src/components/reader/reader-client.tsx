"use client";

import ePub from "epubjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ReaderSettings = {
  fontSize: number;
  fontFamily: string;
  theme: "light" | "sepia" | "dark" | "custom";
  background: string;
  text: string;
};

const themePresets = {
  light: { background: "#fcfbf7", text: "#1a1a18" },
  sepia: { background: "#f2e6d2", text: "#2a1e12" },
  dark: { background: "#0f0f0d", text: "#e7e1d6" },
};

// Fonts used by Kindle, Kobo, Apple Books, and other major e-readers.
// All loaded via Google Fonts (see <GoogleFontsLoader> below).
const fontOptions = [
  // ── Serif — reading workhorses ──────────────────────────────────────────────
  { label: "Bookerly",        value: "'Bookerly', serif",          group: "Serif" },  // Kindle default (approximated via Literata on web)
  { label: "Literata",        value: "'Literata', serif",          group: "Serif" },  // Google Play Books default
  { label: "Georgia",         value: "Georgia, serif",             group: "Serif" },  // Kindle classic, Apple Books
  { label: "Palatino",        value: "'Palatino Linotype', Palatino, serif", group: "Serif" }, // Kobo, Apple Books
  { label: "EB Garamond",     value: "'EB Garamond', serif",       group: "Serif" },  // Kobo, classic book feel
  { label: "Lora",            value: "'Lora', serif",              group: "Serif" },  // Kobo
  { label: "Merriweather",    value: "'Merriweather', serif",      group: "Serif" },  // Kindle Fire, popular e-ink
  { label: "Crimson Pro",     value: "'Crimson Pro', serif",       group: "Serif" },  // Apple Books option
  { label: "Bitter",          value: "'Bitter', serif",            group: "Serif" },  // Designed for screens/e-readers
  { label: "Libre Baskerville", value: "'Libre Baskerville', serif", group: "Serif" }, // Kobo
  { label: "PT Serif",        value: "'PT Serif', serif",          group: "Serif" },  // Kobo
  // ── Sans-serif ──────────────────────────────────────────────────────────────
  { label: "Helvetica / Arial", value: "Helvetica, Arial, sans-serif", group: "Sans" }, // Kindle
  { label: "Trebuchet MS",    value: "'Trebuchet MS', sans-serif", group: "Sans" },   // Kindle
  { label: "Manrope",         value: "'Manrope', sans-serif",      group: "Sans" },
  { label: "Nunito",          value: "'Nunito', sans-serif",       group: "Sans" },   // Kobo, dyslexia-friendly
  { label: "Source Sans 3",   value: "'Source Sans 3', sans-serif", group: "Sans" }, // Adobe / Kobo
  { label: "Noto Sans",       value: "'Noto Sans', sans-serif",    group: "Sans" },   // Kindle global / wide language coverage
  // ── Dyslexia-friendly ───────────────────────────────────────────────────────
  { label: "OpenDyslexic",    value: "'OpenDyslexic', sans-serif", group: "Accessibility" }, // Kindle, Kobo built-in option
  // ── Monospace ───────────────────────────────────────────────────────────────
  { label: "Courier Prime",   value: "'Courier Prime', monospace", group: "Mono" },  // Screenplay / document feel
];

const defaultSettings: ReaderSettings = {
  fontSize: 18,
  fontFamily: "Literata, serif",
  theme: "sepia",
  background: themePresets.sepia.background,
  text: themePresets.sepia.text,
};

// ─── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_KEY = "reader-settings";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

function loadSettingsFromCookie(): ReaderSettings {
  try {
    const raw = getCookie(COOKIE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function saveSettingsToCookie(settings: ReaderSettings) {
  setCookie(COOKIE_KEY, JSON.stringify(settings), COOKIE_MAX_AGE);
}

// ─── Per-book reading progress cookie ─────────────────────────────────────────
// Key: `reader-progress:{bookId}` — stored separately per book.

type BookProgress = {
  cfi: string;   // epubjs CFI — exact position for resuming
  page: number;  // human-readable page number shown in the toast
  total: number;
};

function progressCookieKey(bookId: string) {
  return `reader-progress:${bookId}`;
}

function loadProgress(bookId: string): BookProgress | null {
  try {
    const raw = getCookie(progressCookieKey(bookId));
    if (!raw) return null;
    return JSON.parse(raw) as BookProgress;
  } catch {
    return null;
  }
}

function saveProgress(bookId: string, progress: BookProgress) {
  setCookie(progressCookieKey(bookId), JSON.stringify(progress), COOKIE_MAX_AGE);
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function FullscreenEnterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 1V5H1M9 5V1H13M9 13V9H13M1 9H5V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Google Fonts loader ───────────────────────────────────────────────────────
// Injects a single <link> for all non-system fonts. Idempotent — safe to mount once.
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Literata:ital,opsz,wght@0,7..72,300..700;1,7..72,300..700",
    "family=EB+Garamond:ital,wght@0,400..800;1,400..800",
    "family=Lora:ital,wght@0,400..700;1,400..700",
    "family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700",
    "family=Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600",
    "family=Bitter:ital,wght@0,400..700;1,400..700",
    "family=Libre+Baskerville:ital,wght@0,400;0,700;1,400",
    "family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700",
    "family=Manrope:wght@400;500;600",
    "family=Nunito:ital,wght@0,400;0,600;1,400",
    "family=Source+Sans+3:ital,wght@0,300..700;1,300..700",
    "family=Noto+Sans:ital,wght@0,400;0,700;1,400",
    "family=Courier+Prime:ital,wght@0,400;0,700;1,400",
  ].join("&") +
  "&display=swap";

// OpenDyslexic isn't on Google Fonts — load from a CDN
const OPENDYSLEXIC_HREF =
  "https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.min.css";

function GoogleFontsLoader() {
  useEffect(() => {
    const ids = ["gf-reader-fonts", "gf-opendyslexic"];
    const hrefs = [GOOGLE_FONTS_HREF, OPENDYSLEXIC_HREF];
    ids.forEach((id, i) => {
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = hrefs[i];
      document.head.appendChild(link);
    });
  }, []);
  return null;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReaderClientProps = {
  id: string;
  source: "gutenberg" | "upload";
};

type PageInfo = {
  current: number;
  total: number;
} | null;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ReaderClient({ id, source }: ReaderClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [fallbackKind, setFallbackKind] = useState<"html" | "text" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("Loading...");
  const [loading, setLoading] = useState(true);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageInfo, setPageInfo] = useState<PageInfo>(null);
  const [pageJumpValue, setPageJumpValue] = useState("");
  const [pageJumpFocused, setPageJumpFocused] = useState(false);
  const pageJumpRef = useRef<HTMLInputElement>(null);

  // Resume toast — shown when a saved progress position is found for this book
  const [resumeToast, setResumeToast] = useState<BookProgress | null>(null);
  const [resumeToastVisible, setResumeToastVisible] = useState(false);
  const resumeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle progress saves — only write cookie at most once per 3 s while reading
  const saveProgressThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load settings from cookie on mount ──────────────────────────────────────
  useEffect(() => {
    setSettings(loadSettingsFromCookie());
  }, []);

  // ── Persist settings to cookie whenever they change ─────────────────────────
  useEffect(() => {
    saveSettingsToCookie(settings);
  }, [settings]);

  // ── Fetch book ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      setFallbackUrl(null);
      setFallbackKind(null);
      try {
        if (source === "upload") {
          const response = await fetch(`/api/uploads/${id}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Failed to load upload");
          if (!active) return;
          setTitle(data.upload?.title || "Upload");
          setSignedUrl(data.signedUrl || null);
          setFallbackUrl(null);
        } else {
          const response = await fetch("/api/library/books/cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Failed to cache book");
          if (!active) return;
          setTitle(data.book?.title || "Gutenberg Book");
          setSignedUrl(data.signedUrl || null);
          setFallbackUrl(data.fallbackUrl || null);
          setFallbackKind(data.fallbackKind || null);
        }
      } catch (error) {
        console.error(error);
        if (active) setErrorMessage(error instanceof Error ? error.message : "Unable to load book");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, source]);

  // ── Init epubjs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!signedUrl || !containerRef.current) return;

    let destroyed = false;

    const init = async () => {
      const res = await fetch(signedUrl);
      if (!res.ok) return;
      const buffer = await res.arrayBuffer();
      if (destroyed) return;

      const book = ePub(buffer);
      const rendition = book.renderTo(containerRef.current!, {
        width: "100%",
        height: "100%",
        flow: "paginated",
        spread: "none",
      });

      bookRef.current = book;
      renditionRef.current = rendition;

      // ── Page tracking (section-level, immediate) ────────────────────────────
      rendition.on("relocated", (location: any) => {
        try {
          const displayed = location?.start?.displayed;
          if (displayed) {
            setPageInfo({ current: displayed.page, total: displayed.total });
          }
        } catch { /* ignore */ }
      });

      // ── Book-wide locations + progress save + resume toast ───────────────────
      book.ready.then(() => {
        book.locations.generate(1024).then(() => {
          // After locations are ready, upgrade the relocated handler to use
          // global CFI-based page numbers AND save progress on every page turn.
          rendition.on("relocated", (location: any) => {
            try {
              const cfi = location?.start?.cfi;
              const currentPage = book.locations.locationFromCfi(cfi);
              const totalPages = book.locations.total;
              if (typeof currentPage === "number" && totalPages > 0) {
                const pageNum = currentPage + 1;
                setPageInfo({ current: pageNum, total: totalPages });

                // Throttled progress save — write at most once every 3 s
                if (saveProgressThrottleRef.current) clearTimeout(saveProgressThrottleRef.current);
                saveProgressThrottleRef.current = setTimeout(() => {
                  saveProgress(id, { cfi, page: pageNum, total: totalPages });
                }, 3000);
              }
            } catch { /* fall back to section-level numbers already set */ }
          });

          // Check for a saved position for this book and show the resume toast
          const saved = loadProgress(id);
          if (saved?.cfi && saved.page > 1) {
            setResumeToast(saved);
            setResumeToastVisible(true);
            // Auto-dismiss after 8 seconds
            resumeToastTimerRef.current = setTimeout(() => {
              setResumeToastVisible(false);
              setTimeout(() => setResumeToast(null), 400); // wait for fade-out
            }, 8000);
          }
        });
      });

      rendition.display();
    };

    init();

    return () => {
      destroyed = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
      setPageInfo(null);
      // Clear timers on unmount
      if (saveProgressThrottleRef.current) clearTimeout(saveProgressThrottleRef.current);
      if (resumeToastTimerRef.current) clearTimeout(resumeToastTimerRef.current);
      setResumeToast(null);
      setResumeToastVisible(false);
    };
  }, [signedUrl, id]);

  // ── Apply theme/font ─────────────────────────────────────────────────────────
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const theme =
      settings.theme === "custom"
        ? { background: settings.background, text: settings.text }
        : themePresets[settings.theme];

    rendition.themes.register("user", {
      body: {
        background: theme.background,
        color: theme.text,
        "font-family": settings.fontFamily,
        "font-size": `${settings.fontSize}px`,
        "line-height": "1.75",
        "padding": "0 2em",
      },
    });
    rendition.themes.select("user");
  }, [settings]);

  // ── Keyboard nav ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      // Don't hijack keys when the page-jump input is focused
      if (pageJumpFocused) {
        if (event.key === "Enter") handlePageJump();
        if (event.key === "Escape") {
          setPageJumpValue("");
          setPageJumpFocused(false);
        }
        return;
      }
      if (event.key === "ArrowRight") renditionRef.current?.next();
      if (event.key === "ArrowLeft") renditionRef.current?.prev();
      if (event.key === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === "g" && pageInfo) {
        event.preventDefault();
        setToolbarVisible(true);
        setTimeout(() => pageJumpRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageJumpFocused, pageJumpValue, pageInfo]);

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const handlePageJump = () => {
    const num = parseInt(pageJumpValue, 10);
    if (!pageInfo || isNaN(num)) {
      setPageJumpValue("");
      setPageJumpFocused(false);
      return;
    }
    const clamped = Math.max(1, Math.min(num, pageInfo.total));
    try {
      const cfi = bookRef.current?.locations.cfiFromLocation(clamped - 1);
      if (cfi) renditionRef.current?.display(cfi);
    } catch {
      // ignore — locations may not be generated yet
    }
    setPageJumpValue("");
    setPageJumpFocused(false);
  };

  const dismissResumeToast = () => {
    if (resumeToastTimerRef.current) clearTimeout(resumeToastTimerRef.current);
    setResumeToastVisible(false);
    setTimeout(() => setResumeToast(null), 400);
  };

  const handleResume = () => {
    if (!resumeToast?.cfi) return;
    try {
      renditionRef.current?.display(resumeToast.cfi);
    } catch { /* ignore */ }
    dismissResumeToast();
  };

  const handleThemeChange = (value: ReaderSettings["theme"]) => {
    const preset = themePresets[value as "light" | "sepia" | "dark"];
    if (preset) {
      setSettings((c) => ({ ...c, theme: value, background: preset.background, text: preset.text }));
      return;
    }
    setSettings((c) => ({ ...c, theme: value }));
  };

  const canRender = Boolean(signedUrl);
  const fallbackLabel = fallbackKind === "text" ? "Open text version" : "Open HTML version";

  const activeTheme =
    settings.theme === "custom"
      ? { background: settings.background, text: settings.text }
      : themePresets[settings.theme];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
    <GoogleFontsLoader />
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: activeTheme.background, color: activeTheme.text }}
    >
      {/* ── Toolbar Wrapper ──────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-20"
        onMouseEnter={() => setToolbarVisible(true)}
        onMouseLeave={() => setToolbarVisible(false)}
      >
        {/* Invisible catch area */}
        <div
          className="absolute top-0 left-0 right-0 h-10"
          style={{ pointerEvents: toolbarVisible ? "none" : "auto" }}
          onClick={() => setToolbarVisible(true)}
        />

        {/* Toolbar Content */}
        <div
          className="relative flex flex-col transition-all duration-300"
          style={{
            opacity: toolbarVisible ? 1 : 0,
            pointerEvents: toolbarVisible ? "auto" : "none",
            background: `linear-gradient(to bottom, ${activeTheme.background}f2 0%, ${activeTheme.background}aa 75%, transparent 100%)`,
          }}
        >
          {/* Row 1: ← Library · Title · Fullscreen */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
            <Link
              href="/"
              className="shrink-0 text-xs uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
            >
              ← Library
            </Link>

            <h1 className="flex-1 min-w-0 text-xs font-semibold truncate opacity-60 text-center">
              {title}
            </h1>

            {/* Page jump */}
            {pageInfo && (
              <div className="shrink-0 flex items-center gap-1">
                {pageJumpFocused ? (
                  <input
                    ref={pageJumpRef}
                    type="number"
                    min={1}
                    max={pageInfo.total}
                    value={pageJumpValue}
                    onChange={(e) => setPageJumpValue(e.target.value)}
                    onBlur={() => {
                      // small delay so a click on the Go button registers
                      setTimeout(() => {
                        setPageJumpFocused(false);
                        setPageJumpValue("");
                      }, 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePageJump();
                      if (e.key === "Escape") {
                        setPageJumpValue("");
                        setPageJumpFocused(false);
                      }
                    }}
                    placeholder={String(pageInfo.current)}
                    autoFocus
                    className="w-16 rounded-full border border-current/30 bg-transparent px-2.5 py-1 text-xs text-center tabular-nums opacity-80 focus:opacity-100 focus:outline-none"
                    style={{ color: activeTheme.text }}
                  />
                ) : (
                  <button
                    type="button"
                    title="Jump to page (G)"
                    onClick={() => {
                      setPageJumpFocused(true);
                      setTimeout(() => pageJumpRef.current?.focus(), 30);
                    }}
                    className="rounded-full border border-current/20 px-2.5 py-1 text-xs tabular-nums opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    p.&nbsp;{pageInfo.current}
                    <span className="opacity-40 ml-1">/ {pageInfo.total}</span>
                  </button>
                )}
                {pageJumpFocused && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handlePageJump(); }}
                    className="rounded-full border border-current/30 px-2.5 py-1 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    Go
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              className="shrink-0 rounded-full border border-current/20 p-1.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
            </button>
          </div>

          {/* Row 2: Reading controls */}
          <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {/* Theme */}
            <select
              value={settings.theme}
              onChange={(e) => handleThemeChange(e.target.value as ReaderSettings["theme"])}
              className="shrink-0 rounded-full border border-current/20 bg-transparent px-3 py-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <option value="light">Light</option>
              <option value="sepia">Sepia</option>
              <option value="dark">Dark</option>
              <option value="custom">Custom</option>
            </select>

            {/* Font */}
            <select
              value={settings.fontFamily}
              onChange={(e) => setSettings((c) => ({ ...c, fontFamily: e.target.value }))}
              className="shrink-0 rounded-full border border-current/20 bg-transparent px-3 py-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            >
              {(["Serif", "Sans", "Accessibility", "Mono"] as const).map((group) => (
                <optgroup key={group} label={group}>
                  {fontOptions
                    .filter((o) => o.group === group)
                    .map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </optgroup>
              ))}
            </select>

            {/* Divider */}
            <span className="shrink-0 h-4 w-px opacity-20 inline-block" style={{ background: "currentColor" }} />

            {/* Font size */}
            <div className="flex items-center gap-1.5 opacity-70 shrink-0">
              <span className="text-xs leading-none select-none">A</span>
              <input
                type="range"
                min={14}
                max={28}
                value={settings.fontSize}
                onChange={(e) => setSettings((c) => ({ ...c, fontSize: Number(e.target.value) }))}
                className="w-20 accent-current"
              />
              <span className="text-sm leading-none select-none">A</span>
            </div>

            {/* Custom colors */}
            {settings.theme === "custom" && (
              <>
                <span className="shrink-0 h-4 w-px opacity-20 inline-block" style={{ background: "currentColor" }} />
                <label className="flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0 text-xs">
                  <span>Bg</span>
                  <input
                    type="color"
                    value={settings.background}
                    onChange={(e) => setSettings((c) => ({ ...c, background: e.target.value }))}
                    className="w-6 h-6 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0 text-xs">
                  <span>Text</span>
                  <input
                    type="color"
                    value={settings.text}
                    onChange={(e) => setSettings((c) => ({ ...c, text: e.target.value }))}
                    className="w-6 h-6 rounded cursor-pointer"
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Reader area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 opacity-40">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading book…</span>
            </div>
          </div>
        ) : canRender ? (
          <>
            {/* Left tap zone */}
            <button
              type="button"
              onClick={() => renditionRef.current?.prev()}
              className="absolute left-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer opacity-0"
              aria-label="Previous page"
            />

            {/* EPUB container */}
            <div ref={containerRef} className="absolute inset-0" />

            {/* Right tap zone */}
            <button
              type="button"
              onClick={() => renditionRef.current?.next()}
              className="absolute right-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer opacity-0"
              aria-label="Next page"
            />
          </>
        ) : fallbackUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
            <p className="text-sm opacity-60">This title has no EPUB available.</p>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-current/30 px-5 py-2 text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
            >
              {fallbackLabel}
            </a>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm opacity-40">
            {errorMessage || "Unable to load this book."}
          </div>
        )}
      </div>

      {/* ── Page number — bottom center ──────────────────────────────────────── */}
      {pageInfo && canRender && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pointer-events-none"
          style={{
            paddingBottom: "env(safe-area-inset-bottom, 12px)",
          }}
        >
          <div
            className="transition-opacity duration-300"
            style={{
              // Always slightly visible so readers can glance at their progress;
              // brightens when the toolbar is open.
              opacity: toolbarVisible ? 0.7 : 0.3,
            }}
          >
            <span
              className="inline-block text-xs tabular-nums tracking-widest select-none px-3 py-1.5 rounded-full"
              style={{
                background: `${activeTheme.background}cc`,
                color: activeTheme.text,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                border: `1px solid ${activeTheme.text}18`,
                marginBottom: "10px",
              }}
            >
              {pageInfo.current} / {pageInfo.total}
            </span>
          </div>
        </div>
      )}

      {/* ── Resume toast ────────────────────────────────────────────────────── */}
      {resumeToast && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 52px)" }}
        >
          <div
            className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg transition-all duration-400"
            style={{
              opacity: resumeToastVisible ? 1 : 0,
              transform: resumeToastVisible ? "translateY(0)" : "translateY(12px)",
              background: activeTheme.background,
              color: activeTheme.text,
              border: `1px solid ${activeTheme.text}22`,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              maxWidth: "min(420px, calc(100vw - 32px))",
            }}
          >
            {/* Book icon */}
            <span className="shrink-0 text-base opacity-50">📖</span>

            {/* Text */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold" style={{ opacity: 0.9 }}>
                Continue reading?
              </span>
              <span className="text-xs tabular-nums" style={{ opacity: 0.5 }}>
                You were on page {resumeToast.page} of {resumeToast.total}
              </span>
            </div>

            {/* Resume button */}
            <button
              type="button"
              onClick={handleResume}
              className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-100"
              style={{
                background: activeTheme.text,
                color: activeTheme.background,
                opacity: 0.85,
              }}
            >
              Resume
            </button>

            {/* Dismiss */}
            <button
              type="button"
              onClick={dismissResumeToast}
              aria-label="Dismiss"
              className="shrink-0 text-sm opacity-30 hover:opacity-70 transition-opacity leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom gradient fade ─────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none transition-opacity duration-300 z-10"
        style={{
          opacity: toolbarVisible ? 1 : 0,
          background: `linear-gradient(to top, ${activeTheme.background}cc, transparent)`,
        }}
      />
    </div>
    </>
  );
}