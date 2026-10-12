// WhatsApp export parser and extractive summary. Pure functions, no network, no DOM.
const LRM = /[‎‏‪-‮]/g;
const SP = /[  ]/g;
// iOS: [11.10.26, 21:05:33] Name: text   Android: 11.10.26, 21:05 - Name: text
const RE_IOS = /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([AaPp]\.?[Mm]\.?)?\]\s?(.*)$/;
const RE_AND = /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([AaPp]\.?[Mm]\.?)?\s+-\s(.*)$/;
// language-data:begin (German and English WhatsApp keywords; the only place German is allowed)
const MEDIA = /^(<(attached|anhang)[:\s][^>]*>|(image|video|audio|sticker|gif|document|contact card|voice call|bild|audio|sticker|dokument|kontakt|sprachanruf)\s+(omitted|weggelassen)|<media omitted>|<medien ausgeschlossen>|<medien weggelassen>)$/i;
const SYSTEM = /(end-to-end encrypted|ende-zu-ende|created group|hat die gruppe|gruppe .* erstellt|added you|joined using|left$|hat die gruppe verlassen|changed the (group )?(subject|description|icon)|hat den betreff|security code|sicherheitsnummer|you were added|du wurdest|deleted this message|diese nachricht wurde gelöscht|missed (voice|video) call|verpasster (sprach|video)anruf|messages to this (chat|group) are now secured)/i;
const GROUP_HINT = /(created group|hat die gruppe .* erstellt|gruppe .* erstellt|you were added|du wurdest .* hinzugefügt|added you|joined using)/i;

// language-data:end
function splitDate(s) { return s.split(/[./-]/).map(Number); }
function detectOrder(dates) {
  let first = false, second = false;
  for (const d of dates) {
    const [a, b, c] = splitDate(d);
    if (a > 31 && a > 99) return { order: 'ymd', ambiguous: false };
    if (a > 12) first = true; if (b > 12) second = true; void c;
  }
  if (first && !second) return { order: 'dmy', ambiguous: false };
  if (second && !first) return { order: 'mdy', ambiguous: false };
  const dot = dates.length && dates.every((d) => d.includes('.'));
  return { order: dot ? 'dmy' : 'mdy', ambiguous: !(first && second) };
}
function stamp(date, time, ap, order) {
  let [a, b, c] = splitDate(date); let y, m, d;
  if (order === 'ymd') { y = a; m = b; d = c; } else if (order === 'dmy') { d = a; m = b; y = c; } else { m = a; d = b; y = c; }
  if (y < 100) y += 2000;
  let [h, mi, s] = time.split(':').map(Number); s = s || 0;
  if (ap) { const pm = /^p/i.test(ap); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  const p2 = (n) => String(n).padStart(2, '0');
  return `${y}-${p2(m)}-${p2(d)}T${p2(h)}:${p2(mi)}:${p2(s)}`;
}
const validStamp = (t) => { const x = new Date(t + 'Z'); return !Number.isNaN(x.getTime()) && x.toISOString().startsWith(t.slice(0, 19)); };

/** parseChat(text, {order}) -> {ok, messages, senders, format, order, ambiguous, media, system, groupHint} */
export function parseChat(raw, opts = {}) {
  const lines = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const heads = []; let fmt = '';
  for (const l0 of lines) {
    const l = l0.replace(LRM, '').replace(SP, ' ');
    const mi = RE_IOS.exec(l); const ma = mi ? null : RE_AND.exec(l);
    const m = mi || ma; if (m) { heads.push({ m, ios: !!mi, raw: l0 }); if (!fmt) fmt = mi ? 'ios' : 'android'; } else heads.push({ cont: l0 });
  }
  const firsts = heads.filter((h) => h.m);
  if (!firsts.length) return { ok: false, reason: 'unreadable', message: 'This does not look like a WhatsApp chat export.' };
  const det = detectOrder(firsts.map((h) => h.m[1])); const order = opts.order || det.order;
  const messages = []; let cur = null; let media = 0, system = 0, groupHint = false;
  const flush = () => {
    if (!cur) return; const t = cur.text.replace(LRM, '').trim();
    if (cur.from === null || (cur.lrm && SYSTEM.test(t))) { system++; if (GROUP_HINT.test(t)) groupHint = true; messages.push({ t: cur.t, from: '', text: t, kind: 'system' }); }
    else if (MEDIA.test(t)) { media++; messages.push({ t: cur.t, from: cur.from, text: '', kind: 'media' }); }
    else messages.push({ t: cur.t, from: cur.from, text: t, kind: 'msg' });
    cur = null;
  };
  let bad = 0;
  for (const h of heads) {
    if (!h.m) { if (cur) cur.text += '\n' + h.cont; continue; }
    flush(); const [, date, time, ap, rest] = h.m; const t = stamp(date, time, ap, order); if (!validStamp(t)) bad++;
    const lrm = /: [\u200e\u200f]/.test(h.raw) || /(\]|\s-)\s[\u200e\u200f]/.test(h.raw);
    const ci = rest.indexOf(': ');
    cur = ci > 0 && ci < 80 ? { t, from: rest.slice(0, ci).trim(), text: rest.slice(ci + 2), lrm } : { t, from: null, text: rest, lrm };
  }
  flush();
  if (bad > messages.length * 0.5) return { ok: false, reason: 'unreadable', message: 'The dates in this file could not be read. Try the other date order.' };
  const real = messages.filter((x) => x.kind === 'msg' || x.kind === 'media');
  const senders = [...new Set(real.map((x) => x.from))];
  return { ok: true, format: fmt, order, ambiguous: det.ambiguous && !opts.order, messages, senders, media, system, groupHint, count: real.length };
}

export const isGroup = (p) => p.senders.length > 2 || p.groupHint;

// ---------- extractive summary (no AI, mergeable) ----------
// language-data:begin
const STOP = new Set(('the and for are but not you your with this that have has had was were will would can could from they them their there what when where which who how about just like also been being into over than then some more most much very only other our out all any its it\'s don\'t i\'m ' +
  'und der die das ein eine einen einem einer ist sind war waren wird werden kann können mit für auf nicht dass dann aber auch noch schon oder wie wir ihr sie ich du er es bei von zu zum zur dem den des im in an am als so ja nein mal hab habe hast haben dir mir mich dich uns euch doch nur wenn weil bin bist hat hatte wäre würde sehr mehr hier dort jetzt heute morgen gestern danke bitte ok okay').split(/\s+/));
const DECISION = /(decid|entschieden|beschlossen|vereinbart|agreed|we('ll| will) go with|let'?s go with|wir nehmen|abgemacht|einverstanden|deal\b|confirmed|bestätigt)/i;
const DATEHIT = /(\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b|\b\d{1,2}:\d{2}\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|morgen|next week|nächste woche|deadline|frist|termin|appointment|meeting)\b)/i;
// language-data:end
const CUT = 140;
const cut = (s) => { const x = s.replace(/\s+/g, ' ').trim(); return x.length > CUT ? x.slice(0, CUT - 1) + '…' : x; };
export function hash32(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export const keyOf = (m) => hash32(`${m.t}|${m.from}|${m.text}`);

/** summarize(messages, {full}) -> stats (mergeable). Keeps flagged lines only; the full text is kept only when full=true. */
export function summarize(messages, opts = {}) {
  const real = messages.filter((m) => m.kind === 'msg' || m.kind === 'media');
  const st = { n: real.length, media: 0, bySender: {}, first: '', last: '', freq: {}, flagged: [], keys: [] };
  const msgs = real.filter((m) => m.kind === 'msg');
  for (const m of real) {
    st.bySender[m.from] = (st.bySender[m.from] || 0) + 1; if (m.kind === 'media') st.media++;
    if (!st.first || m.t < st.first) st.first = m.t; if (!st.last || m.t > st.last) st.last = m.t; st.keys.push(keyOf(m));
  }
  for (const m of msgs) for (const w of m.text.toLowerCase().match(/[a-z\u00e4\u00f6\u00fc\u00df]{4,}/g) || []) if (!STOP.has(w)) st.freq[w] = (st.freq[w] || 0) + 1;
  // keep only the top 60 words to avoid storing the vocabulary
  st.freq = Object.fromEntries(Object.entries(st.freq).sort((a, b) => b[1] - a[1]).slice(0, 60));
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]; const kind = DECISION.test(m.text) ? 'decision' : null;
    if (kind) st.flagged.push({ t: m.t, from: m.from, kind, text: cut(m.text) });
    else if (DATEHIT.test(m.text) && m.text.length > 12) st.flagged.push({ t: m.t, from: m.from, kind: 'date', text: cut(m.text) });
    else if (/\?\s*$/.test(m.text.trim())) { const next = msgs[i + 1]; if (!next || next.from === m.from) st.flagged.push({ t: m.t, from: m.from, kind: 'question', text: cut(m.text) }); }
  }
  st.flagged = capFlagged(st.flagged);
  if (opts.full) st.messages = real.map((m) => ({ t: m.t, from: m.from, text: m.text, kind: m.kind }));
  return st;
}
function capFlagged(list) {
  const out = []; const per = { decision: 5, date: 5, question: 3 }; const n = { decision: 0, date: 0, question: 0 };
  for (const f of [...list].reverse()) { if (n[f.kind] < per[f.kind]) { n[f.kind]++; out.push(f); } }
  return out.sort((a, b) => a.t.localeCompare(b.t)).slice(-10);
}
export function mergeStats(a, b) {
  const seen = new Set(a.keys); const out = { ...a, bySender: { ...a.bySender }, freq: { ...a.freq }, keys: [...a.keys], flagged: [...a.flagged] };
  out.n += b.n; out.media += b.media; for (const [k, v] of Object.entries(b.bySender)) out.bySender[k] = (out.bySender[k] || 0) + v;
  for (const [k, v] of Object.entries(b.freq)) out.freq[k] = (out.freq[k] || 0) + v;
  out.freq = Object.fromEntries(Object.entries(out.freq).sort((x, y) => y[1] - x[1]).slice(0, 60));
  if (b.first && (!out.first || b.first < out.first)) out.first = b.first; if (b.last && b.last > out.last) out.last = b.last;
  for (const k of b.keys) if (!seen.has(k)) out.keys.push(k);
  out.flagged = capFlagged([...out.flagged, ...b.flagged]);
  if (a.messages || b.messages) out.messages = [...(a.messages || []), ...(b.messages || [])].sort((x, y) => x.t.localeCompare(y.t));
  return out;
}
/** Keep only messages that are new compared with the stored keys. */
export function newMessages(stats, messages) { const seen = new Set(stats.keys); return messages.filter((m) => (m.kind === 'msg' || m.kind === 'media') && !seen.has(keyOf(m))); }

export function topics(stats, n = 8) { return Object.entries(stats.freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w); }
export function chatTitle(filename) {
  return filename.replace(/\.(zip|txt)$/i, '').replace(/^_?chat$/i, '').replace(/^(WhatsApp[ -]?Chat( with| mit| -)?\s*|WhatsApp-Chat mit\s*|WhatsApp Chat\s*)/i, '').trim() || 'Chat';
}
export function summaryText(stats, title, group) {
  const names = Object.entries(stats.bySender).sort((a, b) => b[1] - a[1]);
  const d = (t) => t.slice(0, 10);
  const lines = [`Chat: ${title}${group ? ' (group)' : ''}`, `Period: ${stats.first ? d(stats.first) : '-'} to ${stats.last ? d(stats.last) : '-'}`, `Messages: ${stats.n} (${stats.media} media items, not imported)`, `Participants: ${names.map(([k, v]) => `${k} (${v})`).join(', ')}`, `Frequent words: ${topics(stats).join(', ') || '-'}`];
  const L = { decision: 'Possible decisions', date: 'Dates and appointments mentioned', question: 'Possibly unanswered questions' };
  for (const k of ['decision', 'date', 'question']) { const f = stats.flagged.filter((x) => x.kind === k); if (f.length) { lines.push('', `${L[k]}:`); for (const x of f) lines.push(`- ${d(x.t)} ${x.from}: ${x.text}`); } }
  return lines.join('\n');
}
