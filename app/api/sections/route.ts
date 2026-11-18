import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Section } from "@/lib/types";

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
      sql: "SELECT id, name, color, position, deleted_at FROM sections WHERE user_id = ? ORDER BY position, id",
      args: [user.id],
    });
    const sections: Section[] = result.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      color: String(r.color),
      position: Number(r.position),
      deleted_at: r.deleted_at === null ? null : Number(r.deleted_at),
    }));
    return NextResponse.json(sections);
  } catch (e) {
    return fail("GET /api/sections failed:", e);
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    const color = typeof body.color === "string" ? body.color.slice(0, 20) : "#8b8cff";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const max = await db.execute({
      sql: "SELECT COALESCE(MAX(position), -1) AS m FROM sections WHERE user_id = ?",
      args: [user.id],
    });
    const position = Number(max.rows[0].m) + 1;

    const result = await db.execute({
      sql: "INSERT INTO sections (name, color, position, created_at, user_id) VALUES (?, ?, ?, ?, ?)",
      args: [name, color, position, Date.now(), user.id],
    });

    const section: Section = {
      id: Number(result.lastInsertRowid),
      name,
      color,
      position,
      deleted_at: null,
    };
    return NextResponse.json(section, { status: 201 });
  } catch (e) {
    return fail("POST /api/sections failed:", e);
  }
}

// خالی کردن بخش‌های سطل زباله (با همه صفحه‌هاشون)
export async function DELETE() {
  try {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    await db.execute({
      sql: `DELETE FROM notes WHERE user_id = ? AND section_id IN
            (SELECT id FROM sections WHERE user_id = ? AND deleted_at IS NOT NULL)`,
      args: [user.id, user.id],
    });
    await db.execute({
      sql: "DELETE FROM sections WHERE user_id = ? AND deleted_at IS NOT NULL",
      args: [user.id],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail("DELETE /api/sections failed:", e);
  }
}