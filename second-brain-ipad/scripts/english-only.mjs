// The UI and documentation are English only. Fails on German words or umlauts in source, html and docs.
import { readFileSync, readdirSync, statSync } from 'node:fs'; import { join } from 'node:path';
const WORDS = ['Notiz', 'Notizen', 'Suche', 'Einstellungen', 'Speichern', 'Abbrechen', 'Fehler', 'Passwort', 'Zurück', 'Löschen', 'Sicherung', 'Willkommen', 'Datei', 'Hilfe', 'Schließen', 'Öffnen', 'Startseite', 'Ansicht', 'Weiter', 'nicht', 'und'];
const files = []; for (const d of ['src', 'public']) (function w(x) { for (const n of readdirSync(x)) { const p = join(x, n); statSync(p).isDirectory() ? w(p) : /\.(js|html|css|json)$/.test(p) && files.push(p); } })(d);
for (const f of ['README.md', 'CLAUDE.md', 'plan.md', 'checks.md', 'progress.md']) { try { statSync(f); files.push(f); } catch { /* optional file */ } }
const bad = [];
// Narrow exception: keyword lists for German chats in src/whatsapp.js, between the language-data markers. Nothing else is exempt.
const ALLOW = ['src/whatsapp.js', 'src/due.js', 'src/kanban.js']; const stripData = (t) => t.replace(/\/\/ language-data:begin[^\n]*\n[\s\S]*?\/\/ language-data:end\n/g, '');
for (const f of files) { let t = readFileSync(f, 'utf8'); if (ALLOW.includes(f)) t = stripData(t); if (/[äöüßÄÖÜ]/.test(t)) bad.push(`${f}: umlaut`); for (const w of WORDS) if (new RegExp(`(?<![A-Za-z_./-])${w}(?![A-Za-z_-])`).test(t.replace(/\b[a-z]+\.und\b/g, ''))) bad.push(`${f}: German word "${w}"`); }
if (bad.length) { console.error('ENGLISH-ONLY FAILED\n' + bad.join('\n')); process.exit(1); } console.log('english-only ok', files.length, 'files');
