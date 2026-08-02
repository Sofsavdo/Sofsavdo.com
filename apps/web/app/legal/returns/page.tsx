export default function ReturnsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Qaytarish va Garantiya Siyosati</h1>
      
      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Umumiy Qoidalar</h2>
          <p className="text-gray-600 mb-4">
            Sofsavdo platformasi orqali sotib olingan mahsulotlarni qaytarish va almashtirish bo'yicha quyidagi qoidalarga amal qiladi.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Qaytarish Muddati</h2>
          <p className="text-gray-600 mb-4">
            Mahsulotni qaytarish uchun quyidagi muddatlar ichida murojaat qilishingiz mumkin:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Fizik mahsulotlar: 14 kun</li>
            <li>Digital mahsulotlar: 7 kun</li>
            <li>Xizmatlar: xizmat boshlanishidan oldin 24 soat</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Qaytarish Shartlari</h2>
          <p className="text-gray-600 mb-4">
            Mahsulotni qaytarish uchun quyidagi shartlar bajarilishi kerak:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Mahsulot asl holatida bo'lishi kerak</li>
            <li>O'rash va qadoqlash saqlanib qolishi kerak</li>
            <li>Xarid qog'ozini taqdim etish kerak</li>
            <li>Mahsulotda ishlab chiqaruvchi nuqsonlari bo'lishi kerak</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Qaytarish Jarayoni</h2>
          <p className="text-gray-600 mb-4">
            Qaytarish uchun quyidagi amallarni bajaring:
          </p>
          <ol className="list-decimal pl-6 text-gray-600 space-y-2">
            <li>Profil sahifasidan "Buyurtmalar" bo'limiga o'ting</li>
            <li>Qaytarmoqchi bo'lgan mahsulotni tanlang</li>
            <li>"Qaytarish so'rovi" tugmasini bosing</li>
            <li>Qaytarish sababini va fotosuratlarini yuklang</li>
            <li>So'rovni yuboring</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Pul Qaytarish</h2>
          <p className="text-gray-600 mb-4">
            Pul qaytarish quyidagi usullarda amalga oshiriladi:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Xarid qilingan usulda (karta, pul o'tkazmasi)</li>
            <li>So'rov tasdiqlanganidan keyin 5-7 ish kuni ichida</li>
            <li>Bank komissiyalari mijoz tomonidan qoplanadi</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Garantiya</h2>
          <p className="text-gray-600 mb-4">
            Ba'zi mahsulotlar uchun ishlab chiqaruvchi tomonidan kafolat beriladi:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Elektronika: 6-12 oy</li>
            <li>Kiyim-boshlar: 30 kun</li>
            <li>Boshqa mahsulotlar: mahsulot tavsifida ko'rsatilgan muddat</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Aloqa</h2>
          <p className="text-gray-600 mb-4">
            Qo'shimcha savollar uchun biz bilan bog'laning:
          </p>
          <p className="text-gray-600">
            Email: support@sofsavdo.com<br />
            Telefon: +998 71 200 00 00
          </p>
        </section>
      </div>
    </div>
  );
}
