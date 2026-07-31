// Backend mirror of apps/web/src/lib/uz-regions.ts — NOT a re-export. Same reason as
// apps/api/src/config/brand.ts's own mirror comment: NestJS's runtime require()s workspace files
// outside apps/api/src/'s own compile step as plain Node modules, which chokes on raw `.ts`
// syntax, so cross-app sharing via an import isn't viable here — the two copies are kept manually
// in sync instead. This copy backs DeliveryService's bulk-seed endpoint; the web copy backs the
// admin/buyer region pickers.
//
// Canonical Uzbekistan delivery-zone list — the single source of truth for both the admin's
// delivery-region picker (DeliveryRegionsManager.tsx) and the buyer's checkout region selector
// (CheckoutPageClient.tsx / DeliveryQuoteBox.tsx), replacing free-text region entry with a real
// picklist. Compiled from general knowledge of Uzbekistan's administrative-territorial division
// (12 viloyat + Toshkent shahar + Qoraqalpog'iston Respublikasi, each viloyat's tuman list) — not
// pulled from a live government registry, so a handful of district names may be stale after a
// renaming/restructuring. Each OfferDeliveryRegion row created from this list is a completely
// normal, independently editable admin row afterward (same as one entered by hand) — so any
// correction is a one-field edit away, never a code change.
//
// Pricing (per the business rule this list exists to enforce): Toshkent shahar is free delivery;
// every other viloyat's own administrative center (`REGIONAL_CENTER`) is a flat rate; every
// district/secondary city within a viloyat (`DISTRICT`) is a second, slightly higher flat rate.
// Amounts are in minor currency units (tiyin — 1 so'm = 100 tiyin), matching every other Minor
// field in this codebase (Offer.priceMinor, etc).
export type UzZoneKind = "FREE" | "REGIONAL_CENTER" | "DISTRICT";

export const STANDARD_DELIVERY_FEE_MINOR: Record<UzZoneKind, number> = {
  FREE: 0,
  REGIONAL_CENTER: 35_000 * 100,
  DISTRICT: 45_000 * 100,
};

export interface UzViloyat {
  code: string;
  name: string;
}

export interface UzDeliveryZone {
  /** Stable unique key — becomes OfferDeliveryRegion.regionCode. */
  code: string;
  /** Display name — becomes OfferDeliveryRegion.regionName. */
  name: string;
  viloyatCode: string;
  kind: UzZoneKind;
}

export const UZ_VILOYATLAR: UzViloyat[] = [
  { code: "toshkent-shahar", name: "Toshkent shahar" },
  { code: "toshkent-viloyati", name: "Toshkent viloyati" },
  { code: "andijon", name: "Andijon viloyati" },
  { code: "fargona", name: "Farg'ona viloyati" },
  { code: "namangan", name: "Namangan viloyati" },
  { code: "sirdaryo", name: "Sirdaryo viloyati" },
  { code: "jizzax", name: "Jizzax viloyati" },
  { code: "samarqand", name: "Samarqand viloyati" },
  { code: "qashqadaryo", name: "Qashqadaryo viloyati" },
  { code: "surxondaryo", name: "Surxondaryo viloyati" },
  { code: "buxoro", name: "Buxoro viloyati" },
  { code: "navoiy", name: "Navoiy viloyati" },
  { code: "xorazm", name: "Xorazm viloyati" },
  { code: "qoraqalpogiston", name: "Qoraqalpog'iston Respublikasi" },
];

function zones(viloyatCode: string, markaz: string, tumanlar: string[]): UzDeliveryZone[] {
  return [
    { code: `${viloyatCode}:markaz`, name: markaz, viloyatCode, kind: "REGIONAL_CENTER" },
    ...tumanlar.map((name, i) => ({ code: `${viloyatCode}:${i}`, name, viloyatCode, kind: "DISTRICT" as const })),
  ];
}

export const UZ_DELIVERY_ZONES: UzDeliveryZone[] = [
  { code: "toshkent-shahar:free", name: "Toshkent shahar", viloyatCode: "toshkent-shahar", kind: "FREE" },

  ...zones("toshkent-viloyati", "Nurafshon shahri", [
    "Bekobod tumani", "Bo'ka tumani", "Bo'stonliq tumani", "Chinoz tumani", "Qibray tumani",
    "Ohangaron tumani", "Oqqo'rg'on tumani", "Parkent tumani", "Piskent tumani", "Toshkent tumani",
    "Yuqorichirchiq tumani", "Zangiota tumani", "Quyichirchiq tumani", "Yangiyo'l tumani",
    "Angren shahri", "Olmaliq shahri", "Chirchiq shahri", "Bekobod shahri",
  ]),

  ...zones("andijon", "Andijon shahri", [
    "Andijon tumani", "Asaka tumani", "Baliqchi tumani", "Bo'z tumani", "Buloqboshi tumani",
    "Izboskan tumani", "Jalaquduq tumani", "Xo'jaobod tumani", "Qo'rg'ontepa tumani",
    "Marhamat tumani", "Oltinko'l tumani", "Paxtaobod tumani", "Shahrixon tumani",
    "Ulug'nor tumani", "Xonobod shahri",
  ]),

  ...zones("fargona", "Farg'ona shahri", [
    "Beshariq tumani", "Bog'dod tumani", "Buvayda tumani", "Dang'ara tumani", "Farg'ona tumani",
    "Furqat tumani", "Qo'shtepa tumani", "Quva tumani", "Rishton tumani", "So'x tumani",
    "Toshloq tumani", "Uchko'prik tumani", "O'zbekiston tumani", "Yozyovon tumani",
    "Oltiariq tumani", "Qo'qon shahri", "Marg'ilon shahri", "Quvasoy shahri",
  ]),

  ...zones("namangan", "Namangan shahri", [
    "Chortoq tumani", "Chust tumani", "Kosonsoy tumani", "Mingbuloq tumani", "Namangan tumani",
    "Norin tumani", "Pop tumani", "To'raqo'rg'on tumani", "Uchqo'rg'on tumani", "Uychi tumani",
    "Yangiqo'rg'on tumani",
  ]),

  ...zones("sirdaryo", "Guliston shahri", [
    "Boyovut tumani", "Mirzaobod tumani", "Oqoltin tumani", "Sayxunobod tumani", "Sardoba tumani",
    "Sirdaryo tumani", "Xovos tumani", "Guliston tumani", "Yangiyer shahri", "Shirin shahri",
  ]),

  ...zones("jizzax", "Jizzax shahri", [
    "Arnasoy tumani", "Baxmal tumani", "Do'stlik tumani", "Forish tumani", "G'allaorol tumani",
    "Sharof Rashidov tumani", "Zafarobod tumani", "Zarbdor tumani", "Zomin tumani",
    "Paxtakor tumani", "Jizzax tumani", "Yangiobod tumani",
  ]),

  ...zones("samarqand", "Samarqand shahri", [
    "Bulung'ur tumani", "Ishtixon tumani", "Jomboy tumani", "Kattaqo'rg'on tumani", "Narpay tumani",
    "Nurobod tumani", "Oqdaryo tumani", "Pastdarg'om tumani", "Paxtachi tumani", "Payariq tumani",
    "Qo'shrabot tumani", "Samarqand tumani", "Toyloq tumani", "Urgut tumani",
  ]),

  ...zones("qashqadaryo", "Qarshi shahri", [
    "Chiroqchi tumani", "Dehqonobod tumani", "G'uzor tumani", "Kasbi tumani", "Kitob tumani",
    "Koson tumani", "Mirishkor tumani", "Muborak tumani", "Nishon tumani", "Qamashi tumani",
    "Qarshi tumani", "Shahrisabz tumani", "Yakkabog' tumani",
  ]),

  ...zones("surxondaryo", "Termiz shahri", [
    "Angor tumani", "Bandixon tumani", "Boysun tumani", "Denov tumani", "Jarqo'rg'on tumani",
    "Muzrabot tumani", "Oltinsoy tumani", "Qiziriq tumani", "Qumqo'rg'on tumani",
    "Sariosiyo tumani", "Sherobod tumani", "Sho'rchi tumani", "Termiz tumani", "Uzun tumani",
  ]),

  ...zones("buxoro", "Buxoro shahri", [
    "Buxoro tumani", "G'ijduvon tumani", "Jondor tumani", "Kogon shahri", "Olot tumani",
    "Peshku tumani", "Qorako'l tumani", "Qorovulbozor tumani", "Romitan tumani",
    "Shofirkon tumani", "Vobkent tumani",
  ]),

  ...zones("navoiy", "Navoiy shahri", [
    "Konimex tumani", "Karmana tumani", "Navbahor tumani", "Nurota tumani", "Qiziltepa tumani",
    "Tomdi tumani", "Uchquduq tumani", "Xatirchi tumani", "Zarafshon shahri",
  ]),

  ...zones("xorazm", "Urganch shahri", [
    "Bog'ot tumani", "Gurlan tumani", "Xazorasp tumani", "Xonqa tumani", "Qo'shko'pir tumani",
    "Shovot tumani", "Urganch tumani", "Yangiariq tumani", "Yangibozor tumani",
    "Tuproqqal'a tumani", "Xiva shahri",
  ]),

  ...zones("qoraqalpogiston", "Nukus shahri", [
    "Amudaryo tumani", "Beruniy tumani", "Chimboy tumani", "Ellikqal'a tumani", "Kegeyli tumani",
    "Mo'ynoq tumani", "Nukus tumani", "Qanliko'l tumani", "Qo'ng'irot tumani", "Qorao'zak tumani",
    "Shumanay tumani", "Taxtako'pir tumani", "To'rtko'l tumani", "Xo'jayli tumani",
  ]),
];

export function getStandardFeeMinor(kind: UzZoneKind): number {
  return STANDARD_DELIVERY_FEE_MINOR[kind];
}

export function zonesByViloyat(viloyatCode: string): UzDeliveryZone[] {
  return UZ_DELIVERY_ZONES.filter((z) => z.viloyatCode === viloyatCode);
}
