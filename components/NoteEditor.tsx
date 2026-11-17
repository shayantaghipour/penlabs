"use client";

import type { Note } from "@/lib/types";
import RichEditor from "./RichEditor";
import ExportMenu from "./ExportMenu";

type Props = {
  note: Note;
  status: "saved" | "saving" | "error";
  onChange: (patch: { title?: string; content?: string }) => void;
};

export default function NoteEditor({ note, status, onChange }: Props) {
  const dot =
    status === "saving" ? "bg-amber-300" : status === "error" ? "bg-rose-400" : "bg-[var(--mint)]";
  const label = status === "saving" ? "Saving..." : status === "error" ? "Not saved" : "Saved";

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-4 md:px-10 md:py-8">
      <div className="mb-4 flex items-center justify-between">
        <span className="pill inline-flex items-center gap-2 px-3 py-1 text-xs text-white/60">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
        </span>
        <ExportMenu note={note} />
      </div>

      <input
        value={note.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Title"
        dir="auto"
        className="mb-4 w-full bg-transparent text-2xl font-bold outline-none placeholder:text-white/25 md:mb-5 md:text-4xl"
      />

      <RichEditor
        key={note.id}
        initialContent={note.content}
        onChange={(html) => onChange({ content: html })}
      />
    </div>
  );
}