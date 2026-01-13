import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 font-semibold transition-opacity hover:opacity-80",
        className
      )}
    >
      <div className={cn("relative shrink-0", sizeClasses[size])}>
        <Image
          src="/prologue-run-logo.svg"
          alt="prologue.run logo"
          fill
          sizes="(max-width: 768px) 32px, 40px"
          className="object-contain"
          priority
        />
      </div>

      {showText && (
        <span className={cn("text-gradient font-bold", textSizeClasses[size])}>
          prologue.run
        </span>
      )}
    </Link>
  );
}
