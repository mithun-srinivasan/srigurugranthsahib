/**
 * lib/angMetadata.ts
 * ---------------------------------------------------------------------------
 * Canonical scriptural-section metadata for every Ang (1-1430) of Sri Guru
 * Granth Sahib Ji.
 *
 * Boundary data verified against BaniDB's live API (`raagWithPage` field per
 * verse) on boundary Angs.  Each lookup returns:
 *   - `realmGurmukhi` - section name in Gurmukhi (for the h1 badge)
 *   - `realmEnglish`  - section name in English (for browser-tab titles)
 *   - `composition`   - composition type (Shabad, Vaar, Sawaiye, Slok, etc.)
 *   - `author`        - primary attribution or "Various"
 *
 * The data covers 39 canonical sections.  Notable landmark compositions
 * (Sukhmani Sahib, Asa Di Var, Anand Sahib) are split as separate entries
 * for UI navigation even though BaniDB groups them under the parent Raag.
 * Every Ang in [1, 1430] is guaranteed to resolve.
 */

export interface AngSection {
  /** Section name in Gurmukhi script. */
  realmGurmukhi: string;
  /** Section name in English. */
  realmEnglish: string;
  /** Composition type (Shabad, Vaar, Sawaiye, Slok, etc.). */
  composition: string;
  /** Primary author attribution. */
  author: string;
}

/**
 * Ordered section boundaries - each entry's `start` is the first Ang of that
 * section; the section ends one Ang before the next `start` (or at 1430 for
 * the final entry).
 *
 * Verified against BaniDB's `raagWithPage` field on boundary Angs.
 */
export const SECTIONS: { start: number; meta: AngSection }[] = [
  {
    start: 1,
    meta: {
      realmGurmukhi: "ਜਪੁਜੀ ਸਾਹਿਬ",
      realmEnglish: "Japji Sahib",
      composition: "Bani",
      author: "Guru Nanak Dev Ji",
    },
  },
  {
    start: 8,
    meta: {
      realmGurmukhi: "ਸੋ ਪੁਰਖੁ",
      realmEnglish: "So Purakh (Rehras)",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji",
    },
  },
  {
    start: 12,
    meta: {
      realmGurmukhi: "ਸੋਹਿਲਾ ਸਾਹਿਬ",
      realmEnglish: "Sohila Sahib",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 14,
    meta: {
      realmGurmukhi: "ਸ੍ਰੀ ਰਾਗੁ",
      realmEnglish: "Sri Raag",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 94,
    meta: {
      realmGurmukhi: "ਮਾਝ",
      realmEnglish: "Raag Majh",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Amar Das Ji",
    },
  },
  {
    start: 151,
    meta: {
      realmGurmukhi: "ਗਉੜੀ",
      realmEnglish: "Raag Gauri",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 262,
    meta: {
      realmGurmukhi: "ਸੁਖਮਨੀ ਸਾਹਿਬ",
      realmEnglish: "Sukhmani Sahib",
      composition: "Bani / Ashtpadi",
      author: "Guru Arjan Dev Ji",
    },
  },
  {
    start: 347,
    meta: {
      realmGurmukhi: "ਆਸਾ",
      realmEnglish: "Raag Aasaa",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 462,
    meta: {
      realmGurmukhi: "ਆਸਾ ਦੀ ਵਾਰ",
      realmEnglish: "Aasa Di Var",
      composition: "Vaar",
      author: "Guru Nanak Dev Ji / Guru Angad Dev Ji",
    },
  },
  {
    start: 489,
    meta: {
      realmGurmukhi: "ਗੂਜਰੀ",
      realmEnglish: "Raag Gujri",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 527,
    meta: {
      realmGurmukhi: "ਦੇਵਗੰਧਾਰੀ",
      realmEnglish: "Raag Devgandhari",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 537,
    meta: {
      realmGurmukhi: "ਬਿਹਾਗੜਾ",
      realmEnglish: "Raag Bihagra",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 557,
    meta: {
      realmGurmukhi: "ਵਡਹੰਸੁ",
      realmEnglish: "Raag Vadhans",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 595,
    meta: {
      realmGurmukhi: "ਸੋਰਠਿ",
      realmEnglish: "Raag Sorath",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 660,
    meta: {
      realmGurmukhi: "ਧਨਾਸਰੀ",
      realmEnglish: "Raag Dhanasri",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 696,
    meta: {
      realmGurmukhi: "ਜੈਤਸਰੀ",
      realmEnglish: "Raag Jaitsri",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 711,
    meta: {
      realmGurmukhi: "ਤੋਡੀ",
      realmEnglish: "Raag Todi",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 719,
    meta: {
      realmGurmukhi: "ਬੈਰਾੜੀ",
      realmEnglish: "Raag Bairari",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji",
    },
  },
  {
    start: 721,
    meta: {
      realmGurmukhi: "ਤਿਲੰਗ",
      realmEnglish: "Raag Tilang",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 728,
    meta: {
      realmGurmukhi: "ਸੂਹੀ",
      realmEnglish: "Raag Suhi",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 795,
    meta: {
      realmGurmukhi: "ਬਿਲਾਵਲੁ",
      realmEnglish: "Raag Bilaval",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 859,
    meta: {
      realmGurmukhi: "ਗੋਂਡ",
      realmEnglish: "Raag Gaund",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 876,
    meta: {
      realmGurmukhi: "ਰਾਮਕਲੀ",
      realmEnglish: "Raag Ramkali",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Amar Das Ji",
    },
  },
  {
    start: 917,
    meta: {
      realmGurmukhi: "ਅਨੰਦੁ ਸਾਹਿਬ",
      realmEnglish: "Anand Sahib",
      composition: "Bani / Chhant",
      author: "Guru Amar Das Ji",
    },
  },
  {
    start: 975,
    meta: {
      realmGurmukhi: "ਨਟ ਨਾਰਾਇਨ",
      realmEnglish: "Raag Nat Narayan",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 984,
    meta: {
      realmGurmukhi: "ਮਾਲੀ ਗਉੜਾ",
      realmEnglish: "Raag Mali Gaura",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji",
    },
  },
  {
    start: 989,
    meta: {
      realmGurmukhi: "ਮਾਰੂ",
      realmEnglish: "Raag Maru",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1107,
    meta: {
      realmGurmukhi: "ਤੁਖਾਰੀ",
      realmEnglish: "Raag Tukhari",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1118,
    meta: {
      realmGurmukhi: "ਕੇਦਾਰਾ",
      realmEnglish: "Raag Kedara",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1125,
    meta: {
      realmGurmukhi: "ਭੈਰਉ",
      realmEnglish: "Raag Bhairav",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1168,
    meta: {
      realmGurmukhi: "ਬਸੰਤੁ",
      realmEnglish: "Raag Basant",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1197,
    meta: {
      realmGurmukhi: "ਸਾਰੰਗ",
      realmEnglish: "Raag Sarang",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1254,
    meta: {
      realmGurmukhi: "ਮਲਾਰ",
      realmEnglish: "Raag Malar",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1294,
    meta: {
      realmGurmukhi: "ਕਾਨੜਾ",
      realmEnglish: "Raag Kanara",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1319,
    meta: {
      realmGurmukhi: "ਕਲਿਆਨ",
      realmEnglish: "Raag Kalyan",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji",
    },
  },
  {
    start: 1327,
    meta: {
      realmGurmukhi: "ਪ੍ਰਭਾਤੀ",
      realmEnglish: "Raag Prabhati",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji / Guru Arjan Dev Ji",
    },
  },
  {
    start: 1352,
    meta: {
      realmGurmukhi: "ਜੈਜਾਵੰਤੀ",
      realmEnglish: "Raag Jaijavanti",
      composition: "Shabad",
      author: "Guru Nanak Dev Ji",
    },
  },
  {
    start: 1353,
    meta: {
      realmGurmukhi: "ਸਲੋਕ ਸਹਸਕ੍ਰਿਤੀ ਤੇ ਭਗਤ ਬਾਣੀ",
      realmEnglish: "Slok Sahaskriti & Bhagat Bani",
      composition: "Slok / Bhagat Bani",
      author: "Various (Kabir, Ravidas, Namdev, etc.)",
    },
  },
  {
    start: 1429,
    meta: {
      realmGurmukhi: "ਰਾਗ ਮਾਲਾ",
      realmEnglish: "Raag Mala",
      composition: "Slok",
      author: "Guru Arjan Dev Ji",
    },
  },
];

const MAX_ANG = 1430;

/**
 * Returns the scriptural-section metadata for any valid Ang number.
 *
 * Uses a reverse-linear scan through the sorted boundary table - at most 39
 * iterations for any Ang, which is effectively constant time.
 *
 * @param angId the Ang number (1-1430)
 * @returns the section metadata for that Ang
 */
export function getAngMetadata(angId: number): AngSection {
  if (angId < 1 || angId > MAX_ANG) {
    return {
      realmGurmukhi: "ਅੰਗ",
      realmEnglish: "Ang",
      composition: "\u2014",
      author: "\u2014",
    };
  }

  let matched = SECTIONS[0]!;
  for (let i = SECTIONS.length - 1; i >= 0; i--) {
    if (angId >= SECTIONS[i]!.start) {
      matched = SECTIONS[i]!;
      break;
    }
  }

  return matched.meta;
}
