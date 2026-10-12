# Progress

## 2026-10-11 first build (core, plan steps 0 to 11 and 15)
- Plan v2 approved by the owner. Staged build: core first.
- Checks written first (`checks.md`). Cloud result: 24 of 24 JS tests (unit and end-to-end) and 4 of 4 PC tool tests pass, audit scripts pass and were negative-tested.
- Found and fixed by checks: wiki links inside frontmatter lists were lost (parser); graph tap targets were 37 px (now 48); portrait menu drawer stayed open after navigating.
- Open: acceptance on the real iPad (MANUAL); push access to the GitHub repository; second release (file conversion, WhatsApp import, PC transfer tool).
- Not verified: Safari/iPadOS behaviour (home-screen install, storage rules, clipboard prompt), Argon2id speed on the iPad.
- PC transfer tool built (pc-tool/transfer_tool.py) because without it the first release had no private way to move the vault from the PC to the iPad.
- Open: file conversion, WhatsApp import, on-device summaries.

## 2026-10-11 second release part 1: Office documents and Enterprise Search on the iPad
- Owner rule: everything is used on the iPad, not on the PC. The PC Python search script is therefore not used; the PC only runs the transfer tool.
- Built in the app: review-before-filing for docx, xlsx, pptx, pdf, txt, csv, html; duplicate detection by SHA-256; encrypted original with Download/Share original; type:docx|pdf|xlsx filter; encrypted search log (trim 90 days, clear); Sources page; short-query hint; backups include the originals.
- Cloud result: 38 of 38 JS tests, audit, English-only and contrast checks pass. Found and fixed by the checks: PDF worker was served with a wrong MIME type (renamed to pdf.worker.js); the first filing message was hidden behind the old import message.
- Not verified: real iPad (Files picker, Share sheet, Mail "Save to Files" wording, PDF speed on large files), 90-day trim with real old entries.
- Open: OCR for scans and photos, WhatsApp import, on-device summaries.

## 2026-10-11 second release part 2: WhatsApp import on the iPad (plan-whatsapp.md approved)
- Built W1 to W8: parser (iOS/Android, German/English, 12h/24h), group rule, extractive summary, separate encrypted space (own passphrase and recovery key), review screen, append and duplicate handling, reading, search, Ask AI with approval screen, backup and restore of the space.
- Cloud result: 58 of 58 JS tests, 4 of 4 PC tool tests, audit, English-only and contrast pass.
- Found and fixed by the checks: a backup restore bug that corrupted sealed JSON records (search log and WhatsApp chats); fixed with a bin flag, covered by regression assertions. The English-only check got a narrow, marked exception for German keyword lists in src/whatsapp.js (negative-tested).
- Tested with synthetic exports only (as agreed). Not verified: a real WhatsApp export from the iPad (exact export menu wording, real-world line formats such as other locales), Files picker behaviour, performance with very large chats.
- Open: OCR for scans and photos, on-device summaries.

## 2026-10-12 Deadlines view
- Built Deadlines page (overdue, due soon, later, needs attention), Mark done (sets zuletzt, old text in History), horizon 7/14/30/90, home badge, nav link, infobox Next due, template Obligation (recurring). Rules mirror the vault tool (type verpflichtung, rhythmus, start, zuletzt); one-time deadlines use frist, due or deadline.
- Cloud result: 67 of 67 JS tests, 4 of 4 PC tool tests, audit, English-only and contrast pass. Date logic cross-checked against the vault tool on 6000 random cases, 0 mismatches.
- Not verified: real iPad; no notifications or reminders (not possible in a PWA on iPad); the page shows what is due when you open the app.
- Open: weekly review, Kanban, thinking-mode prompts, save-from-chat, secret guard, search measurement, OCR.

## 2026-10-12 Weekly review
- Built the Weekly review page (week or month, new, changed, decisions, filed documents, open tasks, overdue and due soon, contradictions, thinking loop), Earlier/Later, Save as report note (Reports/Review-<period>-<end>.md, only on tap), Ask AI about the period.
- Cloud result: 76 of 76 JS tests, 4 of 4 PC tool tests, audit, English-only and contrast pass. Lists cross-checked against the vault tool on a synthetic vault: identical.
- Bug found and fixed: today() used the UTC date, so evenings in New York got tomorrow's date for daily notes, report names and templates.
- A stricter assertion in my own test showed that my first red-link check never matched anything; fixed so it really compares the home counter.
- Not verified: real iPad. Open: Kanban, thinking-mode prompts, save-from-chat, secret guard, search measurement, OCR.

## 2026-10-12 Thinking modes and Kanban (plan approved in chat)
- Built thinking modes (Challenge, Pattern, Brainstorm) as buttons on every note and a mode choice on Copy for Claude, and a Kanban board (Open, In progress, Done, Other status) over the `status` line with tap-to-move.
- Cloud result: 94 of 94 JS tests, PC tool tests, audit, English-only and contrast pass. Real screenshots added to the manual (chapters 9e and 9f).
- Found by the checks: after a thinking button the mode stayed on for later Ask AI use; fixed so the top button starts in Answer. My own test mistakes (note path, wrong save selector, lock button location) were fixed in the tests, no check was weakened.
- Not verified: real iPad, and how well the prompts work in the Claude app (wording is a first version; tell me what to change).
- Open: save-from-chat, secret guard, search measurement, raw sources, convert note, OCR for scans and photos.
