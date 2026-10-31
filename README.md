# نظام حجز الاستشارات المهنية (Consultation Booking System)

نظام متكامل ومستقل لحجز وإدارة الاستشارات المهنية، مبني وفق أحدث المعايير البرمجية والأمنية، مع دعم كامل للغتين العربية (RTL) والإنجليزية (LTR)، وقاعدة بيانات Neon PostgreSQL، وآلية ذرية لمنع الحجز المزدوج، وحجز مؤقت ينتهي بعد 30 دقيقة، ولوحة تحكم محمية بالكامل للمدراء.

---

## 🌟 أبرز مميزات النظام

1. **تجربة حجز للعملاء عصرية وسريعة**:
   - واجهة مستخدم متعددة اللغات (عربية افتراضيًا مع دعم كامل للإنجليزية).
   - عرض فترات الحجز المتاحة ديناميكيًا حسب توقيت كوالالمبور (`Asia/Kuala_Lumpur`).
   - استعراض الخدمات، اختيار قناة الاستشارة (Google Meet، واتساب، مكالمة هاتفية)، واختيار الموعد.
   - حجز مؤقت فوري للموعد لمدة 30 دقيقة بحالة `PENDING_APPROVAL` (بانتظار موافقة المدير).
   - رابط متابعة آمن ومحمي برقم مرجعي ورمز وصول عشوائي لمنع التخمين.

2. **أمان وضمان عدم التعارض (No Overbooking Guarantee)**:
   - منع الحجز المزدوج على مستوى محرك PostgreSQL بواسطة **Exclusion Constraint** (`EXCLUDE USING gist (tstzrange("startAt", "endAt", '[)') WITH &&) WHERE ("releasedAt" IS NULL)`).
   - انتهاء الحجز المؤقت تلقائيًا بعد 30 دقيقة وتحرير الموعد في حال عدم موافقة المدير.
   - معاملات ذرية (`Prisma $transaction`) مع أقفال صفوف (`FOR UPDATE SKIP LOCKED`) لمنع سباق البيانات (race conditions).

3. **لوحة إدارة متكاملة ومحمية (RBAC)**:
   - نظام صلاحيات للمدراء:
     - **مالك (OWNER)**: صلاحيات كاملة وإدارة حسابات المدراء.
     - **مدير (ADMIN)**: الموافقة/الرفض، إدارة الخدمات، التقويم، التوافر، وسجل الإشعارات.
     - **موظف (STAFF)**: استعراض الحجوزات والإشعارات دون تعديل الإعدادات الحساسة.
   - تقويم يومي وأسبوعي (`/admin/calendar`) مع إمكانية إغلاق أيام أو فترات استثنائية.
   - إدارة الخدمات والأسعار والعملات ومدد الجلسات (`/admin/services`).
   - إدارة قنوات وطرق تقديم الاستشارة (`/admin/methods`).
   - ضبط قواعد التوافر وساعات العمل وإعدادات الجلسات (`/admin/availability`).
   - تخصيص هوية العلامة التجارية ومقدم الاستشارة (`/admin/settings`).
   - سجل إشعارات واتساب وإعادة الإرسال (`/admin/notifications`).
   - سجل تدقيق غير قابل للتعديل لجميع العمليات الحساسة (`/admin/audit`).

4. **تكامل WhatsApp Cloud API**:
   - إشعار فوري للمدير عند وصول طلب استشارة جديد.
   - إشعار للعميل عند الموافقة على الموعد أو رفضه.
   - دعم الوضع التجريبي التلقائي (Dry-run mode) عندما لا تتوفر مفاتيح Cloud API في البيئة.
   - مفاتيح Idempotency لمنع تكرار إرسال الرسائل.

---

## 🛠 المتطلبات الأساسية

- **Node.js**: إصدار `20.19.0` أو أحدث.
- **npm**: الإصدار 10 أو أحدث.
- **قاعدة بيانات PostgreSQL**: يُفضل مشروع مجاني أو مدفوع على [Neon](https://neon.tech).

---

## 🚀 التثبيت والتشغيل المحلي

### 1. استنساخ المشروع وتثبيت الحزم

```bash
cd "Booking System"
npm install
```

### 2. إعداد ملف البيئة `.env.local`

انسخ ملف المتغيرات الافتراضية:

```bash
cp .env.example .env.local
```

افتح `.env.local` وضع المتغيرات المناسبة:

```dotenv
# التطبيق
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=ar
DEFAULT_TIMEZONE=Asia/Kuala_Lumpur

# قاعدة بيانات Neon PostgreSQL
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"

# الأمان والمصادقة (يجب أن يكون AUTH_SECRET بطول 32 حرفًا على الأقل)
AUTH_SECRET="your-super-secret-random-key-at-least-32-chars-long"
ADMIN_INITIAL_EMAIL=tarekba850@gmail.com
ADMIN_INITIAL_PASSWORD="YourStrongPassword@2026!"

# إشعارات WhatsApp Cloud API (اختياري، يعمل النظام بوضع Dry-run عند تركه فارغًا)
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_VERIFY_TOKEN=""
WHATSAPP_ADMIN_PHONE="+601169397149"

# سر مهمة Cron الدورية (اختياري)
CRON_SECRET=""
```

> **تنبيه أمني هام:** لا تقم برفع ملف `.env.local` إلى Git نهائيًا. تأكد من إدراجه في `.gitignore`.

### 3. تطبيق تهجيرات قاعدة البيانات (Migrations)

```bash
npm run db:deploy
```

أو أثناء التطوير:

```bash
npm run db:migrate
```

### 4. تهيئة البيانات الأولية (Seeding)

يقوم هذا الأمر بإنشاء:
- إعدادات العمل الافتراضية بتوقيت كوالالمبور.
- جدول المواعيد الافتراضي: (الاثنين، الثلاثاء، الأربعاء، الخميس، السبت من 10:00 إلى 16:00).
- الخدمات الاستشارية الأولية.
- طرق تقديم الاستشارة.
- حساب المدير المالك الأولي (`tarekba850@gmail.com`).

```bash
npm run db:seed
```

### 5. تشغيل خادم التطوير المحلي

```bash
npm run dev
```

افتح المتصفح على:
- الموقع العام: [http://localhost:3000](http://localhost:3000)
- لوحة الإدارة: [http://localhost:3000/ar/admin/login](http://localhost:3000/ar/admin/login)

---

## 👨‍💻 أوامر الإدارة والصيانة

### إنشاء أو إعادة تعيين حساب مدير

يمكنك إنشاء مدير جديد أو تحديث كلمة مرور مدير حالي عبر سطر الأوامر:

```bash
npm run admin:create <email> <password> [name] [role]
```

مثال:
```bash
npm run admin:create tarekba850@gmail.com "SecurePass@2026!" "Tarek Admin" OWNER
```

### تشغيل مهمة تحرير المواعيد المنتهية يدويًا

يقوم هذا الأمر بفحص جميع الطلبات المعلقة التي تجاوزت مدة الـ 30 دقيقة، وتغيير حالتها إلى `EXPIRED` وتحرير قفل الموعد فورًا:

```bash
npm run bookings:expire
```

---

## 🧪 الفحوصات والاختبارات

يحتوي المشروع على فحوصات شاملة للتحقق من سلامة الأنماط والأنواع ومنطق العمل:

```bash
# فحص الأنواع (TypeScript Strict Typecheck)
npm run typecheck

# فحص المعايير والتنسيق (ESLint)
npm run lint

# تشغيل اختبارات الوحدة والتكامل (Vitest)
npm run test

# بناء حزمة الإنتاج للتحقق من جاهزية النشر
npm run build
```

---

## ☁️ خطوات النشر على Vercel

1. **إعداد مستودع Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of consultation booking system"
   ```
2. **ربط المستودع مع GitHub ثم استيراده في Vercel**.
3. **ضبط متغيرات البيئة في Vercel Dashboard**:
   - `DATABASE_URL`: رابط اتصال Neon PostgreSQL الجديد.
   - `AUTH_SECRET`: مفتاح عشوائي مشفر لا يقل عن 32 حرفًا (يمكن إنشاؤه عبر `openssl rand -base64 32`).
   - `ADMIN_INITIAL_EMAIL`: بريد المدير الأول.
   - `NEXT_PUBLIC_APP_URL`: رابط النطاق الخاص بك على Vercel (مثال: `https://your-domain.vercel.app`).
   - `DEFAULT_TIMEZONE`: `Asia/Kuala_Lumpur`.
   - متغيرات WhatsApp Cloud API في حال رغبت بتفعيل الإرسال المباشر.
4. **أمر البناء وقاعدة البيانات**:
   - في إعدادات البناء (Build Command)، تأكد من تضمين:
     `prisma generate && prisma migrate deploy && next build`
5. **مهمة Cron الدورية لانتهاء الحجوزات المؤقتة**:
   - يتضمن المشروع مسار API مخصصًا لـ Vercel Cron: `/api/cron/expire-holds`.
   - يتم تشغيله دوريًا كل 5 دقائق لضمان تنظيف أي حجوزات معلقة لم يتم البت فيها.

---

## 🔒 الملاحظات الأمنية

- **لا يتم تخزين كلمات المرور كنص صريح**: يتم تشفيرها باستخدام `bcryptjs` مع 12 جولة تشفير.
- **حماية جلسات الإدارة**: يتم حفظ معرف الجلسة المشفر في كوكي HTTP-only مع `SameSite=Lax` و `Secure` في الإنتاج.
- **منع تسريب البيانات**: لا يُعرض رقم المرجع للعملاء بدون رمز الوصول الآمن المشتق.
- **الحماية من سباق البيانات**: أقفال مستوى قاعدة البيانات مع PostgreSQL exclusion constraints تضمن عدم قدرة أي طلبين متزامنين على حجز نفس التوقيت حتى لو تمت المحاولة في نفس الجزء من الثانية.
