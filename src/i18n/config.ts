export const locales = ["en", "zh-hk"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  "zh-hk": "繁體中文",
};

// Locale prefixes configuration
// 'as-needed' means default locale (en) won't have a prefix
export const localePrefix = "as-needed" as const;
