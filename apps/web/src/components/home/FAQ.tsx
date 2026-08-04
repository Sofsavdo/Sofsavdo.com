export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqContent {
  heading?: string;
  items?: FaqItem[];
}

const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    question: "Qachon to'layman?",
    answer: "Hech qanday oldindan to'lov shart emas — buyurtmani tasdiqlab, mahsulotni yetkazib berishda qabul qilib olasiz.",
  },
  {
    question: "Yetkazib berish qancha vaqt oladi?",
    answer: "Yetkazib berish muddati hududga va mahsulotga qarab farq qiladi — aniq muddat buyurtma sahifasida ko'rsatiladi.",
  },
  {
    question: "Buyurtmani qanday kuzataman?",
    answer: "Buyurtma tasdiqlangandan so'ng sizga holat haqida xabar yuboriladi; buyurtma tafsilotlari sahifasida joriy holatni ko'rishingiz mumkin.",
  },
  {
    question: "Mahsulotni qaytarish mumkinmi?",
    answer: "Ha, qaytarish shartlari bilan qaytarish siyosati sahifasida tanishishingiz mumkin.",
  },
];

// Native <details>/<summary> — zero client JS for a purely presentational accordion, consistent
// with this page's "Server Components preferred, performance highest priority" mandate.
export function FAQ({ content }: { content?: FaqContent }) {
  const heading = content?.heading || "Ko'p so'raladigan savollar";
  const items = content?.items?.length ? content.items : DEFAULT_FAQ_ITEMS;

  return (
    <section className="mx-auto max-w-3xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <h2 className="text-center font-heading text-2xl font-bold text-text-primary md:text-3xl">{heading}</h2>
      <div className="mt-8 space-y-3">
        {items.map(({ question, answer }) => (
          <details key={question} className="group rounded-card border border-border bg-surface p-4 shadow-card open:shadow-elevated">
            <summary className="cursor-pointer list-none font-body font-medium text-text-primary marker:content-none">
              {question}
            </summary>
            <p className="mt-2 font-body text-sm text-text-secondary">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
