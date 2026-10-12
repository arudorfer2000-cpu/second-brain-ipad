import test from 'node:test'; import assert from 'node:assert/strict';
import { bounds, addDaysIso, reviewData, reportMarkdown, isoOf } from '../src/review.js';
const at = (y, m, d, h = 12, mi = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, mi, s, ms).getTime();
const N = (path, type, fm, ts, body = '') => ({ path, title: path.replace(/\.md$/, ''), type, fm, ts, body });
const ts = (n) => n.ts;
test('R1 bounds: inclusive week and month in local time, month ends and DST weeks', () => {
  const w = bounds('week', '2026-10-12'); assert.equal(w.start, '2026-10-06'); assert.equal(w.lo, at(2026, 10, 6, 0)); assert.equal(w.hi, at(2026, 10, 12, 23, 59, 59, 999));
  assert.equal(bounds('month', '2026-10-12').start, '2026-09-13'); assert.equal(bounds('week', '2026-03-03').start, '2026-02-25'); assert.equal(bounds('week', '2024-03-02').start, '2024-02-25');
  assert.equal(addDaysIso('2026-03-09', -7), '2026-03-02'); assert.equal(bounds('week', '2026-11-02').start, '2026-10-27'); assert.equal(bounds('week', '2026-03-30').start, '2026-03-24'); assert.equal(isoOf(new Date(2026, 0, 5)), '2026-01-05');
});
test('R1 new vs changed, boundaries, decisions, tasks, documents', () => {
  const notes = [
    N('A new on start.md', 'project', { created: '2026-10-06' }, at(2026, 10, 6, 9)), N('B changed.md', 'project', { created: '2026-10-05' }, at(2026, 10, 8)), N('C new on end.md', 'lesson', { created: '2026-10-12' }, at(2026, 10, 12, 23)),
    N('D future.md', 'project', { created: '2026-10-13' }, at(2026, 10, 13, 0)), N('E just before.md', 'project', {}, at(2026, 10, 5, 23, 59, 59, 999)), N('F start midnight.md', 'project', {}, at(2026, 10, 6, 0)),
    N('G end last ms.md', 'project', {}, at(2026, 10, 12, 23, 59, 59, 999)), N('H just after.md', 'project', {}, at(2026, 10, 13, 0)),
    N('I decision.md', 'adr', {}, at(2026, 10, 9)), N('J decision old.md', 'decision', {}, at(2026, 9, 1)),
    N('K tasks.md', 'project', { erstellt: '2026-09-01' }, at(2026, 10, 10), '- [ ] open one\n- [x] done one\n* [ ] star task\n  - [ ] nested task\ntext - [ ] not a task'), N('L old tasks.md', 'project', {}, at(2026, 9, 1), '- [ ] old task'),
    N('M doc.md', 'document', { created: '2026-10-07', format: 'pdf' }, at(2026, 10, 7)), N('Z created only.md', 'lesson', { created: '2026-10-08' }, at(2026, 9, 1)),
  ];
  const r = reviewData(notes, ts, 'week', '2026-10-12', 2); const names = (a) => a.map((n) => n.path.replace(/\.md$/, ''));
  assert.deepEqual(names(r.fresh), ['A new on start', 'C new on end', 'M doc', 'Z created only'], 'new = created in period, even if the edit time is outside');
  assert.deepEqual(names(r.changed), ['B changed', 'F start midnight', 'G end last ms', 'I decision', 'K tasks'], 'changed = edited in period and not new; edges: before 00:00 out, 00:00 in, 23:59:59.999 in, next day out');
  assert.deepEqual(names(r.decisions), ['I decision']); assert.deepEqual(r.tasks.map((t) => t.task), ['open one', 'star task', 'nested task'], 'only unchecked boxes, only from notes edited in the period');
  assert.deepEqual(names(r.documents), ['M doc']); assert.equal(r.contradictions, 2);
  const m = reviewData(notes, ts, 'month', '2026-10-12'); assert.deepEqual(names(m.decisions), ['I decision'], 'month window starts 13 Sep, so the decision from 1 Sep is out');
  assert.ok(names(m.changed).includes('L old tasks') === false && m.tasks.length === 3, 'old note from 1 Sep is outside the month too');
  const m2 = reviewData(notes, ts, 'month', '2026-10-31'); assert.deepEqual(names(m2.changed).includes('B changed'), false, 'moving the end date moves the window'); assert.equal(bounds('month', '2026-10-31').start, '2026-10-02');
});
test('R1 deadlines in the review and report markdown', () => {
  const notes = [N('Rent.md', 'verpflichtung', { rhythmus: 'monthly', start: '2026-01-31', zuletzt: '2026-09-30' }, at(2026, 9, 30)), N('Tax.md', 'project', { frist: '2026-10-10' }, at(2026, 10, 8), '- [ ] file it')];
  const r = reviewData(notes, ts, 'week', '2026-10-12'); assert.deepEqual(r.due.overdue.map((x) => x.title), ['Tax']); assert.deepEqual(r.due.soon, []);
  const md = reportMarkdown(r, '2026-10-12'); assert.match(md, /^---\ntype: report\ndescription: Weekly review 2026-10-06 to 2026-10-12\ncreated: 2026-10-12\n---\n# Weekly review 2026-10-06 to 2026-10-12\n/);
  assert.match(md, /## Changed \(1\)\n\n- \[\[Tax\]\]/); assert.match(md, /- \[ \] file it \(\[\[Tax\]\]\)/); assert.match(md, /## Overdue and due soon \(1\)\n\n- 2026-10-10 \[\[Tax\]\]/); assert.match(md, /## Thinking loop/); assert.match(md, /## New \(0\)\n\n- None/);
});
