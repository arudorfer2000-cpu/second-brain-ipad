import test, { before, after } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; import { zipSync, strToU8 } from 'fflate';
import { start, setup, importVault, unlock } from './helpers.mjs';
let browser, server, url, page, spaceKey; const reqs = []; const MAIN = 'main long passphrase 1'; const SPACE = 'whatsapp space passphrase';
const ben = ['[11.10.26, 21:06:10] Anna: Hallo Ben', '[11.10.26, 21:07:00] Ben: Hast du Zwiebelkuchen gebacken?', '[12.10.26, 08:00:01] Anna: Wir haben beschlossen, Option 2 zu nehmen.', '‎[13.10.26, 09:15:00] Ben: ‎<Anhang: 00000001-PHOTO.jpg>', '[14.10.26, 18:30:00] Anna: Termin am 20.10.26 um 14:00 beim Installateur', '[14.10.26, 18:31:00] Anna: Kommst du?'].join('\n');
const benMore = ben + '\n[15.10.26, 10:00:00] Ben: Ja ich komme\n[15.10.26, 10:01:00] Ben: Bis später';
const group = ['[01.02.26, 10:00:00] Anna: Wer bringt Quarkspeise mit?', '[01.02.26, 10:01:00] Ben: Ich bringe Quarkspeise', '[01.02.26, 10:02:00] Cleo: Super'].join('\n');
const cleo = ['[03.04.26, 10:00:00] Anna: Test eins', '[04.04.26, 10:00:00] Cleo: Test zwei'].join('\n');
const zip = (name, txt) => ({ name, mimeType: 'application/zip', buffer: Buffer.from(zipSync({ '_chat.txt': strToU8(txt) })) });
const F = { ben: () => zip('WhatsApp Chat with Ben.zip', ben), benMore: () => zip('WhatsApp Chat with Ben.zip', benMore), group: () => zip('WhatsApp Chat - Familie.zip', group), cleo: () => ({ name: 'WhatsApp Chat with Cleo.txt', mimeType: 'text/plain', buffer: Buffer.from(cleo) }) };
before(async () => {
  ({ server, browser, url } = await start({ port: 4395 }));
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  page = await ctx.newPage(); page.on('request', (r) => reqs.push(r.url())); page.on('pageerror', (e) => { throw e; });
  await setup(page, url, MAIN); await importVault(page);
});
after(async () => { await browser.close(); server.close(); });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); };
const T = (s) => page.textContent(s);
const pick = async (files) => { await page.setInputFiles('#waimp', files); await page.waitForSelector('#wafiling', { timeout: 20000 }); };
const dumpDb = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sbipad'); r.onsuccess = () => { const tx = r.result.transaction(['notes', 'files', 'meta']); const out = []; for (const s of ['notes', 'files', 'meta']) tx.objectStore(s).getAll().onsuccess = (e) => out.push(JSON.stringify(e.target.result)); tx.oncomplete = () => res(out.join('')); }; }));

test('W4 space: own passphrase rules, recovery key shown once', async () => {
  await go('#/whatsapp'); assert.match(await T('.main'), /Create WhatsApp space/);
  for (const [p, re] of [['short', /10 to 128|10 or more|passphrase of 10/i], [MAIN, /different from your main passcode/]]) { await page.fill('#wp1', p); await page.fill('#wp2', p); await page.click('#wcb'); await page.waitForTimeout(400); assert.match(await T('#wmsg'), re); }
  await page.fill('#wp1', SPACE); await page.fill('#wp2', SPACE + 'x'); await page.click('#wcb'); await page.waitForTimeout(300); assert.match(await T('#wmsg'), /do not match/);
  await page.fill('#wp2', SPACE); await page.click('#wcb'); await page.waitForSelector('#wark'); spaceKey = await T('#wark'); assert.ok(spaceKey.length >= 39);
  assert.equal(await page.isDisabled('#warkgo'), true); await page.check('#warkok'); await page.click('#warkgo'); await page.waitForSelector('#waimp');
  assert.match(await T('.main'), /No chats yet/);
});
test('W5 review first: nothing stored before confirm; summary-only import', async () => {
  await pick([F.ben()]); const t = await T('#wafiling'); assert.match(t, /Nothing has been stored yet/); assert.match(t, /New chat/); assert.match(t, /6 messages/); assert.match(t, /Anna, Ben|Ben, Anna/);
  await go('#/whatsapp'); assert.match(await T('.main'), /No chats yet/, 'reload of the page shows nothing stored');
  await pick([F.ben()]); await page.click('[data-act=wa-go]'); await page.waitForSelector('a[href*="whatsapp/chat"]'); const l = await T('.main'); assert.match(l, /Ben/); assert.match(l, /summary only/); assert.match(l, /6 messages/);
});
test('W5 duplicate, group excluded by default, ambiguous date order switch', async () => {
  await pick([F.ben(), F.group()]); let t = await T('#wafiling'); assert.match(t, /Duplicate/); assert.match(t, /already imported/); assert.match(t, /Group chat/);
  assert.equal(await page.locator('#wafiling input[type=checkbox]:checked').count(), 0); assert.equal(await page.isDisabled('[data-act=wa-go]'), true);
  await page.click('[data-act=wa-cancel]');
  await pick([F.cleo()]); t = await T('#wafiling'); assert.match(t, /2026-04-03/); assert.match(t, /Date order/);
  await page.selectOption('#wo0', 'mdy'); await page.waitForSelector('#wafiling:has-text("2026-03-04")'); await page.click('[data-act=wa-cancel]');
});
test('W5 append: longer export adds only the new messages', async () => {
  await pick([F.benMore()]); const t = await T('#wafiling'); assert.match(t, /More messages/); assert.match(t, /8 messages \(2 new\)/);
  await page.click('[data-act=wa-go]'); await page.waitForSelector('.okmsg:has-text("2 messages added")');
  await page.click('a[href*="whatsapp/chat"]'); await page.waitForSelector('.box'); assert.match(await T('.main'), /Messages: 8/);
  await go('#/whatsapp'); await pick([F.benMore()]); assert.match(await T('#wafiling'), /Duplicate/); await page.click('[data-act=wa-cancel]');
});
test('W2/W6 group included on request with full text; reading, filter, search', async () => {
  await pick([F.group()]); await page.check('[data-act=wasel]'); await page.selectOption('#wm0', 'full'); await page.click('[data-act=wa-go]'); await page.waitForSelector('.okmsg:has-text("Familie")');
  await page.fill('form[data-form=wasearch] input', 'Quarkspeise'); await page.press('form[data-form=wasearch] input', 'Enter'); await page.waitForSelector('#wares a'); assert.match(await T('#wares'), /Familie/);
  await page.fill('form[data-form=wasearch] input', 'Zwiebelkuchen'); await page.press('form[data-form=wasearch] input', 'Enter'); await page.waitForTimeout(200);
  assert.match(await T('#wares'), /No matches/, 'summary-only chat does not keep ordinary message text');
  await page.fill('form[data-form=wasearch] input', 'Option 2'); await page.press('form[data-form=wasearch] input', 'Enter'); await page.waitForSelector('#wares a'); assert.match(await T('#wares'), /Ben/, 'flagged decision line is searchable');
  await page.click('a:has-text("Familie")'); await page.waitForSelector('#wf'); assert.match(await T('#wamsgs'), /Ich bringe Quarkspeise/); await page.fill('#wf', 'Super'); assert.equal(await page.locator('#wamsgs .res').count(), 1);
});
test('W6 Ask AI: approval text equals clipboard', async () => {
  await page.click('[data-act=wa-ask]'); await page.waitForSelector('#wareview'); const shown = await T('#wareview'); assert.match(shown, /Quarkspeise/); assert.match(shown, /I paste this myself/);
  await page.click('[data-act=wa-copy]'); await page.waitForSelector('#wamsg .okmsg'); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), shown); await page.click('[data-act=wa-close]');
});
test('W4 isolation: no plaintext in IndexedDB, main search and Ask AI never see chats, no network', async () => {
  const dump = await dumpDb(); for (const w of ['Quarkspeise', 'Zwiebelkuchen', 'Installateur', 'Familie', 'Cleo', 'Option 2']) assert.ok(!dump.includes(w), 'plaintext leak: ' + w);
  await go('#/search?q=Quarkspeise'); assert.match(await T('.main'), /0 results/); await go('#/search?q=Installateur'); assert.match(await T('.main'), /0 results/);
  await go('#/ask'); assert.ok(!/WhatsApp|Familie|Quarkspeise/.test(await T('.main')), 'Ask AI list has no chats');
  assert.ok(reqs.every((u) => u.startsWith(url) || u.startsWith('data:') || u.startsWith('blob:')), 'only same-origin requests');
});
test('W4 lock: space stays locked after main lock; wrong passphrase fails; recovery key path', async () => {
  await go('#/settings'); await page.click('[data-act=lock]'); await page.waitForSelector('#pw'); await unlock(page, MAIN); await go('#/whatsapp');
  assert.match(await T('.main'), /locked/); await page.fill('#wu', 'wrong wrong wrong'); await page.press('#wu', 'Enter'); await page.waitForSelector('#wmsg .err'); assert.match(await T('#wmsg'), /Wrong passphrase/);
  await page.fill('#wu', SPACE); await page.press('#wu', 'Enter'); await page.waitForSelector('a[href*="whatsapp/chat"]'); assert.match(await T('.main'), /Familie/);
  await page.click('[data-act=wa-lock]'); await page.waitForSelector('#wu'); assert.match(await T('.main'), /locked/);
});
test('W4 recovery key unlocks the space', async () => {
  await go('#/whatsapp'); await page.click('[data-act=wa-userk]'); await page.fill('#wrkin', 'AAAA-BBBB-CCCC'); await page.click('[data-act=wa-rkunlock]'); await page.waitForSelector('#wmsg .err'); assert.match(await T('#wmsg'), /does not match/);
  await page.fill('#wrkin', spaceKey); await page.click('[data-act=wa-rkunlock]'); await page.waitForSelector('a[href*="whatsapp/chat"]'); assert.match(await T('.main'), /Familie/); await page.click('[data-act=wa-lock]'); await page.waitForSelector('#wu');
});
test('W7 backup contains the space; restore brings it back', async () => {
  await go('#/backup'); const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=backup]')]); const path = await d.path(); const raw = readFileSync(path, 'utf8');
  for (const w of ['Quarkspeise', 'Familie', 'Zwiebelkuchen']) assert.ok(!raw.includes(w), 'backup must be encrypted: ' + w); assert.ok(JSON.parse(raw).wa, 'wa meta in backup');
  await go('#/settings'); await page.click('[data-act=wipe-ask]'); await page.fill('#ty', 'ERASE'); await page.click('#yes'); await page.waitForSelector('#s1');
  await page.setInputFiles('#rf', path); await page.waitForSelector('#pw'); await unlock(page, MAIN); await go('#/whatsapp');
  await page.fill('#wu', SPACE); await page.press('#wu', 'Enter'); await page.waitForSelector('a[href*="whatsapp/chat"]'); const t = await T('.main'); assert.match(t, /Familie/); assert.match(t, /Ben/); assert.match(t, /8 messages/);
  await page.click('a:has-text("Familie")'); await page.waitForSelector('#wf'); assert.match(await T('#wamsgs'), /Quarkspeise/);
});
test('W8 tap targets >= 44px and no sideways scroll on the WhatsApp pages at three sizes', async () => {
  await go('#/whatsapp'); await page.waitForSelector('#waimp'); await page.setInputFiles('#waimp', [F.group()]); await page.waitForSelector('#wafiling');
  const SEL = 'button, .btn, input:not([type=hidden]):not([type=checkbox]), select, label.chk, .list a, .nav a, .tabs a';
  const hrefs = ['#/whatsapp'];
  for (const [w, h] of [[1180, 820], [820, 1180], [1376, 1032]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(100);
    for (const hr of hrefs) { const bad = await page.evaluate((s) => [...document.querySelectorAll('.main ' + s)].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.height && b.height < 43.5; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 20)), SEL); assert.deepEqual(bad, [], `${hr} ${w}x${h}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); }
  }
  await page.click('[data-act=wa-cancel]'); await page.click('a:has-text("Familie")'); await page.waitForSelector('#wf');
  for (const [w, h] of [[1180, 820], [820, 1180], [1376, 1032]]) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(100); const bad = await page.evaluate((s) => [...document.querySelectorAll('.main ' + s)].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.height && b.height < 43.5; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 20)), SEL); assert.deepEqual(bad, [], `chat ${w}x${h}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); }
});
