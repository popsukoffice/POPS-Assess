/* POPS Assess: export the on-screen report as a real PDF (text, not a picture) and a real Word (.docx) file.
   (c) 2026 Positive Outcomes Psychology Services Ltd (POPS UK).
   The report DOM is converted once to simple blocks (heading, paragraph, list, table, image); the blocks feed pdfmake and docx.
   Both libraries are self-hosted in /vendor and loaded only when a button is pressed. Nothing leaves the browser. */
(function (root) {
  "use strict";
  const NAVY = "#16305a", TEAL = "#0e6f66", GREY = "#2b4057", LINE = "#9fb2c3", HEAD = "#e3edf7";
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return loaded[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });
  }

  /* ---------- DOM to blocks ---------- */
  const BLOCK = new Set(["P", "H1", "H2", "H3", "H4", "UL", "OL", "TABLE", "DIV", "SECTION", "LI"]);
  function runs(node, st, out) {
    out = out || []; st = st || {};
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, " "); if (t) out.push({ text: t, bold: !!st.bold, italics: !!st.italics }); }
      else if (n.nodeType === 1) {
        const tg = n.tagName;
        if (tg === "BR") out.push({ text: "\n", bold: false, italics: false });
        else if (tg === "STYLE" || tg === "SCRIPT" || tg === "IMG") return;
        else runs(n, { bold: st.bold || tg === "STRONG" || tg === "B" || tg === "TH", italics: st.italics || tg === "EM" || tg === "I" }, out);
      }
    });
    return out;
  }
  function trim(rs) {
    const o = rs.filter(r => r.text !== "").map(r => ({ ...r }));
    while (o.length && /^\s*$/.test(o[0].text) && o[0].text !== "\n") o.shift();
    if (o.length) o[0].text = o[0].text.replace(/^\s+/, "");
    while (o.length && /^\s*$/.test(o[o.length - 1].text)) o.pop();
    if (o.length) o[o.length - 1].text = o[o.length - 1].text.replace(/\s+$/, "");
    return o;
  }
  const plain = rs => rs.map(r => r.text).join("");
  function blocks(rootEl) {
    const out = [];
    function walk(el) {
      let pending = [];
      const flush = (cls) => { const r = trim(pending); if (r.length) out.push({ t: "p", runs: r, cls: cls || "" }); pending = []; };
      el.childNodes.forEach(n => {
        if (n.nodeType === 3) { pending.push({ text: n.nodeValue.replace(/\s+/g, " "), bold: false, italics: false }); return; }
        if (n.nodeType !== 1) return;
        const tg = n.tagName;
        if (tg === "STYLE" || tg === "SCRIPT") return;
        if (tg === "IMG") { flush(); out.push({ t: "img", src: n.getAttribute("src"), w: n.naturalWidth || 170, h: n.naturalHeight || 100, width: parseInt(n.getAttribute("width") || n.style.width) || null }); return; }
        if (!BLOCK.has(tg)) { pending.push(...runs({ childNodes: [n] })); return; }
        flush();
        if (/^H[1-4]$/.test(tg)) { const r = trim(runs(n)); if (r.length) out.push({ t: "h", l: Math.min(3, +tg[1]), runs: r }); }
        else if (tg === "P") {
          const im = n.querySelector("img");
          if (im && !plain(trim(runs(n))).trim()) { out.push({ t: "img", src: im.getAttribute("src"), w: im.naturalWidth || 170, h: im.naturalHeight || 100, width: parseInt(im.getAttribute("width") || im.style.width) || null }); }
          else { const r = trim(runs(n)); if (r.length) out.push({ t: "p", runs: r, cls: n.className || "" }); }
        }
        else if (tg === "UL" || tg === "OL") { const items = [...n.children].filter(c => c.tagName === "LI").map(li => trim(runs(li))).filter(r => r.length); if (items.length) out.push({ t: "ul", items, ordered: tg === "OL" }); }
        else if (tg === "TABLE") {
          const rows = [...n.querySelectorAll("tr")].map(tr => [...tr.children].map(c => ({ runs: trim(runs(c)), head: c.tagName === "TH" })));
          if (rows.length) out.push({ t: "table", rows });
        }
        else if (tg === "LI") { const r = trim(runs(n)); if (r.length) out.push({ t: "ul", items: [r] }); }
        else { // DIV / SECTION: a block of its own. Keep its class (for example the footer) when it has only inline content.
          const hasBlock = [...n.children].some(c => BLOCK.has(c.tagName) || c.tagName === "IMG");
          if (hasBlock) walk(n); else { const r = trim(runs(n)); if (r.length) out.push({ t: "p", runs: r, cls: n.className || "" }); }
        }
      });
      flush();
    }
    walk(rootEl);
    return out;
  }
  function colWeights(rows) {
    const n = Math.max(...rows.map(r => r.length)), w = Array(n).fill(0);
    rows.forEach(r => r.forEach((c, i) => { const len = Math.min(60, plain(c.runs).length); w[i] = Math.max(w[i], len); }));
    const tot = w.reduce((a, b) => a + b, 0) || 1; let p = w.map(x => Math.max(0.1, x / tot)); const s = p.reduce((a, b) => a + b, 0); return p.map(x => x / s);
  }

  /* ---------- PDF (pdfmake) ---------- */
  function pdfRuns(rs, base) { return rs.map(r => ({ text: r.text, bold: r.bold || undefined, italics: r.italics || undefined, ...(base || {}) })); }
  function pdfDef(bl, meta) {
    const content = [];
    bl.forEach(b => {
      if (b.t === "img") { const w = Math.min(b.width || 130, 150); content.push({ image: b.src, width: w, margin: [0, 0, 0, 8] }); }
      else if (b.t === "h") {
        if (b.l === 1) content.push({ text: pdfRuns(b.runs), fontSize: 20, bold: true, color: NAVY, margin: [0, 0, 0, 2], headlineLevel: 1 });
        else if (b.l === 2) { content.push({ text: pdfRuns(b.runs), fontSize: 14, bold: true, color: TEAL, margin: [0, 14, 0, 2], headlineLevel: 2 }); content.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: TEAL }], margin: [0, 0, 0, 5] }); }
        else content.push({ text: pdfRuns(b.runs), fontSize: 11.5, bold: true, color: NAVY, margin: [0, 8, 0, 3], headlineLevel: 3 });
      }
      else if (b.t === "p") {
        const c = (b.cls || "").split(/\s+/);
        if (c.includes("sub")) content.push({ text: pdfRuns(b.runs), bold: true, color: TEAL, margin: [0, 0, 0, 8] });
        else if (c.includes("note")) content.push({ text: pdfRuns(b.runs), fontSize: 9, color: GREY, margin: [0, 2, 0, 6] });
        else if (c.includes("ft")) content.push({ text: pdfRuns(b.runs), fontSize: 8, color: GREY, margin: [0, 16, 0, 0] });
        else content.push({ text: pdfRuns(b.runs), margin: [0, 0, 0, 6] });
      }
      else if (b.t === "ul") content.push({ ul: b.items.map(r => ({ text: pdfRuns(r) })), margin: [8, 2, 0, 6] });
      else if (b.t === "table") {
        const wts = colWeights(b.rows), ncol = wts.length;
        const body = b.rows.map(r => { const row = r.map(c => ({ text: c.runs.length ? pdfRuns(c.runs) : " ", bold: c.head || undefined, fontSize: 9, fillColor: c.head ? HEAD : undefined })); while (row.length < ncol) row.push({ text: " " }); return row; });
        content.push({ table: { headerRows: b.rows[0] && b.rows[0].every(c => c.head) ? 1 : 0, widths: wts.map(x => (x * 100).toFixed(1) + "%"), body, dontBreakRows: true }, layout: { hLineColor: () => LINE, vLineColor: () => LINE, hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 }, margin: [0, 4, 0, 8] });
      }
    });
    return {
      pageSize: "A4", pageMargins: [40, 40, 40, 50], info: { title: meta.title, author: meta.author || "", subject: "Informal assessment report", creator: "POPS Assess" },
      defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25, color: "#10203a" },
      content,
      footer: (cur, total) => ({ columns: [{ text: "POPS Assess™ © " + new Date().getFullYear() + " POPS UK. Informal assessment, not a standardised test.", fontSize: 7.5, color: GREY }, { text: "Page " + cur + " of " + total, alignment: "right", fontSize: 7.5, color: GREY }], margin: [40, 18, 40, 0] }),
      pageBreakBefore: (node, following) => !!node.headlineLevel && following.length === 0
    };
  }
  async function makePdf(rootEl, meta) {
    await loadScript("vendor/pdfmake.min.js"); await loadScript("vendor/vfs_fonts.js");
    const def = pdfDef(blocks(rootEl), meta);
    return new Promise((res, rej) => { try { root.pdfMake.createPdf(def).getBlob(res); } catch (e) { rej(e); } });
  }

  /* ---------- Word (docx) ---------- */
  function b64bytes(src) { const m = /^data:[^;]+;base64,(.*)$/.exec(src || ""); if (!m) return null; const bin = atob(m[1]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  async function makeDocx(rootEl, meta) {
    await loadScript("vendor/docx.umd.js");
    const D = root.docx, bl = blocks(rootEl), PAGE_W = 9638;
    const tr = (rs, extra) => rs.map(r => r.text === "\n" ? new D.TextRun({ break: 1 }) : new D.TextRun({ text: r.text, bold: r.bold || (extra && extra.bold), italics: r.italics, size: extra && extra.size, color: extra && extra.color, font: "Arial" }));
    const kids = [];
    bl.forEach(b => {
      if (b.t === "img") {
        const data = b64bytes(b.src); if (!data) return; const w = Math.min(b.width || 130, 160), h = Math.round(w * (b.h / b.w));
        kids.push(new D.Paragraph({ spacing: { after: 120 }, children: [new D.ImageRun({ data, transformation: { width: w, height: h }, type: "png" })] }));
      }
      else if (b.t === "h") {
        if (b.l === 1) kids.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, spacing: { after: 40 }, children: tr(b.runs, { bold: true, size: 40, color: "16305A" }) }));
        else if (b.l === 2) kids.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 280, after: 100 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: "0E6F66", space: 2 } }, children: tr(b.runs, { bold: true, size: 28, color: "0E6F66" }) }));
        else kids.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 160, after: 60 }, children: tr(b.runs, { bold: true, size: 23, color: "16305A" }) }));
      }
      else if (b.t === "p") {
        const c = (b.cls || "").split(/\s+/);
        if (c.includes("sub")) kids.push(new D.Paragraph({ spacing: { after: 160 }, children: tr(b.runs, { bold: true, color: "0E6F66" }) }));
        else if (c.includes("note")) kids.push(new D.Paragraph({ spacing: { before: 40, after: 120 }, children: tr(b.runs, { size: 19, color: "2B4057" }) }));
        else if (c.includes("ft")) kids.push(new D.Paragraph({ spacing: { before: 320 }, border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: LINE.slice(1), space: 4 } }, children: tr(b.runs, { size: 16, color: "2B4057" }) }));
        else kids.push(new D.Paragraph({ spacing: { after: 120 }, children: tr(b.runs) }));
      }
      else if (b.t === "ul") b.items.forEach(r => kids.push(new D.Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 60 }, children: tr(r) })));
      else if (b.t === "table") {
        const wts = colWeights(b.rows), ncol = wts.length, widths = wts.map(x => Math.round(x * PAGE_W));
        const bd = { style: D.BorderStyle.SINGLE, size: 4, color: LINE.slice(1) }, borders = { top: bd, bottom: bd, left: bd, right: bd };
        const rows = b.rows.map(r => { const cells = r.map((c, i) => new D.TableCell({ width: { size: widths[i], type: D.WidthType.DXA }, borders, margins: { top: 50, bottom: 50, left: 80, right: 80 }, shading: c.head ? { type: D.ShadingType.CLEAR, fill: HEAD.slice(1), color: "auto" } : undefined, children: [new D.Paragraph({ children: tr(c.runs.length ? c.runs : [{ text: " " }], { bold: c.head, size: 19 }) })] }));
          while (cells.length < ncol) cells.push(new D.TableCell({ width: { size: widths[cells.length], type: D.WidthType.DXA }, borders, children: [new D.Paragraph("")] }));
          return new D.TableRow({ cantSplit: true, tableHeader: r.every(c => c.head), children: cells }); });
        kids.push(new D.Table({ width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: widths, rows }), new D.Paragraph({ spacing: { after: 100 }, children: [] }));
      }
    });
    const doc = new D.Document({
      creator: meta.author || "POPS Assess", title: meta.title, description: "Informal assessment report",
      styles: { default: { document: { run: { font: "Arial", size: 21, color: "10203A" } } } },
      numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: D.LevelFormat.BULLET, text: "•", alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1134, bottom: 1000, left: 1134 } } },
        footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: "POPS Assess™ © " + new Date().getFullYear() + " Positive Outcomes Psychology Services Ltd.   Page ", size: 15, color: "2B4057", font: "Arial" }), new D.TextRun({ children: [D.PageNumber.CURRENT], size: 15, color: "2B4057", font: "Arial" }), new D.TextRun({ text: " of ", size: 15, color: "2B4057", font: "Arial" }), new D.TextRun({ children: [D.PageNumber.TOTAL_PAGES], size: 15, color: "2B4057", font: "Arial" })] })] }) },
        children: kids
      }]
    });
    return D.Packer.toBlob(doc);
  }

  root.POPSEXPORT = { blocks, makePdf, makeDocx };
})(typeof window !== "undefined" ? window : globalThis);
