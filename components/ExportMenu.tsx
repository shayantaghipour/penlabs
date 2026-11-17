"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { copyForNotes, exportDocx, exportPdf, exportTxt } from "@/lib/export";
import type { Note } from "@/lib/types";

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide"
      style={{
        color: "#fff",
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.4), 0 4px 12px ${color}55`,
      }}
    >
      {children}
    </span>
  );
}

const NoteIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 12h7M9 16h5" />
  </svg>
);

type Item = {
  key: string;
  name: string;
  hint: string;
  badge: ReactNode;
  run: (note: Note) => void | Promise<void | boolean>;
};

const ITEMS: Item[] = [
  { key: "txt", name: "Text file", hint: ".txt · simple readme", badge: <Badge color="#64748b">TXT</Badge>, run: exportTxt },
  { key: "pdf", name: "PDF document", hint: ".pdf · choose “Save as PDF”", badge: <Badge color="#ef4444">PDF</Badge>, run: exportPdf },
  { key: "docx", name: "Word document", hint: ".docx", badge: <Badge color="#3b82f6">DOC</Badge>, run: exportDocx },
  { key: "notes", name: "Notes apps", hint: "Samsung Notes · Apple Notes (copy)", badge: <Badge color="#f59e0b">{NoteIcon}</Badge>, run: copyForNotes },
];

const MENU_WIDTH = 320;

export default function ExportMenu({ note }: { note: Note }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function toggle() {
    if (open) return setPos(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(12, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12));
    setPos({ top: r.bottom + 10, left });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2200);
  }

  async function run(item: Item) {
    setPos(null);
    try {
      const result = await item.run(note);
      if (item.key === "notes") flash(result ? "Copied ✓ Paste it in your notes app" : "Copy failed");
    } catch (e) {
      console.error("Export failed:", e);
      flash("Export failed");
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="pill px-3 py-1 text-xs text-white/60 hover:bg-white/15"
      >
        {msg ?? "Export ▾"}
      </button>

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            className="menu-glass"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH, zIndex: 1000 }}
          >
            <p className="px-3 pb-1 pt-2 text-xs uppercase tracking-wider text-white/45">Save as</p>
            {ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => run(item)}
                className="glass-item flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white/90">{item.name}</span>
                  <span className="block truncate text-xs text-white/50">{item.hint}</span>
                </span>
                {item.badge}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}