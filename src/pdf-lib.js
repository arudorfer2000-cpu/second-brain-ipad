// Loaded on demand (script tag) the first time a PDF is added. Reads text only, never opens protected files.
import * as pdfjs from 'pdfjs-dist/build/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.js', document.baseURI).href;
window.SBPDF = {
  async extract(bytes) {
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: false }).promise;
    try {
      const out = []; const n = Math.min(doc.numPages, 300);
      for (let i = 1; i <= n; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); out.push(c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n').trim()); p.cleanup(); }
      let title = ''; try { const m = await doc.getMetadata(); title = (m.info && m.info.Title) || ''; } catch { /* no metadata */ }
      return { text: out.join('\n\n'), title, pages: doc.numPages };
    } finally { await doc.destroy(); }
  },
};
