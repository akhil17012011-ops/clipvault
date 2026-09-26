import { BrandAvatar, PlatformChip, StatusBadge } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
import { Check, Users } from "lucide-react";
import type { Campaign } from "@/lib/cliptic-data";
import { fmtRate, fmtViews } from "@/lib/cliptic-data";

/**
 * The campaign card shared by the landing page preview and the creator
 * dashboard feed: rate, qualifying threshold, platforms, rules and join state.
 */
export function CampaignCard({
  campaign,
  onJoin,
}: {
  campaign: Campaign;
  /** Omit for read-only previews (landing page). */
  onJoin?: () => void;
}) {
  const budgetPct = Math.min(
    100,
    Math.round((campaign.spent / Math.max(campaign.budget, 1)) * 100),
  );

  return (
    <article className="group relative flex flex-col gap-4 rounded-2xl border border-black/8 bg-card/70 p-5 transition-all duration-300 hover:border-brand/40 hover:shadow-[0_18px_50px_-24px_rgb(109_74_255/0.65)]">
      <div className="flex items-start gap-3.5">
        <BrandAvatar name={campaign.brand} />
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
        <span className="shrink-0 rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {campaign.daysLeft}d left
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 rounded-xl border border-black/8 bg-background/50 px-4 py-3">
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-neon">
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
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
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

      <div className="mt-auto space-y-3 border-t border-black/8 pt-3.5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              ${campaign.spent.toLocaleString("en-US")} of $
              {campaign.budget.toLocaleString("en-US")} budget
            </span>
            <span>{budgetPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-[#a78bfa]"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {campaign.clippers.toLocaleString("en-US")} clippers
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
            ) : campaign.joined ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onJoin}
                className="border-neon/30 bg-neon/10 text-neon hover:bg-neon/15 hover:text-neon"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Joined — leave
              </Button>
            ) : (
              <Button size="sm" onClick={onJoin} className="glow-primary">
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
