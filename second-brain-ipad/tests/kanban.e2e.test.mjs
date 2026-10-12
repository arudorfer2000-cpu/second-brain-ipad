import test, { before, after } from 'node:test'; import assert from 'node:assert/strict'; import { zipSync, strToU8 } from 'fflate';
import { start, setup, unlock } from './helpers.mjs';
let browser, server, url, page; const reqs = [];
const N = (fm, body) => `---\n${fm}\n---\n${body}`;
const VAULT = {
  'Projects/Alpha.md': N('type: project\nstatus: idea\ndescription: First', '# Alpha\n\nbody A\n'),
  'Projects/Beta.md': N('type: project\nstatus: in progress', '# Beta\n\nbody B\n'),
  'Projects/Gamma.md': N('type: project\nstatus: done', '# Gamma\n\nbody G\n'),
  'Decisions/Delta.md': N('type: adr\nstatus: chosen option 2', '# Delta\n\nbody D\n'),
  'Lessons/NoStatus.md': N('type: lesson', '# NoStatus\n\nbody\n'),
  'Projects/Hidden.md': N('type: project\nstatus: open', '# Hidden\n\nbody H\n'),
};
before(async () => {
  ({ server, browser, url } = await start({ port: 4389 }));
  page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
  await setup(page, url); await page.evaluate(() => { location.hash = '#/import'; });
  await page.setInputFiles('#imp', { name: 'v.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(VAULT).map(([k, v]) => [k, strToU8(v)])))) }); await page.waitForSelector('#imsg .okmsg');
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(250); };
const cols = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.kb section')].map((s) => [s.getAttribute('aria-label'), [...s.querySelectorAll('.row a')].map((a) => a.textContent)])));

test('C1 board shows the cards in the right columns; notes without status are absent', async () => {
  await go('#/kanban'); assert.match(await page.textContent('h1'), /Kanban board/); const c = await cols();
  assert.deepEqual(c['Open'], ['Alpha', 'Hidden']); assert.deepEqual(c['In progress'], ['Beta']); assert.deepEqual(c['Done'], ['Gamma']); assert.deepEqual(c['Other status'], ['Delta']);
  assert.ok(!JSON.stringify(c).includes('NoStatus'));
  assert.match(await page.textContent('.nav'), /Kanban board/, 'reachable from the menu');
});
test('C2 moving a card changes the status line only and survives a reload of the view', async () => {
  const before = await page.evaluate(() => 0); void before;
  await page.click('[data-act=kb-move][data-p="Projects/Alpha.md"][data-c=doing]'); await page.waitForTimeout(400);
  let c = await cols(); assert.deepEqual(c['Open'], ['Hidden']); assert.deepEqual(c['In progress'], ['Alpha', 'Beta']);
  await go('#/note/' + encodeURIComponent('Projects/Alpha.md') + '?tab=edit'); const src = await page.inputValue('#ed');
  assert.match(src, /status: in progress/); assert.match(src, /description: First/, 'other frontmatter kept'); assert.match(src, /# Alpha\n\nbody A/, 'body untouched'); assert.ok(!/status: idea/.test(src));
  await go('#/kanban'); c = await cols(); assert.deepEqual(c['In progress'], ['Alpha', 'Beta']);
});
test('C3 an Other-status card can be moved into a real column; every card offers the two other columns, tap targets >= 44px', async () => {
  const btns = await page.evaluate(() => [...document.querySelectorAll('[data-act=kb-move]')].map((b) => ({ h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })));
  assert.ok(btns.length >= 8 && btns.every((b) => b.h >= 44 && b.w >= 44), JSON.stringify(btns.filter((b) => b.h < 44 || b.w < 44)));
  assert.equal(await page.locator('[data-act=kb-move][data-p="Decisions/Delta.md"]').count(), 3, 'other has all three targets');
  await page.click('[data-act=kb-move][data-p="Decisions/Delta.md"][data-c=done]'); await page.waitForTimeout(400); const c = await cols();
  assert.deepEqual(c['Done'], ['Delta', 'Gamma']); assert.equal(c['Other status'], undefined, 'empty Other column disappears');
});
test('C4 moves survive lock and unlock; a trashed card leaves the board; no network', async () => {
  await go('#/settings'); await page.click('[data-act=lock]'); await page.waitForSelector('#pw'); await unlock(page); await go('#/kanban');
  let c = await cols(); assert.deepEqual(c['Done'], ['Delta', 'Gamma']);
  await go('#/note/' + encodeURIComponent('Projects/Hidden.md')); await page.click('[data-act=trash]'); await page.waitForTimeout(300); await go('#/kanban'); c = await cols();
  assert.ok(!JSON.stringify(c).includes('Hidden'), 'trashed note not on the board');
  const ext = reqs.filter((u) => !u.startsWith(url) && !u.startsWith('data:') && !u.startsWith('blob:')); assert.deepEqual(ext, []);
});
test('C5 empty state when no note has a status', async () => {
  for (const p of ['Projects/Alpha.md', 'Projects/Beta.md', 'Projects/Gamma.md', 'Decisions/Delta.md']) { await go('#/note/' + encodeURIComponent(p) + '?tab=edit'); await page.fill('#ed', '# X\n\nno status'); await page.click('form[data-form=save] button[type=submit]'); await page.waitForSelector('.prose'); }
  await go('#/kanban'); assert.match(await page.textContent('.main'), /No note has a status yet/);
});
