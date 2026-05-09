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

const fontOptions = [
  { label: "Literata", value: "Literata, serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
];

const defaultSettings: ReaderSettings = {
  fontSize: 18,
  fontFamily: "Literata, serif",
  theme: "sepia",
  background: themePresets.sepia.background,
  text: themePresets.sepia.text,
};

type ReaderClientProps = {
  id: string;
  source: "gutenberg" | "upload";
};

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

  // Load settings from localStorage
  useEffect(() => {
    const stored = window.localStorage.getItem("reader-settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        setSettings(defaultSettings);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("reader-settings", JSON.stringify(settings));
  }, [settings]);

  // Fetch book
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

  // Init epubjs
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
      rendition.display();
    };

    init();

    return () => {
      destroyed = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [signedUrl]);

  // Apply theme/font
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

  // Keyboard nav
  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") renditionRef.current?.next();
      if (event.key === "ArrowLeft") renditionRef.current?.prev();
      if (event.key === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  // Fullscreen
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

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: activeTheme.background, color: activeTheme.text }}
    >
      {/* Toolbar Wrapper 
        Handles mouse entering/leaving the top area specifically 
      */}
      <div 
        className="absolute top-0 left-0 right-0 z-20"
        onMouseEnter={() => setToolbarVisible(true)}
        onMouseLeave={() => setToolbarVisible(false)}
      >
        {/* Invisible catch area: Allows you to hover the very top edge to show the menu. Also useful to tap on mobile. */}
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

          {/* Row 2: Reading controls — scrollable on very small screens */}
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
              {fontOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Divider */}
            <span className="shrink-0 h-4 w-px opacity-20 inline-block" style={{ background: "currentColor" }} />

            {/* Size */}
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

      {/* Reader area */}
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

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none transition-opacity duration-300 z-10"
        style={{
          opacity: toolbarVisible ? 1 : 0,
          background: `linear-gradient(to top, ${activeTheme.background}cc, transparent)`,
        }}
      />
    </div>
  );
}