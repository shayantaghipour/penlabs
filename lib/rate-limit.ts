import { db, initDb } from "@/lib/db";

export type Rule = { key: string; max: number; windowMs: number };

export function clientIp(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}

// آیا یکی از قانون‌ها پر شده؟ اگه آره، چند ثانیه باید صبر کنه
export async function checkLimit(rules: Rule[]): Promise<{ ok: boolean; retryAfter: number }> {
  await initDb();
  const now = Date.now();
  let retryAfter = 0;

  for (const rule of rules) {
    const res = await db.execute({
      sql: "SELECT count, window_start FROM rate_limits WHERE key = ?",
      args: [rule.key],
    });
    const row = res.rows[0];
    if (!row) continue;

    const start = Number(row.window_start);
    if (now - start < rule.windowMs && Number(row.count) >= rule.max) {
      retryAfter = Math.max(retryAfter, Math.ceil((start + rule.windowMs - now) / 1000));
    }
  }
  return { ok: retryAfter === 0, retryAfter };
}

// یه بار به شمارنده اضافه می‌کنه (اگه پنجره تموم شده باشه از اول شروع می‌شه)
export async function recordHit(rules: Rule[]) {
  await initDb();
  const now = Date.now();

  for (const rule of rules) {
    await db.execute({
      sql: `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
            ON CONFLICT(key) DO UPDATE SET
              count = CASE WHEN ? - window_start >= ? THEN 1 ELSE count + 1 END,
              window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END`,
      args: [rule.key, now, now, rule.windowMs, now, rule.windowMs, now],
    });
  }
}

export async function clearLimits(keys: string[]) {
  await initDb();
  for (const key of keys) {
    await db.execute({ sql: "DELETE FROM rate_limits WHERE key = ?", args: [key] });
  }
}

export function waitMessage(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}