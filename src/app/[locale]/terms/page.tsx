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
  const t = await getTranslations({ locale, namespace: "terms" });

  const baseUrl = "https://prologue.run";
  const path = "/terms";
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

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("terms");

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
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section2.title")}
              </h2>
              <p>{t("section2.paragraph1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t("section3.title")}
              </h2>
              <p>{t("section3.paragraph1")}</p>
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
              <p>{t("section6.paragraph1")}</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
