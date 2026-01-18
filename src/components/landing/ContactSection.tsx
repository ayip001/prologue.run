"use client";

import { useTranslations } from "next-intl";
import { Github, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactSection() {
  const t = useTranslations("contact");

  return (
    <section className="py-24 bg-slate-900/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-400">
            {t("description")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild>
              <a href="mailto:hello@prologue.run" className="gap-2">
                <Mail className="h-5 w-5" />
                {t("emailMe")}
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a href="https://github.com/ayip001/prologue.run/issues" target="_blank" rel="noopener noreferrer" className="gap-2">
                <Github className="h-5 w-5" />
                {t("reportIssue")}
              </a>
            </Button>
         </div>
        </div>
      </div>
    </section>
  );
}
