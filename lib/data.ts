/**
 * lib/data.ts
 * ---------------------------------------------------------------------------
 * Data layer: fetches Sri Guru Granth Sahib scripture from the public BaniDB
 * v2 API and maps its response into the application's clean types.
 *
 * Two public functions are exported:
 *   - getAng(angNumber)    → one Ang of scripture (hot-set SSG + on-demand ISR)
 *   - searchGurbani(term)  → up to 40 matching verses (dynamic, uncached)
 *   - clampAng(n)          → normalises any number into the valid 1–1430 range
 *
 * Every field read from the API is null-guarded so a malformed or partial
 * response can never crash the app — missing data becomes `undefined`/`[]`.
 */

import { cache } from "react";
import type { Ang, Bani, DailyShabad, HukamnamaInfo, SearchResult, VerseLine } from "./types";
import { MAX_ANG, MIN_ANG } from "./types";
import { NITNEM_BANIS } from "./nitnem";

/** Base URL of the public BaniDB v2 REST API. */
const BANIDB_BASE = "https://api.banidb.com/v2";

/**
 * Per-attempt network timeout (ms) for upstream API calls.
 *
 * Build-time static generation pre-renders a ~51-Ang hot set plus the five
 * Nitnem banis (all other Angs and all print pages are on-demand ISR),
 * each fetching BaniDB
 * live.  A single stalled response with no timeout hangs a build worker past
 * Next.js's per-page static-generation budget (60s default) and fails the
 * entire Vercel build — so every upstream fetch must be strictly bounded.
 */
const FETCH_TIMEOUT_MS = 20000;

/** How many times a failed upstream fetch is retried before giving up. */
const FETCH_RETRIES = 2;

/**
 * `fetch()` with a hard timeout and limited retries.
 *
 * A hung upstream connection is aborted after `FETCH_TIMEOUT_MS`; transient
 * failures (timeout, 5xx, network reset) are retried with a short backoff.
 * Permanent failures (4xx) are returned immediately so the caller can fail
 * soft.  Throws only when every attempt fails.
 */
async function fetchUpstream(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      // Retry server-side errors; client errors (4xx) are permanent.
      if (res.status >= 500 && attempt < FETCH_RETRIES) {
        lastError = new Error(`Upstream ${res.status} for ${url}`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Upstream fetch failed: ${url}`);
}

/** URL of the official SGPC daily-Hukamnama page (hs.sgpc.net serves the
 *  day's text + audio; the old www.sgpc.net/hukamnama/ page is a static
 *  2022 attachment with no daily content). */
const SGPC_HUKAMNAMA_URL = "https://hs.sgpc.net/";

/** Host serving SGPC's static Hukamnama media (same origin as the daily page). */
const SGPC_MEDIA_HOST = "https://hs.sgpc.net";

/** Calendar-date parts used to derive SGPC's date-based audio filenames. */
interface SgpcDateParts { y: number; m: number; d: number; }

/** Today's calendar date in Asia/Kolkata — SGPC publishes on the IST date. */
function istTodayParts(now = new Date()): SgpcDateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Tolerantly extracts an SGPC audio URL for `dir` (`hukamnamaaudio` /
 * `kathaaudio`) from the daily-page HTML. Deliberately loose — either quote
 * style, optional host (relative paths resolve against the media host),
 * whitespace around `=` — because the markup is a third-party page that
 * changes without notice, and a missed match used to drop the player
 * silently. Returns `undefined` when the tag isn't found.
 */
function extractSgpcAudioUrl(html: string, dir: "hukamnamaaudio" | "kathaaudio"): string | undefined {
  const m = html.match(
    new RegExp(`src\\s*=\\s*["']((?:https?://hs\\.sgpc\\.net)?/${dir}/[^"']+?\\.mp3(?:[^"']*)?)["']`, "i")
  );
  if (!m) return undefined;
  return m[1].startsWith("/") ? `${SGPC_MEDIA_HOST}${m[1]}` : m[1];
}

/**
 * Date-derived fallback for SGPC's audio URLs (`SGPCNET{DDMMYY}.mp3` and
 * `katha{DDMMYY}.mp3` on the IST calendar — the naming has held for every
 * observed day). Used when the page markup no longer carries the `<audio>`
 * tags, so a third-party markup change can't silently drop the players.
 */
function sgpcAudioUrlsForDate({ y, m, d }: SgpcDateParts): { audio: string; katha: string } {
  const tag = `${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${String(y).slice(2)}`;
  return {
    audio: `${SGPC_MEDIA_HOST}/hukamnamaaudio/SGPCNET${tag}.mp3`,
    katha: `${SGPC_MEDIA_HOST}/kathaaudio/katha${tag}.mp3`,
  };
}

/**
 * Best-effort existence probe for a synthesized audio URL (short timeout, no
 * retries, never throws). Guards the BaniDB-fallback path — where that date's
 * audio may simply not be published yet — against attaching a player that
 * would 404 on first play.
 */
async function verifySgpcAudioUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Referer: `${SGPC_MEDIA_HOST}/`,
      },
    });
    return res.ok ? url : undefined;
  } catch {
    return undefined;
  }
}

// -------------------------------------------------------------------------
// Raw BaniDB response shapes — only the fields this app consumes.
// Kept here (not in lib/types.ts) because they are API internals, not app types.
// -------------------------------------------------------------------------

/** One verse as returned by BaniDB's `/v2/angs/:id` and `/v2/search` endpoints. */
interface BaniDbVerseRaw {
  verseId?: number | string;
  shabadId?: number | string;
  id?: number | string;
  verse?: { gurmukhi?: string; unicode?: string };
  transliteration?: {
    english?: string;
    en?: string;
    hindi?: string;
    hi?: string;
    ur?: string;
    ipa?: string;
  };
  translation?: {
    en?: {
      bdb?: string; // English translation (Sant Singh Khalsa)
      ssk?: string; // English translation alias (Sant Singh Khalsa)
      ms?: string; // English rendering (SGPC, Bhai Manmohan Singh)
    };
    pu?: {
      ss?: { unicode?: string; gurmukhi?: string }; // Guru Granth Darpan (Prof. Sahib Singh)
      ft?: { unicode?: string; gurmukhi?: string }; // Faridkot Teeka (Sant Giani Badan Singh Ji)
      ms?: { unicode?: string; gurmukhi?: string }; // Punjabi rendering (SGPC, Bhai Manmohan Singh)
      bdb?: { unicode?: string; gurmukhi?: string }; // BaniDB Punjabi fallback
      pss?: { unicode?: string; gurmukhi?: string }; // Word-by-word meanings (pad-arth)
    };
    hi?: {
      ss?: string; // Hindi translation
      sts?: string; // Hindi rendering (alternate source)
    };
    es?: {
      sn?: string; // Spanish translation
    };
  };
  writer?: { english?: string | null } | null;
  pageNo?: number;
  lineNo?: number;
  /** Raag of the verse (absent on some responses) — source of the Ang header. */
  raag?: { unicode?: string | null; english?: string | null } | null;
  /**
   * Santhya pause data.  Each source holds one `{p, t}` marker or an array
   * of them: `p` = 0-based word index the pause follows, `t` = "v" (short)
   * or "y" (long).  `p` sometimes arrives as a string.
   */
  visraam?: {
    sttm?: { p?: number | string; t?: string } | { p?: number | string; t?: string }[];
    sttm2?: { p?: number | string; t?: string } | { p?: number | string; t?: string }[];
    igurbani?: { p?: number | string; t?: string } | { p?: number | string; t?: string }[];
  };
}

/** Shape of the `/v2/angs/:id` response envelope (no header — Raag comes per-verse). */
interface BaniDbAngResponse {
  page?: BaniDbVerseRaw[];
  source?: { english?: string };
}

/** Envelope returned by BaniDB's `/v2/random/:sourceID` endpoint. */
interface BaniDbRandomResponse {
  shabadInfo?: {
    raag?: { english?: string };
    writer?: { english?: string };
  };
  verses?: BaniDbVerseRaw[];
}

/** Envelope returned by BaniDB's `/v2/banis/:id` endpoint (numeric id only). */
interface BaniDbBaniResponse {
  baniInfo?: { english?: string; unicode?: string };
  verses?: { verse?: BaniDbVerseRaw }[];
}

/** Envelope returned by BaniDB's `/v2/hukamnamas/:year/:month/:day` endpoint. */
interface BaniDbHukamnamaResponse {
  date?: unknown;
  shabadIds?: number[];
  shabads?: {
    shabadInfo?: {
      pageNo?: number;
      raag?: { english?: string };
      writer?: { english?: string };
    };
    verses?: BaniDbVerseRaw[];
  }[];
}

/**
 * Normalises one BaniDB visraam source (`sttm` / `sttm2` / `igurbani`) into a
 * clean marker list.  Returns `undefined` when the source carries no usable
 * markers (out-of-range or malformed positions are dropped).
 */
function parseVisraamSource(
  source: { p?: number | string; t?: string } | { p?: number | string; t?: string }[] | undefined
): { pos: number; long: boolean }[] | undefined {
  if (!source) return undefined;
  const entries = Array.isArray(source) ? source : [source];
  const markers: { pos: number; long: boolean }[] = [];
  for (const entry of entries) {
    const pos = typeof entry.p === "string" ? parseInt(entry.p, 10) : entry.p;
    if (typeof pos !== "number" || Number.isNaN(pos) || pos < 0) continue;
    markers.push({ pos, long: entry.t === "y" });
  }
  return markers.length > 0 ? markers : undefined;
}

/**
 * Picks the verse's visraam markers from the first non-empty BaniDB source,
 * deduping shared positions with the longer pause winning.
 */
function parseVisraam(
  visraam: BaniDbVerseRaw["visraam"]
): { pos: number; long: boolean }[] | undefined {
  if (!visraam) return undefined;
  const markers =
    parseVisraamSource(visraam.sttm) ??
    parseVisraamSource(visraam.sttm2) ??
    parseVisraamSource(visraam.igurbani);
  if (!markers) return undefined;
  const byPos = new Map<number, boolean>();
  for (const m of markers) {
    byPos.set(m.pos, (byPos.get(m.pos) ?? false) || m.long);
  }
  return [...byPos.entries()]
    .map(([pos, long]) => ({ pos, long }))
    .sort((a, b) => a.pos - b.pos);
}

/**
 * Maps one raw BaniDB verse into the app's clean `VerseLine` shape.
 * Every field is null-guarded: absent values collapse to `undefined`.
 *
 * @param raw       the raw verse object from BaniDB
 * @param angNumber the Ang this verse belongs to (used only as a fallback id)
 * @param index     the verse position within the Ang (fallback id source)
 */
function normalizedText(value: string | undefined): string {
  return value?.normalize("NFC") ?? "";
}

function mapVerse(raw: BaniDbVerseRaw, angNumber: number, index: number): VerseLine {
  // BaniDB exposes the transliteration in four scripts; prefer the explicit
  // script keys and fall back to the older `english`/`hindi` aliases.
  const tr = raw.transliteration ?? {};
  const transliterations = {
    en: tr.english ?? tr.en ?? "",
    hi: tr.hindi ?? tr.hi ?? "",
    ur: tr.ur ?? "",
    ipa: tr.ipa ?? "",
  };
  return {
    // A verse id is the only stable cross-route anchor. Do not derive one
    // from an Ang array position: upstream ordering can change independently.
    verseId: String(raw.verseId ?? raw.id ?? ""),
    shabadId: raw.shabadId == null ? undefined : String(raw.shabadId),
    // BaniDB's `lineNo` repeats inside an Ang (for example on Ang 1098), so
    // the ordered response position is the sole Ang-wide line counter.
    lineNumberOnAng: index + 1,
    sourceLineNo: raw.lineNo,
    // ⚠️ critical: `verse.gurmukhi` is a legacy ASCII-font encoding —
    //    we must always read `verse.unicode` for the real Gurmukhi text.
    gurmukhi: normalizedText(raw.verse?.unicode),
    transliteration: normalizedText(transliterations.en),
    transliterations,
    translations: {
      en: raw.translation?.en?.bdb ? normalizedText(raw.translation.en.bdb) : undefined,
      // Punjabi arrives as Gurmukhi text — try unicode first, then the fallback.
      // Section headings are intentionally untranslated in Guru Granth
      // Darpan. Use SGPC's Punjabi rendering there rather than displaying a
      // blank translation; both are sourced directly from BaniDB.
      pu: raw.translation?.pu?.ss?.unicode
        ? normalizedText(raw.translation.pu.ss.unicode)
        : raw.translation?.pu?.ss?.gurmukhi
          ? normalizedText(raw.translation.pu.ss.gurmukhi)
          : raw.translation?.pu?.ms?.unicode
            ? normalizedText(raw.translation.pu.ms.unicode)
            : raw.translation?.pu?.ms?.gurmukhi
              ? normalizedText(raw.translation.pu.ms.gurmukhi)
              : raw.translation?.pu?.bdb?.unicode
                ? normalizedText(raw.translation.pu.bdb.unicode)
                : raw.translation?.pu?.bdb?.gurmukhi
                  ? normalizedText(raw.translation.pu.bdb.gurmukhi)
                  : undefined,
      hi: raw.translation?.hi?.ss ?? raw.translation?.hi?.sts ?? undefined,
      es: raw.translation?.es?.sn ?? undefined,
    },
    // Word-by-word meanings (pad-arth); absent on some verses.
    padArth:
      raw.translation?.pu?.pss?.unicode ?? raw.translation?.pu?.pss?.gurmukhi ?? undefined,
    // Santhya pause markers (feature 29): first non-empty visraam source
    // wins; positions deduped with the longer pause taking precedence.
    visraam: parseVisraam(raw.visraam),
    // Genuine commentary sources (feature 21): SGPC English rendering for the
    // English side, and both the Guru Granth Darpan + Faridkot Teeka for the
    // Punjabi side.  Each falls back gracefully when the API omits a source —
    // and `enSource` records which English text actually won so the UI never
    // misattributes a Sant Singh Khalsa fallback as the SGPC rendering.
    commentary: {
      en: raw.translation?.en?.ms ?? raw.translation?.en?.bdb ?? raw.translation?.en?.ssk ?? undefined,
      enSource: raw.translation?.en?.ms
        ? "sgpc"
        : (raw.translation?.en?.bdb ?? raw.translation?.en?.ssk)
          ? "khalsa"
          : undefined,
      pu: {
        darpan:
          raw.translation?.pu?.ss?.unicode ?? raw.translation?.pu?.ss?.gurmukhi ?? undefined,
        fareedkot:
          raw.translation?.pu?.ft?.unicode ?? raw.translation?.pu?.ft?.gurmukhi ?? undefined,
      },
    },
    // `writer` may itself be null in the API, hence the double null-guard.
    writer: raw.writer?.english ?? undefined,
    pageNo: raw.pageNo,
  };
}

/**
 * Fetches one Ang from BaniDB.
 *
 * This runs at BUILD TIME for the hot set in `app/ang/[id]/page.tsx`, plus
 * on-demand for all other Angs and ISR print pages in
 * `app/ang/[id]/print/page.tsx` (cached weekly). The result is fully static;
 * scripture text never changes.
 * Wrapped in React's `cache()` so a single route (page body + metadata) only
 * ever performs one network fetch.
 *
 * @param angNumber the Ang to load (1–1430)
 * @returns the mapped Ang, or `null` when out of range / API unreachable
 */
export const getAng = cache(
  async function getAng(angNumber: number): Promise<Ang | null> {
    // Reject out-of-range requests up-front instead of hitting the network.
    if (!Number.isInteger(angNumber) || angNumber < MIN_ANG || angNumber > MAX_ANG) return null;

  try {
    const res = await fetchUpstream(`${BANIDB_BASE}/angs/${angNumber}`, {
      // `revalidate: false` — scripture is immutable, cache the response forever.
      next: { revalidate: false },
    });
    if (!res.ok) return null;

    const data: BaniDbAngResponse = await res.json();
    const rows = data.page ?? [];
    if (rows.length === 0) return null;

    // The `/angs` envelope carries no header — the Raag name comes from the
    // verses themselves (`raag.unicode` for Gurmukhi, `raag.english` for
    // the English equivalent used in browser-tab titles).
    const raagName = rows.map((r) => r.raag?.unicode ?? undefined).find(Boolean);
    const raagNameEn = rows.map((r) => r.raag?.english ?? undefined).find(Boolean);

    return {
      angNumber,
      raagName,
      raagNameEn,
      source: data.source?.english ?? "Sri Guru Granth Sahib Ji",
      lines: rows.map((raw, i) => mapVerse(raw, angNumber, i)),
    };
  } catch {
      // Network failure, offline, or API downtime — fail soft so the page
      // can render its not-found state gracefully instead of crashing.
      return null;
    }
  }
);

/**
 * Fetches one Nitnem bani from BaniDB by numeric id.
 *
 * Runs at BUILD TIME for the five daily prayers via `generateStaticParams`
 * in `app/nitnem/[token]/page.tsx` (`next: { revalidate: false }` — bani
 * text is immutable).  Verses arrive nested under a `verse` key but are
 * otherwise shaped like Ang verses, so they map through `mapVerse` and power
 * the same translation / commentary / pad-arth blocks.
 *
 * @param id the BaniDB numeric bani id (see `NITNEM_BANIS` in lib/nitnem.ts)
 * @returns the mapped bani, or `null` when unknown / API unreachable
 */
export const getBani = cache(async function getBani(id: number): Promise<Bani | null> {
  const meta = NITNEM_BANIS.find((b) => b.id === id);
  if (!meta) return null;

  try {
    const res = await fetchUpstream(`${BANIDB_BASE}/banis/${id}`, {
      next: { revalidate: false },
    });
    if (!res.ok) return null;

    const data: BaniDbBaniResponse = await res.json();
    const rows = (data.verses ?? [])
      .map((row) => row.verse)
      .filter((v): v is BaniDbVerseRaw => !!v?.verse?.unicode);
    if (rows.length === 0) return null;

    return {
      ...meta,
      verses: rows.map((raw, i) => mapVerse(raw, id, i)),
    };
  } catch {
    return null; // fail soft — the bani page renders its not-found state
  }
});

/**
 * Fetches a random full shabad from BaniDB (`/v2/random/1`, source 1 = Sri
 * Guru Granth Sahib Ji) for the Shabad of the Day card.
 *
 * The verses arrive in the standard shape, so they map through `mapVerse`
 * and power the same translation blocks.  Day-stability (same shabad all
 * day) is handled client-side: the card caches the result in localStorage
 * under the local date key and only refetches when the day rolls over.
 *
 * @returns the random shabad, or `null` on any fetch failure
 */
export async function getShabadOfDay(): Promise<DailyShabad | null> {
  try {
    const res = await fetchUpstream(`${BANIDB_BASE}/random/1`, {
      cache: "no-store", // randomness is the point — never serve a stale pick
    });
    if (!res.ok) return null;

    const data: BaniDbRandomResponse = await res.json();
    const rows = (data.verses ?? []).filter((v) => !!v?.verse?.unicode);
    if (rows.length === 0) return null;

    const ang = rows[0].pageNo ?? MIN_ANG;
    return {
      ang,
      raag: data.shabadInfo?.raag?.english ?? undefined,
      writer: data.shabadInfo?.writer?.english ?? undefined,
      verses: rows.map((raw, i) => mapVerse(raw, ang, i)),
    };
  } catch {
    return null; // fail soft — the card renders its fallback state
  }
}

/**
 * Full-text search across Sri Guru Granth Sahib Ji via BaniDB's search endpoint.
 * Used by `app/search/page.tsx` through the `runSearch` server action.
 *
 * BaniDB's default `searchtype` (0) matches first-letters only, so a plain
 * `/search/<term>` call returns nothing for full words — the type must be
 * explicit: `2` for full-word Gurmukhi, `3` for English translations, always
 * scoped to `source=G` (this reader covers Sri Guru Granth Sahib Ji only).
 *
 * Search results are inherently dynamic, so this request is never cached.
 *
 * @param term the search query (Gurmukhi or English)
 * @param lang which side of the text to match (`pa` → Gurmukhi, `en` → English)
 * @returns up to 40 matching verses, or an empty array on failure
 */
export async function searchGurbani(term: string, lang: "pa" | "en" = "pa"): Promise<SearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return []; // empty query → no results, no network call

  try {
    const searchType = lang === "en" ? 3 : 2;
    const res = await fetchUpstream(
      `${BANIDB_BASE}/search/${encodeURIComponent(trimmed)}?searchtype=${searchType}&source=G&results=40`,
      {
        cache: "no-store", // always hit the live API — data is dynamic
      }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const rows: BaniDbVerseRaw[] = data?.verses ?? data?.page ?? [];

    // Keep the list focused: cap at 40 and only surface the fields we render.
    return rows.slice(0, 40).map((raw, i) => ({
      verseId: String(raw.verseId ?? raw.id ?? ""),
      angNumber: raw.pageNo ?? 1,
      gurmukhi: raw.verse?.unicode ?? "",
      translation: raw.translation?.en?.bdb ?? undefined,
    }));
  } catch {
    return []; // fail soft — a broken search must not break the page
  }
}

/**
 * Normalises any number into the valid Ang range [MIN_ANG, MAX_ANG].
 * Used by every navigation site (swipes, arrow keys, controls) so a user can
 * never navigate to a non-existent page.
 *
 * @param n any number (may be NaN)
 * @returns a clamped Ang number, defaulting to MIN_ANG for NaN
 */
export function clampAng(n: number): number {
  if (Number.isNaN(n)) return MIN_ANG;
  return Math.min(MAX_ANG, Math.max(MIN_ANG, n));
}

/** Parses an Ang route segment exactly; `1abc`, decimals, and signs are invalid. */
export function parseAngParam(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const ang = Number(value);
  return Number.isSafeInteger(ang) && ang >= MIN_ANG && ang <= MAX_ANG ? ang : null;
}

/**
 * Fetches the Daily Hukamnama — sourced from hs.sgpc.net, forever.
 *
 * SGPC's live daily page (`https://hs.sgpc.net/`) publishes the day's
 * Hukamnama as embedded JSON (`#hukamnamaPdfData`: date, Ang, Gurmukhi,
 * Punjabi vyakhya, English) plus audio (`hukamnamaaudio/…mp3`, Katha).
 * This loader parses that page as the single source of truth, so the card
 * never depends on a third-party mirror for its content:
 *
 *   1. hs.sgpc.net → date, Ang, Gurmukhi verses, Punjabi + English, audio;
 *      audio URLs come from the page's `<audio>` tags, falling back to the
 *      date-derived filenames (`SGPCNET{DDMMYY}.mp3` / `katha{DDMMYY}.mp3`)
 *      so a markup change can't silently drop the players;
 *   2. BaniDB enrichment (optional, best-effort): when BaniDB's
 *      `/hukamnamas` mirror carries the *same* Ang, its richer verse objects
 *      (transliteration etc.) replace the plain parsed lines — but a BaniDB
 *      outage never breaks the card because the SGPC-parsed lines stand alone.
 *
 * When the SGPC page itself is unreachable (e.g. a Cloudflare challenge to
 * datacenter IPs), the BaniDB today/yesterday fallback still restores
 * HEAD-verified date-derived audio, so the players survive an SGPC outage.
 *
 * The result is cached for 6 hours (`revalidate: 21600`) because the
 * Hukamnama changes at Amrit Vela each morning, never more often.
 *
 * @returns the SGPC Hukamnama, or `null` only when SGPC *and* BaniDB both fail.
 */
export async function getHukamnama(): Promise<HukamnamaInfo | null> {
  /** Human-readable label (e.g. "Monday, 14 September 2026") for a date. */
  const formatDateLabel = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  /** "FOURTH MEHL" / "ਮਹਲਾ ੪" → writer attribution. */
  const writerFromMehl = (englishHeading: string, gurmukhiHeading: string): string | undefined => {
    const upper = englishHeading.toUpperCase();
    const mehlWord =
      (["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH"] as const).find(
        (w) => upper.includes(`${w} MEHL`)
      ) ?? (() => {
        const m = gurmukhiHeading.match(/ਮਹਲਾ\s*([੧੨੩੪੫੬੭੮੯੧੦\d]+)/);
        if (!m) return undefined;
        const digitMap: Record<string, string> = {
          "੧": "FIRST", "੨": "SECOND", "੩": "THIRD", "੪": "FOURTH", "੫": "FIFTH",
          "੬": "SIXTH", "੭": "SEVENTH", "੮": "EIGHTH", "੯": "NINTH", "੧੦": "TENTH",
          "1": "FIRST", "2": "SECOND", "3": "THIRD", "4": "FOURTH", "5": "FIFTH",
          "6": "SIXTH", "7": "SEVENTH", "8": "EIGHTH", "9": "NINTH", "10": "TENTH",
        };
        return digitMap[m[1]];
      })();
    switch (mehlWord) {
      case "FIRST": return "Guru Nanak Dev Ji";
      case "SECOND": return "Guru Angad Dev Ji";
      case "THIRD": return "Guru Amar Das Ji";
      case "FOURTH": return "Guru Ram Das Ji";
      case "FIFTH": return "Guru Arjan Dev Ji";
      case "NINTH": return "Guru Tegh Bahadur Ji";
      default: return undefined;
    }
  };

  /** "SOOHEE, FOURTH MEHL:" → "Soohee". */
  const raagFromHeading = (englishHeading: string): string | undefined => {
    const first = englishHeading.split(",")[0]?.replace(/[:\s]+$/, "").trim();
    if (!first) return undefined;
    const lower = first.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  /** Shape of SGPC's embedded `#hukamnamaPdfData` JSON. */
  interface HsSgpcJson {
    date?: string;
    ang?: string;
    gheading1?: string;
    ghukamnama?: string;
    ghukamnamadesc?: string;
    eheading1?: string;
    ehukamnamadesc?: string;
  }

  /** Fetches + parses the live hs.sgpc.net page (source of truth). */
  const fetchHsSgpc = async (): Promise<{ info: HukamnamaInfo; iso: string } | null> => {
    try {
      // Cloudflare in front of hs.sgpc.net challenges default Node fetches —
      // send browser-like headers so Vercel production isn't served a
      // challenge page (which is why media silently vanished when deployed).
      const res = await fetchUpstream(SGPC_HUKAMNAMA_URL, {
        next: { revalidate: 21600 },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,pa;q=0.8",
        },
      });
      if (!res.ok) return null;
      const html = await res.text();
      if (html.includes("__CF$cv$params") && !html.includes("hukamnama-card")) {
        return null; // Cloudflare challenge — caller falls back to BaniDB text
      }

      const audioUrl = extractSgpcAudioUrl(html, "hukamnamaaudio");
      const kathaUrl = extractSgpcAudioUrl(html, "kathaaudio");

      const jsonRaw = html.match(
        /<script[^>]+id="hukamnamaPdfData"[^>]*>([\s\S]*?)<\/script>/i
      )?.[1]?.trim();
      if (!jsonRaw) return null;
      let json: HsSgpcJson;
      try {
        json = JSON.parse(jsonRaw);
      } catch {
        return null;
      }
      const gurmukhiFull = (json.ghukamnama ?? "").trim();
      if (!gurmukhiFull) return null;

      const angParsed = parseInt(String(json.ang ?? ""), 10);
      const ang = Number.isNaN(angParsed) ? MIN_ANG : clampAng(angParsed);

      const dateParts = (json.date ?? "").split("-").map(Number);
      const dateObj =
        dateParts.length === 3 && dateParts.every((n) => Number.isFinite(n) && n > 0)
          ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
          : new Date();

      const gheading = (json.gheading1 ?? "").trim();
      const eheading = (json.eheading1 ?? "").trim();
      const englishFull = (json.ehukamnamadesc ?? "").trim();
      const punjabiFull = (json.ghukamnamadesc ?? "").trim();

      // Split Gurmukhi + English on verse delimiters so each card line is a
      // real tuk; fall back to one block when the counts don't align.
      const gChunks = gurmukhiFull
        .split("॥")
        .map((s) => s.trim())
        .filter(Boolean);
      const eChunks = englishFull
        .split("||")
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const alignEnglish = eChunks.length === gChunks.length;

      const lines: VerseLine[] = gChunks.map((chunk, i) => ({
        verseId: `hs-${json.date ?? "daily"}-${i}`,
        lineNumberOnAng: i + 1,
        gurmukhi: `${chunk} ॥`,
        transliteration: "",
        transliterations: { en: "", hi: "", ur: "", ipa: "" },
        translations: {
          en: alignEnglish ? eChunks[i] : i === 0 ? englishFull || undefined : undefined,
          pu: i === 0 ? punjabiFull || undefined : undefined,
        },
        pageNo: ang,
      }));

      const fullLines: VerseLine[] =
        lines.length > 0
          ? lines
          : [
              {
                verseId: `hs-${json.date ?? "daily"}-0`,
                lineNumberOnAng: 1,
                gurmukhi: gurmukhiFull,
                transliteration: "",
                transliterations: { en: "", hi: "", ur: "", ipa: "" },
                translations: {
                  en: englishFull || undefined,
                  pu: punjabiFull || undefined,
                },
                pageNo: ang,
              },
            ];

      // Raag heading (e.g. "ਸੂਹੀ ਮਹਲਾ ੪ ॥") prefixed as context on line 1.
      if (gheading && fullLines.length > 0) {
        fullLines[0] = { ...fullLines[0], gurmukhi: `${gheading} ${fullLines[0].gurmukhi}` };
      }

      const iso = /^\d{4}-\d{2}-\d{2}$/.test(json.date ?? "") ? (json.date as string) : "";
      // Date-derived audio fallback: SGPC's filenames track the Hukamnama's
      // own IST date, so a markup change that hides the <audio> tags still
      // leaves working players instead of silently dropping them.
      const isoParts = iso.split("-").map(Number);
      const dated: SgpcDateParts =
        isoParts.length === 3 && isoParts.every((n) => Number.isFinite(n) && n > 0)
          ? { y: isoParts[0], m: isoParts[1], d: isoParts[2] }
          : istTodayParts();
      const datedAudio = sgpcAudioUrlsForDate(dated);
      return {
        info: {
          dateLabel: formatDateLabel(dateObj),
          ang,
          raag: raagFromHeading(eheading),
          writer: writerFromMehl(eheading, gheading),
          lines: fullLines,
          sgpcImage: undefined, // hs.sgpc.net publishes no daily image — audio is the media
          sgpcAudio: audioUrl ?? datedAudio.audio,
          sgpcKathaAudio: kathaUrl ?? datedAudio.katha,
          sgpcPage: SGPC_HUKAMNAMA_URL,
          sourceNote: "Daily Hukamnama — Sri Darbar Sahib, Amritsar (SGPC hs.sgpc.net)",
        },
        iso,
      };
    } catch {
      return null;
    }
  };

  /**
   * Best-effort BaniDB enrichment: when BaniDB's mirror carries the *same*
   * Ang SGPC just published, swap in its richer verse objects
   * (transliteration etc.) while keeping SGPC's date/audio/attribution.
   * Never throws — SGPC-parsed lines stand alone.
   */
  const enrichFromBaniDb = async (base: HukamnamaInfo, isoDate: string): Promise<HukamnamaInfo> => {
    try {
      const [y, m, d] = isoDate.split("-").map(Number);
      if (![y, m, d].every((n) => Number.isFinite(n))) return base;
      const url = `${BANIDB_BASE}/hukamnamas/${y}/${m}/${d}`;
      const res = await fetchUpstream(url, { next: { revalidate: 21600 } });
      if (!res.ok) return base;
      const data: BaniDbHukamnamaResponse = await res.json();
      const shabad = data?.shabads?.[0];
      const info = shabad?.shabadInfo;
      const verses = shabad?.verses ?? [];
      if (!shabad || !info || verses.length === 0) return base;
      if ((info.pageNo ?? base.ang) !== base.ang) return base; // different selection — trust SGPC
      return {
        ...base,
        raag: base.raag ?? info.raag?.english ?? undefined,
        writer: base.writer ?? info.writer?.english ?? undefined,
        lines: verses.map((raw, i) => mapVerse(raw, base.ang, i)),
      };
    } catch {
      return base;
    }
  };

  /**
   * Legacy BaniDB-only fallback (pre-dawn gap / SGPC unreachable): tries
   * today then yesterday IST so the Home page never breaks. SGPC's audio
   * filenames track the IST date, so even with the SGPC page unreachable
   * (e.g. a Cloudflare challenge to datacenter IPs — the classic silent
   * audio loss when deployed) the players are restored from HEAD-verified
   * date-derived URLs; unverifiable dates simply carry no audio, as before.
   */
  const fetchBaniDbFallback = async (): Promise<HukamnamaInfo | null> => {
    const today = istTodayParts();
    const candidates: { date: Date; parts: SgpcDateParts }[] = [
      { date: new Date(today.y, today.m - 1, today.d), parts: today },
      { date: new Date(today.y, today.m - 1, today.d - 1), parts: { y: today.y, m: today.m, d: today.d - 1 } },
    ];
    // Yesterday's parts can underflow the month (e.g. the 1st) — normalise
    // through the Date so the audio tag matches the calendar date.
    for (const candidate of candidates) {
      candidate.parts = {
        y: candidate.date.getFullYear(),
        m: candidate.date.getMonth() + 1,
        d: candidate.date.getDate(),
      };
    }
    for (const candidate of candidates) {
      try {
        const y = candidate.parts.y;
        const m = candidate.parts.m;
        const d = candidate.parts.d;
        const res = await fetchUpstream(`${BANIDB_BASE}/hukamnamas/${y}/${m}/${d}`, {
          next: { revalidate: 21600 },
        });
        if (!res.ok) continue;
        const data: BaniDbHukamnamaResponse = await res.json();
        const shabad = data?.shabads?.[0];
        if (!shabad) continue;
        const info = shabad.shabadInfo ?? {};
        const ang = info.pageNo ?? MIN_ANG;
        // Probe both tracks in parallel; either may be unpublished this early.
        const datedAudio = sgpcAudioUrlsForDate(candidate.parts);
        const [audio, katha] = await Promise.all([
          verifySgpcAudioUrl(datedAudio.audio),
          verifySgpcAudioUrl(datedAudio.katha),
        ]);
        return {
          dateLabel: formatDateLabel(candidate.date),
          ang,
          raag: info.raag?.english ?? undefined,
          writer: info.writer?.english ?? undefined,
          lines: (shabad.verses ?? []).map((raw, i) => mapVerse(raw, ang, i)),
          sgpcImage: undefined,
          sgpcAudio: audio,
          sgpcKathaAudio: katha,
          sgpcPage: SGPC_HUKAMNAMA_URL,
          sourceNote: "Daily Hukamnama — Sri Darbar Sahib, Amritsar (via SGPC)",
        };
      } catch {
        continue;
      }
    }
    return null;
  };

  // -- hs.sgpc.net forever: source of truth; BaniDB only enriches ----------
  const sgpc = await fetchHsSgpc();
  if (sgpc) {
    if (sgpc.iso) return enrichFromBaniDb(sgpc.info, sgpc.iso);
    return sgpc.info;
  }
  return fetchBaniDbFallback();
}
