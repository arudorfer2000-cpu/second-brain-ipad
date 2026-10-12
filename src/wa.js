// WhatsApp space: own passphrase, own key, records in the `files` store under ids "wa:<id>". Nothing leaves the device.
import { st, C, S, unzipSync, strFromU8, sha256Hex } from './app.js';
import { parseChat, isGroup, summarize, mergeStats, newMessages, chatTitle, summaryText } from './whatsapp.js';
export const wa = { meta: null, master: null, chats: [], filing: null, last: null, rk: null, win: 200 };
export const stamp = (t) => t.slice(0, 16).replace('T', ' ');
export async function waInit() { wa.meta = (await S.getMetaK('wa-vault')) || null; }
export async function waCheckSecret(s) {
  const v = C.validateSecret(s); if (!v.ok) return v.error; if (/^\d{6}$/.test(s) || s.length < 10) return 'Use a passphrase of 10 to 128 characters for the WhatsApp space.';
  if (st.meta && await C.unlock(st.meta, s)) return 'Choose a passphrase that is different from your main passcode.'; return '';
}
export async function waCreate(secret) { const { master, meta, recoveryKey } = await C.createVault(secret); await S.putMetaK('wa-vault', meta); wa.meta = meta; wa.master = master; wa.chats = []; wa.rk = recoveryKey; return recoveryKey; }
export async function waUnlock(secret, recovery = false) { const m = recovery ? await C.unlockWithRecovery(wa.meta, secret) : await C.unlock(wa.meta, secret); if (!m) return false; wa.master = m; await waLoad(); return true; }
export function waLock() { if (wa.master) wa.master.fill(0); wa.master = null; wa.chats = []; wa.filing = null; wa.last = null; wa.rk = null; }
async function waLoad() {
  wa.chats = []; for (const [id, rec] of await S.allFiles()) if (id.startsWith('wa:')) { try { wa.chats.push({ id, ...(await C.open(wa.master, rec)) }); } catch { /* record from another key: ignore */ } }
  wa.chats.sort((a, b) => (b.stats.last || '').localeCompare(a.stats.last || ''));
}
const saveChat = async (c) => { const { id, ...rest } = c; await S.putFile(id, await C.seal(wa.master, rest)); };
export async function waDelete(id) { await S.delFile(id); wa.chats = wa.chats.filter((c) => c.id !== id); }

function textOf(name, bytes) {
  if (/\.zip$/i.test(name)) {
    const u = unzipSync(bytes); const txt = Object.entries(u).filter(([p]) => /\.txt$/i.test(p) && !/__MACOSX/.test(p));
    if (!txt.length) return null; txt.sort((a, b) => (/_chat\.txt$/i.test(b[0]) ? 1 : 0) - (/_chat\.txt$/i.test(a[0]) ? 1 : 0) || b[1].length - a[1].length); return strFromU8(txt[0][1]);
  }
  return strFromU8(bytes);
}
const keyOfChat = (senders) => [...senders].map((s) => s.toLowerCase()).sort().join('|');
function judge(it, parsed) {
  const existing = wa.chats.find((c) => c.key === it.key);
  Object.assign(it, { parsed, order: parsed.order, ambiguous: parsed.ambiguous, n: parsed.count, group: isGroup(parsed), senders: parsed.senders, existing: existing ? existing.id : '', newCount: 0 });
  if (existing) it.newCount = newMessages(existing.stats, parsed.messages).length;
  const times = parsed.messages.filter((m) => m.kind !== 'system').map((m) => m.t).sort(); it.first = times[0] || ''; it.last = times.at(-1) || '';
  if (existing && existing.shas.includes(it.sha)) { it.status = 'duplicate'; it.message = 'This exact export was already imported.'; it.sel = false; }
  else if (existing && !it.newCount) { it.status = 'duplicate'; it.message = 'No new messages compared with the stored chat.'; it.sel = false; }
  else if (it.group) { it.status = 'group'; it.message = 'Group chat: excluded by default. Tick it only if the other people agree.'; it.sel = false; }
  else { it.status = existing ? 'append' : 'new'; it.sel = true; }
}
export async function planChats(files) {
  const items = [];
  for (const f of files) {
    const it = { name: f.name, size: f.bytes.length, mode: 'summary' }; it.sha = await sha256Hex(f.bytes);
    let raw = null; try { raw = textOf(f.name, f.bytes); } catch { raw = null; }
    if (raw == null) { Object.assign(it, { status: 'blocked', message: 'No chat text found. Export the chat from WhatsApp and choose Without Media.', sel: false }); items.push(it); continue; }
    const parsed = parseChat(raw); it.raw = raw;
    if (!parsed.ok) { Object.assign(it, { status: 'blocked', message: parsed.message, sel: false }); items.push(it); continue; }
    it.title = chatTitle(f.name); if (it.title === 'Chat') it.title = parsed.senders.join(', ') || 'Chat'; it.key = keyOfChat(parsed.senders); judge(it, parsed); items.push(it);
  }
  return items;
}
export function replan(it, order) { judge(it, parseChat(it.raw, { order })); it.order = order; }
export async function fileChats(items) {
  const done = [];
  for (const it of items) {
    const msgs = it.parsed.messages; const ex = it.existing ? wa.chats.find((c) => c.id === it.existing) : null;
    if (ex) {
      const fresh = newMessages(ex.stats, msgs); ex.stats = mergeStats(ex.stats, summarize(fresh, { full: ex.mode === 'full' })); ex.shas.push(it.sha); ex.updated = Date.now(); await saveChat(ex); done.push({ id: ex.id, title: ex.title, added: fresh.length });
    } else {
      const id = 'wa:' + await C.randomId(); const rec = { id, title: it.title.slice(0, 80), key: it.key, group: it.group, mode: it.mode, stats: summarize(msgs, { full: it.mode === 'full' }), shas: [it.sha], created: Date.now(), updated: Date.now() };
      await saveChat(rec); wa.chats.push(rec); done.push({ id, title: rec.title, added: rec.stats.n });
    }
  }
  wa.chats.sort((a, b) => (b.stats.last || '').localeCompare(a.stats.last || '')); return done;
}
export function searchChats(q) {
  const n = q.trim().toLowerCase(); if (!n) return []; const out = [];
  for (const c of wa.chats) {
    for (const m of c.stats.messages || []) if (m.kind === 'msg' && m.text.toLowerCase().includes(n)) out.push({ id: c.id, title: c.title, t: m.t, from: m.from, text: m.text.length > 160 ? m.text.slice(0, 159) + '…' : m.text });
    if (!c.stats.messages) for (const f of c.stats.flagged) if (f.text.toLowerCase().includes(n)) out.push({ id: c.id, title: c.title, t: f.t, from: f.from, text: f.text });
  }
  return out.sort((a, b) => b.t.localeCompare(a.t)).slice(0, 50);
}
export function askText(c) {
  let t = `WhatsApp chat "${c.title}" (${c.mode === 'full' ? 'full text kept' : 'summary only'}). I paste this myself for analysis.\n\n${summaryText(c.stats, c.title, c.group)}`;
  if (c.stats.messages) { const lines = c.stats.messages.filter((m) => m.kind === 'msg').map((m) => `[${stamp(m.t)}] ${m.from}: ${m.text}`); let body = ''; for (let i = lines.length - 1; i >= 0 && body.length < 6000; i--) body = lines[i] + '\n' + body; t += `\n\nLatest messages (up to about 6000 characters):\n${body.trim()}`; }
  return t;
}
