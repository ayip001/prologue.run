import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "dark" | "light";
}

const variantClasses = {
  default: "bg-slate-800/70 backdrop-blur-xl border border-white/10",
  dark: "bg-slate-900/80 backdrop-blur-xl border border-white/5",
  light: "bg-white/10 backdrop-blur-xl border border-white/20",
};

export function GlassPanel({
  children,
  className,
  variant = "default",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
