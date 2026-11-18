"use client";

import { useState, type ReactNode, type RefObject } from "react";
import type { Note, Section } from "@/lib/types";
import { toPlain } from "@/lib/text";
import ThemeToggle from "./ThemeToggle";
import GlassTabs from "./GlassTabs";

type Props = {
  title: string;
  mode: "notes" | "trash";
  notes: Note[];
  activeId: number | null;
  searchRef: RefObject<HTMLInputElement | null>;
  // بخش‌ها (فقط زیر ۱۰۲۴px نشون داده می‌شن)
  sections: Section[];
  trashSections: Section[];
  activeSectionId: number | null;
  trashCount: number;
  onSelectSection: (id: number) => void;
  onSelectTrash: () => void;
  onCreateSection: () => void;
  onRenameSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onRestoreSection: (section: Section) => void;
  onDeleteSectionForever: (section: Section) => void;
  // صفحه‌ها
  onSelect: (id: number) => void;
  onCreate: () => void;
  onTogglePin: (note: Note) => void;
  onTrash: (note: Note) => void;
  onRestore: (note: Note) => void;
  onDeleteForever: (note: Note) => void;
  onEmptyTrash: () => void;
  account?: ReactNode;
};

export default function Sidebar({
  title,
  mode,
  notes,
  activeId,
  searchRef,
  sections,
  trashSections,
  activeSectionId,
  trashCount,
  onSelectSection,
  onSelectTrash,
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onRestoreSection,
  onDeleteSectionForever,
  onSelect,
  onCreate,
  onTogglePin,
  onTrash,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
  account,
}: Props) {
  const [q, setQ] = useState("");
  const isTrash = mode === "trash";
  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;
  const query = q.toLowerCase();

  const filtered = notes
    .filter((n) => (n.title + " " + toPlain(n.content)).toLowerCase().includes(query))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const filteredSections = isTrash
    ? trashSections.filter((s) => s.name.toLowerCase().includes(query))
    : [];

  const action = "row-action px-1.5 py-1 text-xs text-white/45";
  const chipClass =
    "flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-sm text-white/80";
  const groupLabel = "px-4 pb-1 pt-2 text-xs uppercase tracking-wider text-white/35";

  return (
    <aside className="glass flex min-h-0 w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-5 pb-3">
        <h2 dir="auto" className="min-w-0 truncate text-lg font-semibold">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            {account}
          </span>
          {isTrash ? (
            trashCount > 0 && (
              <button
                onClick={onEmptyTrash}
                className="pill px-3 py-1.5 text-xs text-rose-200 hover:bg-white/15"
              >
                Empty
              </button>
            )
          ) : (
            <button onClick={onCreate} className="btn-accent px-4 py-1.5 text-sm" title="Alt+N">
              + New
            </button>
          )}
        </div>
      </div>

      {/* بخش‌ها به‌صورت چیپ، فقط زیر ۱۰۲۴px */}
      <div className="lg:hidden">
        <GlassTabs
          orientation="horizontal"
          radius={999}
          className="no-scrollbar flex items-center gap-2 overflow-x-auto px-5 pb-3"
          activeKey={isTrash ? "trash" : activeSectionId !== null ? `s-${activeSectionId}` : null}
          onSelect={(key) =>
            key === "trash" ? onSelectTrash() : onSelectSection(Number(key.slice(2)))
          }
          tabs={[
            ...sections.map((s) => ({
              key: `s-${s.id}`,
              className: chipClass,
              content: (
                <>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
                  />
                  <span dir="auto" className="max-w-36 truncate">
                    {s.name}
                  </span>
                </>
              ),
            })),
            {
              key: "trash",
              className: chipClass,
              content: (
                <>
                  Trash
                  {trashCount > 0 && <span className="text-xs text-white/55">{trashCount}</span>}
                </>
              ),
            },
          ]}
          trailing={
            <button
              onClick={onCreateSection}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-sm text-white/80"
              aria-label="New section"
            >
              +
            </button>
          }
        />

        {!isTrash && activeSection && (
          <div className="flex gap-2 px-5 pb-3">
            <button
              onClick={() => onRenameSection(activeSection)}
              className="pill px-3 py-1 text-xs text-white/60"
            >
              Rename section
            </button>
            <button
              onClick={() => onDeleteSection(activeSection)}
              className="pill px-3 py-1 text-xs text-rose-200"
            >
              Delete section
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pb-3">
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search... (Ctrl+K)"
          dir="auto"
          className="glass-input w-full px-4 py-2 text-sm placeholder:text-white/40"
        />
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 && filteredSections.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-white/40">
            {isTrash ? "Trash is empty" : "No pages"}
          </li>
        )}

        {/* بخش‌های حذف‌شده (فقط تو Trash) */}
        {filteredSections.length > 0 && <li className={groupLabel}>Sections</li>}
        {filteredSections.map((s) => (
          <li
            key={`sec-${s.id}`}
            className="glass-item group flex items-center justify-between gap-2 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
              />
              <span dir="auto" className="truncate text-sm font-medium">
                {s.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center">
              <button
                onClick={() => onRestoreSection(s)}
                className={`${action} hover:text-[var(--mint)]`}
              >
                Restore
              </button>
              <button
                onClick={() => onDeleteSectionForever(s)}
                className={`${action} hover:text-rose-300`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}

        {filteredSections.length > 0 && filtered.length > 0 && <li className={groupLabel}>Pages</li>}

        {filtered.map((n) => (
          <li
            key={n.id}
            data-active={!isTrash && n.id === activeId}
            onClick={() => !isTrash && onSelect(n.id)}
            className="glass-item group flex cursor-pointer items-start justify-between gap-2 px-4 py-3"
          >
            <div className="min-w-0">
              <p dir="auto" className="flex items-center gap-1.5 truncate text-sm font-medium">
                {n.pinned && !isTrash && <span className="text-xs">📌</span>}
                <span className="truncate">{n.title || "Untitled"}</span>
              </p>
              <p dir="auto" className="truncate text-xs text-white/45">
                {toPlain(n.content) || "Empty page"}
              </p>
            </div>

            <div className="flex shrink-0 items-center">
              {isTrash ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(n);
                    }}
                    className={`${action} hover:text-[var(--mint)]`}
                  >
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteForever(n);
                    }}
                    className={`${action} hover:text-rose-300`}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(n);
                    }}
                    className={`${action} hover:text-white`}
                  >
                    {n.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrash(n);
                    }}
                    className={`${action} hover:text-rose-300`}
                    title="Move to trash"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}