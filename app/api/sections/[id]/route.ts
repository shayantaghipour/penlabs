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
const notFound = () => NextResponse.json({ error: "Section not found" }, { status: 404 });

export async function PUT(request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: "UPDATE sections SET name = ? WHERE id = ? AND user_id = ?",
      args: [name, Number(id), user.id],
    });
    if (result.rowsAffected === 0) return notFound();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("PUT /api/sections/[id] failed:", e);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const sectionId = Number(id);

    const owned = await db.execute({
      sql: "SELECT id FROM sections WHERE id = ? AND user_id = ?",
      args: [sectionId, user.id],
    });
    if (owned.rows.length === 0) return notFound();

    const count = await db.execute({
      sql: "SELECT COUNT(*) AS c FROM sections WHERE user_id = ?",
      args: [user.id],
    });
    if (Number(count.rows[0].c) <= 1) {
      return NextResponse.json({ error: "You can't delete the last section" }, { status: 400 });
    }

    await db.execute({
      sql: "DELETE FROM notes WHERE section_id = ? AND user_id = ?",
      args: [sectionId, user.id],
    });
    await db.execute({
      sql: "DELETE FROM sections WHERE id = ? AND user_id = ?",
      args: [sectionId, user.id],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("DELETE /api/sections/[id] failed:", e);
  }
}