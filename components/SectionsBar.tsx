"use client";

import type { ReactNode } from "react";
import type { Section } from "@/lib/types";
import ThemeToggle from "./ThemeToggle";
import GlassTabs, { type GlassTab } from "./GlassTabs";

type Props = {
  sections: Section[];
  activeId: number | null; // null یعنی هیچ بخشی انتخاب نیست (مثلاً تو سطل زباله)
  trashCount: number;
  trashActive: boolean;
  onSelect: (id: number) => void;
  onSelectTrash: () => void;
  onCreate: () => void;
  onRename: (section: Section) => void;
  onDelete: (section: Section) => void;
  account?: ReactNode;
};

export default function SectionsBar({
  sections,
  activeId,
  trashCount,
  trashActive,
  onSelect,
  onSelectTrash,
  onCreate,
  onRename,
  onDelete,
  account,
}: Props) {
  const tabs: GlassTab[] = [
    ...sections.map((s) => ({
      key: `s-${s.id}`,
      className: "group flex items-center gap-3 px-3 py-2.5",
      onDoubleClick: () => onRename(s),
      content: (
        <>
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
          />
          <span dir="auto" className="flex-1 truncate text-sm">
            {s.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(s);
            }}
            className="row-action text-xs text-white/30 hover:text-rose-300"
            aria-label={`Delete ${s.name}`}
          >
            ✕
          </button>
        </>
      ),
    })),
    {
      key: "trash",
      className: "mt-2 flex items-center justify-between px-3 py-2.5 text-sm text-white/70",
      content: (
        <>
          <span>Trash</span>
          {trashCount > 0 && (
            <span className="pill px-2 py-0.5 text-xs text-white/60">{trashCount}</span>
          )}
        </>
      ),
    },
  ];

  return (
    <nav className="glass hidden w-56 shrink-0 flex-col overflow-hidden lg:flex">
      <div className="flex items-center justify-between p-5 pb-3">
        <h1 className="bg-gradient-to-r from-[var(--mint)] via-[var(--periwinkle)] to-[var(--rose)] bg-clip-text text-xl font-bold text-transparent">
          PenLabs
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {account}
        </div>
      </div>

      <p className="px-5 pb-2 text-xs uppercase tracking-wider text-white/35">Sections</p>

      <GlassTabs
        orientation="vertical"
        radius={20}
        tabs={tabs}
        activeKey={trashActive ? "trash" : activeId !== null ? `s-${activeId}` : null}
        onSelect={(key) =>
          key === "trash" ? onSelectTrash() : onSelect(Number(key.slice(2)))
        }
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2"
      />

      <div className="p-4 pt-2">
        <button
          onClick={onCreate}
          className="pill w-full py-2 text-sm text-white/80 hover:bg-white/15"
        >
          + New section
        </button>
      </div>
    </nav>
  );
}