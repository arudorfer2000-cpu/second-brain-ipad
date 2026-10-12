// Small safe Markdown renderer with wiki links. Escapes everything first.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function inline(text, idx) {
  let t = esc(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, target, alias) => {
    const n = idx.resolve(target.replace(/&amp;/g, '&').trim()); const label = alias || target;
    return n ? `<a class="wl" href="#/note/${encodeURIComponent(n.path)}">${label}</a>` : `<a class="wl red" href="#/new/${encodeURIComponent(target.replace(/&amp;/g, '&').trim())}" title="This note does not exist yet. Tap to create it.">${label}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
  return t;
}
export function render(body, idx) {
  const lines = body.replace(/\r\n/g, '\n').split('\n'); const out = []; let list = null, para = [], code = null;
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(' '), idx)}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (/^```/.test(line)) { if (code) { out.push(`<pre class="code">${esc(code.join('\n'))}</pre>`); code = null; } else { flushP(); flushL(); code = []; } continue; }
    if (code) { code.push(line); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) { flushP(); flushL(); const lv = Math.max(2, m[1].length); if (m[1].length === 1) continue; out.push(`<h${lv} id="${slug(m[2])}">${inline(m[2], idx)}</h${lv}>`); continue; }
    if ((m = /^\s*[-*]\s+(.+)$/.exec(line))) { flushP(); if (list !== 'ul') { flushL(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1], idx)}</li>`); continue; }
    if ((m = /^\s*\d+[.)]\s+(.+)$/.exec(line))) { flushP(); if (list !== 'ol') { flushL(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1], idx)}</li>`); continue; }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1].replace(/^\[!\w+\]\s*/, ''), idx)}</blockquote>`); continue; }
    if (/^\s*$/.test(line)) { flushP(); flushL(); continue; }
    flushL(); para.push(line.trim());
  }
  flushP(); flushL(); if (code) out.push(`<pre class="code">${esc(code.join('\n'))}</pre>`);
  return out.join('\n');
}
