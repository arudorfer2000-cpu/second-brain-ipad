import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join, normalize } from 'node:path';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
export function serve(port = 4173, base = '', dir = 'dist') {
  const s = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (base) { if (!p.startsWith(base)) { res.writeHead(404); return res.end(); } p = p.slice(base.length) || '/'; }
    if (p.endsWith('/')) p += 'index.html'; const f = normalize(join(dir, p)); if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
    try { const b = await readFile(f); res.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((r) => s.listen(port, '127.0.0.1', () => r(s)));
}
if (process.argv[1].endsWith('serve.mjs')) { await serve(Number(process.env.PORT || 4173), process.env.BASE || ''); console.log('serving dist'); }
