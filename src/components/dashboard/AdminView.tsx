import { StatCard } from "@/components/dashboard/StatCard";
import { CreatorsView } from "@/components/dashboard/CreatorsView";
import { UsersTable } from "@/components/dashboard/UsersTable";
import {
  ReviewQueue,
  SettlementPulse,
} from "@/components/dashboard/OverviewPanels";
import { CampaignModeration } from "@/components/dashboard/CampaignModeration";
import { AdminMessages } from "@/components/dashboard/AdminMessages";
import { AdminPayouts } from "@/components/dashboard/AdminPayouts";
import { AdminCampaignRequests } from "@/components/dashboard/AdminCampaignRequests";
import { BrandAvatar, PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
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
  fmtCents,
  fmtMoney,
  fmtRate,
  fmtViews,
  payoutPreview,
  type InvoiceStatus,
} from "@/lib/clip-vault-data";
import { useAdminStats, useClipVault } from "@/lib/clip-vault-store";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { EASE } from "@/lib/motion";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Eye,
  FileText,
  Megaphone,
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
  draft: "glass-chip text-muted-foreground",
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
  | "messages"
  | "requests"
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
    allSubmissions,
    adminUsers,
    adminMessages,
    adminPayoutRequests,
    sendToCreator,
    broadcast,
    setCampaignStatus,
    cycleInvoice,
    reviewSubmission,
    deleteCampaign,
  } = useClipVault();
  const stats = useAdminStats();
  /* How many brands are waiting on an approve/decline. */
  const pendingRequests = useQuery(
    api.campaignRequests.pendingCount,
    "skip",
  ) ?? 0;

  /* What creators have actually asked to be paid, and not yet actioned. */
  const payoutPendingCents = adminPayoutRequests
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.amountCents, 0);

  /* Payouts actually sent over the last 7 days, taken from the requests an
     operator marked paid — not from clip statuses, because money only moves
     when a payout request is actioned. */
  const payoutSeries = (() => {
    const dayMs = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const start = today.getTime() - (6 - i) * dayMs;
      const value = adminPayoutRequests
        .filter(
          (r) =>
            r.status === "paid" &&
            r.decidedAt !== null &&
            r.decidedAt >= start &&
            r.decidedAt < start + dayMs,
        )
        .reduce((sum, r) => sum + r.amountCents / 100, 0);
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

  /** Accept a reviewed clip — it is sent to the campaign, and the money the
      view count is worth lands in the creator's balance in the same step. */
  const acceptClip = (id: string) => {
    const submission = submissions.find((s) => s.id === id);
    if (!submission) return;
    const campaign = campaignById(campaigns, submission.campaignId);
    const preview = campaign
      ? payoutPreview(submission.views, campaign.ratePer1k, campaign.minViews)
      : null;
    reviewSubmission(id, "accept");
    toast.success("Sent to campaign", {
      description:
        preview && preview.qualifies && preview.dollars > 0
          ? `@${submission.author}'s clip is live on ${
              campaign?.brand ?? "the campaign"
            }, and ${fmtMoney(preview.dollars)} was added to their balance.`
          : `@${submission.author}'s clip is live on ${
              campaign?.brand ?? "the campaign"
            }. It starts earning once it passes ${
              campaign?.minViews?.toLocaleString("en-US") ?? "the"
            } views.`,
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
      title: "Payout requests",
      description:
        "Every withdrawal a creator has asked for, and what you decided on it.",
    },
    creators: {
      kicker: "Directory",
      title: "Connected accounts",
      description:
        "Every social account verified on Clip Vault, and what it has produced.",
    },
    users: {
      kicker: "People",
      title: "Users",
      description:
        "Every account on Clip Vault, the handles they connected, and what they have earned.",
    },
    messages: {
      kicker: "Reach out",
      title: "Messages",
      description:
        "Send one creator a note, or announce something to everyone.",
    },
    requests: {
      kicker: "Brands",
      title: "Campaign requests",
      description:
        "Brands asking to run a campaign — approve it to publish, or decline it with a reason.",
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
      to: "/dashboard/requests",
      icon: Megaphone,
      value: `${pendingRequests}`,
      label: "Campaign requests",
      hint:
        pendingRequests > 0
          ? "Brands waiting on a decision"
          : "No brand requests waiting",
    },
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
      value: fmtCents(payoutPendingCents),
      label: "Payout queue",
      hint: "Requests waiting on you",
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
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[#7C3AED]/25" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="glass-chip inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9AEFF]">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#C9AEFF]" />
              {page.kicker}
            </span>
            <h1 className="mt-3 text-[32px] font-extrabold leading-none tracking-[-0.035em]">
              {page.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {page.description}
            </p>
          </div>
          <Button className="gap-1.5 glow-primary" onClick={onCreateCampaign}>
            <Plus className="h-4 w-4" />
            Create campaign
          </Button>
        </div>
      </div>

      {/* stats */}
      {section === "overview" && (
      <motion.div
        initial={{ opacity: 0, y: 26, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          icon={Wallet}
          label="Paid out"
          value={fmtMoney(stats.paidOut, true)}
          sub="Settled to clippers this cycle"
          tone="neon"
          meter={{
            value: stats.budget > 0 ? stats.paidOut / stats.budget : 0,
            caption: `${Math.round(
              (stats.budget > 0 ? stats.paidOut / stats.budget : 0) * 100,
            )}% of budget settled`,
          }}
        />
        <StatCard
          icon={BarChart3}
          label="Payout queue"
          value={fmtCents(payoutPendingCents)}
          sub="Requested and waiting on you"
          meter={{
            value:
              stats.paidOut + stats.pending > 0
                ? payoutPendingCents / (payoutPendingCents + stats.paidOut)
                : 0,
            caption: `${fmtMoney(stats.paidOut + stats.pending, true)} in flight`,
          }}
        />
        <StatCard
          icon={Eye}
          label="Clipping volume"
          value={fmtViews(stats.volume)}
          sub={`${fmtFull(stats.volume)} verified views`}
          tone="plain"
          meter={{
            value: Math.min(1, stats.volume / 1_000_000),
            caption: `${fmtFull(stats.volume)} of 1M`,
          }}
        />
        <StatCard
          icon={ScanSearch}
          label="Review queue"
          value={`${stats.reviewQueue}`}
          sub="Clips waiting on moderation"
          tone="amber"
          meter={{
            value: allSubmissions.length
              ? stats.reviewQueue / allSubmissions.length
              : 0,
            caption: `of ${allSubmissions.length} submissions`,
          }}
        />
      </motion.div>
      )}

      {section === "overview" && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SettlementPulse
              budget={stats.budget}
              spent={campaigns.reduce((sum, c) => sum + c.spent, 0)}
              paidOut={stats.paidOut}
              pending={stats.pending}
              liveCampaigns={stats.live}
            />
          </div>
          <div className="lg:col-span-3">
            <ReviewQueue
              clips={allSubmissions.filter((s) => s.status === "pending")}
              campaigns={campaigns}
            />
          </div>
        </div>
      )}

      {section === "overview" && <ShortcutGrid cards={shortcuts} />}

      {section === "requests" && (
        <motion.section
          id="requests"
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.78, ease: EASE }}
          className="glass-panel rounded-2xl p-5"
        >
          <AdminCampaignRequests />
        </motion.section>
      )}

      {section === "creators" && <CreatorsView />}

      {section === "users" && <UsersTable />}

      {section === "messages" && (
        <AdminMessages
          users={adminUsers}
          history={adminMessages}
          onSendToUser={sendToCreator}
          onBroadcast={broadcast}
        />
      )}

      {section === "payouts" && (
        <motion.section
          id="payouts"
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.78, ease: EASE }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">
                Payout requests
              </h2>
              <p className="text-xs text-muted-foreground">
                Every withdrawal a creator has asked for, and what you decided
              </p>
            </div>
            <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              USD
            </span>
          </div>
          <div className="mt-4">
            <AdminPayouts />
          </div>
          <div className="mt-6 border-t border-white/[0.07] pt-5">
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Payouts sent over the last 7 days
          </h3>
            <PayoutChart data={payoutSeries} />
          </div>
        </motion.section>
      )}

      {section === "invoices" && (
        <motion.section
          id="invoices"
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.78, ease: EASE }}
          className="glass-panel scroll-mt-24 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="glass-chip inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#C9AEFF]">
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
                className="glass-chip flex items-center gap-3 rounded-xl px-3 py-2.5"
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
        transition={{ duration: 0.78, ease: EASE }}
        className="glass-panel scroll-mt-24 rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
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
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
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
                        className="glass-chip gap-1.5 text-[12px] hover:border-white/20"
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
                          className="glass-chip gap-1.5 text-[12px] hover:border-white/20"
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
                      className="bg-white/[0.02]"
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
        transition={{ duration: 0.78, ease: EASE }}
        className="glass-panel scroll-mt-24 rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
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
                        /* Money leaves Clip Vault through a payout request, not
                           through this table. Accepting a clip credits the
                           creator's balance; the cash moves when they ask for
                           it and an operator pays it on the payouts page. */
                        <span className="text-[11.5px] font-semibold text-neon">
                          Paid to balance
                        </span>
                      ) : submission.status === "paid" ? (
                        <span className="text-[11.5px] font-semibold text-muted-foreground">
                          Withdrawn
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
          Mark a payout request as paid and the last 7 days will chart here.
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
                transition={{ duration: 0.9, delay: i * 0.08, ease: EASE }}
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
