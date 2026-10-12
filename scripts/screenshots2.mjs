// Captures real screenshots of the document filing screens (sample content). Dev tool, not part of the app.
import { mkdirSync } from 'node:fs'; import { start, setup, importVault } from '../tests/helpers.mjs';
const { server, browser, url } = await start({ port: 4396 });
const out = process.argv[2] || 'shots/manual'; mkdirSync(out, { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
const FX = (n) => new URL('../tests/fixtures/' + n, import.meta.url).pathname;
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(300); };
const snap = async (n) => { await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); return page.screenshot({ path: `${out}/${n}.png` }); };
await setup(page, url); await importVault(page);
await go('#/import'); await page.setInputFiles('#imp', ['quote.docx', 'budget.xlsx', 'fake-encrypted.docx', 'scan.pdf'].map(FX)); await page.waitForSelector('#filing'); await page.waitForTimeout(300); await snap('filing-review');
await page.click('[data-act=file-go]'); await page.waitForSelector('#imsg:has-text("Filed")'); await snap('filing-done');
await go('#/search?q=' + encodeURIComponent('Cabinets type:docx')); await snap('search-docx');
await page.click('.res a >> nth=0'); await page.waitForSelector('[data-act=dl-orig]'); await snap('document-page');
await page.fill('.top .search input', 'insurance'); await page.press('.top .search input', 'Enter'); await page.waitForTimeout(300);
await go('#/sources'); await page.waitForSelector('#logbox .row'); await snap('sources');
await browser.close(); server.close();
