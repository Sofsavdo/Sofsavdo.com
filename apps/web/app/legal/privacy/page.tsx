import { LegalDraftPage } from "@/components/legal/LegalDraftPage";

export default function PrivacyPolicyPage() {
  return (
    <LegalDraftPage
      title="Maxfiylik siyosati"
      sections={[
        "Qanday shaxsiy ma'lumotlar to'planadi (ism, telefon, manzil, to'lov ma'lumotlari)",
        "Ma'lumotlardan qanday foydalaniladi",
        "Ma'lumotlar kim bilan bo'lishiladi (Click.uz kabi to'lov provayderlari)",
        "Ma'lumotlarni saqlash muddati",
        "Foydalanuvchi huquqlari (ma'lumotni ko'rish, o'chirish so'rovi)",
        "Cookie va kuzatuv texnologiyalari",
        "Bog'lanish uchun kontakt",
      ]}
    />
  );
}
