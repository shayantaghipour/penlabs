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

// انداختن تو سطل زباله یا بازیابی: { trashed: true | false }
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const sectionId = Number(id);
    const body = await request.json().catch(() => ({}));

    if (typeof body.trashed !== "boolean") {
      return NextResponse.json({ error: "trashed must be true or false" }, { status: 400 });
    }

    if (body.trashed) {
      // حداقل یه بخش فعال دیگه باید بمونه
      const others = await db.execute({
        sql: "SELECT COUNT(*) AS c FROM sections WHERE user_id = ? AND deleted_at IS NULL AND id != ?",
        args: [user.id, sectionId],
      });
      if (Number(others.rows[0].c) < 1) {
        return NextResponse.json({ error: "You can't delete the last section" }, { status: 400 });
      }
    }

    const result = await db.execute({
      sql: "UPDATE sections SET deleted_at = ? WHERE id = ? AND user_id = ?",
      args: [body.trashed ? Date.now() : null, sectionId, user.id],
    });
    if (result.rowsAffected === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("PATCH /api/sections/[id] failed:", e);
  }
}

// حذف همیشگی: فقط برای بخشی که تو سطل زباله‌ست
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const sectionId = Number(id);

    const row = await db.execute({
      sql: "SELECT deleted_at FROM sections WHERE id = ? AND user_id = ?",
      args: [sectionId, user.id],
    });
    if (row.rows.length === 0) return notFound();
    if (row.rows[0].deleted_at === null) {
      return NextResponse.json({ error: "Move the section to the trash first" }, { status: 400 });
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