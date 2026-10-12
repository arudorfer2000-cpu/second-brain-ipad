// Captures real screenshots of the Kanban board and the thinking-mode review (sample notes). Dev tool, not part of the app.
import { mkdirSync } from 'node:fs'; import { zipSync, strToU8 } from 'fflate'; import { start, setup } from '../tests/helpers.mjs';
const { server, browser, url } = await start({ port: 4388 });
const out = process.argv[2] || 'shots/manual'; mkdirSync(out, { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 900 } })).newPage();
const N = (fm, body) => `---\n${fm}\n---\n${body}`;
const V = { 'Projects/Kitchen renovation.md': N('type: project\nstatus: in progress\ndescription: New kitchen', '# Kitchen renovation\n\nWe plan to replace the oven and the tiles. The budget is tight.\n'), 'Projects/Garden shed.md': N('type: project\nstatus: idea', '# Garden shed\n'), 'Projects/Tax return.md': N('type: project\nstatus: done', '# Tax return\n'), 'Decisions/Heating system.md': N('type: adr\nstatus: chosen option 2', '# Heating system\n'), 'Projects/Insurance check.md': N('type: project\nstatus: open', '# Insurance check\n') };
await setup(page, url); await page.evaluate(() => { location.hash = '#/import'; }); await page.setInputFiles('#imp', { name: 'v.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, strToU8(v)])))) }); await page.waitForSelector('#imsg .okmsg');
const clean = () => page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
await page.evaluate(() => { location.hash = '#/kanban'; }); await page.waitForTimeout(300); await clean(); await page.screenshot({ path: `${out}/kanban.png` });
await page.evaluate(() => { location.hash = '#/note/' + encodeURIComponent('Projects/Kitchen renovation.md'); }); await page.waitForTimeout(300); await clean(); await page.screenshot({ path: `${out}/think-note.png` });
await page.click('[data-act=think][data-m=challenge]'); await page.waitForSelector('#review'); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/think-review.png` });
await browser.close(); server.close();
