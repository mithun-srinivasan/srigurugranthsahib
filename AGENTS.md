<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SGGS Reader — Agent Rules

Single instruction file for every AI coding agent on this repo. `README.md`
describes *what the app does*; below is *how to work on it without breaking
it*. Follow all ten rules on every change.

---

## 1. Comments (read this before annotating)

- **Every source file starts with a header block**: file path on line 1, a
  dashed separator on line 2, then *what* the file does and *why it exists*.
  Copy the style from `lib/sgpc.ts` or `components/GurpurabCalendar.tsx`.
- **Section comments** (`// -- Section name ---...`) mark each logical block
  inside longer files (state, effects, handlers, render). Keep them short.
- **Explain *why*, never *what***: `// Cloudflare challenges Node fetches —
  hence browser headers` is useful; `// increments i by 1` is noise and must
  not be added. Do **not** comment every line — per-line narration rots on
  the first refactor and hides the logic that actually needs explaining.
- **Update the header when behaviour changes.** A stale doc comment is worse
  than none: if you change month math, Hukamnama sourcing, or nav behaviour,
  the file header, `README.md` diagrams, and this file must match the code.
- `public/data/*.json` cannot carry comments (JSON) — document year releases
  in `README.md` (“SGPC calendar releases”) instead.

## 2. SGPC calendar years (no-code-change releases)

- Source of truth per year: `public/data/sgpc-<nanakshahiYear>.json`
  (`nanakshahiYear`, `gregorianSpan`, `source`, 12 `months`, `gurpurabs`).
- `lib/sgpc.ts` (`useSgpcCalendar`) resolves the Nanakshahi year from the
  viewed date, paints bundled Samvat 558 instantly, then upgrades to the
  year JSON + localStorage cache. **Never hard-code a year's dates in a
  component** — always consume the hook (or pass its `months`/`gurpurabs`
  into `toNanakshahi` / `sangrandOn` / `getUpcomingGurpurabs`).
- Publishing a new year = copy `sgpc-558.json` → `sgpc-559.json`, refresh
  month starts/day counts and Gurpurab dates from the new SGPC jantri,
  run `npm run validate:sgpc`, redeploy. Lunar events (Guru Nanak Parkash,
  Bandi Chhor) **move every year — never copy them blindly**.
- `NEXT_PUBLIC_SGPC_CALENDAR_BASE_URL` may point the loader at remote JSON
  instead of same-origin `/data`.
- Keep `lib/nanakshahi.ts` + `lib/gurpurabs.ts` as the offline fallback for
  the bundled year; they must stay in sync with `sgpc-558.json`.

## 3. Hukamnama: hs.sgpc.net forever

- The Daily Hukamnama comes from **`https://hs.sgpc.net/` only**. Never point
  the loader back at `www.sgpc.net/hukamnama/` (a static 2022 attachment page
  with no daily content) or make BaniDB the primary source.
- Parse the embedded `#hukamnamaPdfData` JSON (date, Ang, Gurmukhi, Punjabi,
  English) + the `hukamnamaaudio/` and `kathaaudio/` MP3 URLs. `hs.sgpc.net`
  publishes **no daily image** — audio is the media; the card's `<img>` slot
  is legacy-only and must keep its `onError` hiding.
- Always send browser-like `User-Agent`/`Accept` headers: Cloudflare fronts
  hs.sgpc.net and serves challenge pages to default Node fetches (this is
  why media silently vanished when deployed). Detect `__CF$cv$params`
  without `hukamnama-card` and fail soft.
- BaniDB is **enrichment only** (richer verses when it carries the same Ang)
  plus a today/yesterday fallback when SGPC is unreachable. The card must
  never throw: worst case it shows the SGPC-link fallback.
- Cache 6 hours (`revalidate: 21600`); the Hukamnama changes at Amrit Vela.

## 4. Keyboard shortcuts

- Canonical list lives in `lib/shortcuts.ts` and renders in `ShortcutHelp`
  (`?` modal). **Adding a shortcut without adding it there is a bug.**
- Page-specific arrows are allowed (Ang reader: prev/next Ang; calendar:
  prev/next month) because only one such page is mounted at a time. Every
  key handler must ignore events from `INPUT`/`TEXTAREA`/`SELECT`/
  `contentEditable` and from Alt/Ctrl/Cmd-modified presses.
- Disambiguate shared keys in descriptions, e.g. `← / →` covers both pages.

## 5. Top-bar visibility contract

- `components/NavigationBar.tsx` reveals on **scroll-up OR top-edge hover**
  (`TOP_PEEK_ZONE = 96px`, `PEEK_HIDE_DELAY = 300ms`); focus mode uses
  hover-peek exclusively. Hover is additive — never hide the bar while the
  settings popover is open. Keep the `header.fixed` selector stable: the
  hover-reveal spec asserts on its translate classes.

## 6. Local data & backup

- Six browser-local slices, no sync: `sgs-reader-bookmarks`,
  `sgs-reader-notes`, `sgs-reader-highlights`, `sgs-reader-progress`,
  `sgs-reader-prefs`, `sgs-reader-notif-prefs`
  (+ `sgs-reader-last-backup`, `sggs-sgpc-*` cache, `sggs-hukamnama-cache`,
  `sgs-reader-offline-index`, `sgs-reader-recent-searches` — re-derivable
  caches, deliberately excluded from backups).
- Full backup/restore lives in `lib/backup.ts` (one timestamped JSON, strict
  envelope validation). Restoring writes keys then **reloads the page** so
  all providers rehydrate — providers hydrate once on mount by design.
- New user-data features must add their key to `BACKUP_KEYS`, follow the
  hydrate → `hydrated` guard → 500 ms debounce pattern from
  `BookmarksProvider`, and update the bookmarks backup card copy.
- Tell users plainly in-UI that data lives only in their browser.

## 7. Offline (PWA) rules

- `public/sw.js`: bump `CACHE` (`sggs-reader-vN`) on **every** worker change
  or clients keep the old worker. Keep `/calendar` in `SHELL_URLS`.
- Same-origin `/data/*.json` uses stale-while-revalidate so year calendars
  work offline after one visit. Never cache cross-origin (BaniDB/SGPC) —
  upstream freshness + opaque-response risks.
- After touching the worker, test: load online → go offline → revisit `/`,
  an Ang, and `/calendar`.

## 8. Performance rules

- Home hero (`golden-temple-night.png`, ~1 MB) uses `priority` +
  `fetchPriority="high"` — do not revert to lazy. Prefer AVIF/WebP at ≤85
  quality if replacing the asset (Next allows 75 by default — keep custom
  qualities out of the config unless the asset truly needs them).
- Build pre-renders a small hot set (~51 Angs + 5 banis; all other Angs
  and all print pages are on-demand ISR with weekly `revalidate`) with live
  BaniDB fetches: keep `fetchUpstream` timeouts/retries bounded and
  `staticPageGenerationTimeout` at 120 s. Hot-set ISR is the storage fix —
  do not restore full-Ang `generateStaticParams` without checking Vercel
  Deployment Storage (10 GB Hobby limit).
- New images: `next/image` with `sizes`; new audio: `preload="none"`.
- Share-card canvas (`VerseCard`): must fit any verse length — word-wrap
  every block, auto-fit fonts roomy-first, ellipsis only as a last resort.
  Covered by the share-download spec; never hard-cap lines or draw off-canvas.

## 9. Testing rules

- Playwright specs live in `tests/`, Chromium-only, dev server auto-started.
  Count is tracked in `README.md` — update it when adding specs.
- Upstream-dependent specs (BaniDB/SGPC) **must be network-tolerant**: assert
  live-content **or** the designed fallback (see `sgpc-calendar.spec.ts`
  Hukamnama pattern), never a live-only snapshot. One retry is configured.
- Stable hooks for tests: `aria-label="Full calendar"`, `header.fixed`
  translate classes, `main h2` month title. Renaming them breaks specs —
  update the specs in the same commit.
- Always run before pushing: `npm run typecheck`, `npm run lint`,
  `npm run validate:sgpc`. Run `npm run test` when touching UI/data flows.

## 10. CI & git rules

- `.github/workflows/ci.yml` runs typecheck → lint → `validate:sgpc` →
  Playwright on every push/PR. Keep the Playwright browser install step;
  removing it breaks e2e.
- Commit messages follow the repo's imperative style
  (`"Five more features: …"`, `"Homepage: …"`). Never commit `next-env.d.ts`
  churn (dev↔build path flip), `.next/`, `test-results/`, or secrets. Verify
  with `git status`, `git diff`, `git log --oneline -10` before committing,
  and stage only intended files.
