// Text extraction for filing documents. Pure functions: nothing is sent anywhere, protected files are never opened.
import { unzipSync, strFromU8 } from 'fflate';
export const MAX_BYTES = 25 * 1024 * 1024;
export const FORMATS = ['docx', 'xlsx', 'pptx', 'pdf', 'txt', 'csv', 'html', 'htm'];
export const OLD_OFFICE = ['doc', 'xls', 'ppt'];
export const extOf = (n) => (/\.([A-Za-z0-9]+)$/.exec(n) || [, ''])[1].toLowerCase();
export const stemOf = (n) => n.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
export async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(c); } catch { return ''; } } return ENT[e.toLowerCase()] ?? m; });
const strip = (x) => decodeEntities(x.replace(/<[^>]+>/g, ''));
const OLE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
const isOle = (b) => b.length > 8 && OLE.every((v, i) => b[i] === v);
const fail = (reason, message) => ({ ok: false, reason, message });
function zipOf(bytes) { try { return unzipSync(bytes); } catch { return null; } }
const part = (z, name) => (z[name] ? strFromU8(z[name]) : '');

function docx(z) {
  const x = part(z, 'word/document.xml'); if (!x) return null;
  const lines = [];
  const body = x.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => (tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map((tr) => `<w:p><w:r><w:t>${(tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) => [...tc.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join('')).join(' | ')}</w:t></w:r></w:p>`).join(''));
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    const style = (/<w:pStyle w:val="([^"]+)"/.exec(p) || [])[1] || '';
    let t = p.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, '\u0002$1\u0003').replace(/<[^>]+>/g, '');
    t = decodeEntities(t.replace(/\u0002/g, '').replace(/\u0003/g, '').replace(/\u0001/g, ' | ')).replace(/ \| $/, '');
    if (!t.trim()) continue; const h = /^(Heading|Title)\s*(\d)?/i.exec(style);
    lines.push(h ? (h[1].toLowerCase() === 'title' ? '# ' : '#'.repeat(Math.min(4, Number(h[2] || 1) + 1)) + ' ') + t.trim() : t.trim());
  }
  const core = strip((/<dc:title>([\s\S]*?)<\/dc:title>/.exec(part(z, 'docProps/core.xml')) || [, ''])[1]).trim();
  return { text: lines.join('\n'), title: core || (lines.find((l) => /^#/.test(l)) || lines[0] || '').replace(/^#+\s*/, '') };
}
function colIndex(ref) { let n = 0; for (const ch of ref.replace(/\d/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function xlsx(z) {
  const wb = part(z, 'xl/workbook.xml'); if (!wb) return null;
  const rels = Object.fromEntries([...part(z, 'xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const relsRev = Object.fromEntries([...part(z, 'xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g)].map((m) => [m[2], m[1]]));
  const sst = [...part(z, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => strip([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const out = []; let first = '';
  for (const m of wb.matchAll(/<sheet [^>]*?name="([^"]*)"[^>]*?r:id="([^"]+)"/g)) {
    const name = decodeEntities(m[1]); const target = rels[m[2]] || relsRev[m[2]]; if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''); const sx = part(z, path); if (!sx) continue;
    out.push('## ' + name); if (!first) first = name; let rows = 0;
    for (const r of sx.match(/<row[ >][\s\S]*?<\/row>/g) || []) {
      const cells = []; for (const c of r.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1]; const ref = (/r="([A-Z]+\d+)"/.exec(at) || [])[1]; const type = (/t="([^"]+)"/.exec(at) || [])[1]; const inner = c[2] || ''; let v = '';
        if (type === 's') v = sst[Number((/<v>(\d+)<\/v>/.exec(inner) || [])[1])] ?? ''; else if (type === 'inlineStr') v = strip(inner); else v = strip((/<v>([\s\S]*?)<\/v>/.exec(inner) || [, ''])[1]); if (type === 'b') v = v === '1' ? 'TRUE' : 'FALSE';
        if (ref && v !== '') cells[colIndex(ref)] = v;
      }
      if (cells.some((c) => c !== undefined)) { out.push(Array.from(cells, (c) => c ?? '').join(' | ').replace(/( \| )+$/, '')); if (++rows >= 200) { out.push('... (more rows in the original)'); break; } }
    }
  }
  return { text: out.join('\n'), title: '' };
}
function pptx(z) {
  const slides = Object.keys(z).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/g).pop()) - Number(b.match(/\d+/g).pop()));
  if (!slides.length) return null; const out = []; let title = '';
  slides.forEach((s, i) => {
    const lines = (part(z, s).match(/<a:p[ >][\s\S]*?<\/a:p>/g) || []).map((p) => strip([...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join(''))).filter((t) => t.trim());
    if (!title && lines[0]) title = lines[0]; out.push(`## Slide ${i + 1}`, ...lines);
    const notes = part(z, s.replace('slides/slide', 'notesSlides/notesSlide')); const nl = (notes.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || []).map(strip).filter((t) => t.trim() && !/^\d+$/.test(t.trim()));
    if (nl.length) out.push('Notes: ' + nl.join(' '));
  });
  return { text: out.join('\n'), title };
}
function html(t) {
  const title = strip((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(t) || [, ''])[1]).trim();
  const body = t.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|h\d|li|tr|br)>|<br\s*\/?>/gi, '\n');
  return { text: strip(body).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'), title };
}
export async function extractFile(name, bytes, opts = {}) {
  const ext = extOf(name);
  if (bytes.length > MAX_BYTES) return fail('too-large', 'Larger than 25 MB; not filed.');
  if (!bytes.length) return fail('empty', 'The file is empty.');
  if (OLD_OFFICE.includes(ext)) return fail('unsupported', `Old .${ext} files cannot be read. Save a copy as .${ext}x in Word, Excel or PowerPoint, then add that.`);
  if (!FORMATS.includes(ext)) return fail('unsupported', `.${ext || 'unknown'} files are not supported yet.`);
  let r = null;
  try {
    if (['docx', 'xlsx', 'pptx'].includes(ext)) {
      if (isOle(bytes)) return fail('password', 'Password protected (or an old Office file). It was not opened.');
      const z = zipOf(bytes); if (!z) return fail('unreadable', 'This is not a valid Office file.');
      if (z['EncryptedPackage'] || z['EncryptionInfo']) return fail('password', 'Password protected. It was not opened.');
      r = ext === 'docx' ? docx(z) : ext === 'xlsx' ? xlsx(z) : pptx(z); if (!r) return fail('unreadable', `This is not a valid .${ext} file.`);
    } else if (ext === 'pdf') {
      if (!opts.pdf) return fail('unsupported', 'PDF reading is not available here.');
      try { const p = await opts.pdf(bytes); r = { text: p.text, title: p.title || '' }; if (r.text.trim().length < 20) return fail('no-text', 'No text found (probably a scan). Photo and scan reading is not available yet.'); }
      catch (e) { if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) return fail('password', 'Password protected. It was not opened.'); return fail('unreadable', 'This PDF could not be read.'); }
    } else {
      const t = new TextDecoder('utf-8').decode(bytes); r = ext === 'html' || ext === 'htm' ? html(t) : { text: t.replace(/\r\n/g, '\n').trim(), title: '' };
    }
  } catch (e) { return fail('unreadable', 'The file could not be read.'); }
  if (!r.text.trim()) return fail('empty', 'No text found in the file.');
  return { ok: true, format: ext === 'htm' ? 'html' : ext, text: r.text, title: (r.title || '').trim().slice(0, 140) || stemOf(name) };
}
const STOP = new Set('the and for with from this that into over under about report notes note draft final version copy new old plan file document documents'.split(' '));
export const tokens = (s) => [...new Set(s.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').split(' ').filter((w) => w.length >= 4 && !STOP.has(w)))];
export function suggestProject(title, name, projects) {
  const t = new Set([...tokens(title), ...tokens(stemOf(name))]); let best = null, score = 0;
  for (const p of projects) { const pt = tokens(p.title); const s = pt.filter((w) => t.has(w)).length; if (s > score && (s >= 2 || (pt.length === 1 && s === 1))) { best = p; score = s; } }
  return best;
}
export function guessDate(name, lastModified) {
  const m = /(20\d{2}|19\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/.exec(name);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = /(?<!\d)(20\d{2}|19\d{2})(?!\d)/.exec(name); if (y) return `${y[1]}-01-01`;
  const d = new Date(lastModified || Date.now()); return d.toISOString().slice(0, 10);
}
