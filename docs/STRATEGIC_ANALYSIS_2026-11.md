# Sofsavdo — Chuqur tahlil va strategiya (2026-11-12)

Tayyorlagan: senior analitik / founder nuqtai nazaridan. Asos: GitHub kodi, Railway MCP orqali real holat, ochiq manbalardan bozor qidiruvi.

> **Halollik eslatmasi.** Quyidagi "tekshirilgan" belgisi kod yoki Railway ma'lumotidan to'g'ridan-to'g'ri olingan faktlarga qo'yilgan. Bozor/raqobat bo'limidagi raqamlar ochiq veb-qidiruvdan; ko'p manbalar agentlik/vendor bloglari va o'zaro mos kelmaydi — "taxminiy" deb belgilangan. Sandbox tarmog'idan `sofsavdo.com` ga ulanib bo'lmadi (curl 000), shuning uchun sayt ichidan jonli tekshiruv **qilinmadi**.

---

## 1. Qisqa xulosa (TL;DR)

1. **Texnik poydevor kuchli, lekin Railway holati xavotirli.** Kod sifati yuqori (943 unit test, tranzaksiyali moliya, race-fix'lar, 74 ADR). Biroq Railway'dagi `Sofsavdo` loyihasida `sofsavdo-api` va `sofsavdo-web` ning **yagona va oxirgi deploy'i 2026-09-23 da FAILED**, loyihada **Postgres/Redis servisi yo'q**, API'da `DATABASE_URL`/`CLICK_*` o'zgaruvchilari yo'q, custom domen yo'q. Hujjatlar "sofsavdo.com da jonli" deydi — demak haqiqiy production boshqa joyda (boshqa Railway akkaunt/loyiha) bo'lishi mumkin yoki bu loyiha yarim ko'chirilgan. **Bu birinchi aniqlashtirilishi kerak bo'lgan narsa.**
2. **"Yopiq → ochiq" o'tish to'g'ri g'oya, lekin ketma-ketlik muhim.** Bugun tizim *single-tenant* (schemada Merchant/Tenant/Seller modeli yo'q). "Ochiq" = ko'p biznes (merchant) kirishi. Tavsiya: **avval barqarorlashtirish (2–3 hafta), keyin "boshqariladigan ochilish" (invite/waitlist bilan merchant'lar), keyin to'liq ochiq.**
3. **Bozor imkoniyati real.** O'zbekiston e-commerce tez o'smoqda (Uzum 2025: >$500M GMV, 34M buyurtma, 20M+ foydalanuvchi). Lekin men **Uzum yoki Yandex Market uchun blogerlarga ochiq affiliate dasturni topa olmadim** — bu bo'shliq Sofsavdo uchun asosiy imkoniyat.
4. **Asosiy ustunlik (moat):** "Creator katalog ko'radi, xaridor faqat bitta taklifni ko'radi" — kontent-tijorat (blogger → bitta landing → to'lov) uchun mos; Click/COD/PAY_LATER, ~190 hudud yetkazib berish, Telegram integratsiyasi, kurs/xizmat/jismoniy mahsulot hammasi bir modelda.
5. **Asosiy xavflar:** (a) deploy/infra ishonchsizligi, (b) huquqiy hujjatlar placeholder, creator shartnomasi yo'q, (c) fraud-detection yo'q, (d) multi-merchant arxitekturasi yo'q, (e) bitta operator/bitta founder'ga bog'liqlik, (f) Telegram/Instagram'ga bog'liq trafik.

---

## 2. Railway deploy holati (tekshirilgan)

| Loyiha | Servis | Oxirgi deploy | Holat |
|---|---|---|---|
| Sofsavdo | `sofsavdo-api` (repo `sofsavdo/sofsavdo.com`) | 2026-09-23 | **FAILED** |
| Sofsavdo | `sofsavdo-web` (repo `sofsavdo/sofsavdo.com`) | 2026-09-23 | **FAILED** |
| Sofsavdo | `fidem-backend`, `fidem-frontend` (repo `Sofsavdo/Fidem`) | 2026-11-11 | SUCCESS (bugun, PR #70) |
| Izdosh | `MarketPro` (repo `sofsavdo/marketpro`) | 2026-11-10 | SUCCESS |

**Nima noto'g'ri bo'lgan (API build logi):** deploy `Railpack` bilan qurilgan va `No start command detected` xatosi bilan yiqilgan. Ya'ni o'sha paytda Railway `apps/api/Dockerfile` ni emas, monorepo ildizini avtomatik aniqlagan. Hozirgi servis konfigi `builder: DOCKERFILE, dockerfilePath: apps/api/Dockerfile` ko'rsatadi — ya'ni konfig keyin tuzatilgan, lekin **tuzatishdan keyin qayta deploy qilinmagan**. `apps/*/railway.toml` ildizda emas, shuning uchun config-as-code avtomatik o'qilmaydi (u faqat servis "Root Directory" ga bog'liq).

**Kamchiliklar:**
- Loyihada **Postgres va Redis servislari yo'q**. API o'zgaruvchilari: `API_URL, CORS_ALLOWED_ORIGINS, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NODE_ENV, PAYOUT_ENCRYPTION_KEY, STORAGE_PUBLIC_BASE_URL, WEB_APP_URL`. `DATABASE_URL`, `REDIS_URL`, `CLICK_*`, `FIDEM_INTEGRATION_SECRET` ko'rinmaydi (boshqa servis o'zgaruvchilari "valuesRedacted" bo'lgani uchun faqat nomlar tekshirildi). `env-validation.ts` production'da shularsiz ishga tushmaydi — bu deploy'ning keyingi qadamda ham yiqilishini bildiradi.
- Hajm (volume) yo'q, S3 bucket yo'q → yuklangan rasmlar har redeploy'da yo'qoladi (kod buni hujjatlashtirgan, lekin Railway'da o'rnatilmagan).
- Custom domen yo'q (`sofsavdo.com`/`api.sofsavdo.com` bu loyihaga ulanmagan). Faqat `*.up.railway.app`.
- Regionlar aralash: Sofsavdo servislari `sfo` (AQSh), Fidem `europe-west4`. O'zbekiston foydalanuvchilari uchun Yevropa/yaqinroq region latency'ni kamaytiradi.
- Monitoring: tracing o'chiq, webhook (deploy-failed alert) sozlanmagan, `ERROR_REPORTING_WEBHOOK_URL` yo'q. FAILED deploy 7 hafta e'tiborsiz qolganining o'zi shuni ko'rsatadi.
- Bitta replika, Postgres backup/PITR haqida dalil yo'q (`BACKUP_RESTORE.md` bor, lekin bajarilganligi tasdiqlanmagan).

**Birinchi qadamlar (men tasdiqsiz hech narsa deploy qilmadim):**
1. Haqiqiy production qayerda ekanini aniqlang (boshqa Railway akkaunt? Fidem hisobi `fidemapp1@…` ostida shu loyiha turibdi).
2. Agar shu loyiha production bo'lsa: Postgres + Redis qo'shish, env'larni to'ldirish, volume yoki R2/S3, domen ulash, keyin `redeploy`.
3. `create-webhook` bilan Deploy failed/crashed alertlarini Telegram/Slack'ga yo'naltirish.
4. Region: `europe-west4` ga ko'chirish; kamida 1 ta health-check'li replika + Postgres backup.

---

## 3. Kod bazasi auditi (GitHub, tekshirilgan)

**Hajm:** ~74K qator TS/TSX, npm workspaces monorepo (Next.js + NestJS + Prisma/Postgres + Redis/BullMQ), 2145 qatorli schema (~61 model), 78 spec fayl, 50 commit, 74 ADR. Hujjatlar juda boy (PROJECT_STATUS 300KB, DECISIONS 220KB).

**Kuchli tomonlar**
- Moliyaviy yaxlitlik: butun-son (bps) hisob-kitob, buyurtma paytida komissiya qoidasi snapshot, `updateMany + count` bilan race-safe o'tishlar, Click callback imzo/summa/replay/atomiklik, audit trail.
- Xavfsizlik: JWT refresh rotation, akkaunt lockout, RBAC katalogi, PII masking, rate-limit, prod env guardrail'lar.
- Mahsulot: Product→Offer→Campaign ajratish, 4 xil komissiya turi, promo-kod, referal/attribution (server-side), launch bonus, musobaqalar, creator fund, chat (real-time), Fidem va Izdosh hamkor integratsiyalari, 190 hududli yetkazib berish, AI mahsulot yordamchisi.
- CI: typecheck/lint/e2e (real Postgres) → qo'lda `deploy.yml`.

**Yetishmayotgan / zaif tomonlar**
| # | Muammo | Xavf | Izoh |
|---|---|---|---|
| 1 | Multi-tenancy yo'q (Merchant/Brand modeli, `merchantId` yo'q) | Yuqori (ochilish uchun blocker) | Hamma Product/Offer/Order bitta egaga bog'liq |
| 2 | Huquqiy: ToS/Privacy/Refund — "DRAFT" placeholder; creator shartnomasi, consent checkbox yo'q | Yuqori | `LEGAL.md` o'zi tan oladi. Real pul oqimi bor — darhol hal qiling |
| 3 | Fraud detection yo'q (o'z-o'ziga referal, bir IP, tezlik) | Yuqori | `PRODUCTION_READINESS.md`: "explicitly out of scope" |
| 4 | Payme yo'q (faqat Click + COD); Uzum Nasiya enum bor, adapter yo'q | O'rta | O'zbekistonda Payme/Click ikkalasi talab qilinadi; bo'lib to'lash (Uzum Nasiya, Alif, Paylater) konversiyani oshiradi |
| 5 | Soliq/ma'lumot: creator to'lovlari uchun o'zini-o'zi band qilgan/YaTT/soliq to'xtatish, hisob-faktura/fiskal chek (OFD) oqimi hujjatlarda ko'rinmaydi | O'rta–yuqori | Mahalliy buxgalter bilan tasdiqlang |
| 6 | Ma'lumot saqlash siyosati, e-posta/SMS: SMTP + Telegram bor, SMS (Eskiz/Playmobile) ko'rinmaydi | O'rta | O'zbekistonda SMS OTP/bildirishnoma standart |
| 7 | i18n yo'q (UZ/RU/EN), `llms.txt` bor lekin ko'p tilli SEO yo'q | O'rta | Rus tili — Toshkent auditoriyasi uchun muhim; hozir interfeys faqat o'zbekcha |
| 8 | Mobil ilova/PWA, Telegram Mini App yo'q | O'rta | Creator'lar uchun eng tabiiy kanal Telegram |
| 9 | Storage: local disk default, S3/R2 yoqilmagan | Yuqori (prod) | Yuklamalar yo'qoladi |
| 10 | Test: unit yaxshi, lekin jonli smoke/E2E (Playwright) va yuklama sinovi CI'da emas; docker build 'hech qachon tekshirilmagan' degan eski hujjat qolgan | O'rta | Hujjatlarning bir qismi eskirgan (AUDIT_REPORT, DEPLOYMENT) |
| 11 | Hujjatlar ziddiyati: README "Phase 0", DEPLOYMENT "hech qanday prod yo'q", PROJECT_STATUS "jonli" | Past | Yagona "holat" sahifasi kerak |
| 12 | Monitoring/Observability: Sentry, uptime, metrikalar yo'q | O'rta | Bitta FAILED deploy 7 hafta sezilmagan |
| 13 | Dev jarayon: `main` ga to'g'ridan commit, code-owner/PR gate yo'q ko'rinadi | O'rta | Moliya tizimi uchun majburiy review kerak |

---

## 4. "Yopiq → ochiq" strategiyasi

**Hozirgi model:** bitta biznes egasi → tasdiqlangan creator'lar → bitta takliflik landing. Bu *brand-controlled affiliate commerce*.

**"Ochiq" ni uch ma'noda tushunish mumkin — tavsiya: 2-chisi, keyin 3-chisi:**
1. *Creator'lar uchun ochiq* — allaqachon avto-tasdiq (u allaqachon amalda). Qolgan ish: fraud nazorati va sifat darajalari (tiers).
2. **Merchant'lar uchun ochiq (asosiy qadam)** — boshqa brendlar/kurs mualliflari/xizmat egalari o'z taklifini joylaydi. Marketplace emas, **"performance-based creator network"** bo'ladi.
3. Xaridor uchun ochiq katalog — **buni hozircha qilmang.** "Bitta taklif — bitta landing" — konversiya va blogger-attribution uchun kuchli. `/catalog` mavjud, uni cheklangan holda saqlang.

**Bosqichlar**
- **Faza 0 (1–3 hafta) — Barqarorlash:** Railway'ni tuzatish, Postgres backup, alert, R2/S3, domen, region; huquqiy hujjatlar (advokat), creator shartnomasi, consent; fraud v1 (self-referral, shared device/IP, velocity); Payme.
- **Faza 1 (4–8 hafta) — Merchant core:** `Merchant` modeli + `merchantId` Product/Offer/Campaign/Order/Commission'da, RBAC kengaytmasi (merchant admin), merchant onboarding+KYC (STIR/INN, shartnoma), merchant dashboard (buyurtma, qaytarish, yetkazish), **platforma komissiyasi (take-rate)** + escrow tipidagi hisob-kitob (merchant → platforma → creator), merchant payout hisoboti. Invite/waitlist bilan 5–10 ta tanlangan merchant.
- **Faza 2 (3–6 oy) — Ochilish:** o'z-o'ziga xizmat merchant ro'yxatdan o'tishi, creator↔merchant reyting/sharhlar, kampaniya marketplace'i (creator ko'radi), Telegram Mini App/bot, ko'p til, bo'lib to'lash, API/webhook (merchant'larning Shopify/Uzum/CRM tizimlari uchun), "Verified" belgi.
- **Faza 3 — Kengayish:** Qozog'iston/Qirg'iziston, Rossiya tilli segment, AI: mahsulot→kontent generatsiyasi, creator↔kampaniya mosligi.

**Biznes model (take-rate misoli — taxminiy, sinash kerak):**
- Platforma 8–12% (jismoniy mahsulot), 10–15% (kurs/raqamli) merchant savdosidan; creator komissiyasi merchant qoidasidan; qo'shimcha: promoted kampaniyalar, merchant SaaS-obuna (analitika/CRM), tezkor payout (kommissiya evaziga).
- Birlik iqtisodiyoti: CAC merchant tomonda past (outbound + referal), creator tomonida nolga yaqin (komissiya). Muhim metrikalar: GMV, take-rate, creator faol nisbati, qaytarish %, to'lov vaqti.

**Nima uchun hozirgi "yopiq" cheklov (PROHIBITED.md) ni qayta ko'rish kerak:** "vendor panel", "tender/bidding" taqiqlangan — ochilish uchun vendor panel *kerak*. Bu ADR darajasida qaror bo'lishi kerak (yangi ADR yozing). "Xaridor faqat bitta taklifni ko'radi" qoidasi saqlansin.

---

## 5. Raqobat tahlili

> Quyidagi O'zbekiston bozori uchun ma'lumotlarning katta qismi umumiy bilim + ochiq qidiruv; **rasmiy to'lov/komissiya shartlarini har bir kompaniyaning o'z saytida tekshirib oling.**

### 5.1 O'zbekiston

| Raqib | Turi | Kuchli tomoni | Zaif tomoni (Sofsavdo uchun) |
|---|---|---|---|
| **Uzum Market** ([manba](https://kun.uz/en/news/2026/07/10/uzum-yonalishidagi-ye-sommerce-aylanmasi-1-milliard-dollarga-yetishi-mumkin)) | Marketplace + fintech (Uzum Nasiya, Bank) | 20M+ foydalanuvchi, GMV >$500M (2025), 18K+ sotuvchi, logistika, bo'lib to'lash | Blogger-affiliate dasturi ochiq topilmadi; xaridor boshqa mahsulotlarga chalg'iydi; bloger savdosi atribusiya qilinmaydi; sotuvchi komissiyasi yuqori (manbalar 3–35% deydi, taxminiy) |
| **Yandex Market (UZ)** | Marketplace | Brend, logistika | Xuddi shunday: bloger oqimi uchun asbob yo'q |
| **Wildberries / Ozon (UZ)** | Marketplace (kirib kelayotgan) | Katta assortiment, narx | Mahalliy kontent-creator integratsiyasi zaif |
| **Telegram-kanal savdosi + Yandex Ads** ([manba](https://www.uzdaily.uz/en/yandex-uzbekistan-expands-support-for-creators-and-media-on-telegram/)) | Reklama | ~25M Telegram foydalanuvchi, 18K+ kanal Yandex Ads tarmog'ida | Reklama CPM/CPC — natijaga emas, atribusiya/payout avtomatlashmagan |
| **Admitad / Travelpayouts / Leadbit** (CIS CPA tarmoqlari) | CPA network | Tajriba, global advertiserlar | Asosan travel/iGaming/nutra; o'zbek brendlari va blogger payout (naqd/karta) mahalliylashmagan |
| **Banklar affiliate** (Kapitalbank va b.) | Yo'naltirish | Brend ishonchi | Faqat moliyaviy mahsulot |
| **Kurs platformalari** (Udemy-o'xshash mahalliy, Telegram-kurslar) | Raqamli ta'lim | Kontent | Sotuv/affiliate funksiyasi cheklangan |

**Xulosa:** O'zbekistonda *"blogger → bitta taklif → Click → avtomatik komissiya/payout"* ni boshidan oxirigacha mahalliy to'lov tizimlari bilan ta'minlaydigan, ochiq raqib topilmadi (to'liq bozor skanerlanmagani uchun "yo'q" deb emas, "topilmadi" deb o'qing). Bu 6–12 oylik oyna bo'lishi mumkin — Uzum/WB affiliate'ni ochsa qisqaradi.

### 5.2 Jahon (benchmark)

| Raqib | Nima qiladi | Sofsavdo uchun saboq |
|---|---|---|
| **Impact, Awin, PartnerStack** | Enterprise affiliate tarmoq | Kuchli hisobot, shartnoma, fraud; Sofsavdo — mahalliy, yengil |
| **Refersion, Tapfiliate, UpPromote** | Merchant uchun affiliate SaaS | O'rnatish oson (Shopify); Sofsavdo = tarmoq + to'lov + yetkazib berish birgalikda |
| **Shopify Collabs / TikTok Shop affiliate** | Creator-commerce | Aynan shu model, lekin O'zbekistonda mavjud emas (TikTok Shop UZ launchi tasdiqlanmadi) — ustunlik mahalliy |
| **LTK, ShopMy** | Influencer storefront | Bitta-taklif o'rniga "shop"; Sofsavdo'ning fokusi boshqacha |
| **Digistore24, ClickBank** | Raqamli mahsulot/kurs affiliate | Kurs/ekspert segmenti uchun yaxshi misol — Sofsavdo'da kurs/xizmat allaqachon bor |
| **Whop, Gumroad** | Raqamli mahsulot/community | Obuna, community, mobil ilova funksiyalari |

### 5.3 Sofsavdo ustunliklari (kod bilan tasdiqlangan)
1. Bitta taklif landing + server-side attribution (cookie'ga ishonmaydi).
2. Click + COD + PAY_LATER + hudud bo'yicha yetkazib berish narxi (~190 zona).
3. Jismoniy mahsulot, kurs, xizmat, konsultatsiya — bitta modelda; hamkor integratsiyalari (Fidem, Izdosh).
4. Creator bonuslari, musobaqa, fond, leaderboard, chat — creator retention vositalari.
5. Moliyaviy xavfsizlik va audit trail.

### 5.4 Sofsavdo kamchiliklari (raqibga nisbatan)
Brend ishonchi/trafik yo'q; Payme/bo'lib to'lash/SMS/Telegram Mini App/ko'p til yo'q; merchant side yo'q; logistika o'z ichida emas (kuryer integratsiyasi, masalan BTS/Yandex Delivery/Uzum Fulfilment); sharhlar/reyting yo'q; hajm kichik.

---

## 6. Bozorni egallash rejasi (go-to-market)

**Tanlangan vertikal:** boshida 2–3 ta. Tavsiya: (1) go'zallik/parvarish (jismoniy, yuqori marja), (2) onlayn kurslar (raqamli, 100% marja, katta komissiya), (3) xizmatlar/konsultatsiya. Hamma narsani birdan qilmang.

**Ikki tomonlama bozor "tovuq-tuxum" yechimi:**
- *Taklif tomoni (merchant):* 10–20 ta brend/ekspertga to'g'ridan-to'g'ri murojaat; birinchi 90 kun nol platforma komissiyasi yoki past (3%); har bir merchant uchun tayyor landing + kampaniya.
- *Creator tomoni:* 50–100 ta mikro-bloger (5K–100K), Telegram-kanallar; "birinchi sotuv kafolati" (kichik fiksirlangan bonus), 24–72 soatlik tez payout.
- *Ishonch:* real isbotlangan payout skrinshotlari/case-study, "Verified merchant" belgisi.

**Kanallar:** Telegram (bot + Mini App), Instagram/TikTok bloger jamoalari, universitet/yoshlar tashabbuslari, "Kunlik tadbirkor" tipidagi kanal hamkorliklari, referal (mavjud 20,000 so'm/do'st tizimi).

**Narx/komissiya:** creator ko'rishi shaffof ("sizning daromadingiz X so'm") — mavjud yaxshi amaliyot; merchant uchun ROI kalkulyator.

**KPI (90 kun):** 20 merchant, 300 faol creator, 2,000+ buyurtma, GMV ≥ 400M so'm, qaytarish < 12%, payout vaqti < 3 kun, fraud < 2%.

---

## 7. Xavflar va ularni kamaytirish

| Xavf | Ehtimol | Ta'sir | Chora |
|---|---|---|---|
| Uzum/WB affiliate ochadi | O'rta | Yuqori | Tezlik, mahalliy to'lov, bitta-taklif UX, kurs/xizmat segmentida chuqurlik |
| Fraud / o'z-o'ziga referal | Yuqori | Yuqori | Fraud v1 + qo'lda tekshirish navbati, komissiya hold 14 kun (bor) |
| Huquqiy (soliq, iste'molchi huquqi, reklama qonuni) | Yuqori | Yuqori | Mahalliy advokat + buxgalter; creator shartnomasi; reklama belgisi talablari |
| Platforma uzilishi | Yuqori (hozir) | Yuqori | Infra tuzatish, alert, backup |
| Kalit shaxsga bog'liqlik | Yuqori | O'rta | Hujjatlar bor (yaxshi); ikkinchi muhandis/operator |
| Merchant sifati (soxta mahsulot) | O'rta | Yuqori | KYC, qaytarish siyosati, escrow hold |
| Hamkor (Fidem/Izdosh) integratsiyasiga qaramlik | Past | O'rta | Imzolangan webhook (bor), monitoring |

---

## 8. Birinchi 30 kun — aniq vazifalar ro'yxati

**Hafta 1 — infra**
1. Production qayerdaligini tasdiqlash; Railway loyihasini tuzatish yoki yagona productionga o'tkazish.
2. Postgres+Redis+R2, env, domen, health, alert webhook. 
3. `main` uchun branch protection + required review.

**Hafta 2 — compliance & xavf**
4. Huquqiy hujjatlar (ToS, Privacy, Refund, Creator Agreement), checkout/registratsiya consent.
5. Fraud v1, ko'rinadigan admin navbat.
6. Sentry + uptime monitor.

**Hafta 3–4 — o'sish tayyorligi**
7. Payme adapteri; SMS (OTP/bildirishnoma); rus tili (kamida landing + checkout).
8. Merchant modeli uchun ADR + schema loyihasi (`Merchant`, `merchantId` migratsiya rejasi).
9. 5 ta pilot merchant bilan shartnoma/intervyu.

---

## 9. Ochiq savollar (sizning javobingiz kerak)
1. Haqiqiy production hozir qayerda ishlayapti (Railway akkaunt/loyiha)? Bu loyiha eskirganmi?
2. Hozir nechta faol creator/buyurtma/oylik GMV bor? (strategiyaning raqamlarini shunga moslashtiraman)
3. "Ochiq" deganda asosan merchant'larni nazarda tutyapsizmi yoki katalog/marketplace?
4. Yuridik shaxs/soliq rejimi qanday (MChJ/YaTT, QQS)?

---
*Manbalar:* [kun.uz — Uzum e-commerce prognozi](https://kun.uz/en/news/2026/07/10/uzum-yonalishidagi-ye-sommerce-aylanmasi-1-milliard-dollarga-yetishi-mumkin) · [UzDaily — Uzum 20M foydalanuvchi](https://uzdaily.ru/en/uzum-surpasses-20-million-users/) · [UzDaily — 2025 onlayn savdo 22.7 trln so'm](https://uzdaily.ru/en/online-sales-in-uzbekistan-reach-227-trillion-soums-in-2025/) · [Intellinews — Uzum 2025 natijalari](https://www.intellinews.com/uzbekistan-s-uzum-reports-2025-bottom-line-of-176mn-fintech-fastest-growing-vertical-425973/) · [KPMG/PRNewswire prognozi](https://www.prnewswire.com/ae/news-releases/uzbekistan-e-commerce-market-is-set-to-grow-7-times-to-2-2-billion-usd-by-2027-kpmg-301910650.html) · [UzDaily — Yandex Ads/Telegram creators](https://www.uzdaily.uz/en/yandex-uzbekistan-expands-support-for-creators-and-media-on-telegram/) · [101digital.uz — O'zbekiston raqamli marketing 2026](https://101digital.uz/en/blog/uzbekistan-digital-marketing-report-2026/) · [wmtips — affiliate tarmoqlar UZ](https://www.wmtips.com/technologies/affiliate-marketing/country/uz/) · [Modash — influencer-affiliate platformalar](https://www.modash.io/blog/influencer-affiliate-platforms)
