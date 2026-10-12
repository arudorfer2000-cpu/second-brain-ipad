import { dueList, localToday, rel } from './due.js';
// Note parsing and index. Pure functions, no browser APIs.
export const TYPE_LABELS = { adr: 'Decisions', decision: 'Decisions', project: 'Projects', lesson: 'Lessons', conversation: 'Conversation notes', daily: 'Daily notes', talk: 'Talk pages', document: 'Documents', verpflichtung: 'Obligations', obligation: 'Obligations' };
export const TYPE_NAMES = { adr: 'Decision', decision: 'Decision', project: 'Project', lesson: 'Lesson', conversation: 'Conversation', daily: 'Daily note', talk: 'Talk page', document: 'Document', verpflichtung: 'Obligation', obligation: 'Obligation' };
export const EXCLUDED = /(^|\/)(_tools|\.git|raw|\.obsidian|node_modules)(\/|$)|(^|\/)graph\.json$/i;
const LINK = /\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
function scalar(v) {
  v = v.trim();
  if (v.startsWith('[') && v.endsWith(']') && !/^\[\[[^\]]*\]\]$/.test(v) && !v.startsWith('[[')) return v.slice(1, -1).split(',').map((x) => unq(x.trim())).filter(Boolean);
  return unq(v);
}
const unq = (s) => s.replace(/^['"]|['"]$/g, '');
export function splitFrontmatter(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { fm: {}, body: text };
  const fm = {}; let key = null;
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1].toLowerCase(); fm[key] = kv[2] === '' ? [] : scalar(kv[2]); }
    else if (key && /^\s*-\s+/.test(line)) { if (!Array.isArray(fm[key])) fm[key] = []; fm[key].push(unq(line.replace(/^\s*-\s+/, '').trim())); }
  }
  return { fm, body: text.slice(m[0].length) };
}
export const baseName = (p) => p.split('/').pop().replace(/\.md$/i, '');
export function parseNote(path, text, mtime = 0) {
  const { fm, body } = splitFrontmatter(text);
  const h1 = /^#\s+(.+)$/m.exec(body);
  const title = String(fm.title || (h1 && h1[1].trim()) || baseName(path));
  const type = String(fm.type || '').toLowerCase();
  const links = []; let m; LINK.lastIndex = 0;
  const scan = body + ' ' + Object.values(fm).flat().join(' ');
  while ((m = LINK.exec(scan))) links.push(m[1].trim());
  const description = Array.isArray(fm.description) ? '' : String(fm.description || '').trim();
  const dateStr = [fm.updated, fm.date, fm.decided, fm.created].find((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x));
  const date = dateStr ? Date.parse(dateStr.slice(0, 10)) : mtime;
  return { path, title, fm, body, type, links: [...new Set(links)], description, date, mtime, text };
}
const key = (s) => s.toLowerCase().trim();
export function buildIndex(notes) {
  const live = notes.filter((n) => !n.trashed);
  const by = new Map();
  const add = (k, n) => { k = key(k); if (k && !by.has(k)) by.set(k, n); };
  for (const n of live) { add(n.title, n); add(baseName(n.path), n); add(n.path.replace(/\.md$/i, ''), n); }
  const resolve = (t) => by.get(key(t)) || by.get(key(t.replace(/\.md$/i, '')));
  const back = new Map(live.map((n) => [n.path, []])); const red = new Map(); const edges = [];
  for (const n of live) for (const t of n.links) {
    const r = resolve(t);
    if (r && r !== n) { back.get(r.path).push(n.path); edges.push([n.path, r.path]); }
    else if (!r) { if (!red.has(key(t))) red.set(key(t), { target: t, from: [] }); red.get(key(t)).from.push(n.path); }
  }
  const cats = new Map(); const catsOf = (n) => {
    const c = []; if (TYPE_LABELS[n.type]) c.push(TYPE_LABELS[n.type]);
    const top = n.path.includes('/') ? n.path.split('/')[0].replace(/^\d+\s*/, '') : ''; if (top && !c.includes(top) && !(c[0] && c[0].toLowerCase().startsWith(top.toLowerCase()))) c.push(top);
    return c.length ? c : ['Uncategorised'];
  };
  for (const n of live) for (const c of catsOf(n)) { if (!cats.has(c)) cats.set(c, []); cats.get(c).push(n.path); }
  const isTalk = (n) => n.type === 'talk' || /^talk\//i.test(n.path);
  const talks = live.filter(isTalk);
  const talkFor = (n) => talks.find((t) => key(baseName(t.path)).replace(/^talk[: -]*/, '') === key(baseName(n.path)) || key(t.title).replace(/^talk[: -]*/, '') === key(n.title));
  const contradictions = live.filter((n) => n.fm.contradiction || /\[!contradiction\]|^CONTRADICTION:/im.test(n.body));
  const orphans = live.filter((n) => !isTalk(n) && n.type !== 'daily' && !back.get(n.path).length && !n.links.length);
  const stubs = live.filter((n) => !isTalk(n) && n.type !== 'daily' && !n.description);
  const dupes = []; const seen = new Map();
  for (const n of live) { const k2 = key(n.title).replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an|note|notes)\b/g, '').trim() || n.path; if (seen.has(k2)) dupes.push([seen.get(k2), n]); else seen.set(k2, n); }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) { const a = live[i], b = live[j]; if (a.body.length > 80 && a.body.replace(/\s+/g, ' ').trim() === b.body.replace(/\s+/g, ' ').trim() && !dupes.some(([x, y]) => x === a && y === b)) dupes.push([a, b]); }
  return { notes: live, by, resolve, back, red: [...red.values()], edges, cats, catsOf, talks, talkFor, isTalk, contradictions, orphans, stubs, dupes };
}
export function infoboxOf(n, idx) {
  const rows = [['Type', TYPE_NAMES[n.type] || (n.type ? n.type : 'Note')]];
  if (n.fm.status) rows.push(['Status', String(n.fm.status)]);
  const d = n.fm.decided || n.fm.date || n.fm.updated; if (typeof d === 'string') rows.push(['Date', d]);
  const b = n.fm.belongs_to || n.fm.project; if (b && typeof b === 'string') rows.push(['Belongs to', b.replace(/\[\[|\]\]/g, ''), true]);
  const reds = idx.red.filter((r) => r.from.includes(n.path)).length;
  if (n.fm.format) rows.push(['Format', String(n.fm.format).toUpperCase()]);
  { const dl = dueList([n], localToday(), 0); const it = [...dl.overdue, ...dl.soon, ...dl.later][0]; if (it) rows.push(['Next due', `${it.next} (${rel(it.days)})`, false, it.days < 0]); }
  rows.push(['Health', reds ? `${reds} missing page${reds > 1 ? 's' : ''}` : 'OK', false, reds > 0]);
  return rows;
}
export function headings(body) { return [...body.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim() })); }
