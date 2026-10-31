"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth/session";
import { getDb } from "@/lib/db/prisma";
import { methodSchema, serviceSchema } from "@/lib/validation/schemas";
import { auditData } from "@/server/audit";

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  const fallback = base || "consultation";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? fallback : `${fallback}-${attempt + 1}`;
    const exists = await db.consultationService.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
  }
  return `${fallback}-${Date.now().toString(36)}`;
}

export async function saveServiceAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("services:manage");
  const locale = localeFrom(formData);
  const parsed = serviceSchema.safeParse({
    id: formData.get("id") || undefined,
    titleAr: formData.get("titleAr"),
    titleEn: formData.get("titleEn"),
    descriptionAr: formData.get("descriptionAr"),
    descriptionEn: formData.get("descriptionEn"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    durationMinutes: formData.get("durationMinutes"),
    active: formData.get("active") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) {
    redirect(`/${locale}/admin/services?error=invalid`);
  }

  const db = getDb();
  const data = parsed.data;
  if (data.id) {
    const existing = await db.consultationService.findUnique({ where: { id: data.id } });
    if (!existing) redirect(`/${locale}/admin/services?error=notfound`);
    await db.$transaction([
      db.consultationService.update({
        where: { id: data.id },
        data: {
          titleAr: data.titleAr,
          titleEn: data.titleEn,
          descriptionAr: data.descriptionAr,
          descriptionEn: data.descriptionEn,
          price: data.price,
          currency: data.currency,
          durationMinutes: data.durationMinutes,
          active: data.active,
          sortOrder: data.sortOrder,
        },
      }),
      db.auditLog.create({
        data: auditData({
          adminId: admin.id,
          action: "service.updated",
          entityType: "ConsultationService",
          entityId: data.id,
          metadata: { titleEn: data.titleEn },
        }),
      }),
    ]);
  } else {
    const slug = await uniqueSlug(slugify(data.titleEn));
    const created = await db.consultationService.create({
      data: {
        slug,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        descriptionAr: data.descriptionAr,
        descriptionEn: data.descriptionEn,
        price: data.price,
        currency: data.currency,
        durationMinutes: data.durationMinutes,
        active: data.active,
        sortOrder: data.sortOrder,
      },
    });
    await db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: "service.created",
        entityType: "ConsultationService",
        entityId: created.id,
        metadata: { titleEn: data.titleEn, slug },
      }),
    });
  }

  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/admin/services`);
  redirect(`/${locale}/admin/services?saved=1`);
}

export async function toggleServiceAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("services:manage");
  const locale = localeFrom(formData);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`/${locale}/admin/services?error=invalid`);

  const db = getDb();
  await db.$transaction([
    db.consultationService.update({ where: { id }, data: { active } }),
    db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: active ? "service.activated" : "service.deactivated",
        entityType: "ConsultationService",
        entityId: id,
      }),
    }),
  ]);
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/admin/services`);
  redirect(`/${locale}/admin/services?saved=1`);
}

export async function saveMethodAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("methods:manage");
  const locale = localeFrom(formData);
  const parsed = methodSchema.safeParse({
    id: formData.get("id") || undefined,
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
    instructionsAr: formData.get("instructionsAr") ?? "",
    instructionsEn: formData.get("instructionsEn") ?? "",
    active: formData.get("active") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) redirect(`/${locale}/admin/methods?error=invalid`);
  const data = parsed.data;
  const db = getDb();

  if (data.id) {
    await db.$transaction([
      db.consultationMethod.update({
        where: { id: data.id },
        data: {
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          instructionsAr: data.instructionsAr,
          instructionsEn: data.instructionsEn,
          active: data.active,
          sortOrder: data.sortOrder,
        },
      }),
      db.auditLog.create({
        data: auditData({
          adminId: admin.id,
          action: "method.updated",
          entityType: "ConsultationMethod",
          entityId: data.id,
          metadata: { nameEn: data.nameEn },
        }),
      }),
    ]);
  } else {
    const created = await db.consultationMethod.create({
      data: {
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        instructionsAr: data.instructionsAr,
        instructionsEn: data.instructionsEn,
        active: data.active,
        sortOrder: data.sortOrder,
      },
    });
    await db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: "method.created",
        entityType: "ConsultationMethod",
        entityId: created.id,
        metadata: { nameEn: data.nameEn },
      }),
    });
  }

  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/admin/methods`);
  redirect(`/${locale}/admin/methods?saved=1`);
}

export async function toggleMethodAction(formData: FormData): Promise<void> {
  const admin = await requireAdminAction("methods:manage");
  const locale = localeFrom(formData);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`/${locale}/admin/methods?error=invalid`);

  const db = getDb();
  await db.$transaction([
    db.consultationMethod.update({ where: { id }, data: { active } }),
    db.auditLog.create({
      data: auditData({
        adminId: admin.id,
        action: active ? "method.activated" : "method.deactivated",
        entityType: "ConsultationMethod",
        entityId: id,
      }),
    }),
  ]);
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/admin/methods`);
  redirect(`/${locale}/admin/methods?saved=1`);
}
