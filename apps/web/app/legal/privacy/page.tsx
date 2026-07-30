import type { Metadata } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: `Maxfiylik siyosati — ${BRAND.name}`,
  description: `${BRAND.name} shaxsiy ma'lumotlarni qanday to'plashi va ishlatishi.`,
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Maxfiylik siyosati" updatedAt="2026-07-30">
      <p>
        Ushbu Maxfiylik siyosati {BRAND.name} ({BRAND.domain}) qanday shaxsiy ma&apos;lumotlarni to&apos;plashi,
        ulardan qanday foydalanishi va qanday himoya qilishini tushuntiradi.
      </p>

      <h2>1. Qanday shaxsiy ma&apos;lumotlar to&apos;planadi</h2>
      <ul>
        <li><strong>Xaridorlar uchun:</strong> ism-familiya, telefon raqami, yetkazib berish manzili, buyurtma
          tarixi. Karta ma&apos;lumotlari (karta raqami, CVC) hech qachon Sofsavdo serverlarida saqlanmaydi —
          onlayn to&apos;lov to&apos;g&apos;ridan-to&apos;g&apos;ri Click.uz orqali amalga oshiriladi;</li>
        <li><strong>Creator&apos;lar uchun:</strong> ism, elektron pochta, ijtimoiy tarmoq profillari, kontent
          niyati, pul yechish uchun to&apos;lov usuli (karta raqami shifrlangan holda saqlanadi va hech qachon
          to&apos;liq ko&apos;rinishda ko&apos;rsatilmaydi — faqat oxirgi 4 raqam);</li>
        <li><strong>Barcha foydalanuvchilar uchun:</strong> elektron pochta, parol (shifrlangan holda saqlanadi,
          hech qachon oddiy matn ko&apos;rinishida emas), akkaunt bilan bog&apos;liq texnik ma&apos;lumotlar
          (kirish vaqti, IP manzil — xavfsizlik maqsadida).</li>
      </ul>

      <h2>2. Ma&apos;lumotlardan qanday foydalaniladi</h2>
      <ul>
        <li>Buyurtmani qabul qilish, tayyorlash va yetkazib berish uchun;</li>
        <li>Creator&apos;larning komissiyasini hisoblash va pul yechish so&apos;rovlarini amalga oshirish uchun;</li>
        <li>Buyurtma holati, tasdiqlash, bildirishnomalar (email/Telegram) yuborish uchun;</li>
        <li>Akkauntni xavfsiz saqlash va firibgarlikning oldini olish uchun;</li>
        <li>Platformani yaxshilash maqsadida umumlashtirilgan (shaxsni aniqlamaydigan) statistika sifatida.</li>
      </ul>
      <p>Ma&apos;lumotlar hech qachon uchinchi tomonlarga marketing maqsadida sotilmaydi.</p>

      <h2>3. Ma&apos;lumotlar kim bilan bo&apos;lishiladi</h2>
      <ul>
        <li><strong>Click.uz</strong> — onlayn to&apos;lovni qayta ishlash uchun zarur bo&apos;lgan buyurtma
          summasi va to&apos;lov identifikatorini oladi, karta ma&apos;lumotlarini emas;</li>
        <li><strong>Yetkazib berish xizmati (kuryer)</strong> — faqat buyurtmani yetkazish uchun zarur bo&apos;lgan
          ism, telefon va manzilni oladi;</li>
        <li>Qonun talab qilgan hollarda — vakolatli davlat organlariga.</li>
      </ul>

      <h2>4. Ma&apos;lumotlarni saqlash muddati</h2>
      <p>
        Akkaunt faol bo&apos;lgan davrda shaxsiy ma&apos;lumotlar saqlanadi. Buyurtma va moliyaviy operatsiyalarga
        oid yozuvlar soliq va buxgalteriya hisobi qonunchiligi talab qiladigan muddat davomida saqlanishi mumkin,
        hatto akkaunt o&apos;chirilgandan keyin ham. Akkaunt o&apos;chirilgandan so&apos;ng shaxsni bevosita
        aniqlaydigan ma&apos;lumotlar (ism, telefon, manzil) amaldagi qonunchilikka zid kelmagan holda
        o&apos;chiriladi yoki anonimlashtiriladi.
      </p>

      <h2>5. Foydalanuvchi huquqlari</h2>
      <ul>
        <li>O&apos;zingiz haqingizda saqlanayotgan ma&apos;lumotlarni ko&apos;rish — shaxsiy kabinet (Profil
          bo&apos;limi) orqali yoki {BRAND.supportEmail} ga murojaat qilib;</li>
        <li>Ma&apos;lumotlarni to&apos;g&apos;irlash — profil sozlamalari orqali;</li>
        <li>Ma&apos;lumotlarni o&apos;chirishni so&apos;rash — {BRAND.supportEmail} ga yozib (qonuniy saqlash
          majburiyati bo&apos;lgan yozuvlar bundan mustasno).</li>
      </ul>

      <h2>6. Cookie va kuzatuv texnologiyalari</h2>
      <p>
        Platforma sessiyani saqlash (kirgan holatingizni eslab qolish) va referal havolalarni to&apos;g&apos;ri
        hisoblash uchun zarur cookie&apos;lardan foydalanadi. Bular reklama maqsadida uchinchi tomon
        kuzatuvchilariga (Facebook Pixel va h.k.) uzatilmaydi.
      </p>

      <h2>7. Xavfsizlik</h2>
      <p>
        Parollar qaytarib bo&apos;lmaydigan tarzda shifrlanadi (hashlanadi), creator&apos;larning to&apos;lov
        karta raqamlari AES-256 shifrlash bilan saqlanadi. Barcha ma&apos;lumotlar almashinuvi HTTPS orqali
        shifrlangan holda amalga oshiriladi.
      </p>

      <h2>8. Bog&apos;lanish uchun kontakt</h2>
      <p>
        Maxfiylik bo&apos;yicha savol yoki so&apos;rovlar uchun: <a href={`mailto:${BRAND.supportEmail}`} className="text-accent underline">{BRAND.supportEmail}</a>
      </p>
    </LegalPage>
  );
}
