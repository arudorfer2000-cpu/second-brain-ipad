import test from 'node:test'; import assert from 'node:assert/strict';
import { MODES, modeInstruction, modeLabel, isMode } from '../src/modes.js';

test('M1 four modes, each with a label and a distinct instruction', () => {
  assert.deepEqual(MODES, ['answer', 'challenge', 'pattern', 'brainstorm']);
  const seen = new Set();
  for (const m of MODES) { assert.ok(modeLabel(m).length > 2); const t = modeInstruction(m); assert.ok(t.length > 60, m); seen.add(t); }
  assert.equal(seen.size, 4, 'instructions differ');
});
test('M2 answer mode keeps the original wording (grounded only in the notes)', () => {
  assert.match(modeInstruction('answer'), /only the notes below/i);
});
test('M3 challenge asks for weak points, pattern for recurring themes, brainstorm for new ideas', () => {
  assert.match(modeInstruction('challenge'), /assumption|weak|counter/i);
  assert.match(modeInstruction('pattern'), /recurring|pattern|theme/i);
  assert.match(modeInstruction('brainstorm'), /ideas|options/i);
  for (const m of ['challenge', 'pattern', 'brainstorm']) assert.match(modeInstruction(m), /notes below/i, 'stays tied to the notes');
});
test('M4 unknown mode falls back to answer and isMode rejects it', () => {
  assert.equal(modeInstruction('nope'), modeInstruction('answer')); assert.equal(isMode('nope'), false); assert.equal(isMode('pattern'), true);
});
