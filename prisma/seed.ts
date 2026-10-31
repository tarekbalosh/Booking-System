import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Business Settings
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      brandNameAr: "استشارات مهنية",
      brandNameEn: "Professional Consultations",
      providerNameAr: "مقدم الاستشارة",
      providerNameEn: "Consultant",
      timezone: "Asia/Kuala_Lumpur",
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      dailyMaxBookings: 6,
      bookingWindowDays: 30,
    },
  });
  console.log("✓ BusinessSettings seeded");

  // 2. Default Availability Rules (Mon, Tue, Wed, Thu, Sat: 10:00 - 16:00)
  // Weekday numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const defaultWorkdays = [1, 2, 3, 4, 6];
  for (const weekday of defaultWorkdays) {
    await prisma.availabilityRule.upsert({
      where: {
        weekday_startTime_endTime: {
          weekday,
          startTime: "10:00",
          endTime: "16:00",
        },
      },
      update: { active: true },
      create: {
        weekday,
        startTime: "10:00",
        endTime: "16:00",
        active: true,
        timezone: "Asia/Kuala_Lumpur",
      },
    });
  }
  console.log("✓ AvailabilityRules (Mon, Tue, Wed, Thu, Sat 10:00-16:00) seeded");

  // 3. Consultation Services
  const services = [
    {
      slug: "individual-consultation",
      titleAr: "استشارة فردية متخصصة",
      titleEn: "Individual Consultation",
      descriptionAr: "جلسة استشارية شاملة لمناقشة أهدافك ووضع خطة عمل واضحة وقابلة للتنفيذ.",
      descriptionEn: "Comprehensive consultation session to discuss your goals and formulate an actionable plan.",
      price: 150.0,
      currency: "MYR",
      durationMinutes: 60,
      sortOrder: 1,
      active: true,
    },
    {
      slug: "follow-up-session",
      titleAr: "جلسة متابعة وتوجيه",
      titleEn: "Follow-up Session",
      descriptionAr: "جلسة مخصصة لمراجعة التقدم والإجابة عن الاستفسارات وتعديل الخطة.",
      descriptionEn: "Dedicated session to review progress, answer questions, and calibrate the roadmap.",
      price: 90.0,
      currency: "MYR",
      durationMinutes: 45,
      sortOrder: 2,
      active: true,
    },
    {
      slug: "strategic-advisory",
      titleAr: "جلسة تخطيط استراتيجي متقدم",
      titleEn: "Strategic Planning Advisory",
      descriptionAr: "جلسة مكثفة لدراسة وتحليل المشاريع المعقدة وبناء استراتيجيات النمو.",
      descriptionEn: "Deep dive advisory session for complex project analysis and strategic growth roadmaps.",
      price: 250.0,
      currency: "MYR",
      durationMinutes: 90,
      sortOrder: 3,
      active: true,
    },
  ];

  for (const service of services) {
    await prisma.consultationService.upsert({
      where: { slug: service.slug },
      update: {
        titleAr: service.titleAr,
        titleEn: service.titleEn,
        descriptionAr: service.descriptionAr,
        descriptionEn: service.descriptionEn,
        price: service.price,
        currency: service.currency,
        durationMinutes: service.durationMinutes,
        sortOrder: service.sortOrder,
        active: service.active,
      },
      create: service,
    });
  }
  console.log("✓ ConsultationServices seeded");

  // 4. Consultation Delivery Methods
  const methods = [
    {
      nameAr: "مكالمة فيديو عبر Google Meet",
      nameEn: "Google Meet Video Call",
      instructionsAr: "سيتم إرسال رابط الاجتماع تلقائيًا قبل موعد الجلسة.",
      instructionsEn: "The Google Meet link will be provided before the session starts.",
      sortOrder: 1,
      active: true,
    },
    {
      nameAr: "مكالمة صوتية عبر واتساب",
      nameEn: "WhatsApp Audio Call",
      instructionsAr: "سيتصل بك المستشار على رقم الواتساب المسجل في الموعد المحدد.",
      instructionsEn: "The consultant will call you directly on WhatsApp at the scheduled time.",
      sortOrder: 2,
      active: true,
    },
    {
      nameAr: "مكالمة هاتفية مباشرة",
      nameEn: "Direct Phone Call",
      instructionsAr: "سيتواصل معك المستشار هاتفيًا مباشرة في الموعد المحدد.",
      instructionsEn: "The consultant will call your phone number directly at the scheduled time.",
      sortOrder: 3,
      active: true,
    },
  ];

  for (const method of methods) {
    const existing = await prisma.consultationMethod.findFirst({
      where: { nameEn: method.nameEn },
    });
    if (!existing) {
      await prisma.consultationMethod.create({ data: method });
    }
  }
  console.log("✓ ConsultationMethods seeded");

  // 5. Initial Admin Owner
  const initialEmail = (process.env.ADMIN_INITIAL_EMAIL ?? "tarekba850@gmail.com").trim().toLowerCase();
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: initialEmail },
  });

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "123";
  const passwordHash = await hashPassword(initialPassword);

  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        name: "Tarek Admin",
        email: initialEmail,
        passwordHash,
        role: "OWNER",
        active: true,
      },
    });
    console.log(`✓ Owner admin created: ${initialEmail}`);
  } else {
    await prisma.adminUser.update({
      where: { email: initialEmail },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    console.log(`✓ Owner admin password updated: ${initialEmail}`);
  }

  console.log("✨ Seeding completed successfully!");
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
