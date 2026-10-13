# WA Broadcast

**العربية** | **[English](./README.en.md)**

<div dir="rtl">

منصة رسائل واتساب **متعددة المستأجرين** ومستضافة ذاتياً على **Meta Cloud API**. ارفع جهات الاتصال → اختر قالب معتمد → أرسل رسائل جماعية → تتبع التسليم وطلبات الإلغاء → رد ثنائي الاتجاه في صندوق وارد حي.

## المميزات الرئيسية

- **بياناتك تبقى لديك** — استضافة ذاتية كاملة، بياناتك تحت سيطرتك، مثالي للامتثال للأنظمة المحلية (السعودية PDPL، الإمارات DPL، الأردن)
- **عدد مستخدمين لا محدود** — لا قيود على المستخدمين أو العملاء، مصمم للتوسع مع نمو أعمالك
- **دعم عربي كامل** — واجهة عربية/إنجليزية كاملة مع دعم RTL، مصممة خصيصاً لمنطقة MENA
- **تعدد العملاء** — كل عميل له رقمه الخاص، جهات اتصاله، قوالبه، وفريقه المستقل
- **صندوق وارد ثنائي الاتجاه** — محادثات حية مع تتبع النوافذ الخدمية 24 ساعة
- **قوالب غنية** — رؤوس وسائط، أكواد كوبونات، شرائط عرض، أزرار تفاعلية
- **جدولة الحملات** — حملات متكررة ومجدولة بتوقيت UTC
- **تحليلات مفصلة** — قمع التسليم، معدلات القراءة، تتبع أحداث الأزرار

## التقنيات المستخدمة

Next.js (App Router) · TypeScript strict · Prisma + Postgres · BullMQ + Redis · Docker Compose

## المتطلبات الأساسية
1. حساب **WhatsApp Business Account (WABA)** من Meta + رقم هاتف
2. **قالب رسالة معتمد** واحد على الأقل
3. **رمز وصول دائم** (System User token) + **App Secret** + **Phone Number ID** + **WABA ID**

## البداية السريعة (Docker)
```bash
cp .env.example .env                          # املأ WA_* و META_APP_SECRET
node scripts/hash-password.mjs 'YourPassword' # انسخ الناتج → ADMIN_PASSWORD_HASH
#   ضع أيضاً ADMIN_EMAIL و AUTH_JWT_SECRET طويل (≥32 حرف)
docker compose up --build                     # postgres, redis, app (يشغل migrations), worker
```
أول تحميل يعيد توجيهك لـ **/login**. سجّل دخول بـ `ADMIN_EMAIL` + كلمة المرور.
التطبيق: http://localhost:3000 · الصحة: http://localhost:3000/api/health

## التطوير المحلي (بدون Docker)
```bash
npm install
npm run prisma:migrate -- --name init
npm run dev          # web على :3000
npm run worker:dev   # worker (طرفية منفصلة)
```

## ربط واتساب + webhook
الطريقة الأسهل: **الإعدادات → ربط واتساب** — الصق Phone Number ID و Business Account ID و **App ID** ورمز الوصول و app secret، ثم **اختبار الاتصال**.

في Meta App Dashboard → WhatsApp → Configuration:
- **Callback URL:** `https://YOUR_DOMAIN/api/webhooks/whatsapp`
- **Verify token:** رمز التحقق الخاص بك
- اشترك في أحداث **messages**

## التدفق الأساسي
0. **إنشاء قالب (اختياري):** في **/templates**، أنشئ قالب برأس وسائط اختياري ومتغيرات نص وأزرار
1. **مزامنة القوالب:** `GET /api/templates?sync=1`
2. **رفع جهات الاتصال:** `POST /api/contacts/upload`
3. **إنشاء بث جماعي:** `POST /api/broadcasts`
4. تابع التقدم في لوحة التحكم. **STOP** الواردة تلغي الاشتراك تلقائياً

## تعدد المستأجرين (Multi-tenancy)
كل سجل مرتبط بـ **عميل** (tenant). الأدوار: **SUPERADMIN** (يدير العملاء) / **ADMIN** (يدير فريق العميل) / **MEMBER**.

كل عميل له:
- رقم واتساب خاص
- جهات اتصال منفصلة
- قوالب مخصصة
- فريق مستقل

## صندوق الوارد الثنائي
`/inbox` عرض محادثات حي بجزئين. الرسائل الواردة (نص، صور، مستندات، صوت، فيديو، ملصقات، تفاعلات) تُنسج لكل عميل. نافذة الخدمة **24 ساعة** تُتتبع من آخر رسالة واردة.

## القوالب
أنشئ في **/templates** وقدّمها لـ Meta للاعتماد:
- **رأس وسائط** — صورة / PDF / فيديو
- **نص** مع `{{متغيرات}}` + **تذييل** اختياري
- **أزرار** (حتى 3): رد سريع / URL / **اتصال** / **نسخ كود** (كوبون)
- **شريط عرض** — 2-10 بطاقات وسائط

## المستخدمين المتعددين
أدوار: **SUPERADMIN** (إدارة العملاء)، **ADMIN** (إدارة فريق العميل)، **MEMBER**. المستخدمون ينتمون لعميل؛ ADMINs يدعون زملاءهم.

## الحملات المتكررة
`RecurringCampaign` + BullMQ scheduler. الـ worker يعيد مزامنة الجداول النشطة عند الإقلاع. الجداول تعمل بـ **UTC**.

## النشر (Railway)
راجع **RAILWAY.md**. 4 مكونات: Postgres, Redis, **web**, **worker**.

## إعادة المحاولة للفشل
افتح بث → إذا كان هناك `FAILED`، زر **إعادة N فاشل** يعيد جدولة الفاشلين فقط.

## الاختبارات
```bash
npm run typecheck    # tsc strict
npm test             # vitest
npm run test:e2e     # playwright
```

## التوسع
- ارفع `WA_MPS` **فقط بعد** ترقية Meta لمستوى الإنتاجية
- شغّل عدة حاويات `worker` — BullMQ يوزع المهام

## البديل بدون خادم
شغّل `app` على Vercel؛ Postgres → Neon/Supabase، Redis → Upstash. **الـ worker يجب أن يبقى على مضيف دائم** (Railway/Fly/VM).

## الترخيص

[MIT License](./LICENSE) — مفتوح المصدر، مجاني 100%

## الروابط

- **GitHub:** https://github.com/Ibrahim-Abedrabboh/wa-broadcast
- **المشروع الشقيق:** [WhatsApp Hub](https://github.com/Ibrahim-newaeon/whatsapphub) — واجهة محسّنة مبنية على هذا الكود

</div>
