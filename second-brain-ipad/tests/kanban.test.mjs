import test from 'node:test'; import assert from 'node:assert/strict';
import { columnOf, board, statusValue, COLUMNS } from '../src/kanban.js';
const n = (title, status, extra = {}) => ({ path: title + '.md', title, fm: status === undefined ? {} : { status }, ...extra });

test('B1 status words map to columns, case and separators ignored', () => {
  const cases = { idea: 'open', Planning: 'open', proposed: 'open', open: 'open', 'to do': 'open', 'TODO': 'open',
    'in progress': 'doing', 'In-Progress': 'doing', in_progress: 'doing', active: 'doing', doing: 'doing',
    done: 'done', Closed: 'done', completed: 'done', 'chosen option 2': 'other', weird: 'other' };
  for (const [s, c] of Object.entries(cases)) assert.equal(columnOf(s), c, s);
});
test('B2 German words map as well', () => {
  assert.equal(columnOf('offen'), 'open'); assert.equal(columnOf('in Arbeit'), 'doing'); assert.equal(columnOf('erledigt'), 'done');
});
test('B3 board puts notes with a status into columns, sorted by title; no status or trashed means not on the board', () => {
  const b = board([n('Zeta', 'open'), n('Alpha', 'idea'), n('Mid', 'active'), n('Fin', 'done'), n('Odd', 'chosen option 2'), n('NoStatus'), n('Empty', ''), n('Gone', 'open', { trashed: true })]);
  assert.deepEqual(b.open.map((x) => x.title), ['Alpha', 'Zeta']); assert.deepEqual(b.doing.map((x) => x.title), ['Mid']);
  assert.deepEqual(b.done.map((x) => x.title), ['Fin']); assert.deepEqual(b.other.map((x) => x.title), ['Odd']);
  assert.equal(b.open.length + b.doing.length + b.done.length + b.other.length, 5, 'exactly the five notes with a usable status');
});
test('B4 status written back is one canonical value per column and maps back to the same column', () => {
  assert.deepEqual(COLUMNS, ['open', 'doing', 'done']);
  for (const c of COLUMNS) { const v = statusValue(c); assert.ok(v); assert.equal(columnOf(v), c); }
  assert.equal(statusValue('doing'), 'in progress'); assert.throws(() => statusValue('other'));
});
