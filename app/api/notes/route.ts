import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Note } from "@/lib/types";

function fail(label: string, e: unknown) {
  console.error(label, e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

const unauthorized = () => NextResponse.json({ error: "Sign in required" }, { status: 401 });

export async function GET() {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const result = await db.execute({
      sql: `SELECT id, section_id, title, content, updated_at, pinned, deleted_at
            FROM notes WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [user.id],
    });
    const notes: Note[] = result.rows.map((r) => ({
      id: Number(r.id),
      section_id: Number(r.section_id),
      title: String(r.title),
      content: String(r.content),
      updated_at: Number(r.updated_at),
      pinned: Number(r.pinned) === 1,
      deleted_at: r.deleted_at === null ? null : Number(r.deleted_at),
    }));
    return NextResponse.json(notes);
  } catch (e) {
    return fail("GET /api/notes failed:", e);
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const sectionId = Number(body.section_id);
    const title = typeof body.title === "string" ? body.title : "";
    const content = typeof body.content === "string" ? body.content : "";
    const now = Date.now();

    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      return NextResponse.json({ error: "section_id is required" }, { status: 400 });
    }

    // بخش باید مال همین کاربر باشه
    const owned = await db.execute({
      sql: "SELECT id FROM sections WHERE id = ? AND user_id = ?",
      args: [sectionId, user.id],
    });
    if (owned.rows.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const result = await db.execute({
      sql: "INSERT INTO notes (section_id, title, content, updated_at, user_id) VALUES (?, ?, ?, ?, ?)",
      args: [sectionId, title, content, now, user.id],
    });

    const note: Note = {
      id: Number(result.lastInsertRowid),
      section_id: sectionId,
      title,
      content,
      updated_at: now,
      pinned: false,
      deleted_at: null,
    };
    return NextResponse.json(note, { status: 201 });
  } catch (e) {
    return fail("POST /api/notes failed:", e);
  }
}

// خالی کردن سطل زباله (فقط صفحه‌های خود کاربر)
export async function DELETE() {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    await db.execute({
      sql: "DELETE FROM notes WHERE deleted_at IS NOT NULL AND user_id = ?",
      args: [user.id],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("DELETE /api/notes failed:", e);
  }
}