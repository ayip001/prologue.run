"use client";

import { useTranslations, useLocale } from "next-intl";
import { Menu, X, Sun, Moon, Languages, ChevronDown, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

interface NavbarProps {
  className?: string;
  transparent?: boolean;
}

export function Navbar({ className, transparent = false }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("navbar");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (newLocale: Locale) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        transparent
          ? "bg-transparent"
          : "dark:bg-slate-900/80 light:bg-white/80 backdrop-blur-xl border-b dark:border-white/5 light:border-slate-200",
        className
      )}
    >
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Logo />

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/#races"
            className="text-sm dark:text-slate-300 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
          >
            {t("races")}
          </Link>
          <Link
            href="/#features"
            className="text-sm dark:text-slate-300 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors"
          >
            {t("features")}
          </Link>

          <div className="flex items-center gap-4 border-l border-white/10 dark:border-white/10 light:border-slate-200 pl-6">
            {/* Theme Toggle Pill Switch */}
            <button
              onClick={toggleTheme}
              className="flex items-center p-1 bg-slate-200 dark:bg-slate-900/95 border border-slate-300 dark:border-white/10 rounded-full w-16 h-8 relative cursor-pointer group"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div
                className={cn(
                  "absolute w-6 h-6 bg-coral rounded-full shadow-sm transition-transform duration-200",
                  isDark ? "left-[calc(100%-1.75rem)]" : "left-1"
                )}
              />
              <Sun className={cn(
                "h-3.5 w-3.5 z-10 ml-1.5 transition-colors",
                isDark ? "text-slate-400 group-hover:text-slate-300" : "text-white"
              )} />
              <Moon className={cn(
                "h-3.5 w-3.5 z-10 ml-auto mr-1.5 transition-colors",
                isDark ? "text-white" : "text-slate-400"
              )} />
            </button>

            {/* Language Dropdown */}
            <div className="relative group">
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md dark:bg-slate-900/90 dark:border-white/10 dark:text-slate-300 dark:hover:text-white light:bg-slate-100 light:border-slate-200 light:text-slate-600 light:hover:text-slate-900 border text-sm transition-colors",
                  isPending && "opacity-50 cursor-wait"
                )}
                disabled={isPending}
              >
                <Languages className="h-4 w-4 dark:text-slate-400 light:text-slate-500" />
                <span>{localeNames[locale]}</span>
                <ChevronDown className="h-3 w-3 dark:text-slate-500 light:text-slate-400" />
              </button>

              {/* Dropdown Menu Overlay */}
              <div className="absolute top-full right-0 mt-2 w-36 dark:bg-slate-900/90 dark:border-white/10 light:bg-white light:border-slate-200 border rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-50">
                <div className="py-1.5">
                  {locales.map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLocaleChange(l)}
                      disabled={isPending}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors",
                        l === locale
                          ? "dark:text-white dark:bg-white/10 light:text-slate-900 light:bg-slate-100"
                          : "dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
                      )}
                    >
                      {localeNames[l]}
                      {l === locale && (
                        <div className="w-1.5 h-1.5 rounded-full bg-coral" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden dark:bg-slate-900/95 light:bg-white/95 backdrop-blur-xl border-b dark:border-white/5 light:border-slate-200">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link
              href="/#races"
              className="dark:text-slate-300 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("races")}
            </Link>
            <Link
              href="/#features"
              className="dark:text-slate-300 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("features")}
            </Link>

            <div className="flex items-center justify-between py-2 border-t dark:border-white/5 light:border-slate-200 mt-2">
              <span className="text-sm dark:text-slate-400 light:text-slate-500">
                {t("appearance")}
              </span>
              <button
                onClick={toggleTheme}
                className="flex items-center p-1 dark:bg-slate-900/95 dark:border-white/10 light:bg-slate-200 light:border-slate-300 border rounded-full w-16 h-8 relative"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                <div
                  className={cn(
                    "absolute w-6 h-6 bg-coral rounded-full shadow-sm transition-transform duration-200",
                    isDark ? "left-[calc(100%-1.75rem)]" : "left-1"
                  )}
                />
                <Sun
                  className={cn(
                    "h-3.5 w-3.5 z-10 ml-1.5 transition-colors",
                    isDark ? "text-slate-400" : "text-white"
                  )}
                />
                <Moon
                  className={cn(
                    "h-3.5 w-3.5 z-10 ml-auto mr-1.5 transition-colors",
                    isDark ? "text-white" : "text-slate-400"
                  )}
                />
              </button>
            </div>

            <div className="flex flex-col gap-2 py-2 border-t dark:border-white/5 light:border-slate-200">
              <span className="text-sm dark:text-slate-400 light:text-slate-500 mb-1">
                {t("language")}
              </span>
              <div className="space-y-1">
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      handleLocaleChange(l);
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={isPending}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
                      l === locale
                        ? "dark:bg-slate-900/95 dark:text-white light:bg-slate-100 light:text-slate-900"
                        : "dark:bg-slate-900/95 dark:text-slate-400 light:bg-slate-100 light:text-slate-500",
                      isPending && "opacity-50 cursor-wait"
                    )}
                  >
                    {localeNames[l]}
                    {l === locale && (
                      <div className="w-1.5 h-1.5 rounded-full bg-coral" />
                    )}
                  </button>
                ))}
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
