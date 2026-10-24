/**
 * scripts/validate-gurbani.mjs
 * ---------------------------------------------------------------------------
 * Audits the live BaniDB Guru Granth Sahib Ji corpus used by the reader.
 *
 * The app intentionally does not vendor a second scripture corpus. This
 * validator therefore checks every configured upstream Ang before release:
 * canonical IDs, exact Ang membership, NFC Unicode, required display text,
 * English/Punjabi source translations, and the one-based Ang line sequence.
 * It never edits sacred text or invents missing translations; any discrepancy
 * is reported as a failure for source review.
 *
 * Usage:
 *   npm run validate:gurbani              # all 1,430 Angs
 *   node scripts/validate-gurbani.mjs --ang=1098
 *   node scripts/validate-gurbani.mjs --concurrency=4
 */

const BASE_URL = "https://api.banidb.com/v2/angs";
const MIN_ANG = 1;
const MAX_ANG = 1430;
const DEFAULT_CONCURRENCY = 8;
const RETRIES = 3;

function readPositiveInteger(name, fallback) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

const requestedAng = readPositiveInteger("ang", 0);
if (requestedAng && (requestedAng < MIN_ANG || requestedAng > MAX_ANG)) {
  throw new Error(`--ang must be ${MIN_ANG}-${MAX_ANG}`);
}
const concurrency = readPositiveInteger("concurrency", DEFAULT_CONCURRENCY);
const angs = requestedAng
  ? [requestedAng]
  : Array.from({ length: MAX_ANG }, (_, index) => index + MIN_ANG);

async function fetchAng(ang, attempt = 1) {
  try {
    const response = await fetch(`${BASE_URL}/${ang}`, {
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt >= RETRIES) throw new Error(`Ang ${ang}: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    return fetchAng(ang, attempt + 1);
  }
}

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAng(ang, payload, globalVerseIds, normalizationRepairs) {
  const failures = [];
  const rows = payload?.page;
  if (!Array.isArray(rows) || rows.length === 0) {
    return [`Ang ${ang}: response has no verses`];
  }

  const seenOnAng = new Set();
  rows.forEach((row, index) => {
    const label = `Ang ${ang}, line ${index + 1}`;
    const verseId = row?.verseId;
    if (!(Number.isInteger(verseId) || (typeof verseId === "string" && verseId.trim()))) {
      failures.push(`${label}: missing canonical verseId`);
    } else {
      const canonicalId = String(verseId);
      if (seenOnAng.has(canonicalId)) failures.push(`${label}: duplicate verseId ${canonicalId} on Ang`);
      if (globalVerseIds.has(canonicalId)) failures.push(`${label}: verseId ${canonicalId} occurs on multiple Angs`);
      seenOnAng.add(canonicalId);
      globalVerseIds.add(canonicalId);
    }
    if (!(Number.isInteger(row?.shabadId) || (typeof row?.shabadId === "string" && row.shabadId.trim()))) {
      failures.push(`${label}: missing canonical shabadId`);
    }
    if (row?.pageNo !== ang) failures.push(`${label}: pageNo ${row?.pageNo} does not match requested Ang`);

    const gurmukhi = row?.verse?.unicode;
    if (!present(gurmukhi)) failures.push(`${label}: empty Unicode Gurmukhi`);
    else if (gurmukhi !== gurmukhi.normalize("NFC")) normalizationRepairs.push(`${label}: Gurmukhi`);

    if (!present(row?.transliteration?.english ?? row?.transliteration?.en)) {
      failures.push(`${label}: missing English transliteration`);
    }
    if (!present(row?.translation?.en?.bdb ?? row?.translation?.en?.ssk)) {
      failures.push(`${label}: missing Sant Singh Khalsa English translation`);
    }
    const punjabi =
      row?.translation?.pu?.ss?.unicode ??
      row?.translation?.pu?.ss?.gurmukhi ??
      row?.translation?.pu?.ms?.unicode ??
      row?.translation?.pu?.ms?.gurmukhi ??
      row?.translation?.pu?.bdb?.unicode ??
      row?.translation?.pu?.bdb?.gurmukhi;
    if (!present(punjabi)) failures.push(`${label}: missing verified Punjabi translation`);
    else if (punjabi !== punjabi.normalize("NFC")) normalizationRepairs.push(`${label}: Punjabi translation`);
  });
  return failures;
}

let cursor = 0;
let completed = 0;
let failures = [];
const globalVerseIds = new Set();
const normalizationRepairs = [];

async function worker() {
  while (cursor < angs.length) {
    const ang = angs[cursor++];
    try {
      failures.push(...validateAng(ang, await fetchAng(ang), globalVerseIds, normalizationRepairs));
    } catch (error) {
      failures.push(error.message);
    }
    completed += 1;
    if (completed % 50 === 0 || completed === angs.length) {
      console.log(`[gurbani-validate] ${completed}/${angs.length} Angs checked`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, angs.length) }, worker));

if (failures.length > 0 || sacredFailures > 0) {
  for (const failure of failures) console.error(`[gurbani-validate] ${failure}`);
  console.error(`[gurbani-validate] FAILED: ${failures.length + sacredFailures} issue(s) across ${completed} Ang(s)`);
  process.exit(1);
}

console.log(`[gurbani-validate] OK: ${completed} Ang(s), ${globalVerseIds.size} unique canonical verses`);
if (normalizationRepairs.length > 0) {
  console.log(`[gurbani-validate] NFC-normalized at runtime: ${normalizationRepairs.length} upstream field(s)`);
}

// -- SACRED_VERSES check (item 7) --------------------------------------------
// Verify every hard-coded SacredVerse in lib/homeConstants.ts against BaniDB.
// Never edits sacred text — any mismatch is reported as a failure for review.
const SACRED_VERSES = [
  { title: "Mool Mantar — Opening Scripture", ang: 1,
    gurmukhi: "ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥",
    transliteration: "ikOankaar sat naam karataa purakh nirabhau niravair akaal moorat ajoonee saibha(n) gur prasaadh ||",
    translation: "One Universal Creator God. Truth Is The Name. Creative Being Personified. No Fear. No Hatred. Image Of The Undying, Beyond Birth, Self-Existent. By Guru's Grace." },
  { title: "Japji Sahib — Sacred Slok", ang: 8,
    gurmukhi: "ਪਵਣੁ ਗੁਰੂ ਪਾਣੀ ਪਿਤਾ ਮਾਤਾ ਧਰਤਿ ਮਹਤੁ ॥ ਦਿਵਸੁ ਰਾਤਿ ਦੁਇ ਦਾਈ ਦਾਇਆ ਖੇਲੈ ਸਗਲ ਜਗਤੁ ॥",
    transliteration: "pavan guroo paanee pitaa maataa dharat mahat || dhivas raat dhue dhaaee dhaaiaa khelai sagal jagat ||",
    translation: "Air is the Guru, Water is the Father, and Earth is the Great Mother of all. Day and night are the two nurses, in whose lap the whole world plays." },
  { title: "Sukhmani Sahib — Sacred Salutation", ang: 262,
    gurmukhi: "ਆਦਿ ਗੁਰਏ ਨਮਹ ॥ ਜੁਗਾਦਿ ਗੁਰਏ ਨਮਹ ॥ ਸਤਿਗੁਰਏ ਨਮਹ ॥ ਸ੍ਰੀ ਗੁਰਦੇਵਏ ਨਮਹ ॥",
    transliteration: "aad gur e namah || jugaad gur e namah || satgur e namah || sree gurdev e namah ||",
    translation: "I bow to the Primal Guru. I bow to the Guru of the Ages. I bow to the True Guru. I bow to the Great Divine Guru." },
  { title: "Bhairao — Thou Art My Father", ang: 1144,
    gurmukhi: "ਤੂ ਮੇਰਾ ਪਿਤਾ ਤੂਹੈ ਮੇਰਾ ਮਾਤਾ ॥ ਤੂ ਮੇਰਾ ਬੰਧਪੁ ਤੂ ਮੇਰਾ ਭ੍ਰਾਤਾ ॥",
    transliteration: "too meraa pitaa toohai meraa maataa || too meraa bandhap too meraa bhraataa ||",
    translation: "You are my Father, and You are my Mother. You are my Relative, and You are my Brother." },
  { title: "Anand Sahib — Eternal Bliss", ang: 917,
    gurmukhi: "ਅਨੰਦੁ ਭਇਆ ਮੇਰੀ ਮਾਏ ਸਤਿਗੁਰੂ ਮੈ ਪਾਇਆ ॥",
    transliteration: "anand bhaiaa meree maae satguroo mai paaiaa ||",
    translation: "I am in ecstasy, O my mother, for I have found my True Guru." },
  { title: "Japji Sahib — Those Who Serve", ang: 2,
    gurmukhi: "ਜਿਨਿ ਸੇਵਿਆ ਤਿਨਿ ਪਾਇਆ ਮਾਨੁ ॥ ਨਾਨਕ ਰਾਮ ਨਾਮੁ ਗੁਣ ਗਾਨੁ ॥",
    transliteration: "jin seviaa tin paaiaa maan || naanak raam naam gun gaan ||",
    translation: "Those who serve obtain honour. O Nanak, sing the Glorious Praises of the Divine Name." },
];

let sacredFailures = 0;
for (const verse of SACRED_VERSES) {
  try {
    const res = await fetch(`https://api.banidb.com/v2/angs/${verse.ang}`, {
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`[gurbani-validate] SACRED_VERSES "${verse.title}" (Ang ${verse.ang}): HTTP ${res.status}`);
      sacredFailures++;
      continue;
    }
    const data = await res.json();
    const rows = data?.page ?? [];
    const matched = rows.find((r) => r?.verse?.unicode?.trim() === verse.gurmukhi.trim());
    if (!matched) {
      console.error(`[gurbani-validate] SACRED_VERSES "${verse.title}" (Ang ${verse.ang}): Gurmukhi verse not found in BaniDB`);
      sacredFailures++;
    } else {
      const dbGurmukhi = matched.verse?.unicode?.trim() ?? "";
      if (dbGurmukhi !== verse.gurmukhi.trim()) {
        console.error(`[gurbani-validate] SACRED_VERSES "${verse.title}" (Ang ${verse.ang}): Gurmukhi mismatch`);
        sacredFailures++;
      }
    }
  } catch (err) {
    console.error(`[gurbani-validate] SACRED_VERSES "${verse.title}" (Ang ${verse.ang}): Fetch failed — ${err.message}`);
    sacredFailures++;
  }
}

if (sacredFailures > 0) {
  console.error(`[gurbani-validate] FAILED: ${sacredFailures} SACRED_VERSES issue(s)`);
  process.exit(1);
}
console.log(`[gurbani-validate] SACRED_VERSES OK: ${SACRED_VERSES.length} verse(s) verified against BaniDB`);
