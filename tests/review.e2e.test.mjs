import test, { before, after } from 'node:test'; import assert from 'node:assert/strict'; import { zipSync, strToU8 } from 'fflate';
import { start, setup } from './helpers.mjs';
let browser, server, url, page; const reqs = [];
const p2 = (n) => String(n).padStart(2, '0'); const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const N = (fm, body) => `---\n${fm}\n---\n${body}`;
const VAULT = {
  'Projects/Fresh.md': N(`type: project\ncreated: ${off(-2)}\ndescription: New this week`, '# Fresh\n\n- [ ] call plumber\n- [x] already done\n'),
  'Projects/Mid.md': N(`type: project\ncreated: ${off(-10)}\ndescription: Ten days old`, '# Mid\n\nbody\n'),
  'Decisions/Boiler.md': N('type: adr\nstatus: chosen\ndescription: Boiler choice', '# Boiler\n\nChose option 2.\n'),
  'Projects/Tax.md': N(`type: project\nfrist: ${off(-1)}\ndescription: File taxes`, '# Tax\n\nFile it.\n'),
  'Projects/Secret.md': N(`type: project\nprivate: true\ncreated: ${off(-1)}\ndescription: Private one`, '# Secret\n\nSECRETWORD inside.\n'),
  'Projects/Later created.md': N(`type: project\ncreated: ${off(16)}\ndescription: Created later`, '# Later created\n\nx\n'),
};
before(async () => {
  ({ server, browser, url } = await start({ port: 4391 }));
  page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
  await setup(page, url); await page.evaluate(() => { location.hash = '#/import'; });
  await page.setInputFiles('#imp', { name: 'v.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(VAULT).map(([k, v]) => [k, strToU8(v)])))) }); await page.waitForSelector('#imsg .okmsg');
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(200); };
const T = (s) => page.textContent(s);
const boxes = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.main .box')].map((b) => [b.querySelector('.h').textContent.replace(/ \(\d+\)$/, ''), [...b.querySelectorAll('.row:not(.m)')].map((r) => r.textContent.replace(/\s+/g, ' ').trim())])));

test('R2 week page: sections, new vs changed, decisions, tasks, deadlines', async () => {
  await go('#/review'); assert.match(await T('h1'), /Weekly review/); const b = await boxes();
  assert.ok(b['New'].some((r) => /^Fresh/.test(r)), 'created 2 days ago is new'); assert.ok(b['New'].some((r) => /^Secret/.test(r)), 'private note is listed on the own device');
  assert.ok(!b['New'].some((r) => /^Mid/.test(r)) && b['Changed'].some((r) => /^Mid/.test(r)), 'created 10 days ago is not new in a week, but was edited (imported) now');
  assert.ok(!b['New'].some((r) => /^Later created/.test(r)), 'created in the future is outside'); assert.ok(b['Decisions'].some((r) => /^Boiler/.test(r)));
  assert.ok(b['Open tasks'].some((r) => /call plumber/.test(r)) && !b['Open tasks'].some((r) => /already done/.test(r)));
  assert.ok(b['Overdue and due soon'].some((r) => /Tax.*1 day overdue/.test(r))); assert.match(await T('.main'), /Thinking loop/);
});
test('R2 month switch and moving the end date', async () => {
  await page.click('a.btn:has-text("Month")'); await page.waitForSelector('h1:has-text("Monthly review")'); let b = await boxes(); assert.ok(b['New'].some((r) => /^Mid/.test(r)), 'created 10 days ago is new in a month');
  await go('#/review?p=week&end=' + off(20)); b = await boxes(); assert.deepEqual(b['Changed'], [], 'nothing was edited in that window');
  assert.ok(b['New'].some((r) => /^Later created/.test(r)), 'window 14 to 20 days ahead contains the note created in 16 days'); assert.ok(!b['New'].some((r) => /^Fresh/.test(r)));
  assert.equal(await page.locator('.main .box:has(.h:has-text("Changed")) .row.m').count(), 1, 'empty state for Changed');
});
test('R2 save as report: only on tap, links resolve, second tap updates the same note', async () => {
  await go('#/search?q=' + encodeURIComponent('type:report')); assert.match(await T('.main'), /0 results/, 'nothing saved before the tap');
  await go('#/'); const redBefore = (await T('.home')).match(/Missing pages \(red links\)\s*(\d+)/); assert.ok(redBefore, 'home shows the red link count');
  await go('#/review'); await page.click('[data-act=review-save]'); await page.waitForURL(/Reports%2FReview-week-/); await page.waitForSelector('.prose'); assert.match(page.url(), /Reports%2FReview-week-/);
  const rp = decodeURIComponent(page.url().split('#/note/')[1]); assert.equal(rp, `Reports/Review-week-${off(0)}.md`); assert.match(await T('.main'), /\[\[Projects\/Fresh\]\]|Fresh/);
  await go('#/review'); await page.click('[data-act=review-save]'); await page.waitForTimeout(400); await go('#/search?q=' + encodeURIComponent('type:report')); assert.match(await T('.main'), /1 result\b/);
  await go('#/note/' + encodeURIComponent(rp) + '?tab=edit'); const txt = await page.inputValue('#ed'); assert.match(txt, /^---\ntype: report\ndescription: Weekly review /); assert.match(txt, /- \[\[Projects\/Fresh\]\]/); assert.match(txt, /- \[ \] call plumber \(\[\[Projects\/Fresh\]\]\)/); assert.match(txt, /## Thinking loop/);
  await go('#/'); const redAfter = (await T('.home')).match(/Missing pages \(red links\)\s*(\d+)/); assert.ok(redAfter); assert.equal(redAfter[1], redBefore[1], 'report links are not red links');
});
test('R2 Ask AI about the period: notes selected, private left out', async () => {
  await go('#/review'); await page.click('[data-act=review-ask]'); await page.waitForSelector('#aq'); assert.match(await T('label[for=af]'), /\(\d+ selected\)/);
  await page.click('[data-act=review]'); await page.waitForSelector('#review'); const t = await T('#review'); assert.match(t, /Fresh/); assert.ok(!t.includes('SECRETWORD'), 'private note content is not in the approval text'); assert.match(await T('.main, .modal'), /marked private/);
});
test('R2 tap targets >= 44px, no sideways scroll, no network', async () => {
  const SEL = 'button, .btn, a.btn, .nav a, .list a, .list .row, input, select';
  for (const [w, h] of [[1180, 820], [820, 1180], [1376, 1032]]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate((t) => { localStorage.setItem('theme', t); document.documentElement.setAttribute('data-theme', t); }, theme); await go('#/review');
    const bad = await page.evaluate((s) => [...document.querySelectorAll('.main ' + s)].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.height && b.height < 43.5; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 25)), SEL);
    assert.deepEqual(bad, [], `${w}x${h} ${theme}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  assert.ok(reqs.every((u) => u.startsWith(url) || u.startsWith('data:') || u.startsWith('blob:')));
});
test('R2 today() uses the local date: daily note near midnight in New York', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, timezoneId: 'America/New_York' }); await ctx.clock.setFixedTime(new Date('2026-10-13T03:30:00Z'));
  const pg = await ctx.newPage(); await setup(pg, url); await pg.evaluate(() => { location.hash = '#/new'; }); await pg.waitForSelector('#nk'); await pg.selectOption('#nk', 'daily'); await pg.fill('#nt', 'x'); await pg.click('button[type=submit]'); await pg.waitForSelector('#ed');
  assert.match(decodeURIComponent(pg.url()), /Daily\/2026-10-12\.md/, 'local date 12 Oct, not the UTC date 13 Oct'); assert.match(await pg.inputValue('#ed'), /date: 2026-10-12/); await ctx.close();
});
