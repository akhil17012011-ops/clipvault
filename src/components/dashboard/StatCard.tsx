import type { LucideIcon } from "lucide-react";

type Tone = "violet" | "neon" | "amber" | "plain";

/* Icon tint only — the chip surface itself comes from `.glass-chip`. */
const TONES: Record<Tone, string> = {
  violet: "text-[#C9AEFF]",
  neon: "text-[#7DF0B4]",
  amber: "text-amber-300",
  plain: "text-muted-foreground",
};

/* Matching dot colour for the sub-line, so the status reads at a glance. */
const DOTS: Record<Tone, string> = {
  violet: "bg-[#C9AEFF]",
  neon: "bg-[#7DF0B4]",
  amber: "bg-amber-300",
  plain: "bg-muted-foreground",
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
    <div className="panel-fx glass-panel glass-sheen group relative overflow-hidden rounded-2xl p-5">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="pt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <span
          className={`glass-chip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 ${TONES[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="relative z-10 mt-4 font-mono text-[30px] font-extrabold leading-none tracking-[-0.04em] text-foreground">
        {value}
      </p>

      <div className="relative z-10 mt-3.5 flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <span
          className={`h-1 w-1 shrink-0 rounded-full opacity-80 ${DOTS[tone]}`}
        />
        <p className="truncate text-[11.5px] leading-snug text-muted-foreground">
          {sub}
        </p>
      </div>
    </div>
  );
}
