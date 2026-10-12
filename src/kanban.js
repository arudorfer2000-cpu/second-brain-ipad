// Kanban board over the `status` frontmatter key. Pure functions, no storage.
export const COLUMNS = ['open', 'doing', 'done'];
export const COLUMN_LABEL = { open: 'Open', doing: 'In progress', done: 'Done', other: 'Other status' };
const VALUE = { open: 'open', doing: 'in progress', done: 'done' };
// language-data:begin
const WORDS = {
  open: ['open', 'todo', 'to do', 'idea', 'planning', 'planned', 'proposed', 'backlog', 'new', 'offen', 'geplant'],
  doing: ['doing', 'in progress', 'active', 'started', 'wip', 'ongoing', 'in arbeit', 'laufend'],
  done: ['done', 'closed', 'completed', 'finished', 'resolved', 'erledigt', 'abgeschlossen'],
};
// language-data:end
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
export function columnOf(status) {
  const s = norm(status);
  for (const c of COLUMNS) if (WORDS[c].includes(s)) return c;
  return 'other';
}
export function statusValue(col) { if (!VALUE[col]) throw new Error('No status value for column ' + col); return VALUE[col]; }
export function board(notes) {
  const b = { open: [], doing: [], done: [], other: [] };
  for (const n of notes) {
    if (n.trashed) continue; const s = n.fm && n.fm.status; if (!norm(s)) continue;
    b[columnOf(s)].push(n);
  }
  for (const k of Object.keys(b)) b[k].sort((x, y) => x.title.localeCompare(y.title));
  return b;
}
