import { NextResponse } from "next/server";
import { clearPrDetailsCache } from "@/lib/cache";

export async function POST() {
  clearPrDetailsCache();
  return NextResponse.json({ ok: true });
}
