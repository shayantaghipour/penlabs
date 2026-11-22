import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { checkLimit, clientIp, recordHit, waitMessage } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    await initDb();

    // هر تلاش ثبت‌نام (موفق یا ناموفق) از یه IP شمرده می‌شه
    const rules = [{ key: `register:ip:${clientIp(request)}`, max: 10, windowMs: 60 * 60_000 }];
    const limit = await checkLimit(rules);
    if (!limit.ok) {
      return NextResponse.json(
        { error: waitMessage(limit.retryAfter) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }
    await recordHit(rules);

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return error("Enter a valid email address.", 400);
    }
    if (password.length < 8 || password.length > 200) {
      return error("Password must be 8 to 200 characters.", 400);
    }

    const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    if (existing.rows.length > 0) {
      return error("An account with this email already exists.", 409);
    }

    const count = await db.execute("SELECT COUNT(*) AS c FROM users");
    const isFirstUser = Number(count.rows[0].c) === 0;

    const passwordHash = await hashPassword(password);

    let userId: number;
    try {
      const result = await db.execute({
        sql: "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
        args: [email, name, passwordHash, Date.now()],
      });
      userId = Number(result.lastInsertRowid);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) {
        return error("An account with this email already exists.", 409);
      }
      throw e;
    }

    // اولین حساب، داده‌های بدون صاحب (نوت‌های قبل از لاگین) رو تصاحب می‌کنه
    if (isFirstUser) {
      await db.execute({ sql: "UPDATE sections SET user_id = ? WHERE user_id IS NULL", args: [userId] });
      await db.execute({ sql: "UPDATE notes SET user_id = ? WHERE user_id IS NULL", args: [userId] });
    }

    // هر کاربر حداقل یه بخش داره
    const own = await db.execute({
      sql: "SELECT COUNT(*) AS c FROM sections WHERE user_id = ?",
      args: [userId],
    });
    if (Number(own.rows[0].c) === 0) {
      await db.execute({
        sql: "INSERT INTO sections (name, color, position, created_at, user_id) VALUES (?, ?, ?, ?, ?)",
        args: ["General", "#5eead4", 0, Date.now(), userId],
      });
    }

    await createSession(userId);
    return NextResponse.json({ user: { id: userId, email, name } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/auth/register failed:", e);
    return error("Something went wrong. Please try again.", 500);
  }
}