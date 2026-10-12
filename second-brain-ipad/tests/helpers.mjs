import { chromium } from 'playwright-core'; import { zipSync, strToU8 } from 'fflate'; import { existsSync } from 'node:fs'; import { execSync } from 'node:child_process';
import { serve } from '../scripts/serve.mjs';
export const BASE = '/second-brain-ipad/';
export function chromePath() {
  for (const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/google-chrome']) if (p && existsSync(p)) return p;
  try { return chromium.executablePath(); } catch { return undefined; }
}
export async function start(opts = {}) {
  execSync('node scripts/build.mjs', { stdio: 'ignore' });
  const server = await serve(opts.port || 4399, BASE.slice(0, -1));
  const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--disable-background-networking', '--disable-sync', '--no-first-run', '--disable-component-update', '--proxy-server=direct://', '--proxy-bypass-list=*'] });
  return { server, browser, url: `http://127.0.0.1:${opts.port || 4399}${BASE}` };
}
export const N = (fm, body) => `---\n${fm}\n---\n${body}`;
export function vaultZip() {
  const f = {
    'Privat/10 Projects/Kitchen renovation plan.md': N('type: project\nstatus: planning\ndescription: Plan for the kitchen\nupdated: 2026-10-10', '# Kitchen renovation plan\n\n## Goal\nA new kitchen.\n\n## Next steps\nSee [[Heating system decision]] and [[Contractor B quote]].'),
    'Privat/20 Decisions/Heating system decision.md': N('type: adr\nstatus: chosen option 2\ndecided: 2026-03-14\nbelongs_to: [[Kitchen renovation plan]]\ndescription: Chosen system', '# Heating system decision\n\n## Options\nOption 2 was cheaper to run. Insurance was kept.\n\n## Decision\nOption 2.'),
    'Privat/20 Decisions/Insurance provider.md': N('type: adr\ndecided: 2026-03-14\ndescription: Kept current provider', 'Compared three offers and kept the current provider because the claims process is simpler. See [[Notice period]].'),
    'Privat/30 Lessons/Notice period.md': N('type: lesson\nupdated: 2024-09-20\ndescription: Read the notice period', 'Missed the cancellation window once. Insurance renewal.'),
    'Privat/Orphan note.md': 'A note without links or description.',
    'Privat/Private diary.md': N('private: true\ndescription: personal', 'Very private thoughts. Insurance.'),
    'Privat/Talk/Heating system decision.md': N('type: talk\nstatus: open', '# Talk: Heating system decision\n- is option 2 still right?'),
    'Privat/Contradiction.md': N('description: x', '> [!contradiction] This says A, other note says B'),
    'Privat/_tools/skip.md': 'skip me', 'Privat/raw/skip2.md': 'skip me', 'Privat/.git/x.md': 'skip', 'Privat/graph.json': '{}', 'Privat/photo.png': 'notmd',
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, strToU8(v)]))));
}
export async function setup(page, url, secret = '482913') {
  await page.goto(url); await page.waitForFunction(() => window.__sbReady);
  await page.fill('#s1', secret); await page.fill('#s2', secret); await page.click('#sb');
  await page.waitForSelector('#rk'); const key = await page.textContent('#rk'); await page.check('#rkok'); await page.click('#rkgo');
  await page.waitForSelector('.welcome'); return key;
}
export async function importVault(page) {
  await page.goto(page.url().split('#')[0] + '#/import'); await page.setInputFiles('#imp', { name: 'Privat.zip', mimeType: 'application/zip', buffer: vaultZip() });
  await page.waitForSelector('#imsg .okmsg'); return page.textContent('#imsg');
}
export async function unlock(page, secret = '482913') { await page.fill('#pw', secret); await page.click('#ub'); await page.waitForSelector('.welcome, .paper, .main', { timeout: 15000 }); }
