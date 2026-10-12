import { st, util, planFiling, fileItems, getOriginal, MIME, readLog, logSearch, trimLog, clearLog, C, S, TEMPLATES, applyTheme, saveNote, rebuild, loadAll, setTrashed, destroy, byPath, importFiles, buildAskText, copyText, esc, unzipSync, zipSync, strFromU8, strToU8, markdownToDocx, draftDocument, parseNote, search } from './app.js';
import * as V from './views.js';
import { setFm } from './due.js';
import { statusValue, COLUMN_LABEL } from './kanban.js';
import { reviewData, reportMarkdown } from './review.js';
import { wa, waInit, waCheckSecret, waCreate, waUnlock, waLock, planChats, replan, fileChats, searchChats, askText, waDelete } from './wa.js';
const { $, ls, download, today, safeName } = util;
const app = document.getElementById('app');
const enc = encodeURIComponent;
let lastActive = Date.now(), hiddenAt = 0, rkPending = null;
const q = (s) => document.querySelector(s);

export function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function sheet(html) { const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(m); m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); }); return m; }
function confirmSheet(msg, yesLabel, onYes, typed) {
  const m = sheet(`<div style="font-size:20px;font-weight:600">Are you sure?</div><div>${msg}</div>${typed ? `<div class="field"><label for="ty">Type ${typed} to confirm</label><input id="ty" autocomplete="off"></div>` : ''}<div class="tool" style="justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn danger" id="yes">${yesLabel}</button></div>`);
  m.querySelector('#yes').addEventListener('click', async () => { if (typed && m.querySelector('#ty').value.trim() !== typed) return; m.remove(); await onYes(); });
}

// ---------- lock / setup ----------
function lockScreen(msg = '', kind = 'ok') {
  const hasVault = !!st.meta;
  app.innerHTML = hasVault ? `<div class="lock"><form class="lockbox" data-form="unlock"><div class="logo">Second Brain</div><div class="m" style="text-align:center">Enter your passcode to unlock</div><input id="pw" type="password" name="p" autocomplete="off" autocapitalize="off" aria-label="Passcode or passphrase" autofocus><div id="lmsg" aria-live="polite">${msg ? `<div class="${kind === 'ok' ? 'okmsg' : 'err'}">${esc(msg)}</div>` : ''}</div><button class="btn pri" id="ub" type="submit">Unlock</button><button class="btn" type="button" data-act="userk">Use recovery key</button><div id="rkbox"></div><p class="m small" style="text-align:center">Everything is encrypted on this iPad. If you forget the passcode, only your recovery key or a backup can help.</p></form></div>`
    : `<div class="lock"><form class="lockbox" data-form="setup"><div class="logo">Second Brain</div><div class="m" style="text-align:center">Create your vault. Choose 6 digits, or a passphrase of 10 to 128 characters.</div><div class="field"><label for="s1">Passcode or passphrase</label><input id="s1" type="password" name="s1" autocomplete="new-password" autocapitalize="off"></div><div class="field"><label for="s2">Repeat</label><input id="s2" type="password" name="s2" autocomplete="new-password" autocapitalize="off"></div><div id="lmsg" aria-live="polite">${msg ? `<div class="err">${esc(msg)}</div>` : ''}</div><button class="btn pri" id="sb" type="submit">Create vault</button><div class="field"><label for="rf">Or restore from a backup file</label><input id="rf" type="file" accept=".sbbak,application/json,application/octet-stream" data-act="restore-file"></div><p class="m small" style="text-align:center">Use a different passcode from your other apps. Nothing leaves this iPad.</p></form></div>`;
}
function recoveryScreen(key) {
  app.innerHTML = `<div class="lock"><div class="lockbox"><div class="logo">Recovery key</div><p>Write this key down and keep it away from the iPad. If you forget your passcode it is the only way in. It is shown only once.</p><div class="rk" id="rk">${esc(key)}</div><label class="chk"><input type="checkbox" id="rkok"> I have saved my recovery key</label><button class="btn pri" id="rkgo" data-act="rkgo" disabled>Continue</button></div></div>`;
  q('#rkok').addEventListener('change', (e) => { q('#rkgo').disabled = !e.target.checked; });
}
function startAutolock() {
  const check = () => { if (!st.master) return; const min = Number(ls.get('autolock', '1')); if (Date.now() - lastActive > min * 60000) lock(); };
  setInterval(check, 5000);
  for (const ev of ['pointerdown', 'keydown', 'scroll']) addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (st.master && hiddenAt && Date.now() - hiddenAt > Number(ls.get('autolock', '1')) * 60000) lock(); });
}
export function lock() {
  if (st.master) st.master.fill(0);
  st.master = null; st.recs.clear(); st.notes = []; st.idx = null; st.ask = { sel: new Set(), q: '', exclude: true, mode: 'answer' }; st.docSel = new Set(); st.navOpen = false; st.filing = null; st.lastFiled = null; waLock();
  document.querySelectorAll('.modal,.toast').forEach((e) => e.remove()); lockScreen();
}
async function enter(master) { st.master = master; await loadAll(); await waInit(); lastActive = Date.now(); if (!location.hash || location.hash === '#') location.hash = '#/'; route(); }

// ---------- router ----------
export function route() {
  if (!st.master) return;
  let h = location.hash.slice(1) || '/'; let anchor = ''; const ai = h.indexOf('#'); if (ai >= 0) { anchor = h.slice(ai + 1); h = h.slice(0, ai); }
  const qi = h.indexOf('?'); const query = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : ''); if (qi >= 0) h = h.slice(0, qi);
  const parts = h.split('/').filter(Boolean); const name = parts[0] || ''; const arg = parts.slice(1).map(decodeURIComponent).join('/');
  document.querySelectorAll('.modal').forEach((e) => { if (name !== 'ask' || arg !== 'review') e.remove(); });
  st.navOpen = false;
  const P = (inner, on, cur) => V.shell(inner, on, cur);
  let html;
  switch (name) {
    case '': html = P(V.home(), ''); break;
    case 'recent': html = P(V.recent(), 'recent'); break;
    case 'cats': html = P(V.cats(), 'cats'); break;
    case 'cat': html = P(V.cat(arg), 'cats'); break;
    case 'az': html = P(V.az(arg), ''); break;
    case 'links': html = P(V.linksHere(arg), 'links', arg); break;
    case 'random': { const l = st.idx.notes; if (!l.length) { html = P(V.notFound()); break; } location.replace(`#/note/${enc(l[Math.floor(Math.random() * l.length)].path)}`); return; }
    case 'note': html = V.note(arg, query.get('tab') || 'note').html; break;
    case 'new': html = V.newNote(arg); break;
    case 'search': html = P(V.searchPage(query.get('q') || ''), ''); break;
    case 'ask': html = P(V.askPage(), 'ask'); if (arg === 'review') html += V.reviewPage(); break;
    case 'graph': html = P(V.graphPage(), 'graph'); break;
    case 'health': html = P(V.health(), 'health'); break;
    case 'import': html = P(V.importPage(), 'import'); break;
    case 'backup': html = P(V.backupPage(), 'backup'); break;
    case 'settings': html = P(V.settingsPage(), 'settings'); break;
    case 'trash': html = P(V.trash(), 'trash'); break;
    case 'whatsapp': html = P(arg.startsWith('chat/') ? V.waChat(arg.slice(5)) : V.waPage(), 'whatsapp'); break;
    case 'kanban': html = P(V.kanbanView(), 'kanban'); break;
    case 'due': html = P(V.dueView(/^\d{4}-\d{2}-\d{2}$/.test(query.get('today') || '') ? query.get('today') : undefined, [7, 14, 30, 90].includes(Number(query.get('h'))) ? Number(query.get('h')) : 7), 'due'); break;
    case 'review': html = P(V.reviewView(query.get('p') === 'month' ? 'month' : 'week', /^\d{4}-\d{2}-\d{2}$/.test(query.get('end') || '') ? query.get('end') : undefined), 'review'); break;
    case 'sources': html = P(V.sourcesPage(), 'sources'); break;
    case 'digest': html = P(V.digestPage(Number(query.get('d') || 7)), 'digest'); break;
    default: html = P(V.notFound());
  }
  app.innerHTML = html;
  if (name === 'sources') fillLog();
  const gb = q('#gbox'); if (gb && gb.clientWidth > 100) { const w = Math.round(gb.clientWidth), h = Math.round(gb.clientHeight); gb.innerHTML = V.graphSvg(w, h); }
  const sq = q('.top .search input'); if (sq && name === 'search') sq.value = query.get('q') || '';
  if (anchor) { const el = document.getElementById(anchor); if (el) el.scrollIntoView(); } else { const m = q('#main'); if (m) m.scrollTop = 0; }
}

async function fillLog() { const box = q('#logbox'); if (!box) return; const [e, info] = await Promise.all([readLog(), trimLog(90, false)]); const b2 = q('#logbox'); if (b2) b2.innerHTML = V.logHtml(e, info); }

// ---------- editor helpers ----------
function wrapSel(ta, a, b) { const s = ta.selectionStart, e = ta.selectionEnd; const v = ta.value; ta.value = v.slice(0, s) + a + v.slice(s, e) + b + v.slice(e); ta.focus(); ta.setSelectionRange(s + a.length, e + a.length); }
function linePrefix(ta, p) { const s = ta.selectionStart; const ls0 = ta.value.lastIndexOf('\n', s - 1) + 1; ta.value = ta.value.slice(0, ls0) + p + ta.value.slice(ls0); ta.focus(); ta.setSelectionRange(s + p.length, s + p.length); }
function suggest(ta) {
  const box = q('#sugg'); if (!box) return;
  const pos = ta.selectionStart; const before = ta.value.slice(0, pos); const m = /\[\[([^\]\n]*)$/.exec(before);
  if (!m) { box.innerHTML = ''; return; }
  const term = m[1].toLowerCase(); const list = st.idx.notes.filter((n) => n.title.toLowerCase().includes(term)).slice(0, 6);
  box.innerHTML = list.length ? `<div class="sugg" role="listbox" aria-label="Note suggestions">${list.map((n) => `<button type="button" data-act="pick" data-t="${esc(n.title)}">${esc(n.title)}</button>`).join('')}</div>` : '';
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-gid]'); if (g && q('#gsvg')) { st.graph.sel = g.dataset.gid; const sc = q('#main').scrollTop; route(); q('#main').scrollTop = sc; return; }
  const el = e.target.closest('[data-act]'); if (!el) { if (st.navOpen && !e.target.closest('.nav')) { st.navOpen = false; q('.nav')?.classList.remove('open'); } return; }
  const act = el.dataset.act; const p = el.dataset.p;
  if (['asksel', 'askex', 'askq', 'askfilter', 'import', 'autolock', 'restore-file', 'docsel', 'tpl-insert', 'dockind', 'doctitle', 'gfilter', 'fsel', 'ftitle', 'fbel', 'wa-import', 'wasel', 'wamode', 'waorder', 'wafilter'].includes(act)) return; // handled on change/input
  switch (act) {
    case 'theme': ls.set('theme', el.dataset.v); applyTheme(); if (st.master) route(); break;
    case 'menu': st.navOpen = !st.navOpen; q('.nav')?.classList.toggle('open', st.navOpen); break;
    case 'trash': await setTrashed(p, true); toast('Moved to trash'); location.hash = '#/'; break;
    case 'restore': await setTrashed(p, false); toast('Restored'); route(); break;
    case 'destroy-ask': confirmSheet('This permanently deletes the note and its history. This cannot be undone.', 'Delete for good', async () => { await destroy(p); toast('Deleted'); route(); }); break;
    case 'mktalk': { const n = st.idx.notes.find((x) => x.path === p); const tp = `Talk/${safeName(n.title)}.md`; await saveNote(tp, `---\ntype: talk\nstatus: open\n---\n# Talk: ${n.title}\n\n- \n`); location.hash = `#/note/${enc(tp)}?tab=edit`; break; }
    case 'showver': { const n = st.notes.find((x) => x.path === p); const v = n.versions[Number(el.dataset.i)]; q('#ver').innerHTML = `<h2>Version from ${new Date(v.t).toLocaleString()}</h2><pre class="review mono">${esc(v.text)}</pre>`; break; }
    case 'restorever': { const n = st.notes.find((x) => x.path === p); await saveNote(p, n.versions[Number(el.dataset.i)].text, n.id); toast('Version restored'); location.hash = `#/note/${enc(p)}`; break; }
    case 'jump': { e.preventDefault(); document.getElementById(el.dataset.id)?.scrollIntoView(); break; }
    case 'fmt': { const ta = q('#ed'); const k = el.dataset.k; if (k === 'bold') wrapSel(ta, '**', '**'); else if (k === 'italic') wrapSel(ta, '*', '*'); else if (k === 'h2') linePrefix(ta, '## '); else if (k === 'list') linePrefix(ta, '- '); else if (k === 'link') { wrapSel(ta, '[[', ']]'); suggest(ta); } break; }
    case 'pick': { const ta = q('#ed'); const pos = ta.selectionStart; const before = ta.value.slice(0, pos); const i = before.lastIndexOf('[['); ta.value = before.slice(0, i) + '[[' + el.dataset.t + ']]' + ta.value.slice(pos); const np = i + el.dataset.t.length + 4; ta.focus(); ta.setSelectionRange(np, np); q('#sugg').innerHTML = ''; break; }
    case 'filters': { const box = q('#fp'); box.innerHTML = box.innerHTML ? '' : V.filterPanel(new URLSearchParams(location.hash.split('?')[1] || '').get('q') || ''); break; }
    case 'rmfilter': { const cur = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || ''; const k = el.dataset.k; location.hash = `#/search?q=${enc(cur.replace(new RegExp(`\\b${k}:("[^"]+"|\\S+)`, 'i'), '').replace(/\s+/g, ' ').trim())}`; break; }
    case 'ask-results': { st.ask.sel = new Set(search(st.idx.notes, el.dataset.q).results.map((x) => x.note.path)); st.ask.q = ''; location.hash = '#/ask'; break; }
    case 'doc-results': { st.docSel = new Set(search(st.idx.notes, el.dataset.q).results.map((x) => x.note.path)); location.hash = '#/digest'; break; }
    case 'ask-top': { const cur = location.hash.match(/#\/note\/([^?]+)/); if (cur) st.ask.sel.add(decodeURIComponent(cur[1])); st.ask.mode = 'answer'; break; }
    case 'review': st.ask.q = q('#aq').value; location.hash = '#/ask/review'; break;
    case 'think': { st.ask.sel = new Set([p]); st.ask.mode = el.dataset.m; st.ask.q = ''; location.hash = '#/ask/review'; break; }
    case 'askclear': st.ask.sel.clear(); route(); break;
    case 'copy': { const text = q('#review').textContent; const ok = await copyText(text); q('#rmsg').innerHTML = ok ? '<div class="okmsg">Copied. Open the Claude app and paste it into a new message.</div>' : '<div class="err">Copy was not allowed. Press and hold the text above, choose Select All, then Copy.</div>'; break; }
    case 'backup': {
      const recs = await S.allRecs(); download(`second-brain-backup-${today()}.sbbak`, JSON.stringify({ format: 'sbipad-backup', v: 1, at: new Date().toISOString(), meta: st.meta, notes: recs, wa: (await S.getMetaK('wa-vault')) || null, files: await Promise.all((await S.allFiles()).map(async ([id, r]) => [id, r.c instanceof Uint8Array ? { bin: 1, n: await C.toB64(r.n), c: await C.toB64(r.c) } : r])) }), 'application/octet-stream'); ls.set('lastBackup', String(Date.now())); toast('Backup created. Save it in the Files app.'); route(); break;
    }
    case 'exportmd-ask': confirmSheet('The Markdown zip is NOT encrypted. Anyone who opens it can read your notes.', 'Export anyway', async () => { const f = {}; for (const n of st.idx.notes) f[n.path] = strToU8(n.text); download(`second-brain-notes-${today()}.zip`, zipSync(f), 'application/zip'); toast('Exported'); }); break;
    case 'lock': lock(); break;
    case 'review-save': {
      const r = reviewData(st.idx.notes, util.tsOf, el.dataset.p, el.dataset.e, st.idx.contradictions.length); const rp = `Reports/Review-${el.dataset.p}-${el.dataset.e}.md`;
      const ex = byPath(rp); await saveNote(rp, reportMarkdown(r, today()), ex ? ex.id : undefined); toast(ex ? 'Report updated' : 'Report saved'); location.hash = `#/note/${enc(rp)}`; break;
    }
    case 'review-ask': { const r = reviewData(st.idx.notes, util.tsOf, el.dataset.p, el.dataset.e, 0); st.ask.sel = new Set([...r.fresh, ...r.changed].map((n) => n.path)); st.ask.q = ''; location.hash = '#/ask'; break; }
    case 'kb-move': { const rec = byPath(p); if (!rec) break; await saveNote(p, setFm(rec.text, 'status', statusValue(el.dataset.c)), rec.id); toast('Moved to ' + COLUMN_LABEL[el.dataset.c]); route(); break; }
    case 'due-done': { const rec = byPath(p); if (!rec) break; await saveNote(p, setFm(rec.text, 'zuletzt', el.dataset.t), rec.id); toast('Marked done'); route(); break; }
    case 'wa-lock': waLock(); route(); break;
    case 'warkgo': wa.rk = null; route(); break;
    case 'wa-userk': q('#wrk').innerHTML = '<div class="field"><label for="wrkin">WhatsApp recovery key</label><input id="wrkin" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-..."></div><button class="btn" type="button" data-act="wa-rkunlock">Unlock with recovery key</button>'; break;
    case 'wa-rkunlock': if (await waUnlock(q('#wrkin').value, true)) route(); else q('#wmsg').innerHTML = '<div class="err">That recovery key does not match.</div>'; break;
    case 'wa-cancel': wa.filing = null; route(); break;
    case 'wa-go': { const items = wa.filing.filter((x) => x.sel && x.status !== 'blocked'); el.disabled = true; el.textContent = 'Importing...'; wa.last = await fileChats(items); wa.filing = null; toast('Chats imported'); route(); break; }
    case 'wa-more': { wa.win += 200; route(); break; }
    case 'wa-ask': { const c = wa.chats.find((x) => x.id === el.dataset.id); sheet(`<div style="font-size:20px;font-weight:600">Review what will be copied</div><p class="m small">This exact text is copied. This app sends nothing anywhere. Paste it into the Claude app yourself.</p><pre class="review mono" id="wareview" style="white-space:pre-wrap;max-height:50vh;overflow:auto">${esc(askText(c))}</pre><div id="wamsg" aria-live="polite"></div><div class="tool"><button class="btn pri" data-act="wa-copy">Copy</button><button class="btn" data-act="wa-close">Close</button></div>`); break; }
    case 'wa-copy': { const ok = await copyText(q('#wareview').textContent); q('#wamsg').innerHTML = ok ? '<div class="okmsg">Copied. Open the Claude app and paste it into a new message.</div>' : '<div class="err">Copy was not allowed. Press and hold the text above, choose Select All, then Copy.</div>'; break; }
    case 'wa-close': document.querySelectorAll('.modal').forEach((m) => m.remove()); break;
    case 'wa-del-ask': { const id = el.dataset.id; confirmSheet('This permanently deletes this chat from the WhatsApp space. This cannot be undone.', 'Delete chat', async () => { await waDelete(id); toast('Chat deleted'); location.hash = '#/whatsapp'; }); break; }
    case 'dl-orig': case 'share-orig': {
      const n = st.idx.notes.find((x) => x.path === p); const bytes = n && n.fm.file ? await getOriginal(String(n.fm.file)) : null;
      if (!bytes) { toast('The original file is not available.'); break; }
      const name = String(n.fm.herkunft || `${n.title}.${n.fm.format}`); const type = MIME[n.fm.format] || 'application/octet-stream';
      if (el.dataset.act === 'share-orig') { try { const f = new File([bytes], name, { type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); break; } } catch (err) { if (err.name === 'AbortError') break; } toast('Sharing is not available here. The file is downloaded instead.'); }
      download(name, bytes, type); break;
    }
    case 'fsel-all': break;
    case 'file-cancel': st.filing = null; route(); break;
    case 'file-go': {
      document.querySelectorAll('[data-act=ftitle]').forEach((i) => { st.filing.items[Number(i.dataset.i)].title = i.value.trim() || st.filing.items[Number(i.dataset.i)].title; }); document.querySelectorAll('[data-act=fbel]').forEach((i) => { st.filing.items[Number(i.dataset.i)].belongs = i.value.trim(); });
      const items = st.filing.items.filter((x) => x.sel && x.status !== 'blocked'); el.disabled = true; el.textContent = 'Filing...';
      const done = await fileItems(items); st.filing = null; st.lastFiled = done; toast(`Filed ${done.length} document${done.length === 1 ? '' : 's'}`); route(); break;
    }
    case 'log-trim': { const info = await trimLog(90, false); confirmSheet(`This removes ${info.remove} log entries older than 90 days.`, 'Remove', async () => { await trimLog(90, true); fillLog(); toast('Old entries removed'); }); break; }
    case 'log-clear': confirmSheet('This deletes the whole search log. This cannot be undone.', 'Clear log', async () => { await clearLog(); fillLog(); toast('Log cleared'); }); break;
    case 'wipe-ask': confirmSheet('This erases the vault and all notes from this iPad. A backup is the only way to get them back.', 'Erase everything', async () => { await S.wipe(); waLock(); wa.meta = null; st.meta = null; st.master = null; st.recs.clear(); location.hash = ''; lockScreen(); }, 'ERASE'); break;
    case 'userk': q('#rkbox').innerHTML = `<div class="field"><label for="rkin">Recovery key</label><input id="rkin" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-..."></div><button class="btn" type="button" data-act="rkunlock">Unlock with recovery key</button>`; break;
    case 'rkunlock': { const m = await C.unlockWithRecovery(st.meta, q('#rkin').value); if (m) await enter(m); else q('#lmsg').innerHTML = '<div class="err">That recovery key does not match.</div>'; break; }
    case 'rkgo': rkPending = null; location.hash = '#/'; route(); startedHint(); break;
    case 'docx': { const md = docMd(); logSearch('document', q('#dt').value || 'Untitled document', st.docSel.size).catch(() => {}); download(`${safeName(q('#dt').value || 'document')}.docx`, markdownToDocx(md), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); break; }
    case 'mddl': download(`${safeName(q('#dt').value || 'document')}.md`, docMd(), 'text/markdown'); break;
    default: break;
  }
});
function startedHint() { toast('Vault created. Import your notes to begin.'); }
const docMd = () => draftDocument(q('#dk').value, [...st.docSel].map((p) => st.idx.notes.find((n) => n.path === p)).filter(Boolean), q('#dt').value || 'Untitled document');

document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return; const act = el.dataset.act;
  if (act === 'asksel') { el.checked ? st.ask.sel.add(el.dataset.p) : st.ask.sel.delete(el.dataset.p); const lab = q('label[for=af]'); if (lab) lab.textContent = `Choose notes (${st.ask.sel.size} selected)`; const b = q('[data-act=review]'); if (b) b.disabled = !st.ask.sel.size; }
  else if (act === 'askex') st.ask.exclude = el.checked;
  else if (act === 'askmode') { st.ask.mode = el.value; }
  else if (act === 'autolock') ls.set('autolock', el.value);
  else if (act === 'gfilter') { st.graph.f[el.dataset.k] = el.checked; st.graph.sel = null; route(); }
  else if (act === 'docsel') { el.checked ? st.docSel.add(el.dataset.p) : st.docSel.delete(el.dataset.p); const sc = q('#main').scrollTop; const k = q('#dk').value, t = q('#dt').value; app.querySelector('#main').innerHTML = V.digestPage(Number(new URLSearchParams(location.hash.split('?')[1] || '').get('d') || 7), k, t); q('#main').scrollTop = sc; }
  else if (act === 'dockind' || act === 'doctitle') { const sc = q('#main').scrollTop; app.querySelector('#main').innerHTML = V.digestPage(Number(new URLSearchParams(location.hash.split('?')[1] || '').get('d') || 7), q('#dk').value, q('#dt').value); q('#main').scrollTop = sc; }
  else if (act === 'tpl-insert') { const k = el.value; if (!k) return; const ta = q('#ed'); const body = TEMPLATES[k].body('Title').replace(/^---[\s\S]*?---\n/, ''); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '\n' + body + ta.value.slice(s); el.value = ''; ta.focus(); }
  else if (act === 'import') {
    const files = []; const docs = []; const msg = q('#imsg'); msg.innerHTML = '<div class="m">Reading files...</div>';
    try {
      for (const f of el.files) {
        if (/\.zip$/i.test(f.name)) { const u = unzipSync(new Uint8Array(await f.arrayBuffer())); for (const [p, d] of Object.entries(u)) if (!p.endsWith('/')) files.push({ path: p, text: strFromU8(d) }); }
        else if (/\.(md|markdown)$/i.test(f.name)) files.push({ path: f.name, text: await f.text() });
        else docs.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), mtime: f.lastModified });
      }
      let note = '';
      if (files.length) { const r = await importFiles(files); note = `<div class="okmsg">Added ${r.added}, updated ${r.updated}, unchanged ${r.same}, skipped ${r.skipped}.</div>`; }
      if (docs.length) { msg.innerHTML = '<div class="m">Reading documents...</div>'; const items = await planFiling(docs); for (const it of items) it.sel = it.status === 'new'; st.filing = { items }; st.lastFiled = null; route(); if (note) q('#imsg').insertAdjacentHTML('afterbegin', note); }
      else msg.innerHTML = note;
    } catch (err) { msg.innerHTML = `<div class="err">Could not read the file: ${esc(err.message)}</div>`; }
  } else if (act === 'fsel') { const it = st.filing.items[Number(el.dataset.i)]; it.sel = el.checked; const b = q('[data-act=file-go]'); const n = st.filing.items.filter((x) => x.sel).length; b.textContent = `File selected (${n})`; b.disabled = !n; }
  else if (act === 'wa-import') {
    const msg = q('#wimsg'); msg.innerHTML = '<div class="m">Reading...</div>';
    try { const fs = []; for (const f of el.files) fs.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); wa.filing = await planChats(fs); wa.last = null; route(); }
    catch (err) { msg.innerHTML = `<div class="err">Could not read the file: ${esc(err.message)}</div>`; }
  }
  else if (act === 'wasel') { const it = wa.filing[Number(el.dataset.i)]; it.sel = el.checked; const n = wa.filing.filter((x) => x.sel).length; const b = q('[data-act=wa-go]'); b.textContent = `Import selected (${n})`; b.disabled = !n; }
  else if (act === 'warkok') q('#warkgo').disabled = !el.checked;
  else if (act === 'wamode') wa.filing[Number(el.dataset.i)].mode = el.value;
  else if (act === 'waorder') { replan(wa.filing[Number(el.dataset.i)], el.value); route(); }
  else if (act === 'ftitle') { st.filing.items[Number(el.dataset.i)].title = el.value; }
  else if (act === 'fbel') { st.filing.items[Number(el.dataset.i)].belongs = el.value.trim(); }
  else if (act === 'restore-file') {
    try {
      const j = JSON.parse(await el.files[0].text()); if (j.format !== 'sbipad-backup' || !j.meta || !Array.isArray(j.notes)) throw new Error('This is not a Second Brain backup.');
      await S.wipe(); await S.putMeta(j.meta); for (const [id, rec] of j.notes) await S.putRec(id, rec); if (j.wa) await S.putMetaK('wa-vault', j.wa); for (const [id, r] of j.files || []) await S.putFile(id, r && typeof r.c === 'string' && (r.bin || !(id === 'log' || id.startsWith('wa:'))) ? { n: await C.fromB64(r.n), c: await C.fromB64(r.c) } : r); st.meta = j.meta; lockScreen('Backup restored. Unlock with the passcode from that backup.');
    } catch (err) { q('#lmsg').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  }
});
document.addEventListener('input', (e) => {
  const el = e.target; const act = el.dataset && el.dataset.act;
  if (el.id === 'ed') suggest(el);
  if (act === 'askq') st.ask.q = el.value;
  if (act === 'wafilter') { const c = wa.chats.find((x) => x.id === el.dataset.id); const all = c.stats.messages.filter((m) => m.kind === 'msg'); q('#wamsgs').innerHTML = V.waMsgs(el.value ? all : all.slice(-wa.win), el.value); }
  if (act === 'askfilter') { const t = document.createElement('div'); t.innerHTML = V.askPage(el.value); q('#alist').innerHTML = t.querySelector('#alist').innerHTML; }
});
document.addEventListener('keyup', (e) => { if (e.target.id === 'ed') suggest(e.target); });
document.addEventListener('click', (e) => { if (e.target.id === 'ed') suggest(e.target); });
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); const kind = f.dataset.form; const fd = new FormData(f);
  if (kind === 'search' || kind === 'search2') { const qq = String(fd.get('q') || '').trim(); if (qq) await logSearch('search', qq, search(st.idx.notes, qq).total).catch(() => {}); location.hash = `#/search?q=${enc(String(fd.get('q') || ''))}`; }
  else if (kind === 'wacreate') {
    const p1 = String(fd.get('p1')), p2 = String(fd.get('p2')); const err = await waCheckSecret(p1);
    if (err) { q('#wmsg').innerHTML = `<div class="err">${esc(err)}</div>`; return; } if (p1 !== p2) { q('#wmsg').innerHTML = '<div class="err">The two entries do not match.</div>'; return; }
    const b = q('#wcb'); b.disabled = true; b.textContent = 'Creating...'; await new Promise((r) => setTimeout(r, 30)); await waCreate(p1); route();
  } else if (kind === 'waunlock') {
    await new Promise((r) => setTimeout(r, 30)); if (await waUnlock(String(fd.get('p')))) route(); else { q('#wmsg').innerHTML = '<div class="err">Wrong passphrase. Try again.</div>'; q('#wu').value = ''; }
  } else if (kind === 'wasearch') {
    const r = searchChats(String(fd.get('q') || '')); q('#wares').innerHTML = r.length ? `<div class="list">${r.map((x) => `<a href="#/whatsapp/chat/${enc(x.id)}"><b>${esc(x.title)}</b> <span class="m small mono">${esc(x.t.slice(0, 16).replace('T', ' '))} ${esc(x.from)}</span><br>${esc(x.text)}</a>`).join('')}</div>` : '<p class="m">No matches in your chats.</p>';
  } else if (kind === 'filters') {
    const cur = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || ''; let base = cur.replace(/\b(type|in|from|after|before):("[^"]+"|\S+)/gi, '').replace(/\s+/g, ' ').trim();
    for (const k of ['type', 'in', 'from', 'after', 'before']) { const v = String(fd.get(k) || '').trim(); if (v) base += ` ${k}:${/\s/.test(v) ? `"${v}"` : v}`; }
    location.hash = `#/search?q=${enc(base.trim())}`;
  } else if (kind === 'save') { await saveNote(f.dataset.p, String(fd.get('text')), f.dataset.id); toast('Saved'); location.hash = `#/note/${enc(f.dataset.p)}`; }
  else if (kind === 'create') {
    const title = safeName(String(fd.get('title'))); const k = String(fd.get('kind')); const folder = String(fd.get('folder'));
    if (!title && k !== 'daily') { q('#nerr').innerHTML = '<div class="err">Enter a title.</div>'; return; }
    const path = k === 'daily' ? TEMPLATES.daily.path() : (folder ? `${folder}/${title}.md` : TEMPLATES[k].path(title));
    const ex = byPath(path); if (ex && k === 'daily' && !ex.trashed) { location.hash = `#/note/${enc(path)}?tab=edit`; return; }
    if (ex) { q('#nerr').innerHTML = '<div class="err">A note with this name already exists.</div>'; return; }
    await saveNote(path, TEMPLATES[k].body(title)); location.hash = `#/note/${enc(path)}?tab=edit`;
  } else if (kind === 'unlock') {
    const b = q('#ub'); b.disabled = true; b.textContent = 'Unlocking...'; await new Promise((r) => setTimeout(r, 30));
    if (st.fails >= 5) await new Promise((r) => setTimeout(r, (st.fails - 4) * 1500));
    const m = await C.unlock(st.meta, String(fd.get('p'))); if (m) { st.fails = 0; await enter(m); } else { st.fails++; b.disabled = false; b.textContent = 'Unlock'; q('#lmsg').innerHTML = '<div class="err">Wrong passcode. Try again.</div>'; q('#pw').value = ''; q('#pw').focus(); }
  } else if (kind === 'setup') {
    const s1 = String(fd.get('s1')), s2 = String(fd.get('s2')); const v = C.validateSecret(s1);
    if (!v.ok) { q('#lmsg').innerHTML = `<div class="err">${esc(v.error)}</div>`; return; }
    if (s1 !== s2) { q('#lmsg').innerHTML = '<div class="err">The two entries do not match.</div>'; return; }
    const b = q('#sb'); b.disabled = true; b.textContent = 'Creating...'; await new Promise((r) => setTimeout(r, 30));
    const { master, meta, recoveryKey } = await C.createVault(s1); await S.putMeta(meta); st.meta = meta; st.master = master; st.recs.clear(); rebuild(); rkPending = recoveryKey; lastActive = Date.now(); recoveryScreen(recoveryKey);
  } else if (kind === 'chpass') {
    const out = q('#cperr'); const old = String(fd.get('old')); const n1 = String(fd.get('n1')), n2 = String(fd.get('n2'));
    if (!(await C.unlock(st.meta, old))) { out.innerHTML = '<div class="err">The current passcode is wrong.</div>'; return; }
    const v = C.validateSecret(n1); if (!v.ok) { out.innerHTML = `<div class="err">${esc(v.error)}</div>`; return; } if (n1 !== n2) { out.innerHTML = '<div class="err">The new entries do not match.</div>'; return; }
    st.meta = await C.changeSecret(st.meta, st.master, n1); await S.putMeta(st.meta); out.innerHTML = '<div class="okmsg">Passcode changed.</div>'; f.reset();
  } else if (kind === 'newrk') {
    const out = q('#rkout'); if (!(await C.unlock(st.meta, String(fd.get('p'))))) { out.innerHTML = '<div class="err">The passcode is wrong.</div>'; return; }
    const r = await C.newRecovery(st.meta, st.master); st.meta = r.meta; await S.putMeta(st.meta); out.innerHTML = `<p>Your new recovery key (the old one no longer works). Write it down now:</p><div class="rk">${esc(r.recoveryKey)}</div>`; f.reset();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach((m) => { if (!m.querySelector('#review')) m.remove(); else location.hash = '#/ask'; }); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { const kb = Math.max(0, innerHeight - visualViewport.height); document.documentElement.style.setProperty('--kb', kb + 'px'); if (kb && document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) document.activeElement.scrollIntoView({ block: 'center' }); });
addEventListener('hashchange', route);

(async () => {
  applyTheme();
  try { await C.ready(); } catch (err) { app.innerHTML = `<div class="lock"><div class="lockbox"><div class="err">This browser cannot run the encryption module: ${esc(err.message)}</div></div></div>`; return; }
  try { st.meta = await S.getMeta() || null; } catch { st.meta = null; }
  lockScreen(); startAutolock();
  if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('./sw.js'); } catch { /* offline support unavailable */ } }
  window.__sbReady = true;
})();
