import test, { before, after } from 'node:test'; import assert from 'node:assert/strict';
import { start, setup, importVault, unlock } from './helpers.mjs';
let browser, server, url, page; const reqs = [];
before(async () => {
  ({ server, browser, url } = await start({ port: 4390 }));
  page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
  await setup(page, url); await importVault(page);
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(200); };
const NOTE = '#/note/' + encodeURIComponent('20 Decisions/Insurance provider.md');

test('K1 note page has the three thinking buttons; each opens the review with its own instruction and the note', async () => {
  const want = { challenge: /Challenge my thinking/, pattern: /Look for patterns/, brainstorm: /Brainstorm with me/ };
  for (const [m, re] of Object.entries(want)) {
    await go(NOTE); await page.click(`[data-act=think][data-m=${m}]`); await page.waitForSelector('#review');
    const t = await page.textContent('#review');
    assert.match(t, re, m); assert.match(t, /Insurance provider/, 'note title is included'); assert.match(t, /claims process is simpler/, 'note body is included'); assert.match(t, /^Focus:/, 'non-answer modes use Focus');
    assert.doesNotMatch(t, /Kitchen renovation/, 'only the one note');
  }
});
test('K2 ask page has the mode choice; Answer is the default and keeps the original text', async () => {
  await go(NOTE); await page.click('[data-act=ask-top]'); await page.waitForSelector('input[name=mode]'); assert.equal(await page.isChecked('input[name=mode][value=answer]'), true, 'top Ask AI button starts in Answer mode even after a thinking mode was used');
  await page.fill('#aq', 'Why this provider?'); await page.click('[data-act=review]'); await page.waitForSelector('#review');
  const t = await page.textContent('#review'); assert.match(t, /^Question: Why this provider\?/); assert.match(t, /Answer using only the notes below/);
});
test('K3 choosing a mode on the ask page changes the reviewed text; the question is kept', async () => {
  await go('#/ask'); await page.fill('#aq', 'Is my plan sound?'); await page.check('input[name=mode][value=challenge]');
  await page.check('input[type=checkbox][data-act=asksel]'); await page.click('[data-act=review]'); await page.waitForSelector('#review');
  const t = await page.textContent('#review'); assert.match(t, /^Focus: Is my plan sound\?/); assert.match(t, /Challenge my thinking/); assert.doesNotMatch(t, /Answer using only/);
});
test('K4 the copied clipboard text equals the reviewed text, and private notes stay out in a mode', async () => {
  await go('#/ask'); await page.check('input[name=mode][value=pattern]');
  const boxes = page.locator('input[type=checkbox][data-act=asksel]'); const n = await boxes.count(); for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await page.click('[data-act=review]'); await page.waitForSelector('#review'); const shown = await page.textContent('#review');
  assert.doesNotMatch(shown, /Very private thoughts/, 'private note excluded by default'); assert.match(shown, /Left out|Look for patterns/);
  await page.click('[data-act=copy]'); await page.waitForSelector('#rmsg .okmsg'); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), shown);
});
test('K5 locking resets the mode to Answer; nothing left the device', async () => {
  await go('#/ask'); await page.check('input[name=mode][value=brainstorm]'); assert.equal(await page.evaluate(() => document.querySelector('input[name=mode]:checked').value), 'brainstorm');
  await go('#/settings'); await page.click('[data-act=lock]'); await page.waitForSelector('#pw'); await unlock(page); await go('#/ask');
  assert.equal(await page.isChecked('input[name=mode][value=answer]'), true, 'back to Answer after lock and unlock');
  const ext = reqs.filter((u) => !u.startsWith(url) && !u.startsWith('data:') && !u.startsWith('blob:')); assert.deepEqual(ext, []);
});
