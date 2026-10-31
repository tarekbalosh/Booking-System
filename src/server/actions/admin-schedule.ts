"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth/session";
import { getDb } from "@/lib/db/prisma";
import { getBusinessSettings } from "@/lib/booking/settings";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  availabilityExceptionSchema,
  availabilityRuleSchema,
  brandSettingsSchema,
  scheduleSettingsSchema,
} from "@/lib/validation/schemas";
import { auditData } from "@/server/audit";

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

const idSchema = z.uuid();

export async function saveAvailabilityRuleAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("availability:manage");
  const locale = localeFrom(formData);
  const parsed = availabilityRuleSchema.safeParse({
    id: formData.get("id") || undefined,
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) redirect(`/${locale}/admin/availability?error=invalid`);

  const settings = await getBusinessSettings();
  const db = getDb();

  try {
    if (parsed.data.id) {
      await db.availabilityRule.update({
        where: { id: parsed.data.id },
        data: {
          weekday: parsed.data.weekday,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          active: parsed.data.active,
          timezone: settings.timezone,
        },
      });
      await db.auditLog.create({
        data: auditData({
          adminId: admin.id,
          action: "availability_rule.updated",
          entityType: "AvailabilityRule",
          entityId: parsed.data.id,
        }),
      });
    } else {
      const created = await db.availabilityRule.create({
        data: {
          weekday: parsed.data.weekday,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          active: parsed.data.active,
          timezone: settings.timezone,
        },
      });
      await db.auditLog.create({
        data: auditData({
          adminId: admin.id,
          action: "availability_rule.created",
          entityType: "AvailabilityRule",
          entityId: created.id,
        }),
      });
    }
  } catch {
    redirect(`/${locale}/admin/availability?error=duplicate`);
  }

  revalidatePath(`/${locale}/admin/availability`);
  revalidatePath(`/${locale}/booking`);
  redirect(`/${locale}/admin/availability?saved=1`);
}

export async function toggleAvailabilityRuleAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("availability:manage");
  const locale = localeFrom(formData);
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect(`/${locale}/admin/availability?error=invalid`);
  const active = formData.get("active") === "true";

  const db = getDb();
  await db.$transaction([
    db.availabilityRule.update({ where: { id: parsed.data }, data: { active } }),
    db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: active ? "availability_rule.activated" : "availability_rule.deactivated",
        entityType: "AvailabilityRule",
        entityId: parsed.data,
      }),
    }),
  ]);
  revalidatePath(`/${locale}/admin/availability`);
  redirect(`/${locale}/admin/availability?saved=1`);
}

export async function deleteAvailabilityRuleAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("availability:manage");
  const locale = localeFrom(formData);
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect(`/${locale}/admin/availability?error=invalid`);

  const db = getDb();
  await db.$transaction([
    db.availabilityRule.delete({ where: { id: parsed.data } }),
    db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: "availability_rule.deleted",
        entityType: "AvailabilityRule",
        entityId: parsed.data,
      }),
    }),
  ]);
  revalidatePath(`/${locale}/admin/availability`);
  redirect(`/${locale}/admin/availability?saved=1`);
}

export async function addAvailabilityExceptionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("availability:manage");
  const locale = localeFrom(formData);
  const parsed = availabilityExceptionSchema.safeParse({
    dateKey: formData.get("dateKey"),
    type: formData.get("type"),
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) redirect(`/${locale}/admin/availability?error=invalid`);

  const db = getDb();
  const created = await db.availabilityException.create({
    data: {
      date: new Date(`${parsed.data.dateKey}T00:00:00Z`),
      type: parsed.data.type,
      startTime: parsed.data.startTime || null,
      endTime: parsed.data.endTime || null,
      reason: parsed.data.reason || null,
    },
  });
  await db.auditLog.create({
    data: auditData({
      adminId: admin.id,
      action: "availability_exception.created",
      entityType: "AvailabilityException",
      entityId: created.id,
      metadata: { type: parsed.data.type, date: parsed.data.dateKey },
    }),
  });

  revalidatePath(`/${locale}/admin/availability`);
  revalidatePath(`/${locale}/admin/calendar`);
  revalidatePath(`/${locale}/booking`);
  redirect(`/${locale}/admin/availability?saved=1`);
}

export async function deleteAvailabilityExceptionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("availability:manage");
  const locale = localeFrom(formData);
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect(`/${locale}/admin/availability?error=invalid`);

  const db = getDb();
  await db.$transaction([
    db.availabilityException.delete({ where: { id: parsed.data } }),
    db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: "availability_exception.deleted",
        entityType: "AvailabilityException",
        entityId: parsed.data,
      }),
    }),
  ]);
  revalidatePath(`/${locale}/admin/availability`);
  revalidatePath(`/${locale}/admin/calendar`);
  revalidatePath(`/${locale}/booking`);
  redirect(`/${locale}/admin/availability?saved=1`);
}

export async function saveScheduleSettingsAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("availability:manage");
  const locale = localeFrom(formData);
  const parsed = scheduleSettingsSchema.safeParse({
    timezone: formData.get("timezone"),
    slotDurationMinutes: formData.get("slotDurationMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    dailyMaxBookings: formData.get("dailyMaxBookings"),
    bookingWindowDays: formData.get("bookingWindowDays"),
  });
  if (!parsed.success) redirect(`/${locale}/admin/availability?error=invalid`);

  const db = getDb();
  const existing = await db.businessSettings.findUnique({ where: { id: 1 } });
  await db.businessSettings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: {
      id: 1,
      brandNameAr: "استشارات",
      brandNameEn: "Consultations",
      providerNameAr: "",
      providerNameEn: "",
      timezone: parsed.data.timezone,
      slotDurationMinutes: parsed.data.slotDurationMinutes,
      bufferMinutes: parsed.data.bufferMinutes,
      dailyMaxBookings: parsed.data.dailyMaxBookings,
      bookingWindowDays: parsed.data.bookingWindowDays,
    },
  });

  await db.auditLog.create({
    data: auditData({
      adminId: admin.id,
      action: "settings.schedule_updated",
      entityType: "BusinessSettings",
      entityId: String(existing?.id ?? 1),
      metadata: {
        timezone: parsed.data.timezone,
        dailyMaxBookings: parsed.data.dailyMaxBookings,
        bookingWindowDays: parsed.data.bookingWindowDays,
      },
    }),
  });

  revalidatePath(`/${locale}/admin/availability`);
  revalidatePath(`/${locale}/booking`);
  redirect(`/${locale}/admin/availability?saved=1`);
}

export async function saveBrandSettingsAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("settings:manage");
  const locale = localeFrom(formData);
  const parsed = brandSettingsSchema.safeParse({
    brandNameAr: formData.get("brandNameAr"),
    brandNameEn: formData.get("brandNameEn"),
    providerNameAr: formData.get("providerNameAr") ?? "",
    providerNameEn: formData.get("providerNameEn") ?? "",
  });
  if (!parsed.success) redirect(`/${locale}/admin/settings?error=invalid`);

  const db = getDb();
  await db.businessSettings.upsert({
    where: { id: 1 },
    update: {
      brandNameAr: parsed.data.brandNameAr,
      brandNameEn: parsed.data.brandNameEn,
      providerNameAr: parsed.data.providerNameAr,
      providerNameEn: parsed.data.providerNameEn,
    },
    create: {
      id: 1,
      brandNameAr: parsed.data.brandNameAr,
      brandNameEn: parsed.data.brandNameEn,
      providerNameAr: parsed.data.providerNameAr,
      providerNameEn: parsed.data.providerNameEn,
      timezone: DEFAULT_TIMEZONE,
    },
  });

  await db.auditLog.create({
    data: auditData({
      adminId: admin.id,
      action: "settings.brand_updated",
      entityType: "BusinessSettings",
      entityId: "1",
    }),
  });

  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/admin/settings`);
  redirect(`/${locale}/admin/settings?saved=1`);
}
