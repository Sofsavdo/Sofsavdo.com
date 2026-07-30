import type { Metadata } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: `Foydalanish shartlari — ${BRAND.name}`,
  description: `${BRAND.name} platformasidan foydalanish shartlari.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Foydalanish shartlari" updatedAt="2026-07-30">
      <p>
        Ushbu Foydalanish shartlari (&quot;Shartlar&quot;) {BRAND.name} ({BRAND.domain}, &quot;Platforma&quot;, &quot;biz&quot;)
        xizmatlaridan foydalanadigan har bir shaxsga — xaridor, creator (ijodkor-hamkor) yoki admin sifatida —
        taalluqlidir. Platformadan foydalanish orqali siz ushbu Shartlarga rozilik bildirasiz.
      </p>

      <h2>1. Xizmat tavsifi</h2>
      <p>
        {BRAND.name} — mahsulot va xizmatlarni onlayn sotib olish imkonini beruvchi elektron savdo platformasi bo&apos;lib,
        shu bilan birga creator&apos;lar (blogger, ijodkor, ijtimoiy tarmoq egalari) uchun referal dastur orqali
        mahsulotlarni tavsiya qilish va shundan komissiya olish imkonini ham beradi. Platforma orqali:
      </p>
      <ul>
        <li>xaridorlar ro&apos;yxatdan o&apos;tmasdan yoki shaxsiy kabinet orqali buyurtma berishlari mumkin;</li>
        <li>to&apos;lov Click.uz orqali onlayn yoki yetkazib berishda naqd pul bilan amalga oshiriladi;</li>
        <li>creator&apos;lar admin tomonidan tasdiqlangan kampaniyalarga qo&apos;shilib, o&apos;zlarining referal
          havolalari orqali amalga oshirilgan sotuvlardan komissiya olishadi.</li>
      </ul>

      <h2>2. Foydalanuvchi majburiyatlari</h2>
      <ul>
        <li>Ro&apos;yxatdan o&apos;tishda (xaridor yoki creator sifatida) haqiqiy va to&apos;g&apos;ri ma&apos;lumot
          taqdim etish;</li>
        <li>Akkaunt maxfiyligini (parol) saqlash — akkaunt orqali amalga oshirilgan har qanday harakat uchun
          foydalanuvchining o&apos;zi javobgar hisoblanadi;</li>
        <li>Platformani noqonuniy maqsadlarda, firibgarlik, yolg&apos;on buyurtma yoki soxta creator faoliyati
          uchun ishlatmaslik;</li>
        <li>Creator sifatida — kampaniya shartlarida ko&apos;rsatilgan kontent talablari va auditoriya
          qoidalariga rioya qilish.</li>
      </ul>

      <h2>3. To&apos;lov va buyurtma shartlari</h2>
      <ul>
        <li>Buyurtma tasdiqlangach, mahsulot narxi, yetkazib berish narxi va (agar mavjud bo&apos;lsa) chegirma
          buyurtma tafsilotlarida aniq ko&apos;rsatiladi;</li>
        <li>Onlayn to&apos;lov Click.uz orqali xavfsiz amalga oshiriladi — karta ma&apos;lumotlari Sofsavdo
          serverlarida saqlanmaydi, to&apos;lovni bevosita Click.uz qayta ishlaydi;</li>
        <li>Yetkazib berishda naqd to&apos;lov (agar mahsulot uchun mavjud bo&apos;lsa) — buyurtma yetkazilganda
          kuryerga naqd to&apos;lanadi;</li>
        <li>Buyurtma holati (qabul qilindi, tayyorlanmoqda, yo&apos;lda, yetkazildi) haqida xaridor xabardor
          qilinadi.</li>
      </ul>

      <h2>4. Creator dasturi qoidalari</h2>
      <ul>
        <li>Creator sifatida ishtirok etish uchun ariza topshirish va admin tomonidan tasdiqlanish talab
          qilinadi;</li>
        <li>Komissiya miqdori va sharti har bir kampaniyada alohida ko&apos;rsatiladi va faqat shu kampaniya
          orqali amalga oshirilgan, admin tomonidan tasdiqlangan sotuvlarga taalluqlidir;</li>
        <li>Pul yechish (payout) so&apos;rovlari admin tomonidan ko&apos;rib chiqiladi va tasdiqlangan
          hisoblangan komissiya asosida amalga oshiriladi;</li>
        <li>Sun&apos;iy ravishda o&apos;z-o&apos;ziga buyurtma berish, soxta sotuv yaratish yoki auditoriyani
          chalg&apos;ituvchi reklama orqali komissiya olishga urinish — creator hamkorligini bekor qilish
          sababi bo&apos;ladi.</li>
      </ul>

      <h2>5. Javobgarlikni cheklash</h2>
      <p>
        Platforma mahsulotlarning sifatini ta&apos;minlash uchun oqilona choralar ko&apos;radi, biroq
        yetkazib berish muddatidagi kechikish, uchinchi tomon (Click.uz, kuryerlik xizmati) tomonidan
        yuzaga kelgan uzilishlar uchun to&apos;liq javobgarlikni o&apos;z zimmasiga olmaydi. Bunday holatlarda
        Platforma muammoni hal qilishga ko&apos;maklashadi va {BRAND.supportEmail} orqali murojaatlarni
        ko&apos;rib chiqadi.
      </p>

      <h2>6. Shartlarga o&apos;zgartirish kiritish tartibi</h2>
      <p>
        Ushbu Shartlar vaqti-vaqti bilan yangilanishi mumkin. Muhim o&apos;zgarishlar haqida foydalanuvchilar
        Platforma orqali yoki elektron pochta orqali xabardor qilinadi. O&apos;zgargan Shartlardan keyin
        Platformadan foydalanishni davom ettirish — yangi shartlarga roziligingiz hisoblanadi.
      </p>

      <h2>7. Amal qiluvchi qonunchilik va yurisdiksiya</h2>
      <p>
        Ushbu Shartlar O&apos;zbekiston Respublikasi qonunchiligiga muvofiq tuziladi va talqin qilinadi.
        Har qanday nizo, avvalo, muzokaralar yo&apos;li bilan, kelishuvga erishilmagan taqdirda esa
        O&apos;zbekiston Respublikasining tegishli sudlarida hal qilinadi.
      </p>

      <h2>8. Bog&apos;lanish</h2>
      <p>
        Savol yoki shikoyatlar bo&apos;yicha: <a href={`mailto:${BRAND.supportEmail}`} className="text-accent underline">{BRAND.supportEmail}</a>
      </p>
    </LegalPage>
  );
}
