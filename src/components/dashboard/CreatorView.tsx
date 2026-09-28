import { StatCard } from "@/components/dashboard/StatCard";
import { CampaignDetail } from "@/components/dashboard/CampaignDetail";
import { CampaignCard } from "@/components/CampaignCard";
import { PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
import { ShortcutGrid } from "@/components/dashboard/ShortcutGrid";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import {
  campaignById,
  daysAgo,
  earnedOf,
  fmtCents,
  fmtFull,
  fmtMoney,
  fmtViews,
  shortMonth,
  payoutPreview,
  type Platform,
} from "@/lib/clip-vault-data";
import { useClipVault, useCreatorStats } from "@/lib/clip-vault-store";
import { EASE } from "@/lib/motion";
import { MessagesInbox } from "@/components/dashboard/MessagesInbox";
import { RequestCampaignView } from "@/components/dashboard/RequestCampaignView";
import { AccountsView } from "@/components/dashboard/AccountsView";
import { BrandRequestPanel } from "@/components/dashboard/BrandRequestPanel";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import {
  PayoutHistory,
  PayoutRequestCard,
} from "@/components/dashboard/PayoutRequestCard";
import {
  PayoutPulse,
  RecentActivity,
} from "@/components/dashboard/OverviewPanels";
import {
  Clock3,
  Eye,
  ExternalLink,
  Link2,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";

/** Each sidebar entry is its own page under /dashboard/:section. */
export type CreatorSection =
  | "overview"
  | "campaigns"
  | "clips"
  | "payments"
  | "accounts"
  | "leaderboard"
  | "request"
  | "messages";

export function CreatorView({
  section,
  onConnect,
  onSubmitClip,
}: {
  section: CreatorSection;
  onConnect: (platform?: Platform) => void;
  onSubmitClip: () => void;
}) {
  const {
    profile,
    accounts,
    accountStats,
    campaigns,
    wallet,
    toggleJoinCampaign,
    removeAccount,
  } = useClipVault();
  /* Clicking a joined campaign takes you inside it. */
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
  const openCampaign = campaigns.find((c) => c.id === openCampaignId);
  const { user } = useAuth();
  const stats = useCreatorStats();
  /* There is no saved wallet: the header shows what the creator can actually
     withdraw right now, and the method belongs to each request. */
  const payoutLabel = `Min ${fmtCents(wallet.minWithdrawalCents)} to withdraw`;
  const name =
    profile?.name ?? user?.name ?? user?.email?.split("@")[0] ?? "Creator";

  const feed = campaigns.filter((c) => c.status === "active").slice(0, 4);

  const paidCycles = stats.mine
    .filter((s) => s.status === "active" || s.status === "paid")
    .map((s) => {
      const campaign = campaignById(campaigns, s.campaignId);
      return {
        id: s.id,
        label: `${campaign?.brand ?? "Campaign"} · ${shortMonth(s.submittedAt)}`,
        amount: earnedOf(s, campaigns),
      };
    });

  const PAGES: Record<
    CreatorSection,
    { kicker: string; title: string; description: string }
  > = {
    overview: {
      kicker: "Creator dashboard",
      title: `Hey, ${name.split(" ")[0]} \u{1F44B}`,
      description:
        stats.mine.length > 0
          ? `${stats.mine.length} clips live across ${new Set(stats.mine.map((s) => s.campaignId)).size} campaigns — views sync every few seconds.`
          : "Connect an account and join a campaign to start earning.",
    },
    campaigns: {
      kicker: "Browse",
      title: "Campaigns",
      description:
        "Live campaigns with published rates — join one in a tap, no application.",
    },
    clips: {
      kicker: "Track",
      title: "Clips",
      description:
        "Every clip you submitted, with live views and what it has earned.",
    },
    payments: {
      kicker: "Get paid",
      title: "Payments",
      description:
        "Your balance, every payout you've requested, and where each one stands.",
    },
    accounts: {
      kicker: "Verification",
      title: "Accounts",
      description:
        "Bio-verified handles that Clip Vault tracks views back to you for.",
    },    leaderboard: {
      kicker: "Standings",
      title: "Leaderboard",
      description:
        "Who is earning and getting reach on Clip Vault — ranked from the same numbers your payouts are made from.",
    },
    request: {
      kicker: "Brands",
      title: "Request a campaign",
      description:
        "Describe the campaign, the budget and the files — and see whether it was approved.",
    },
    messages: {
      kicker: "Inbox",
      title: "Messages",
      description: "Approvals, declines and anything Clip Vault has sent you directly.",
    },
  };
  const page = PAGES[section];

  const connected = accounts.filter((a) => a.status === "connected").length;
  const joined = campaigns.filter((c) => c.joined).length;
  const shortcuts = [
    {
      to: "/dashboard/accounts",
      icon: ShieldCheck,
      value: `${connected}/${accounts.length} verified`,
      label: "Connected accounts",
      hint:
        accounts.length === 0
          ? "Connect a handle to start tracking views"
          : "Add or remove your bio-verified handles",
    },
    {
      to: "/dashboard/campaigns",
      icon: Megaphone,
      value: `${joined} joined`,
      label: "Campaigns",
      hint: `${stats.activeCampaigns} live on Clip Vault right now`,
    },
    {
      to: "/dashboard/clips",
      icon: Upload,
      value: `${stats.mine.length} clips`,
      label: "Submissions",
      hint: "Views, qualification and earnings per clip",
    },
    {
      to: "/dashboard/payments",
      icon: Wallet,
      value: fmtCents(wallet.availableCents),
      label: "Available balance",
      hint: `Request a payout at ${fmtCents(wallet.minWithdrawalCents)}`,
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
          {/* The actions belong to the page you are actually on. A clip is
              submitted from Clips and Campaigns, and an account is connected
              from anywhere it is the thing blocking you. */}
          <div className="flex flex-wrap gap-2.5">
            {(section === "campaigns" || section === "clips") && (
              <Button
                className="gap-1.5 glow-primary"
                onClick={onSubmitClip}
              >
                <Upload className="h-4 w-4" />
                Submit a clip
              </Button>
            )}
            {section === "campaigns" && (
              <Button asChild variant="outline" className="glass-chip gap-1.5">
                <Link to="/dashboard/request">
                  <Megaphone className="h-4 w-4" />
                  Request a campaign
                </Link>
              </Button>
            )}
            {section !== "request" && section !== "messages" && (
              <Button
                variant="outline"
                className="glass-chip gap-1.5 text-foreground hover:border-white/20 hover:bg-white/[0.07]"
                onClick={() => onConnect()}
              >
                <Link2 className="h-4 w-4" />
                Connect account
              </Button>
            )}
          </div>
        </div>
      </div>

      {section === "overview" && accounts.length === 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-600 dark:text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">
                No connected accounts yet
              </p>
              <p className="text-[13px] text-amber-700 dark:text-amber-200/70">
                Add your TikTok or Reels handle and drop the generated code into
                your bio — that&apos;s how views get tracked back to you.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-300 text-zinc-900 hover:bg-amber-200"
            onClick={() => onConnect()}
          >
            Connect now
          </Button>
        </div>
      )}

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
          label="Total earnings"
          value={fmtCents(wallet.lifetimeCents)}
          sub={`${fmtCents(wallet.availableCents)} available to withdraw`}
          tone="neon"
          meter={{
            value:
              wallet.lifetimeCents > 0
                ? wallet.availableCents / wallet.lifetimeCents
                : 0,
            caption: `${Math.round(
              (wallet.lifetimeCents > 0
                ? wallet.availableCents / wallet.lifetimeCents
                : 0) * 100,
            )}% still in your balance`,
          }}
        />
        <StatCard
          icon={Eye}
          label="Views counted"
          value={fmtViews(stats.totalViews)}
          sub={
            stats.awaitingViews > 0
              ? `${fmtFull(stats.awaitingViews)} on ${stats.awaitingClips} clip${
                  stats.awaitingClips === 1 ? "" : "s"
                } awaiting verification`
              : `${fmtFull(stats.totalViews)} verified views`
          }
          meter={{
            value: Math.min(1, stats.totalViews / 1_000_000),
            caption: `${fmtFull(stats.totalViews)} of 1M`,
          }}
        />
        <StatCard
          icon={Zap}
          label="Active campaigns"
          value={`${stats.activeCampaigns}`}
          sub={`${campaigns.filter((c) => c.status === "active").length} live on Clip Vault right now`}
          meter={{
            value: campaigns.length
              ? stats.activeCampaigns / campaigns.length
              : 0,
            caption: `${campaigns.length} listed`,
          }}
        />
        <StatCard
          icon={Clock3}
          label="Payout status"
          value={fmtCents(wallet.availableCents)}
          sub={
            wallet.availableCents >= wallet.minWithdrawalCents
              ? "Ready to request a payout"
              : `${fmtCents(wallet.minWithdrawalCents - wallet.availableCents)} to the minimum`
          }
          tone={wallet.availableCents >= wallet.minWithdrawalCents ? "neon" : "violet"}
        />
      </motion.div>
      )}

      {section === "overview" && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <PayoutPulse wallet={wallet} />
          </div>
          <div className="lg:col-span-3">
            <RecentActivity clips={stats.mine} campaigns={campaigns} />
          </div>
        </div>
      )}

      {section === "overview" && <ShortcutGrid cards={shortcuts} />}

      {section === "campaigns" && openCampaign && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setOpenCampaignId(null)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </button>
          <CampaignDetail
            campaign={openCampaign}
            onBack={() => setOpenCampaignId(null)}
          />
        </div>
      )}

      {section === "campaigns" && !openCampaign && (
        <div className="space-y-5">
          <motion.section
            id="campaigns"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.78, ease: EASE }}
            className="glass-panel scroll-mt-24 rounded-2xl p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold tracking-tight">
                  Active campaigns
                </h2>
                <p className="text-xs text-muted-foreground">
                  Published rates — join in one tap
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Button asChild size="sm" variant="outline" className="glass-chip gap-1.5">
                  <Link to="/dashboard/request">
                    <Megaphone className="h-3.5 w-3.5" />
                    Request a campaign
                  </Link>
                </Button>
                <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {feed.length} live
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {feed.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onJoin={() => toggleJoinCampaign(campaign.id)}
                  onOpen={
                    campaign.joined && campaign.status === "active"
                      ? () => setOpenCampaignId(campaign.id)
                      : undefined
                  }
                />
              ))}
              {feed.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/12 px-6 py-12 text-center dark:border-white/15">
                  <Megaphone className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">
                    No campaigns are live yet
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Brands publish campaigns here as they launch them. Connect
                    an account in the meantime and you&apos;ll be ready to clip
                    the moment one goes live.
                  </p>
                  <Button asChild className="mt-5 gap-1.5 glow-primary">
                    <Link to="/dashboard/request">
                      <Megaphone className="h-4 w-4" />
                      Request a campaign
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.section>

          <BrandRequestPanel />
        </div>
      )}

      {section === "clips" && (
          <motion.section
            id="clips"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.78, ease: EASE }}
            className="glass-panel scroll-mt-24 rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold tracking-tight">
                  Submissions &amp; earnings
                </h2>
                <p className="text-xs text-muted-foreground">
                  Views are pulled from the source platform
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="glass-chip gap-1.5 hover:border-white/20"
                onClick={onSubmitClip}
              >
                <Upload className="h-3.5 w-3.5" />
                Submit
              </Button>
            </div>

            {stats.mine.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold">No clips yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submit your first clip and watch the counter climb.
                </p>
                <Button size="sm" className="mt-4 glow-primary" onClick={onSubmitClip}>
                  Submit a clip
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Clip</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Platform
                      </TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.mine.map((submission) => {
                      const campaign = campaignById(
                        campaigns,
                        submission.campaignId,
                      );
                      const earned = earnedOf(submission, campaigns);
                      const preview = campaign
                        ? payoutPreview(
                            submission.views,
                            campaign.ratePer1k,
                            campaign.minViews,
                          )
                        : null;
                      const qualifying =
                        campaign !== undefined &&
                        submission.views < campaign.minViews &&
                        submission.status !== "rejected";
                      /* The count on the clip and the count that earns are two
                         different things until an operator checks it. Both are
                         shown, and the unverified one is never dressed up as
                         money. */
                      return (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <a
                              href={submission.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-[190px] items-center gap-1.5 truncate font-mono text-[12.5px] text-brand transition-colors hover:text-[#7C2FE0] dark:hover:text-[#ddd3ff]"
                            >
                              <span className="truncate">
                                {linkLabel(submission.link)}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <span className="text-[13px] font-medium">
                              {campaign?.brand ?? "—"}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {daysAgo(submission.submittedAt)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <PlatformChip
                                platform={submission.platform}
                                size="sm"
                              />
                              <span className="text-[11.5px] text-muted-foreground">
                                @{submission.author}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`font-mono text-[13px] font-semibold ${
                                submission.viewsConfirmed
                                  ? ""
                                  : "text-muted-foreground"
                              }`}
                            >
                              {fmtFull(submission.views)}
                            </span>
                            {submission.status === "active" && (
                              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-neon align-middle live-dot text-neon" />
                            )}
                            {submission.viewsConfirmed ? (
                              submission.metrics &&
                              submission.status === "pending" && (
                                <span className="block text-[10.5px] text-muted-foreground">
                                  {fmtFull(submission.metrics.likes)} likes
                                </span>
                              )
                            ) : (
                              <span className="mt-0.5 block text-[10px] font-semibold text-amber-500/90 dark:text-amber-300/90">
                                awaiting verification
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={submission.status} />
                            {submission.status === "rejected" &&
                              submission.reviewNote && (
                                <span className="mt-1 block max-w-[150px] text-[10.5px] leading-snug text-muted-foreground">
                                  {submission.reviewNote}
                                </span>
                              )}
                            {submission.status === "pending" && (
                              <span className="mt-1 block text-[10.5px] text-muted-foreground">
                                {campaign && earned > 0
                                  ? `Pays ${fmtMoney(earned)} once views are verified`
                                  : "Admin checking"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[13px] font-bold text-brand">
                            {submission.status === "rejected" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : submission.status === "pending" ? (
                              preview && preview.qualifies && earned > 0 ? (
                                <>
                                  {fmtMoney(earned, true)}
                                  <span className="mt-0.5 block text-[10.5px] font-medium text-muted-foreground">
                                    once views are verified
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  once views are verified
                                </span>
                              )
                            ) : qualifying ? (
                              fmtMoney(earned, true)
                            ) : (
                              <span
                                className="text-[11px] font-medium text-muted-foreground"
                                title={`Needs ${fmtViews(
                                  (campaign?.minViews ?? 0) -
                                    submission.views,
                                )} more views to qualify`}
                              >
                                qualifying…
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

      {section === "leaderboard" && <Leaderboard />}

      {section === "request" && <RequestCampaignView />}

      {section === "messages" && <MessagesInbox />}

      {section === "accounts" && (
        <div id="accounts" className="scroll-mt-24">
          <AccountsView
            accounts={accounts}
            stats={accountStats}
            clips={stats.mine}
            onConnect={onConnect}
            onRemove={removeAccount}
          />
        </div>
      )}

      {section === "payments" && (
          <motion.section
            id="payouts"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.78, ease: EASE }}
            className="glass-panel scroll-mt-24 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                  <Wallet className="h-4 w-4" />
                </span>
                <h2 className="text-[15px] font-bold tracking-tight">
                  Payouts
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {payoutLabel}
              </span>
            </div>

            {/* Balance first. What a creator opens Payouts to find out is how
                much they can withdraw right now, so that is the number at the
                top rather than buried in a cycle summary. */}
            <div className="panel-fx mt-4 overflow-hidden rounded-xl border border-brand/30 bg-brand/[0.08] px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Available balance
              </p>
              <p className="mt-1.5 font-mono text-3xl font-extrabold tracking-tight text-foreground">
                {fmtCents(wallet.availableCents)}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                From approved clips, ready to withdraw
              </p>

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/8 pt-3.5">
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    In pending
                  </dt>
                  <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground">
                    {fmtCents(wallet.pendingCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Earned to date
                  </dt>
                  <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground">
                    {fmtCents(wallet.lifetimeCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Already paid
                  </dt>
                  <dd className="mt-0.5 font-mono text-[14px] font-bold text-neon">
                    {fmtCents(wallet.lifetimeCents - wallet.availableCents - wallet.pendingCents)}
                  </dd>
                </div>
              </dl>

              <div className="mt-3.5 flex items-center justify-between rounded-lg bg-black/[0.25] px-3 py-2">
                <span className="text-[11.5px] text-muted-foreground">
                  Minimum withdrawal
                </span>
                <span className="text-[11.5px] font-semibold text-foreground">
                  {fmtCents(wallet.minWithdrawalCents)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <PayoutRequestCard />
            </div>

            <PayoutHistory />

            <h3 className="mt-5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Earnings from clips
            </h3>
            <ul className="mt-2 space-y-2">
              {paidCycles.length === 0 ? (
                <li className="glass-chip rounded-xl px-4 py-4 text-center text-xs text-muted-foreground">
                  Approved clips that earned money will show up here.
                </li>
              ) : (
                paidCycles.map((cycle) => (
                  <li
                    key={cycle.id}
                    className="flex items-center justify-between glass-chip rounded-xl px-4 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-medium">{cycle.label}</p>
                      <div className="mt-0.5">
                        <StatusBadge status="active" />
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-brand">
                      {fmtMoney(cycle.amount, true)}
                    </span>
                  </li>
                ))
              )}
            </ul>

            <p className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              Approving a clip adds its earnings to your balance straight away.
              You choose the currency and address when you request a payout —
              nothing is saved to your profile.
            </p>
          </motion.section>
      )}
    </div>
  );
}

function linkLabel(url: string) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1] ?? "";
    return `${parsed.hostname.replace(/^www\./, "")}/${id.slice(0, 12)}`;
  } catch {
    return url.slice(0, 26);
  }
}
