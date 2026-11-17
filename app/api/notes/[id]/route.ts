import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

function fail(label: string, e: unknown) {
  console.error(label, e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unknown error" },
    { status: 500 }
  );
}

const unauthorized = () => NextResponse.json({ error: "Sign in required" }, { status: 401 });
const notFound = () => NextResponse.json({ error: "Note not found" }, { status: 404 });

export async function PUT(request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : "";
    const content = typeof body.content === "string" ? body.content : "";
    const now = Date.now();

    const result = await db.execute({
      sql: "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      args: [title, content, now, Number(id), user.id],
    });
    if (result.rowsAffected === 0) return notFound();

    return NextResponse.json({ id: Number(id), title, content, updated_at: now });
  } catch (e) {
    return fail("PUT /api/notes/[id] failed:", e);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const sets: string[] = [];
    const args: (number | null)[] = [];

    if (typeof body.pinned === "boolean") {
      sets.push("pinned = ?");
      args.push(body.pinned ? 1 : 0);
    }
    if (typeof body.trashed === "boolean") {
      sets.push("deleted_at = ?");
      args.push(body.trashed ? Date.now() : null);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    args.push(Number(id), user.id);
    const result = await db.execute({
      sql: `UPDATE notes SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
      args,
    });
    if (result.rowsAffected === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("PATCH /api/notes/[id] failed:", e);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const result = await db.execute({
      sql: "DELETE FROM notes WHERE id = ? AND user_id = ?",
      args: [Number(id), user.id],
    });
    if (result.rowsAffected === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("DELETE /api/notes/[id] failed:", e);
  }
}