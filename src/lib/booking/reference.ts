import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { REFERENCE_PREFIX } from "@/lib/constants";

// Crockford-style alphabet: avoids ambiguous characters (0/O, 1/I/L).
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generatePublicReference(): string {
  const bytes = randomBytes(10);
  let reference = "";
  for (let index = 0; index < bytes.length; index += 1) {
    reference += REFERENCE_ALPHABET[bytes[index]! % REFERENCE_ALPHABET.length];
  }
  return `${REFERENCE_PREFIX}${reference}`;
}

/** Opaque, unguessable capability token. Returned to the customer once. */
export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string): string {
  // Tokens are 256-bit random values; a fast hash is sufficient here and keeps
  // lookups simple. Raw tokens are never stored.
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeTokenEquals(rawToken: string, storedHash: string): boolean {
  const computed = Buffer.from(hashAccessToken(rawToken), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(computed, stored);
}
