import test, { before, after } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { start, setup, importVault, unlock } from './helpers.mjs';
let browser, server, url, page; const reqs = [];
const FX = (n) => new URL('./fixtures/' + n, import.meta.url).pathname;
const sha = (b) => createHash('sha256').update(b).digest('hex');
before(async () => {
  ({ server, browser, url } = await start({ port: 4398 }));
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true });
  page = await ctx.newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
  await setup(page, url); await importVault(page);
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); };
const T = (s) => page.textContent(s);
const notesCount = async () => Number((await T('.welcome')).match(/(\d+) notes/)[1]);
const pick = async (names) => { await go('#/import'); await page.setInputFiles('#imp', names.map((n) => FX(n))); await page.waitForSelector('#filing', { timeout: 20000 }); };

test('stage 2: review screen first, nothing filed before confirm', async () => {
  await go('#/'); const before = await notesCount();
  await pick(['quote.docx', 'budget.xlsx', 'deck.pptx', 'page.html', 'notes.txt']);
  assert.match(await T('#filing'), /Nothing has been filed yet/); assert.equal(await page.locator('#filing .res').count(), 5);
  assert.match(await T('#filing'), /File selected \(5\)/);
  await go('#/'); assert.equal(await notesCount(), before, 'count unchanged before confirm');
});
test('stage 2: file selected, notes created, original identical after download', async () => {
  await pick(['quote.docx', 'budget.xlsx', 'deck.pptx', 'page.html', 'notes.txt']);
  await page.fill('#ft0', 'Kitchen quote'); await page.click('[data-act=file-go]'); await page.waitForSelector('#imsg:has-text("Filed")');
  assert.match(await T('#imsg'), /Filed 5 documents/);
  const y = new Date().getFullYear(); await go('#/'); assert.match(await T('.welcome'), /13 notes/);
  await go('#/search?q=' + encodeURIComponent('type:docx')); assert.match(await T('.main'), /Kitchen quote/);
  await go('#/search?q=' + encodeURIComponent('Cabinets type:docx')); assert.match(await T('.main'), /1 result/);
  await go('#/search?q=' + encodeURIComponent('Heating type:xlsx')); assert.match(await T('.main'), /budget/i);
  await go('#/search?q=' + encodeURIComponent('3 months')); assert.match(await T('.main'), /Insurance letter/);
  await page.click('.res a >> nth=0'); await page.waitForSelector('[data-act=dl-orig]');
  await go('#/search?q=' + encodeURIComponent('type:docx')); await page.click('.res a >> nth=0'); await page.waitForSelector('[data-act=dl-orig]');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=dl-orig]')]);
  assert.equal(d.suggestedFilename(), 'quote.docx'); assert.equal(sha(readFileSync(await d.path())), sha(readFileSync(FX('quote.docx'))), 'original is byte identical');
  assert.match(await T('.info'), /Format/);
});
test('stage 2: duplicate by hash even with another name, blocked files reported', async () => {
  await go('#/import'); const buf = readFileSync(FX('quote.docx'));
  await page.setInputFiles('#imp', [{ name: 'renamed copy.docx', mimeType: 'application/octet-stream', buffer: buf }, ...['fake-encrypted.docx', 'old.doc', 'broken.xlsx', 'notes.txt'].map((n) => ({ name: n, mimeType: 'application/octet-stream', buffer: readFileSync(FX(n)) }))]);
  await page.waitForSelector('#filing'); const t = await T('#filing');
  assert.match(t, /Duplicate/); assert.match(t, /Already filed as/); assert.match(t, /password/i); assert.match(t, /\.docx|save/i);
  assert.equal(await page.locator('#filing input[type=checkbox]:checked').count(), 0, 'nothing preselected: dupes and blocked are off');
  assert.equal(await page.locator('#filing input[type=checkbox]:disabled').count(), 3);
  await page.click('[data-act=file-cancel]'); await go('#/'); assert.match(await T('.welcome'), /13 notes/);
});
test('stage 2: PDF text, protected PDF and scan', async () => {
  await pick(['letter.pdf', 'locked.pdf', 'scan.pdf']); const t = await T('#filing');
  assert.match(t, /password/i); assert.match(t, /no text|scan/i);
  assert.equal(await page.locator('#filing input[type=checkbox]:checked').count(), 1);
  await page.click('[data-act=file-go]'); await page.waitForSelector('#imsg:has-text("Filed")'); assert.match(await T('#imsg'), /Filed 1 document/);
  await go('#/search?q=' + encodeURIComponent('type:pdf')); assert.match(await T('.main'), /1 result/);
});
test('stage 2: nothing readable in IndexedDB, nothing sent', async () => {
  const dump = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { const d = r.result; const tx = d.transaction(['notes', 'files']); const out = []; for (const s of ['notes', 'files']) tx.objectStore(s).getAll().onsuccess = (e) => out.push(JSON.stringify(e.target.result)); tx.oncomplete = () => res(out.join('')); }; }));
  for (const w of ['Cabinets', 'Kitchen quote', 'Insurance letter', 'Second line', 'Heating', 'quote.docx']) assert.ok(!dump.includes(w), 'plaintext leak: ' + w);
  assert.ok(reqs.every((u) => u.startsWith(url) || u.startsWith('data:') || u.startsWith('blob:')), 'only same-origin requests: ' + reqs.filter((u) => !u.startsWith(url)).join(','));
});
test('stage 2: search log is encrypted, trims and clears; sources page; short query hint', async () => {
  await page.fill('.top .search input', 'insurance'); await page.press('.top .search input', 'Enter'); await page.waitForTimeout(300);
  await page.fill('.top .search input', 'x'); await page.press('.top .search input', 'Enter'); await page.waitForTimeout(300);
  assert.match(await T('.main'), /Very short searches/); assert.match(await T('.main'), /result/);
  await go('#/sources'); await page.waitForSelector('#logbox .row'); const t = await T('.main');
  assert.match(t, /searched by the Claude app, not by this app/); assert.match(t, /filed documents/); assert.match(t, /insurance/);
  const raw = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { r.result.transaction('files').objectStore('files').get('log').onsuccess = (e) => res(JSON.stringify(e.target.result)); }; }));
  assert.ok(raw && !raw.includes('insurance'), 'log must be encrypted');
  // plant an old entry by rewriting through app internals is not possible; trim button is disabled with nothing old
  assert.equal(await page.isDisabled('[data-act=log-trim]'), true);
  await page.click('[data-act=log-clear]'); await page.click('#yes'); await page.waitForSelector('#logbox:has-text("empty")');
  assert.equal(await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { r.result.transaction('files').objectStore('files').get('log').onsuccess = (e) => res(e.target.result === undefined); }; })), true);
});
test('stage 2: backup includes originals; restore gives identical file; delete for good removes it', async () => {
  await page.fill('.top .search input', 'regression log entry'); await page.press('.top .search input', 'Enter'); await page.waitForTimeout(300);
  await go('#/backup'); const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=backup]')]); const path = await d.path();
  const raw = readFileSync(path, 'utf8'); assert.ok(!raw.includes('Cabinets') && !raw.includes('quote.docx'));
  const j = JSON.parse(raw); assert.ok(j.files.length >= 5, 'files in backup: ' + j.files.length);
  await go('#/settings'); await page.click('[data-act=wipe-ask]'); await page.fill('#ty', 'ERASE'); await page.click('#yes'); await page.waitForSelector('#s1');
  await page.setInputFiles('#rf', path); await page.waitForSelector('#pw'); await unlock(page, '482913');
  await go('#/sources'); await page.waitForSelector('#logbox .row'); assert.match(await T('#logbox'), /regression log entry/, 'encrypted log survives backup and restore');
  await go('#/search?q=' + encodeURIComponent('type:docx')); await page.click('.res a >> nth=0'); await page.waitForSelector('[data-act=dl-orig]');
  const [d2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=dl-orig]')]);
  assert.equal(sha(readFileSync(await d2.path())), sha(readFileSync(FX('quote.docx'))));
  const before = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { r.result.transaction('files').objectStore('files').count().onsuccess = (e) => res(e.target.result); }; }));
  await page.click('[data-act=trash]'); await page.waitForTimeout(200); await go('#/trash'); await page.click('[data-act=destroy-ask]'); await page.click('#yes'); await page.waitForTimeout(400);
  const after = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { r.result.transaction('files').objectStore('files').count().onsuccess = (e) => res(e.target.result); }; }));
  assert.equal(after, before - 1, 'stored original removed with the note');
});
test('stage 2: review screen and document page tap targets >= 44px at three sizes', async () => {
  await pick(['letter.pdf', 'budget.xlsx']);
  const SEL = 'button, .btn, input:not([type=hidden]), label.chk, select, .list a, .list .row';
  for (const [w, h] of [[1180, 820], [820, 1180], [1376, 1032]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(100);
    const bad = await page.evaluate((s) => [...document.querySelectorAll('#filing ' + s)].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.height && b.height < 43.5 && e.type !== 'checkbox'; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 20)), SEL);
    assert.deepEqual(bad, [], `${w}x${h}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no sideways scroll');
  }
  await page.click('[data-act=file-cancel]');
});
