import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { expireStaleHoldsNow } from "@/server/services/expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron endpoint. Holds are also expired opportunistically on every
 * booking attempt, so this is a safety net rather than the only mechanism.
 */
export async function GET(request: Request) {
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const expired = await expireStaleHoldsNow();
    return NextResponse.json({ expired }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
