"use client";

import ePub from "epubjs";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Icon, type IconName } from "@/components/icons";
import { loadProgress, progressPercent, saveProgress, type BookProgress } from "@/lib/reading-progress";

// ─── epub.js (the slice we use) ────────────────────────────────────────────────

type EpubLocation = {
  start?: { cfi?: string; href?: string; displayed?: { page: number; total: number } };
};

type EpubContents = {
  addStylesheet?: (url: string) => Promise<unknown>;
  window?: Window;
};

type EpubTocItem = { href: string; label: string; subitems?: EpubTocItem[] };

type ThemeRules = Record<string, Record<string, string>>;

type EpubRendition = {
  themes: {
    register: (name: string, rules: ThemeRules) => void;
    select: (name: string) => void;
    override: (property: string, value: string, priority?: boolean) => void;
  };
  hooks: { content: { register: (task: (contents: EpubContents) => void) => void } };
  on: (event: string, handler: (...args: never[]) => void) => void;
  display: (target?: string) => Promise<unknown>;
  next: () => Promise<unknown>;
  prev: () => Promise<unknown>;
  currentLocation: () => EpubLocation | Promise<EpubLocation>;
  destroy: () => void;
};

type EpubBook = {
  renderTo: (element: Element, options: Record<string, unknown>) => EpubRendition;
  ready: Promise<unknown>;
  loaded: { navigation: Promise<{ toc?: EpubTocItem[] }> };
  locations: {
    generate: (chars: number) => Promise<unknown>;
    locationFromCfi: (cfi: string) => number;
    cfiFromLocation: (location: number) => string;
    total: number;
  };
  destroy: () => void;
};

// ─── Settings ──────────────────────────────────────────────────────────────────

type ThemeKey = "light" | "sepia" | "dusk" | "dark" | "custom";
type PresetKey = Exclude<ThemeKey, "custom">;

type ReaderSettings = {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: ThemeKey;
  background: string;
  text: string;
};

const themePresets: Record<PresetKey, { label: string; background: string; text: string }> = {
  light: { label: "Paper", background: "#fcfbf7", text: "#1a1a18" },
  sepia: { label: "Sepia", background: "#f2e6d2", text: "#2a1e12" },
  dusk: { label: "Dusk", background: "#2b2d31", text: "#d8d4ca" },
  dark: { label: "Night", background: "#0f0f0d", text: "#e7e1d6" },
};

const presetOrder: PresetKey[] = ["light", "sepia", "dusk", "dark"];

const lineHeightOptions: { label: string; value: number; icon: IconName }[] = [
  { label: "Snug", value: 1.5, icon: "spacing-snug" },
  { label: "Normal", value: 1.75, icon: "spacing-normal" },
  { label: "Airy", value: 2, icon: "spacing-airy" },
];

const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 28;

// Fonts used by Kindle, Kobo, Apple Books, and other major e-readers.
// All loaded via Google Fonts (see <GoogleFontsLoader> below).
const fontOptions = [
  // ── Serif — reading workhorses ──────────────────────────────────────────────
  { label: "Bookerly",        value: "'Bookerly', 'Literata', serif",          group: "Serif" },  // Kindle default (approximated via Literata on web)
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
  fontFamily: "'Bookerly', 'Literata', serif",
  lineHeight: 1.75,
  theme: "dark",
  background: themePresets.dark.background,
  text: themePresets.dark.text,
};

function resolveThemeColors(settings: ReaderSettings) {
  if (settings.theme === "custom") return { background: settings.background, text: settings.text };
  return themePresets[settings.theme] ?? themePresets.dark;
}

// ─── Theme application ───────────────────────────────────────────────────────
// Extracted so the theme can be applied the moment a rendition exists — not
// only when settings change (which would miss freshly opened books).

function applyThemeToRendition(rendition: EpubRendition | null, settings: ReaderSettings) {
  if (!rendition?.themes) return;
  const colors = resolveThemeColors(settings);
  // Important: epub.js owns the page geometry. It locks <body> to the exact
  // page width and applies its own responsive insets (≈ width/24 per side,
  // 20px top/bottom, margin 0). Any extra padding from us — especially on
  // <html> — pushes that fixed-width body outside the page and clips text,
  // which caused cut-off / misaligned lines on mobile. So we only set colors
  // and typography here, and add defensive rules so the book's own styles
  // can never overflow the page.
  rendition.themes.register("user", {
    html: {
      background: `${colors.background} !important`,
    },
    body: {
      background: `${colors.background} !important`,
      color: `${colors.text} !important`,
      "font-family": `${settings.fontFamily} !important`,
      "font-size": `${settings.fontSize}px`,
      "line-height": `${settings.lineHeight} !important`,
      "overflow-wrap": "break-word",
    },
    // Many EPUBs (Gutenberg's front matter included) set their own font and
    // leading on wrappers and paragraphs, which would make the font and
    // spacing settings appear to do nothing. Code keeps its monospace.
    "body *:not(pre):not(code):not(kbd):not(samp):not(tt)": {
      "font-family": "inherit !important",
    },
    "p, li, blockquote, dd, dt, div, section, article": {
      "line-height": "inherit !important",
    },
    // Gutenberg (and many other) EPUBs ship their own hard-coded colors:
    // white body, white boxes behind links and page numbers, blue/purple/
    // gray text. Those leak through and make pages look "light" no matter
    // which theme is selected. Neutralize every element's own colors so the
    // chosen theme is consistent on every page (body/html keep the colors
    // above; images are unaffected).
    "*:not(body):not(html)": {
      color: "inherit !important",
      "background-color": "transparent !important",
    },
    // Books often strip link underlines — restore the affordance.
    "a, a:link, a:visited, a:hover, a:active": {
      "text-decoration": "underline !important",
    },
    // Some EPUBs ship fixed-width blocks and large images; cap everything
    // to the page width so nothing gets cut off.
    "img, svg, video, table, div, p, ul, ol, blockquote, pre": {
      "max-width": "100% !important",
    },
    img: {
      height: "auto",
    },
  });
  rendition.themes.select("user");
  // Belt and suspenders: inline overrides beat ANY book stylesheet (even
  // !important ones) and epub.js automatically re-applies them to every
  // newly rendered page, so the base page colors can never fall back to the
  // book's defaults.
  rendition.themes.override("background-color", colors.background, true);
  rendition.themes.override("color", colors.text, true);
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_KEY = "reader-settings-v2"; // bumped so existing browsers pick up the new defaults (dark + Bookerly)
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
    const merged = { ...defaultSettings, ...parsed };
    const validTheme = merged.theme === "custom" || merged.theme in themePresets;
    return {
      ...merged,
      theme: validTheme ? merged.theme : defaultSettings.theme,
      fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Number(merged.fontSize) || defaultSettings.fontSize)),
      lineHeight: lineHeightOptions.some((option) => option.value === merged.lineHeight)
        ? merged.lineHeight
        : defaultSettings.lineHeight,
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettingsToCookie(settings: ReaderSettings) {
  setCookie(COOKIE_KEY, JSON.stringify(settings), COOKIE_MAX_AGE);
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

type ReaderClientProps = {
  id: string;
  source: "gutenberg" | "upload";
};

type PageInfo = {
  current: number;
  total: number;
} | null;

type TocEntry = { href: string; label: string; depth: number };

function flattenToc(items: EpubTocItem[], depth = 0): TocEntry[] {
  return items.flatMap((item) => [
    { href: item.href, label: (item.label || "Untitled").trim(), depth },
    ...(depth < 1 && item.subitems?.length ? flattenToc(item.subitems, depth + 1) : []),
  ]);
}

function sameDocument(a: string, b: string) {
  const x = a.split("#")[0];
  const y = b.split("#")[0];
  return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`);
}

const noopSubscribe = () => () => {};
const CENTER_TAP_HINT_KEY = "dogear:center-tap-hint";

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ReaderClient({ id, source }: ReaderClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);

  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  // True once settings have been read from the cookie — prevents flashing the
  // default theme and stops the save effect from clobbering the cookie.
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  // True while a live epub.js rendition exists — lets the theme effect run as
  // soon as the rendition is ready, not only when settings change.
  const [renditionReady, setRenditionReady] = useState(false);
  // Always-current settings, readable from async callbacks (rendition init).
  const settingsRef = useRef(settings);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [fallbackKind, setFallbackKind] = useState<"html" | "text" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Chrome = the top and bottom bars. Visible when a book opens, hidden on the
  // first page turn, toggled by tapping the middle of the page.
  const [chromeVisible, setChromeVisible] = useState(true);
  const [sheet, setSheet] = useState<null | "settings" | "contents">(null);
  const sheetRef = useRef(sheet);
  const [hint, setHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageInfo, setPageInfo] = useState<PageInfo>(null);
  const [locationsReady, setLocationsReady] = useState(false);
  const locationsReadyRef = useRef(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState("");
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [chapterHref, setChapterHref] = useState<string | null>(null);

  // Resume toast — shown when a saved progress position is found for this book
  const [resumeToast, setResumeToast] = useState<BookProgress | null>(null);
  const [resumeToastVisible, setResumeToastVisible] = useState(false);
  const resumeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle progress saves — only write cookie at most once per 3 s while reading
  const saveProgressThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullscreenSupported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(document.fullscreenEnabled),
    () => false
  );

  // ── Load settings from cookie on mount ──────────────────────────────────────
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettings(loadSettingsFromCookie());
      setSettingsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // ── Persist settings to cookie whenever they change ─────────────────────────
  // Gated on settingsHydrated so the very first run (which still holds the
  // default settings) can't overwrite the saved cookie before it's loaded.
  useEffect(() => {
    settingsRef.current = settings;
    if (!settingsHydrated) return;
    saveSettingsToCookie(settings);
  }, [settings, settingsHydrated]);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

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
          setTitle(data.upload?.title || "Your upload");
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
          setTitle(data.book?.title || "Gutenberg book");
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id, source]);

  // ── Init epubjs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!signedUrl || !containerRef.current) return;

    let destroyed = false;

    const init = async () => {
      const res = await fetch(signedUrl);
      if (!res.ok) {
        if (!destroyed) {
          setErrorMessage("The book file didn’t download.");
          setSignedUrl(null);
        }
        return;
      }
      const buffer = await res.arrayBuffer();
      if (destroyed || !containerRef.current) return;

      const book = ePub(buffer) as EpubBook;
      const rendition = book.renderTo(containerRef.current, {
        width: "100%",
        height: "100%",
        flow: "paginated",
        spread: "none",
      });

      bookRef.current = book;
      renditionRef.current = rendition;

      // Each page renders in its own iframe document, which can't see fonts
      // loaded by this page — load the reading fonts inside it as well.
      rendition.hooks.content.register((contents) => {
        void contents.addStylesheet?.(GOOGLE_FONTS_HREF);
        void contents.addStylesheet?.(OPENDYSLEXIC_HREF);
      });

      // Apply the saved theme *before* the first page renders. epub.js then
      // injects it into every page iframe automatically, so all pages match.
      applyThemeToRendition(rendition, settingsRef.current);
      setRenditionReady(true);

      // ── Page tracking + progress save ──────────────────────────────────────
      // Section-level page numbers until book-wide locations exist, then
      // global CFI-based numbers and a throttled progress save.
      const handleRelocated = (location: EpubLocation) => {
        const start = location?.start;
        if (start?.href) setChapterHref(start.href);
        setScrubValue(null);
        if (locationsReadyRef.current && start?.cfi) {
          try {
            const cfi = start.cfi;
            const currentPage = book.locations.locationFromCfi(cfi);
            const totalPages = book.locations.total;
            if (typeof currentPage === "number" && totalPages > 0) {
              const pageNum = currentPage + 1;
              setPageInfo({ current: pageNum, total: totalPages });

              // Throttled progress save — write at most once every 3 s
              if (saveProgressThrottleRef.current) clearTimeout(saveProgressThrottleRef.current);
              saveProgressThrottleRef.current = setTimeout(() => {
                saveProgress(id, { cfi, page: pageNum, total: totalPages, updatedAt: Date.now() });
              }, 3000);
              return;
            }
          } catch { /* fall back to section-level numbers below */ }
        }
        const displayed = start?.displayed;
        if (displayed) setPageInfo({ current: displayed.page, total: displayed.total });
      };
      rendition.on("relocated", handleRelocated);

      // Tap the middle of the page to show or hide the controls. The left and
      // right quarters are covered by the page-turn buttons, so only center
      // taps reach the book. Links and text selections are left alone.
      rendition.on("click", (event: MouseEvent, contents: EpubContents) => {
        const target = event?.target as Element | null;
        if (target?.closest?.("a[href]")) return;
        const selection = contents?.window?.getSelection?.();
        if (selection && selection.toString().trim().length > 0) return;
        if (sheetRef.current) {
          setSheet(null);
          return;
        }
        setChromeVisible((visible) => !visible);
      });

      // Arrow keys still turn pages after a tap moves focus into the book.
      rendition.on("keyup", (event: KeyboardEvent) => {
        if (event.key === "ArrowRight") void rendition.next();
        if (event.key === "ArrowLeft") void rendition.prev();
      });

      book.loaded.navigation
        .then((navigation) => {
          if (!destroyed) setToc(flattenToc(navigation?.toc ?? []));
        })
        .catch(() => {});

      // ── Book-wide locations + resume toast ──────────────────────────────────
      book.ready
        .then(() => book.locations.generate(1024))
        .then(() => {
          if (destroyed) return;
          locationsReadyRef.current = true;
          setLocationsReady(true);

          // Upgrade the page numbers for the page already on screen.
          try {
            const current = rendition.currentLocation();
            if (current && !(current instanceof Promise)) handleRelocated(current);
          } catch { /* the next page turn will update them */ }

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
        })
        .catch(() => {});

      void rendition.display();
    };

    void init();

    return () => {
      destroyed = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
      locationsReadyRef.current = false;
      setRenditionReady(false);
      setLocationsReady(false);
      setPageInfo(null);
      setToc([]);
      setChapterHref(null);
      // Clear timers on unmount
      if (saveProgressThrottleRef.current) clearTimeout(saveProgressThrottleRef.current);
      if (resumeToastTimerRef.current) clearTimeout(resumeToastTimerRef.current);
      setResumeToast(null);
      setResumeToastVisible(false);
    };
  }, [signedUrl, id]);

  // ── Apply theme/font ─────────────────────────────────────────────────────────
  // Runs whenever settings change AND again as soon as a rendition becomes
  // ready. Previously this only depended on `settings`, so on a freshly opened
  // book it ran before the rendition existed, bailed out, and never ran again —
  // the book then rendered in its own (usually light) styles even though the
  // menu showed "Dark".
  useEffect(() => {
    if (!renditionReady) return;
    applyThemeToRendition(renditionRef.current, settings);
  }, [settings, renditionReady]);

  const activeTheme = resolveThemeColors(settings);

  // Match the phone's status bar / browser chrome to the page being read.
  useEffect(() => {
    if (!settingsHydrated) return;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const previous = metas.map((meta) => meta.content);
    metas.forEach((meta) => {
      meta.content = activeTheme.background;
    });
    return () => metas.forEach((meta, index) => {
      meta.content = previous[index];
    });
  }, [activeTheme.background, settingsHydrated]);

  useEffect(() => {
    if (title) document.title = `${title} · Dogear`;
  }, [title]);

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ── Keyboard nav ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Let inputs (page jump, slider, color pickers) handle their own keys.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Escape") {
        if (sheet) setSheet(null);
        else setChromeVisible(false);
        return;
      }
      if (sheet) return;
      if (event.key === "ArrowRight") void renditionRef.current?.next();
      if (event.key === "ArrowLeft") void renditionRef.current?.prev();
      if (event.key === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === "g" && pageInfo && locationsReady) {
        event.preventDefault();
        setChromeVisible(true);
        setPageJumpOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [sheet, pageInfo, locationsReady, toggleFullscreen]);

  // Bring the current chapter / font into view when a sheet opens.
  useEffect(() => {
    if (!sheet) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(sheet === "contents" ? "[data-toc-current]" : "[data-font-current]")
        ?.scrollIntoView({ block: "nearest", inline: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sheet]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const hideChromeAfterTurn = () => {
    setSheet(null);
    setPageJumpOpen(false);
    if (!chromeVisible) return;
    setChromeVisible(false);
    try {
      if (!window.localStorage.getItem(CENTER_TAP_HINT_KEY)) {
        window.localStorage.setItem(CENTER_TAP_HINT_KEY, "1");
        setHint(true);
        window.setTimeout(() => setHint(false), 3200);
      }
    } catch { /* storage unavailable — skip the hint */ }
  };

  const goPrev = () => {
    void renditionRef.current?.prev();
    hideChromeAfterTurn();
  };

  const goNext = () => {
    void renditionRef.current?.next();
    hideChromeAfterTurn();
  };

  const jumpToPage = (page: number) => {
    if (!pageInfo) return;
    const clamped = Math.max(1, Math.min(page, pageInfo.total));
    try {
      const cfi = bookRef.current?.locations.cfiFromLocation(clamped - 1);
      if (cfi) void renditionRef.current?.display(cfi);
    } catch {
      // ignore — locations may not be generated yet
    }
  };

  const handlePageJump = () => {
    const num = parseInt(pageJumpValue, 10);
    if (!isNaN(num)) jumpToPage(num);
    setPageJumpValue("");
    setPageJumpOpen(false);
  };

  const commitScrub = () => {
    if (scrubValue === null) return;
    jumpToPage(scrubValue);
  };

  const goToChapter = (href: string) => {
    void renditionRef.current?.display(href);
    setSheet(null);
    setChromeVisible(false);
  };

  const dismissResumeToast = () => {
    if (resumeToastTimerRef.current) clearTimeout(resumeToastTimerRef.current);
    setResumeToastVisible(false);
    setTimeout(() => setResumeToast(null), 400);
  };

  const handleResume = () => {
    if (!resumeToast?.cfi) return;
    try {
      void renditionRef.current?.display(resumeToast.cfi);
    } catch { /* ignore */ }
    dismissResumeToast();
    setChromeVisible(false);
  };

  const handleThemeChange = (value: ThemeKey) => {
    if (value === "custom") {
      setSettings((c) => ({ ...c, theme: "custom" }));
      return;
    }
    const preset = themePresets[value];
    setSettings((c) => ({ ...c, theme: value, background: preset.background, text: preset.text }));
  };

  const revealOnHover = () => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) setChromeVisible(true);
  };

  const canRender = Boolean(signedUrl);
  const showChrome = chromeVisible || loading || !canRender;
  const currentTocIndex = chapterHref ? toc.findIndex((entry) => sameDocument(entry.href, chapterHref)) : -1;
  const chapterLabel = currentTocIndex >= 0 ? toc[currentTocIndex].label : null;
  const shownPage = scrubValue ?? pageInfo?.current ?? 1;
  const shownPercent = pageInfo ? progressPercent({ cfi: "", page: shownPage, total: pageInfo.total }) : 0;
  const resumePercent = progressPercent(resumeToast);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
    <GoogleFontsLoader />
    <div
      className="reader fixed inset-0 overflow-hidden"
      style={
        {
          "--r-bg": activeTheme.background,
          "--r-fg": activeTheme.text,
          // Hide the shell for the one frame before the saved settings are read
          // from the cookie, so it never flashes in the default theme.
          opacity: settingsHydrated ? 1 : 0,
        } as CSSProperties
      }
    >
      {/* ── Reader area ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center px-8">
            <div role="status" className="flex max-w-xs flex-col items-center gap-4 text-center">
              <span aria-hidden="true" className="size-7 animate-spin rounded-full border-2 border-(--r-faint) border-t-transparent" />
              <p className="font-serif text-lg font-semibold">Opening your book…</p>
              {source === "gutenberg" ? (
                <p className="text-sm text-(--r-muted)">
                  The first time can take a few seconds while a copy is saved to your library.
                </p>
              ) : null}
            </div>
          </div>
        ) : canRender ? (
          <>
            {/* Left tap zone */}
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer opacity-0"
              aria-label="Previous page"
            />

            {/* EPUB container — kept clear of notches and the page counter */}
            <div
              ref={containerRef}
              className="absolute"
              style={{
                top: "env(safe-area-inset-top)",
                right: "env(safe-area-inset-right)",
                bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
                left: "env(safe-area-inset-left)",
              }}
            />

            {/* Right tap zone */}
            <button
              type="button"
              onClick={goNext}
              className="absolute right-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer opacity-0"
              aria-label="Next page"
            />
          </>
        ) : fallbackUrl ? (
          <div className="absolute inset-0 grid place-items-center px-8">
            <div className="flex max-w-sm flex-col items-center text-center">
              <p className="font-serif text-xl font-semibold">No EPUB edition for this one</p>
              <p className="mt-2 text-sm leading-relaxed text-(--r-muted)">
                Project Gutenberg only has it as {fallbackKind === "text" ? "plain text" : "a web page"}. You can
                still read it there.
              </p>
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-11 items-center whitespace-nowrap rounded-full bg-(--r-fg) px-5 text-sm font-semibold text-(--r-bg) transition-soft active:scale-[0.97]"
              >
                {fallbackKind === "text" ? "Open the text version" : "Open the web version"}
              </a>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center px-8">
            <div role="alert" className="flex max-w-sm flex-col items-center text-center">
              <p className="font-serif text-xl font-semibold">We couldn’t open this book</p>
              <p className="mt-2 text-sm leading-relaxed text-(--r-muted)">
                {errorMessage || "The book didn’t load."} Try again in a moment, or pick another title.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex h-11 items-center whitespace-nowrap rounded-full border border-(--r-line) px-5 text-sm font-semibold transition-soft hover:bg-(--r-surface) active:scale-[0.97]"
                >
                  Try again
                </button>
                <Link
                  href="/"
                  className="inline-flex h-11 items-center whitespace-nowrap rounded-full bg-(--r-fg) px-5 text-sm font-semibold text-(--r-bg) transition-soft active:scale-[0.97]"
                >
                  Back to library
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Quiet page counter while reading ─────────────────────────────────── */}
      {pageInfo && canRender ? (
        <div
          className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center text-[0.6875rem] tabular-nums tracking-[0.06em] text-(--r-faint) transition-opacity duration-300 ${
            showChrome ? "opacity-0" : "opacity-100"
          }`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.375rem)" }}
        >
          {pageInfo.current} / {pageInfo.total}
        </div>
      ) : null}

      {/* ── Invisible top strip: tap (or hover with a mouse) to show controls ── */}
      {!showChrome ? (
        <button
          type="button"
          aria-label="Show reading controls"
          onClick={() => setChromeVisible(true)}
          onMouseEnter={revealOnHover}
          onFocus={() => setChromeVisible(true)}
          className="absolute inset-x-0 top-0 z-20 h-12 cursor-default opacity-0"
        />
      ) : null}

      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <header
        inert={!showChrome}
        className={`absolute inset-x-0 top-0 z-20 border-b border-(--r-line) bg-(--r-bg) transition-[transform,opacity] duration-300 ease-out ${
          showChrome ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-0.5 px-1.5 sm:px-3">
          <Link href="/" className="reader-icon-btn" aria-label="Back to library">
            <Icon name="arrow-left" size={22} />
          </Link>
          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="truncate font-serif text-[0.9375rem] font-semibold leading-tight">
              {title || "Opening book…"}
            </p>
            {chapterLabel ? (
              <p className="mt-0.5 truncate text-xs text-(--r-muted)">{chapterLabel}</p>
            ) : null}
          </div>
          {canRender ? (
            <>
              <button
                type="button"
                className="reader-icon-btn"
                aria-label="Contents"
                aria-haspopup="dialog"
                disabled={!renditionReady}
                onClick={() => setSheet("contents")}
              >
                <Icon name="list" size={22} />
              </button>
              <button
                type="button"
                className="reader-icon-btn"
                aria-label="Reading settings"
                aria-haspopup="dialog"
                onClick={() => setSheet((current) => (current === "settings" ? null : "settings"))}
              >
                <span className="font-serif text-[1.0625rem] font-semibold leading-none">Aa</span>
              </button>
            </>
          ) : null}
          {fullscreenSupported ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              className="reader-icon-btn"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Icon name={isFullscreen ? "minimize" : "maximize"} size={20} />
            </button>
          ) : null}
        </div>
      </header>

      {/* ── Bottom bar: progress + scrubber ──────────────────────────────────── */}
      {canRender ? (
        <footer
          inert={!showChrome}
          className={`absolute inset-x-0 bottom-0 z-20 border-t border-(--r-line) bg-(--r-bg) transition-[transform,opacity] duration-300 ease-out ${
            showChrome ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto max-w-2xl px-5 pb-3 pt-2.5 sm:px-6">
            {locationsReady && pageInfo ? (
              <>
                <input
                  type="range"
                  min={1}
                  max={pageInfo.total}
                  value={shownPage}
                  onChange={(event) => setScrubValue(Number(event.target.value))}
                  onPointerUp={commitScrub}
                  onKeyUp={commitScrub}
                  aria-label="Position in book"
                  aria-valuetext={`Page ${shownPage} of ${pageInfo.total}`}
                  className="reader-range"
                  style={{ "--range-fill": `${shownPercent}%` } as CSSProperties}
                />
                <div className="mt-1 flex min-h-9 items-center justify-between gap-3 text-xs tabular-nums text-(--r-muted)">
                  {pageJumpOpen ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handlePageJump();
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <label htmlFor="page-jump" className="sr-only">
                        Go to page
                      </label>
                      <input
                        id="page-jump"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={pageInfo.total}
                        value={pageJumpValue}
                        onChange={(event) => setPageJumpValue(event.target.value)}
                        onBlur={() => {
                          // small delay so a tap on Go registers
                          setTimeout(() => {
                            setPageJumpOpen(false);
                            setPageJumpValue("");
                          }, 150);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setPageJumpValue("");
                            setPageJumpOpen(false);
                          }
                        }}
                        placeholder={String(pageInfo.current)}
                        autoFocus
                        className="h-9 w-20 rounded-full border border-(--r-line) bg-transparent px-3 text-center text-sm text-(--r-fg)"
                      />
                      <button
                        type="submit"
                        onMouseDown={(event) => event.preventDefault()}
                        className="h-9 rounded-full bg-(--r-fg) px-3.5 text-xs font-semibold text-(--r-bg)"
                      >
                        Go
                      </button>
                      <span className="pl-1">of {pageInfo.total}</span>
                    </form>
                  ) : (
                    <button
                      type="button"
                      title="Jump to page (G)"
                      onClick={() => setPageJumpOpen(true)}
                      className="-ml-2.5 h-9 rounded-full px-2.5 transition-soft hover:bg-(--r-surface)"
                    >
                      Page {shownPage} of {pageInfo.total}
                    </button>
                  )}
                  <span>{shownPercent}%</span>
                </div>
              </>
            ) : (
              <p className="flex min-h-[3.75rem] items-center justify-center text-xs tabular-nums text-(--r-muted)">
                {pageInfo
                  ? `Page ${pageInfo.current} of ${pageInfo.total} in this chapter · counting the rest…`
                  : "Counting pages…"}
              </p>
            )}
          </div>
        </footer>
      ) : null}

      {/* ── One-time hint ────────────────────────────────────────────────────── */}
      {hint ? (
        <div
          role="status"
          className="fade-in pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 2.5rem)" }}
        >
          <p className="rounded-full bg-(--r-fg) px-4 py-2 text-xs font-semibold text-(--r-bg)">
            Tap the middle of the page to show the menus
          </p>
        </div>
      ) : null}

      {/* ── Reading settings sheet (no dimming, so changes show live) ─────────── */}
      {sheet === "settings" ? (
        <div className="absolute inset-0 z-30" data-state="open">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close reading settings"
            onClick={() => setSheet(null)}
            className="absolute inset-0 cursor-default"
          />
          <div
            role="dialog"
            aria-labelledby="reader-settings-title"
            className="sheet-panel absolute inset-x-0 bottom-0 mx-auto max-h-[70dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-sheet border border-b-0 border-(--r-line) bg-(--r-bg) px-5 pt-3 shadow-sheet sm:bottom-5 sm:w-[calc(100%-2.5rem)] sm:rounded-sheet sm:border-b"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div aria-hidden="true" className="flex justify-center">
              <span className="h-1 w-10 rounded-full bg-(--r-line)" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <h2 id="reader-settings-title" className="font-serif text-lg font-semibold">
                Display
              </h2>
              <button type="button" onClick={() => setSheet(null)} className="reader-icon-btn -mr-2" aria-label="Close">
                <Icon name="x" />
              </button>
            </div>

            {/* Theme */}
            <div role="group" aria-label="Page color" className="mt-2 grid grid-cols-5 gap-1">
              {[
                ...presetOrder.map((key) => ({ key: key as ThemeKey, ...themePresets[key] })),
                { key: "custom" as ThemeKey, label: "Custom", background: settings.background, text: settings.text },
              ].map((theme) => {
                const selected = settings.theme === theme.key;
                return (
                  <button
                    key={theme.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleThemeChange(theme.key)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl py-1.5"
                  >
                    <span
                      className={`grid size-12 place-items-center rounded-full font-serif text-base font-semibold transition-soft ${
                        selected
                          ? "ring-2 ring-(--r-fg) ring-offset-2 ring-offset-(--r-bg)"
                          : "ring-1 ring-(--r-line)"
                      }`}
                      style={
                        theme.key === "custom"
                          ? { background: `linear-gradient(135deg, ${theme.background} 50%, ${theme.text} 50%)` }
                          : { background: theme.background, color: theme.text }
                      }
                    >
                      {theme.key === "custom" ? "" : "Aa"}
                    </span>
                    <span className={`text-xs ${selected ? "font-semibold" : "text-(--r-muted)"}`}>{theme.label}</span>
                  </button>
                );
              })}
            </div>

            {settings.theme === "custom" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-3 rounded-2xl border border-(--r-line) px-3 py-2 text-sm">
                  <input
                    type="color"
                    value={settings.background}
                    onChange={(event) => setSettings((c) => ({ ...c, background: event.target.value }))}
                    className="reader-color"
                  />
                  Background
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-(--r-line) px-3 py-2 text-sm">
                  <input
                    type="color"
                    value={settings.text}
                    onChange={(event) => setSettings((c) => ({ ...c, text: event.target.value }))}
                    className="reader-color"
                  />
                  Text
                </label>
              </div>
            ) : null}

            {/* Size */}
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">Text size</span>
              <div className="flex items-center rounded-full border border-(--r-line) p-1">
                <button
                  type="button"
                  aria-label="Smaller text"
                  disabled={settings.fontSize <= FONT_SIZE_MIN}
                  onClick={() => setSettings((c) => ({ ...c, fontSize: Math.max(FONT_SIZE_MIN, c.fontSize - 1) }))}
                  className="reader-icon-btn size-10"
                >
                  <span className="font-serif text-sm font-semibold">A</span>
                </button>
                <span className="w-10 text-center text-sm tabular-nums" aria-live="polite">
                  {settings.fontSize}
                </span>
                <button
                  type="button"
                  aria-label="Larger text"
                  disabled={settings.fontSize >= FONT_SIZE_MAX}
                  onClick={() => setSettings((c) => ({ ...c, fontSize: Math.min(FONT_SIZE_MAX, c.fontSize + 1) }))}
                  className="reader-icon-btn size-10"
                >
                  <span className="font-serif text-xl font-semibold">A</span>
                </button>
              </div>
            </div>

            {/* Line spacing */}
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">Line spacing</span>
              <div role="group" aria-label="Line spacing" className="flex rounded-full border border-(--r-line) p-1">
                {lineHeightOptions.map((option) => {
                  const selected = settings.lineHeight === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      aria-label={option.label}
                      title={option.label}
                      onClick={() => setSettings((c) => ({ ...c, lineHeight: option.value }))}
                      className={`grid h-10 w-12 place-items-center rounded-full transition-soft ${
                        selected ? "bg-(--r-fg) text-(--r-bg)" : "hover:bg-(--r-surface)"
                      }`}
                    >
                      <Icon name={option.icon} size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font */}
            <div className="mt-5">
              <span className="text-sm font-semibold">Font</span>
              <div className="-mx-5 mt-2.5">
                <div role="group" aria-label="Font" className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
                  {fontOptions.map((option) => {
                    const selected = settings.fontFamily === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        data-font-current={selected ? "" : undefined}
                        onClick={() => setSettings((c) => ({ ...c, fontFamily: option.value }))}
                        className={`flex h-[4.5rem] w-[5.75rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border transition-soft active:scale-[0.97] ${
                          selected ? "border-(--r-fg) bg-(--r-surface)" : "border-(--r-line) hover:bg-(--r-surface)"
                        }`}
                      >
                        <span className="text-[1.375rem] leading-none" style={{ fontFamily: option.value }}>
                          Aa
                        </span>
                        <span className="w-full truncate px-1.5 text-center text-[0.6875rem] text-(--r-muted)">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Contents sheet ───────────────────────────────────────────────────── */}
      {sheet === "contents" ? (
        <div className="absolute inset-0 z-30" data-state="open">
          <div aria-hidden="true" onClick={() => setSheet(null)} className="sheet-scrim absolute inset-0 bg-scrim" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reader-toc-title"
            className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[78dvh] w-full max-w-md flex-col overflow-hidden rounded-t-sheet border border-b-0 border-(--r-line) bg-(--r-bg) shadow-sheet sm:bottom-5 sm:w-[calc(100%-2.5rem)] sm:rounded-sheet sm:border-b"
          >
            <div className="px-5 pt-3">
              <div aria-hidden="true" className="flex justify-center">
                <span className="h-1 w-10 rounded-full bg-(--r-line)" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <h2 id="reader-toc-title" className="font-serif text-lg font-semibold">
                  Contents
                </h2>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="reader-icon-btn -mr-2"
                  aria-label="Close"
                  autoFocus
                >
                  <Icon name="x" />
                </button>
              </div>
            </div>
            {toc.length > 0 ? (
              <ol
                className="overflow-y-auto overscroll-contain px-2.5 pt-1"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                {toc.map((entry, index) => {
                  const current = index === currentTocIndex;
                  return (
                    <li key={`${entry.href}-${index}`}>
                      <button
                        type="button"
                        onClick={() => goToChapter(entry.href)}
                        aria-current={current ? "location" : undefined}
                        data-toc-current={current ? "" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl py-3 pr-3 text-left transition-soft hover:bg-(--r-surface) ${
                          entry.depth > 0 ? "pl-7 text-sm text-(--r-muted)" : "pl-3 text-[0.9375rem]"
                        } ${current ? "bg-(--r-surface-2) font-semibold text-(--r-fg)" : ""}`}
                      >
                        <span className="min-w-0 flex-1">{entry.label}</span>
                        {current ? <span className="shrink-0 text-xs font-medium text-(--r-muted)">Reading</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="px-5 pb-8 pt-2 text-sm text-(--r-muted)">This book doesn’t include a table of contents.</p>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Resume toast ────────────────────────────────────────────────────── */}
      {resumeToast ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}
        >
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border border-(--r-line) bg-(--r-bg) py-3 pl-4 pr-2 shadow-sheet transition-[opacity,transform] duration-300 ease-out"
            style={{
              opacity: resumeToastVisible ? 1 : 0,
              transform: resumeToastVisible ? "translateY(0)" : "translateY(12px)",
            }}
          >
            <Icon name="book-open" size={20} className="shrink-0 text-(--r-muted)" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Pick up where you left off?</p>
              <p className="text-xs tabular-nums text-(--r-muted)">
                Page {resumeToast.page} of {resumeToast.total} · {resumePercent}%
              </p>
            </div>
            <button
              type="button"
              onClick={handleResume}
              className="h-9 shrink-0 whitespace-nowrap rounded-full bg-(--r-fg) px-4 text-xs font-semibold text-(--r-bg) transition-soft active:scale-[0.97]"
            >
              Resume
            </button>
            <button type="button" onClick={dismissResumeToast} aria-label="Dismiss" className="reader-icon-btn size-9">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}
