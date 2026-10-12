# WhatsApp import on the iPad: plan (draft for approval)

Goal: export a chat in WhatsApp on the iPad, hand it to Second Brain, review, and file it into a separate encrypted space. Everything stays on the iPad. No network, no login.

## Workflow for the user
1. WhatsApp: open the chat, tap the contact or group name, Export Chat, choose Without Media, then Save to Files.
2. Second Brain: open WhatsApp import, pick the .zip or _chat.txt from Files.
3. Review screen: participants, date range, message count, import mode. Nothing is filed before you confirm.
4. Confirm. The chat is stored in the WhatsApp space, locked by its own passphrase.
5. Open the space with its passphrase: read, search, Ask AI (per chat, with the approval screen).

## Decisions proposed
- Separate space with its own passphrase, own key, own IndexedDB store. Not searchable from the normal vault until unlocked.
- Default mode: summary only (extractive: participants, period, topics by frequency, decisions and dates found by keywords, open questions). No AI, no network. Full text only if you tick "Keep full text".
- Group chats (more than 2 senders) are excluded by default and shown as "Excluded: group chat". You can override per chat.
- Media is not imported (export without media). Media markers are counted, not stored.
- Duplicate detection by SHA-256 of the export. Re-import of a longer export of the same chat appends only new messages.
- Included in backups, encrypted with the space key.
- Raw export file is not kept after filing unless "Keep full text" is ticked.

## Steps (each: one output, one check)
| # | Step | Output | Check |
|---|------|--------|-------|
| W1 | Parser for iOS and Android export formats, German and English, 12h and 24h, multi-line messages, system lines, media markers | src/whatsapp.js | unit tests with synthetic exports in 4 formats; counts exact |
| W2 | Group detection and consent rule (excluded by default) | flag per chat | test: 2 senders imported, 3 senders excluded |
| W3 | Extractive summary | summary note text | test: planted decision and date are found; no message text copied in summary mode |
| W4 | Separate encrypted space (own passphrase, own store, lock) | space unlock screen | e2e: wrong passphrase fails; IndexedDB dump has no chat words; main vault search does not see the chat while locked |
| W5 | Review screen and filing | import page flow | e2e: counts unchanged before confirm; duplicate detected; append of longer export adds only new messages |
| W6 | Reading and search inside the space, Ask AI with approval screen | space pages | e2e: search hit; clipboard text equals displayed text |
| W7 | Backup and restore include the space | backup round trip | e2e: restore, unlock space, same messages |
| W8 | Hardening: tap targets, English-only, audit (no network), screenshots, manual chapter, checks.md verdicts | docs and zips | audit, english-only, contrast, step 15 scan green |

## Not verifiable in the cloud
Real WhatsApp export of your chats on your iPad, the exact wording of the Export Chat menu on your iOS version, Files picker behaviour.

## Needed from you
1. Approve this plan.
2. One question: may I test with synthetic exports only, and you try your first real chat on the iPad afterwards? (Recommended: yes, because I must not see your real chats.)
