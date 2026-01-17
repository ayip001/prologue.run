import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { defaultLocale, locales } from "@/i18n/config";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });

  const baseUrl = "https://prologue.run";
  const path = "/privacy";
  const canonicalUrl = locale === defaultLocale ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`;

  return {
    title: `${t("title")} - prologue.run`,
    alternates: {
      canonical: canonicalUrl,
      languages: Object.fromEntries(
        locales.map((l) => [
          l === "zh-hk" ? "zh-Hant-HK" : l,
          l === defaultLocale ? `${baseUrl}${path}` : `${baseUrl}/${l}${path}`,
        ])
      ),
    },
  };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("privacy");

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold text-white mb-8">{t("title")}</h1>

          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section1.title")}
              </h2>
              <p>{t("section1.paragraph1")}</p>
              <p className="mt-4">{t("section1.paragraph2")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section2.title")}
              </h2>
              <p>{t("section2.paragraph1")}</p>
            </section>

            <section className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section3.title")}
              </h2>
              <p className="mb-4">
                {t("section3.paragraph1")}
                <a
                  href="mailto:hello@prologue.run"
                  className="text-coral hover:underline ml-1"
                >
                  hello@prologue.run
                </a>
                .
              </p>
              <p className="font-semibold text-white mb-2">
                {t("section3.requirements")}
              </p>
              <ul className="list-disc ml-6 space-y-2 mb-4">
                <li>{t("section3.requirement1")}</li>
                <li>{t("section3.requirement2")}</li>
              </ul>
              <p className="italic">{t("section3.note")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section4.title")}
              </h2>
              <p>{t("section4.paragraph1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section5.title")}
              </h2>
              <p>{t("section5.paragraph1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section6.title")}
              </h2>
              <p>
                {t("section6.paragraph1")}
                <a
                  href="mailto:hello@prologue.run"
                  className="text-coral hover:underline ml-1"
                >
                  hello@prologue.run
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
