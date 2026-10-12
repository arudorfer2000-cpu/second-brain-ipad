import test from 'node:test'; import assert from 'node:assert/strict';
import { parseNote, buildIndex, EXCLUDED, infoboxOf } from '../src/vault.js';
import { search, parseQuery, digest, decisionSearch, draftDocument } from '../src/search.js';
import { markdownToDocx } from '../src/docx.js';
import { unzipSync, strFromU8 } from 'fflate';
const NOW = Date.parse('2026-10-11');
const N = (p, t) => parseNote(p, t, NOW);
const notes = () => [
  N('10 Projects/Kitchen renovation plan.md', '---\ntype: project\nstatus: planning\ndescription: Plan for the kitchen\nupdated: 2026-10-10\n---\n# Kitchen renovation plan\nSee [[Heating system decision]] and [[Contractor B quote]].'),
  N('20 Decisions/Heating system decision.md', '---\ntype: adr\nstatus: chosen\ndecided: 2026-03-14\nbelongs_to: [[Kitchen renovation plan]]\ndescription: Chosen system\n---\n# Heating system decision\nOption 2 was chosen because it is cheaper to run. Insurance provider was kept.\n## Options\nText'),
  N('20 Decisions/Insurance provider.md', '---\ntype: adr\ndecided: 2026-03-14\ndescription: Kept\n---\nCompared three offers and kept the current provider because the claims process is simpler. Link [[Kitchen renovation plan|kitchen]].'),
  N('30 Lessons/Notice period.md', '---\ntype: lesson\nupdated: 2024-09-20\ndescription: Read it\n---\nMissed the cancellation window once. Insurance renewal.'),
  N('Orphan.md', 'no frontmatter, no links at all, and no description here'),
  N('Insurance Provider copy.md', '---\ntype: adr\n---\nCompared three offers and kept the current provider because the claims process is simpler. Link [[Kitchen renovation plan|kitchen]].'),
  N('Contradict.md', '---\ndescription: x\n---\n> [!contradiction] says A but other note says B'),
  N('Talk/Heating system decision.md', '---\ntype: talk\n---\nOpen question'),
];
test('frontmatter, links, aliases', () => {
  const n = notes(); assert.equal(n[0].title, 'Kitchen renovation plan'); assert.deepEqual(n[0].links, ['Heating system decision', 'Contractor B quote']);
  assert.deepEqual(n[2].links, ['Kitchen renovation plan']); assert.equal(n[1].fm.status, 'chosen'); assert.equal(n[1].type, 'adr');
});
test('index: backlinks, red links, categories, health', () => {
  const idx = buildIndex(notes());
  assert.deepEqual(idx.red.map((r) => r.target), ['Contractor B quote']);
  assert.ok(idx.back.get('10 Projects/Kitchen renovation plan.md').length >= 2);
  assert.ok(idx.cats.has('Decisions') && idx.cats.has('Projects'));
  assert.ok(idx.orphans.some((n) => n.path === 'Orphan.md'));
  assert.ok(idx.stubs.some((n) => n.path === 'Orphan.md'));
  assert.ok(idx.dupes.length >= 1);
  assert.equal(idx.contradictions.length, 1);
  assert.ok(idx.talkFor(idx.by.get('heating system decision')));
  assert.ok(idx.edges.length >= 4);
  assert.ok(infoboxOf(idx.by.get('kitchen renovation plan'), idx).find((r) => r[0] === 'Health')[3]);
});
test('excluded folders', () => { for (const p of ['_tools/x.md', '.git/a.md', 'raw/b.md', 'A/raw/c.md', 'graph.json']) assert.ok(EXCLUDED.test(p), p); assert.ok(!EXCLUDED.test('10 Projects/raw material.md')); });
test('search filters, confidence, merge', () => {
  const n = notes();
  assert.deepEqual(parseQuery('insurance type:decision after:2026-01-01').f, { type: 'decision', after: '2026-01-01' });
  const r = search(n, 'insurance type:decision after:2026-01-01', { now: NOW });
  assert.ok(r.results.length >= 1 && r.results.every((x) => x.note.type === 'adr' && x.note.date > Date.parse('2026-01-01')));
  assert.ok(r.merged >= 1, 'duplicate snippet merged');
  const l = search(n, 'cancellation', { now: NOW }); assert.equal(l.results[0].confidence, 'low');
  assert.equal(search(n, 'insurance before:2025-01-01', { now: NOW }).results.length, 1);
  assert.ok(search(n, 'kitchen in:projects', { now: NOW }).results.every((x) => x.note.path.toLowerCase().includes('projects')));
  assert.equal(search(n, 'zzzz', { now: NOW }).results.length, 0);
  assert.ok(decisionSearch(n, 'heating', { now: NOW }).results.length === 1);
});
test('digest and document draft and docx', () => {
  const d = digest(notes(), 3, NOW); assert.ok(d.some((x) => x.title === 'Kitchen renovation plan'));
  const md = draftDocument('decision', notes().slice(0, 2), 'Heating'); assert.ok(md.includes('## Decision'));
  const z = unzipSync(markdownToDocx('# T\n\nHello **b**\n\n- item\n[[A|b]]')); const x = strFromU8(z['word/document.xml']);
  assert.ok(x.includes('Hello b') && x.includes('• item') && x.includes('>b<'));
});
test('fixture vault: exact edge and red link counts, independent recount', async () => {
  const { vaultZip } = await import('./helpers.mjs'); const u = unzipSync(new Uint8Array(vaultZip()));
  const notes = Object.entries(u).filter(([p]) => p.endsWith('.md') && !/_tools|raw|\.git/.test(p)).map(([p, d]) => parseNote(p.split('/').slice(1).join('/'), strFromU8(d), 0));
  const idx = buildIndex(notes);
  const titles = new Set(notes.map((n) => n.title.toLowerCase())); let edges = 0, red = new Set();
  for (const n of notes) for (const m of (n.text.match(/\[\[([^\]|]+)/g) || [])) { const t = m.slice(2).trim(); if (t.toLowerCase() === n.title.toLowerCase()) continue; titles.has(t.toLowerCase()) ? edges++ : red.add(t.toLowerCase()); }
  // each unique (note, target) pair counts once
  const pairs = new Set(); for (const n of notes) for (const m of (n.text.match(/\[\[([^\]|]+)/g) || [])) { const t = m.slice(2).trim().toLowerCase(); if (titles.has(t) && t !== n.title.toLowerCase()) pairs.add(n.title + '>' + t); }
  assert.equal(idx.edges.length, pairs.size); assert.equal(idx.edges.length, 3); assert.equal(idx.red.length, red.size); assert.equal(idx.red.length, 1);
});
