import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GlassPanel({
  children,
  className,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg backdrop-blur-xl border",
        "dark:bg-slate-900/40 dark:border-white/10",
        "light:bg-white/40 light:border-slate-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
