import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/logout failed:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}