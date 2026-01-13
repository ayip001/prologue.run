import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactSection() {
  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Get in Touch
          </h2>
          <p className="text-lg text-slate-400">
            Contact me if you want to help log a race, want your race logged, or
            to report an issue.
          </p>
          <Button size="lg" asChild>
            <a href="mailto:hello@prologue.run" className="gap-2">
              <Mail className="h-5 w-5" />
              Email Me
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
