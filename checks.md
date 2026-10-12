# Checks (written before the work)

Verdicts are filled in by the test run. Format: step | requirement | check | verdict | evidence

| Step | Requirement | Verdict | Evidence |
|---|---|---|---|
| 0 | App builds to static files that work under a sub-folder URL | PASS | e2e serves dist under /second-brain-ipad/ and runs every test there |
| 0 | Works offline after first load | PASS | e2e step 0: service worker controls page, context offline, reload shows lock screen, unlock and main page work |
| 0 | Installable | PASS (manifest only) | e2e checks display standalone, 192 and 512 icons, relative start_url. Actual Add to Home Screen on iPadOS: MANUAL |
| 1 | Create vault, lock, unlock with right passcode | PASS | unit crypto.test + e2e step 1 and 1b |
| 1 | Wrong passcode refused | PASS | unit + e2e step 1b (error shown) |
| 1 | Passphrase 10-128 chars accepted, shorter refused; 6-digit accepted | PASS | unit validate secrets (boundaries 9/10/128/129, 5/6/7 digits); NFKC full-width digits |
| 1 | Nothing readable in IndexedDB | PASS | e2e step 1b dumps meta+notes stores, 6 known words absent, size > 1000 |
| 1 | Recovery key unlocks vault | PASS | unit + e2e (lower-case input accepted) |
| 2 | Light/Dark/Auto switch works, persists, Auto follows system | PASS | e2e step 2 incl. reload and emulated dark scheme |
| 2 | Contrast >= 4.5 in both themes | PASS | scripts/contrast.mjs, negative-tested (failed on a deliberately bad colour) |
| 3 | Import zip counts, exclusions | PASS | e2e: Added 8, skipped 5 (_tools, raw, .git, graph.json, png); re-import: unchanged 8 |
| 3 | Frontmatter, wiki links, aliases, backlinks | PASS | unit vault.test (found and fixed a bug with links in frontmatter) |
| 4 | Home shows real counts, recent, categories, upkeep, tools, A-Z | PASS | e2e step 4 |
| 5 | Article: infobox, TOC, red link, backlinks, categories, tabs | PASS | e2e step 5 |
| 5 | Following a link and a red link works | PASS | e2e step 5 (red link opens New note with title filled) |
| 6 | Search filters, confidence, duplicate merge | PASS | unit + e2e step 6 (type, after, before, in, confidence low). Filter from: unit only |
| 7 | Create from template, edit, save, trash, restore | PASS | e2e step 7 (decision template, [[ suggestion, save, trash, restore, red link resolved). Other templates: not each exercised |
| 7 | History keeps previous versions | PASS | e2e step 7 (restore version) |
| 8 | Approval text == clipboard | PASS | e2e step 8 reads the real clipboard; private note left out and listed |
| 8 | No network request during Ask AI | PASS | e2e step 8 records requests while asking, none outside the app origin. audit bans fetch/XHR/WebSocket in src |
| 9 | Graph nodes == notes | PASS | e2e step 9 (circle count = note count) |
| 9 | Graph edges == resolved links | PASS (unit exact; e2e lower bound) | unit counts edges independently on the fixture (3); e2e only checks >= 4 after edits |
| 10 | Digest, decision search, document draft (Word) | PASS (own logic) | unit + e2e download; docx opened with python-docx. Not compared with the PC Enterprise Search script output (different date basis): NOT VERIFIED against it |
| 11 | Health detects planted faults | PASS | unit + e2e step 11 (orphan, stub, contradiction, duplicate, open talk) |
| 15 | Every interactive element >= 44 px, no sideways scroll | PASS | e2e step 15: 15 pages x 3 sizes (1180x820, 820x1180, 1376x1032) x 2 themes. Inline links inside paragraphs are exempt (WCAG 2.5.8) |
| 15 | No German strings in UI source | PASS | scripts/english-only.mjs, negative-tested |
| 15 | No notes/keys/backups in repo | PASS | scripts/audit.mjs, negative-tested |
| 15 | CSP present, connect-src 'self' | PASS | audit checks the meta tag |
| 14 | Backup file is encrypted; backup, erase, restore into clean install, unlock, same note count | PASS | e2e step 14: backup file contains none of 3 known words; restored vault shows the same count and opens a note |
| 14 | PC transfer tool: PIN required, downloads vault zip (md only), uploads never overwrite, name flattened, lockout | PASS | tests/transfer.test.py, 4 tests against the real server on localhost. Windows Firewall prompt and iPad Safari download/upload flow: MANUAL |
| ALL | Looks and feels right on the real iPad | PENDING USER | MANUAL acceptance: install, Safari storage behaviour, clipboard prompt, Argon2id unlock speed, keyboard covering the editor |

Last run: 24 of 24 JS tests and 4 of 4 PC tool tests pass (`npm test`), `npm run audit` passes.

## Stage 2 checks (written before the work): Office documents and Enterprise Search on the iPad
| Step | Requirement | Check | Verdict | Evidence |
|---|---|---|---|---|
| 12 | Word, Excel, PowerPoint, text, CSV, HTML text is extracted | unit tests with generated fixtures (python-docx, openpyxl, hand-built pptx) | | |
| 12 | PDF text is extracted in the browser | e2e with a generated PDF | | |
| 12 | Password-protected PDF and non-Office bytes with an Office extension are reported, not opened | e2e + unit | | |
| 12 | Review screen lists every file with status and nothing is filed before confirmation | e2e: notes count unchanged before confirm | | |
| 12 | Filing stores the original encrypted; downloaded original has identical SHA-256 | e2e | | |
| 12 | Plaintext of documents is not readable in IndexedDB (notes and files) | e2e dump | | |
| 12 | Same file twice is detected as duplicate by SHA-256 (also with another name) | e2e | | |
| 12 | Document note has frontmatter type document, format, source name, sha256, date, folder by year | unit + e2e | | |
| 12 | Backup contains the originals (encrypted) and restore brings them back | e2e round trip with download of original after restore | | |
| 12 | Trash/delete of a document note removes the stored original only on Delete for good | e2e | | |
| 10 | Search finds text inside filed documents; filter type:docx / type:pdf / type:xlsx works | e2e + unit | | |
| 10 | Search log is stored encrypted, can be trimmed to 90 days and cleared | e2e + unit | | |
| 10 | Sources page lists local sources with counts; says honestly that e-mail and cloud are searched by the Claude app, not by this app | e2e | | |
| 10 | Very short query shows a hint but still returns results | e2e | | |
| 15 | Touch targets, English-only, audit, contrast still pass with the new screens | existing scans extended | | |

## WhatsApp import checks (written before the work, plan-whatsapp.md)
| Step | Requirement | Check | Verdict | Evidence |
|---|---|---|---|---|
| W1 | Parser reads iOS and Android exports, German and English, 24h and 12h AM/PM, multi-line messages | unit tests with synthetic exports in 4 formats, exact message counts | PASS | tests/whatsapp.test.mjs: iOS and Android, German 24h and English 12h AM/PM, exact counts (5 messages + 1 media + 1 system), multi-line kept |
| W1 | System lines and media markers are not counted as messages; media is counted | unit test | PASS | unit tests: system 1, media 1 in all four formats; media text not kept |
| W1 | Date order (day first or month first) is detected; truly ambiguous exports are flagged and can be switched in review | unit test + e2e | PASS | unit test (dmy, mdy, ambiguous flag, override) + e2e: Cleo export shows 2026-04-03, switch to month first shows 2026-03-04 |
| W2 | Chats with more than 2 senders are excluded by default and can be included per chat | unit + e2e | PASS | unit test (3 senders, group-created hint) + e2e: group unticked, Import disabled, included on request |
| W3 | Summary lists participants, period, counts, topics, flagged decisions/dates/open questions; a planted decision is found | unit test | PASS | unit test: counts, period, planted decision, date and open question found |
| W3 | Summary mode keeps no message text except up to 10 flagged lines cut at 140 chars | unit test: unflagged planted words absent from stored data | PASS | unit test: 40 ordinary lines and a 400-char decision; unflagged words absent, flagged <=10 lines at <=140 chars. Deviation from the plan wording: up to 10 flagged lines ARE kept (that is how decisions are shown); stated on the review screen |
| W4 | Space has its own passphrase (min 10 chars, differs from main passcode) and own recovery key shown once | e2e | PASS | e2e: short and same-as-main rejected, mismatch rejected, recovery key shown once, Continue disabled until ticked |
| W4 | Wrong space passphrase fails; space stays locked after main lock | e2e | PASS | e2e: main lock keeps space locked, wrong passphrase error, right one opens, Lock closes; recovery key unlocks (wrong key rejected) |
| W4 | No chat words readable in IndexedDB (files store, meta) | e2e dump | PASS | e2e dump of notes, files and meta: no chat words, no chat names |
| W4 | Main vault search and Ask AI never see chat content, locked or unlocked | e2e | PASS | e2e: main search 0 results for chat words, Ask AI list has no chats, no non-same-origin request |
| W5 | Review screen first; nothing filed before confirm | e2e: chat count unchanged before confirm | PASS | e2e: after review and page reload the space shows No chats yet; stored only after Import selected |
| W5 | Same export twice is detected; longer export of the same chat appends only new messages | e2e | PASS | e2e: duplicate flagged (also after append), longer export shows 8 messages (2 new), chat then has 8 |
| W6 | Reading, search inside the space (full-text mode) and Ask AI with approval screen; clipboard text equals displayed text | e2e | PASS | e2e: full-text hit in group chat, none for ordinary text of a summary-only chat, flagged line searchable, filter, clipboard text equals approval text |
| W7 | Backup contains the space (encrypted); restore brings it back; unlock with space passphrase shows same chats | e2e round trip | PASS | e2e: backup has no chat words and a wa entry; after wipe and restore the space unlocks and shows the same chats and messages. Found by this check: restore corrupted sealed JSON records (also the search log); fixed with a bin flag and a regression assertion for the log |
| W8 | Tap targets, English-only, audit (no network), contrast pass with the new screens | existing scans extended | PASS | e2e W8 scan of space, review and chat pages at three sizes; audit, english-only (narrow marked exception for German keywords, negative-tested), contrast ok |

## Deadlines view checks (written before the work)
Convention taken from the vault tooling (struktur.py `due`): `type: verpflichtung`, `rhythmus` (daily/weekly/monthly/yearly, German or English), `start`, optional `zuletzt`. Addition: one-time `frist` (also `due`, `deadline`).
| Step | Requirement | Check | Verdict | Evidence |
|---|---|---|---|---|
| F1 | Next due date matches the vault tool rules: daily, weekly, monthly with month-end clamping (31 Jan -> 28/29 Feb), yearly with leap day (29 Feb -> 28 Feb), `zuletzt` moves the next date, start in the future | unit tests with hand-computed expected dates, and a cross-check against `struktur.py` run on the same inputs | PASS | tests/due.test.mjs hand-computed cases (31 Jan -> 28 Feb, 29 Feb yearly -> 28 Feb, zuletzt, future start) AND ad hoc cross-check against struktur.next_due on 6000 random cases: 0 mismatches (cross-check not in CI because the tool lives outside the repo) |
| F1 | Overdue, today and within-horizon split is exact; invalid rhythm or start is listed as a problem, not dropped | unit test | PASS | due.test.mjs dueList: exact split, horizon 0/7/90, invalid rhythm, missing start and bad date listed under problems |
| F1 | One-time `frist` works, done notes (status done/abgeschlossen/fertig) are left out, trashed and private notes behave like in the rest of the app | unit test | PASS | due.test.mjs: frist/due/deadline, done status left out, notes without deadline left out. Trashed notes are not in the index, so they never appear |
| F2 | Deadlines page lists overdue, due soon and later with relative wording; horizon switch works; empty state | e2e with planted notes and fixed `today` | PASS | tests/due.e2e.test.mjs test 1: 2 overdue, 2 soon, 1 later, 1 needs attention with relative wording; horizon 30 moves Rent; empty state |
| F2 | Mark done sets `zuletzt` to today in the note, keeps the old text in History, and the next date moves | e2e | PASS | due.e2e test 2: zuletzt written, rest of the note unchanged, History tab lists the old version, row moves from overdue to tomorrow |
| F2 | Home page and navigation show counts and link to the page; template Obligation creates a valid note | e2e | PASS | due.e2e test 3: infobox Next due, home badge and link, template Obligation creates type verpflichtung and shows on the page |
| F2 | Tap targets, English-only, audit, contrast pass on the new page | existing scans extended | PASS | due.e2e test 4: three sizes, both themes, no sideways scroll, no network; audit, english-only (src/due.js added to the marked keyword exception), contrast ok |

## Weekly review checks (written before the work)
Rules mirror the vault tool (`struktur.py review`): week = 7 days ending on the end date, month = 30 days; new = created in the period (`created`/`erstellt`), changed = edited in the period and not new; decisions = decision notes (adr, decision) edited in the period; open tasks = unchecked `- [ ]` lines in notes edited in the period; contradictions = count. Additions for the app: due and overdue items from Deadlines, filed documents.
| Step | Requirement | Check | Verdict | Evidence |
|---|---|---|---|---|
| R1 | Period boundaries: week and month, inclusive start and end day in local time, items just outside are excluded | unit tests with notes on the boundary | PASS | tests/review.test.mjs: week and month, 00:00 in, 23:59:59.999 in, next day out, month ends, leap day, DST weeks |
| R1 | New vs changed is exclusive; trashed notes are never listed (they are not in the index); private notes are listed on screen (own device) but stay excluded from Ask AI; tasks are only taken from notes edited in the period and checked boxes are not open | unit tests | PASS | review.test.mjs: new = created in period (even if edited outside), changed = edited and not new, checked and old-note tasks excluded; trashed notes are not in the index; private handled in Ask AI (see R2 e2e) |
| R1 | Cross-check against `struktur.review` counts on the same synthetic vault | ad hoc run with the vault tool | PASS | ad hoc run on a 13-note synthetic vault with set mtimes: new, changed, decisions and tasks lists identical for week and month (not in CI: the tool lives outside the repo) |
| R2 | Page shows the sections with counts and links; week/month switch; end date can be moved back; empty state | e2e with planted notes and fixed end date | PASS | tests/review.e2e.test.mjs tests 1 and 2: sections, new vs changed, month switch, moving the end date, empty state |
| R2 | Save as report writes `Reports/Review-<period>-<end>.md` only on tap, type report, links to notes, no second note on a second tap (it updates the same path and keeps History) | e2e | PASS | review.e2e test 3: nothing before the tap, path Reports/Review-week-<end>.md, wiki links not red, second tap leaves exactly one report |
| R2 | Ask AI about the period selects the new and changed notes and goes to the approval screen; private notes stay excluded | e2e | PASS | review.e2e test 4: notes selected, approval text has no content of the private note, left-out notice shown |
| R2 | `today` uses the local date, not UTC (daily note, backup name, templates) | unit test with a fixed clock near midnight | PASS | review.e2e test 6: New York clock 23:30 on 12 Oct (UTC 13 Oct): daily note is Daily/2026-10-12.md. Bug found and fixed: today() used the UTC date |
| R2 | Home page and navigation link; tap targets, English-only, audit, contrast pass on the new page | existing scans extended | PASS | nav and home Tools link; review.e2e test 5 (three sizes, both themes, no network); audit, english-only, contrast ok |

## Thinking modes checks (tests written before the UI)
Modes are plain text added to the Copy for Claude request: Answer (original wording), Challenge, Pattern, Brainstorm. Nothing is sent by the app.
| Step | Requirement | Check | Verdict | Evidence |
|---|---|---|---|---|
| M1 | Four modes with labels and distinct instructions; Answer keeps the original wording; the other three stay tied to "the notes below"; unknown mode falls back to Answer | unit tests | PASS | tests/modes.test.mjs M1 to M4 |
| M2 | Note page has Challenge, Pattern and Brainstorm; each opens the approval screen with its own instruction and only that note | e2e | PASS | tests/modes.e2e.test.mjs K1 (all three modes, body included, other notes absent) |
| M2 | Ask page has the mode choice; Answer is the default and gives the original text; other modes change the text and keep the question | e2e | PASS | K2 and K3 |
| M2 | Copied clipboard text equals the reviewed text; private notes stay out in every mode | e2e with clipboard read | PASS | K4 |
| M2 | Lock and unlock reset the mode; the top Ask AI button starts in Answer; no request leaves the device | e2e | PASS | K2 (after a thinking mode was used) and K5. Two of my first test versions failed (wrong note path, state carried over); the second one exposed a real behaviour gap (mode stuck after a thinking button) which is now fixed in the app, not in the check |

## Kanban checks (tests written before the UI)
Board over the `status` frontmatter key. Moving a card writes only that key.
| Step | Requirement | Check | Verdict | Evidence |
|---|---|---|---|---|
| B1 | Status words map to Open, In progress, Done or Other; case and separators ignored; German words work | unit tests | PASS | tests/kanban.test.mjs B1, B2 |
| B1 | Notes without status or in the trash are not on the board; columns sorted by title; canonical values map back to the same column | unit tests | PASS | B3, B4 (count check: exactly the five notes with a usable status) |
| B2 | Board shows cards in the right columns; menu link; empty state | e2e | PASS | tests/kanban.e2e.test.mjs C1, C5 |
| B2 | Move changes only the status line (other frontmatter and body kept) and persists; Other cards can be moved; empty Other column disappears | e2e reading the editor source | PASS | C2, C3 |
| B2 | Survives lock and unlock; trashed note leaves the board; tap targets at least 44 px; no network | e2e | PASS | C3, C4 |

Full run after both features: 94 of 94 JS tests, PC tool tests, audit, English-only (25 files) and contrast pass.
