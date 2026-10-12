# Second Brain for iPad

A private, wiki-style notebook for iPad. It is an installable web app (PWA): it works fully offline, keeps notes encrypted on the device and never sends anything anywhere.

Status: first release (core). See `checks.md` for what was verified and what only the owner can verify on a real iPad.

## What it does
- **Main page** (wiki portal): counts, recently changed, categories, wiki upkeep, tools, A to Z.
- **Notes as articles**: infobox, table of contents, red links for missing notes, backlinks, categories, Talk and History tabs.
- **Search** offline with filters `type:`, `in:`, `from:`, `after:`, `before:`, confidence labels and duplicate merging.
- **Edit and capture**: templates for project, decision, conversation, lesson and daily note; `[[` suggestions; trash and history.
- **Ask AI**: pick notes, review the exact text, copy, paste into the Claude app. The app has no key, no login and makes no network request.
- **Graph view**, **Health check** (broken links, duplicates, missing descriptions, contradictions, orphans), **Digest and documents** (Word export).
- **Light, Dark and Auto** theme. **Backup** as an encrypted file; Markdown export (not encrypted).

- **PC transfer tool** (`pc-tool/transfer_tool.py`, Python standard library only): sends the vault folder to the iPad as a zip and receives backups over home Wi-Fi, with a PIN. The iPad uses Safari for this and then imports from the Files app.

Not in this release: file conversion (Word, Excel, PowerPoint, PDF, OCR), WhatsApp import, on-device summaries.

## Security model
- Argon2id (64 MB, 3 passes) derives a key from a 6 digit passcode or a 10 to 128 character passphrase. A random master key is wrapped by it and by a recovery key. Notes are sealed with XChaCha20-Poly1305. Nothing readable is stored in IndexedDB.
- The passcode is only as strong as its length: a 6 digit passcode can be guessed offline if someone copies the encrypted data. Use a passphrase for stronger protection.
- Not independently audited.
- `localStorage` holds only non-secret settings: theme, auto-lock minutes, last backup time.

## Develop
```
npm install
npm test          # unit tests and end-to-end tests in headless Chromium
npm run test:pc   # PC transfer tool tests (Python)
npm run audit     # no network, no secrets, English only, colour contrast
npm run build     # static files in dist/ (works under any sub-folder)
npm run serve     # serve dist/ on http://127.0.0.1:4173
```
Chromium is found at `/opt/pw-browsers/chromium-1194` or via `CHROME_PATH`.

## Publish
Double-click `PUBLISH-TO-GITHUB.bat` on Windows, or push to `main`: the workflow in `.github/workflows/pages.yml` tests, audits and publishes to GitHub Pages. Never put notes or backups in the repository.

## Install on the iPad
Open the published address in Safari, tap Share, then Add to Home Screen. Start the app from the new icon. See the Installation Plan and User Manual documents.

## Documents (second release, part 1)
Import file accepts Word, Excel, PowerPoint, PDF, text, CSV and HTML. A review list comes first; originals are kept encrypted and included in backups. Search them with `type:docx`, `type:pdf`, `type:xlsx`. See Sources and search log in the app. No OCR yet. Everything runs on the iPad.

## WhatsApp space
Separate encrypted space with its own passphrase. Import a chat export (zip or txt, without media), review, choose summary only (default) or full text. Group chats are excluded unless ticked. Synthetic exports only in tests. See plan-whatsapp.md.

## Deadlines
Deadlines page: recurring obligations (`type: verpflichtung`, `rhythmus`, `start`, `zuletzt`) and one-time `frist` dates. Mark done sets `zuletzt`. No notifications.

## Weekly review
Review page for a week or month: new, changed, decisions, open tasks, deadlines. Save as a report note on tap. Rules follow the vault tool.

## Kanban board
Notes with a `status` line show up as cards in Open, In progress and Done (other words in Other status). Tap a column name on a card to move it; only the status line changes.

## Thinking modes
On every note, Challenge, Pattern and Brainstorm open the Copy for Claude approval screen with a ready-made request. The Copy for Claude page also lets you choose the mode. Nothing is sent by the app.
