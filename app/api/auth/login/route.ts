import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { checkLimit, clearLimits, clientIp, recordHit, waitMessage } from "@/lib/rate-limit";

const WINDOW = 15 * 60_000;

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    const password = typeof body.password === "string" ? body.password : "";

    const ip = clientIp(request);
    const rules = [
      { key: `login:email:${email}`, max: 5, windowMs: WINDOW },
      { key: `login:ip:${ip}`, max: 30, windowMs: WINDOW },
    ];

    const limit = await checkLimit(rules);
    if (!limit.ok) {
      return NextResponse.json(
        { error: waitMessage(limit.retryAfter) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const res = await db.execute({
      sql: "SELECT id, email, name, password_hash FROM users WHERE email = ?",
      args: [email],
    });
    const row = res.rows[0];

    const ok = await verifyPassword(password.slice(0, 200), row ? String(row.password_hash) : null);
    if (!row || !ok) {
      await recordHit(rules);
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }

    await clearLimits([rules[0].key]);
    await createSession(Number(row.id));
    return NextResponse.json({
      user: { id: Number(row.id), email: String(row.email), name: String(row.name) },
    });
  } catch (e) {
    console.error("POST /api/auth/login failed:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}