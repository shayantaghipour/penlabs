"use client";

import { useEffect, useRef, useState } from "react";
import SectionsBar from "@/components/SectionsBar";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import AuthModal, { type AuthUser } from "@/components/AuthModal";
import AccountButton from "@/components/AccountButton";
import { toPlain } from "@/lib/text";
import {
  GUEST_LIMIT,
  GUEST_SECTION,
  GUEST_SECTION_ID,
  loadGuestNotes,
  newGuestId,
  saveGuestNotes,
  takeGuestNotes,
} from "@/lib/guest";
import type { Note, Section } from "@/lib/types";

const JSON_HEADERS = { "Content-Type": "application/json" };
const PALETTE = ["#5eead4", "#8b8cff", "#f9a8d4", "#fcd34d", "#7dd3fc", "#fda4af"];

type SaveStatus = "saved" | "saving" | "error";

// صفحه‌های مهمان رو به حساب منتقل می‌کنه. اونایی که منتقل نشن، تو مرورگر می‌مونن
async function importGuestPages(sectionId: number): Promise<{ created: Note[]; failed: number }> {
  const pending = takeGuestNotes();
  if (pending.length === 0) return { created: [], failed: 0 };

  const created: Note[] = [];
  const failed: Note[] = [];

  // قدیمی‌ترین اول، تا جدیدترین صفحه آخر ساخته بشه و بالای لیست بیاد
  for (const g of [...pending].sort((a, b) => a.updated_at - b.updated_at)) {
    if (!g.title.trim() && !toPlain(g.content)) continue; // صفحه خالی ارزش انتقال نداره
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ section_id: sectionId, title: g.title, content: g.content }),
      });
      if (!res.ok) throw new Error("import failed");
      created.push((await res.json()) as Note);
    } catch {
      failed.push(g);
    }
  }

  if (failed.length > 0) saveGuestNotes(failed);
  return { created, failed: failed.length };
}

function GuestBanner({
  used,
  saveFailed,
  onSignIn,
}: {
  used: number;
  saveFailed: boolean;
  onSignIn: () => void;
}) {
  return (
    <div className="glass shrink-0 px-4 py-3" style={{ borderRadius: 22 }}>
      <p className="text-sm font-medium text-white/85">Guest mode</p>
      <p className="mt-0.5 text-xs text-white/55">
        {saveFailed
          ? "This browser blocked saving, so your pages will be lost when you close the tab."
          : "Your pages are saved only in this browser."}{" "}
        {used} of {GUEST_LIMIT} pages used.
      </p>
      <button onClick={onSignIn} className="btn-accent mt-2 px-4 py-1.5 text-xs">
        Sign in to keep them
      </button>
    </div>
  );
}

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
  const [guestReady, setGuestReady] = useState(false);
  const [guestSaveFailed, setGuestSaveFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const notesRef = useRef<Note[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  const createNoteRef = useRef<() => void>(() => {});
  const importStarted = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGuest = authChecked && !user;

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    createNoteRef.current = createNote;
  });

  function notify(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }

  // پیام می‌ده و پنجره ورود رو باز می‌کنه
  function requireAccount(text: string) {
    notify(text);
    setAuthOpen(true);
  }

  // بارگذاری اولیه: کاربر لاگین‌شده از سرور، مهمان از مرورگر
  useEffect(() => {
    let cancelled = false;

    async function init() {
      let me: AuthUser | null = null;
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        me = data.user ?? null;
      } catch {
        me = null;
      }
      if (cancelled) return;

      if (!me) {
        const guestNotes = loadGuestNotes();
        setUser(null);
        setSections([GUEST_SECTION]);
        setNotes(guestNotes);
        setActiveSectionId(GUEST_SECTION_ID);
        setActiveId(guestNotes[0]?.id ?? null);
        setGuestReady(true);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setUser(me);
      try {
        const [secs, nts] = await Promise.all([
          fetch("/api/sections").then((r) => r.json()),
          fetch("/api/notes").then((r) => r.json()),
        ]);
        if (cancelled) return;

        if (!Array.isArray(secs) || !Array.isArray(nts)) {
          console.error("API error:", JSON.stringify(secs), JSON.stringify(nts));
          return;
        }

        const sectionsList = secs as Section[];
        let notesList = nts as Note[];
        const firstLive = sectionsList.find((s) => s.deleted_at === null);

        // انتقال صفحه‌های مهمان به اولین بخش حساب
        if (firstLive && !importStarted.current) {
          importStarted.current = true;
          const { created, failed } = await importGuestPages(firstLive.id);
          if (cancelled) return;

          if (created.length > 0) {
            notesList = [...[...created].reverse(), ...notesList];
          }
          const parts: string[] = [];
          if (created.length > 0) {
            parts.push(`Moved ${created.length} guest page${created.length === 1 ? "" : "s"} to your account.`);
          }
          if (failed > 0) {
            parts.push(
              `${failed} guest page${failed === 1 ? "" : "s"} couldn't be moved and ${failed === 1 ? "is" : "are"} still saved on this device.`
            );
          }
          if (parts.length > 0) notify(parts.join(" "));
        }

        setSections(sectionsList);
        setNotes(notesList);
        if (firstLive) {
          setActiveSectionId(firstLive.id);
          setActiveId(
            notesList.find((n) => n.section_id === firstLive.id && n.deleted_at === null)?.id ?? null
          );
        }
      } catch (e) {
        console.error("Load failed:", e);
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ذخیره خودکار صفحه‌های مهمان تو مرورگر
  useEffect(() => {
    if (!isGuest || !guestReady) return;
    setGuestSaveFailed(!saveGuestNotes(notes));
  }, [notes, isGuest, guestReady]);

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

  const liveSections = sections.filter((s) => s.deleted_at === null);
  const trashSections = sections
    .filter((s) => s.deleted_at !== null)
    .sort((a, b) => (b.deleted_at ?? 0) - (a.deleted_at ?? 0));
  const liveSectionIds = new Set(liveSections.map((s) => s.id));

  const liveNotes = notes.filter((n) => n.deleted_at === null);
  // صفحه‌های بخش‌های حذف‌شده جدا نشون داده نمی‌شن؛ با خود بخش برمی‌گردن یا پاک می‌شن
  const trashNotes = notes
    .filter((n) => n.deleted_at !== null && liveSectionIds.has(n.section_id))
    .sort((a, b) => (b.deleted_at ?? 0) - (a.deleted_at ?? 0));
  const trashCount = trashSections.length + trashNotes.length;

  const sectionNotes = liveNotes.filter((n) => n.section_id === activeSectionId);
  const activeSection = liveSections.find((s) => s.id === activeSectionId) ?? null;
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
    if (isGuest) {
      requireAccount("Sign in to use the trash.");
      return;
    }
    setView("trash");
    setMobileView("list");
  }

  async function createSection() {
    if (isGuest) {
      requireAccount("Sign in to create more sections.");
      return;
    }
    const name = prompt("Section name:")?.trim();
    if (!name) return;
    const color = PALETTE[liveSections.length % PALETTE.length];
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
    if (isGuest) {
      requireAccount("Sign in to manage sections.");
      return;
    }
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

  // حذف بخش = رفتن به سطل زباله (با همه صفحه‌هاش)
  async function deleteSection(section: Section) {
    if (isGuest) {
      requireAccount("Sign in to manage sections.");
      return;
    }
    if (liveSections.length <= 1) {
      alert("You can't delete the last section.");
      return;
    }
    const count = liveNotes.filter((n) => n.section_id === section.id).length;
    const msg =
      count > 0
        ? `Move "${section.name}" and its ${count} page(s) to the trash?`
        : `Move "${section.name}" to the trash?`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ trashed: true }),
    });
    if (!res.ok) return;

    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, deleted_at: Date.now() } : s))
    );

    if (activeSectionId === section.id) {
      const next = liveSections.find((s) => s.id !== section.id);
      if (next) {
        setActiveSectionId(next.id);
        setActiveId(liveNotes.find((n) => n.section_id === next.id)?.id ?? null);
      }
      setMobileView("list");
    }
  }

  async function restoreSection(section: Section) {
    const res = await fetch(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ trashed: false }),
    });
    if (!res.ok) return;
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, deleted_at: null } : s)));
  }

  async function deleteSectionForever(section: Section) {
    const count = notes.filter((n) => n.section_id === section.id).length;
    const msg =
      count > 0
        ? `Delete "${section.name}" and its ${count} page(s) permanently? This can't be undone.`
        : `Delete "${section.name}" permanently? This can't be undone.`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/sections/${section.id}`, { method: "DELETE" });
    if (!res.ok) return;

    setSections((prev) => prev.filter((s) => s.id !== section.id));
    setNotes((prev) => prev.filter((n) => n.section_id !== section.id));
  }

  /* ---------- صفحه‌ها ---------- */

  function openNote(id: number) {
    setActiveId(id);
    setMobileView("editor");
  }

  async function createNote() {
    if (activeSectionId === null) return;

    if (isGuest) {
      if (notes.length >= GUEST_LIMIT) {
        requireAccount(`Guests can keep up to ${GUEST_LIMIT} pages. Sign in to add more.`);
        return;
      }
      const note: Note = {
        id: newGuestId(notes),
        section_id: GUEST_SECTION_ID,
        title: "",
        content: "",
        updated_at: Date.now(),
        pinned: false,
        deleted_at: null,
      };
      setNotes((prev) => [note, ...prev]);
      setView("notes");
      openNote(note.id);
      return;
    }

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
    // مهمان: فقط تو حافظه عوض می‌شه و افکت بالا تو مرورگر ذخیره‌اش می‌کنه
    if (isGuest) {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: Date.now() } : n))
      );
      return;
    }

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
    if (isGuest) {
      requireAccount("Sign in to pin pages.");
      return;
    }
    const next = !note.pinned;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: next } : n)));
    const ok = await patchNote(note.id, { pinned: next });
    if (!ok) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: note.pinned } : n)));
    }
  }

  async function trashNote(note: Note) {
    // مهمان سطل زباله نداره: حذف همیشگی با تأیید
    if (isGuest) {
      if (!confirm("Delete this page? Guests don't have a trash, so this can't be undone.")) return;
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      if (activeId === note.id) {
        setActiveId(sectionNotes.find((n) => n.id !== note.id)?.id ?? null);
        setMobileView("list");
      }
      return;
    }

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
    if (!confirm(`Delete ${trashCount} item(s) in the trash permanently?`)) return;

    const [notesRes, sectionsRes] = await Promise.all([
      fetch("/api/notes", { method: "DELETE" }),
      fetch("/api/sections", { method: "DELETE" }),
    ]);
    if (!notesRes.ok || !sectionsRes.ok) return;

    const trashedSectionIds = new Set(trashSections.map((s) => s.id));
    setSections((prev) => prev.filter((s) => s.deleted_at === null));
    setNotes((prev) =>
      prev.filter((n) => n.deleted_at === null && !trashedSectionIds.has(n.section_id))
    );
  }

  return (
    <>
      <div className="aurora" />
      <main className="flex h-dvh gap-2 p-2 md:gap-4 md:p-4">
        <SectionsBar
          sections={liveSections}
          activeId={view === "notes" ? activeSectionId : null}
          trashCount={trashCount}
          trashActive={view === "trash"}
          onSelect={selectSection}
          onSelectTrash={selectTrash}
          onCreate={createSection}
          onRename={renameSection}
          onDelete={deleteSection}
          account={account}
        />

        <div
          className={`min-h-0 w-full flex-col gap-2 md:w-80 md:shrink-0 ${
            mobileView === "editor" ? "hidden md:flex" : "flex"
          }`}
        >
          {isGuest && (
            <GuestBanner
              used={notes.length}
              saveFailed={guestSaveFailed}
              onSignIn={() => setAuthOpen(true)}
            />
          )}
          <div className="flex min-h-0 flex-1">
            <Sidebar
              title={view === "trash" ? "Trash" : (activeSection?.name ?? "Pages")}
              mode={view}
              notes={view === "trash" ? trashNotes : sectionNotes}
              activeId={activeId}
              searchRef={searchRef}
              sections={liveSections}
              trashSections={trashSections}
              activeSectionId={activeSectionId}
              trashCount={trashCount}
              onSelectSection={selectSection}
              onSelectTrash={selectTrash}
              onCreateSection={createSection}
              onRenameSection={renameSection}
              onDeleteSection={deleteSection}
              onRestoreSection={restoreSection}
              onDeleteSectionForever={deleteSectionForever}
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
            ) : view === "trash" ? (
              <div className="flex h-full items-center justify-center px-10 text-center text-white/40">
                Items in the trash can&apos;t be edited. Restore them to keep working.
              </div>
            ) : active ? (
              <NoteEditor
                note={active}
                status={isGuest && guestSaveFailed ? "error" : status}
                onChange={(patch) => updateNote(active.id, patch)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
                <p className="text-white/45">
                  {isGuest ? "Write your first page. No account needed." : "Create a page to get started"}
                </p>
                <button onClick={createNote} className="btn-accent px-5 py-2 text-sm">
                  + New page
                </button>
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

      {notice && (
        <div
          role="status"
          className="menu-glass max-w-[90vw]"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            zIndex: 1100,
            padding: "10px 18px",
          }}
        >
          <p className="text-sm text-white/85">{notice}</p>
        </div>
      )}
    </>
  );
}