// Fails the build if notes, backups or keys could be committed, or if the app could talk to the network.
import { readdirSync, readFileSync, statSync } from 'node:fs'; import { join, extname } from 'node:path';
const bad = [];
const walk = (d, f) => { for (const n of readdirSync(d)) { if (['node_modules', '.git', 'dist', 'shots'].includes(n)) continue; const p = join(d, n); statSync(p).isDirectory() ? walk(p, f) : f(p); } };
walk('.', (p) => {
  if (/\.(sbbak|pem|key|p12|env)$/i.test(p) || /(^|\/)\.env/.test(p)) bad.push('secret-like file: ' + p);
  if (/\.zip$/i.test(p)) bad.push('zip file tracked: ' + p);
  if (/(^|\/)(Privat|Business|Brain)(\/|$)/.test(p)) bad.push('vault folder: ' + p);
});
walk('src', (p) => { const t = readFileSync(p, 'utf8'); for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/]) if (re.test(t)) bad.push(`network API in ${p}: ${re}`); });
const html = readFileSync('public/index.html', 'utf8'); if (!/connect-src 'self'/.test(html)) bad.push("CSP connect-src 'self' missing"); if (!/default-src 'self'/.test(html)) bad.push("CSP default-src 'self' missing");
if (/https?:\/\/(?!www\.w3\.org|schemas\.openxmlformats|127\.0\.0\.1)/.test(readFileSync('public/styles.css', 'utf8') + html)) bad.push('external URL in html/css');
if (bad.length) { console.error('AUDIT FAILED\n' + bad.join('\n')); process.exit(1); } console.log('audit ok');
