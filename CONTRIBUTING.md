# Contributing to Sri Guru Granth Sahib Ji Reader

Thank you for your interest in contributing. This is a devotional reading app —
every change should treat Gurbani text, translations, and attribution with care
and respect.

Please read this file together with [`README.md`](./README.md) (what the app
does), [`AGENTS.md`](./AGENTS.md) (repo working rules), our
[Code of Conduct](./CODE_OF_CONDUCT.md), and our
[Security Policy](./SECURITY.md).

## Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Scripts](#scripts)
- [Where to look](#where-to-look)
- [Branching and commits](#branching-and-commits)
- [Pull request checklist](#pull-request-checklist)
- [Coding standards](#coding-standards)
- [Domain rules you must not break](#domain-rules-you-must-not-break)
- [Testing](#testing)
- [Data, attribution, and reverence](#data-attribution-and-reverence)
- [Getting help](#getting-help)

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating you agree to uphold it. Report unacceptable behaviour via a
GitHub issue or by contacting the maintainers listed in `SECURITY.md`.

## Ways to contribute

- **Report bugs:** open an issue with steps to reproduce, expected vs. actual
  behaviour, browser/OS, and screenshots where helpful. Use the bug template.
- **Suggest features:** open an issue with the problem, proposed behaviour,
  and who it helps. Use the feature template. Small, focused proposals merge
  fastest.
- **Fix bugs / add features:** fork, branch, code, test, and open a PR.
- **Improve data and docs:** SGPC year calendars, translation labels,
  README diagrams, and typo fixes are all welcome.
- **Triage and review:** reproduce reported bugs, confirm fallbacks, and
  review open PRs.

No contribution is too small. Docs and test-only PRs are appreciated.

## Development setup

Requirements: **Node.js 20+** (CI uses Node 22, see [`.nvmrc`](./.nvmrc)),
npm, and internet access (BaniDB at build time; Hukamnama/search at runtime).

```bash
git clone https://github.com/mithun-srinivasan/srigurugranthsahib.git
cd sggs-reader/sggs-reader   # repo root is the folder containing package.json
npm install
npm run dev                  # http://localhost:3000
```

Production build (pre-renders the ~51-Ang hot set + 5 banis; remaining Angs
and print pages are on-demand ISR):

```bash
npm run build
npm run start
```

Optional: copy `.env.local` only if you need a remote calendar base URL:

```bash
NEXT_PUBLIC_SGPC_CALENDAR_BASE_URL=https://example.com/data
```

Never commit `.env*`, `.vercel/`, `.next/`, or `test-results/`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build + static generation |
| `npm run start` | Serve the production build locally |
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm run lint` | ESLint over the repo (must report 0 errors) |
| `npm run validate:sgpc` | Validate every `public/data/sgpc-<year>.json` |
| `npm run test` | Playwright suite, headless Chromium |
| `npm run test:ui` | Playwright interactive UI mode |

## Where to look

| I want to … | Start here |
| --- | --- |
| Change how a verse renders | `components/VerseCard.tsx` + `lib/types.ts` |
| Change reader settings / themes | `components/ReaderControls.tsx` + `components/ReaderPrefsProvider.tsx` |
| Change bookmarks, notes, highlights, progress | `components/*Provider.tsx` + `lib/backup.ts` |
| Change the Hukamnama | `app/actions.ts` + `lib/data.ts` + `components/HukamnamaCard.tsx` |
| Change the calendar / Gurpurabs | `app/calendar/page.tsx` + `lib/sgpc.ts`, `lib/nanakshahi.ts`, `lib/gurpurabs.ts` |
| Add a keyboard shortcut | `lib/shortcuts.ts` + `components/ShortcutHelp.tsx` |
| Change offline behaviour | `public/sw.js` + `components/ServiceWorkerRegistrar.tsx` |
| Add a new year of SGPC dates | `public/data/sgpc-*.json` + `scripts/validate-sgpc.mjs` |

Read `AGENTS.md` before changing month math, Hukamnama sourcing, nav
behaviour, or the service worker — it documents the contracts CI and specs
rely on.

## Branching and commits

- Fork the repo and create a feature branch from `main`:
  `git checkout -b feat/short-description` (or `fix/…`, `docs/…`, `data/…`).
- Keep PRs focused: one feature or fix per PR.
- Write imperative commit messages in the repo style, e.g.
  `Add Hindi placeholder to search modes`, `Fix calendar month overflow`.
- Before pushing, verify with `git status`, `git diff`, and
  `git log --oneline -10`, and stage only intended files.
- Never commit generated or secret artefacts: `next-env.d.ts` churn,
  `.next/`, `test-results/`, `playwright-report/`, `.vercel/`, `.env*`.

## Pull request checklist

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` reports 0 errors.
- [ ] `npm run validate:sgpc` passes (required if you touched `public/data/`).
- [ ] `npm run test` passes if you touched UI or data flows.
- [ ] New keyboard shortcuts are registered in `lib/shortcuts.ts` and render
      in the `?` modal.
- [ ] New user-data keys are added to `BACKUP_KEYS` in `lib/backup.ts`.
- [ ] Service-worker changes bump `CACHE` in `public/sw.js`.
- [ ] Upstream-dependent specs assert live-content **or** the designed
      fallback, never a live-only snapshot.
- [ ] `README.md` test count, diagrams, and structure map match the change.
- [ ] PR description explains the problem, the fix, and how it was verified.

CI (`.github/workflows/ci.yml`) runs typecheck → lint → `validate:sgpc` →
Playwright on every push and PR.

## Coding standards

- TypeScript strict, Next.js App Router, Tailwind CSS v4, Lucide icons.
- Every source file starts with a header block: file path on line 1, a dashed
  separator on line 2, then what the file does and why it exists. Copy the
  style from `lib/sgpc.ts` or `components/GurpurabCalendar.tsx`.
- Section comments (`// -- Section name ---…`) mark logical blocks in longer
  files. Explain *why*, never *what* — no per-line narration.
- Update file headers, `README.md` diagrams, and `AGENTS.md` when behaviour
  changes. A stale comment is worse than none.
- Key handlers must ignore events from `INPUT` / `TEXTAREA` / `SELECT` /
  `contentEditable` and from Alt/Ctrl/Cmd-modified presses.
- New images use `next/image` with `sizes`; new audio uses `preload="none"`.
- Keep `fetchUpstream` timeouts/retries bounded — the build fetches live
  upstream data and one slow response must not kill it.
- Keep the stable test hooks intact: `aria-label="Full calendar"`,
  `header.fixed` translate classes, `main h2` month title.

## Domain rules you must not break

These come from `AGENTS.md` and are the most common review blockers:

1. **Hukamnama source is `https://hs.sgpc.net/` only.** Never point the
   loader at `www.sgpc.net/hukamnama/` or make BaniDB the primary source.
   Parse the embedded `#hukamnamaPdfData` JSON plus audio URLs, send
   browser-like headers (Cloudflare fronts the host), and always fail soft
   to the SGPC-link fallback. BaniDB is enrichment + today/yesterday
   fallback only. Cache 6 hours.
2. **Never hard-code a year's dates in a component.** Consume the
   `useSgpcCalendar` hook from `lib/sgpc.ts`. Publishing a new year means
   copying `sgpc-558.json` → `sgpc-559.json`, refreshing month starts/day
   counts and Gurpurab dates from the new SGPC jantri (lunar events move —
   never copy blindly), running `npm run validate:sgpc`, and redeploying.
3. **Keyboard shortcuts:** register every shortcut in `lib/shortcuts.ts`.
4. **Top bar contract:** scroll-up OR top-edge hover reveal; never hide while
   the settings popover is open; keep the `header.fixed` selector stable.
5. **Local data:** six browser-local slices (bookmarks, notes, highlights,
   progress, prefs, notification prefs). New slices follow the hydrate →
   `hydrated` guard → 500 ms debounce pattern, join `BACKUP_KEYS`, and update
   the backup card copy. Re-derivable caches (Hukamnama copy, offline search
   index, recents, SGPC JSON cache) stay out of backups. Tell users plainly
   that data lives only in their browser.
6. **Offline:** never cache cross-origin (BaniDB/SGPC) in `public/sw.js`;
   bump `CACHE` on every worker change.
7. **Performance:** home hero stays `priority`; share-card canvas must fit
   any verse length (word-wrap, auto-fit roomy-first, ellipsis last resort).

## Testing

```bash
npm run test        # headless Playwright run (Chromium)
npm run test:ui     # interactive UI mode
```

- Specs live in `tests/`, Chromium-only, dev server auto-started.
- Network-tolerant assertions are mandatory for BaniDB/SGPC specs — see the
  Hukamnama pattern in `sgpc-calendar.spec.ts`.
- One retry is configured for flaky upstream responses.
- Update the spec count in `README.md` when you add specs.

## Data, attribution, and reverence

- Scripture, translations, teekas, and pad-arth come from the
  [BaniDB API](https://github.com/KhalisFoundation/BaniDB-API). Keep source
  labels genuine — never relabel a translation as a teeka.
- The Daily Hukamnama comes from [hs.sgpc.net](https://hs.sgpc.net/).
- Review both providers' current terms before deploying publicly.
- The MIT license covers this app's code; scripture, translations, and
  third-party data remain under their providers' terms.

## Getting help

- Open a GitHub issue for bugs, features, and questions.
- For security issues, see [SECURITY.md](./SECURITY.md) — do not open a
  public issue.
- Include reproduction steps, logs, and what you already tried; maintainers
  will point you in the right direction.
