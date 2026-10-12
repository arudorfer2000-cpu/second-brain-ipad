// Deterministic force layout for the graph view.
export function layout(nodes, edges, w = 860, h = 520, iters = 260) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = nodes.map((n, i) => ({ id: n, x: w / 2 + Math.cos(i * 2.4) * (60 + 6 * i % 200) + rnd() * 10, y: h / 2 + Math.sin(i * 2.4) * (60 + 6 * i % 200) + rnd() * 10, vx: 0, vy: 0 }));
  const ix = new Map(P.map((p) => [p.id, p]));
  const E = edges.filter(([a, b]) => ix.has(a) && ix.has(b));
  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j]; let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy || 0.01; const d = Math.sqrt(d2);
      const f = Math.min(9000 / d2, 30); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const [x, y] of E) { const a = ix.get(x), b = ix.get(y); const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; const f = (d - 110) * 0.02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; }
    for (const p of P) { p.vx += (w / 2 - p.x) * 0.004; p.vy += (h / 2 - p.y) * 0.004; p.x += Math.max(-12, Math.min(12, p.vx)) * cool; p.y += Math.max(-12, Math.min(12, p.vy)) * cool; p.vx *= 0.6; p.vy *= 0.6; p.x = Math.max(30, Math.min(w - 30, p.x)); p.y = Math.max(30, Math.min(h - 30, p.y)); }
  }
  return P;
}
