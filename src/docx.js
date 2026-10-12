// Minimal Word (.docx) writer: headings, paragraphs, bullets. No dependencies except fflate.
import { zipSync, strToU8 } from 'fflate';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function para(text, style) {
  const rpr = style === 'h1' ? '<w:rPr><w:b/><w:sz w:val="40"/></w:rPr>' : style === 'h2' ? '<w:rPr><w:b/><w:sz w:val="30"/></w:rPr>' : style === 'h3' ? '<w:rPr><w:b/><w:sz w:val="26"/></w:rPr>' : '';
  const ind = style === 'li' ? '<w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>' : '';
  return `<w:p>${ind}<w:r>${rpr}<w:t xml:space="preserve">${esc(style === 'li' ? '• ' + text : text)}</w:t></w:r></w:p>`;
}
export function markdownToDocx(md) {
  const ps = md.split('\n').filter((l) => l.trim() !== '').map((l) => {
    let m; l = l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
    if ((m = /^###\s+(.*)/.exec(l))) return para(m[1], 'h3');
    if ((m = /^##\s+(.*)/.exec(l))) return para(m[1], 'h2');
    if ((m = /^#\s+(.*)/.exec(l))) return para(m[1], 'h1');
    if ((m = /^\s*[-*]\s+(.*)/.exec(l))) return para(m[1], 'li');
    return para(l, 'p');
  });
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${ps.join('')}</w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(doc),
  });
}
