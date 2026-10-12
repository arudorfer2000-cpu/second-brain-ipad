// Captures real screenshots of the WhatsApp space screens (synthetic chats only). Dev tool, not part of the app.
import { mkdirSync } from 'node:fs'; import { zipSync, strToU8 } from 'fflate'; import { start, setup, importVault } from '../tests/helpers.mjs';
const { server, browser, url } = await start({ port: 4394 });
const out = process.argv[2] || 'shots/manual'; mkdirSync(out, { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(300); };
const snap = async (n) => { await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await page.screenshot({ path: `${out}/${n}.png` }); };
const ben = ['[11.10.26, 21:06:10] Anna: Hello Ben', '[11.10.26, 21:07:00] Ben: Did you bake the cake?', '[12.10.26, 08:00:01] Anna: We decided to go with option 2.', '[14.10.26, 18:30:00] Anna: Appointment on 20.10.26 at 14:00 with the installer', '[14.10.26, 18:31:00] Anna: Are you coming?'].join('\n');
const group = ['[01.02.26, 10:00:00] Anna: Who brings dessert?', '[01.02.26, 10:01:00] Ben: I bring dessert', '[01.02.26, 10:02:00] Cleo: Great'].join('\n');
const zip = (name, txt) => ({ name, mimeType: 'application/zip', buffer: Buffer.from(zipSync({ '_chat.txt': strToU8(txt) })) });
await setup(page, url, 'main long passphrase 1'); await importVault(page);
await go('#/whatsapp'); await snap('wa-create');
await page.fill('#wp1', 'whatsapp space passphrase'); await page.fill('#wp2', 'whatsapp space passphrase'); await page.click('#wcb'); await page.waitForSelector('#wark'); await snap('wa-recovery');
await page.check('#warkok'); await page.click('#warkgo'); await page.waitForSelector('#waimp');
await page.setInputFiles('#waimp', [zip('WhatsApp Chat with Ben.zip', ben), zip('WhatsApp Chat - Family.zip', group)]); await page.waitForSelector('#wafiling'); await snap('wa-review');
await page.click('[data-act=wa-go]'); await page.waitForSelector('a[href*="whatsapp/chat"]'); await snap('wa-space');
await page.click('a:has-text("Ben")'); await page.waitForSelector('.box'); await snap('wa-chat');
await browser.close(); server.close();
