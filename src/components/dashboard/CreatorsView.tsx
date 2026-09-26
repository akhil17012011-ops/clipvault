import { PlatformChip, StatusBadge } from "@/components/ClipticUI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  campaignById,
  creatorTotals,
  fmtFull,
  fmtMoney,
  fmtViews,
  seedCreators,
  type Campaign,
  type CreatorProfile,
  type Platform,
  type SubmissionStatus,
} from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CircleDollarSign,
  Eye,
  Film,
  Search,
  Users,
} from "lucide-react";

/** What one clip is worth to the creator, using the campaign's live rate. */
function clipEarnings(clip: CreatorProfile["clips"][number], campaigns: Campaign[]) {
  if (clip.status === "rejected") return 0;
  const campaign = campaignById(campaigns, clip.campaignId);
  if (!campaign || clip.views < campaign.minViews) return 0;
  return (clip.views / 1000) * campaign.ratePer1k;
}

/**
 * Every social account connected to CLIPTIC: which clipper owns it, whether
 * it's bio-verified, and what those accounts have actually produced — clips,
 * views and earnings.
 */
export function CreatorsView() {
  const { campaigns, submissions } = useCliptic();
  const [query, setQuery] = useState("");
  const creators = useMemo(() => seedCreators(), []);

  const rows = creators
    .map((creator) => {
      const totals = creatorTotals(creator);
      const earnings = creator.clips.reduce(
        (sum, clip) => sum + clipEarnings(clip, campaigns),
        0,
      );
      /* The signed-in creator's own clips count toward the directory too. */
      const own = submissions.filter((s) => s.mine);
      return {
        creator,
        totals,
        earnings,
        live: creator.clips.length - totals.inReview,
      };
    })
    .filter((row) =>
      `${row.creator.name} ${row.creator.handle}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );

  const platformTotals = creators.reduce<Record<string, number>>((acc, c) => {
    acc[c.platform] = (acc[c.platform] ?? 0) + 1;
    return acc;
  }, {});

  const totalViews = rows.reduce((sum, r) => sum + r.totals.views, 0);
  const totalClips = rows.reduce((sum, r) => sum + r.totals.clips, 0);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Directory
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.03em]">
            Connected accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every social account verified on CLIPTIC, and what it has produced.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clippers"
            className="h-11 w-full rounded-xl border border-black/10 bg-black/[0.03] pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/45 focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-white/[0.05]"
          />
        </div>
      </div>

      {/* summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          icon={Users}
          label="Verified accounts"
          value={`${creators.length}`}
          sub={Object.entries(platformTotals)
            .map(([p, n]) => `${n} ${p === "x" ? "X" : p}`)
            .join(" · ")}
        />
        <SummaryCard
          icon={Film}
          label="Clips submitted"
          value={`${totalClips + submissions.filter((s) => s.mine).length}`}
          sub="Across every campaign"
        />
        <SummaryCard
          icon={Eye}
          label="Views tracked"
          value={fmtViews(totalViews + submissions.filter((s) => s.mine).reduce((n, s) => n + s.views, 0))}
          sub="Pulled from the source platforms"
        />
        <SummaryCard
          icon={CircleDollarSign}
          label="Committed payouts"
          value={fmtMoney(rows.reduce((sum, r) => sum + r.earnings, 0), true)}
          sub="At each campaign's published rate"
        />
      </motion.div>

      {/* directory table */}
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-2xl border border-black/8 bg-card dark:border-white/10"
      >
        {rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Users className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No accounts found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Clipper</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="hidden md:table-cell">Clips</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ creator, totals, earnings }) => (
                  <TableRow key={creator.handle}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8B3FE2] to-[#5B0FA6] text-xs font-bold text-white">
                          {creator.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold">
                            {creator.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {Math.max(
                              0,
                              Math.round(
                                (Date.now() - creator.connectedAt) /
                                  86_400_000,
                              ),
                            )}{" "}
                            days on CLIPTIC
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlatformChip
                          platform={creator.platform as Platform}
                          size="sm"
                        />
                        <span className="font-mono text-[12.5px]">
                          @{creator.handle}
                        </span>
                        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-neon">
                          <BadgeCheck className="h-3 w-3" />
                          verified
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="font-mono text-[13px] font-semibold">
                        {totals.clips}
                      </span>
                      {totals.inReview > 0 && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          {totals.inReview} in review
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-semibold">
                      {fmtFull(totals.views)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <StatusBadge
                        status={
                          (totals.inReview > 0
                            ? "pending"
                            : "active") as SubmissionStatus
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-bold text-brand">
                      {fmtMoney(earnings, true)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="panel-fx rounded-2xl border border-black/8 bg-card p-5 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-mono text-[26px] font-extrabold leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
