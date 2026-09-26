import { StatCard } from "@/components/dashboard/StatCard";
import { CampaignDetail } from "@/components/dashboard/CampaignDetail";
import { CampaignCard } from "@/components/CampaignCard";
import { PlatformChip, StatusBadge } from "@/components/ClipticUI";
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
import { ArrowLeft } from "lucide-react";
import {
  campaignById,
  daysAgo,
  earnedOf,
  fmtFull,
  fmtMoney,
  fmtViews,
  shortMonth,
  type AccountStats,
  type LinkedAccount,
} from "@/lib/cliptic-data";
import { useCliptic, useCreatorStats } from "@/lib/cliptic-store";
import { MessagesInbox } from "@/components/dashboard/MessagesInbox";
import { PayoutSettings } from "@/components/dashboard/PayoutSettings";
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
  Trash2,
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
  | "messages";

export function CreatorView({
  section,
  onConnect,
  onSubmitClip,
}: {
  section: CreatorSection;
  onConnect: () => void;
  onSubmitClip: () => void;
}) {
  const {
    profile,
    accounts,
    accountStats,
    campaigns,
    toggleJoinCampaign,
    removeAccount,
  } = useCliptic();
  /* Clicking a joined campaign takes you inside it. */
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
  const openCampaign = campaigns.find((c) => c.id === openCampaignId);
  const { user } = useAuth();
  const stats = useCreatorStats();
  /* Shown instead of a hardcoded payment method, so the header always matches
     the wallet the creator actually entered. */
  const payoutLabel = profile?.payoutAddress
    ? `${profile.payoutCurrency === "ltc" ? "LTC" : "SOL"} ${profile.payoutAddress.slice(0, 6)}…${profile.payoutAddress.slice(-4)}`
    : "No payout address yet";
  const name =
    profile?.name ?? user?.name ?? user?.email?.split("@")[0] ?? "Creator";

  const feed = campaigns.filter((c) => c.status === "active").slice(0, 4);

  const paidCycles = stats.mine
    .filter((s) => s.status === "paid")
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
        "Your current cycle and every payout CLIPTIC has settled to you.",
    },
    accounts: {
      kicker: "Verification",
      title: "Accounts",
      description:
        "Bio-verified handles that CLIPTIC tracks views back to you for.",
    },
    messages: {
      kicker: "Inbox",
      title: "Messages",
      description:
        "Approvals, declines and anything CLIPTIC has sent you directly.",
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
      hint: `${stats.activeCampaigns} live on CLIPTIC right now`,
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
      value: fmtMoney(stats.pending, true),
      label: "Pending payout",
      hint: "Settled automatically when the cycle closes",
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
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              className="glass-chip gap-1.5 text-foreground hover:border-white/20 hover:bg-white/[0.07]"
              onClick={onConnect}
            >
              <Link2 className="h-4 w-4" />
              Connect account
            </Button>
            <Button className="gap-1.5 glow-primary" onClick={onSubmitClip}>
              <Upload className="h-4 w-4" />
              Submit a clip
            </Button>
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
            onClick={onConnect}
          >
            Connect now
          </Button>
        </div>
      )}

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
          label="Total earnings"
          value={fmtMoney(stats.totalEarned, true)}
          sub={`${fmtMoney(stats.paidOut, true)} already paid out`}
          tone="neon"
          meter={{
            value:
              stats.totalEarned > 0 ? stats.paidOut / stats.totalEarned : 0,
            caption: `${Math.round(
              (stats.totalEarned > 0 ? stats.paidOut / stats.totalEarned : 0) *
                100,
            )}% settled`,
          }}
        />
        <StatCard
          icon={Eye}
          label="Views tracked"
          value={fmtViews(stats.totalViews)}
          sub={`${fmtFull(stats.totalViews)} verified views`}
          meter={{
            value: Math.min(1, stats.totalViews / 1_000_000),
            caption: `${fmtFull(stats.totalViews)} of 1M`,
          }}
        />
        <StatCard
          icon={Zap}
          label="Active campaigns"
          value={`${stats.activeCampaigns}`}
          sub={`${campaigns.filter((c) => c.status === "active").length} live on CLIPTIC right now`}
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
          value={stats.pending > 0 ? fmtMoney(stats.pending, true) : "Settled"}
          sub={
            stats.pending > 0
              ? "Pending — cycle closes in 3 days"
              : "Everything has been paid"
          }
          tone={stats.pending > 0 ? "violet" : "neon"}
        />
      </motion.div>
      )}

      {section === "overview" && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <PayoutPulse
              totalEarned={stats.totalEarned}
              paidOut={stats.paidOut}
              pending={stats.pending}
              onSubmitClip={onSubmitClip}
            />
          </div>
          <div className="lg:col-span-3">
            <RecentActivity
              clips={stats.mine}
              campaigns={campaigns}
              onSubmitClip={onSubmitClip}
            />
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
          <motion.section
            id="campaigns"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel scroll-mt-24 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold tracking-tight">
                  Active campaigns
                </h2>
                <p className="text-xs text-muted-foreground">
                  Published rates — join in one tap
                </p>
              </div>
              <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {feed.length} live
              </span>
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
                </div>
              )}
            </div>
          </motion.section>
      )}

      {section === "clips" && (
          <motion.section
            id="clips"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
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
                      const qualifying =
                        campaign !== undefined &&
                        submission.views < campaign.minViews &&
                        submission.status !== "rejected";
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
                            <span className="font-mono text-[13px] font-semibold">
                              {fmtFull(submission.views)}
                            </span>
                            {submission.status === "active" && (
                              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-neon align-middle live-dot text-neon" />
                            )}
                            {submission.metrics && submission.status === "pending" && (
                              <span className="block text-[10.5px] text-muted-foreground">
                                {fmtFull(submission.metrics.likes)} likes
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
                                Admin checking
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[13px] font-bold text-brand">
                            {submission.status === "rejected" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : submission.status === "pending" ? (
                              <span className="text-[11px] font-medium text-muted-foreground">
                                on approval
                              </span>
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

      {section === "messages" && <MessagesInbox />}

      {section === "accounts" && (
          <motion.section
            id="accounts"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel scroll-mt-24 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <h2 className="text-[15px] font-bold tracking-tight">
                  My connected accounts
                </h2>
              </div>
              <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {accounts.filter((a) => a.status === "connected").length}/
                {accounts.length || 0} verified
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-black/12 dark:border-white/15 px-4 py-6 text-center">
                <p className="text-[13px] font-semibold text-foreground/85">
                  Nothing connected yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Verify a handle to start tracking views.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    stats={accountStats.find((s) => s.accountId === account.id)}
                    onRemove={() => removeAccount(account.id)}
                  />
                ))}
              </ul>
            )}

            <Button
              variant="outline"
              className="mt-4 w-full glass-chip gap-1.5 hover:border-white/20"
              onClick={onConnect}
            >
              <Link2 className="h-4 w-4" />
              Connect another account
            </Button>
          </motion.section>
      )}

      {section === "payments" && (
          <motion.section
            id="payouts"
            initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
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
                much they have coming, so that is the number at the top rather
                than buried in a cycle summary. */}
            <div className="panel-fx mt-4 overflow-hidden rounded-xl border border-brand/30 bg-brand/[0.08] px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Available balance
              </p>
              <p className="mt-1.5 font-mono text-3xl font-extrabold tracking-tight text-foreground">
                {fmtMoney(stats.pending, true)}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Earned and not yet paid out
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/8 pt-3.5">
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Earned to date
                  </dt>
                  <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground">
                    {fmtMoney(stats.pending + stats.paidOut, true)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Already paid
                  </dt>
                  <dd className="mt-0.5 font-mono text-[14px] font-bold text-neon">
                    {fmtMoney(stats.paidOut, true)}
                  </dd>
                </div>
              </dl>

              <div className="mt-3.5 flex items-center justify-between rounded-lg bg-black/[0.25] px-3 py-2">
                <span className="text-[11.5px] text-muted-foreground">
                  Next payout
                </span>
                <span className="text-[11.5px] font-semibold text-foreground">
                  Closes in 3 days
                </span>
              </div>
            </div>

            <PayoutSettings />

            <h3 className="mt-5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Paid cycles
            </h3>
            <ul className="mt-2 space-y-2">
              {paidCycles.length === 0 ? (
                <li className="glass-chip rounded-xl px-4 py-4 text-center text-xs text-muted-foreground">
                  Paid cycles will show up here.
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
                        <StatusBadge status="paid" />
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
              Earnings land automatically in your payout method when a cycle
              closes.
            </p>
          </motion.section>
      )}
    </div>
  );
}

function AccountRow({
  account,
  stats,
  onRemove,
}: {
  account: LinkedAccount;
  stats?: AccountStats;
  onRemove: () => void;
}) {
  const connected = account.status === "connected";
  /* Reach is only shown when the platform really published it. A placeholder
     zero would read as "nobody follows you" rather than "we could not see". */
  const reach =
    connected && (account.followers != null || account.posts != null)
      ? [
          account.followers != null
            ? `${fmtViews(account.followers)} followers`
            : null,
          account.posts != null ? `${fmtFull(account.posts)} posts` : null,
        ].filter(Boolean)
      : [];
  const output =
    connected && stats && stats.clips > 0
      ? `${fmtFull(stats.clips)} ${stats.clips === 1 ? "clip" : "clips"} · ${fmtViews(stats.views)} views`
      : null;
  return (
    <li className="flex items-center gap-3 glass-chip rounded-xl px-3 py-2.5">
      <PlatformChip platform={account.platform} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">@{account.handle}</p>
        {connected ? (
          reach.length > 0 || output ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {[...reach, output].filter(Boolean).join(" · ")}
            </p>
          ) : (
            <p className="truncate text-[11px] text-muted-foreground">
              Connected — no clips published yet
            </p>
          )
        ) : (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {account.code}
          </p>
        )}
      </div>
      {connected && stats && stats.earned > 0 ? (
        <span className="shrink-0 font-mono text-[13px] font-bold text-neon">
          {fmtMoney(stats.earned)}
        </span>
      ) : null}
      <StatusBadge status={account.status} />
      <button
        type="button"
        onClick={onRemove}
        title="Disconnect account"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/[0.03] dark:bg-white/[0.05] dark:hover:bg-white/[0.06] hover:text-red-600 dark:hover:text-red-500 dark:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
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
