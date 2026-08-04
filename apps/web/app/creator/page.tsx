/**
 * Creator Partnership Landing Page
 * 
 * Landing page for creators to learn about the partnership program
 */

'use client';

import { useState } from 'react';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedInput } from '@/components/simplified/simplified-input';

export default function CreatorLandingPage() {
  const [dailySales, setDailySales] = useState('');
  const [avgOrder, setAvgOrder] = useState('');
  
  const monthlyEarnings = dailySales && avgOrder 
    ? parseInt(dailySales) * parseInt(avgOrder) * 30 
    : 0;
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-purple-600">Sofsavdo</h1>
            <SimplifiedButton variant="primary" onClick={() => window.location.href = '/creator/register'}>
              Ro&apos;yxatdan o&apos;tish
            </SimplifiedButton>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Bloger bo&apos;lib daromad toping
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            3 daqiqada ro&apos;yxatdan o&apos;ting, 5 daqiqada birinchi link oling
          </p>
          <div className="flex gap-4 justify-center">
            <SimplifiedButton 
              variant="primary" 
              size="lg"
              onClick={() => window.location.href = '/creator/register'}
            >
              Ro&apos;yxatdan o&apos;tish
            </SimplifiedButton>
            <SimplifiedButton
              variant="outline"
              size="lg"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Batafsil
            </SimplifiedButton>
          </div>
        </div>
      </section>
      
      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Qanday ishlaydi?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">1</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Ro&apos;yxatdan o&apos;ting</h3>
              <p className="text-gray-600">3 daqiqada bepul ro&apos;yxatdan o&apos;ting</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">2</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Mahsulot tanlang</h3>
              <p className="text-gray-600">Yuzlab mahsulotlardan tanlang</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Link tarqating</h3>
              <p className="text-gray-600">Linkni tarqating, daromad toping</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Earnings Calculator */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Daromad hisoblagich
          </h2>
          <SimplifiedCard>
            <SimplifiedCardContent>
              <div className="space-y-4">
                <SimplifiedInput
                  label="Kunlik sotuvlar"
                  type="number"
                  placeholder="5"
                  value={dailySales}
                  onChange={(e) => setDailySales(e.target.value)}
                />
                <SimplifiedInput
                  label="O'rtacha buyurtma summasi (so'm)"
                  type="number"
                  placeholder="100000"
                  value={avgOrder}
                  onChange={(e) => setAvgOrder(e.target.value)}
                />
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Oylik daromad (20% комиссия):</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatPrice(monthlyEarnings * 20)}
                  </p>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
      </section>
      
      {/* Benefits */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Nima uchun Sofsavdo?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Sodda</h3>
                <p className="text-gray-600">3 daqiqada ro&apos;yxatdan o&apos;tish, 5 daqiqada link olish</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Tez</h3>
                <p className="text-gray-600">Real-time earnings, tez payout</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Ishonchli</h3>
                <p className="text-gray-600">14-kunlik hold, shaffof tracking</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Bepul</h3>
                <p className="text-gray-600">Hech qanday investitsiya kerak emas</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Mahalliy</h3>
                <p className="text-gray-600">O&apos;zbekiston uchun moslashgan</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Support</h3>
                <p className="text-gray-600">O&apos;zbek tilida 24/7 support</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-16 px-4 bg-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Bugun boshlang
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            3 daqiqada ro&apos;yxatdan o&apos;ting, daromad topishni boshlang
          </p>
          <SimplifiedButton 
            variant="primary" 
            size="lg"
            className="bg-white text-purple-600 hover:bg-gray-100"
            onClick={() => window.location.href = '/creator/register'}
          >
            Ro&apos;yxatdan o&apos;tish
          </SimplifiedButton>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Savol-javob
          </h2>
          <div className="space-y-4">
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Ro&apos;yxatdan o&apos;tish bepulmi?</h3>
                <p className="text-gray-600">Ha, ro&apos;yxatdan o&apos;tish to&apos;liq bepul. Hech qanday investitsiya kerak emas.</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Qancha daromad topishim mumkin?</h3>
                <p className="text-gray-600">Daromad sizning sotuvlaringizga bog&apos;liq. O&apos;rtacha 20% komissiya olasiz.</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Payout qachon bo&apos;ladi?</h3>
                <p className="text-gray-600">Buyurtma yetkazib berilgandan so&apos;ng 14 kun ichida payout bo&apos;ladi.</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <h3 className="font-bold text-gray-900 mb-2">Qanday payout olish mumkin?</h3>
                <p className="text-gray-600">Bank kartasiga yoki Click orqali payout olish mumkin.</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
        </div>
      </section>
    </div>
  );
}
