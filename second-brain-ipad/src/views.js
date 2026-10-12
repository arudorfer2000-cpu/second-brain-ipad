import { st, util, TEMPLATES, buildAskText, TYPE_LABELS, TYPE_NAMES, infoboxOf, headings, baseName, search, digest, draftDocument, render, esc, slug, layout } from './app.js';
import { wa, stamp } from './wa.js';
import { MODES, modeLabel } from './modes.js';
import { board, COLUMNS, COLUMN_LABEL } from './kanban.js';
import { summaryText } from './whatsapp.js';
import { dueList, localToday, rel, RHYTHM_LABEL } from './due.js';
import { reviewData, addDaysIso } from './review.js';
const { ls, fmtAgo, tsOf, themeSeg, today } = util;
const enc = encodeURIComponent;
const href = (p) => `#/note/${enc(p)}`;
const link = (n) => `<a href="${href(n.path)}">${esc(n.title)}</a>`;

export function topbar() {
  return `<div class="top"><button class="btn menu" data-act="menu" aria-label="Open navigation">&#9776;</button><a class="logo" href="#/">Second Brain</a>
<form class="search" data-form="search" role="search"><input type="search" name="q" placeholder="Search the wiki" aria-label="Search the wiki" value="" enterkeyhint="search"></form>
<div style="flex:1"></div><a class="btn ask" href="#/ask" data-act="ask-top"><span aria-hidden="true">&#10024;</span><span class="t">Ask AI</span></a>${themeSeg()}</div>`;
}
export function nav(on, cur) {
  const a = (r, label, extra = '') => `<a href="#/${r}" class="${on === r ? 'on' : ''}" ${extra}>${label}</a>`;
  return `<nav class="nav ${st.navOpen ? 'open' : ''}" aria-label="Main"><b>NAVIGATION</b>${a('', 'Main page')}${a('recent', 'Recent changes')}<a href="#/random">Random note</a>${a('cats', 'All categories')}${a('graph', 'Graph view')}
<b>TOOLS</b>${cur ? `<a href="#/links/${enc(cur)}" class="${on === 'links' ? 'on' : ''}">What links here</a>` : '<a class="dis" aria-disabled="true">What links here</a>'}${a('ask', 'Copy for Claude')}${a('import', 'Import file')}${a('due', 'Deadlines')}${a('kanban', 'Kanban board')}${a('review', 'Weekly review')}${a('sources', 'Sources and search log')}${a('whatsapp', 'WhatsApp space')}${a('health', 'Health check')}${a('digest', 'Digest and documents')}${a('backup', 'Back up and export')}${a('trash', 'Trash')}${a('settings', 'Settings')}</nav>`;
}
export const shell = (inner, on = '', cur = '') => `${topbar()}<div class="body">${nav(on, cur)}<main class="main" id="main">${inner}</main></div>`;
const reds = () => st.idx.red.length;

// ---------- home (E2) ----------
const dueBadge = () => { const r = dueList(st.idx.notes, localToday(), 7); const o = r.overdue.length, w = r.soon.length; return o || w ? ` (${o ? `${o} overdue` : ''}${o && w ? ', ' : ''}${w ? `${w} soon` : ''})` : ''; };
export function home() {
  const idx = st.idx, n = idx.notes.length, cats = idx.cats.size; const now = Date.now();
  const week = idx.notes.filter((x) => tsOf(x) >= now - 7 * util.DAY).length;
  const lb = ls.get('lastBackup', ''); const lbTxt = lb ? fmtAgo(Number(lb)) : 'never';
  const recent = [...idx.notes].sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 5);
  const cl = [...idx.cats.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  const letters = new Set(idx.notes.map((x) => x.title.charAt(0).toUpperCase()));
  const az = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => letters.has(l) ? `<a href="#/az/${l}">${l}</a>` : `<span>${l}</span>`).join('');
  const openTalk = idx.talks.filter((t) => !/resolved|closed/i.test(String(t.fm.status || ''))).length;
  return `<div class="welcome"><div class="big">Welcome to your <span style="color:var(--link)">Second Brain</span></div><div class="m" style="margin-top:6px">${n} notes in ${cats} categories &middot; ${week} changed this week &middot; last backup ${esc(lbTxt)}</div></div>
<div class="home"><div class="col">
<div class="box"><div class="h">Recently changed</div><div class="c list">${recent.length ? recent.map((x) => `<div class="row"><a href="${href(x.path)}">${esc(x.title)}</a><span>${fmtAgo(tsOf(x))}</span></div>`).join('') : '<div class="row m">No notes yet. Import a vault zip to begin.</div>'}</div></div>
<div class="box"><div class="h">Categories</div><div class="c grid2">${cl.map(([c, l]) => `<a href="#/cat/${enc(c)}">${esc(c)} (${l.length})</a>`).join('') || '<span class="m">None yet</span>'}</div></div></div>
<div class="col">
<div class="box"><div class="h warn">Wiki upkeep</div><div class="c list"><div class="row"><a class="red" href="#/health#red">Missing pages (red links)</a><span>${reds()}</span></div><div class="row"><a href="#/health#orphans">Orphan notes</a><span>${idx.orphans.length}</span></div><div class="row"><a href="#/health#stubs">Stubs (no description)</a><span>${idx.stubs.length}</span></div><div class="row"><a href="#/health#talk">Open talk pages</a><span>${openTalk}</span></div></div></div>
<div class="box"><div class="h">Tools</div><div class="c grid2"><a href="#/due">Deadlines${dueBadge()}</a><a href="#/review">Weekly review</a><a href="#/import">Import file</a><a href="#/import">Import WhatsApp chat</a><a href="#/ask">Copy for Claude</a><a href="#/backup">Back up and export</a></div></div></div>
<div class="box azbox"><div class="h">A to Z</div><div class="c az">${az}</div></div></div>`;
}
export const listPage = (title, notes, extra = '') => `<h1 class="pt">${esc(title)}</h1>${extra}<div class="box"><div class="c list">${notes.length ? notes.map((x) => `<div class="row"><a href="${href(x.path)}">${esc(x.title)}</a><span>${fmtAgo(tsOf(x))}</span></div>`).join('') : '<div class="row m">Nothing here yet.</div>'}</div></div>`;
export const recent = () => listPage('Recent changes', [...st.idx.notes].sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 60));
export const cats = () => `<h1 class="pt">All categories</h1><div class="box"><div class="c list">${[...st.idx.cats.entries()].sort().map(([c, l]) => `<div class="row"><a href="#/cat/${enc(c)}">${esc(c)}</a><span>${l.length}</span></div>`).join('') || '<div class="row m">No categories yet.</div>'}</div></div>`;
export const cat = (c) => listPage(`Category: ${c}`, (st.idx.cats.get(c) || []).map((p) => st.idx.notes.find((x) => x.path === p)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title)));
export const az = (l) => listPage(`Notes starting with ${l}`, st.idx.notes.filter((x) => x.title.charAt(0).toUpperCase() === l).sort((a, b) => a.title.localeCompare(b.title)));
export const linksHere = (p) => { const n = st.idx.notes.find((x) => x.path === p); if (!n) return notFound(); return listPage(`What links to "${n.title}"`, st.idx.back.get(p).map((q) => st.idx.notes.find((x) => x.path === q)).filter(Boolean), `<p class="m"><a href="${href(p)}">Back to the note</a></p>`); };
export const notFound = () => `<h1 class="pt">Note not found</h1><p>This note does not exist. <a href="#/">Go to the main page</a>.</p>`;

// ---------- article (E1) ----------
export function note(path, tab = 'note') {
  const idx = st.idx; const n = idx.notes.find((x) => x.path === path) || st.notes.find((x) => x.path === path && x.trashed);
  if (!n) return { html: shell(notFound(), '', ''), cur: '' };
  const talk = idx.talkFor(n); const tOpen = talk && !/resolved|closed/i.test(String(talk.fm.status || ''));
  const tabs = `<div class="tabs"><div><a href="${href(path)}" class="${tab === 'note' ? 'on' : ''}">Note</a><a href="#/note/${enc(path)}?tab=talk" class="${tab === 'talk' ? 'on' : ''}">Talk${tOpen ? '<span class="badge">1</span>' : ''}</a><a href="#/note/${enc(path)}?tab=history" class="${tab === 'history' ? 'on' : ''}">History</a></div><div><a href="#/note/${enc(path)}?tab=edit" class="${tab === 'edit' ? 'on' : ''}">Edit</a>${n.trashed ? `<button data-act="restore" data-p="${esc(path)}">Restore</button>` : `<button data-act="trash" data-p="${esc(path)}">Move to trash</button>`}</div></div>`;
  let body = '';
  if (tab === 'edit') body = editForm(n);
  else if (tab === 'talk') body = talkTab(n, talk);
  else if (tab === 'history') body = historyTab(n);
  else body = articleBody(n);
  const cats = idx.catsOf(n);
  return { html: shell(`<div class="paper">${tabs}${body}${tab === 'note' ? `<div class="chips"><span class="m">Categories:</span>${cats.map((c) => `<a class="chip" href="#/cat/${enc(c)}">${esc(c)}</a>`).join('')}</div>` : ''}</div>`, '', path), cur: path };
}
function articleBody(n) {
  const idx = st.idx; const hs = headings(n.body); const rows = infoboxOf(n, idx);
  const back = idx.back.get(n.path).map((q) => idx.notes.find((x) => x.path === q)).filter(Boolean);
  const info = `<aside class="info" aria-label="Infobox"><div class="t">${esc(n.title)}</div>${rows.map(([k, v, isLink, bad]) => { const tgt = isLink && idx.resolve(v); return `<div class="r2"><b>${esc(k)}</b><span style="${bad ? 'color:var(--warnt)' : ''}">${tgt ? `<a href="${href(tgt.path)}">${esc(v)}</a>` : esc(v)}</span></div>`; }).join('')}</aside>`;
  const toc = hs.length >= 2 ? `<div class="toc"><b>Contents</b>${hs.map((h, i) => `<a href="#/note/${enc(n.path)}" data-act="jump" data-id="${slug(h.text)}">${i + 1} ${esc(h.text)}</a>`).join('')}</div>` : '';
  const dl = n.fm.file ? `<div class="tool" style="margin:8px 0"><button class="btn pri" data-act="dl-orig" data-p="${esc(n.path)}">Download original</button><button class="btn" data-act="share-orig" data-p="${esc(n.path)}" id="shbtn">Share original</button></div>` : '';
  const desc = n.description ? `<div class="hat">${esc(n.description)}</div>` : '';
  return `<div class="cols"><div class="txt"><h1>${esc(n.title)}</h1><div class="m small" style="margin:6px 0 10px">From your notes &middot; last edited ${fmtAgo(tsOf(n)) || 'unknown'}</div>${desc}${dl}<div class="tool" style="margin:8px 0" role="group" aria-label="Think with Claude">${['challenge', 'pattern', 'brainstorm'].map((m) => `<button class="btn" data-act="think" data-m="${m}" data-p="${esc(n.path)}">${modeLabel(m)}</button>`).join('')}</div>${toc}<div class="prose">${render(n.body.replace(/^#\s.*\n?/, ''), idx)}</div>
${back.length ? `<h2>What links here</h2><div class="list">${back.slice(0, 12).map((b) => `<a href="${href(b.path)}">${esc(b.title)}</a>`).join('')}</div>` : ''}</div>${info}</div>`;
}
function talkTab(n, talk) {
  if (!talk) return `<h1>Talk: ${esc(n.title)}</h1><p class="m">No talk page yet. Use it for open questions or contradictions about this note.</p><button class="btn pri" data-act="mktalk" data-p="${esc(n.path)}">Create talk page</button>`;
  return `<h1>Talk: ${esc(n.title)}</h1><div class="prose">${render(talk.body, st.idx)}</div><p><a class="btn" href="#/note/${enc(talk.path)}?tab=edit">Edit talk page</a></p>`;
}
function historyTab(n) {
  const v = n.versions || [];
  return `<h1>History: ${esc(n.title)}</h1>${v.length ? `<div class="list">${v.map((x, i) => `<div class="row"><span>${new Date(x.t).toLocaleString()}</span><span><button class="btn sm" data-act="showver" data-p="${esc(n.path)}" data-i="${i}">Show</button> <button class="btn sm" data-act="restorever" data-p="${esc(n.path)}" data-i="${i}">Restore</button></span></div>`).join('')}</div><div id="ver"></div>` : '<p class="m">No earlier versions yet. A version is kept every time you save a change.</p>'}`;
}
export function editForm(n) {
  return `<h1>Edit: ${esc(n.title)}</h1><form data-form="save" data-p="${esc(n.path)}" data-id="${esc(n.id)}">${toolbar()}<textarea class="ed" name="text" id="ed" aria-label="Note text" spellcheck="true">${esc(n.text)}</textarea><div id="sugg"></div><div class="tool"><button class="btn pri" type="submit">Save</button><a class="btn" href="${href(n.path)}">Cancel</a></div><div class="m small">Type [[ to link to another note. Missing notes appear as red links.</div></form>`;
}
function toolbar() {
  return `<div class="tool" role="toolbar" aria-label="Formatting"><button type="button" class="btn" data-act="fmt" data-k="bold"><b>B</b></button><button type="button" class="btn" data-act="fmt" data-k="italic"><i>I</i></button><button type="button" class="btn" data-act="fmt" data-k="h2">H2</button><button type="button" class="btn" data-act="fmt" data-k="list">List</button><button type="button" class="btn" data-act="fmt" data-k="link">[[Link]]</button><select aria-label="Insert template" data-act="tpl-insert" class="btn"><option value="">Template</option>${Object.entries(TEMPLATES).filter(([k]) => k !== 'blank' && k !== 'daily').map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>`;
}
export function newNote(title = '', kind = 'blank') {
  const folders = [...new Set(st.idx.notes.filter((x) => x.path.includes('/')).map((x) => x.path.split('/')[0]))].sort();
  return shell(`<h1 class="pt">New note</h1><form data-form="create" class="paper" style="padding:16px 22px"><div class="field"><label for="nt">Title</label><input id="nt" name="title" value="${esc(title)}" required autocomplete="off"></div>
<div class="field"><label for="nk">Template</label><select id="nk" name="kind">${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
<div class="field"><label for="nf">Folder</label><select id="nf" name="folder"><option value="">Automatic (by template)</option>${folders.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></div>
<div id="nerr"></div><div class="tool"><button class="btn pri" type="submit">Create and edit</button><a class="btn" href="#/">Cancel</a></div></form>`, '', '');
}
export function trash() {
  const t = st.notes.filter((x) => x.trashed);
  return `<h1 class="pt">Trash</h1><div class="box"><div class="c list">${t.length ? t.map((x) => `<div class="row"><a href="${href(x.path)}">${esc(x.title)}</a><span><button class="btn sm" data-act="restore" data-p="${esc(x.path)}">Restore</button> <button class="btn sm danger" data-act="destroy-ask" data-p="${esc(x.path)}">Delete for good</button></span></div>`).join('') : '<div class="row m">The trash is empty.</div>'}</div></div>`;
}

// ---------- search ----------
const shortHint = (q) => { const t = q.replace(/\b\w+:("[^"]+"|\S+)/g, '').trim(); return t.length > 0 && t.length < 3 ? '<div class="m small" role="note" style="margin:6px 0">Very short searches match many notes. Add another word or a filter such as <span class="mono">type:pdf</span> to narrow it down.</div>' : ''; };
export function searchPage(q) {
  const r = search(st.idx.notes, q); const f = r.filters;
  const chips = Object.entries(f).map(([k, v]) => `<button class="fchip" data-act="rmfilter" data-k="${k}" aria-label="Remove filter ${k}">${k} <b class="mono">${esc(v)}</b> &times;</button>`).join('');
  return `<form data-form="search2" class="search" style="max-width:none"><input type="search" name="q" value="${esc(q)}" placeholder="Search the wiki" aria-label="Search" autofocus style="height:56px;font-size:19px;border:2px solid var(--accent);border-radius:12px"></form>
<div class="filters">${chips}<button class="fchip" data-act="filters" style="border-style:dashed">+ filter</button></div><div id="fp"></div>
${shortHint(q)}<div class="m" style="margin:6px 0 10px">${r.total} result${r.total === 1 ? '' : 's'}${r.merged ? `, ${r.merged} duplicate${r.merged > 1 ? 's' : ''} merged` : ''}</div>
${r.results.map((x) => `<div class="res"><div class="tt"><a href="${href(x.note.path)}">${esc(x.note.title)}</a><span class="conf ${x.confidence}">confidence ${x.confidence}</span></div><div class="prose"><p style="margin:0;font-size:15px">${esc(x.snippet)}</p></div><div class="mono m small">${esc(x.note.path)} &middot; ${x.note.date ? new Date(x.note.date).toISOString().slice(0, 10) : 'no date'} &middot; ${esc(TYPE_NAMES[x.note.type] || x.note.type || 'note')}</div></div>`).join('') || (q.trim() ? '<p class="m">Nothing found. Check the filters.</p>' : '<p class="m">Type a word. Filters: type:decision in:projects from:name after:2026-01-01 before:2026-12-31</p>')}
${r.results.length ? `<div class="tool"><button class="btn pri" data-act="ask-results" data-q="${esc(q)}">Ask AI about these results</button><button class="btn" data-act="doc-results" data-q="${esc(q)}">Make a document</button></div>` : ''}`;
}
export function filterPanel(q) {
  const f = search([], q).filters; const types = ['', 'project', 'decision', 'lesson', 'conversation', 'daily'];
  return `<form data-form="filters" class="box" style="padding:12px 14px;margin-bottom:12px"><div class="field"><label>Type</label><select name="type">${types.map((t) => `<option ${f.type === t ? 'selected' : ''} value="${t}">${t || 'Any'}</option>`).join('')}</select></div><div class="field"><label>In (folder or path part)</label><input name="in" value="${esc(f.in || '')}"></div><div class="field"><label>From (source or author)</label><input name="from" value="${esc(f.from || '')}"></div><div class="field"><label>After</label><input type="date" name="after" value="${esc(f.after || '')}"></div><div class="field"><label>Before</label><input type="date" name="before" value="${esc(f.before || '')}"></div><button class="btn pri" type="submit">Apply</button></form>`;
}

// ---------- Ask AI ----------
export function askPage(filter = '') {
  const a = st.ask; const q = filter.toLowerCase();
  const list = st.idx.notes.filter((n) => !q || n.title.toLowerCase().includes(q)).sort((x, y) => (a.sel.has(y.path) - a.sel.has(x.path)) || tsOf(y) - tsOf(x)).slice(0, 60);
  return `<h1 class="pt">Copy for Claude</h1><p class="m">You choose what is copied. This app sends nothing. You will see the exact text before anything is copied.</p>
<fieldset class="field"><legend>Thinking mode</legend>${MODES.map((m) => `<label class="chk"><input type="radio" name="mode" value="${m}" data-act="askmode" ${a.mode === m ? 'checked' : ''}> <span>${modeLabel(m)}</span></label>`).join('')}</fieldset>
<div class="field"><label for="aq">Your question</label><textarea id="aq" name="q" rows="3" data-act="askq">${esc(a.q)}</textarea></div>
<label class="chk"><input type="checkbox" data-act="askex" ${a.exclude ? 'checked' : ''}> Leave out notes marked private</label>
<div class="field"><label for="af">Choose notes (${a.sel.size} selected)</label><input id="af" type="search" placeholder="Filter by title" value="${esc(filter)}" data-act="askfilter"></div>
<div class="box"><div class="c" id="alist">${list.map((n) => `<label class="chk"><input type="checkbox" data-act="asksel" data-p="${esc(n.path)}" ${a.sel.has(n.path) ? 'checked' : ''}> <span>${esc(n.title)}</span></label>`).join('') || '<span class="m">No notes.</span>'}</div></div>
<div class="tool"><button class="btn pri" data-act="review" ${a.sel.size ? '' : 'disabled'}>Review and copy</button><button class="btn" data-act="askclear">Clear selection</button></div>`;
}
export function reviewPage() {
  const { text, used, left } = buildAskText();
  const words = text.trim().split(/\s+/).length;
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="Review before copying"><div class="sheet"><div style="font-size:22px;font-weight:600">Copy for Claude</div><div class="m">Review exactly what will be copied. Nothing is sent by this app. You paste it into the Claude app yourself.</div>
<div><span class="badge" style="margin:0">${used.length} note${used.length === 1 ? '' : 's'}</span> <span class="badge" style="margin:0">~${words} words</span></div>
${left.length ? `<div class="m small">Left out because marked private: ${left.map((n) => esc(n.title)).join(', ')}</div>` : ''}
<pre class="review mono" id="review">${esc(text)}</pre><div id="rmsg" aria-live="polite"></div>
<div class="tool" style="justify-content:flex-end"><a class="btn" href="#/ask">Back</a><button class="btn pri" data-act="copy">Copy to clipboard</button></div></div></div>`;
}

// ---------- graph ----------
export function graphData() {
  const f = st.graph.f; const idx = st.idx; const cat = (n) => (n.type === 'adr' || n.type === 'decision') ? 'decision' : (n.type === 'project' || n.type === 'lesson') ? n.type : 'other';
  const vis = idx.notes.filter((n) => f[cat(n)]); const set = new Set(vis.map((n) => n.path));
  const edges = idx.edges.filter(([a, b]) => set.has(a) && set.has(b)); const missing = f.missing ? idx.red.filter((r) => r.from.some((p) => set.has(p))) : [];
  const nodes = [...vis.map((n) => ({ id: n.path, title: n.title, kind: cat(n) })), ...missing.map((r) => ({ id: 'missing:' + r.target, title: r.target, kind: 'missing' }))];
  const medges = [...edges]; for (const r of missing) for (const p of r.from) if (set.has(p)) medges.push([p, 'missing:' + r.target]);
  return { nodes, edges: medges };
}
export function graphSvg(W = 860, H = 520) {
  const { nodes, edges } = graphData(); if (!nodes.length) return '<p class="m">No notes to show. Import a vault first.</p>';
  const P = layout(nodes.map((n) => n.id), edges, W, H); const ix = new Map(P.map((p) => [p.id, p]));
  const deg = new Map(); for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  const sel = st.graph.sel;
  return `<svg class="graph" id="gsvg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graph of linked notes">${edges.map(([a, b]) => `<line x1="${ix.get(a).x.toFixed(1)}" y1="${ix.get(a).y.toFixed(1)}" x2="${ix.get(b).x.toFixed(1)}" y2="${ix.get(b).y.toFixed(1)}" ${b.startsWith('missing:') ? 'stroke-dasharray="5 4"' : ''}/>`).join('')}${nodes.map((n) => { const p = ix.get(n.id); const d = deg.get(n.id) || 0; const r = Math.min(24, 11 + d * 2.2); return `<circle class="hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="24" fill="transparent" data-gid="${esc(n.id)}"/><circle class="n ${sel === n.id ? 'sel' : ''}" data-path="${esc(n.id)}" data-gid="${esc(n.id)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" style="fill:var(--n-${n.kind})"/>${(d >= 2 || sel === n.id) ? `<text x="${p.x.toFixed(1)}" y="${(p.y + r + 14).toFixed(1)}" text-anchor="middle">${esc(n.title.slice(0, 28))}</text>` : ''}`; }).join('')}</svg>`;
}
export function graphPage() {
  const { nodes, edges } = graphData(); const meta = new Map(nodes.map((n) => [n.id, n]));
  const chk = (k, l) => `<label class="chk"><input type="checkbox" data-act="gfilter" data-k="${k}" ${st.graph.f[k] ? 'checked' : ''}> ${l}</label>`;
  return `<h1 class="pt">Graph view</h1><div class="gwrap"><div class="gsvg" id="gbox">${graphSvg()}</div><div class="gside"><div class="box"><div class="h">Show</div><div class="c">${chk('project', 'Projects')}${chk('decision', 'Decisions')}${chk('lesson', 'Lessons')}${chk('other', 'Other notes')}${chk('missing', 'Missing pages')}</div></div><div class="box"><div class="h">Selected</div><div class="c" id="gsel">${graphSel(st.graph.sel, meta, edges)}</div></div></div></div><p class="m small">${nodes.length} nodes, ${edges.length} links. Tap a dot to select it.</p>`;
}
export function graphSel(sel, meta, edges) {
  if (!sel || !meta.has(sel)) return '<span class="m">Tap a dot.</span>';
  const n = meta.get(sel); const out = edges.filter(([a]) => a === sel).length, inn = edges.filter(([, b]) => b === sel).length;
  return `<b>${esc(n.title)}</b><span class="m">${out} link${out === 1 ? '' : 's'} out, ${inn} in</span>${n.kind === 'missing' ? `<a class="btn pri" href="#/new/${enc(n.title)}">Create page</a>` : `<a class="btn pri" href="${href(sel)}">Open note</a>`}`;
}

// ---------- health ----------
export function health() {
  const i = st.idx; const open = i.talks.filter((t) => !/resolved|closed/i.test(String(t.fm.status || '')));
  const sec = (id, title, items, empty) => `<div class="box" id="${id}" style="margin-bottom:14px"><div class="h ${id === 'red' && items.length ? 'warn' : ''}">${title} (${items.length})</div><div class="c list">${items.length ? items.slice(0, 40).join('') : `<div class="row m">${empty}</div>`}</div></div>`;
  const lb = ls.get('lastBackup', '');
  return `<h1 class="pt">Health check</h1><div class="cards"><div class="stat"><span class="m small">Notes</span><b>${i.notes.length}</b></div><div class="stat"><span class="m small">Broken links</span><b class="${i.red.length ? 'red' : ''}">${i.red.length}</b></div><div class="stat"><span class="m small">Possible duplicates</span><b>${i.dupes.length}</b></div><div class="stat"><span class="m small">Last backup</span><b style="font-size:20px">${lb ? fmtAgo(Number(lb)) : 'never'}</b></div></div>
${sec('red', 'Missing pages', i.red.map((r) => `<div class="row"><span class="red">${esc(r.target)} <span class="m small">linked from ${r.from.length}</span></span><a href="#/new/${enc(r.target)}">Create page</a></div>`), 'No broken links.')}
${sec('dupes', 'Possible duplicates', i.dupes.map(([a, b]) => `<div class="row"><span>${link(a)} / ${link(b)}</span><a href="${href(a.path)}">Compare</a></div>`), 'No duplicates found.')}
${sec('stubs', 'Notes without description', i.stubs.map((n) => `<div class="row">${link(n)}<a href="#/note/${enc(n.path)}?tab=edit">Add</a></div>`), 'All notes have a description.')}
${sec('orphans', 'Orphan notes (no links in or out)', i.orphans.map((n) => `<div class="row">${link(n)}<span></span></div>`), 'No orphans.')}
${sec('contra', 'Possible contradictions', i.contradictions.map((n) => `<div class="row">${link(n)}<span>Review</span></div>`), 'None marked. Mark one with a line starting "CONTRADICTION:" or a "> [!contradiction]" block.')}
${sec('talk', 'Open talk pages', open.map((n) => `<div class="row">${link(n)}<span></span></div>`), 'No open talk pages.')}`;
}

// ---------- import, backup, settings, digest ----------
export function importPage() {
  const li = st.lastImport; const fl = st.filing;
  return `<h1 class="pt">Import file</h1>${fl ? filingReview(fl) : ''}<div class="paper" style="padding:18px 22px"><div class="field"><label for="imp"><b>Choose files from the Files app</b></label><input id="imp" type="file" accept=".zip,.md,.markdown,.docx,.xlsx,.pptx,.pdf,.txt,.csv,.html,.htm,text/markdown,application/zip,application/pdf" multiple data-act="import"></div>
<p class="m small"><b>Vault zip or Markdown notes:</b> added to your notes right away. Everything under _tools, .git and raw is skipped. Changed notes are updated and the old text is kept in History.</p>
<p class="m small"><b>Word, Excel, PowerPoint, PDF, text, CSV and HTML:</b> you first see a review list. Nothing is filed until you confirm. The text becomes a searchable note under Documents, and the original file is kept encrypted so you can download it again. Password-protected files are reported and never opened. Scans and photos without text are reported too (no OCR yet). Old .doc, .xls and .ppt files: save them as .docx, .xlsx or .pptx first.</p>
<p class="m small"><b>E-mail attachments:</b> in Mail touch the attachment, choose Share, then Save to Files. Then pick the file here. (If your Mail version words this differently, any way of saving the attachment to Files works.)</p>
<div id="imsg" aria-live="polite">${li ? `<div class="okmsg">Added ${li.added}, updated ${li.updated}, unchanged ${li.same}, skipped ${li.skipped}.</div>` : ''}${st.lastFiled ? `<div class="okmsg">Filed ${st.lastFiled.length} document${st.lastFiled.length === 1 ? '' : 's'}: ${st.lastFiled.map((d) => `<a href="${href(d.path)}">${esc(d.path.split('/').pop().replace(/\.md$/, ''))}</a>`).join(', ')}.</div>` : ''}</div></div>`;
}
const REASON = { duplicate: 'Duplicate', blocked: 'Cannot be filed', new: 'New' };
export function filingReview(fl) {
  const n = fl.items.filter((x) => x.sel).length;
  const projects = st.idx.notes.filter((x) => x.type === 'project');
  return `<div class="paper" style="padding:18px 22px;margin-bottom:14px" id="filing"><h2 style="margin-top:0">Review before filing</h2><p class="m small">Nothing has been filed yet. Untick what you do not want. You can change the title and the project.</p>
<datalist id="plist">${projects.map((x) => `<option value="${esc(x.title)}">`).join('')}</datalist>
${fl.items.map((it, i) => `<div class="res" data-fi="${i}"><div class="tt"><label class="chk" style="min-height:44px"><input type="checkbox" data-act="fsel" data-i="${i}" ${it.sel ? 'checked' : ''} ${it.status === 'blocked' ? 'disabled' : ''} aria-label="File ${esc(it.name)}"> <b>${esc(it.name)}</b></label><span class="conf ${it.status === 'new' ? 'high' : 'low'}">${REASON[it.status]}</span></div>
<div class="m small">${(it.size / 1024).toFixed(0)} KB${it.format ? ` &middot; ${esc(it.format)}` : ''}${it.folder ? ` &middot; ${esc(it.folder)}/` : ''}</div>
${it.status === 'blocked' ? `<div class="err">${esc(it.message)}</div>` : `${it.status === 'duplicate' ? `<div class="m small">${esc(it.message)} Tick the box only if you want a second copy.</div>` : ''}<div class="field"><label for="ft${i}">Title</label><input id="ft${i}" data-act="ftitle" data-i="${i}" value="${esc(it.title)}"></div><div class="field"><label for="fb${i}">Belongs to (project, optional)</label><input id="fb${i}" list="plist" data-act="fbel" data-i="${i}" value="${esc(it.belongs || '')}"></div><div class="prose m small" style="max-height:5.5em;overflow:hidden">${esc(it.text.slice(0, 240))}</div>`}</div>`).join('')}
<div class="tool"><button class="btn pri" data-act="file-go" ${n ? '' : 'disabled'}>File selected (${n})</button><button class="btn" data-act="file-cancel">Cancel</button></div></div>`;
}
export function sourcesPage() {
  const notes = st.idx.notes; const docs = notes.filter((x) => x.type === 'document'); const fmts = {};
  for (const d of docs) fmts[d.fm.format] = (fmts[d.fm.format] || 0) + 1;
  const priv = notes.filter((x) => st.ask && /(^|\/)(private|privat)(\/|$)/i.test(x.path)).length;
  return `<h1 class="pt">Sources and search log</h1><div class="box" style="margin-bottom:14px"><div class="h">What this app searches</div><div class="c"><ul>
<li><b>${notes.length - docs.length}</b> notes on this iPad</li>
<li><b>${docs.length}</b> filed documents${docs.length ? ` (${Object.entries(fmts).map(([k, v]) => `${v} ${esc(k)}`).join(', ')})` : ''}. Search them with <span class="mono">type:docx</span>, <span class="mono">type:pdf</span> or <span class="mono">type:xlsx</span>.</li></ul>
<p class="m small">Everything is searched on this iPad, offline. Nothing is sent anywhere.</p></div></div>
<div class="box" style="margin-bottom:14px"><div class="h">What this app does not search</div><div class="c"><p>E-mail, calendar, Drive and other cloud accounts are searched by the Claude app, not by this app. This app has no login and no network access on purpose. To use mail results with your notes, save the attachment to Files and import it here, or paste text into Ask AI.</p><p class="m small">Reports from the last days: <a href="#/digest?d=7">Digest and documents</a>.</p></div></div>
<div class="box"><div class="h">Search log</div><div class="c"><p class="m small">Your searches are written to an encrypted log on this iPad so you can see what you looked for. Nobody else can read it.</p><div id="logbox" aria-live="polite"><span class="m">Loading...</span></div></div></div>`;
}
export function logHtml(entries, info) {
  const KIND = { search: 'Search', ask: 'Ask AI', document: 'Document' };
  const rows = entries.slice(-100).reverse();
  return `${rows.length ? `<div class="list">${rows.map((e) => `<div class="row"><span><span class="mono m small">${new Date(e.t).toLocaleString()}</span> &middot; ${esc(KIND[e.k] || e.k)}: <b>${esc(e.q)}</b></span><span class="m small">${e.n} result${e.n === 1 ? '' : 's'}</span></div>`).join('')}</div>` : '<p class="m">The log is empty.</p>'}
<div class="tool"><button class="btn" data-act="log-trim" ${info.remove ? '' : 'disabled'}>Remove entries older than 90 days (${info.remove})</button><button class="btn danger" data-act="log-clear" ${entries.length ? '' : 'disabled'}>Clear the whole log</button></div>`;
}
export function backupPage() {
  const lb = ls.get('lastBackup', '');
  return `<h1 class="pt">Back up and export</h1><div class="box" style="margin-bottom:14px"><div class="h">Back up</div><div class="c"><p>Creates an encrypted backup file. Save it in the Files app. It can only be opened with your passcode or recovery key.</p><p class="m small">Last backup: ${lb ? new Date(Number(lb)).toLocaleString() : 'never'}</p><button class="btn pri" data-act="backup">Create backup</button></div></div>
<div class="box" style="margin-bottom:14px"><div class="h">Transfer with your PC (same Wi-Fi)</div><div class="c"><p>The transfer tool runs on your PC (pc-tool/transfer_tool.py).</p><ol><li>Start the tool on the PC. It prints an address and a PIN.</li><li>On the iPad open that address in Safari, not in this app, and enter the PIN.</li><li>Tap Download vault zip to bring notes here, or Upload to send a backup file to the PC.</li><li>Back in this app use Import file and choose the downloaded zip from the Files app.</li></ol><p class="m small">Home Wi-Fi traffic is not encrypted. Use it only on a network you trust.</p></div></div>
<div class="box"><div class="h">Export</div><div class="c"><p class="m small">The Markdown export is not encrypted. Keep it somewhere private.</p><button class="btn" data-act="exportmd-ask">All notes as Markdown zip</button></div></div>`;
}
export function settingsPage() {
  const al = ls.get('autolock', '1');
  return `<h1 class="pt">Settings</h1><div class="box" style="margin-bottom:14px"><div class="h">Appearance</div><div class="c"><div class="row" style="min-height:56px;display:flex;align-items:center;justify-content:space-between"><span>Theme</span>${themeSeg()}</div><p class="m small">Auto follows the system setting. Your choice is remembered on this iPad.</p></div></div>
<div class="box" style="margin-bottom:14px"><div class="h">Security</div><div class="c"><div class="field"><label for="al">Auto-lock after</label><select id="al" data-act="autolock">${[['1', '1 minute'], ['5', '5 minutes'], ['15', '15 minutes']].map(([v, l]) => `<option value="${v}" ${al === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
<form data-form="chpass"><div class="field"><label for="cp0">Current passcode or passphrase</label><input id="cp0" type="password" name="old" autocomplete="off"></div><div class="field"><label for="cp1">New passcode (6 digits) or passphrase (10 to 128 characters)</label><input id="cp1" type="password" name="n1" autocomplete="off"></div><div class="field"><label for="cp2">Repeat new</label><input id="cp2" type="password" name="n2" autocomplete="off"></div><div id="cperr" aria-live="polite"></div><button class="btn" type="submit">Change passcode</button></form>
<hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><form data-form="newrk"><div class="field"><label for="rk0">Create a new recovery key (enter your passcode)</label><input id="rk0" type="password" name="p" autocomplete="off"></div><div id="rkout" aria-live="polite"></div><button class="btn" type="submit">Create new recovery key</button></form><div class="tool"><button class="btn" data-act="lock">Lock now</button></div></div></div>
<div class="box" style="margin-bottom:14px"><div class="h">Ask AI</div><div class="c"><div class="row" style="min-height:44px;display:flex;align-items:center;justify-content:space-between"><span>Always show the review screen</span><span style="color:var(--okt)">On (cannot be turned off)</span></div></div></div>
<div class="box"><div class="h">Erase this iPad</div><div class="c"><p class="m small">Deletes the vault and all notes from this device. Make a backup first.</p><button class="btn danger" data-act="wipe-ask">Erase everything</button></div></div>`;
}
export function digestPage(days = 7, kind = 'report', title = '', picked = null) {
  const d = digest(st.idx.notes, days); const dec = d.filter((n) => n.type === 'adr' || n.type === 'decision');
  const sel = picked || [...st.docSel]; const notes = sel.map((p) => st.idx.notes.find((n) => n.path === p)).filter(Boolean);
  const md = draftDocument(kind, notes, title || 'Untitled document');
  return `<h1 class="pt">Digest and documents</h1><div class="tool"><a class="btn ${days === 1 ? 'pri' : ''}" href="#/digest?d=1">Daily</a><a class="btn ${days === 7 ? 'pri' : ''}" href="#/digest?d=7">Weekly</a><a class="btn" href="#/search?q=${enc('type:decision')}">Decision search</a></div>
<div class="box" style="margin-bottom:14px"><div class="h">Changed in the last ${days === 1 ? 'day' : days + ' days'} (${d.length})</div><div class="c list">${d.slice(0, 30).map((n) => `<div class="row">${link(n)}<label class="chk"><input type="checkbox" data-act="docsel" data-p="${esc(n.path)}" ${st.docSel.has(n.path) ? 'checked' : ''} aria-label="Use ${esc(n.title)} in the document"></label></div>`).join('') || '<div class="row m">Nothing changed in this period.</div>'}</div></div>
<div class="box" style="margin-bottom:14px"><div class="h">Decisions in this period (${dec.length})</div><div class="c list">${dec.map((n) => `<div class="row">${link(n)}<span>${esc(String(n.fm.status || ''))}</span></div>`).join('') || '<div class="row m">None.</div>'}</div></div>
<div class="box"><div class="h">Make a document (${notes.length} note${notes.length === 1 ? '' : 's'} selected)</div><div class="c"><div class="field"><label for="dk">Template</label><select id="dk" data-act="dockind"><option value="report" ${kind === 'report' ? 'selected' : ''}>Report</option><option value="decision" ${kind === 'decision' ? 'selected' : ''}>Decision</option><option value="briefing" ${kind === 'briefing' ? 'selected' : ''}>Briefing</option></select></div><div class="field"><label for="dt">Title</label><input id="dt" data-act="doctitle" value="${esc(title)}"></div><pre class="review mono">${esc(md)}</pre><div class="tool"><button class="btn pri" data-act="docx">Download Word file</button><button class="btn" data-act="mddl">Download Markdown</button></div></div></div>`;
}

// ---------- WhatsApp space ----------
const WAS = { new: 'New chat', append: 'More messages', duplicate: 'Duplicate', group: 'Group chat', blocked: 'Cannot be imported' };
const ORDERS = { dmy: 'Day, month, year', mdy: 'Month, day, year', ymd: 'Year, month, day' };
export function waPage() {
  const head = '<h1 class="pt">WhatsApp space</h1>';
  if (!wa.meta) return `${head}<div class="paper" style="padding:18px 22px"><p>The WhatsApp space is a separate encrypted area with its own passphrase. Chats are never visible in your normal notes, search or Ask AI.</p><form data-form="wacreate"><div class="field"><label for="wp1">Passphrase for the WhatsApp space (10 to 128 characters, different from your main passcode)</label><input id="wp1" type="password" name="p1" autocomplete="new-password" autocapitalize="off"></div><div class="field"><label for="wp2">Repeat</label><input id="wp2" type="password" name="p2" autocomplete="new-password" autocapitalize="off"></div><div id="wmsg" aria-live="polite"></div><button class="btn pri" id="wcb" type="submit">Create WhatsApp space</button></form></div>`;
  if (wa.rk) return `${head}<div class="paper" style="padding:18px 22px"><p>Write this recovery key down and keep it away from the iPad. It is the only way into the WhatsApp space if you forget the passphrase. It is shown only once.</p><div class="rk" id="wark">${esc(wa.rk)}</div><label class="chk"><input type="checkbox" id="warkok" data-act="warkok"> I have saved the recovery key</label><button class="btn pri" id="warkgo" data-act="warkgo" disabled>Continue</button></div>`;
  if (!wa.master) return `${head}<div class="paper" style="padding:18px 22px"><p>The WhatsApp space is locked.</p><form data-form="waunlock"><div class="field"><label for="wu">Passphrase</label><input id="wu" type="password" name="p" autocomplete="off" autocapitalize="off"></div><div id="wmsg" aria-live="polite"></div><button class="btn pri" type="submit">Unlock WhatsApp space</button> <button class="btn" type="button" data-act="wa-userk">Use recovery key</button></form><div id="wrk"></div></div>`;
  const list = wa.chats.length ? `<div class="list">${wa.chats.map((c) => `<a href="#/whatsapp/chat/${enc(c.id)}"><b>${esc(c.title)}</b> <span class="m small">${c.group ? 'group &middot; ' : ''}${c.stats.n} messages &middot; ${c.stats.first.slice(0, 10)} to ${c.stats.last.slice(0, 10)} &middot; ${c.mode === 'full' ? 'full text' : 'summary only'}</span></a>`).join('')}</div>` : '<p class="m">No chats yet. Import one below.</p>';
  return `${head}${wa.filing ? waReview(wa.filing) : ''}<div class="paper" style="padding:18px 22px;margin-bottom:14px"><div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:44px"><b>Your chats</b><button class="btn" data-act="wa-lock">Lock WhatsApp space</button></div>
<form data-form="wasearch" class="search" style="max-width:none;margin:8px 0"><input type="search" name="q" placeholder="Search your chats" aria-label="Search your chats" enterkeyhint="search"></form><div id="wares" aria-live="polite"></div>${list}</div>
<div class="paper" style="padding:18px 22px"><div class="field"><label for="waimp"><b>Import a WhatsApp export</b></label><input id="waimp" type="file" accept=".zip,.txt,text/plain,application/zip" multiple data-act="wa-import"></div>
<p class="m small"><b>In WhatsApp:</b> open the chat, tap the name at the top, choose Export Chat, then Without Media, then Save to Files. Then pick the file here. Nothing is stored before you confirm.</p><p class="m small">Only import chats when the other people would be fine with it. Group chats are excluded unless you tick them.</p>${wa.last ? `<div class="okmsg">${wa.last.map((d) => `${esc(d.title)}: ${d.added} message${d.added === 1 ? '' : 's'} added`).join('; ')}.</div>` : ''}<div id="wimsg" aria-live="polite"></div></div>`;
}
function waReview(fl) {
  const n = fl.filter((x) => x.sel).length;
  return `<div class="paper" style="padding:18px 22px;margin-bottom:14px" id="wafiling"><h2 style="margin-top:0">Review before importing</h2><p class="m small">Nothing has been stored yet. Summary only keeps counts, frequent words and up to 10 flagged lines (decisions, dates, open questions), each cut at 140 characters. Keep full text stores every message, encrypted.</p>
${fl.map((it, i) => `<div class="res"><div class="tt"><label class="chk" style="min-height:44px"><input type="checkbox" data-act="wasel" data-i="${i}" ${it.sel ? 'checked' : ''} ${it.status === 'blocked' ? 'disabled' : ''} aria-label="Import ${esc(it.name)}"> <b>${esc(it.title || it.name)}</b></label><span class="conf ${it.status === 'new' || it.status === 'append' ? 'high' : 'low'}">${WAS[it.status]}</span></div>
${it.status === 'blocked' ? `<div class="err">${esc(it.message)}</div>` : `<div class="m small">${it.n} messages${it.status === 'append' ? ` (${it.newCount} new)` : ''} &middot; ${it.first.slice(0, 10)} to ${it.last.slice(0, 10)} &middot; with ${esc(it.senders.join(', '))}</div>${it.message ? `<div class="m small">${esc(it.message)}</div>` : ''}
<div class="field"><label for="wm${i}">What to keep</label><select id="wm${i}" data-act="wamode" data-i="${i}" ${it.status === 'append' ? 'disabled' : ''}><option value="summary" ${it.mode === 'summary' ? 'selected' : ''}>Summary only</option><option value="full" ${it.mode === 'full' ? 'selected' : ''}>Keep full text</option></select></div>
${it.ambiguous ? `<div class="field"><label for="wo${i}">Date order (could not be told from the file)</label><select id="wo${i}" data-act="waorder" data-i="${i}">${Object.entries(ORDERS).map(([k, v]) => `<option value="${k}" ${it.order === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div class="m small">First message would be dated ${esc(it.first.slice(0, 10))}.</div>` : ''}`}</div>`).join('')}
<div class="tool"><button class="btn pri" data-act="wa-go" ${n ? '' : 'disabled'}>Import selected (${n})</button><button class="btn" data-act="wa-cancel">Cancel</button></div></div>`;
}
export function waChat(id) {
  const c = wa.chats.find((x) => x.id === id); if (!wa.master || !c) return waPage();
  const msgs = c.stats.messages ? c.stats.messages.filter((m) => m.kind === 'msg') : null;
  const shown = msgs ? msgs.slice(-wa.win) : [];
  return `<h1 class="pt">${esc(c.title)}</h1><p><a href="#/whatsapp">Back to the WhatsApp space</a></p><div class="tool"><button class="btn pri" data-act="wa-ask" data-id="${esc(id)}">Ask AI about this chat</button><button class="btn danger" data-act="wa-del-ask" data-id="${esc(id)}">Delete this chat</button></div>
<div class="box" style="margin-bottom:14px"><div class="h">Summary</div><div class="c"><pre class="review" style="white-space:pre-wrap;font-family:inherit">${esc(summaryText(c.stats, c.title, c.group))}</pre></div></div>
${msgs ? `<div class="box"><div class="h">Messages (${msgs.length})</div><div class="c"><div class="field"><label for="wf">Filter messages</label><input id="wf" type="search" data-act="wafilter" data-id="${esc(id)}" autocomplete="off"></div>${msgs.length > shown.length ? `<button class="btn" data-act="wa-more" data-id="${esc(id)}">Show earlier messages</button>` : ''}<div id="wamsgs">${waMsgs(shown, '')}</div></div></div>` : '<p class="m">Only the summary is kept for this chat.</p>'}`;
}
export function waMsgs(list, f) {
  const n = f.trim().toLowerCase(); const l = n ? list.filter((m) => m.text.toLowerCase().includes(n)) : list;
  return l.map((m) => `<div class="res" style="padding:8px 12px"><div class="m small mono">${esc(stamp(m.t))} &middot; ${esc(m.from)}</div><div style="white-space:pre-wrap">${esc(m.text)}</div></div>`).join('') || '<p class="m">No messages match.</p>';
}

// ---------- Deadlines ----------
export function dueView(today = localToday(), horizon = 7) {
  const r = dueList(st.idx.notes, today, horizon); const nHor = [7, 14, 30, 90];
  const row = (x) => `<div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:48px;flex-wrap:wrap"><span><a href="${href(x.path)}"><b>${esc(x.title)}</b></a> <span class="m small">${x.kind === 'recurring' ? esc(RHYTHM_LABEL[x.rhythm]) : 'one-time deadline'}${x.last ? ` &middot; last done ${esc(x.last)}` : ''}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="${x.days < 0 ? 'err' : 'm'}" style="${x.days < 0 ? 'padding:2px 8px;border-radius:8px' : ''}"><span class="mono">${esc(x.next)}</span> &middot; ${esc(rel(x.days))}</span>${x.kind === 'recurring' ? `<button class="btn sm" data-act="due-done" data-p="${esc(x.path)}" data-t="${esc(today)}" aria-label="Mark ${esc(x.title)} done today">Mark done</button>` : ''}</span></div>`;
  const sec = (title, list, empty) => `<div class="box" style="margin-bottom:14px"><div class="h${title === 'Overdue' && list.length ? ' warn' : ''}">${title} (${list.length})</div><div class="c list">${list.length ? list.map(row).join('') : `<div class="row m">${empty}</div>`}</div></div>`;
  return `<h1 class="pt">Deadlines</h1><p class="m">Today is <span class="mono">${esc(today)}</span>. Recurring obligations are notes with <span class="mono">type: verpflichtung</span>, a <span class="mono">rhythmus</span> (daily, weekly, monthly, yearly) and a <span class="mono">start</span> date. One-time deadlines use a <span class="mono">frist</span> date in any note. Mark done sets <span class="mono">zuletzt</span> in the note; the old text stays in History.</p>
<div class="tool" role="group" aria-label="Look ahead">${nHor.map((h) => `<a class="btn ${h === horizon ? 'pri' : ''}" href="#/due?h=${h}${today === localToday() ? '' : `&today=${esc(today)}`}" aria-current="${h === horizon}">${h} days</a>`).join('')}</div>
${sec('Overdue', r.overdue, 'Nothing is overdue.')}${sec(`Due in the next ${horizon} days`, r.soon, 'Nothing is due in this period.')}${sec('Later', r.later, 'Nothing further ahead.')}
${r.problems.length ? `<div class="box"><div class="h warn">Needs attention (${r.problems.length})</div><div class="c list">${r.problems.map((p) => `<div class="row" style="min-height:48px;flex-wrap:wrap"><a href="${href(p.path)}"><b>${esc(p.title)}</b></a><span class="m small">${esc(p.reason)}</span></div>`).join('')}</div></div>` : ''}
<p class="m small">Create an obligation with New note and the template Obligation (recurring).</p>`;
}

// ---------- Weekly and monthly review ----------
export function reviewView(period = 'week', end = localToday()) {
  const r = reviewData(st.idx.notes, util.tsOf, period, end, st.idx.contradictions.length); const q = (p, e) => `#/review?p=${p}${e === localToday() ? '' : `&end=${esc(e)}`}`;
  const items = (arr) => arr.length ? arr.slice(0, 100).map((n) => `<div class="row"><a href="${href(n.path)}">${esc(n.title)}</a><span class="m small">${esc(TYPE_NAMES[n.type] || n.type || 'Note')}</span></div>`).join('') : '<div class="row m">None</div>';
  const box = (title, count, inner, warn) => `<div class="box" style="margin-bottom:14px"><div class="h${warn ? ' warn' : ''}">${title} (${count})</div><div class="c list">${inner}</div></div>`;
  const tasks = r.tasks.length ? r.tasks.slice(0, 50).map((t) => `<div class="row" style="min-height:48px;flex-wrap:wrap"><span>${esc(t.task)}</span><a href="${href(t.path)}" class="m small">${esc(t.title)}</a></div>`).join('') : '<div class="row m">None</div>';
  const dues = [...r.due.overdue, ...r.due.soon]; const dl = dues.length ? dues.map((x) => `<div class="row" style="min-height:48px;flex-wrap:wrap"><a href="${href(x.path)}">${esc(x.title)}</a><span class="${x.days < 0 ? 'err' : 'm'}"><span class="mono">${esc(x.next)}</span> &middot; ${esc(rel(x.days))}</span></div>`).join('') : '<div class="row m">Nothing overdue or due in the next 7 days.</div>';
  const prev = addDaysIso(end, period === 'month' ? -30 : -7); const next = addDaysIso(end, period === 'month' ? 30 : 7);
  const all = r.fresh.length + r.changed.length;
  return `<h1 class="pt">${period === 'month' ? 'Monthly' : 'Weekly'} review</h1><p class="m"><span class="mono">${esc(r.start)}</span> to <span class="mono">${esc(r.end)}</span>. New and changed notes, decisions, open tasks and deadlines from your own notes.</p>
<div class="tool" role="group" aria-label="Period"><a class="btn ${period === 'week' ? 'pri' : ''}" href="${q('week', end)}">Week</a><a class="btn ${period === 'month' ? 'pri' : ''}" href="${q('month', end)}">Month</a><a class="btn" href="${q(period, prev)}">Earlier</a>${end < localToday() ? `<a class="btn" href="${q(period, next > localToday() ? localToday() : next)}">Later</a>` : ''}</div>
<div class="tool"><button class="btn pri" data-act="review-save" data-p="${period}" data-e="${esc(end)}">Save as report note</button><button class="btn" data-act="review-ask" data-p="${period}" data-e="${esc(end)}" ${all ? '' : 'disabled'}>Ask AI about these notes</button></div>
${box('New', r.fresh.length, items(r.fresh))}${box('Changed', r.changed.length, items(r.changed))}${box('Decisions', r.decisions.length, items(r.decisions))}${box('Documents filed', r.documents.length, items(r.documents))}${box('Open tasks', r.tasks.length, tasks)}${box('Overdue and due soon', dues.length, dl, r.due.overdue.length > 0)}
<div class="box"><div class="h">Contradictions</div><div class="c"><p>${r.contradictions} note${r.contradictions === 1 ? ' is' : 's are'} marked as contradicting another note. <a href="#/health">Open the health check</a>.</p></div></div>
<div class="box" style="margin-top:14px"><div class="h">Thinking loop</div><div class="c"><p>Observe, listen, connect, create, grow. What stands out this period? What does it say? What is it connected to? What comes out of it? What did I learn?</p></div></div>`;
}

// ---------- Kanban ----------
export function kanbanView() {
  const b = board(st.idx.notes); const total = COLUMNS.concat('other').reduce((s, c) => s + b[c].length, 0);
  const card = (n, col) => `<div class="row" style="display:block;padding:10px 0;border-bottom:1px solid var(--line)"><a href="${href(n.path)}"><b>${esc(n.title)}</b></a>${col === 'other' ? ` <span class="badge" style="margin:0">${esc(String(n.fm.status))}</span>` : ''}
<div class="tool" style="margin:6px 0 0" role="group" aria-label="Move ${esc(n.title)}">${COLUMNS.filter((c) => c !== col).map((c) => `<button class="btn" data-act="kb-move" data-p="${esc(n.path)}" data-c="${c}">${COLUMN_LABEL[c]}</button>`).join('')}</div></div>`;
  const colHtml = (c) => `<section class="box" style="margin-bottom:14px" aria-label="${COLUMN_LABEL[c]}"><div class="h">${COLUMN_LABEL[c]} (${b[c].length})</div><div class="c">${b[c].map((n) => card(n, c)).join('') || '<div class="row m">Nothing here.</div>'}</div></section>`;
  return `<h1 class="pt">Kanban board</h1><p class="m">Every note with a <span class="mono">status</span> line is a card. Tap a column name on a card to move it. The note's status line is changed, nothing else.</p>
${total ? '' : '<p class="m">No note has a status yet. Add a line like <span class="mono">status: open</span> to a note.</p>'}
<div class="kb">${COLUMNS.map(colHtml).join('')}${b.other.length ? colHtml('other') : ''}</div>`;
}
