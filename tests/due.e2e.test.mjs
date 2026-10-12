import test, { before, after } from 'node:test'; import assert from 'node:assert/strict'; import { zipSync, strToU8 } from 'fflate';
import { start, setup } from './helpers.mjs';
let browser, server, url, page; const reqs = [];
const N = (fm, body) => `---\n${fm}\n---\n${body}`;
const VAULT = {
  'Obligations/Rent.md': N('type: verpflichtung\nrhythmus: monthly\nstart: 2026-01-31\nzuletzt: 2026-09-30\ndescription: Monthly rent', '# Rent\n\nPay the rent.'),
  'Obligations/Water plants.md': N('type: verpflichtung\nrhythmus: weekly\nstart: 2026-10-05\nzuletzt: 2026-10-05\ndescription: Plants', '# Water plants\n\nWater them.'),
  'Obligations/Insurance.md': N('type: verpflichtung\nrhythmus: yearly\nstart: 2025-10-14\nzuletzt: 2025-10-14\ndescription: Renew', '# Insurance\n\nRenew.'),
  'Obligations/Old chore.md': N('type: verpflichtung\nrhythmus: daily\nstart: 2026-10-01\ndescription: Daily chore', '# Old chore\n\nDo it.'),
  'Projects/Tax return.md': N('type: project\nstatus: planning\nfrist: 2026-10-10\ndescription: File the tax return', '# Tax return\n\nFile it.'),
  'Obligations/Broken.md': N('type: verpflichtung\nrhythmus: whenever\ndescription: Broken', '# Broken\n\nNo valid rhythm.'),
};
before(async () => {
  ({ server, browser, url } = await start({ port: 4393 }));
  page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
  await setup(page, url); await page.evaluate(() => { location.hash = '#/import'; });
  await page.setInputFiles('#imp', { name: 'v.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(VAULT).map(([k, v]) => [k, strToU8(v)])))) }); await page.waitForSelector('#imsg .okmsg');
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(200); };
const T = (s) => page.textContent(s);
const sections = () => page.evaluate(() => [...document.querySelectorAll('.main .box')].map((b) => [b.querySelector('.h').textContent, [...b.querySelectorAll('.row:not(.m)')].map((r) => r.textContent.replace(/\s+/g, ' ').trim())]));

test('F2 page: overdue, soon, later, problems with relative wording', async () => {
  await go('#/due?today=2026-10-12'); const s = await sections(); const by = Object.fromEntries(s.map(([h, r]) => [h.replace(/ \(\d+\)$/, ''), r]));
  assert.equal(by['Overdue'].length, 2); assert.match(by['Overdue'][0], /Old chore.*2026-10-01.*11 days overdue/); assert.match(by['Overdue'][1], /Tax return.*one-time deadline.*2026-10-10.*2 days overdue/);
  assert.equal(by['Due in the next 7 days'].length, 2); assert.match(by['Due in the next 7 days'][0], /Water plants.*every week.*2026-10-12.*today/); assert.match(by['Due in the next 7 days'][1], /Insurance.*every year.*2026-10-14.*in 2 days/);
  assert.equal(by['Later'].length, 1); assert.match(by['Later'][0], /Rent.*every month.*2026-10-31.*in 19 days/);
  assert.match(by['Needs attention'][0], /Broken.*valid rhythm/);
  await page.click('a:has-text("30 days")'); await page.waitForTimeout(200); const s2 = Object.fromEntries((await sections()).map(([h, r]) => [h.replace(/ \(\d+\)$/, ''), r]));
  assert.equal(s2['Due in the next 30 days'].length, 3); assert.equal(s2['Later'].length, 0); assert.match(await T('.main'), /Nothing further ahead/);
});
test('F2 mark done: sets zuletzt, keeps history, next date moves', async () => {
  await go('#/due?today=2026-10-12'); await page.click('button[aria-label="Mark Old chore done today"]'); await page.waitForTimeout(400);
  const by = Object.fromEntries((await sections()).map(([h, r]) => [h.replace(/ \(\d+\)$/, ''), r]));
  assert.equal(by['Overdue'].length, 1); assert.match(by['Overdue'][0], /Tax return/); assert.ok(by['Due in the next 7 days'].some((r) => /Old chore.*last done 2026-10-12.*2026-10-13.*tomorrow/.test(r)));
  await go('#/note/' + encodeURIComponent('Obligations/Old chore.md') + '?tab=history'); assert.match(await T('.main'), /Show/); await go('#/note/' + encodeURIComponent('Obligations/Old chore.md') + '?tab=edit');
  const txt = await page.inputValue('#ed'); assert.match(txt, /zuletzt: 2026-10-12/); assert.match(txt, /rhythmus: daily\nstart: 2026-10-01\n/); assert.match(txt, /# Old chore\n\nDo it\./);
});
test('F2 infobox shows next due, home shows badge and link, template creates a valid obligation', async () => {
  await go('#/note/' + encodeURIComponent('Obligations/Rent.md')); assert.match(await T('.info'), /Next due/); assert.match(await T('.info'), /2026-10-31/); assert.match(await T('.info'), /Obligation/);
  await go('#/'); assert.match(await T('.home'), /Deadlines \(.*overdue/); await page.click('.home a[href="#/due"]'); await page.waitForSelector('h1:has-text("Deadlines")');
  await go('#/new'); await page.fill('#nt', 'Check smoke detector'); await page.selectOption('#nk', 'obligation'); await page.click('button[type=submit]'); await page.waitForSelector('#ed');
  const txt = await page.inputValue('#ed'); assert.match(txt, /type: verpflichtung/); assert.match(txt, /rhythmus: monthly/);
  await page.click('button:has-text("Save")').catch(() => {}); await page.waitForTimeout(300); await go('#/due'); assert.match(await T('.main'), /Check smoke detector/);
});
test('F2 tap targets >= 44px, no sideways scroll, no network', async () => {
  const SEL = 'button, .btn, a.btn, .nav a, .list a, .list .row, input, select';
  for (const [w, h] of [[1180, 820], [820, 1180], [1376, 1032]]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate((t) => { localStorage.setItem('theme', t); document.documentElement.setAttribute('data-theme', t); }, theme); await go('#/due?today=2026-10-12');
    const bad = await page.evaluate((s) => [...document.querySelectorAll('.main ' + s)].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.height && b.height < 43.5; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 25)), SEL);
    assert.deepEqual(bad, [], `${w}x${h} ${theme}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no sideways scroll');
  }
  assert.ok(reqs.every((u) => u.startsWith(url) || u.startsWith('data:') || u.startsWith('blob:')));
});
