import "server-only";
import type { WhatsAppConfig } from "@/lib/env";

const GRAPH_API_VERSION = "v23.0";
const REQUEST_TIMEOUT_MS = 10_000;

export type WhatsAppSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; errorCode: string };

/** Meta expects digits only, including the country code. */
export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Sends a plain text message through WhatsApp Cloud API.
 * Never logs the access token, message body, or recipient number.
 */
export async function sendWhatsAppText(
  config: WhatsAppConfig,
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const normalizedTo = normalizeWhatsAppPhone(to);
  if (normalizedTo.length < 8) {
    return { ok: false, errorCode: "INVALID_RECIPIENT" };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(config.phoneNumberId)}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedTo,
        type: "text",
        text: { preview_url: false, body },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorCode = extractErrorCode(payload) ?? `HTTP_${response.status}`;
      return { ok: false, errorCode };
    }

    return { ok: true, messageId: extractMessageId(payload) };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, errorCode: "TIMEOUT" };
    }
    return { ok: false, errorCode: "NETWORK_ERROR" };
  }
}

function extractMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const first = messages[0] as { id?: unknown };
  return typeof first?.id === "string" ? first.id : null;
}

function extractErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "number" || typeof code === "string") return String(code);
  return null;
}
