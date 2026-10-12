import test from 'node:test'; import assert from 'node:assert/strict';
import { nextDue, occurrence, dueList, setFm, normRhythm, parseDate, rel, toDays, fromDays } from '../src/due.js';
const N = (path, type, fm, title = path) => ({ path, title, type, fm });
test('F1 occurrences: daily, weekly, monthly clamping, yearly leap day', () => {
  assert.equal(occurrence('2026-01-31', 'monthly', 1), '2026-02-28'); assert.equal(occurrence('2026-01-31', 'monthly', 2), '2026-03-31'); assert.equal(occurrence('2028-01-31', 'monthly', 1), '2028-02-29');
  assert.equal(occurrence('2024-02-29', 'yearly', 1), '2025-02-28'); assert.equal(occurrence('2024-02-29', 'yearly', 4), '2028-02-29');
  assert.equal(occurrence('2026-12-15', 'monthly', 2), '2027-02-15'); assert.equal(occurrence('2026-10-12', 'weekly', 2), '2026-10-26'); assert.equal(occurrence('2026-10-30', 'daily', 3), '2026-11-02');
});
test('F1 next due: strictly after the last done date; future start; long gaps', () => {
  assert.equal(nextDue('2026-01-31', 'monthly', '2026-01-30'), '2026-01-31'); assert.equal(nextDue('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28'); assert.equal(nextDue('2026-01-31', 'monthly', '2026-02-28'), '2026-03-31');
  assert.equal(nextDue('2026-10-12', 'weekly', '2026-10-01'), '2026-10-12', 'start in the future'); assert.equal(nextDue('2026-10-12', 'weekly', '2026-10-12'), '2026-10-19'); assert.equal(nextDue('2026-10-12', 'weekly', '2026-11-01'), '2026-11-02');
  assert.equal(nextDue('2024-02-29', 'yearly', '2024-02-29'), '2025-02-28'); assert.equal(nextDue('2024-02-29', 'yearly', '2027-03-01'), '2028-02-29');
  assert.equal(nextDue('2026-01-01', 'daily', '2026-12-31'), '2027-01-01'); assert.equal(nextDue('2025-06-15', 'yearly', '2026-06-14'), '2026-06-15');
});
test('F1 helpers: aliases, dates, relative wording, day math', () => {
  assert.equal(normRhythm('monatlich'), 'monthly'); assert.equal(normRhythm('Wöchentlich'), 'weekly'); assert.equal(normRhythm('yearly'), 'yearly'); assert.equal(normRhythm('every now and then'), '');
  assert.equal(parseDate('2026-02-30'), null); assert.equal(parseDate('2026-10-12T10:00'), '2026-10-12'); assert.equal(parseDate(20261012), null);
  assert.equal(rel(0), 'today'); assert.equal(rel(1), 'tomorrow'); assert.equal(rel(5), 'in 5 days'); assert.equal(rel(-1), '1 day overdue'); assert.equal(rel(-3), '3 days overdue');
  assert.equal(fromDays(toDays('2026-03-08') + 1), '2026-03-09'); assert.equal(toDays('2026-11-02') - toDays('2026-10-30'), 3);
});
test('F1 dueList: split, problems, one-time deadlines, done and invalid notes', () => {
  const notes = [
    N('a.md', 'verpflichtung', { rhythmus: 'monatlich', start: '2026-01-31' }, 'Rent'), N('b.md', 'verpflichtung', { rhythm: 'weekly', start: '2026-10-05', zuletzt: '2026-10-05' }, 'Water plants'),
    N('c.md', 'verpflichtung', { rhythmus: 'jaehrlich', start: '2025-10-14', zuletzt: '2025-10-14' }, 'Insurance'), N('d.md', 'verpflichtung', { rhythmus: 'whenever', start: '2026-01-01' }, 'Broken'), N('e.md', 'verpflichtung', { rhythmus: 'daily' }, 'No start'),
    N('f.md', 'project', { frist: '2026-10-10' }, 'Tax return'), N('g.md', 'project', { deadline: '2026-12-24', status: 'planning' }, 'Gifts'), N('h.md', 'project', { frist: '2026-10-01', status: 'done' }, 'Done thing'),
    N('i.md', 'project', { due: 'soon' }, 'Bad date'), N('j.md', 'lesson', {}, 'No deadline'),
  ];
  const r = dueList(notes, '2026-10-12', 7); const row = (x) => [x.title, x.next, x.days];
  assert.deepEqual(r.overdue.map(row), [['Rent', '2026-01-31', -254], ['Tax return', '2026-10-10', -2]], 'never-done obligation is overdue from its start date');
  assert.deepEqual(r.soon.map(row), [['Water plants', '2026-10-12', 0], ['Insurance', '2026-10-14', 2]]);
  assert.deepEqual(r.later.map(row), [['Gifts', '2026-12-24', 73]]); assert.deepEqual(r.problems.map((x) => x.title).sort(), ['Bad date', 'Broken', 'No start']);
  assert.ok(![...r.overdue, ...r.soon, ...r.later].some((x) => ['Done thing', 'No deadline'].includes(x.title)), 'done notes and notes without a deadline are left out');
  const w = dueList(notes, '2026-10-12', 90); assert.deepEqual(w.soon.map((x) => x.title), ['Water plants', 'Insurance', 'Gifts']); assert.deepEqual(w.later, []);
  assert.deepEqual(dueList(notes, '2026-10-12', 0).soon.map((x) => x.title), ['Water plants'], 'horizon 0 = today only');
});
test('F2 setFm: replaces or inserts a frontmatter key and leaves the rest untouched', () => {
  const t = '---\ntype: verpflichtung\nrhythmus: monthly\nstart: 2026-01-31\nzuletzt: 2026-01-31\n---\n# Rent\n\nbody\n';
  assert.equal(setFm(t, 'zuletzt', '2026-10-12'), t.replace('zuletzt: 2026-01-31', 'zuletzt: 2026-10-12'));
  assert.equal(setFm('---\ntype: verpflichtung\n---\n# X\n', 'zuletzt', '2026-10-12'), '---\ntype: verpflichtung\nzuletzt: 2026-10-12\n---\n# X\n'); assert.equal(setFm('# plain\n', 'zuletzt', '2026-10-12'), '---\nzuletzt: 2026-10-12\n---\n# plain\n');
});
