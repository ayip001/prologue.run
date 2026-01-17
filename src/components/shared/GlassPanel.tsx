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
        "dark:bg-slate-800/70 dark:border-white/10",
        "light:bg-white light:border-slate-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
