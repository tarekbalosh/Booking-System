import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicAvailability } from "@/server/services/bookings";
import { dateKeySchema, OTHER_SERVICE_ID } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  serviceId: z.uuid().or(z.literal(OTHER_SERVICE_ID)),
  date: dateKeySchema,
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    serviceId: url.searchParams.get("serviceId") ?? "",
    date: url.searchParams.get("date") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  }

  try {
    const result = await getPublicAvailability(parsed.data.serviceId, parsed.data.date);
    if (!result.ok) {
      return NextResponse.json({ error: result.code }, { status: 404 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }
}
