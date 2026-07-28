import { LegalDraftPage } from "@/components/legal/LegalDraftPage";

export default function RefundPolicyPage() {
  return (
    <LegalDraftPage
      title="Qaytarish siyosati"
      sections={[
        "Qaytarish uchun shartlar (qaysi holatlarda, qancha muddat ichida)",
        "To'liq va qisman qaytarish farqi",
        "Qaytarish so'rovini yuborish tartibi",
        "Pulni qaytarish muddati (Click.uz orqali)",
        "Yetkazib berilgan mahsulotlar uchun maxsus shartlar",
        "Xizmat turidagi takliflar uchun maxsus shartlar",
      ]}
    />
  );
}
