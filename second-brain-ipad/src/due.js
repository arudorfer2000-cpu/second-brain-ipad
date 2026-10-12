// Deadlines: recurring obligations (type verpflichtung) and one-time deadlines. Pure functions, no network, no DOM.
// Rules mirror the vault tool (struktur.py due): next date strictly after `zuletzt`, month-end clamping, leap day handling.
// language-data:begin (German and English rhythm words and note types; the only place German is allowed here)
const ALIAS = { daily: 'daily', taeglich: 'daily', 'täglich': 'daily', weekly: 'weekly', woechentlich: 'weekly', 'wöchentlich': 'weekly', monthly: 'monthly', monatlich: 'monthly', yearly: 'yearly', annually: 'yearly', jaehrlich: 'yearly', 'jährlich': 'yearly' };
const TYPES = new Set(['verpflichtung', 'obligation']);
// language-data:end
const DONE = /^(done|abgeschlossen|fertig|erledigt|closed|dropped)$/i;
export const RHYTHM_LABEL = { daily: 'every day', weekly: 'every week', monthly: 'every month', yearly: 'every year' };
const MS = 86400000;
export const toDays = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / MS); };
export const fromDays = (n) => new Date(n * MS).toISOString().slice(0, 10);
export function parseDate(v) {
  if (typeof v !== 'string') return null; const s = v.trim().slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null;
}
export const normRhythm = (v) => ALIAS[String(v || '').normalize('NFC').trim().toLowerCase()] || '';
function addMonths(iso, months) {
  const [y0, m0, d0] = iso.split('-').map(Number); const t = m0 - 1 + months; const y = y0 + Math.floor(t / 12); const m = ((t % 12) + 12) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(Math.min(d0, last)).padStart(2, '0')}`;
}
export function occurrence(start, rhythm, k) {
  if (rhythm === 'daily') return fromDays(toDays(start) + k); if (rhythm === 'weekly') return fromDays(toDays(start) + 7 * k);
  return addMonths(start, rhythm === 'monthly' ? k : 12 * k);
}
/** First occurrence from `start` that lies strictly after `after`. */
export function nextDue(start, rhythm, after) {
  if (toDays(after) < toDays(start)) return start;
  const [ay, am] = after.split('-').map(Number); const [sy, sm] = start.split('-').map(Number);
  let k; if (rhythm === 'daily') k = toDays(after) - toDays(start) + 1; else if (rhythm === 'weekly') k = Math.floor((toDays(after) - toDays(start)) / 7) + 1;
  else if (rhythm === 'monthly') k = Math.max(0, (ay - sy) * 12 + am - sm - 1); else k = Math.max(0, ay - sy - 1);
  while (toDays(occurrence(start, rhythm, k)) <= toDays(after)) k++; return occurrence(start, rhythm, k);
}
export const localToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const rel = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 ? `in ${days} days` : days === -1 ? '1 day overdue' : `${-days} days overdue`);

/** dueList(notes, today, horizon) -> { today, horizon, overdue, soon, later, problems } with items {path,title,kind,rhythm,next,days} */
export function dueList(notes, today, horizon = 7) {
  const items = [], problems = []; const td = toDays(today);
  for (const n of notes) {
    const fm = n.fm || {}; if (DONE.test(String(fm.status || ''))) continue;
    if (TYPES.has(String(n.type || '').toLowerCase())) {
      const r = normRhythm(fm.rhythmus || fm.rhythm || fm.recurrence); const st = parseDate(fm.start);
      if (!r || !st) { problems.push({ path: n.path, title: n.title, reason: 'Needs a valid rhythm (daily, weekly, monthly, yearly) and a start date (YYYY-MM-DD).' }); continue; }
      const last = parseDate(fm.zuletzt || fm.last_done); const base = last || fromDays(toDays(st) - 1); const next = nextDue(st, r, base);
      items.push({ path: n.path, title: n.title, kind: 'recurring', rhythm: r, next, days: toDays(next) - td, last: last || '' });
    } else {
      const raw = fm.frist || fm.due || fm.deadline; if (raw === undefined || raw === '') continue; const d = parseDate(raw);
      if (!d) { problems.push({ path: n.path, title: n.title, reason: 'The deadline is not a date (YYYY-MM-DD).' }); continue; }
      items.push({ path: n.path, title: n.title, kind: 'once', rhythm: '', next: d, days: toDays(d) - td, last: '' });
    }
  }
  items.sort((a, b) => a.next.localeCompare(b.next) || a.path.localeCompare(b.path));
  return { today, horizon, overdue: items.filter((x) => x.days < 0), soon: items.filter((x) => x.days >= 0 && x.days <= horizon), later: items.filter((x) => x.days > horizon), problems };
}
/** Set or insert one frontmatter key without touching the rest of the note. */
export function setFm(text, key, value) {
  const m = /^---\n([\s\S]*?)\n---(\n|$)/.exec(text); if (!m) return `---\n${key}: ${value}\n---\n${text}`;
  const re = new RegExp(`^${key}:.*$`, 'm'); const body = re.test(m[1]) ? m[1].replace(re, `${key}: ${value}`) : `${m[1]}\n${key}: ${value}`;
  return `---\n${body}\n---${m[2]}${text.slice(m[0].length)}`;
}
