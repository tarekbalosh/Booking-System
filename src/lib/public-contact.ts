export const SPEC_ADMIN_WHATSAPP = "+601169397149";

export function publicWhatsAppNumber(): string {
  return (process.env.WHATSAPP_ADMIN_PHONE?.trim() || SPEC_ADMIN_WHATSAPP).replace(/[^0-9]/g, "");
}

export function publicWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${publicWhatsAppNumber()}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
