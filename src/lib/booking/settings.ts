import "server-only";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getDb } from "@/lib/db/prisma";

export type BusinessSettingsData = {
  brandNameAr: string;
  brandNameEn: string;
  providerNameAr: string;
  providerNameEn: string;
  timezone: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  dailyMaxBookings: number;
  bookingWindowDays: number;
};

export const DEFAULT_SETTINGS: BusinessSettingsData = {
  brandNameAr: "استشارات",
  brandNameEn: "Consultations",
  providerNameAr: "",
  providerNameEn: "",
  timezone: DEFAULT_TIMEZONE,
  slotDurationMinutes: 60,
  bufferMinutes: 0,
  dailyMaxBookings: 6,
  bookingWindowDays: 30,
};

export async function getBusinessSettings(): Promise<BusinessSettingsData> {
  const row = await getDb().businessSettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_SETTINGS;
  return {
    brandNameAr: row.brandNameAr,
    brandNameEn: row.brandNameEn,
    providerNameAr: row.providerNameAr,
    providerNameEn: row.providerNameEn,
    timezone: row.timezone,
    slotDurationMinutes: row.slotDurationMinutes,
    bufferMinutes: row.bufferMinutes,
    dailyMaxBookings: row.dailyMaxBookings,
    bookingWindowDays: row.bookingWindowDays,
  };
}
