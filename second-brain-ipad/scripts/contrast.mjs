// WCAG contrast check for colour tokens in both themes.
import { readFileSync } from 'node:fs';
const css = readFileSync('public/styles.css', 'utf8');
const block = (re) => { const m = re.exec(css); const o = {}; for (const [, k, v] of m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})/g)) o[k] = v; return o; };
const light = block(/:root\{(--bg[^}]*)\}/), dark = { ...light, ...block(/:root\[data-theme=dark\]\{([^}]*)\}/) };
const auto = block(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme=light\]\):not\(\[data-theme=dark\]\)\{([^}]*)\}/);
const lum = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const TEXT = [['text', 'bg'], ['text', 'card'], ['mut', 'bg'], ['mut', 'card'], ['link', 'bg'], ['link', 'card'], ['link', 'head'], ['link', 'info'], ['red', 'card'], ['red', 'bg'], ['red', 'info'], ['warnt', 'warn'], ['okt', 'ok'], ['ambert', 'amber'], ['accentt', 'accent'], ['text', 'head'], ['text', 'info'], ['text', 'warn'], ['mut', 'info']];
const NONTEXT = ['n-project', 'n-decision', 'n-lesson', 'n-other', 'n-missing'].map((n) => [n, 'card']);
let bad = 0; const check = (name, T) => { for (const [f, b] of TEXT) { const r = ratio(T[f], T[b]); if (r < 4.5) { console.error(`${name}: ${f} on ${b} = ${r.toFixed(2)} (< 4.5)`); bad++; } } for (const [f, b] of NONTEXT) { const r = ratio(T[f], T[b]); if (r < 3) { console.error(`${name}: ${f} on ${b} = ${r.toFixed(2)} (< 3)`); bad++; } } };
check('light', light); check('dark', dark); check('auto-dark', { ...light, ...auto });
if (bad) process.exit(1); console.log('contrast ok (light, dark, auto-dark)');
