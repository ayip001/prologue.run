import { Github, Mail } from "lucide-react";
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild>
              <a href="mailto:hello@prologue.run" className="gap-2">
                <Mail className="h-5 w-5" />
                Email Me
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a href="https://github.com/ayip001/prologue.run/issues" target="_blank" rel="noopener noreferrer" className="gap-2">
                <Github className="h-5 w-5" />
                Report an Issue on GitHub
              </a>
            </Button>
         </div>
        </div>
      </div>
    </section>
  );
}
