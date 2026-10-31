import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getWhatsAppConfig } from "@/lib/env";
import { getDb } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getWhatsAppConfig();
  if (!config) {
    return new NextResponse("WhatsApp is not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (mode !== "subscribe") {
    return new NextResponse("Bad request", { status: 400 });
  }

  const expected = Buffer.from(config.verifyToken);
  const received = Buffer.from(token);
  const valid =
    expected.length === received.length && timingSafeEqual(expected, received);

  if (!valid) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

type WebhookStatus = {
  id?: string;
  status?: string;
  errors?: Array<{ code?: number | string }>;
};

export async function POST(request: Request) {
  const config = getWhatsAppConfig();
  if (!config) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  if (!config.appSecret) {
    // Meta signs webhook payloads with the app secret. Without it we cannot
    // trust the payload, so reject rather than process unverified data.
    return NextResponse.json({ error: "WEBHOOK_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const statuses: WebhookStatus[] = [];
  if (payload && typeof payload === "object") {
    const entries = (payload as { entry?: unknown }).entry;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const changes = (entry as { changes?: unknown }).changes;
        if (!Array.isArray(changes)) continue;
        for (const change of changes) {
          const value = (change as { value?: unknown }).value;
          if (!value || typeof value !== "object") continue;
          const rawStatuses = (value as { statuses?: unknown }).statuses;
          if (!Array.isArray(rawStatuses)) continue;
          for (const status of rawStatuses) {
            if (status && typeof status === "object") statuses.push(status as WebhookStatus);
          }
        }
      }
    }
  }

  const db = getDb();
  for (const status of statuses) {
    if (!status.id) continue;
    if (status.status === "failed") {
      const code = status.errors?.[0]?.code;
      await db.notificationLog
        .updateMany({
          where: { providerMessageId: status.id },
          data: { status: "FAILED", errorCode: code ? String(code).slice(0, 64) : "PROVIDER_FAILED" },
        })
        .catch(() => undefined);
    } else if (status.status === "sent" || status.status === "delivered" || status.status === "read") {
      await db.notificationLog
        .updateMany({
          where: { providerMessageId: status.id },
          data: { status: "SENT" },
        })
        .catch(() => undefined);
    }
  }

  return NextResponse.json({ received: true });
}
