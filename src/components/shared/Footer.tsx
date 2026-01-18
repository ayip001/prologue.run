"use client";

import { useTranslations } from "next-intl";
import { Github, Heart, Coffee } from "lucide-react";
import { Logo } from "./Logo";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const t = useTranslations("footer");

  return (
    <footer className="border-t dark:border-white/5 light:border-slate-200 dark:bg-slate-950 light:bg-slate-50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo className="mb-4" />
            <p className="text-sm dark:text-slate-400 light:text-slate-600 max-w-md">
              {t("tagline")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold dark:text-slate-100 light:text-slate-900 mb-4">
              {t("links")}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#races"
                  className="text-sm dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
                >
                  {t("browseRaces")}
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="text-sm dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
                >
                  {t("features")}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
                >
                  {t("termsOfService")}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
                >
                  {t("privacyPolicy")}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/ayip001/prologue.run/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors inline-flex items-center gap-1"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold dark:text-slate-100 light:text-slate-900 mb-4">
              {t("contact")}
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:hello@prologue.run"
                  className="text-sm dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
                >
                  hello@prologue.run
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t dark:border-white/5 light:border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm dark:text-slate-500 light:text-slate-500">
            {t("copyright", { year: currentYear })}
          </p>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <p className="text-sm dark:text-slate-500 light:text-slate-500 flex items-center gap-1">
              {t("madeWith")} <Heart className="h-4 w-4 text-coral" /> {t("forRunners")}
            </p>
            <span className="hidden md:block dark:text-slate-700 light:text-slate-300">|</span>
            <a
              href="https://buymeacoffee.com/angusflies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm dark:text-slate-500 dark:hover:text-white light:text-slate-500 light:hover:text-slate-900 transition-colors flex items-center gap-1.5 group"
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
