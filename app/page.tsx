"use client";

import { useEffect, useRef, useState } from "react";
import SectionsBar from "@/components/SectionsBar";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import AuthModal, { type AuthUser } from "@/components/AuthModal";
import AccountButton from "@/components/AccountButton";
import type { Note, Section } from "@/lib/types";

const JSON_HEADERS = { "Content-Type": "application/json" };
const PALETTE = ["#5eead4", "#8b8cff", "#f9a8d4", "#fcd34d", "#7dd3fc", "#fda4af"];

type SaveStatus = "saved" | "saving" | "error";

export default function Home() {
  const [sections, setSections] = useState<Section[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [view, setView] = useState<"notes" | "trash">("notes");
  const [mobileView, setMobileView] = useState<"list" | "editor">("list"); // فقط زیر ۷۶۸px اثر داره
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const notesRef = useRef<Note[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  const createNoteRef = useRef<() => void>(() => {});

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    createNoteRef.current = createNote;
  });

  // کاربر فعلی (null یعنی مهمان)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/sections").then((r) => r.json()),
      fetch("/api/notes").then((r) => r.json()),
    ])
      .then(([secs, nts]) => {
        if (!Array.isArray(secs) || !Array.isArray(nts)) {
          // مهمان (401) خطا نیست؛ فقط داده‌ای برای نمایش نداره
          if (secs?.error !== "Sign in required") console.error("API error:", secs, nts);
          return;
        }
        setSections(secs as Section[]);
        setNotes(nts as Note[]);
        if (secs.length > 0) {
          setActiveSectionId(secs[0].id);
          setActiveId(
            (nts as Note[]).find((n) => n.section_id === secs[0].id && n.deleted_at === null)?.id ??
              null
          );
        }
      })
      .catch((e) => console.error("Load failed:", e))
      .finally(() => setLoading(false));
  }, []);

  // میانبرها (با e.code کار می‌کنه، پس با کیبورد فارسی هم جواب می‌ده)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        createNoteRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- مشتق‌ها ---------- */

  const liveNotes = notes.filter((n) => n.deleted_at === null);
  const trashNotes = notes
    .filter((n) => n.deleted_at !== null)
    .sort((a, b) => (b.deleted_at ?? 0) - (a.deleted_at ?? 0));
  const sectionNotes = liveNotes.filter((n) => n.section_id === activeSectionId);
  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;
  const active = view === "notes" ? (sectionNotes.find((n) => n.id === activeId) ?? null) : null;

  /* ---------- حساب کاربری ---------- */

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const account = (
    <AccountButton user={user} onSignIn={() => setAuthOpen(true)} onSignOut={signOut} />
  );

  /* ---------- بخش‌ها ---------- */

  function selectSection(id: number) {
    setView("notes");
    setMobileView("list");
    setActiveSectionId(id);
    setActiveId(liveNotes.find((n) => n.section_id === id)?.id ?? null);
  }

  function selectTrash() {
    setView("trash");
    setMobileView("list");
  }

  async function createSection() {
    const name = prompt("Section name:")?.trim();
    if (!name) return;
    const color = PALETTE[sections.length % PALETTE.length];
    const res = await fetch("/api/sections", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) return;
    const section: Section = await res.json();
    setSections((prev) => [...prev, section]);
    setView("notes");
    setMobileView("list");
    setActiveSectionId(section.id);
    setActiveId(null);
  }

  async function renameSection(section: Section) {
    const name = prompt("Rename section:", section.name)?.trim();
    if (!name || name === section.name) return;
    const res = await fetch(`/api/sections/${section.id}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, name } : s)));
  }

  async function deleteSection(section: Section) {
    if (sections.length <= 1) {
      alert("You can't delete the last section.");
      return;
    }
    const count = notes.filter((n) => n.section_id === section.id).length;
    const msg =
      count > 0
        ? `Delete "${section.name}" and its ${count} page(s) permanently?`
        : `Delete "${section.name}"?`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/sections/${section.id}`, { method: "DELETE" });
    if (!res.ok) return;

    const remainingSections = sections.filter((s) => s.id !== section.id);
    const remainingNotes = notes.filter((n) => n.section_id !== section.id);
    setSections(remainingSections);
    setNotes(remainingNotes);

    if (activeSectionId === section.id) {
      const next = remainingSections[0];
      setActiveSectionId(next.id);
      setActiveId(
        remainingNotes.find((n) => n.section_id === next.id && n.deleted_at === null)?.id ?? null
      );
      setMobileView("list");
    }
  }

  /* ---------- صفحه‌ها ---------- */

  function openNote(id: number) {
    setActiveId(id);
    setMobileView("editor");
  }

  async function createNote() {
    if (activeSectionId === null) return;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ section_id: activeSectionId, title: "", content: "" }),
    });
    if (!res.ok) return;
    const note: Note = await res.json();
    setNotes((prev) => [note, ...prev]);
    setView("notes");
    openNote(note.id);
  }

  function updateNote(id: number, patch: { title?: string; content?: string }) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    setStatus("saving");

    const pending = timers.current.get(id);
    if (pending) clearTimeout(pending);

    timers.current.set(
      id,
      setTimeout(async () => {
        timers.current.delete(id);
        const note = notesRef.current.find((n) => n.id === id);
        if (!note) return;

        try {
          const res = await fetch(`/api/notes/${id}`, {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify({ title: note.title, content: note.content }),
          });
          if (!res.ok) throw new Error("save failed");
          if (timers.current.size === 0) setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, 700)
    );
  }

  async function patchNote(id: number, body: { pinned?: boolean; trashed?: boolean }) {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function togglePin(note: Note) {
    const next = !note.pinned;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: next } : n)));
    const ok = await patchNote(note.id, { pinned: next });
    if (!ok) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: note.pinned } : n)));
    }
  }

  async function trashNote(note: Note) {
    const ok = await patchNote(note.id, { trashed: true });
    if (!ok) return;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, deleted_at: Date.now() } : n)));
    if (activeId === note.id) {
      setActiveId(sectionNotes.find((n) => n.id !== note.id)?.id ?? null);
      setMobileView("list");
    }
  }

  async function restoreNote(note: Note) {
    const ok = await patchNote(note.id, { trashed: false });
    if (!ok) return;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, deleted_at: null } : n)));
  }

  async function deleteForever(note: Note) {
    if (!confirm("Delete this page permanently? This can't be undone.")) return;
    const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  }

  async function emptyTrash() {
    if (!confirm(`Delete ${trashNotes.length} page(s) permanently?`)) return;
    const res = await fetch("/api/notes", { method: "DELETE" });
    if (!res.ok) return;
    setNotes((prev) => prev.filter((n) => n.deleted_at === null));
  }

  return (
    <>
      <div className="aurora" />
      <main className="flex h-dvh gap-2 p-2 md:gap-4 md:p-4">
        <SectionsBar
          sections={sections}
          activeId={view === "notes" ? activeSectionId : null}
          trashCount={trashNotes.length}
          trashActive={view === "trash"}
          onSelect={selectSection}
          onSelectTrash={selectTrash}
          onCreate={createSection}
          onRename={renameSection}
          onDelete={deleteSection}
          account={account}
        />

        <div
          className={`min-h-0 w-full md:w-80 md:shrink-0 ${
            mobileView === "editor" ? "hidden md:flex" : "flex"
          }`}
        >
          <Sidebar
            title={view === "trash" ? "Trash" : (activeSection?.name ?? "Pages")}
            mode={view}
            notes={view === "trash" ? trashNotes : sectionNotes}
            activeId={activeId}
            searchRef={searchRef}
            sections={sections}
            activeSectionId={activeSectionId}
            trashCount={trashNotes.length}
            onSelectSection={selectSection}
            onSelectTrash={selectTrash}
            onCreateSection={createSection}
            onRenameSection={renameSection}
            onDeleteSection={deleteSection}
            onSelect={openNote}
            onCreate={createNote}
            onTogglePin={togglePin}
            onTrash={trashNote}
            onRestore={restoreNote}
            onDeleteForever={deleteForever}
            onEmptyTrash={emptyTrash}
            account={account}
          />
        </div>

        <section
          className={`glass min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* دکمه برگشت، فقط روی گوشی */}
          <div className="shrink-0 p-3 pb-0 md:hidden">
            <button
              onClick={() => setMobileView("list")}
              className="pill px-4 py-1.5 text-sm text-white/70"
            >
              ← Pages
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading || !authChecked ? (
              <p className="p-8 text-white/50">Loading...</p>
            ) : !user ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
                <p className="text-lg font-semibold text-white/85">Welcome to PenLabs</p>
                <p className="max-w-xs text-sm text-white/50">
                  Sign in to create notes, organize them in sections and sync them across your devices.
                </p>
                <button onClick={() => setAuthOpen(true)} className="btn-accent px-6 py-2 text-sm">
                  Sign in
                </button>
              </div>
            ) : view === "trash" ? (
              <div className="flex h-full items-center justify-center px-10 text-center text-white/40">
                Pages in the trash can&apos;t be edited. Restore a page to keep working on it.
              </div>
            ) : active ? (
              <NoteEditor
                note={active}
                status={status}
                onChange={(patch) => updateNote(active.id, patch)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/40">
                Create a page to get started
              </div>
            )}
          </div>
        </section>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false);
          window.location.reload();
        }}
      />
    </>
  );
}