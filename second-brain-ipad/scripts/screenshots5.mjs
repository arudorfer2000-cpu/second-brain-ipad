// Captures a real screenshot of the Weekly review page (sample notes). Dev tool, not part of the app.
import { mkdirSync } from 'node:fs'; import { zipSync, strToU8 } from 'fflate'; import { start, setup } from '../tests/helpers.mjs';
const { server, browser, url } = await start({ port: 4390 });
const out = process.argv[2] || 'shots/manual'; mkdirSync(out, { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 1100 } })).newPage();
const p2 = (n) => String(n).padStart(2, '0'); const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const N = (fm, body) => `---\n${fm}\n---\n${body}`;
const V = { 'Projects/Kitchen renovation.md': N(`type: project\ncreated: ${off(-2)}`, '# Kitchen renovation\n\n- [ ] call the plumber\n- [ ] choose the tiles\n'), 'Decisions/Heating system.md': N('type: adr\nstatus: chosen', '# Heating system\n'), 'Projects/Tax return.md': N(`type: project\nfrist: ${off(-1)}`, '# Tax return\n'), 'Lessons/Notice period.md': N(`type: lesson\ncreated: ${off(-5)}`, '# Notice period\n') };
await setup(page, url); await page.evaluate(() => { location.hash = '#/import'; }); await page.setInputFiles('#imp', { name: 'v.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, strToU8(v)])))) }); await page.waitForSelector('#imsg .okmsg');
await page.evaluate(() => { location.hash = '#/review'; }); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await page.screenshot({ path: `${out}/review.png` });
await browser.close(); server.close();
