/**
 * components/ReaderPrefsProvider.tsx
 * ---------------------------------------------------------------------------
 * React context + provider for the reader's display preferences.
 *
 * Responsibilities:
 *   - Hydrates from `localStorage` (`sgs-reader-prefs`) on first render,
 *     merging any missing keys with `DEFAULT_PREFS`.
 *   - Persists every change back to storage with a 500ms debounce.
 *   - Applies the effective ThemeMode class (`theme-light|dark|sepia`) to
 *     <html> so the CSS custom-property palettes in `globals.css` take effect.
 *   - Handles **Auto Theme** (feature 4): when enabled, the effective theme
 *     is derived from the device clock (daylight 06:00–18:00 → light) and the
 *     system `prefers-color-scheme` preference (overrides the clock).
 *   - Handles **Custom Accent** (feature 5): an optional hex colour override is
 *     injected as `--accent` (+ derived translucent variants) on <html>.
 *   - Handles **OLED mode** (feature 5): when enabled, forces the background
 *     surfaces toward pure black for AMOLED displays.
 *   - Mirrors **Focus mode** (feature 3) onto <html data-focus-mode> so the
 *     CSS can hide the navigation bars.
 *
 * Migrated to use the shared `lib/persist.ts` helper for:
 *   - Runtime validation with bad-item dropping
 *   - Versioned storage keys
 *   - 500ms debounce + immediate flush on pagehide/visibilitychange
 *   - Quota error surfacing
 *
 * Consume with the `useReaderPrefs()` hook from any client component.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { CommentaryLang, CommentarySource, ReaderPrefs, ThemeMode, TranslationLang, TranslitStyle } from "@/lib/types";
import { createPersistHook, createValidator, validateString, validateNumber, validateBoolean, validateOptional } from "@/lib/persist";

/** localStorage key where reader preferences are persisted. */
const STORAGE_KEY = "sgs-reader-prefs";

/** Sensible defaults shown before the user has ever modified anything. */
const DEFAULT_PREFS: ReaderPrefs = {
  theme: "light",
  showTransliteration: true,
  showTranslation: true,
  translationLang: "en",
  fontScale: 1,
  isLareevarMode: false,
  isContinuousMode: false,
  isFocusMode: false,
  isAutoTheme: false,
  accentHex: null,
  isOledTheme: false,
  isMemorizationMode: false,
  isParallelTranslations: false,
  commentaryLang: "pu",
  commentarySource: "fareedkot",
  showWordMeanings: false,
  showVisraam: false,
  isTapToTranslit: false,
  translitStyle: "en",
  isAutoAdvance: false,
  showCommentary: false,
};

/**
 * The context value exposed to consumers:
 * all `ReaderPrefs` fields plus their setter/toggle functions.
 */
interface ReaderPrefsContextValue extends ReaderPrefs {
  setTheme: (theme: ThemeMode) => void;
  toggleTransliteration: () => void;
  toggleTranslation: () => void;
  setTranslationLang: (lang: TranslationLang) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleLareevarMode: () => void;
  // New features (see lib/types.ts for each flag's meaning)
  toggleContinuousMode: () => void;
  toggleFocusMode: () => void;
  toggleAutoTheme: () => void;
  toggleOledTheme: () => void;
  setAccentHex: (hex: string | null) => void;
  toggleMemorizationMode: () => void;
  toggleParallelTranslations: () => void;
  toggleCommentary: () => void;
  setCommentaryLang: (lang: CommentaryLang) => void;
  setCommentarySource: (source: CommentarySource) => void;
  toggleWordMeanings: () => void;
  toggleVisraam: () => void;
  toggleTapToTranslit: () => void;
  toggleAutoAdvance: () => void;
  setTranslitStyle: (style: TranslitStyle) => void;
  /** Hydration state. */
  hydrated: boolean;
  /** Quota error signal (storage full / not saved). */
  quotaError: Error | null;
}

/** Internal context — `null` before the provider is mounted. */
const ReaderPrefsContext = createContext<ReaderPrefsContextValue | null>(null);

/** Converts a hex colour into an rgba() string with the given alpha (0–1). */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  // Guard against malformed values that parseInt silently turns into NaN.
  if (Number.isNaN(num) || full.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Whether the given JSON value looks like an object with the prefs' shape.
 * Every field is validated against its allowed domain so corrupted or stale
 * localStorage data can never break theming or the reader controls.
 */
const VALID_THEMES: ThemeMode[] = ["light", "dark", "sepia"];
const VALID_TRANSLATIONS: TranslationLang[] = ["en", "pu", "hi", "es"];
const VALID_COMMENTARY_LANGS: CommentaryLang[] = ["en", "pu"];
const VALID_TRANSLIT_STYLES: TranslitStyle[] = ["en", "hi", "ur", "ipa"];
const VALID_COMMENTARY_SOURCES: CommentarySource[] = ["darpan", "fareedkot"];
const HEX_RE = /^#([0-9a-fA-F]{3}){1,2}$/;

function sanitizePrefs(raw: unknown): ReaderPrefs {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFS;

  const prefs: ReaderPrefs = { ...DEFAULT_PREFS };
  const candidate = raw as Partial<ReaderPrefs>;

  // One-time migration: the `showKanji` pref was renamed to `showCommentary`.
  // If the stored data still carries the old key, adopt its value and drop it.
  const oldKanji = (candidate as Record<string, unknown>).showKanji;
  if (
    typeof oldKanji === "boolean" &&
    typeof candidate.showCommentary !== "boolean"
  ) {
    candidate.showCommentary = oldKanji;
  }

  if (typeof candidate.theme === "string" && (VALID_THEMES as string[]).includes(candidate.theme)) {
    prefs.theme = candidate.theme;
  }
  if (
    typeof candidate.translationLang === "string" &&
    (VALID_TRANSLATIONS as string[]).includes(candidate.translationLang)
  ) {
    prefs.translationLang = candidate.translationLang;
  }
  if (
    typeof candidate.translitStyle === "string" &&
    (VALID_TRANSLIT_STYLES as string[]).includes(candidate.translitStyle)
  ) {
    prefs.translitStyle = candidate.translitStyle;
  }
  if (
    typeof candidate.commentaryLang === "string" &&
    (VALID_COMMENTARY_LANGS as string[]).includes(candidate.commentaryLang)
  ) {
    prefs.commentaryLang = candidate.commentaryLang as CommentaryLang;
  }
  if (
    typeof candidate.commentarySource === "string" &&
    (VALID_COMMENTARY_SOURCES as string[]).includes(candidate.commentarySource)
  ) {
    prefs.commentarySource = candidate.commentarySource as CommentarySource;
  }
  if (candidate.accentHex === null || (typeof candidate.accentHex === "string" && HEX_RE.test(candidate.accentHex))) {
    prefs.accentHex = candidate.accentHex as string | null;
  }
  if (typeof candidate.fontScale === "number" && !Number.isNaN(candidate.fontScale)) {
    prefs.fontScale = Math.min(1.6, Math.max(0.8, candidate.fontScale));
  }

  const boolKeys: Array<keyof ReaderPrefs> = [
    "showTransliteration",
    "showTranslation",
    "isLareevarMode",
    "isContinuousMode",
    "isFocusMode",
    "isAutoTheme",
    "isOledTheme",
    "isMemorizationMode",
    "isParallelTranslations",
    "showCommentary",
    "showWordMeanings",
    "showVisraam",
    "isTapToTranslit",
    "isAutoAdvance",
  ];
  for (const key of boolKeys) {
    if (typeof candidate[key] === "boolean") {
      (prefs as unknown as Record<string, unknown>)[key] = candidate[key];
    }
  }

  return prefs;
}

/** Validator for the full prefs object using persist.ts helpers. */
function validatePrefs(raw: unknown): { ok: true; data: ReaderPrefs } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "prefs: not an object" };
  }
  const obj = raw as Record<string, unknown>;
  const prefs: Partial<ReaderPrefs> = {};

  // theme
  const themeResult = validateOptional(obj.theme, (v) =>
    typeof v === "string" && VALID_THEMES.includes(v as ThemeMode)
      ? { ok: true, data: v as ThemeMode }
      : { ok: false, reason: "prefs.theme: invalid" }
  , "prefs.theme");
  if (themeResult.ok && themeResult.data !== undefined) prefs.theme = themeResult.data;

  // translationLang
  const translationLangResult = validateOptional(obj.translationLang, (v) =>
    typeof v === "string" && VALID_TRANSLATIONS.includes(v as TranslationLang)
      ? { ok: true, data: v as TranslationLang }
      : { ok: false, reason: "prefs.translationLang: invalid" }
  , "prefs.translationLang");
  if (translationLangResult.ok && translationLangResult.data !== undefined) prefs.translationLang = translationLangResult.data;

  // translitStyle
  const translitStyleResult = validateOptional(obj.translitStyle, (v) =>
    typeof v === "string" && VALID_TRANSLIT_STYLES.includes(v as TranslitStyle)
      ? { ok: true, data: v as TranslitStyle }
      : { ok: false, reason: "prefs.translitStyle: invalid" }
  , "prefs.translitStyle");
  if (translitStyleResult.ok && translitStyleResult.data !== undefined) prefs.translitStyle = translitStyleResult.data;

  // commentaryLang
  const commentaryLangResult = validateOptional(obj.commentaryLang, (v) =>
    typeof v === "string" && VALID_COMMENTARY_LANGS.includes(v as CommentaryLang)
      ? { ok: true, data: v as CommentaryLang }
      : { ok: false, reason: "prefs.commentaryLang: invalid" }
  , "prefs.commentaryLang");
  if (commentaryLangResult.ok && commentaryLangResult.data !== undefined) prefs.commentaryLang = commentaryLangResult.data;

  // commentarySource
  const commentarySourceResult = validateOptional(obj.commentarySource, (v) =>
    typeof v === "string" && VALID_COMMENTARY_SOURCES.includes(v as CommentarySource)
      ? { ok: true, data: v as CommentarySource }
      : { ok: false, reason: "prefs.commentarySource: invalid" }
  , "prefs.commentarySource");
  if (commentarySourceResult.ok && commentarySourceResult.data !== undefined) prefs.commentarySource = commentarySourceResult.data;

  // accentHex
  const accentHexResult = validateOptional(obj.accentHex, (v) =>
    v === null || (typeof v === "string" && HEX_RE.test(v))
      ? { ok: true, data: v as string | null }
      : { ok: false, reason: "prefs.accentHex: invalid" }
  , "prefs.accentHex");
  if (accentHexResult.ok && accentHexResult.data !== undefined) prefs.accentHex = accentHexResult.data;

  // fontScale
  const fontScaleResult = validateOptional(obj.fontScale, (v) =>
    typeof v === "number" && !Number.isNaN(v)
      ? { ok: true, data: Math.min(1.6, Math.max(0.8, v)) }
      : { ok: false, reason: "prefs.fontScale: invalid" }
  , "prefs.fontScale");
  if (fontScaleResult.ok && fontScaleResult.data !== undefined) prefs.fontScale = fontScaleResult.data;

  // Boolean fields
  const boolKeys: Array<keyof ReaderPrefs> = [
    "showTransliteration",
    "showTranslation",
    "isLareevarMode",
    "isContinuousMode",
    "isFocusMode",
    "isAutoTheme",
    "isOledTheme",
    "isMemorizationMode",
    "isParallelTranslations",
    "showCommentary",
    "showWordMeanings",
    "showVisraam",
    "isTapToTranslit",
    "isAutoAdvance",
  ];
  for (const key of boolKeys) {
    const boolResult = validateOptional(obj[key], (v) =>
      typeof v === "boolean" ? { ok: true, data: v } : { ok: false, reason: `prefs.${key}: not a boolean` }
    , `prefs.${key}`);
    if (boolResult.ok && boolResult.data !== undefined) (prefs as Record<string, unknown>)[key] = boolResult.data;
  }

  return { ok: true, data: { ...DEFAULT_PREFS, ...prefs } as ReaderPrefs };
}

/** Validator for the full prefs object. */
const prefsValidator = createValidator<ReaderPrefs>(1, validatePrefs);

/** Persisted slice hook for prefs. */
const usePersistedPrefs = createPersistHook<ReaderPrefs>({
  key: STORAGE_KEY,
  validator: prefsValidator,
  defaultValue: DEFAULT_PREFS,
});

export function ReaderPrefsProvider({ children }: { children: ReactNode }) {
  /** Current preference state. Starts as defaults; hydrated from localStorage once. */
  const [prefs, setPrefs, hydrated, quotaError] = usePersistedPrefs();

  /**
   * `hydrated` guards against writing the defaults TO localStorage before
   * we've had a chance to READ the stored values — without this, the stored
   * data would be instantly overwritten on first paint.
   */

  // -- Auto-theme: track the system colour-scheme when Auto Theme is on ------

  /** Whether the OS is currently requesting dark UI. */
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed state from matchMedia, then subscribe to its changes
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // -- Effective theme resolution --------------------------------------------

  /**
   * If Auto Theme is enabled the *displayed* theme is derived rather than the
   * user's manual pick: system preference wins, then the device clock
   * (06:00–18:00 → light, otherwise dark).
   */
  const effectiveTheme: ThemeMode = prefs.isAutoTheme
    ? systemDark
      ? "dark"
      : (() => {
          const hour = new Date().getHours();
          return hour >= 6 && hour < 18 ? "light" : "dark";
        })()
    : prefs.theme;

  // -- Apply theme class + styling overrides to <html> -----------------------

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark", "theme-sepia");
    root.classList.add(`theme-${effectiveTheme}`);

    // Custom accent override (feature 5): replace the accent CSS variables.
    const style = root.style;
    if (prefs.accentHex && /^#([0-9a-fA-F]{3}){1,2}$/.test(prefs.accentHex)) {
      const hex = prefs.accentHex;
      style.setProperty("--accent", hex);
      style.setProperty("--accent-light", hexToRgba(hex, 0.12));
      style.setProperty("--accent-glow", hexToRgba(hex, 0.2));
    } else {
      style.removeProperty("--accent");
      style.removeProperty("--accent-light");
      style.removeProperty("--accent-glow");
    }

    // OLED mode (feature 5): pure-black backgrounds in dark themes.
    if (prefs.isOledTheme && effectiveTheme !== "light") {
      style.setProperty("--bg", "#000");
      style.setProperty("--bg-glass", "rgba(0, 0, 0, 0.88)");
      style.setProperty("--surface", "#000");
    } else {
      style.removeProperty("--bg");
      style.removeProperty("--bg-glass");
      style.removeProperty("--surface");
    }

    // Focus mode (feature 3): flag on <html> so CSS hides the nav chrome.
    root.dataset.focusMode = prefs.isFocusMode ? "on" : "";
  }, [prefs, effectiveTheme, hydrated]);

  // -- Context value: memoized setters compose the public API ----------------

  const value = useMemo((): ReaderPrefsContextValue => {
    /** Generic boolean toggle — eliminates repetitive toggle* closures. */
    const toggleBool = (key: keyof ReaderPrefs) => () =>
      setPrefs((p) => ({ ...p, [key]: !p[key] }));

    return {
      ...prefs,
      setTheme: (theme: ThemeMode) => setPrefs((p) => ({ ...p, theme })),
      toggleTransliteration: toggleBool("showTransliteration"),
      toggleTranslation: toggleBool("showTranslation"),
      setTranslationLang: (translationLang: TranslationLang) =>
        setPrefs((p) => ({ ...p, translationLang })),
      increaseFontSize: () =>
        setPrefs((p) => ({
          ...p,
          fontScale: Math.min(1.6, +(p.fontScale + 0.1).toFixed(2)),
        })),
      decreaseFontSize: () =>
        setPrefs((p) => ({
          ...p,
          fontScale: Math.max(0.8, +(p.fontScale - 0.1).toFixed(2)),
        })),
      toggleLareevarMode: toggleBool("isLareevarMode"),
      toggleContinuousMode: toggleBool("isContinuousMode"),
      toggleFocusMode: toggleBool("isFocusMode"),
      toggleAutoTheme: toggleBool("isAutoTheme"),
      toggleOledTheme: toggleBool("isOledTheme"),
      setAccentHex: (accentHex: string | null) => setPrefs((p) => ({ ...p, accentHex })),
      toggleMemorizationMode: toggleBool("isMemorizationMode"),
      toggleParallelTranslations: toggleBool("isParallelTranslations"),
      toggleCommentary: toggleBool("showCommentary"),
      setCommentaryLang: (commentaryLang: CommentaryLang) =>
        setPrefs((p) => ({ ...p, commentaryLang })),
      toggleWordMeanings: toggleBool("showWordMeanings"),
      toggleVisraam: toggleBool("showVisraam"),
      setCommentarySource: (commentarySource: CommentarySource) =>
        setPrefs((p) => ({ ...p, commentarySource })),
      toggleTapToTranslit: toggleBool("isTapToTranslit"),
      toggleAutoAdvance: toggleBool("isAutoAdvance"),
      setTranslitStyle: (translitStyle: TranslitStyle) =>
        setPrefs((p) => ({ ...p, translitStyle })),
      hydrated,
      quotaError,
    };
  }, [prefs, setPrefs, hydrated, quotaError]);

  return (
    <ReaderPrefsContext.Provider value={value}>
      {children}
    </ReaderPrefsContext.Provider>
  );
}

/**
 * Accessor hook for the reader-prefs context.
 * Throws if called outside a `<ReaderPrefsProvider>` tree.
 */
export function useReaderPrefs() {
  const ctx = useContext(ReaderPrefsContext);
  if (!ctx) {
    throw new Error("useReaderPrefs must be used within ReaderPrefsProvider");
  }
  return ctx;
}