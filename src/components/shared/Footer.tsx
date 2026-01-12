import Link from "next/link";
import { Github, Heart } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo className="mb-4" />
            <p className="text-sm text-slate-400 max-w-md">
              Preview marathon routes through interactive 360° street-level imagery.
              Scout your next race from anywhere in the world.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-slate-100 mb-4">Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#races"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Browse Races
                </Link>
              </li>
              <li>
                <Link
                  href="/#about"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/prologue-run/prologue.run"
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
            <h4 className="font-semibold text-slate-100 mb-4">Contact</h4>
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
            © {currentYear} prologue.run. All rights reserved.
          </p>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            Made with <Heart className="h-4 w-4 text-coral" /> for runners
          </p>
        </div>
      </div>
    </footer>
  );
}
