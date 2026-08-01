import type { Metadata } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import Link from "next/link";
import { productsV2Service, type SimplifiedProductDto } from "@/services/v2/products-v2.service";

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name} — tanlangan mahsulotlar, ishonchli to'lov va tez yetkazib berish.`,
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
            <Link href="/buyer/market">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Mahsulotlar
              </button>
            </Link>
            <Link href="/creator/dashboard">
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                Creator
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Eng yaxshi mahsulotlar va xizmatlar
          </h2>
          <p className="text-lg md:text-xl mb-6 text-blue-100">
            Tanlangan mahsulotlar, ishonchli to'lov va tez yetkazib berish
          </p>
          <Link href="/buyer/market">
            <button className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Mahsulotlarni ko'rish
            </button>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Mashhur mahsulotlar</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.slice(0, 12).map((product, index) => (
            <Link key={product.id} href={`/buyer/v2/products/${product.id}`} className={index >= 6 ? 'hidden md:block' : ''}>
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
        <div className="text-center mt-6">
          <Link href="/buyer/market">
            <button className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
              Barcha mahsulotlar
            </button>
          </Link>
        </div>
      </section>

      {/* Creator CTA */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-4">Creator bo'ling va daromad oling</h3>
          <p className="text-lg mb-6 text-purple-100">
            Mahsulotlarni targ'ib qiling va har bir sotuvdan komissiya oling
          </p>
          <Link href="/creator/dashboard">
            <button className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Boshlash
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
                Tanlangan mahsulotlar, ishonchli to'lov va tez yetkazib berish.
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
