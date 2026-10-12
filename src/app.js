// Second Brain iPad: application shell, state, actions. UI strings are English only.
import * as C from './crypto.js';
import * as S from './store.js';
import { modeInstruction } from './modes.js';
import { parseNote, buildIndex, EXCLUDED, infoboxOf, headings, TYPE_LABELS, TYPE_NAMES, baseName } from './vault.js';
import { search, digest, draftDocument } from './search.js';
import { markdownToDocx } from './docx.js';
import { render, inline, esc, slug } from './md.js';
import { layout } from './graph.js';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { extractFile, sha256Hex, suggestProject, guessDate, extOf, stemOf } from './extract.js';

export const st = { master: null, meta: null, recs: new Map(), notes: [], idx: null, ask: { sel: new Set(), q: '', exclude: true, mode: 'answer' }, docSel: new Set(), graph: { f: { project: true, decision: true, lesson: true, other: true, missing: true }, sel: null }, navOpen: false, flash: null, lastImport: null, fails: 0 };
const $ = (s, r = document) => r.querySelector(s);
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };
const DAY = 86400000;
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local date, not UTC
export function fmtAgo(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / DAY);
  if (d <= 0) return 'today'; if (d === 1) return 'yesterday'; if (d < 7) return `${d} days ago`; if (d < 14) return 'last week';
  return new Date(ts).toISOString().slice(0, 10);
}
const tsOf = (n) => n.edited || n.date || 0;

// ---------- theme ----------
export function applyTheme() {
  const t = ls.get('theme', 'auto'); const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
}
const themeSeg = () => { const t = ls.get('theme', 'auto'); return `<div class="seg" role="group" aria-label="Theme">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([v, l]) => `<button data-act="theme" data-v="${v}" class="${t === v ? 'on' : ''}" aria-pressed="${t === v}">${l}</button>`).join('')}</div>`; };

// ---------- data ----------
function rebuild() {
  st.notes = [...st.recs.values()].map((r) => ({ ...parseNote(r.path, r.text, r.mtime), id: r.id, trashed: !!r.trashed, versions: r.versions || [], edited: r.edited || 0 }));
  st.idx = buildIndex(st.notes);
}
async function persist(r) { await S.putRec(r.id, await C.seal(st.master, r)); }
async function loadAll() {
  st.recs.clear();
  for (const [id, rec] of await S.allRecs()) { try { const r = await C.open(st.master, rec); r.id = id; st.recs.set(id, r); } catch { /* skip unreadable record */ } }
  rebuild();
}
const byPath = (p) => [...st.recs.values()].find((r) => r.path === p);
export async function saveNote(path, text, id) {
  let r = id ? st.recs.get(id) : byPath(path);
  if (r) {
    if (r.text !== text) { r.versions = [{ t: Date.now(), text: r.text }, ...(r.versions || [])].slice(0, 20); r.text = text; r.edited = Date.now(); r.mtime = Date.now(); }
  } else r = { id: await C.randomId(), path, text, mtime: Date.now(), edited: Date.now(), trashed: false, versions: [] };
  st.recs.set(r.id, r); await persist(r); rebuild(); return r;
}
async function setTrashed(path, v) { const r = byPath(path); if (!r) return; r.trashed = v; r.edited = Date.now(); await persist(r); rebuild(); }
async function destroy(path) {
  const r = byPath(path); if (!r) return; const fid = (parseNote(r.path, r.text).fm.file) || '';
  st.recs.delete(r.id); await S.delRec(r.id); if (fid && /^[0-9a-f]{24}$/.test(fid)) await S.delFile(fid); rebuild();
}
export async function importFiles(files) {
  let added = 0, updated = 0, same = 0, skipped = 0;
  const roots = new Set(files.map((f) => f.path.split('/')[0])); const multi = files.length > 0 && files.every((f) => f.path.includes('/')) && roots.size === 1;
  for (const f of files) {
    let p = multi ? f.path.split('/').slice(1).join('/') : f.path;
    if (!/\.md$/i.test(p) || EXCLUDED.test(p) || /(^|\/)__MACOSX\//.test(p) || /(^|\/)\./.test(p)) { skipped++; continue; }
    const ex = byPath(p);
    if (ex && ex.text === f.text) { same++; continue; }
    if (ex && ex.trashed) ex.trashed = false;
    await saveNote(p, f.text, ex && ex.id); ex ? updated++ : added++;
  }
  st.lastImport = { added, updated, same, skipped, at: Date.now() };
  return st.lastImport;
}
function pickPaths(set) { return [...set].map((p) => st.idx.notes.find((n) => n.path === p)).filter(Boolean); }
const isPrivate = (n) => /^(true|yes|1)$/i.test(String(n.fm.private || '')) || [].concat(n.fm.tags || []).map(String).some((t) => /private/i.test(t));
export function buildAskText() {
  const a = st.ask; const picked = pickPaths(a.sel);
  const used = picked.filter((n) => !(a.exclude && isPrivate(n))); const left = picked.filter((n) => a.exclude && isPrivate(n));
  const head = a.mode && a.mode !== 'answer' ? `Focus: ${a.q.trim() || '(optional: what should I focus on?)'}` : `Question: ${a.q.trim() || '(write your question here)'}`;
  let t = `${head}\n\n${modeInstruction(a.mode)}\n`;
  for (const n of used) {
    const body = n.body.replace(/^#\s.*\n?/, '').trim(); const cut = body.length > 8000;
    t += `\n--- ${n.title}${n.date ? ' (' + new Date(n.date).toISOString().slice(0, 10) + ')' : ''} ---\n${n.description ? n.description + '\n' : ''}${cut ? body.slice(0, 8000) + '\n[shortened]' : body}\n`;
  }
  return { text: t, used, left };
}
const TEMPLATES = {
  blank: { label: 'Blank note', path: (t) => `Inbox/${t}.md`, body: (t) => `# ${t}\n\n` },
  project: { label: 'Project', path: (t) => `Projects/${t}.md`, body: (t) => `---\ntype: project\nstatus: idea\ndescription: \nupdated: ${today()}\n---\n# ${t}\n\n## Goal\n\n## Next steps\n- \n` },
  decision: { label: 'Decision', path: (t) => `Decisions/${t}.md`, body: (t) => `---\ntype: adr\nstatus: proposed\ndecided: ${today()}\nbelongs_to: \ndescription: \n---\n# ${t}\n\n## Context\n\n## Options\n- Option 1\n- Option 2\n\n## Decision\n\n## Consequences\n` },
  conversation: { label: 'Conversation note', path: (t) => `Conversations/${t}.md`, body: (t) => `---\ntype: conversation\ndate: ${today()}\ndescription: \n---\n# ${t}\n\n## Who\n\n## Key points\n- \n\n## Follow-ups\n- \n` },
  lesson: { label: 'Lesson', path: (t) => `Lessons/${t}.md`, body: (t) => `---\ntype: lesson\nupdated: ${today()}\ndescription: \n---\n# ${t}\n\n## What happened\n\n## What to do next time\n` },
  obligation: { label: 'Obligation (recurring)', path: (t) => `Obligations/${t}.md`, body: (t) => `---\ntype: verpflichtung\nrhythmus: monthly\nstart: ${today()}\ndescription: \n---\n# ${t}\n\n## What has to be done\n\n## Notes\n` },
  daily: { label: 'Daily note', path: () => `Daily/${today()}.md`, body: () => `---\ntype: daily\ndate: ${today()}\n---\n# ${today()}\n\n## Today\n- \n\n## Notes\n` },
};
export { TEMPLATES };
const safeName = (s) => s.replace(/[\\/:*?"<>|#^\[\]]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- download helpers ----------
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
  }
}
export const util = { $, ls, download, today, fmtAgo, tsOf, themeSeg, safeName, pickPaths, isPrivate, DAY };
export { C, S, parseNote, buildIndex, EXCLUDED, infoboxOf, headings, TYPE_LABELS, TYPE_NAMES, baseName, search, digest, draftDocument, markdownToDocx, render, inline, esc, slug, layout, unzipSync, zipSync, strFromU8, strToU8 };
export { rebuild, persist, loadAll, setTrashed, destroy, byPath, extractFile, sha256Hex };

// ---------- filing documents (Office, PDF, text, HTML) ----------
let pdfLoading = null;
export function pdfReader() {
  return async (bytes) => {
    if (!window.SBPDF) await (pdfLoading ||= new Promise((res, rej) => { const el = document.createElement('script'); el.src = 'pdf-lib.js'; el.onload = res; el.onerror = () => { pdfLoading = null; rej(new Error('PDF reader missing')); }; document.head.appendChild(el); }));
    return window.SBPDF.extract(bytes);
  };
}
const DOC_ROOT = 'Documents';
const uniquePath = (path, taken = new Set()) => { const live = (p) => !!byPath(p) || taken.has(p); if (!live(path)) return path; const m = /^(.*?)(\.md)$/.exec(path); for (let i = 2; i < 500; i++) { const c = `${m[1]} ${i}${m[2]}`; if (!live(c)) return c; } return path; };
export async function planFiling(files) {
  const hashes = new Map(); for (const n of st.notes) if (n.fm.quelle_sha256) hashes.set(String(n.fm.quelle_sha256), n);
  const projects = st.idx.notes.filter((n) => n.type === 'project'); const seen = new Map(); const items = [];
  for (const f of files) {
    const it = { name: f.name, size: f.bytes.length, bytes: f.bytes, ext: extOf(f.name) };
    it.sha = await sha256Hex(f.bytes); const r = await extractFile(f.name, f.bytes, { pdf: extOf(f.name) === 'pdf' ? pdfReader() : null });
    if (!r.ok) { Object.assign(it, { status: 'blocked', reason: r.reason, message: r.message }); items.push(it); continue; }
    const dupe = hashes.get(it.sha) || seen.get(it.sha);
    Object.assign(it, { format: r.format, text: r.text, title: r.title, date: guessDate(f.name, f.mtime) });
    it.year = it.date.slice(0, 4); it.folder = `${DOC_ROOT}/${it.year}`;
    if (dupe) { it.status = 'duplicate'; it.message = `Already filed as "${dupe.title || dupe.name}".`; } else { it.status = 'new'; seen.set(it.sha, { name: f.name }); }
    const p = suggestProject(it.title, f.name, projects); it.belongs = p ? p.title : ''; items.push(it);
  }
  return items;
}
export async function fileItems(items) {
  const taken = new Set(); const done = [];
  for (const it of items) {
    const fileId = await C.randomId(); const sealed = await C.sealBytes(st.master, it.bytes); await S.putFile(fileId, sealed);
    const title = safeName(it.title) || stemOf(it.name); const path = uniquePath(`${it.folder}/${title}.md`, taken); taken.add(path);
    const cap = 20000; const body = it.text.length > cap ? it.text.slice(0, cap) + '\n\n[Shortened. The full text is in the original file.]' : it.text;
    const oneLine = it.text.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim().slice(0, 160).replace(/"/g, "'");
    const text = `---\ntype: document\nformat: ${it.format}\ndescription: ${oneLine}\nherkunft: "${it.name.replace(/"/g, "'")}"\nquelle_sha256: ${it.sha}\nfile: ${fileId}\nsize: ${it.size}\ndatum: ${it.date}\n${it.belongs ? `belongs_to: [[${it.belongs}]]\n` : ''}created: ${today()}\n---\n# ${title}\n\nOriginal file: ${it.name} (stored encrypted in this app, open it with Download original).\n\n## Extract\n${body}\n`;
    const rec = await saveNote(path, text); rec.fileId = fileId; await persist(rec); done.push({ path, name: it.name });
  }
  return done;
}
export async function getOriginal(fileId) { const rec = await S.getFile(fileId); if (!rec) return null; return C.openBytes(st.master, rec); }
export const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', html: 'text/html' };

// ---------- search log (stored encrypted, local only) ----------
const LOG_ID = 'log';
export async function readLog() { const rec = await S.getFile(LOG_ID); if (!rec) return []; try { return (await C.open(st.master, rec)).entries || []; } catch { return []; } }
async function writeLog(entries) { await S.putFile(LOG_ID, await C.seal(st.master, { entries })); }
export async function logSearch(kind, q, n) { const e = await readLog(); e.push({ t: Date.now(), k: kind, q: String(q).slice(0, 200), n }); await writeLog(e.slice(-2000)); }
export async function trimLog(days = 90, apply = false) { const e = await readLog(); const lim = Date.now() - days * DAY; const keep = e.filter((x) => x.t >= lim); if (apply && keep.length < e.length) await writeLog(keep); return { total: e.length, remove: e.length - keep.length }; }
export const clearLog = () => S.delFile(LOG_ID);
