import "server-only";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

/**
 * Safe, server-only environment access.
 *
 * Values are read lazily so that builds do not require production secrets and
 * error messages never include the secret value itself.
 */

export { DEFAULT_TIMEZONE };

export class ConfigurationError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing or invalid server configuration: ${variable}`);
    this.name = "ConfigurationError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigurationError(name);
  }
  return value.trim();
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getAuthSecret(): string {
  const secret = required("AUTH_SECRET");
  if (secret.length < 32) {
    throw new ConfigurationError("AUTH_SECRET");
  }
  return secret;
}

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function getDefaultLocale(): "ar" | "en" {
  return process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "en" ? "en" : "ar";
}

export function getDefaultTimezone(): string {
  return process.env.DEFAULT_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
}

export function getAdminInitialEmail(): string {
  return (process.env.ADMIN_INITIAL_EMAIL ?? "").trim().toLowerCase();
}

export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  adminPhone: string;
  appSecret: string | null;
};

/** Returns null when WhatsApp is not fully configured (explicit dry-run mode). */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const adminPhone = process.env.WHATSAPP_ADMIN_PHONE?.trim() ?? "";

  if (!accessToken || !phoneNumberId || !verifyToken || !adminPhone) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    verifyToken,
    adminPhone,
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() || null,
  };
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}
