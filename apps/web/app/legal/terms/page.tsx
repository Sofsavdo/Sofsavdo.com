import { LegalDraftPage } from "@/components/legal/LegalDraftPage";

export default function TermsPage() {
  return (
    <LegalDraftPage
      title="Foydalanish shartlari"
      sections={[
        "Xizmat tavsifi",
        "Foydalanuvchi majburiyatlari",
        "To'lov va buyurtma shartlari",
        "Creator dasturi qoidalari",
        "Javobgarlikni cheklash",
        "Shartlarga o'zgartirish kiritish tartibi",
        "Amal qiluvchi qonunchilik va yurisdiksiya",
      ]}
    />
  );
}
