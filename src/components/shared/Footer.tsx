"use client";

import { useTranslations } from "next-intl";
import { Github, Heart, Coffee } from "lucide-react";
import { Logo } from "./Logo";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-white/5 bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo className="mb-4" />
            <p className="text-sm text-slate-400 max-w-md">
              {t("tagline")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-slate-100 mb-4">{t("links")}</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#races"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {t("browseRaces")}
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {t("features")}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {t("termsOfService")}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {t("privacyPolicy")}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/ayip001/prologue.run/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-slate-100 mb-4">{t("contact")}</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:hello@prologue.run"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  hello@prologue.run
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            {t("copyright", { year: currentYear })}
          </p>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              {t("madeWith")} <Heart className="h-4 w-4 text-coral" /> {t("forRunners")}
            </p>
            <span className="hidden md:block text-slate-700">|</span>
            <a
              href="https://buymeacoffee.com/angusflies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 group"
            >
              <Coffee className="h-4 w-4 text-amber-500 group-hover:animate-bounce" />
              {t("buyMeCoffee")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
