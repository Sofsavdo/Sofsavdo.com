import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-pad-mobile text-center md:px-pad-desktop">
      <p className="font-heading text-5xl font-bold text-text-primary">404</p>
      <h1 className="mt-2 font-heading text-xl font-bold text-text-primary">Sahifa topilmadi</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">Siz izlagan sahifa mavjud emas yoki ko&apos;chirilgan.</p>
      <Link href="/" className="mt-6 inline-block rounded-button bg-accent px-5 py-2 font-body text-sm font-medium text-white hover:bg-accent-hover">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
