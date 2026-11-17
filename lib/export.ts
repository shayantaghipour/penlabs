import type { Paragraph as DocxParagraph, TextRun as DocxTextRun } from "docx";
import { toHtml } from "@/lib/text";

type ExportNote = { title: string; content: string };

// حروف فارسی/عربی/عبری برای تشخیص جهت متن
const RTL_CHARS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeName(title: string) {
  return (title.trim() || "Untitled").replace(/[\\/:*?"<>|]/g, "-");
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parse(html: string) {
  return new DOMParser().parseFromString(html, "text/html").body;
}

/* ====================== TXT ====================== */

function listToText(el: Element, depth: number): string {
  const ordered = el.tagName === "OL";
  let n = 1;
  let out = "";

  for (const li of Array.from(el.children)) {
    const isTask = li.getAttribute("data-type") === "taskItem";
    const container: Element = isTask ? (li.querySelector(":scope > div") ?? li) : li;

    let text = "";
    let nested = "";
    for (const child of Array.from(container.childNodes)) {
      if (child instanceof Element && (child.tagName === "UL" || child.tagName === "OL")) {
        nested += listToText(child, depth + 1);
      } else {
        text += child.textContent ?? "";
      }
    }

    const marker = isTask
      ? li.getAttribute("data-checked") === "true"
        ? "[x] "
        : "[ ] "
      : ordered
        ? `${n++}. `
        : "- ";

    out += `${"  ".repeat(depth)}${marker}${text.trim()}\n${nested}`;
  }
  return out;
}

function blockToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() ? `${node.textContent}\n\n` : "";
  }
  if (!(node instanceof Element)) return "";

  switch (node.tagName) {
    case "UL":
    case "OL":
      return `${listToText(node, 0)}\n`;
    case "BLOCKQUOTE": {
      const inner = Array.from(node.childNodes).map(blockToText).join("").trim();
      return inner.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n";
    }
    case "PRE":
      return `${node.textContent ?? ""}\n\n`;
    default: {
      const t = node.textContent ?? "";
      return t ? `${t}\n\n` : "";
    }
  }
}

function noteToText(note: ExportNote) {
  const title = note.title.trim() || "Untitled";
  const body = Array.from(parse(toHtml(note.content)).childNodes).map(blockToText).join("");
  return `${title}\n\n${body}`.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function exportTxt(note: ExportNote) {
  // BOM باعث می‌شه برنامه‌های قدیمی هم فارسی رو درست بخونن
  const blob = new Blob(["\uFEFF" + noteToText(note)], { type: "text/plain;charset=utf-8" });
  saveBlob(blob, `${safeName(note.title)}.txt`);
}

/* ====================== PDF (دیالوگ چاپ مرورگر) ====================== */

const PRINT_CSS = `
  @page { margin: 18mm; }
  body { font-family: Tahoma, Arial, sans-serif; font-size: 14px; line-height: 1.9; color: #111; margin: 0; }
  h1 { font-size: 26px; margin: 0 0 16px; }
  h2 { font-size: 21px; margin: 18px 0 6px; }
  p { margin: 4px 0; }
  p, h1, h2, li, blockquote { unicode-bidi: plaintext; text-align: start; }
  ul, ol { padding-inline-start: 24px; }
  ul[data-type="taskList"] { list-style: none; padding-inline-start: 0; }
  ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
  ul[data-type="taskList"] li > div { flex: 1; }
  blockquote { border-inline-start: 3px solid #8b8cff; padding-inline-start: 12px; margin: 10px 0; color: #444; }
  pre { background: #f3f3f6; border-radius: 8px; padding: 12px; direction: ltr; text-align: left; white-space: pre-wrap; }
  code { background: #f3f3f6; border-radius: 4px; padding: 0 4px; }
  pre code { background: none; padding: 0; }
`;

export function exportPdf(note: ExportNote) {
  const title = note.title.trim() || "Untitled";

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(safeName(note.title))}</title>` +
      `<style>${PRINT_CSS}</style></head><body>` +
      `<h1 dir="auto">${esc(title)}</h1>${toHtml(note.content)}</body></html>`
  );
  doc.close();

  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 60000);
  }, 300);
}

/* ====================== Word (.docx) ====================== */

export async function exportDocx(note: ExportNote) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import("docx");
  const body = parse(toHtml(note.content));

  type Style = { bold?: boolean; italics?: boolean; strike?: boolean; code?: boolean };
  const isRtl = (text: string) => RTL_CHARS.test(text);

  function runs(node: Node, style: Style, rtl: boolean): DocxTextRun[] {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) return [];
      return [
        new TextRun({
          text,
          bold: style.bold,
          italics: style.italics,
          strike: style.strike,
          font: style.code ? "Courier New" : undefined,
          rightToLeft: rtl,
        }),
      ];
    }
    if (!(node instanceof Element)) return [];
    if (node.tagName === "BR") return [new TextRun({ break: 1 })];

    const next: Style = { ...style };
    if (node.tagName === "STRONG" || node.tagName === "B") next.bold = true;
    if (node.tagName === "EM" || node.tagName === "I") next.italics = true;
    if (node.tagName === "S" || node.tagName === "DEL" || node.tagName === "STRIKE") next.strike = true;
    if (node.tagName === "CODE") next.code = true;

    return Array.from(node.childNodes).flatMap((c) => runs(c, next, rtl));
  }

  function inlineOf(el: Element) {
    const rtl = isRtl(el.textContent ?? "");
    return { rtl, children: Array.from(el.childNodes).flatMap((c) => runs(c, {}, rtl)) };
  }

  function lists(el: Element, depth: number): DocxParagraph[] {
    const ordered = el.tagName === "OL";
    let n = 1;
    const out: DocxParagraph[] = [];

    for (const li of Array.from(el.children)) {
      const isTask = li.getAttribute("data-type") === "taskItem";
      const checked = li.getAttribute("data-checked") === "true";
      const container: Element = isTask ? (li.querySelector(":scope > div") ?? li) : li;

      const textNodes: Node[] = [];
      const nested: Element[] = [];
      for (const child of Array.from(container.childNodes)) {
        if (child instanceof Element && (child.tagName === "UL" || child.tagName === "OL")) {
          nested.push(child);
        } else {
          textNodes.push(child);
        }
      }

      const rtl = isRtl(textNodes.map((t) => t.textContent ?? "").join(""));
      const children = textNodes.flatMap((t) => runs(t, {}, rtl));
      const prefix = isTask ? (checked ? "☑ " : "☐ ") : ordered ? `${n++}. ` : "";
      if (prefix) children.unshift(new TextRun({ text: prefix, rightToLeft: rtl }));

      out.push(
        new Paragraph({
          bidirectional: rtl,
          children,
          ...(prefix
            ? { indent: { left: 360 * (depth + 1) } }
            : { bullet: { level: Math.min(depth, 8) } }),
        })
      );
      for (const nl of nested) out.push(...lists(nl, depth + 1));
    }
    return out;
  }

  function blocks(node: Node, quote: boolean): DocxParagraph[] {
    if (!(node instanceof Element)) {
      const t = node.textContent?.trim();
      return t ? [new Paragraph({ children: [new TextRun(t)] })] : [];
    }

    switch (node.tagName) {
      case "H1":
      case "H2":
      case "H3": {
        const { rtl, children } = inlineOf(node);
        const heading =
          node.tagName === "H1"
            ? HeadingLevel.HEADING_1
            : node.tagName === "H2"
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3;
        return [new Paragraph({ heading, bidirectional: rtl, children })];
      }
      case "UL":
      case "OL":
        return lists(node, 0);
      case "BLOCKQUOTE":
        return Array.from(node.childNodes).flatMap((c) => blocks(c, true));
      case "PRE":
        return (node.textContent ?? "").split("\n").map(
          (line) =>
            new Paragraph({
              indent: { left: 360 },
              children: [new TextRun({ text: line, font: "Courier New", size: 20 })],
            })
        );
      default: {
        const { rtl, children } = inlineOf(node);
        return [
          new Paragraph({
            bidirectional: rtl,
            children,
            ...(quote
              ? {
                  indent: { left: 540 },
                  border: {
                    left: { style: BorderStyle.SINGLE, size: 12, color: "8B8CFF", space: 8 },
                  },
                }
              : {}),
          }),
        ];
      }
    }
  }

  const titleText = note.title.trim() || "Untitled";
  const titleRtl = isRtl(titleText);

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      bidirectional: titleRtl,
      children: [new TextRun({ text: titleText, rightToLeft: titleRtl })],
    }),
    ...Array.from(body.childNodes).flatMap((n) => blocks(n, false)),
  ];

  const document_ = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [{ children }],
  });

  saveBlob(await Packer.toBlob(document_), `${safeName(note.title)}.docx`);
}

/* ====================== کپی برای Samsung Notes / Apple Notes ====================== */

export async function copyForNotes(note: ExportNote): Promise<boolean> {
  const title = note.title.trim() || "Untitled";
  const html = `<h1>${esc(title)}</h1>${toHtml(note.content)}`;
  const text = noteToText(note);

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}