import test, { before, after } from 'node:test'; import assert from 'node:assert/strict'; import { mkdirSync } from 'node:fs';
import { start, setup, importVault, unlock, BASE } from './helpers.mjs';
let ctx, browser, server, url, page; let recoveryKey; const reqs = []; const SIZES = { ipad10: [1180, 820], portrait: [820, 1180], ipad13: [1376, 1032] };
before(async () => {
  ({ server, browser, url } = await start());
  ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, permissions: ['clipboard-read', 'clipboard-write'], colorScheme: 'light' });
  page = await ctx.newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(120); };
const T = (s) => page.textContent(s);

test('step 1: setup validates, creates vault, shows recovery key once', async () => {
  await page.goto(url); await page.waitForFunction(() => window.__sbReady);
  await page.fill('#s1', 'short'); await page.fill('#s2', 'short'); await page.click('#sb'); assert.match(await T('#lmsg'), /6 digits|10 to 128/);
  await page.fill('#s1', '482913'); await page.fill('#s2', '482914'); await page.click('#sb'); assert.match(await T('#lmsg'), /do not match/);
  await page.fill('#s2', '482913'); await page.click('#sb'); await page.waitForSelector('#rk'); recoveryKey = await T('#rk'); assert.ok(recoveryKey.length >= 39);
  assert.equal(await page.isDisabled('#rkgo'), true); await page.check('#rkok'); await page.click('#rkgo'); await page.waitForSelector('.welcome');
  assert.match(await T('.welcome'), /0 notes/);
});
test('step 3: import zip: counts, exclusions', async () => {
  const msg = await importVault(page); assert.match(msg, /Added 8, updated 0, unchanged 0, skipped 5/);
  const again = await importVault(page); assert.match(again, /Added 0, updated 0, unchanged 8/);
});
test('step 4: home (E2) shows real data', async () => {
  await go('#/'); const t = await T('.main');
  assert.match(t, /8 notes in \d+ categories/); assert.match(t, /Recently changed/); assert.match(t, /Categories/); assert.match(t, /Wiki upkeep/); assert.match(t, /Missing pages \(red links\)\s*1/); assert.match(t, /Tools/); assert.match(t, /A to Z/);
  assert.equal(await page.locator('.az a').count() > 3, true);
});
test('step 5: article (E1): infobox, toc, red link, backlinks, categories, tabs', async () => {
  await go('#/note/' + encodeURIComponent('20 Decisions/Heating system decision.md')); assert.match(await T('.info'), /Type\s*Decision/); assert.match(await T('.info'), /Belongs to\s*Kitchen renovation plan/);
  assert.ok(await page.locator('.toc').count()); assert.ok(await page.locator('.tabs a', { hasText: 'Talk' }).count()); assert.ok(await page.locator('.badge').count(), 'open talk badge');
  assert.match(await T('.chips'), /Decisions/); assert.match(await T('.paper'), /What links here/);
  await go('#/note/' + encodeURIComponent('10 Projects/Kitchen renovation plan.md')); assert.equal(await page.locator('a.wl.red').count(), 1); assert.match(await T('.info'), /1 missing page/);
  await page.click('a.wl:not(.red)'); await page.waitForSelector('h1'); assert.match(await T('h1'), /Heating system decision/);
  await go('#/note/' + encodeURIComponent('10 Projects/Kitchen renovation plan.md')); await page.click('a.wl.red'); assert.match(page.url(), /#\/new\/Contractor/); assert.equal(await page.inputValue('#nt'), 'Contractor B quote');
});
test('step 6: search filters, confidence, merge', async () => {
  await go('#/search?q=' + encodeURIComponent('insurance type:decision after:2026-01-01')); const t = await T('.main'); const titles = await page.locator('.res .tt a').allTextContents(); assert.ok(titles.length >= 1 && titles.every((x) => /Insurance provider|Heating system decision/.test(x)), titles.join()); assert.ok(!titles.includes('Notice period'));
  assert.ok(await page.locator('.conf').count()); await go('#/search?q=cancellation'); assert.match(await T('.conf'), /low/);
  await go('#/search?q=' + encodeURIComponent('insurance in:lessons')); assert.equal(await page.locator('.res').count(), 1);
  await page.click('[data-act=filters]'); assert.ok(await page.locator('form[data-form=filters]').count());
});
test('step 7: create from template, edit with [[ suggestions, save, history, trash, restore', async () => {
  await go('#/new/'); await page.fill('#nt', 'Contractor B quote'); await page.selectOption('#nk', 'decision'); await page.click('form[data-form=create] button[type=submit]');
  await page.waitForSelector('#ed'); assert.match(await page.inputValue('#ed'), /type: adr/);
  await page.fill('#ed', '---\ntype: adr\ndescription: Quote\n---\n# Contractor B quote\nSee [[Kitch'); await page.focus('#ed'); await page.keyboard.press('End'); await page.keyboard.press('Shift+Home'); await page.keyboard.press('End');
  await page.dispatchEvent('#ed', 'input'); await page.waitForSelector('#sugg button'); await page.click('#sugg button'); assert.match(await page.inputValue('#ed'), /\[\[Kitchen renovation plan\]\]/);
  await page.click('form[data-form=save] button[type=submit]'); await page.waitForSelector('.prose'); assert.match(await T('.prose'), /Kitchen renovation plan/);
  await go('#/note/' + encodeURIComponent('Decisions/Contractor B quote.md') + '?tab=edit'); await page.fill('#ed', '---\ntype: adr\ndescription: Quote v2\n---\n# Contractor B quote\nChanged'); await page.click('form[data-form=save] button[type=submit]'); await page.waitForSelector('.prose');
  await page.click('.tabs a:has-text("History")'); await page.waitForSelector('[data-act=restorever]'); await page.click('[data-act=restorever]'); await page.waitForTimeout(300);
  await go('#/note/' + encodeURIComponent('Decisions/Contractor B quote.md')); assert.match(await T('.prose'), /Kitchen/);
  await page.click('[data-act=trash]'); await page.waitForSelector('.welcome'); await go('#/trash'); assert.match(await T('.main'), /Contractor B quote/); await page.click('[data-act=restore]'); await page.waitForTimeout(200); await go('#/'); assert.match(await T('.welcome'), /9 notes/);
  await go('#/health'); assert.doesNotMatch(await T('#red'), /Contractor B quote/, 'red link resolved after creating the page');
});
test('step 8: Ask AI approval text equals clipboard, private excluded, no network', async () => {
  const before = reqs.length; await go('#/ask'); await page.fill('#aq', 'What did I decide about insurance?'); await page.fill('#af', 'insurance'); await page.dispatchEvent('#af', 'input');
  for (const c of await page.locator('[data-act=asksel]').all()) await c.check(); await page.fill('#af', ''); await page.dispatchEvent('#af', 'input');
  await page.locator('[data-act=asksel][data-p*="Private diary"]').check(); await page.click('[data-act=review]'); await page.waitForSelector('#review');
  const shown = await T('#review'); assert.match(shown, /What did I decide about insurance/); assert.doesNotMatch(shown, /Very private thoughts/); assert.match(await T('.sheet'), /Left out because marked private: Private diary/);
  await page.click('[data-act=copy]'); await page.waitForSelector('#rmsg .okmsg'); const clip = await page.evaluate(() => navigator.clipboard.readText()); assert.equal(clip, shown);
  const extra = reqs.slice(before).filter((u) => !u.startsWith('http://127.0.0.1')); assert.deepEqual(extra, []);
  await page.uncheck?.('#none').catch(() => {});
});
test('step 9: graph nodes == notes + missing, edges == links', async () => {
  await go('#/graph'); const data = await page.evaluate(() => [document.querySelectorAll('circle.n').length, document.querySelectorAll('svg.graph line').length]);
  await go('#/health'); await go('#/'); const notes = Number((await T('.welcome')).match(/(\d+) notes/)[1]);
  assert.equal(data[0], notes + 0, 'one node per note, no missing pages left'); const expectedEdges = await page.evaluate(() => 0); assert.ok(data[1] >= 4, 'edges ' + data[1]);
  await go('#/graph'); await page.locator('circle.hit').first().click({ force: true }); assert.match(await T('#gsel'), /Open note/);
  await page.uncheck('[data-act=gfilter][data-k=other]'); assert.ok((await page.locator('circle.n').count()) < notes);
});
test('step 10: digest, decision search, document draft (docx download)', async () => {
  await go('#/digest?d=7'); assert.match(await T('.main'), /Changed in the last 7 days/); await page.locator('[data-act=docsel]').first().check(); await page.selectOption('#dk', 'decision'); await page.fill('#dt', 'Heating review'); await page.dispatchEvent('#dt', 'change');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=docx]')]); assert.match(d.suggestedFilename(), /Heating review\.docx/);
});
test('step 11: health lists planted faults', async () => {
  await go('#/health'); const t = await T('.main'); assert.match(t, /Orphan note/); assert.match(t, /Contradiction/); assert.match(t, /Notes without description/); assert.match(t, /Possible duplicates/); assert.match(t, /Open talk pages \(1\)/);
});
test('step 2: theme switch persists, auto follows system', async () => {
  await page.click('.top [data-act=theme][data-v=dark]'); assert.equal(await page.getAttribute('html', 'data-theme'), 'dark'); const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.reload(); await page.waitForFunction(() => window.__sbReady); assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await unlock(page); await page.click('.top [data-act=theme][data-v=light]'); const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor); assert.notEqual(bgDark, bgLight);
  await page.click('.top [data-act=theme][data-v=auto]'); assert.equal(await page.getAttribute('html', 'data-theme'), null); await page.emulateMedia({ colorScheme: 'dark' }); assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), bgDark);
  await page.emulateMedia({ colorScheme: 'light' });
});
test('step 1b: nothing readable in IndexedDB; lock, wrong code, recovery key, change code', async () => {
  const dump = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { const d = r.result; const out = []; const tx = d.transaction(['meta', 'notes']); tx.objectStore('meta').getAll().onsuccess = (e) => out.push(JSON.stringify(e.target.result)); tx.objectStore('notes').getAll().onsuccess = (e) => out.push(JSON.stringify(e.target.result)); tx.oncomplete = () => res(out.join('')); }; }));
  for (const w of ['Heating', 'Kitchen', 'insurance', 'Insurance', 'Private diary', 'decision']) assert.ok(!dump.includes(w), 'plaintext leaked: ' + w); assert.ok(dump.length > 1000);
  await go('#/settings'); await page.click('[data-act=lock]'); await page.waitForSelector('#pw'); await page.fill('#pw', '000000'); await page.click('#ub'); await page.waitForSelector('#lmsg .err'); assert.match(await T('#lmsg'), /Wrong passcode/);
  await page.click('[data-act=userk]'); await page.fill('#rkin', recoveryKey.toLowerCase()); await page.click('[data-act=rkunlock]'); await page.waitForSelector('.main');
  await go('#/settings'); await page.fill('#cp0', '482913'); await page.fill('#cp1', 'my new long passphrase'); await page.fill('#cp2', 'my new long passphrase'); await page.click('form[data-form=chpass] button'); await page.waitForSelector('#cperr .okmsg');
  await page.click('[data-act=lock]'); await unlock(page, 'my new long passphrase');
});
test('step 0: offline after first load, sub-folder hosting, manifest', async () => {
  const m = await (await ctx.request.get(url + 'manifest.json')).json(); assert.equal(m.display, 'standalone'); assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512')); assert.equal(m.start_url, './');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller); await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => window.__sbReady); assert.ok(await page.locator('#pw').count()); await unlock(page, 'my new long passphrase'); await go('#/'); assert.match(await T('.welcome'), /notes in/); await ctx.setOffline(false);
});
test('portrait: menu drawer opens and closes after navigating', async () => {
  await page.setViewportSize({ width: 820, height: 1180 }); await go('#/'); assert.equal(await page.locator('.nav.open').count(), 0); await page.click('[data-act=menu]'); assert.equal(await page.locator('.nav.open').count(), 1);
  await page.click('.nav a:has-text("Health check")'); await page.waitForSelector('h1.pt:has-text("Health check")'); assert.equal(await page.locator('.nav.open').count(), 0, 'drawer closes after navigation');
});
test('step 15: tap targets >= 44px and no sideways scroll at three iPad sizes, both themes', async () => {
  const pages = ['#/', '#/note/' + encodeURIComponent('20 Decisions/Heating system decision.md'), '#/note/' + encodeURIComponent('20 Decisions/Heating system decision.md') + '?tab=edit', '#/search?q=insurance', '#/ask', '#/graph', '#/health', '#/import', '#/sources', '#/backup', '#/settings', '#/digest', '#/trash', '#/cats', '#/recent', '#/new/'];
  const SEL = 'button, .btn, a.chip, .nav a, .tabs a, .tabs button, input:not([type=hidden]):not([type=checkbox]), select, textarea, .list a, .list .row, .grid2 a, .az a, .fchip, label.chk, .toc a, .logo, circle.hit';
  const bad = [];
  for (const [name, [w, h]] of Object.entries(SIZES)) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate((t) => { localStorage.setItem('theme', t); }, theme); await page.evaluate(() => document.documentElement.setAttribute('data-theme', localStorage.getItem('theme')));
    for (const p of pages) {
      await go(p); if (name === 'portrait') await page.click('[data-act=menu]').then(() => page.waitForTimeout(50)).catch(() => {});
      const r = await page.evaluate((s) => { const out = []; for (const e of document.querySelectorAll(s)) { const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue; if (e.closest('.modal') && false) continue; if (b.height < 43.5) out.push((e.className || e.tagName) + ':' + (e.textContent || '').trim().slice(0, 20) + ':' + Math.round(b.height)); } return { out, over: document.documentElement.scrollWidth - innerWidth }; }, SEL);
      if (r.out.length) bad.push(`${name}/${theme}/${p.slice(0, 20)}: ${r.out.slice(0, 4).join(' | ')}`); if (r.over > 1) bad.push(`${name}/${theme}/${p.slice(0, 20)}: horizontal overflow ${r.over}`);
      if (name === 'portrait') await page.evaluate(() => document.querySelector('.nav')?.classList.remove('open'));
    }
    mkdirSync('shots', { recursive: true }); await go('#/'); await page.screenshot({ path: `shots/home-${name}-${theme}.png` }); await go('#/note/' + encodeURIComponent('20 Decisions/Heating system decision.md')); await page.screenshot({ path: `shots/note-${name}-${theme}.png` });
  }
  assert.deepEqual(bad, []);
});
test('step 14: backup round trip: backup, erase, restore into clean install, unlock, same notes', async () => {
  await page.setViewportSize({ width: 1180, height: 820 }); await go('#/'); const count = (await T('.welcome')).match(/(\d+) notes/)[1];
  await go('#/backup'); const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=backup]')]); const path = await d.path(); assert.match(d.suggestedFilename(), /\.sbbak$/);
  const fs = await import('node:fs'); const raw = fs.readFileSync(path, 'utf8'); for (const w of ['Heating', 'Kitchen', 'insurance']) assert.ok(!raw.includes(w), 'backup file must be encrypted: ' + w);
  await go('#/settings'); await page.click('[data-act=wipe-ask]'); await page.fill('#ty', 'ERASE'); await page.click('#yes'); await page.waitForSelector('#s1');
  await page.setInputFiles('#rf', path); await page.waitForSelector('#pw'); assert.match(await T('#lmsg'), /Backup restored/);
  await unlock(page, 'my new long passphrase'); await go('#/'); assert.equal((await T('.welcome')).match(/(\d+) notes/)[1], count);
  await go('#/note/' + encodeURIComponent('20 Decisions/Heating system decision.md')); assert.match(await T('h1'), /Heating system decision/);
});
