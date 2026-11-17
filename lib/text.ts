// متن ساده قدیمی -> HTML برای ادیتور
export function toHtml(s: string): string {
  if (!s) return "";
  if (/^\s*<(p|h[1-6]|ul|ol|blockquote|pre)[\s>]/i.test(s)) return s;
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("");
}

// HTML -> متن ساده برای جستجو و پیش‌نمایش
export function toPlain(s: string): string {
  return s
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}