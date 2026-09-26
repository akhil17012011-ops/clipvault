import { StatCard } from "@/components/dashboard/StatCard";
import { CreatorsView } from "@/components/dashboard/CreatorsView";
import { UsersTable } from "@/components/dashboard/UsersTable";
import { CampaignModeration } from "@/components/dashboard/CampaignModeration";
import { BrandAvatar, PlatformChip, StatusBadge } from "@/components/ClipticUI";
import { ShortcutGrid } from "@/components/dashboard/ShortcutGrid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  type InvoiceStatus,
} from "@/lib/cliptic-data";
import { useAdminStats, useCliptic } from "@/lib/cliptic-store";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Eye,
  FileText,
  Pause,
  Play,
  Plus,
  Rocket,
  Clapperboard,
  ScanSearch,
  ShieldCheck,
  Trash2,
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

/** Why a reviewer turned a clip down — shown back to the creator. */
const DECLINE_REASONS = [
  "Not posted from a verified account",
  "Platform isn't accepted by this campaign",
  "Missing the required hashtags",
  "Content doesn't match the campaign brief",
] as const;

/** Each sidebar entry is its own page under /dashboard/:section. */
export type AdminSection =
  | "overview"
  | "creators"
  | "users"
  | "payouts"
  | "invoices"
  | "campaigns"
  | "moderation";

export function AdminView({
  section,
  onCreateCampaign,
}: {
  section: AdminSection;
  onCreateCampaign: () => void;
}) {
  const {
    campaigns,
    submissions,
    setCampaignStatus,
    cycleInvoice,
    settleSubmission,
    reviewSubmission,
    deleteCampaign,
  } = useCliptic();
  const stats = useAdminStats();

  /* Settled payouts over the last 7 days — derived from real approvals only. */
  const payoutSeries = (() => {
    const dayMs = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const start = today.getTime() - (6 - i) * dayMs;
      const value = submissions
        .filter(
          (s) =>
            s.status === "paid" &&
            s.submittedAt >= start &&
            s.submittedAt < start + dayMs,
        )
        .reduce((sum, s) => sum + earnedOf(s, campaigns), 0);
      return {
        day: new Date(start).toLocaleString("en-US", { weekday: "short" }),
        value,
      };
    });
  })();

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

  /** Accept a reviewed clip — it is sent to the campaign and goes live. */
  const acceptClip = (id: string) => {
    const submission = submissions.find((s) => s.id === id);
    if (!submission) return;
    const campaign = campaignById(campaigns, submission.campaignId);
    reviewSubmission(id, "accept");
    toast.success("Sent to campaign", {
      description: `@${submission.author}'s clip is live on ${
        campaign?.brand ?? "the campaign"
      } and earning views.`,
    });
  };

  const declineClip = (id: string, reason: string) => {
    const submission = submissions.find((s) => s.id === id);
    if (!submission) return;
    reviewSubmission(id, "decline", reason);
    toast.error("Clip declined", {
      description: `${submission.creator} was told: ${reason}`,
    });
  };

  const PAGES: Record<
    AdminSection,
    { kicker: string; title: string; description: string }
  > = {
    overview: {
      kicker: "Admin console",
      title: "Campaigns, moderation & payouts",
      description: `${stats.live} live campaigns · ${fmtViews(stats.volume)} verified views tracked · ${stats.reviewQueue} clips awaiting review`,
    },
    payouts: {
      kicker: "Settlements",
      title: "Platform payouts",
      description: "Amounts settled to clippers over the last 7 days.",
    },
    creators: {
      kicker: "Directory",
      title: "Connected accounts",
      description:
        "Every social account verified on CLIPTIC, and what it has produced.",
    },
    users: {
      kicker: "People",
      title: "Users",
      description:
        "Every account on CLIPTIC, the handles they connected, and what they have earned.",
    },
    invoices: {
      kicker: "Billing",
      title: "Brand invoices",
      description: "One invoice per brand per cycle — cycle each one along.",
    },
    campaigns: {
      kicker: "Manage",
      title: "Campaign management",
      description: "Rates, budgets, rules and platform restrictions.",
    },
    moderation: {
      kicker: "Moderate",
      title: "Submissions & payouts",
      description: "Approve payouts once views are verified.",
    },
  };
  const page = PAGES[section];
  /* Which campaign's clip list is open. One at a time, so the review queue
     stays readable instead of turning into a wall of rows. */
  const [openReviewId, setReviewing] = useState<string | null>(null);

  const shortcuts = [
    {
      to: "/dashboard/moderation",
      icon: ScanSearch,
      value: `${stats.reviewQueue}`,
      label: "Review queue",
      hint: "Clips waiting on moderation",
    },
    {
      to: "/dashboard/payouts",
      icon: Wallet,
      value: fmtMoney(stats.pending, true),
      label: "Pending payouts",
      hint: "Awaiting approval in the queue",
    },
    {
      to: "/dashboard/invoices",
      icon: FileText,
      value: `${invoiceCounts.draft} draft`,
      label: "Brand invoices",
      hint: `${invoiceCounts.sent} sent · ${invoiceCounts.paid} paid`,
    },
    {
      to: "/dashboard/campaigns",
      icon: Rocket,
      value: `${stats.live}`,
      label: "Live campaigns",
      hint: "Rates, budgets and rules you control",
    },
  ];

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {page.kicker}
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.03em]">
            {page.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.description}
          </p>
        </div>
        <Button className="gap-1.5 glow-primary" onClick={onCreateCampaign}>
          <Plus className="h-4 w-4" />
          Create campaign
        </Button>
      </div>

      {/* stats */}
      {section === "overview" && (
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
      )}

      {section === "overview" && <ShortcutGrid cards={shortcuts} />}

      {section === "creators" && <CreatorsView />}

      {section === "users" && <UsersTable />}

      {section === "payouts" && (
        <motion.section
          id="payouts"
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="panel-fx rounded-2xl border border-black/8 dark:border-white/10 bg-card p-5"
        >
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
          <PayoutChart data={payoutSeries} />
        </motion.section>
      )}

      {section === "invoices" && (
        <motion.section
          id="invoices"
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="scroll-mt-24 panel-fx rounded-2xl border border-black/8 dark:border-white/10 bg-card p-5"
        >
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
        </motion.section>
      )}

      {/* campaign management */}
      {section === "campaigns" && (
      <motion.section
        id="campaigns"
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="scroll-mt-24 rounded-2xl border border-black/8 dark:border-white/10 bg-card"
      >
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
                <TableHead className="text-right">Clips</TableHead>
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
                      <span className="font-mono text-[13px] font-bold text-brand">
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
                        className="gap-1.5 border-black/12 bg-black/[0.03] text-[12px] hover:bg-black/[0.05] dark:border-white/15 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
                        onClick={() =>
                          setReviewing(
                            openReviewId === campaign.id ? null : campaign.id,
                          )
                        }
                      >
                        <Clapperboard className="h-3 w-3" />
                        Review
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-black/12 bg-black/[0.03] text-[12px] hover:bg-black/[0.05] dark:border-white/15 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
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
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${campaign.brand}`}
                          className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete “${campaign.brand} — ${campaign.title}”? Its clips and joins are removed too. This can't be undone.`,
                              )
                            ) {
                              return;
                            }
                            deleteCampaign(campaign.id).catch((err) => {
                              toast.error("Couldn't delete that campaign", {
                                description:
                                  err instanceof Error
                                    ? err.message
                                    : "Please try again.",
                              });
                            });
                            toast.success("Campaign deleted", {
                              description: `${campaign.brand} and its clips were removed.`,
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* The review panel lives inside its own campaign's row, so each
                  campaign carries its own pending/approved/rejected list. */}
              {campaigns.map((campaign) =>
                openReviewId === campaign.id ? (
                  <TableRow key={`${campaign.id}-review`}>
                    <TableCell
                      colSpan={7}
                      className="bg-black/[0.02] dark:bg-white/[0.02]"
                    >
                      <CampaignModeration campaign={campaign} />
                    </TableCell>
                  </TableRow>
                ) : null,
              )}
            </TableBody>
          </Table>
        </div>
      </motion.section>
      )}

      {/* moderation */}
      {section === "moderation" && (
      <motion.section
        id="moderation"
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="scroll-mt-24 rounded-2xl border border-black/8 dark:border-white/10 bg-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/8 dark:border-white/10 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">
              Submissions &amp; payouts
            </h2>
            <p className="text-xs text-muted-foreground">
              Check each clip by hand — accepted clips are sent to the campaign
              and start earning
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
            <ClipboardList className="h-3.5 w-3.5" />
            {stats.reviewQueue} in review
          </span>
        </div>
        {submissions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No submissions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clips that creators submit to campaigns will show up here for
              review.
            </p>
          </div>
        ) : (
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
                        {submission.creator}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                        @{submission.author}
                        {submission.verifiedOwner ? (
                          <span className="inline-flex items-center gap-0.5 text-neon">
                            <ShieldCheck className="h-3 w-3" />
                            verified
                          </span>
                        ) : (
                          <span className="text-red-500 dark:text-red-400">
                            unverified
                          </span>
                        )}
                      </span>
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
                      {submission.metrics && (
                        <span className="block text-[10.5px] font-medium text-muted-foreground">
                          {fmtFull(submission.metrics.likes)} likes
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={submission.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-bold text-brand">
                      {submission.status === "rejected" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        fmtMoney(earned, true)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {submission.status === "pending" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 gap-1 bg-neon/15 text-neon hover:bg-neon/25 border border-neon/25"
                            onClick={() => acceptClip(submission.id)}
                          >
                            <Rocket className="h-3 w-3" />
                            Accept &amp; send
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 text-red-600 dark:text-red-300 hover:bg-red-400/10 hover:text-red-700 dark:hover:text-red-200"
                              >
                                <XCircle className="h-3 w-3" />
                                Decline
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              {DECLINE_REASONS.map((reason) => (
                                <DropdownMenuItem
                                  key={reason}
                                  onClick={() => declineClip(submission.id, reason)}
                                >
                                  {reason}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : submission.status === "active" ? (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="h-8 gap-1 bg-neon/15 text-neon hover:bg-neon/25 border border-neon/25"
                            onClick={() => approve(submission.id)}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Approve payout
                          </Button>
                        </div>
                      ) : submission.status === "paid" ? (
                        <span className="text-[11.5px] font-semibold text-muted-foreground">
                          Settled
                        </span>
                      ) : (
                        <span
                          className="text-[11.5px] font-semibold text-red-600 dark:text-red-300/70"
                          title={submission.reviewNote}
                        >
                          {submission.reviewNote ?? "Declined"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        )}
      </motion.section>
      )}
    </div>
  );
}

function PayoutChart({
  data,
}: {
  data: { day: string; value: number }[];
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  if (total === 0) {
    return (
      <div className="mt-5 flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-black/12 dark:border-white/15 text-center">
        <BarChart3 className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">No settled payouts yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Approve a clip payout and the last 7 days will chart here.
        </p>
      </div>
    );
  }
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
                    ? "bg-gradient-to-t from-[#8B3FE2] to-[#a78bfa]"
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
