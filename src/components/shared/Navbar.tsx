"use client";

import { useTranslations, useLocale } from "next-intl";
import { Menu, X, Sun, Moon, Languages, ChevronDown, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

interface NavbarProps {
  className?: string;
  transparent?: boolean;
}

export function Navbar({ className, transparent = false }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
          : "bg-slate-900/80 backdrop-blur-xl border-b border-white/5",
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
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            {t("races")}
          </Link>
          <Link
            href="/#features"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            {t("features")}
          </Link>

          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
            {/* Theme Toggle Pill Switch */}
            <div className="flex items-center p-1 bg-slate-900/95 border border-white/10 rounded-full w-16 h-8 relative cursor-pointer group">
              <div className="absolute left-1 w-6 h-6 bg-coral rounded-full shadow-sm transition-transform" />
              <Sun className="h-3.5 w-3.5 text-white z-10 ml-1.5" />
              <Moon className="h-3.5 w-3.5 text-slate-400 z-10 ml-auto mr-1.5 group-hover:text-slate-300 transition-colors" />
            </div>

            {/* Language Dropdown */}
            <div className="relative group">
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900/90 border border-white/10 text-sm text-slate-300 hover:text-white transition-colors",
                  isPending && "opacity-50 cursor-wait"
                )}
                disabled={isPending}
              >
                <Languages className="h-4 w-4 text-slate-400" />
                <span>{localeNames[locale]}</span>
                <ChevronDown className="h-3 w-3 text-slate-500" />
              </button>

              {/* Dropdown Menu Overlay */}
              <div className="absolute top-full right-0 mt-2 w-36 bg-slate-900/90 border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-50">
                <div className="py-1.5">
                  {locales.map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLocaleChange(l)}
                      disabled={isPending}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors",
                        l === locale
                          ? "text-white bg-white/10"
                          : "text-slate-400 hover:bg-white/10 hover:text-white"
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
        <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-b border-white/5">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link
              href="/#races"
              className="text-slate-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("races")}
            </Link>
            <Link
              href="/#features"
              className="text-slate-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("features")}
            </Link>

            <div className="flex items-center justify-between py-2 border-t border-white/5 mt-2">
              <span className="text-sm text-slate-400">{t("appearance")}</span>
              <div className="flex items-center p-1 bg-slate-900/95 border border-white/10 rounded-full w-16 h-8 relative">
                <div className="absolute left-1 w-6 h-6 bg-coral rounded-full shadow-sm" />
                <Sun className="h-3.5 w-3.5 text-white z-10 ml-1.5" />
                <Moon className="h-3.5 w-3.5 text-slate-400 z-10 ml-auto mr-1.5" />
              </div>
            </div>

            <div className="flex flex-col gap-2 py-2 border-t border-white/5">
              <span className="text-sm text-slate-400 mb-1">{t("language")}</span>
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
                      "w-full flex items-center justify-between px-3 py-2 rounded-md bg-slate-900/95 text-sm",
                      l === locale ? "text-white" : "text-slate-400",
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
      )}
    </header>
  );
}
