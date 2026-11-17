import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const res = await db.execute({
      sql: "SELECT id, email, name, password_hash FROM users WHERE email = ?",
      args: [email],
    });
    const row = res.rows[0];

    const ok = await verifyPassword(password.slice(0, 200), row ? String(row.password_hash) : null);
    if (!row || !ok) {
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }

    await createSession(Number(row.id));
    return NextResponse.json({
      user: { id: Number(row.id), email: String(row.email), name: String(row.name) },
    });
  } catch (e) {
    console.error("POST /api/auth/login failed:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}