import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { fmtCents, fmtFull, fmtViews } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import {
  Clapperboard,
  Crown,
  Eye,
  Loader2,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";

type Metric = "earnings" | "views" | "clips" | "followers";

const TABS: {
  id: Metric;
  label: string;
  icon: typeof Wallet;
  hint: string;
}[] = [
  {
    id: "earnings",
    label: "Earned",
    icon: Wallet,
    hint: "What approved clips have paid out",
  },
  {
    id: "views",
    label: "Views",
    icon: Eye,
    hint: "Verified views across every clip",
  },
  {
    id: "clips",
    label: "Clips",
    icon: Clapperboard,
    hint: "Approved clips on the platform",
  },
  {
    id: "followers",
    label: "Reach",
    icon: Users,
    hint: "Followers across verified accounts",
  },
];

/**
 * The board.
 *
 * Every figure is derived from the same records a payout is made from, so a
 * number here and a number in someone's wallet can never disagree. A creator who
 * has not clipped yet is not on it — a leaderboard of zeroes is noise, and being
 * listed last for having just signed up is not an achievement.
 */
export function Leaderboard() {
  const board = useQuery(api.leaderboard.board, {});
  const [metric, setMetric] = useState<Metric>("earnings");

  const ranked = useMemo(() => {
    const rows = [...(board ?? [])];
    const byMetric = (r: (typeof rows)[number]) =>
      metric === "earnings"
        ? r.earningsCents
        : metric === "views"
          ? r.views
          : metric === "clips"
            ? r.clips
            : r.followers;
    /* Ties fall back to earnings, then to views, so the order never flickers
       between two creators who are genuinely equal. */
    return rows.sort(
      (a, b) => byMetric(b) - byMetric(a) || b.earningsCents - a.earningsCents,
    );
  }, [board, metric]);

  const value = (r: (typeof ranked)[number]) =>
    metric === "earnings"
      ? fmtCents(r.earningsCents)
      : metric === "views"
        ? fmtViews(r.views)
        : metric === "clips"
          ? fmtFull(r.clips)
          : fmtViews(r.followers);

  const active = TABS.find((t) => t.id === metric) ?? TABS[0];
  const top = ranked[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">Leaderboard</h2>
            <p className="text-xs text-muted-foreground">{active.hint}</p>
          </div>
        </div>
        {top && (
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Crown className="h-3.5 w-3.5 text-amber-300" />
            {top.name} leads
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === metric;
          return (
            <Button
              key={tab.id}
              size="sm"
              variant="outline"
              onClick={() => setMetric(tab.id)}
              className={
                isActive
                  ? "gap-1.5 border-brand/45 bg-brand/12 text-foreground"
                  : "glass-chip gap-1.5 text-muted-foreground hover:text-foreground"
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {board === undefined ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Counting…
        </p>
      ) : ranked.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/12 px-4 py-10 text-center text-sm text-muted-foreground dark:border-white/15">
          Nobody has earned anything yet. Submit a clip and you will be first.
        </p>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {ranked.map((row, index) => (
            <li
              key={row.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                row.isViewer
                  ? "border border-brand/35 bg-brand/10"
                  : "glass-chip"
              }`}
            >
              <span
                className={`w-6 shrink-0 text-center font-mono text-[12px] font-bold ${
                  index === 0
                    ? "text-amber-300"
                    : index === 1
                      ? "text-slate-300"
                      : index === 2
                        ? "text-amber-700"
                        : "text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              {row.image ? (
                <img
                  src={row.image}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] to-[#5B0FA6] text-[11px] font-bold text-white">
                  {row.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  {row.name}
                  {row.isViewer && (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      you
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.handle ? `@${row.handle}` : "No account connected"} ·{" "}
                  {row.accounts} verified · {fmtViews(row.views)} views
                </p>
              </div>
              <span className="shrink-0 font-mono text-[13px] font-bold text-neon">
                {value(row)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </motion.section>
  );
}
