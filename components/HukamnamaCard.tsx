/**
 * components/HukamnamaCard.tsx
 * ---------------------------------------------------------------------------
 * The Daily Hukamnama card on the Home page (feature 17).
 *
 * Content comes from hs.sgpc.net forever (see `getHukamnama` in lib/data.ts):
 * Gurmukhi verses plus the official English translation, transliteration
 * (when the BaniDB enrichment carries it), and SGPC audio. Each verse
 * renders as a layered block — Gurmukhi, transliteration, English — with
 * toggle pills so readers control which layers they see.
 *
 * Mobile hardening: verse text and the audio-player row are wrapped so
 * 320 px viewports never scroll horizontally; the live fetch races a
 * 12 s client timeout (slow mobile data fails fast instead of hanging on
 * the skeleton); and the last successful Hukamnama is cached in
 * localStorage (`sggs-hukamnama-cache`, re-derivable data — not backed up)
 * so flaky networks still show yesterday's verses labelled as a saved copy.
 * A bell toggle (`HukamnamaNotifyButton`) opts into once-a-day reminders,
 * delivered check-on-visit (see lib/notifications.ts — no push server).
 *
 * The source Ang is shown as a prominent linked pill (Sri Darbar Sahib,
 * Amritsar · Ang N) so readers always know where the Hukamnama was taken
 * from. Audio uses a small themed player (CSS vars only, so light/dark/
 * sepia all re-theme instantly) instead of the browser-native controls,
 * which ignore the app theme.
 *
 * It fetches after mount (it lives inside a client component Home page) and
 * renders a quiet skeleton while loading.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Download,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sunrise,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { HukamnamaInfo } from "@/lib/types";
import { getTodaysHukamnama } from "@/app/actions";
import { maybeNotifyHukamnama } from "@/lib/notifications";
import HukamnamaNotifyButton from "@/components/HukamnamaNotifyButton";

/** localStorage key for the last successful Hukamnama (stale-copy fallback). */
const HUKAM_CACHE_KEY = "sggs-hukamnama-cache";

/** Client-side bound on the live fetch — slow mobile data fails fast. */
const HUKAM_FETCH_TIMEOUT_MS = 12000;

/** Shape of the cached copy: fetch time + the Hukamnama itself. */
interface HukamCache {
  at: string;
  data: HukamnamaInfo;
}

/** Reads the last saved Hukamnama; corrupt storage yields `null`. */
function readHukamCache(): HukamCache | null {
  try {
    const raw = localStorage.getItem(HUKAM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HukamCache;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.data?.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Saves the fresh Hukamnama for offline/flaky-network fallbacks. */
function writeHukamCache(data: HukamnamaInfo): void {
  try {
    localStorage.setItem(HUKAM_CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), data }));
  } catch {
    // Quota / private mode — the live render already succeeded.
  }
}

// -- Themed audio player ------------------------------------------------------
// Custom controls bound to a hidden <audio> element. Native controls can't
// follow the app theme (they render in the browser's chrome), hence this
// lightweight player using only var(--…) tokens.

/** m:ss formatter for the player timestamps. */
function formatPlayerTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Playback speeds cycled by the rate button. */
const PLAYER_RATES = [1, 1.25, 1.5, 2, 0.75] as const;

function HukamnamaAudioPlayer({
  src,
  title,
  audioLabel,
}: {
  src: string;
  title: string;
  audioLabel: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  // Pause when another player on the page starts — two daily audios
  // (Hukamnama + Katha) must never overlap.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => {
      document.querySelectorAll("audio").forEach((other) => {
        if (other !== el && !other.paused) void other.pause();
      });
    };
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        setFailed(true);
      }
    } else {
      el.pause();
    }
  };

  const seekBy = (delta: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(
      Math.max(0, el.currentTime + delta),
      el.duration || 0
    );
  };

  const cycleRate = () => {
    const idx = PLAYER_RATES.indexOf(rate as (typeof PLAYER_RATES)[number]);
    setRate(PLAYER_RATES[(idx + 1) % PLAYER_RATES.length]);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 p-3">
      {/* Narrow screens wrap the controls under the title instead of
          crushing it — 320 px viewports must never scroll sideways. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `Pause ${audioLabel}` : `Play ${audioLabel}`}
          className="flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm transition hover:opacity-90 active:scale-95"
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1 basis-32">
          <p className="truncate text-xs font-bold text-[var(--text)]">{title}</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
            {formatPlayerTime(current)} /{" "}
            {duration > 0 ? formatPlayerTime(duration) : "–:––"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Playback speed for ${audioLabel}`}
            title="Playback speed"
            className="min-h-[36px] min-w-[44px] rounded-lg border border-[var(--border)] px-2 text-[11px] font-bold tabular-nums text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            {rate}x
          </button>
          <button
            type="button"
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? `Unmute ${audioLabel}` : `Mute ${audioLabel}`}
            aria-pressed={muted}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <a
            href={src}
            download
            aria-label={`Download ${audioLabel}`}
            title="Download audio"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            <Download size={14} />
          </a>
        </div>
      </div>
      {/* Seek bar + 10s skip — slider uses the theme accent via accent-color */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => seekBy(-10)}
          aria-label={`Back 10 seconds in ${audioLabel}`}
          className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--text-faint)] transition hover:text-[var(--text)]"
        >
          <RotateCcw size={14} />
        </button>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.1}
          value={duration > 0 ? current : 0}
          disabled={duration <= 0}
          onChange={(e) => {
            const el = audioRef.current;
            const next = Number(e.target.value);
            if (!el || !Number.isFinite(next)) return;
            el.currentTime = next;
            setCurrent(next);
          }}
          aria-label={`Seek in ${audioLabel}`}
          className="h-1.5 w-full cursor-pointer accent-[var(--accent)] disabled:cursor-default disabled:opacity-40"
          style={{
            background: `linear-gradient(to right, var(--accent) ${progress * 100}%, var(--border) ${progress * 100}%)`,
          }}
        />
        <button
          type="button"
          onClick={() => seekBy(10)}
          aria-label={`Forward 10 seconds in ${audioLabel}`}
          className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--text-faint)] transition hover:text-[var(--text)]"
        >
          <RotateCw size={14} />
        </button>
      </div>
      {failed && (
        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
          Audio could not be played here —{" "}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            open it directly
          </a>
          .
        </p>
      )}
      <audio
        ref={audioRef}
        preload="none"
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function HukamnamaCard() {
  const [hukamnama, setHukamnama] = useState<HukamnamaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  /** True when showing the saved copy because the live fetch failed/timed out. */
  const [stale, setStale] = useState(false);
  /** Hides the SGPC image slot when the remote file 403s/404s (deployed hotlink). */
  const [imgFailed, setImgFailed] = useState(false);
  /** Layer toggles — default on so every reader sees all three layers at once. */
  const [showTranslit, setShowTranslit] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Bounded fetch: on slow mobile data the server action's own retries
    // would otherwise hold the skeleton for ~a minute. A timeout here drops
    // to the saved copy (or the SGPC-link fallback) within seconds.
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("hukamnama timeout")), HUKAM_FETCH_TIMEOUT_MS)
    );
    Promise.race([getTodaysHukamnama(), timeout])
      .then((h) => {
        if (cancelled) return;
        if (h && h.lines.length > 0) {
          setHukamnama(h);
          setStale(false);
          writeHukamCache(h);
          // Fire-and-forget: reminders must never delay the render.
          void maybeNotifyHukamnama(h);
        } else {
          const cached = readHukamCache();
          setHukamnama(cached?.data ?? null);
          setStale(Boolean(cached));
        }
      })
      .catch(() => {
        if (cancelled) return;
        const cached = readHukamCache();
        setHukamnama(cached?.data ?? null);
        setStale(Boolean(cached));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // -- Loading skeleton ------------------------------------------------------

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          <Sunrise size={14} />
          <span>Daily Hukamnama</span>
        </div>
        <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[var(--surface-hover)]" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[var(--surface-hover)]" />
      </section>
    );
  }

  // -- Unavailable fallback --------------------------------------------------

  if (!hukamnama || hukamnama.lines.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          <Sunrise size={14} />
          <span>Daily Hukamnama</span>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          The Hukamnama could not be loaded right now.{" "}
          <a
            href="https://hs.sgpc.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Read it on the SGPC website
          </a>
          .
        </p>
      </section>
    );
  }

  const showMedia = Boolean(
    (hukamnama.sgpcImage && !imgFailed) || hukamnama.sgpcAudio || hukamnama.sgpcKathaAudio
  );

  /** Whether any verse carries an English transliteration to display. */
  const hasTranslit = hukamnama.lines.some(
    (l) => l.transliteration || l.transliterations?.en
  );

  /** Whether any verse carries an English translation to display. */
  const hasEnglish = hukamnama.lines.some((l) => l.translations.en);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-6 sm:p-8 shadow-[var(--shadow-subtle)]">
      {/* Card heading + date + reminder toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          <Sunrise size={14} />
          <span>Daily Hukamnama</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            {hukamnama.dateLabel}
          </span>
          <HukamnamaNotifyButton />
        </div>
      </div>

      {/* Stale-copy notice — the saved verses still render below, honestly labelled. */}
      {stale && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-[11px] text-[var(--text-muted)]"
        >
          Showing the last saved Hukamnama — reconnect for today&apos;s.{" "}
          <a
            href="https://hs.sgpc.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Read today&apos;s on the SGPC website
          </a>
          .
        </p>
      )}

      <div className={`mt-4 grid min-w-0 gap-5 ${showMedia ? "sm:grid-cols-[minmax(0,1fr)_180px]" : ""}`}>
        {/* Verse layers: Gurmukhi + transliteration + English, one block per tuk */}
        <div className="min-w-0 space-y-2">
          {/* Source line — Raag/Writer plus a prominent linked Ang pill so
              readers always see where this Hukamnama was taken from */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/ang/${hukamnama.ang}`}
              aria-label={`Read Hukamnama on Ang ${hukamnama.ang}`}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-light)] px-3 py-1 text-xs font-bold text-[var(--accent)] transition hover:opacity-90 active:scale-[0.98]"
            >
              <BookOpen size={12} />
              <span>Ang {hukamnama.ang}</span>
            </Link>
            {(hukamnama.raag || hukamnama.writer) && (
              <p className="text-[11px] font-semibold text-[var(--text-faint)]">
                {hukamnama.raag ?? ""}
                {hukamnama.raag && hukamnama.writer ? " · " : ""}
                {hukamnama.writer ?? ""}
              </p>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">
            Sri Darbar Sahib, Amritsar · {hukamnama.dateLabel}
          </p>

          {/* Layer toggles — rendered only for layers that actually exist */}
          {(hasTranslit || hasEnglish) && (
            <div className="flex flex-wrap gap-2 pb-1">
              {hasTranslit && (
                <button
                  onClick={() => setShowTranslit((v) => !v)}
                  aria-pressed={showTranslit}
                  className={`min-h-[36px] rounded-lg border px-3 text-[11px] font-semibold transition ${
                    showTranslit
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Transliteration
                </button>
              )}
              {hasEnglish && (
                <button
                  onClick={() => setShowTranslation((v) => !v)}
                  aria-pressed={showTranslation}
                  className={`min-h-[36px] rounded-lg border px-3 text-[11px] font-semibold transition ${
                    showTranslation
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Translation
                </button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {hukamnama.lines.map((l) => (
              <div
                key={l.verseId}
                className="min-w-0 space-y-1.5 border-l-2 border-[var(--accent)]/40 pl-3"
              >
                {/* break-words: long Gurmukhi lines must wrap on 320 px
                    screens instead of pushing the card sideways. */}
                <p dir="auto" lang="pa" className="font-gurmukhi break-words text-lg leading-loose text-[var(--text)]">
                  {l.gurmukhi}
                </p>
                {showTranslit && (l.transliterations?.en || l.transliteration) && (
                  <p className="break-words text-xs italic leading-relaxed text-[var(--text-muted)]">
                    {l.transliterations?.en || l.transliteration}
                  </p>
                )}
                {showTranslation && l.translations.en && (
                  <p className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">
                    {l.translations.en}
                  </p>
                )}
              </div>
            ))}
          </div>
          {/* Official SGPC audio — the actual daily media hs.sgpc.net publishes,
              played through the themed player above (native controls ignore
              the app theme) */}
          {(hukamnama.sgpcAudio || hukamnama.sgpcKathaAudio) && (
            <div className="space-y-2 pt-2">
              {hukamnama.sgpcAudio && (
                <HukamnamaAudioPlayer
                  src={hukamnama.sgpcAudio}
                  title="Hukamnama Audio (SGPC)"
                  audioLabel="Hukamnama audio"
                />
              )}
              {hukamnama.sgpcKathaAudio && (
                <HukamnamaAudioPlayer
                  src={hukamnama.sgpcKathaAudio}
                  title="Katha Audio (SGPC)"
                  audioLabel="Katha audio"
                />
              )}
            </div>
          )}
        </div>

        {/* Official SGPC image (legacy) — hidden automatically on load failure
            so a blocked hotlink never leaves a broken-image icon when deployed */}
        {hukamnama.sgpcImage && !imgFailed && (
          <a
            href={hukamnama.sgpcPage}
            target="_blank"
            rel="noopener noreferrer"
            className="relative mx-auto block w-[180px] overflow-hidden rounded-lg border border-[var(--border)]"
            title="Official SGPC Hukamnama"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hukamnama.sgpcImage}
              alt="Official SGPC Daily Hukamnama"
              loading="lazy"
              decoding="async"
              width={180}
              height={240}
              onError={() => setImgFailed(true)}
              className="h-auto w-full object-cover"
            />
          </a>
        )}
      </div>

      {/* Attribution + source links */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[11px] text-[var(--text-faint)]">Source: {hukamnama.sourceNote}</p>
        <div className="flex items-center gap-3">
          <a
            href={hukamnama.sgpcPage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            <span>SGPC Website</span>
            <ExternalLink size={12} />
          </a>
          <Link
            href={`/ang/${hukamnama.ang}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            <span>Read Ang {hukamnama.ang}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </section>
  );
}
