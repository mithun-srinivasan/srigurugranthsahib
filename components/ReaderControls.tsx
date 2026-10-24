/**
 * components/ReaderControls.tsx
 * ---------------------------------------------------------------------------
 * The settings popover that appears at the top of the Ang reader.
 *
 * Beyond the classic controls (transliteration / translation toggles,
 * language picker, Lareevar mode, font-size stepper, theme picker) this panel
 * exposes every new reader feature added for the feature set:
 *
 *   - Continuous mode        (feature 2)   - Focus mode              (feature 3)
 *   - Auto theme             (feature 4)   - Custom accent + OLED    (feature 5)
 *   - Memorisation mode      (feature 6)   - Parallel translations   (feature 18)
 *   - Text & commentary teeka (feature 21)  - Tap-to-transliterate    (feature 19)
 *   - Transliteration script (feature 24)
 *
 * All state is read from / written to `ReaderPrefsProvider`, which persists
 * every change to `localStorage` automatically.
 */

"use client";

import { Minus, Plus, Sun, Moon, Coffee } from "lucide-react";
import { useReaderPrefs } from "./ReaderPrefsProvider";
import SegmentedControl from "@/components/ui/SegmentedControl";
import type { CommentaryLang, CommentarySource, ThemeMode, TranslationLang, TranslitStyle } from "@/lib/types";

/** Available themes and their display metadata. */
const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "sepia", label: "Sepia", icon: Coffee },
];

/** Available translation languages (BaniDB serves all four). */
const LANGS: { id: TranslationLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "pu", label: "Punjabi" },
  { id: "hi", label: "Hindi" },
  { id: "es", label: "Spanish" },
];

/** Commentary-block languages (genuine teekas exist in English + Punjabi). */
const COMMENTARY_LANGS: { id: CommentaryLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "pu", label: "Punjabi" },
];

/** Procedural accent swatches the user can pick from. */
const ACCENT_SWATCHES = ["#F59E0B", "#B45309", "#16A34A", "#2563EB", "#DB2777", "#7C3AED"];

/** Transliteration script choices (feature 24). */
const TRANSLIT_STYLES: { id: TranslitStyle; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "ur", label: "Urdu" },
  { id: "ipa", label: "IPA" },
];

/** Genuine Punjabi teeka options for the commentary block (feature 21). */
const COMMENTARY_SOURCES: { id: CommentarySource; label: string }[] = [
  { id: "darpan", label: "Guru Granth Darpan" },
  { id: "fareedkot", label: "Faridkot Teeka" },
];

/** A labelled on/off toggle row reused for every boolean preference. */
function ToggleRow({
  label,
  pressed,
  onToggle,
  hint,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={pressed}
      title={hint}
      className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${
        pressed
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-highlight)]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`block h-4 w-7 rounded-full transition ${
          pressed ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      />
    </button>
  );
}

export default function ReaderControls() {
  const prefs = useReaderPrefs();

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* ------------------------------------------------------------------ */}
      {/* Base visibility toggles (original controls)                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={prefs.toggleTransliteration}
          aria-pressed={prefs.showTransliteration}
          className={`min-h-[44px] rounded-lg border px-4 text-xs font-semibold transition ${
            prefs.showTransliteration
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          Transliteration
        </button>

        <button
          onClick={prefs.toggleTranslation}
          aria-pressed={prefs.showTranslation}
          className={`min-h-[44px] rounded-lg border px-4 text-xs font-semibold transition ${
            prefs.showTranslation
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          Translation
        </button>

        <button
          onClick={prefs.toggleLareevarMode}
          aria-pressed={prefs.isLareevarMode}
          title="Blend words continuously for traditional Lareevar reading"
          className={`min-h-[44px] rounded-lg border px-4 text-xs font-semibold transition ${
            prefs.isLareevarMode
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          Lareevar
        </button>

        {prefs.showTranslation && (
          <SegmentedControl
            options={LANGS.map(({ id, label }) => ({ value: id, label }))}
            value={prefs.translationLang}
            onChange={(val) => prefs.setTranslationLang(val as TranslationLang)}
            ariaLabel="Translation language"
            size="sm"
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Reading mode toggles (features 2, 3, 6)                             */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
          Reading Mode
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ToggleRow
            label="Continuous Reading"
            pressed={prefs.isContinuousMode}
            onToggle={prefs.toggleContinuousMode}
            hint="Append the next Ang inline at the end instead of navigating"
          />
          <ToggleRow
            label="Focus Mode"
            pressed={prefs.isFocusMode}
            onToggle={prefs.toggleFocusMode}
            hint="Hide everything except the Gurmukhi scripture"
          />
          <ToggleRow
            label="Memorise"
            pressed={prefs.isMemorizationMode}
            onToggle={prefs.toggleMemorizationMode}
            hint="Blur the verse; tap it to reveal for memorisation practice"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Appearance toggles (features 4, 5)                                  */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
          Appearance
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ToggleRow
            label="Auto Theme"
            pressed={prefs.isAutoTheme}
            onToggle={prefs.toggleAutoTheme}
            hint="Follow the device clock and system colour-scheme"
          />
          <ToggleRow
            label="OLED Black"
            pressed={prefs.isOledTheme}
            onToggle={prefs.toggleOledTheme}
            hint="Pure-black backgrounds on dark/sepia themes for AMOLED"
          />
        </div>

        {/* Font-size stepper */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Text Size</span>
          <div className="flex items-center rounded-lg border border-[var(--border)]">
            <button
              onClick={prefs.decreaseFontSize}
              aria-label="Decrease text size"
              className="flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition"
            >
              <Minus size={16} />
            </button>
            <span className="min-w-[48px] text-center text-xs font-bold text-[var(--text)]">
              {Math.round(prefs.fontScale * 100)}%
            </span>
            <button
              onClick={prefs.increaseFontSize}
              aria-label="Increase text size"
              className="flex h-11 w-11 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Theme picker */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-0.5">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => prefs.setTheme(id)}
                aria-label={`${label} theme`}
                aria-pressed={prefs.theme === id}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.93] ${
                  prefs.theme === id
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* Custom accent swatches */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Accent</span>
          {ACCENT_SWATCHES.map((hex) => (
            <button
              key={hex}
              onClick={() => prefs.setAccentHex(prefs.accentHex === hex ? null : hex)}
              aria-label={`Accent colour ${hex}`}
              title={hex}
              style={{ backgroundColor: hex }}
              className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                prefs.accentHex === hex ? "border-[var(--text)] scale-110" : "border-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Text & commentary toggles (features 18, 19, 20, 21, 24)             */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
          Text &amp; Commentary
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ToggleRow
            label="Parallel Translations"
            pressed={prefs.isParallelTranslations}
            onToggle={prefs.toggleParallelTranslations}
            hint="Show English and Punjabi side-by-side"
          />
          <ToggleRow
            label="Text &amp; Commentary"
            pressed={prefs.showKanji}
            onToggle={prefs.toggleKanji}
            hint="Show the genuine verse commentary (teeka) under each verse"
          />
          <ToggleRow
            label="Tap-to-Transliterate"
            pressed={prefs.isTapToTranslit}
            onToggle={prefs.toggleTapToTranslit}
            hint="Tap any Gurmukhi word to see its transliteration"
          />
          <ToggleRow
            label="Word Meanings"
            pressed={prefs.showWordMeanings}
            onToggle={prefs.toggleWordMeanings}
            hint="Show word-by-word meanings (pad-arth) under each verse"
          />
          <ToggleRow
            label="Visraam Pauses"
            pressed={prefs.showVisraam}
            onToggle={prefs.toggleVisraam}
            hint="Show Santhya pause marks (, short · ; long) in the Gurmukhi line"
          />
        </div>

        {/* Commentary language selector (feature 21) */}
        {prefs.showKanji && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Commentary Language</span>
            <div className="flex items-center rounded-lg border border-[var(--border)] p-0.5">
              {COMMENTARY_LANGS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => prefs.setCommentaryLang(id)}
                  aria-pressed={prefs.commentaryLang === id}
                  className={`min-h-[34px] px-3 text-xs font-semibold transition rounded ${
                    prefs.commentaryLang === id
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Punjabi teeka source — only relevant when Punjabi is selected. */}
            {prefs.commentaryLang === "pu" && (
              <div className="flex items-center rounded-lg border border-[var(--border)] p-0.5">
                {COMMENTARY_SOURCES.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => prefs.setCommentarySource(id)}
                    aria-pressed={prefs.commentarySource === id}
                    className={`min-h-[34px] px-3 text-xs font-semibold transition rounded ${
                      prefs.commentarySource === id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transliteration script selector */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Transliteration Script</span>
          <div className="flex items-center rounded-lg border border-[var(--border)] p-0.5">
            {TRANSLIT_STYLES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => prefs.setTranslitStyle(id)}
                aria-pressed={prefs.translitStyle === id}
                className={`min-h-[34px] px-3 text-xs font-semibold transition rounded ${
                  prefs.translitStyle === id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}