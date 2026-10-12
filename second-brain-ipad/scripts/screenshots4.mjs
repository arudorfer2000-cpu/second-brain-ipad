// Captures a real screenshot of the Deadlines page (sample notes). Dev tool, not part of the app.
import { mkdirSync } from 'node:fs'; import { zipSync, strToU8 } from 'fflate'; import { start, setup } from '../tests/helpers.mjs';
const { server, browser, url } = await start({ port: 4392 });
const out = process.argv[2] || 'shots/manual'; mkdirSync(out, { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
const N = (fm, body) => `---\n${fm}\n---\n${body}`;
const V = { 'Obligations/Rent.md': N('type: verpflichtung\nrhythmus: monthly\nstart: 2026-01-31\nzuletzt: 2026-09-30', '# Rent\n'), 'Obligations/Water plants.md': N('type: verpflichtung\nrhythmus: weekly\nstart: 2026-10-05\nzuletzt: 2026-10-05', '# Water plants\n'), 'Obligations/Insurance renewal.md': N('type: verpflichtung\nrhythmus: yearly\nstart: 2025-10-14\nzuletzt: 2025-10-14', '# Insurance renewal\n'), 'Obligations/Backup check.md': N('type: verpflichtung\nrhythmus: daily\nstart: 2026-10-01', '# Backup check\n'), 'Projects/Tax return.md': N('type: project\nstatus: planning\nfrist: 2026-10-10', '# Tax return\n'), 'Obligations/Broken.md': N('type: verpflichtung', '# Broken\n') };
await setup(page, url); await page.evaluate(() => { location.hash = '#/import'; }); await page.setInputFiles('#imp', { name: 'v.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, strToU8(v)])))) }); await page.waitForSelector('#imsg .okmsg');
await page.evaluate(() => { location.hash = '#/due?today=2026-10-12&h=14'; }); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await page.screenshot({ path: `${out}/due.png` });
await browser.close(); server.close();
