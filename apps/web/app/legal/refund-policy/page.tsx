import type { Metadata } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: `Qaytarish siyosati — ${BRAND.name}`,
  description: `${BRAND.name} orqali xarid qilingan mahsulotlarni qaytarish shartlari.`,
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Qaytarish siyosati" updatedAt="2026-07-30">
      <p>
        Ushbu Qaytarish siyosati {BRAND.name} orqali xarid qilingan mahsulot yoki xizmatni qaytarish va
        pulni qaytarib olish tartibini belgilaydi.
      </p>

      <h2>1. Qaytarish uchun shartlar</h2>
      <ul>
        <li>Mahsulot yetkazib berilgan kundan boshlab <strong>7 kalendar kuni</strong> ichida qaytarish
          so&apos;rovi berilishi mumkin;</li>
        <li>Mahsulot ishlatilmagan, asl qadog&apos;i va yorliqlari saqlangan holatda bo&apos;lishi kerak;</li>
        <li>Nuqsonli yoki buyurtma qilinganidan farqli mahsulot yetkazilgan taqdirda, qaytarish muddati
          cheklanmaydi — bunday holat aniqlangan kundan boshlab imkon qadar tezroq murojaat qilinishi so&apos;raladi;</li>
        <li>Gigiena talab qiladigan mahsulotlar (masalan, ochilgan kosmetika) va individual buyurtma asosida
          tayyorlangan mahsulotlar, agar nuqsonli bo&apos;lmasa, qaytarilmaydi.</li>
      </ul>

      <h2>2. To&apos;liq va qisman qaytarish farqi</h2>
      <ul>
        <li><strong>To&apos;liq qaytarish</strong> — mahsulot butunlay qaytarilganda yoki buyurtma umuman
          yetkazilmaganda, to&apos;langan summaning 100% qaytariladi;</li>
        <li><strong>Qisman qaytarish</strong> — buyurtmadagi bir nechta mahsulotdan faqat ba&apos;zilari
          qaytarilganda yoki nuqson faqat qiymatning bir qismiga taalluqli bo&apos;lganda qo&apos;llaniladi.</li>
      </ul>

      <h2>3. Qaytarish so&apos;rovini yuborish tartibi</h2>
      <ol>
        <li>Buyurtma raqamingiz bilan {BRAND.supportEmail} manziliga murojaat qiling yoki shaxsiy kabinetdagi
          buyurtma tafsilotlari sahifasidan qaytarish so&apos;rovini yuboring;</li>
        <li>Qaytarish sababini va (agar mavjud bo&apos;lsa) mahsulot holatini tasdiqlovchi rasmlarni
          qo&apos;shing;</li>
        <li>So&apos;rov <strong>2 ish kuni</strong> ichida ko&apos;rib chiqiladi va natija haqida sizga
          xabar beriladi;</li>
        <li>Tasdiqlangan taqdirda, mahsulotni qaytarish (agar talab qilinsa) yoki to&apos;g&apos;ridan-to&apos;g&apos;ri
          pulni qaytarish jarayoni boshlanadi.</li>
      </ol>

      <h2>4. Pulni qaytarish muddati</h2>
      <ul>
        <li><strong>Click.uz orqali onlayn to&apos;langan</strong> buyurtmalar uchun — tasdiqlangan
          qaytarish so&apos;rovidan so&apos;ng pul xuddi shu karta/hisobga <strong>3–10 ish kuni</strong>
          ichida qaytariladi (aniq muddat Click.uz bank tomonidan belgilanadi);</li>
        <li><strong>Yetkazib berishda naqd to&apos;langan</strong> buyurtmalar uchun — pul qaytarish
          bank o&apos;tkazmasi orqali, xaridor ko&apos;rsatgan hisob raqamiga amalga oshiriladi.</li>
      </ul>

      <h2>5. Yetkazib berilgan mahsulotlar uchun maxsus shartlar</h2>
      <p>
        Fizik mahsulotni qaytarish uchun uni yetkazib berish (yoki ko&apos;rsatilgan manzilga jo&apos;natish)
        xarajati, agar qaytarish sababi Platforma yoki yetkazib beruvchining xatosi bo&apos;lmasa, xaridor
        zimmasida bo&apos;lishi mumkin. Nuqsonli yoki noto&apos;g&apos;ri mahsulot yetkazilgan holatda bu
        xarajatni Platforma qoplaydi.
      </p>

      <h2>6. Xizmat turidagi takliflar uchun maxsus shartlar</h2>
      <p>
        Xizmat yoki konsultatsiya (masalan, onlayn kurs, konsultatsiya seansi) allaqachon boshlangan yoki
        to&apos;liq ko&apos;rsatilgan bo&apos;lsa, qaytarish qo&apos;llanilmaydi — bunday holatlar har bir
        taklif sahifasida alohida ko&apos;rsatiladi. Xizmat hali boshlanmagan bo&apos;lsa, standart
        qaytarish shartlari amal qiladi.
      </p>

      <h2>7. Bog&apos;lanish</h2>
      <p>
        Qaytarish bo&apos;yicha barcha savollar uchun: <a href={`mailto:${BRAND.supportEmail}`} className="text-accent underline">{BRAND.supportEmail}</a>
      </p>
    </LegalPage>
  );
}
