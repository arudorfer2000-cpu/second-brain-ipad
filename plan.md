# Second Brain iPad – Build Plan (draft for approval, v2)

Goal: an installable offline app (PWA) for iPad, for one user. Data stays encrypted on the iPad.
Repo: `arudorfer2000-cpu/second-brain-ipad` (app code only, never notes or keys). Base: reuse modules from the Private Diary app (crypto, storage, PWA build, tests). Separate passcode from the diary.

## Language rule (new)
- The whole UI, all docs (README, user guide, CLAUDE.md, test specs) and code comments are in **English only**, regardless of the language used in chat.
- Enforced by a script check in CI (fails the build if German UI strings are found in `src/i18n`), not just by convention.

## Design (decided)
- **Home = E2** (wiki main page): welcome with counts, Recently changed, Categories, Wiki upkeep (red links, orphans, stubs, open talk pages), Tools, A to Z.
- **Note view = E1** (article): tabs Note/Talk/History, infobox, table of contents, red links, categories at the bottom, left navigation.
- **Ask AI** button in the top bar of every view: pick notes -> approval screen shows exactly what will be copied -> Copy -> paste into the Claude app on the iPad. No key, no login, nothing is sent by the app.
- **Graph view**: notes as nodes, links as lines, colour by type, tap opens the note, filter by category.
- **Dark mode switch (new)**: Light / Dark / Follow system, in the top bar and in Settings. Remembered on the device. Applies to every screen, including the graph, infobox, red links and the approval screen. Colour contrast at least WCAG AA in both themes.

## iPad fit (new, applies to every screen)
- Reference devices: iPad 10th gen (1180x820 pt landscape, 820x1180 portrait) and 13-inch iPad (1376x1032). Layout adapts to both orientations; in portrait the left navigation folds behind a menu button and columns collapse.
- Touch targets at least 44x44 pt, checked by an automated test that fails the build otherwise.
- Respect safe areas, no hover-only actions, on-screen keyboard must not cover the editor, text size follows system setting.
- Screenshot tests at 1180x820, 820x1180 and 1376x1032 in light and dark.

## Steps (each: one output, one check)
| # | Step | Output | Check |
|---|------|--------|-------|
| 0 | Project skeleton, PWA shell, offline, CI workflow | empty app runs in browser, installable | build + offline test (service worker) |
| 1 | Encrypted storage + lock screen (PIN / passphrase) | create / unlock vault | crypto unit tests, wrong-PIN test |
| 2 | Theme system with light/dark switch (built early so every screen uses it) | switch works, persists | e2e: toggle, reload, system-follow; contrast test |
| 3 | Import vault zip, read Markdown/frontmatter/wiki links, build index | notes visible | import test vault, counts match |
| 4 | E2 home page + navigation | home with real counts | e2e + screenshot compare (light and dark) |
| 5 | E1 article view (infobox, TOC, red links, backlinks) | read a note | e2e: follow link, red link |
| 6 | Offline search with filters from/in/after/before/type, confidence | search page | test cases from the Enterprise Search spec |
| 7 | Edit, new note, templates (project / decision / conversation / lesson / daily), trash | write notes | e2e: create, change, restore |
| 8 | Ask AI + approval screen | copy to clipboard | test: text on approval screen == copied text |
| 9 | Graph view | interactive map | test: nodes/edges == links in index |
| 10 | Digest, decision search, document draft (Word export) | tools | compare with PC script output |
| 11 | Health tools: broken links, duplicates, no description, contradictions | health page | test vault with planted faults |
| 12 | File import: Word/Excel/PowerPoint/text/HTML, PDF, OCR | file -> note | one test file each; password-protected files reported, not opened |
| 13 | WhatsApp import into separate space (own passphrase, groups excluded, summary only by default) | import | synthetic export |
| 14 | Backup/export zip + PC transfer tool (local network, PIN) | round trip without overwrite | round-trip test |
| 15 | Hardening: accessibility (>=44pt targets), CSP, audit, English-only check | acceptance list | audit script green |
| D | English documentation: README, user guide (with screenshots), test spec | docs in repo | docs lint: no German; every feature in the guide |

## What I can verify in the cloud, and what I cannot
- Verifiable: build, unit and e2e tests in a headless browser, offline behaviour, crypto, import/export, both themes in screenshots.
- Not verifiable: how it looks and feels on your real iPad, home-screen install, Apple-specific behaviour. You accept each block on the iPad.

## Needed from you
1. Approve this plan (staged build: steps 0-11 first = usable core, then 12-15).
2. Create the empty repo `second-brain-ipad` and give push access, or I deliver a zip plus `PUBLISH-TO-GITHUB.bat` as for the diary app.

## Not in the first core
Step 12 is now built for Office, PDF, text, CSV and HTML (OCR still open). WhatsApp import (step 13) is built, see plan-whatsapp.md. The PC transfer tool (step 14) was pulled forward into the first release because there is no other private way to move the vault from the PC to the iPad. The Business vault does not go on the iPad (Privat only).
