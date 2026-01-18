"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left group"
      >
        <span className="text-white font-medium pr-4 group-hover:text-coral transition-colors">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-96 pb-5" : "max-h-0"
        )}
      >
        <p className="text-slate-400 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const t = useTranslations("faq");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqKeys = [
    "fewEntries",
    "lookRidiculous",
    "lowQuality",
    "jankyControls",
    "faceNotBlurred",
    "blurFace",
    "blurBib",
    "unblurFace",
    "recordRace",
    "helpRecord",
    "getAnything",
    "sponsorships",
    "addFeature",
    "howItWorks",
    "isFree",
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            {t("title")}
          </h2>
          <p className="text-slate-400 text-center mb-12">
            {t("subtitle")}
          </p>

          <div className="bg-slate-900/50 rounded-xl border border-white/5 px-6">
            {faqKeys.map((key, index) => (
              <FAQItem
                key={key}
                question={t(`items.${key}.q`)}
                answer={t(`items.${key}.a`)}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
