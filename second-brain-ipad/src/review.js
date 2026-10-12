// Weekly and monthly review. Pure functions, no network, no DOM. Rules mirror the vault tool (struktur.py review).
import { dueList } from './due.js';
const TASK = /^[ \t]*[-*][ \t]+\[ \][ \t]+(.+)$/gm;
const p2 = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return isoOf(new Date(y, m - 1, d + n)); };
/** period: 'week' (7 days ending on `end`, inclusive) or 'month' (30 days). Returns local-time bounds in ms. */
export function bounds(period, end) {
  const days = period === 'month' ? 30 : 7; const start = addDaysIso(end, -(days - 1));
  const [sy, sm, sd] = start.split('-').map(Number); const [ey, em, ed] = end.split('-').map(Number);
  return { start, end, lo: new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime(), hi: new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime() };
}
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : '');
/** reviewData(notes, ts, period, end) -> { period, start, end, fresh, changed, decisions, tasks, documents, contradictions, due } */
export function reviewData(notes, ts, period, end, contradictions = 0) {
  const b = bounds(period, end); const fresh = [], changed = [], decisions = [], tasks = [], documents = [];
  for (const n of notes) {
    const created = day(n.fm.created) || day(n.fm.erstellt); const t = ts(n); const inEdit = t >= b.lo && t <= b.hi;
    const isNew = !!created && created >= b.start && created <= b.end;
    if (isNew) fresh.push(n); else if (inEdit) changed.push(n);
    if (n.type === 'document' && isNew) documents.push(n);
    if (inEdit) {
      if (n.type === 'adr' || n.type === 'decision') decisions.push(n);
      for (const m of String(n.body || '').matchAll(TASK)) tasks.push({ path: n.path, title: n.title, task: m[1].trim() });
    }
  }
  const by = (a, c) => a.path.localeCompare(c.path); fresh.sort(by); changed.sort(by); decisions.sort(by); documents.sort(by);
  const d = dueList(notes, end, 7);
  return { period, start: b.start, end: b.end, fresh, changed, decisions, tasks, documents, contradictions, due: { overdue: d.overdue, soon: d.soon } };
}
const link = (n) => `[[${n.path.replace(/\.md$/, '')}]]`;
export function reportMarkdown(r, createdIso) {
  const name = r.period === 'month' ? 'Monthly' : 'Weekly'; const L = [];
  L.push('---', 'type: report', `description: ${name} review ${r.start} to ${r.end}`, `created: ${createdIso}`, '---', `# ${name} review ${r.start} to ${r.end}`, '');
  const sec = (title, arr, f, max = 100) => { L.push(`## ${title} (${arr.length})`, ''); for (const x of arr.slice(0, max)) L.push(f(x)); if (!arr.length) L.push('- None'); L.push(''); };
  sec('New', r.fresh, (n) => `- ${link(n)}`); sec('Changed', r.changed, (n) => `- ${link(n)}`); sec('Decisions', r.decisions, (n) => `- ${link(n)}`);
  sec('Documents filed', r.documents, (n) => `- ${link(n)}`); sec('Open tasks', r.tasks, (t) => `- [ ] ${t.task} (${link(t)})`, 50);
  sec('Overdue and due soon', [...r.due.overdue, ...r.due.soon], (x) => `- ${x.next} ${link(x)}`);
  L.push(`## Contradictions`, '', `${r.contradictions} note${r.contradictions === 1 ? '' : 's'} marked as contradicting another note.`, '');
  L.push('## Thinking loop', '', 'Observe, listen, connect, create, grow: What stands out this period? What does it say? What is it connected to? What comes out of it? What did I learn?', '');
  return L.join('\n');
}
