// Offline search with filters, confidence and duplicate merging.
import { TYPE_LABELS, baseName } from './vault.js';
const DAY = 86400000;
const norm = (s) => s.toLowerCase();
export function parseQuery(q) {
  const f = {}; const terms = [];
  const re = /(\w+):("[^"]+"|\S+)|"([^"]+)"|(\S+)/g; let m;
  while ((m = re.exec(q))) {
    if (m[1] && ['type', 'from', 'in', 'after', 'before'].includes(m[1].toLowerCase())) f[m[1].toLowerCase()] = m[2].replace(/"/g, '');
    else terms.push((m[3] || m[4] || m[0]).toLowerCase());
  }
  return { f, terms };
}
const typeMatch = (n, t) => { t = norm(t); const a = n.type === 'adr' ? 'decision' : n.type; return a === t || norm(String(n.fm.format || '')) === t || (t === 'md' && !n.fm.format) || n.type === t || norm(TYPE_LABELS[n.type] || '').startsWith(t); };
const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
export function search(notes, q, opts = {}) {
  const now = opts.now ?? Date.now(); const limit = opts.limit ?? 10;
  const { f, terms } = parseQuery(q);
  const after = f.after ? Date.parse(f.after) : null, before = f.before ? Date.parse(f.before) : null;
  const out = [];
  for (const n of notes) {
    if (n.trashed) continue;
    if (f.type && !typeMatch(n, f.type)) continue;
    if (f.in && !norm(n.path).includes(norm(f.in))) continue;
    if (f.from) { const src = norm([n.fm.source, n.fm.from, n.fm.author, n.path.split('/')[0]].filter((x) => typeof x === 'string').join(' ')); if (!src.includes(norm(f.from))) continue; }
    if (after !== null && !(n.date > after)) continue;
    if (before !== null && !(n.date < before)) continue;
    const t = norm(n.title), b = norm(n.body), d = norm(n.description || '');
    let score = 0, ok = true;
    for (const w of terms) {
      const inT = t.includes(w), inD = d.includes(w), inB = b.includes(w);
      if (!inT && !inD && !inB) { ok = false; break; }
      score += (inT ? 5 : 0) + (inD ? 3 : 0) + (inB ? Math.min(3, b.split(w).length - 1) : 0);
    }
    if (!ok) continue;
    if (!terms.length && !Object.keys(f).length) continue;
    const idx = terms.length ? b.indexOf(terms[0]) : 0;
    const start = Math.max(0, idx - 60); const snippet = (start > 0 ? '...' : '') + n.body.slice(start, start + 170).replace(/\s+/g, ' ').trim() + '...';
    const ageDays = n.date ? (now - n.date) / DAY : 9999;
    let conf = 'medium';
    if (score >= 8 && ageDays < 365) conf = 'high'; else if (ageDays > 730 || score < 4) conf = 'low';
    if ((n.type === 'adr' || n.type === 'decision') && score >= 5 && ageDays < 730) conf = 'high';
    out.push({ note: n, score, snippet, confidence: conf, hash: hashStr(snippet.toLowerCase().replace(/[^a-z0-9]/g, '')) });
  }
  out.sort((a, b) => b.score - a.score || b.note.date - a.note.date);
  const seen = new Set(); const res = []; let merged = 0;
  for (const r of out) { if (seen.has(r.hash)) { merged++; continue; } seen.add(r.hash); res.push(r); }
  return { results: res.slice(0, limit), total: res.length, merged, terms, filters: f };
}
export function digest(notes, days, now = Date.now()) {
  const cut = now - days * DAY;
  return notes.filter((n) => !n.trashed && n.date >= cut).sort((a, b) => b.date - a.date);
}
export const decisionSearch = (notes, q, opts) => search(notes, `type:decision ${q}`, opts);
export function draftDocument(kind, picked, title) {
  const sec = (h, t) => `## ${h}\n${t}\n`;
  const body = picked.map((n) => `### ${n.title}\n${n.description || n.body.replace(/^#.*$/m, '').trim().slice(0, 600)}\n`).join('\n');
  const names = picked.map((n) => n.title).join(', ');
  const tpl = {
    report: `# ${title}\n\n${sec('Summary', 'Write a short summary here.')}\n${sec('Findings', body)}\n${sec('Sources', names)}`,
    decision: `# ${title}\n\n${sec('Context', body)}\n${sec('Options', '- Option 1\n- Option 2')}\n${sec('Decision', 'State the decision and the reason.')}\n${sec('Consequences', 'List what changes.')}`,
    briefing: `# ${title}\n\n${sec('Purpose', 'Why this briefing exists.')}\n${sec('Key points', body)}\n${sec('Open questions', '- ')}`,
  };
  return tpl[kind] || tpl.report;
}
export { baseName };
