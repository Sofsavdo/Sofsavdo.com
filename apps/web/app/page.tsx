import type { Metadata } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import Link from "next/link";
import { productsV2Service, type SimplifiedProductDto } from "@/services/v2/products-v2.service";

export const metadata: Metadata = {
  title: `${BRAND.name} — Affiliate Marketing va Blogger Hamkorlik Dasturi`,
  description: `${BRAND.name} — blogerlar va kontent yaratuvchilar uchun affiliate marketing platformasi. Mahsulotlarni targ'ib qiling, komissiya oling va daromad yarating. Pul tikmasdan daromad olish imkoniyati.`,
};

// Mobile-first simplified landing page
export default async function HomePage() {
  let products: SimplifiedProductDto[] = [];
  try {
    const response = await productsV2Service.list({ status: 'ACTIVE', take: 12 });
    products = response.items;
  } catch (error) {
    console.error('Failed to load products:', error);
  }

  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{BRAND.name}</h1>
          <div className="flex gap-2">
            <Link href="/catalog">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Mahsulotlar
              </button>
            </Link>
            <Link href="/creator/dashboard">
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">
                Creator sifatida qo'shiling
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Affiliate/Blogger Focus */}
      <section className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Blogerlar va Creatorlar uchun Affiliate Platformasi
          </h2>
          <p className="text-lg md:text-xl mb-6 text-purple-100 max-w-2xl mx-auto">
            Mahsulotlarni targ'ib qiling, har bir sotuvdan komissiya oling. Pul tikmasdan daromad yarating va o'z auditoriyangizdan foydalaning.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/creator/dashboard">
              <button className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Creator sifatida boshlash
              </button>
            </Link>
            <Link href="/catalog">
              <button className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors">
                Mahsulotlarni ko'rish
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">Qanday ishlaydi?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📱</span>
            </div>
            <h4 className="font-bold text-gray-900 mb-2">1. Ro'yxatdan o'ting</h4>
            <p className="text-gray-600 text-sm">Creator sifatida ro'yxatdan o'ting va profilingizni to'ldiring</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔗</span>
            </div>
            <h4 className="font-bold text-gray-900 mb-2">2. Mahsulotlarni tanlang</h4>
            <p className="text-gray-600 text-sm">Kampaniyalarda qatnashish va referral havolalarni oling</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h4 className="font-bold text-gray-900 mb-2">3. Daromad oling</h4>
            <p className="text-gray-600 text-sm">Har bir sotuvdan komissiya oling va daromadingizni yeching</p>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Mashhur mahsulotlar</h3>
          <Link href="/catalog" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Barchasini ko'rish →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.slice(0, 12).map((product, index) => (
            <Link key={product.id} href={`/catalog`} className={index >= 6 ? 'hidden md:block' : ''}>
              <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-200">
                <div className="aspect-square bg-gray-100">
                  <img
                    src={product.images[0] || '/placeholder.png'}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                    {product.title}
                  </h4>
                  <p className="text-lg font-bold text-blue-600">
                    {formatPrice(product.priceMinor)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold mb-8 text-center">Nima uchun {BRAND.name}?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🎯</div>
              <h4 className="font-bold mb-2">Yuqori komissiya</h4>
              <p className="text-gray-400 text-sm">Har bir sotuvdan katta foizda komissiya oling</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">⚡</div>
              <h4 className="font-bold mb-2">Tez to'lov</h4>
              <p className="text-gray-400 text-sm">Daromadingizni tez va oson yeching</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📊</div>
              <h4 className="font-bold mb-2">Analitika</h4>
              <p className="text-gray-400 text-sm">Batafsil statistika va hisobotlar</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🤝</div>
              <h4 className="font-bold mb-2">Qo'llab-quvvatlash</h4>
              <p className="text-gray-400 text-sm">Professional yordam va maslahatlar</p>
            </div>
          </div>
        </div>
      </section>

      {/* Creator CTA */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">Bugundan boshlang va daromad oling</h3>
          <p className="text-lg mb-6 text-purple-100 max-w-2xl mx-auto">
            Yuzlab creatorlar allaqachon {BRAND.name} orqali daromad qilmoqda. Siz ham ularga qo'shiling!
          </p>
          <Link href="/creator/dashboard">
            <button className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Creator sifatida ro'yxatdan o'tish
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h4 className="font-bold mb-4">{BRAND.name}</h4>
              <p className="text-gray-400 text-sm">
                Blogerlar va kontent yaratuvchilar uchun affiliate marketing platformasi. Mahsulotlarni targ'ib qiling va daromad yarating.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Foydalanish shartlari</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/legal/privacy" className="hover:text-white">Maxfiylik siyosati</Link></li>
                <li><Link href="/legal/terms" className="hover:text-white">Foydalanish shartlari</Link></li>
                <li><Link href="/legal/returns" className="hover:text-white">Qaytarish siyosati</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Biz bilan bog'lanish</h4>
              <p className="text-gray-400 text-sm">
                Email: info@sofsavdo.com
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="text-gray-400">© {new Date().getFullYear()} {BRAND.name}. Barcha huquqlar himoyalangan.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
