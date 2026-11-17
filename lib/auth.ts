import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db, initDb } from "@/lib/db";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

export const SESSION_COOKIE = "penlabs_session";
const SESSION_DAYS = 30;
const KEY_LEN = 64;

export type User = { id: number; email: string; name: string };

/* ---------- رمز عبور ---------- */

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

let dummyHash: Promise<string> | null = null;

// اگه stored خالی باشه (کاربر وجود نداره)، با یه هش ساختگی مقایسه می‌کنه
// تا زمان پاسخ فرقی نکنه و نشه فهمید ایمیل ثبت‌شده یا نه
export async function verifyPassword(password: string, stored: string | null) {
  const hash = stored ?? (await (dummyHash ??= hashPassword("penlabs-dummy-password")));
  const [saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  const match = actual.length === expected.length && timingSafeEqual(actual, expected);
  return stored !== null && match;
}

/* ---------- نشست ---------- */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  await initDb();
  const now = Date.now();
  await db.execute({ sql: "DELETE FROM sessions WHERE expires_at < ?", args: [now] });

  const token = randomBytes(32).toString("hex");
  await db.execute({
    sql: "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    args: [hashToken(token), userId, now + SESSION_DAYS * 86_400_000],
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await initDb();
    await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [hashToken(token)] });
  }
  jar.delete(SESSION_COOKIE);
}

// کاربر فعلی یا null اگه مهمان باشه
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await initDb();
  const id = hashToken(token);
  const res = await db.execute({
    sql: `SELECT u.id, u.email, u.name, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ?`,
    args: [id],
  });

  const row = res.rows[0];
  if (!row) return null;

  if (Number(row.expires_at) < Date.now()) {
    await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [id] });
    return null;
  }
  return { id: Number(row.id), email: String(row.email), name: String(row.name) };
}