import Link from "next/link";
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
      {/* Logo Icon - stylized route/path */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={sizeClasses[size]}
      >
        <defs>
          <linearGradient
            id="logoGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FF6B6B" />
            <stop offset="100%" stopColor="#FFD166" />
          </linearGradient>
        </defs>
        {/* Circular route path */}
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="url(#logoGradient)"
          strokeWidth="2.5"
          fill="none"
        />
        {/* Start/finish marker */}
        <circle cx="16" cy="4" r="3" fill="url(#logoGradient)" />
        {/* Direction arrow inside */}
        <path
          d="M12 16L16 12L20 16M16 12V22"
          stroke="url(#logoGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showText && (
        <span className={cn("text-gradient font-bold", textSizeClasses[size])}>
          prologue.run
        </span>
      )}
    </Link>
  );
}
