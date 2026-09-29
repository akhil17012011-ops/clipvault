import { PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
import { Button } from "@/components/ui/button";
import {
  afterFee,
  campaignById,
  daysAgo,
  earnedOf,
  fmtCents,
  fmtMoney,
  fmtViews,
  type Campaign,
  type Submission,
  type Wallet as WalletSummary,
} from "@/lib/clip-vault-data";
import {
  ArrowUpRight,
  Clapperboard,
  ScanSearch,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";

/**
 * Overview money panel — the creator's real balance, not an estimate.
 *
 * These are the wallet's own numbers, so this card and the payments page can
 * never disagree: money is only counted once, when a clip is approved, and it
 * leaves the available balance the moment a payout is requested.
 */
export function PayoutPulse({
  wallet,
}: {
  wallet: WalletSummary;
}) {
  const available = wallet.availableCents / 100;
  const pending = wallet.pendingCents / 100;
  const lifetime = wallet.lifetimeCents / 100;
  const paidOut = Math.max(0, lifetime - available - pending);
  const paidShare = lifetime > 0 ? paidOut / lifetime : 0;
  const hasMoney = lifetime > 0;

  return (
    <section className="glass-panel relative flex h-full flex-col overflow-hidden rounded-2xl p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#7C3AED]/20" />

      <header className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="glass-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#C9AEFF]">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Payout pulse
            </p>
            <p className="text-[13px] font-semibold tracking-tight">
              Available balance
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/payments"
          className="group inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#C9AEFF] transition-colors hover:text-[#E4D6FF]"
        >
          Payments
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <p className="relative mt-5 font-mono text-[38px] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-foreground">
        {fmtCents(wallet.availableCents)}
      </p>
      <p className="relative mt-2 text-[12.5px] text-muted-foreground">
        {wallet.availableCents >= wallet.minWithdrawalCents
          ? "You're over the minimum — request a payout whenever you want."
          : `Approved clips earn ${fmtCents(
              wallet.minWithdrawalCents - wallet.availableCents,
            )} more before you can withdraw.`}
      </p>

      {/* Settled vs pending, as one proportional bar. */}
      <div className="relative mt-5">
        <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#6EE7B7] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.round(paidShare * 100)}%` }}
          />
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#C084FC] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.round((1 - paidShare) * 100)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <Legend
            swatch="from-[#34D399] to-[#6EE7B7]"
            label="Settled"
            value={fmtMoney(paidOut, true)}
          />
          <Legend
            swatch="from-[#7C3AED] to-[#C084FC]"
            label="In a request"
            value={fmtCents(wallet.pendingCents)}
          />
          <Legend
            swatch="from-white/25 to-white/10"
            label="Lifetime"
            value={fmtCents(wallet.lifetimeCents)}
          />
        </div>
      </div>

      <div className="relative mt-auto pt-5">
        {hasMoney ? (
          /* Clips are submitted from the Clips and Campaigns pages, so this
             points there rather than opening the modal from the overview. */
          <Button asChild className="w-full gap-1.5 glow-primary">
            <Link to="/dashboard/clips">
              <Clapperboard className="h-4 w-4" />
              Submit another clip
            </Link>
          </Button>
        ) : (
          <div className="glass-chip flex items-start gap-2.5 rounded-xl px-3.5 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9AEFF]" />
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Earnings appear here the moment a clip you submitted passes its
              campaign&apos;s view threshold.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Legend({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full bg-gradient-to-br ${swatch}`}
        aria-hidden
      />
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[11.5px] font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </span>
  );
}

/**
 * Latest clips the creator submitted, newest first. Falls back to a real
 * empty state rather than an empty box.
 */
export function RecentActivity({
  clips,
  campaigns,
}: {
  clips: Submission[];
  campaigns: Campaign[];
}) {
  const recent = [...clips]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 4);

  return (
    <section className="glass-panel flex h-full flex-col rounded-2xl p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="glass-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#C9AEFF]">
            <Clapperboard className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Activity
            </p>
            <p className="text-[13px] font-semibold tracking-tight">
              Your latest clips
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/clips"
          className="group inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#C9AEFF] transition-colors hover:text-[#E4D6FF]"
        >
          All clips
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      {recent.length === 0 ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.09] px-5 py-8 text-center">
          <span className="glass-chip inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[#C9AEFF]">
            <Clapperboard className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[13px] font-semibold">No clips yet</p>
          <p className="mt-1 max-w-[26ch] text-[12px] leading-relaxed text-muted-foreground">
            Paste a link to any clip you published for a joined campaign and we
            start tracking its views.
          </p>
          <Button asChild size="sm" className="mt-4 gap-1.5">
            <Link to="/dashboard/clips">
              <Clapperboard className="h-3.5 w-3.5" />
              Submit a clip
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {recent.map((clip) => {
            const campaign = campaignById(campaigns, clip.campaignId);
            const earned = afterFee(earnedOf(clip, campaigns));
            return (
              <li
                key={clip.id}
                className="glass-chip group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:border-white/20"
              >
                <PlatformChip platform={clip.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold">
                    {campaign?.brand ?? "Campaign"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    @{clip.author} · {daysAgo(clip.submittedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[12.5px] font-semibold tabular-nums">
                    {fmtViews(clip.views)}
                  </p>
                  <p className="font-mono text-[10.5px] tabular-nums text-[#7DF0B4]">
                    {fmtMoney(earned, true)}
                  </p>
                </div>
                <StatusBadge status={clip.status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Admin overview money panel — how much of the committed campaign budget has
 * actually been spent, and how that spend splits between settled payouts and
 * money still held in the queue.
 */
export function SettlementPulse({
  budget,
  spent,
  paidOut,
  pending,
  liveCampaigns,
}: {
  budget: number;
  spent: number;
  paidOut: number;
  pending: number;
  liveCampaigns: number;
}) {
  const committed = budget > 0 ? Math.min(1, spent / budget) : 0;
  const settled = paidOut + pending > 0 ? paidOut / (paidOut + pending) : 0;
  const remaining = Math.max(0, budget - spent);

  return (
    <section className="glass-panel relative flex h-full flex-col overflow-hidden rounded-2xl p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#7C3AED]/20" />

      <header className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="glass-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#C9AEFF]">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Settlement pulse
            </p>
            <p className="text-[13px] font-semibold tracking-tight">
              {liveCampaigns} campaign{liveCampaigns === 1 ? "" : "s"} live
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/payouts"
          className="group inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#C9AEFF] transition-colors hover:text-[#E4D6FF]"
        >
          Payouts
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <p className="relative mt-5 font-mono text-[38px] font-extrabold leading-none tracking-[-0.045em] tabular-nums text-foreground">
        {fmtMoney(remaining, true)}
      </p>
      <p className="relative mt-2 text-[12.5px] text-muted-foreground">
        Budget still uncommitted across every campaign.
      </p>

      <div className="relative mt-5">
        <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#6EE7B7] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.round(committed * settled * 100)}%` }}
          />
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#C084FC] transition-[width] duration-700 ease-out"
            style={{
              width: `${Math.round(committed * (1 - settled) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <Legend
            swatch="from-[#34D399] to-[#6EE7B7]"
            label="Settled"
            value={fmtMoney(paidOut, true)}
          />
          <Legend
            swatch="from-[#7C3AED] to-[#C084FC]"
            label="Queued"
            value={fmtMoney(pending, true)}
          />
          <Legend
            swatch="from-white/25 to-white/10"
            label="Budget"
            value={fmtMoney(budget, true)}
          />
        </div>
      </div>

      <div className="relative mt-auto pt-5">
        <div className="glass-chip rounded-xl px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {Math.round(committed * 100)}% of committed budget is spent ·{" "}
            {fmtMoney(spent, true)} committed to clips
          </p>
        </div>
      </div>
    </section>
  );
}

/** Oldest pending clips first — that is the order they should be reviewed in. */
export function ReviewQueue({
  clips,
  campaigns,
}: {
  clips: Submission[];
  campaigns: Campaign[];
}) {
  const queue = [...clips]
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .slice(0, 4);

  return (
    <section className="glass-panel flex h-full flex-col rounded-2xl p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="glass-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-amber-300">
            <ScanSearch className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Moderation
            </p>
            <p className="text-[13px] font-semibold tracking-tight">
              Waiting on a decision
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/moderation"
          className="group inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#C9AEFF] transition-colors hover:text-[#E4D6FF]"
        >
          Open queue
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      {queue.length === 0 ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.09] px-5 py-8 text-center">
          <span className="glass-chip inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[#7DF0B4]">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[13px] font-semibold">Queue is clear</p>
          <p className="mt-1 max-w-[26ch] text-[12px] leading-relaxed text-muted-foreground">
            New submissions land here the moment a clipper submits one.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {queue.map((clip) => {
            const campaign = campaignById(campaigns, clip.campaignId);
            return (
              <li
                key={clip.id}
                className="glass-chip flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:border-white/20"
              >
                <PlatformChip platform={clip.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold">
                    {campaign?.brand ?? "Campaign"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    @{clip.author} · {daysAgo(clip.submittedAt)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-[12.5px] font-semibold tabular-nums">
                  {fmtViews(clip.views)}
                </p>
                <StatusBadge status={clip.status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
