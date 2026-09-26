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

const BARS: Record<Tone, string> = {
  violet: "from-[#7C3AED] to-[#C084FC]",
  neon: "from-[#34D399] to-[#A7F3D0]",
  amber: "from-amber-400 to-amber-200",
  plain: "from-white/40 to-white/20",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "violet",
  meter,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone?: Tone;
  /** 0–1 completion bar with a caption, shown under the sub-line. */
  meter?: { value: number; caption: string };
}) {
  const pct = Math.max(0, Math.min(1, meter?.value ?? 0));

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

      <p className="relative z-10 mt-4 font-mono text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-foreground">
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

      {meter && (
        <div className="relative z-10 mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${BARS[tone]} transition-[width] duration-700 ease-out`}
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
            {meter.caption}
          </p>
        </div>
      )}
    </div>
  );
}
