import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { extractFile, suggestProject, guessDate, sha256Hex, extOf, decodeEntities } from '../src/extract.js';
const F = (n) => new Uint8Array(readFileSync(new URL('./fixtures/' + n, import.meta.url)));
test('docx: headings, paragraphs, table, entities, core title', async () => {
  const r = await extractFile('quote.docx', F('quote.docx')); assert.equal(r.ok, true); assert.equal(r.format, 'docx'); assert.equal(r.title, 'Kitchen quote Contractor A');
  assert.match(r.text, /^## Kitchen renovation quote/m); assert.match(r.text, /Total price 12400 EUR/); assert.match(r.text, /Payment within 30 days & no penalty < 5%/); assert.match(r.text, /Cabinets \| 8000/);
});
test('xlsx: sheets, shared strings, numbers', async () => {
  const r = await extractFile('budget.xlsx', F('budget.xlsx')); assert.equal(r.ok, true); assert.match(r.text, /## Budget 2026/); assert.match(r.text, /Heating \| 5200/); assert.match(r.text, /Insurance \| kept/); assert.match(r.text, /## Notes\nRemark \| Check the notice period/);
});
test('pptx: slides in numeric order', async () => {
  const r = await extractFile('deck.pptx', F('deck.pptx')); assert.equal(r.ok, true); assert.equal(r.title, 'Heating system review');
  const i1 = r.text.indexOf('Slide 1'), i2 = r.text.indexOf('Slide 2'), i3 = r.text.indexOf('Slide 3'); assert.ok(i1 < i2 && i2 < i3); assert.match(r.text, /Heating option 2 is cheaper to run/);
});
test('html and text', async () => {
  const h = await extractFile('page.html', F('page.html')); assert.equal(h.title, 'Insurance letter'); assert.match(h.text, /Notice period is 3 months/); assert.ok(!/alert|x\{\}/.test(h.text));
  const t = await extractFile('notes.txt', F('notes.txt')); assert.equal(t.ok, true); assert.equal(t.title, 'notes'); assert.match(t.text, /Second line/);
});
test('protected, broken, old and unsupported files are reported and not opened', async () => {
  assert.equal((await extractFile('fake-encrypted.docx', F('fake-encrypted.docx'))).reason, 'password');
  assert.equal((await extractFile('broken.xlsx', F('broken.xlsx'))).reason, 'unreadable');
  assert.equal((await extractFile('old.doc', F('old.doc'))).reason, 'unsupported');
  assert.equal((await extractFile('x.exe', new Uint8Array(5).fill(1))).reason, 'unsupported');
  assert.equal((await extractFile('e.txt', new Uint8Array(0))).reason, 'empty');
  assert.equal((await extractFile('big.txt', new Uint8Array(26 * 1024 * 1024))).reason, 'too-large');
  assert.equal((await extractFile('a.pdf', F('letter.pdf'))).reason, 'unsupported', 'no pdf reader given');
  assert.equal((await extractFile('a.pdf', F('locked.pdf'), { pdf: async () => { const e = new Error('No password given'); e.name = 'PasswordException'; throw e; } })).reason, 'password');
  assert.equal((await extractFile('a.pdf', F('scan.pdf'), { pdf: async () => ({ text: ' ' }) })).reason, 'no-text');
});
test('helpers: sha256, project suggestion, dates, entities', async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const projects = [{ title: 'Kitchen renovation plan' }, { title: 'Travel 2027' }, { title: 'Aptio' }];
  assert.equal(suggestProject('Kitchen quote Contractor A', 'quote.docx', projects), null, 'one shared word is not enough');
  assert.equal(suggestProject('Kitchen renovation quote', 'x.docx', projects).title, 'Kitchen renovation plan');
  assert.equal(suggestProject('Aptio notes', 'a.docx', projects).title, 'Aptio', 'single-word project titles may match on one word');
  assert.equal(guessDate('Invoice 2026-03-14 final.pdf', 0), '2026-03-14'); assert.equal(guessDate('Report 2025.docx', 0), '2025-01-01'); assert.equal(guessDate('x.docx', Date.parse('2024-05-06')), '2024-05-06');
  assert.equal(extOf('A.B.DOCX'), 'docx'); assert.equal(decodeEntities('a &amp; b &#65; &#x42; &nbsp;'), 'a & b A B  ');
});
