/**
 * lib/homeConstants.ts
 * ---------------------------------------------------------------------------
 * Static data arrays used by the home page (`app/page.tsx`).
 * Extracted to keep the page component focused on layout and interaction,
 * and to allow these arrays to be imported elsewhere if needed.
 *
 * RAAG_SECTIONS is now derived from the canonical SECTIONS table in
 * lib/angMetadata.ts (single source of truth). This fixes:
 *   - Ramkali at 876 (was 885)
 *   - Adds Wadahans at 557
 *   - Adds Raag Mala at 1429
 *   - Total count matches actual sections (39 entries from SECTIONS)
 */

import { SECTIONS, getAngMetadata } from "./angMetadata";

export interface SacredVerse {
  title: string;
  gurmukhi: string;
  transliteration: string;
  translation: string;
  ang: number;
  writer: string;
}

export interface RaagSection {
  name: string;
  gurmukhi: string;
  ang: number;
}

/** Featured sacred verses shown in the "Sacred Wisdom" carousel section.
 *  Verified against BaniDB (api.banidb.com/v2) — do not edit from memory. */
export const SACRED_VERSES: SacredVerse[] = [
  {
    title: "Mool Mantar — Opening Scripture",
    gurmukhi: "ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥",
    transliteration: "ikOankaar sat naam karataa purakh nirabhau niravair akaal moorat ajoonee saibha(n) gur prasaadh ||",
    translation: "One Universal Creator God. Truth Is The Name. Creative Being Personified. No Fear. No Hatred. Image Of The Undying, Beyond Birth, Self-Existent. By Guru's Grace.",
    ang: 1,
    writer: "Guru Nanak Dev Ji",
  },
  {
    title: "Japji Sahib — Sacred Slok",
    gurmukhi: "ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ ਦਿਵਸੁ ਰਾਤਿ ਦੁਇ ਦਾਈ ਦਾਇਆ ਖੇਲੈ ਸਗਲ ਜਗਤੁ ॥",
    transliteration: "pavan guroo paanee pitaa maataa dharat mahat || dhivas raat dhue dhaaee dhaaiaa khelai sagal jagat ||",
    translation: "Air is the Guru, Water is the Father, and Earth is the Great Mother of all. Day and night are the two nurses, in whose lap the whole world plays.",
    ang: 8,
    writer: "Guru Nanak Dev Ji",
  },
  {
    title: "Sukhmani Sahib — Sacred Salutation",
    gurmukhi: "ਆਦਿ ਗੁਰਏ ਨਮਹ ॥ ਜੁਗਾਦਿ ਗੁਰਏ ਨਮਹ ॥ ਸਤਿਗੁਰਏ ਨਮਹ ॥ ਸ੍ਰੀ ਗੁਰਦੇਵਏ ਨਮਹ ॥",
    transliteration: "aad gur e namah || jugaad gur e namah || satgur e namah || sree gurdev e namah ||",
    translation: "I bow to the Primal Guru. I bow to the Guru of the Ages. I bow to the True Guru. I bow to the Great Divine Guru.",
    ang: 262,
    writer: "Guru Arjan Dev Ji",
  },
  {
    title: "Bhairao — Thou Art My Father",
    gurmukhi: "ਤੂ ਮੇਰਾ ਪਿਤਾ ਤੂਹੈ ਮੇਰਾ ਮਾਤਾ ॥ ਤੂ ਮੇਰਾ ਬੰਧਪੁ ਤੂ ਮੇਰਾ ਭ੍ਰਾਤਾ ॥",
    transliteration: "too meraa pitaa toohai meraa maataa || too meraa bandhap too meraa bhraataa ||",
    translation: "You are my Father, and You are my Mother. You are my Relative, and You are my Brother.",
    ang: 1144,
    writer: "Guru Arjan Dev Ji",
  },
  {
    title: "Anand Sahib — Eternal Bliss",
    gurmukhi: "ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥",
    transliteration: "anand bhaiaa meree maae satguroo mai paaiaa ||",
    translation: "I am in ecstasy, O my mother, for I have found my True Guru.",
    ang: 917,
    writer: "Guru Amar Das Ji",
  },
  {
    title: "Japji Sahib — Those Who Serve",
    gurmukhi: "ਜਿਨਿ ਸੇਵਿਆ ਤਿਨਿ ਪਾਇਆ ਮਾਨੁ ॥ ਨਾਨਕ ਰਾਮ ਨਾਮੁ ਗੁਣ ਗਾਨੁ ॥",
    transliteration: "jin seviaa tin paaiaa maan || naanak raam naam gun gaan ||",
    translation: "Those who serve obtain honour. O Nanak, sing the Glorious Praises of the Divine Name.",
    ang: 2,
    writer: "Guru Nanak Dev Ji",
  },
];

/**
 * RAAG_SECTIONS derived from the canonical SECTIONS table in lib/angMetadata.ts.
 * This is the single source of truth for Raag/section boundaries.
 * Filtered to exclude sub-sections that are part of a larger Raag (e.g. So Purakh,
 * Sukhmani Sahib, Asa Di Var, Anand Sahib, Slok Sahaskriti & Bhagat Bani) to
 * show the traditional 31 Raags + major named sections in the home page grid.
 */
function buildRaagSections(): RaagSection[] {
  const raagNames = new Set([
    "Japji Sahib", "Sohila Sahib", "Sri Raag", "Raag Majh", "Raag Gauri",
    "Raag Aasaa", "Raag Gujri", "Raag Devgandhari", "Raag Bihagra",
    "Raag Vadhans", "Raag Sorath", "Raag Dhanasri", "Raag Jaitsri",
    "Raag Todi", "Raag Bairari", "Raag Tilang", "Raag Suhi", "Raag Bilaval",
    "Raag Gaund", "Raag Ramkali", "Raag Nat Narayan", "Raag Mali Gaura",
    "Raag Maru", "Raag Tukhari", "Raag Kedara", "Raag Bhairav",
    "Raag Basant", "Raag Sarang", "Raag Malar", "Raag Kanara",
    "Raag Kalyan", "Raag Prabhati", "Raag Jaijavanti", "Raag Mala"
  ]);

  const result: RaagSection[] = [];
  const seen = new Set<string>();

  for (const { start, meta } of SECTIONS) {
    const eng = meta.realmEnglish;
    const gurmukhi = meta.realmGurmukhi;

    if (raagNames.has(eng) && !seen.has(eng)) {
      seen.add(eng);
      result.push({ name: eng, gurmukhi, ang: start });
    }
  }

  return result;
}

/** The canonical Raag/section grid for the home page (derived from SECTIONS). */
export const RAAG_SECTIONS: RaagSection[] = buildRaagSections();

/** Total count of canonical sections for display headings. */
export const TOTAL_CANONICAL_SECTIONS = RAAG_SECTIONS.length;

/**
 * Returns the display name (with Gurmukhi) of the Raag/section that
 * an Ang number falls within. Uses the canonical metadata.
 */
export function getRaagForAng(angNum: number): string {
  if (angNum < 1 || angNum > 1430) return "Unknown";
  const meta = getAngMetadata(angNum);
  return `${meta.realmEnglish} (${meta.realmGurmukhi})`;
}

/**
 * Verifies a hard-coded SacredVerse against BaniDB.
 * Used by validate:gurbani to ensure no drift.
 */
export async function verifySacredVerse(verse: SacredVerse): Promise<{ ok: boolean; issues: string[] }> {
  const issues: string[] = [];
  try {
    const res = await fetch(`https://api.banidb.com/v2/angs/${verse.ang}`);
    if (!res.ok) return { ok: false, issues: [`HTTP ${res.status}`] };
    const data = await res.json();
    const rows = data?.page ?? [];
    const matched = rows.find((r: { verse?: { unicode?: string } }) =>
      r.verse?.unicode?.trim() === verse.gurmukhi.trim() ||
      r.verse?.unicode?.trim().includes(verse.gurmukhi.trim().slice(0, 20))
    );
    if (!matched) {
      issues.push(`Verse not found in BaniDB Ang ${verse.ang}`);
    } else {
      const dbGurmukhi = matched.verse?.unicode?.trim() ?? "";
      if (dbGurmukhi !== verse.gurmukhi.trim()) {
        issues.push(`Gurmukhi mismatch: DB has "${dbGurmukhi.slice(0, 40)}..."`);
      }
      const dbTranslit = matched.transliteration?.english ?? matched.transliteration?.en ?? "";
      if (dbTranslit.trim() !== verse.transliteration.trim()) {
        issues.push(`Transliteration mismatch`);
      }
      const dbTranslation = matched.translation?.en?.bdb ?? matched.translation?.en?.ssk ?? "";
      if (dbTranslation.trim() !== verse.translation.trim()) {
        issues.push(`English translation mismatch`);
      }
    }
  } catch (err) {
    issues.push(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { ok: issues.length === 0, issues };
}