import type { LucideIcon } from "lucide-react";

type Tone = "violet" | "neon" | "amber" | "plain";

const TONES: Record<Tone, string> = {
  violet: "border-brand/30 bg-brand/10 text-brand",
  neon: "border-brand/40 bg-brand/15 text-brand",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-600 dark:text-amber-300",
  plain: "border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] text-muted-foreground",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "violet",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone?: Tone;
}) {
  return (
    <div className="panel-fx group rounded-2xl border border-black/8 dark:border-white/10 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 ${TONES[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-mono text-[26px] font-extrabold leading-none tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}
