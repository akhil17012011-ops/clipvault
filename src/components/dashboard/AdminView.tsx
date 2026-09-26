import { StatCard } from "@/components/dashboard/StatCard";
import { BrandAvatar, PlatformChip, StatusBadge } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
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
  earnedOf,
  fmtFull,
  fmtMoney,
  fmtRate,
  fmtViews,
  seedPayoutSeries,
  type InvoiceStatus,
} from "@/lib/cliptic-data";
import { useAdminStats, useCliptic } from "@/lib/cliptic-store";
import { motion } from "framer-motion";
import {
  BarChart3,
  ClipboardList,
  Eye,
  FileText,
  Pause,
  Play,
  Plus,
  Rocket,
  ScanSearch,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
};

const INVOICE_TONE: Record<InvoiceStatus, string> = {
  draft: "border-black/12 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] text-muted-foreground",
  sent: "border-amber-400/25 bg-amber-400/10 text-amber-600 dark:text-amber-300",
  paid: "border-neon/25 bg-neon/10 text-neon",
};

const STATUS_ORDER = { pending: 0, active: 1, paid: 2, rejected: 3 } as const;

export function AdminView({
  onCreateCampaign,
}: {
  onCreateCampaign: () => void;
}) {
  const {
    campaigns,
    submissions,
    setCampaignStatus,
    cycleInvoice,
    settleSubmission,
  } = useCliptic();
  const stats = useAdminStats();

  const invoices = campaigns.slice(0, 5);
  const invoiceCounts = campaigns.reduce(
    (acc, c) => ({ ...acc, [c.invoice]: acc[c.invoice] + 1 }),
    { draft: 0, sent: 0, paid: 0 } as Record<InvoiceStatus, number>,
  );

  const approve = (id: string) => {
    const submission = submissions.find((s) => s.id === id);
    if (!submission) return;
    const campaign = campaignById(campaigns, submission.campaignId);
    settleSubmission(id, "paid");
    toast.success("Payout approved", {
      description: `${fmtMoney(earnedOf(submission, campaigns), true)} for ${
        submission.creator
      } · ${campaign?.brand ?? "Campaign"}`,
    });
  };

  const reject = (id: string) => {
    const submission = submissions.find((s) => s.id === id);
    if (!submission) return;
    settleSubmission(id, "rejected");
    toast.error("Clip rejected", {
      description: `${submission.creator}'s clip was removed from the campaign.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Admin console
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.03em]">
            Campaigns, moderation &amp; payouts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.live} live campaigns · {fmtViews(stats.volume)} verified
            views tracked · {stats.reviewQueue} clips awaiting review
          </p>
        </div>
        <Button className="gap-1.5 glow-primary" onClick={onCreateCampaign}>
          <Plus className="h-4 w-4" />
          Create campaign
        </Button>
      </div>

      {/* stats */}
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          icon={Wallet}
          label="Paid out"
          value={fmtMoney(stats.paidOut, true)}
          sub="Settled to clippers this cycle"
          tone="neon"
        />
        <StatCard
          icon={BarChart3}
          label="Pending payouts"
          value={fmtMoney(stats.pending, true)}
          sub="Awaiting approval in the queue"
        />
        <StatCard
          icon={Eye}
          label="Clipping volume"
          value={fmtViews(stats.volume)}
          sub={`${fmtFull(stats.volume)} verified views`}
          tone="plain"
        />
        <StatCard
          icon={ScanSearch}
          label="Review queue"
          value={`${stats.reviewQueue}`}
          sub="Clips waiting on moderation"
          tone="amber"
        />
      </motion.div>

      {/* chart + invoices */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-black/8 dark:border-white/10 bg-card/70 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">
                Platform payouts
              </h2>
              <p className="text-xs text-muted-foreground">
                Amounts settled to clippers over the last 7 days
              </p>
            </div>
            <span className="rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              USD
            </span>
          </div>
          <PayoutChart data={seedPayoutSeries()} />
        </section>

        <section className="rounded-2xl border border-black/8 dark:border-white/10 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="text-[15px] font-bold tracking-tight">
                Brand invoices
              </h2>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {invoiceCounts.paid} paid · {invoiceCounts.sent} sent ·{" "}
            {invoiceCounts.draft} draft
          </p>
          <ul className="mt-4 space-y-2.5">
            {invoices.map((campaign) => (
              <li
                key={campaign.id}
                className="flex items-center gap-3 rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] px-3 py-2.5"
              >
                <BrandAvatar name={campaign.brand} className="h-8 w-8 text-[11px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {campaign.brand}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtMoney(campaign.budget)} budget
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${INVOICE_TONE[campaign.invoice]}`}
                >
                  {INVOICE_LABEL[campaign.invoice]}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => cycleInvoice(campaign.id)}
                >
                  Advance
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* campaign management */}
      <section className="rounded-2xl border border-black/8 dark:border-white/10 bg-card/70">
        <div className="flex items-center justify-between gap-3 border-b border-black/8 dark:border-white/10 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">
              Campaign management
            </h2>
            <p className="text-xs text-muted-foreground">
              Rates, budgets, platform restrictions and invoice state
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 glow-primary"
            onClick={onCreateCampaign}
          >
            <Rocket className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Campaign</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="hidden md:table-cell">Budget</TableHead>
                <TableHead className="hidden lg:table-cell">Platforms</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const pct = Math.min(
                  100,
                  Math.round(
                    (campaign.spent / Math.max(campaign.budget, 1)) * 100,
                  ),
                );
                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <BrandAvatar
                          name={campaign.brand}
                          className="h-9 w-9 text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold">
                            {campaign.brand}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {campaign.title} · {campaign.clippers} clippers
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[13px] font-bold text-neon">
                        {fmtRate(campaign.ratePer1k)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        /1K
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="w-36">
                        <div className="flex justify-between text-[10.5px] text-muted-foreground">
                          <span>
                            {fmtMoney(campaign.spent)}/
                            {fmtMoney(campaign.budget)}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-[#a78bfa]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1.5">
                        {campaign.platforms.map((p) => (
                          <PlatformChip key={p} platform={p} size="sm" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${INVOICE_TONE[campaign.invoice]}`}
                        >
                          {INVOICE_LABEL[campaign.invoice]}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => cycleInvoice(campaign.id)}
                        >
                          Advance
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-black/12 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] text-[12px] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        onClick={() =>
                          setCampaignStatus(
                            campaign.id,
                            campaign.status === "active" ? "paused" : "active",
                          )
                        }
                      >
                        {campaign.status === "active" ? (
                          <>
                            <Pause className="h-3 w-3" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" /> Resume
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* moderation */}
      <section className="rounded-2xl border border-black/8 dark:border-white/10 bg-card/70">
        <div className="flex items-center justify-between gap-3 border-b border-black/8 dark:border-white/10 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">
              Submissions &amp; payouts
            </h2>
            <p className="text-xs text-muted-foreground">
              Approve payouts once views are verified
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
            <ClipboardList className="h-3.5 w-3.5" />
            {stats.reviewQueue} in review
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Creator</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="hidden md:table-cell">Clip</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions
                .slice()
                .sort(
                  (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
                )
                .map((submission) => {
                const campaign = campaignById(
                  campaigns,
                  submission.campaignId,
                );
                const earned = earnedOf(submission, campaigns);
                return (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <span
                        className={`text-[13px] font-semibold ${
                          submission.mine ? "text-brand" : "text-foreground"
                        }`}
                      >
                        {submission.creator === "you"
                          ? "you"
                          : submission.creator}
                      </span>
                      {submission.mine && (
                        <span className="block text-[10.5px] text-muted-foreground">
                          your account
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BrandAvatar
                          name={campaign?.brand ?? "??"}
                          className="h-7 w-7 text-[10px]"
                        />
                        <div className="min-w-0">
                          <p className="max-w-[140px] truncate text-[13px] font-medium">
                            {campaign?.brand ?? "—"}
                          </p>
                          <PlatformChip
                            platform={submission.platform}
                            size="sm"
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <a
                        href={submission.link}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[180px] truncate font-mono text-[12px] text-brand hover:underline"
                      >
                        {submission.link.replace(/^https?:\/\//, "").slice(0, 24)}
                        …
                      </a>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-semibold">
                      {fmtFull(submission.views)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={submission.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-bold text-neon">
                      {submission.status === "rejected" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        fmtMoney(earned, true)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {submission.status === "pending" ||
                      submission.status === "active" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 gap-1 bg-neon/15 text-neon hover:bg-neon/25 border border-neon/25"
                            onClick={() => approve(submission.id)}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-red-600 dark:text-red-300 hover:bg-red-400/10 hover:text-red-700 dark:hover:text-red-200"
                            onClick={() => reject(submission.id)}
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      ) : submission.status === "paid" ? (
                        <span className="text-[11.5px] font-semibold text-muted-foreground">
                          Settled
                        </span>
                      ) : (
                        <span className="text-[11.5px] font-semibold text-red-600 dark:text-red-300/70">
                          Rejected
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function PayoutChart({
  data,
}: {
  data: { day: string; value: number }[];
}) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="mt-5 grid h-56 grid-cols-7 items-end gap-2.5">
      {data.map((point, i) => {
        const pct = Math.max(8, Math.round((point.value / max) * 100));
        const isLast = i === data.length - 1;
        return (
          <div key={point.day} className="flex h-full flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              ${(point.value / 1000).toFixed(1)}K
            </span>
            <div className="relative flex w-full flex-1 items-end">
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: "easeOut" }}
                style={{ height: `${pct}%`, transformOrigin: "bottom" }}
                className={`w-full rounded-t-lg ${
                  isLast
                    ? "bg-gradient-to-t from-[#5B37E8] to-[#a78bfa]"
                    : "bg-gradient-to-t from-brand/70 to-brand/35"
                }`}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {point.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}
