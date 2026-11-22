import { createClient } from "@libsql/client";

const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createClient>;
  dbSetup?: Promise<void>;
};

// محلی: فایل local.db  |  روی سرور: آدرس Turso از env
export const db =
  globalForDb.db ??
  createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

globalForDb.db = db;

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = await db.execute(`PRAGMA table_info(${table})`);
  if (!cols.rows.some((r) => r.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function setup() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#8b8cff',
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start INTEGER NOT NULL
    )
  `);

  // مهاجرت‌ها: ستون‌های جدید به جدول‌های قدیمی اضافه می‌شن
  await addColumnIfMissing("notes", "section_id", "INTEGER");
  await addColumnIfMissing("notes", "pinned", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("notes", "deleted_at", "INTEGER");
  await addColumnIfMissing("notes", "user_id", "INTEGER");
  await addColumnIfMissing("sections", "user_id", "INTEGER");
  await addColumnIfMissing("sections", "deleted_at", "INTEGER");
}

export function initDb() {
  if (!globalForDb.dbSetup) {
    globalForDb.dbSetup = setup().catch((e) => {
      // اگه راه‌اندازی شکست خورد، دفعه بعد دوباره تلاش کنه
      globalForDb.dbSetup = undefined;
      throw e;
    });
  }
  return globalForDb.dbSetup;
}