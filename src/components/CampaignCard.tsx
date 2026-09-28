import { BrandAvatar, PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
import { Button } from "@/components/ui/button";
import { Check, Users } from "lucide-react";
import type { Campaign } from "@/lib/clip-vault-data";
import { fmtCompactMoney, fmtRate, fmtViews } from "@/lib/clip-vault-data";

/**
 * The campaign card shared by the landing page preview and the creator
 * dashboard feed: rate, qualifying threshold, platforms, rules and join state.
 */
export function CampaignCard({
  campaign,
  onJoin,
  onOpen,
}: {
  campaign: Campaign;
  /** Omit for read-only previews (landing page). */
  onJoin?: () => void;
  /** Opens the campaign's detail view (brief, assets, submit a clip). */
  onOpen?: () => void;
}) {
  const budgetPct = Math.min(
    100,
    Math.round((campaign.spent / Math.max(campaign.budget, 1)) * 100),
  );
  /* The budget is the campaign's life support: once every dollar is
     committed to approved clips, nothing is left to pay a new member — the
     campaign stops here, and the server enforces the same line. */
  const exhausted = campaign.spent >= campaign.budget;

  return (
    <article
      onClick={onOpen}
      className={`panel-fx group relative flex flex-col gap-4 rounded-2xl border border-black/8 dark:border-white/10 bg-card p-5 ${
        onOpen ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start gap-3.5">
        {campaign.logo ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-lg dark:border-white/10 dark:bg-white/[0.05]">
            {campaign.logo.startsWith("http") ? (
              <img
                src={campaign.logo}
                alt={campaign.brand}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              campaign.logo
            )}
          </span>
        ) : (
          <BrandAvatar name={campaign.brand} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {campaign.brand}
            </p>
            <StatusBadge
              status={campaign.status === "active" ? "active-campaign" : "paused"}
            />
          </div>
          <h3 className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {campaign.title}
          </h3>
        </div>
        <span className="shrink-0 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {campaign.daysLeft}d left
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 rounded-xl border border-black/8 dark:border-white/10 bg-background/50 px-4 py-3">
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-brand">
            {fmtRate(campaign.ratePer1k)}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">
              / 1K views
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Up to {fmtRate(campaign.ratePer1k * 100)} per 100K
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Min to qualify
          </p>
          <p className="text-sm font-bold text-foreground">
            {fmtViews(campaign.minViews)} views
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {campaign.platforms.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
          >
            <PlatformChip platform={p} size="sm" />
            {platformLabel(p)}
          </span>
        ))}
      </div>

      <div className="space-y-1.5">
        <ul className="space-y-1.5">
          {campaign.guidelines.slice(0, 2).map((rule) => (
            <li
              key={rule}
              className="flex items-start gap-2 text-[12.5px] leading-snug text-muted-foreground"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              {rule}
            </li>
          ))}
        </ul>
        {campaign.guidelines.length > 2 && (
          <p className="pl-[22px] text-[11.5px] font-medium text-brand">
            +{campaign.guidelines.length - 2} more rules
          </p>
        )}
      </div>

      <div className="mt-auto space-y-3 border-t border-black/8 dark:border-white/10 pt-3.5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {fmtCompactMoney(campaign.spent)}/
              {fmtCompactMoney(campaign.budget)} budget
            </span>
            <span
              className={
                exhausted
                  ? "font-bold text-amber-600 dark:text-amber-400"
                  : undefined
              }
            >
              {exhausted ? "Fully spent" : `${budgetPct}%`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${
                exhausted
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-brand to-[#a78bfa]"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {campaign.joinCount.toLocaleString("en-US")} joined
            {campaign.clippers > 0 && (
              <span className="text-muted-foreground/70">
                · {campaign.clippers.toLocaleString("en-US")} approved
              </span>
            )}
          </span>
          {onJoin &&
            (campaign.status === "paused" ? (
              <Button
                variant="outline"
                size="sm"
                className="cursor-not-allowed opacity-50"
                disabled
              >
                Campaign paused
              </Button>
            ) : exhausted && !campaign.joined ? (
              <Button
                variant="outline"
                size="sm"
                className="cursor-not-allowed opacity-50"
                disabled
              >
                Budget spent
              </Button>
            ) : campaign.joined ? (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin();
                }}
                className="border-neon/30 bg-neon/10 text-neon hover:bg-neon/15 hover:text-neon"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Leave
              </Button>
            ) : (
              <Button
                size="sm"
                className="glow-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin();
                }}
              >
                Join campaign
              </Button>
            ))}
        </div>
      </div>
    </article>
  );
}

function platformLabel(p: Campaign["platforms"][number]) {
  return { tiktok: "TikTok", instagram: "Reels", youtube: "Shorts", x: "X" }[p];
}
