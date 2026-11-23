import type { Note, Section } from "@/lib/types";

export const GUEST_LIMIT = 5;
export const GUEST_SECTION_ID = -1;

// بخش مجازی مهمان (تو دیتابیس وجود نداره)
export const GUEST_SECTION: Section = {
  id: GUEST_SECTION_ID,
  name: "General",
  color: "#5eead4",
  position: 0,
  deleted_at: null,
};

const KEY = "penlabs-guest-v1";

function parse(raw: string | null): Note[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    const out: Note[] = [];
    for (const n of data) {
      if (!n || typeof n !== "object") continue;
      const id = Number(n.id);
      if (!Number.isFinite(id)) continue;
      out.push({
        id,
        section_id: GUEST_SECTION_ID,
        title: typeof n.title === "string" ? n.title : "",
        content: typeof n.content === "string" ? n.content : "",
        updated_at: Number(n.updated_at) || Date.now(),
        pinned: false,
        deleted_at: null,
      });
    }
    return out.sort((a, b) => b.updated_at - a.updated_at);
  } catch {
    return [];
  }
}

export function loadGuestNotes(): Note[] {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

// false یعنی مرورگر اجازه ذخیره نداد (مثلاً حالت خصوصی یا حافظه پر)
export function saveGuestNotes(notes: Note[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

// صفحه‌های مهمان رو برمی‌داره و از مرورگر پاک می‌کنه (برای انتقال به حساب)
export function takeGuestNotes(): Note[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    localStorage.removeItem(KEY);
    return parse(raw);
  } catch {
    return [];
  }
}

export function newGuestId(existing: Note[]): number {
  const used = new Set(existing.map((n) => n.id));
  let id = Date.now();
  while (used.has(id)) id++;
  return id;
}