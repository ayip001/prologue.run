"use client";

import Link from "next/link";
import { Github, Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavbarProps {
  className?: string;
  transparent?: boolean;
}

export function Navbar({ className, transparent = false }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            Races
          </Link>
          <Link
            href="/#features"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Features
          </Link>
          <a
            href="https://github.com/prologue-run/prologue.run"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white transition-colors"
          >
            <Github className="h-5 w-5" />
          </a>
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
              Races
            </Link>
            <Link
              href="/#features"
              className="text-slate-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <a
              href="https://github.com/prologue-run/prologue.run"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white transition-colors py-2 flex items-center gap-2"
            >
              <Github className="h-5 w-5" />
              GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
