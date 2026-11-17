import { toHtml } from "@/lib/text";

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  const inner = Array.from(node.childNodes).map(inline).join("");
  switch (node.tagName) {
    case "STRONG":
    case "B":
      return `**${inner}**`;
    case "EM":
    case "I":
      return `*${inner}*`;
    case "S":
    case "DEL":
    case "STRIKE":
      return `~~${inner}~~`;
    case "CODE":
      return `\`${inner}\``;
    case "BR":
      return "\n";
    default:
      return inner;
  }
}

function list(el: Element, depth: number): string {
  const ordered = el.tagName === "OL";
  let n = 1;
  let result = "";

  for (const li of Array.from(el.children)) {
    const isTask = li.getAttribute("data-type") === "taskItem";
    const container: Element = isTask ? li.querySelector(":scope > div") ?? li : li;

    let text = "";
    let nested = "";
    for (const child of Array.from(container.childNodes)) {
      if (child instanceof Element && (child.tagName === "UL" || child.tagName === "OL")) {
        nested += list(child, depth + 1);
      } else {
        text += inline(child);
      }
    }

    const marker = isTask
      ? `- [${li.getAttribute("data-checked") === "true" ? "x" : " "}] `
      : ordered
        ? `${n++}. `
        : "- ";

    result += `${"  ".repeat(depth)}${marker}${text.trim()}\n${nested}`;
  }
  return result;
}

function block(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() ? `${node.textContent}\n\n` : "";
  }
  if (!(node instanceof Element)) return "";

  const inner = () => Array.from(node.childNodes).map(inline).join("");

  switch (node.tagName) {
    case "H1":
      return `# ${inner()}\n\n`;
    case "H2":
      return `## ${inner()}\n\n`;
    case "H3":
      return `### ${inner()}\n\n`;
    case "P":
      return `${inner()}\n\n`;
    case "UL":
    case "OL":
      return `${list(node, 0)}\n`;
    case "PRE":
      return "```\n" + (node.textContent ?? "") + "\n```\n\n";
    case "BLOCKQUOTE": {
      const body = Array.from(node.childNodes).map(block).join("").trim();
      return body.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n";
    }
    default: {
      const t = inner();
      return t ? `${t}\n\n` : "";
    }
  }
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const md = Array.from(doc.body.childNodes).map(block).join("");
  return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function downloadMarkdown(note: { title: string; content: string }) {
  const title = note.title.trim() || "Untitled";
  const md = `# ${title}\n\n${htmlToMarkdown(toHtml(note.content))}`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}