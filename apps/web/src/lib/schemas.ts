import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email kiritilishi shart").email("Email formati noto'g'ri"),
  password: z.string().min(1, "Parol kiritilishi shart"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().min(3, "To'liq ismingizni kiriting"),
  email: z.string().min(1, "Email kiritilishi shart").email("Email formati noto'g'ri"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo'lishi kerak"),
  promoCode: z.string().min(5, "Promo kod kamida 5 ta belgidan iborat bo'lishi kerak").optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email kiritilishi shart").email("Email formati noto'g'ri"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const onboardingStep1Schema = z.object({
  fullName: z.string().min(3, "To'liq ismingizni kiriting"),
  phone: z.string().min(9, "Telefon raqamini to'liq kiriting"),
  bio: z.string().max(280, "280 belgidan oshmasin").optional(),
});
export const onboardingStep2Schema = z.object({
  city: z.string().min(2, "Shaharni tanlang"),
});
export const onboardingStep6Schema = z.object({
  audienceAgeRange: z.string().min(1, "Auditoriya yoshini kiriting"),
  audienceGeography: z.string().min(1, "Auditoriya geografiyasini kiriting"),
  audienceInterests: z.string().min(1, "Auditoriya qiziqishlarini kiriting"),
});
export const onboardingStep7Schema = z.object({
  priorExperience: z.string().optional(),
});
export const onboardingStep8Schema = z.object({
  payoutMethodType: z.enum(["CARD", "BANK_ACCOUNT"]),
  payoutCardNumber: z.string().optional(),
  payoutCardHolder: z.string().optional(),
  payoutBankName: z.string().optional(),
  payoutBankAccount: z.string().optional(),
});

export const contentSubmitSchema = z.object({
  caption: z.string().min(10, "Caption kamida 10 belgidan iborat bo'lsin"),
  platform: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"]),
  publishedUrl: z.string().url("To'g'ri havola kiriting").optional().or(z.literal("")),
});
export type ContentSubmitInput = z.infer<typeof contentSubmitSchema>;

export const payoutMethodSchema = z.object({
  cardNumber: z
    .string()
    .min(16, "Karta raqamini to'liq kiriting")
    .regex(/^[\d\s]+$/, "Faqat raqamlar"),
  cardHolder: z.string().min(3, "Karta egasining ismini kiriting"),
});
export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>;

export const checkoutSchema = z.object({
  fullName: z.string().min(3, "To'liq ismingizni kiriting"),
  phone: z.string().min(9, "Telefon raqamini to'liq kiriting"),
  secondPhone: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Email formati noto'g'ri").optional().or(z.literal("")),
  comment: z.string().optional(),
  paymentMethod: z.string().min(1, "To'lov usulini tanlang"),
  termsAccepted: z.boolean().refine((v) => v === true, "Davom etish uchun shartlarga rozilik bildiring"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const payoutRequestSchema = z.object({
  amount: z
    .string()
    .min(1, "Miqdorni kiriting")
    .refine((v) => Number(v) > 0, "Miqdor musbat bo'lishi kerak"),
  payoutMethodId: z.string().min(1, "To'lov usulini tanlang"),
});
export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;

export const fundContributionSchema = z.object({
  amount: z
    .string()
    .min(1, "Miqdorni kiriting")
    .refine((v) => Number(v) > 0, "Miqdor musbat bo'lishi kerak"),
  message: z.string().max(200, "Xabar 200 belgidan oshmasligi kerak").optional(),
});
export type FundContributionInput = z.infer<typeof fundContributionSchema>;
