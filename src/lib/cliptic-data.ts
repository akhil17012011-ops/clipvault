/**
 * Shared types and pure helpers for CLIPTIC.
 *
 * There is no catalog data and no simulated telemetry in this file any more.
 * Campaigns, connected accounts and submissions all come from the database;
 * the helpers here only describe the rules those records have to satisfy.
 */

export type Platform = "tiktok" | "instagram" | "youtube" | "x";

export const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube", "x"];

/**
 * Platform chips stay neutral (zinc) on purpose — the palette is reserved for
 * black + purple, with green/red used only for success/failure states.
 */
export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; color: string }
> = {
  tiktok: { label: "TikTok", short: "TT", color: "#52525B" },
  instagram: { label: "Instagram Reels", short: "IG", color: "#52525B" },
  youtube: { label: "YouTube Shorts", short: "YT", color: "#52525B" },
  x: { label: "X", short: "X", color: "#52525B" },
};

export type AccountStatus = "pending" | "checking" | "connected" | "failed";

export interface LinkedAccount {
  id: string;
  platform: Platform;
  handle: string;
  /** One-time code the creator pastes into their bio. */
  code: string;
  status: AccountStatus;
  connectedAt?: number;
  /** False for accounts belonging to other clippers in the admin console. */
  mine?: boolean;
  /** Only present on the brand console's directory rows. */
  ownerName?: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid";
export type CampaignStatus = "active" | "paused";

/** A file or page the brand shares so clippers have something to work from. */
export interface CampaignAsset {
  label: string;
  url: string;
  kind: "drive" | "video" | "link";
}

export interface Campaign {
  id: string;
  brand: string;
  title: string;
  /** Brand mark: an emoji, or an image URL the brand uploaded. */
  logo?: string;
  /** Long-form brief shown in the campaign detail view. */
  brief?: string;
  /** Reference links (moodboards, product pages, brand channels). */
  referenceLinks: CampaignAsset[];
  /** Source footage clippers can download and cut from (Drive, etc). */
  sourceFiles: CampaignAsset[];
  /** US dollars earned per 1,000 views. */
  ratePer1k: number;
  /** Views needed on a single clip before it starts earning. */
  minViews: number;
  platforms: Platform[];
  daysLeft: number;
  budget: number;
  /** Budget already committed to payouts. */
  spent: number;
  clippers: number;
  guidelines: string[];
  status: CampaignStatus;
  invoice: InvoiceStatus;
  joined: boolean;
  createdAt: number;
}

export type SubmissionStatus = "pending" | "active" | "paid" | "rejected";

/**
 * Numbers read back from the source platform. These are only ever set from a
 * real platform response — CLIPTIC does not invent them.
 */
export interface ClipMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  fetchedAt: number;
}

export interface Submission {
  id: string;
  campaignId: string;
  /** Identity of the clipper who submitted the clip. */
  creator: string;
  mine: boolean;
  platform: Platform;
  link: string;
  /** Hashtags the creator used in the caption (checked against guidelines). */
  tags?: string[];
  /** Handle the clip was published from, resolved from the link. */
  author: string;
  /** That handle is one of the creator's bio-verified accounts. */
  verifiedOwner: boolean;
  /** The campaign accepts clips from this platform. */
  platformOk: boolean;
  /** Snapshot grabbed from the source platform, when it could be read. */
  metrics?: ClipMetrics;
  views: number;
  status: SubmissionStatus;
  submittedAt: number;
  /** Why the reviewer declined it, shown back to the creator. */
  reviewNote?: string;
}

const DAY = 86_400_000;

/** Detect the source platform of a pasted clip URL. */
export function platformFromLink(link: string): Platform | null {
  const url = link.toLowerCase();
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("twitter.com") || url.includes("x.com")) return "x";
  return null;
}

/**
 * The handle a clip was published from, when the link exposes one.
 * TikTok, YouTube and X include the handle in the path; Instagram reel URLs
 * do not, so those resolve to `null` and are looked up against the creator's
 * connected accounts instead.
 */
export function authorFromLink(
  link: string,
  platform: Platform,
): string | null {
  try {
    const url = new URL(
      link.startsWith("http") ? link : `https://${link.trim()}`,
    );
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (first.startsWith("@") && first.length > 1) {
      return first.slice(1).toLowerCase();
    }
    if (platform === "x" && first && first !== "status" && first !== "i") {
      return first.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

/** `#hashtags` found in free text — lowercased and deduped. */
export function extractTags(text: string): string[] {
  return [
    ...new Set(
      (text.match(/#[\w-]+/g) ?? []).map((tag) => tag.toLowerCase()),
    ),
  ];
}

/** Hashtags a campaign's guidelines require in the caption. */
export function requiredTags(campaign: Campaign): string[] {
  return extractTags(campaign.guidelines.join(" "));
}

/* ------------------------------------------------------------------ */
/* Clip validation — shared by the submit modal and the inline panel   */
/* ------------------------------------------------------------------ */

export interface ClipValidation {
  ok: boolean;
  /** Human-readable reason the scan stopped, when it did. */
  error: string | null;
  platform: Platform | null;
  author: string;
  verifiedOwner: boolean;
  platformOk: boolean;
  tags: string[];
  missingTags: string[];
  link: string;
}

/**
 * Runs the same checks in both submit surfaces: the platform comes from the
 * link, the post must belong to one of the creator's connected accounts, the
 * campaign must accept that platform, and the required hashtags must be in the
 * caption.
 *
 * This is fast client-side feedback only. The mutation re-checks every one of
 * these rules on the server before it writes anything.
 */
export function validateClip(input: {
  campaign: Campaign;
  link: string;
  caption: string;
  /** Handles the creator has bio-verified, lowercased. */
  connectedHandles: string[];
}): ClipValidation {
  const { campaign, link, caption, connectedHandles } = input;
  const trimmed = link.trim();
  const tags = extractTags(caption);
  const missingTags = requiredTags(campaign).filter(
    (tag) => !tags.includes(tag),
  );

  const fail = (error: string): ClipValidation => ({
    ok: false,
    error,
    platform: null,
    author: "",
    verifiedOwner: false,
    platformOk: false,
    tags,
    missingTags,
    link: trimmed,
  });

  if (!trimmed || !trimmed.includes(".")) {
    return fail("Paste a valid link to your published clip.");
  }
  const platform = platformFromLink(trimmed);
  if (!platform) {
    return fail(
      "We couldn't recognize the platform from this link — use a TikTok, Instagram, YouTube or X URL.",
    );
  }

  const linked = authorFromLink(trimmed, platform);
  const author = linked ?? connectedHandles[0] ?? "";
  const verifiedOwner =
    author !== "" && connectedHandles.includes(author.toLowerCase());
  const platformOk = campaign.platforms.includes(platform);

  if (!verifiedOwner) {
    return {
      ...fail(
        author
          ? `@${author} isn't one of your connected accounts — submit your own clip.`
          : "Connect an account before submitting clips.",
      ),
      platform,
      author,
    };
  }
  if (!platformOk) {
    return {
      ...fail(
        `${PLATFORM_META[platform].label} clips aren't accepted by this campaign.`,
      ),
      platform,
      author,
      verifiedOwner,
      platformOk,
    };
  }
  if (missingTags.length > 0) {
    return {
      ...fail(`Your caption is missing ${missingTags.join(" ")}.`),
      platform,
      author,
      verifiedOwner,
      platformOk,
    };
  }

  return {
    ok: true,
    error: null,
    platform,
    author,
    verifiedOwner,
    platformOk,
    tags,
    missingTags,
    link: trimmed,
  };
}

export const campaignById = (
  campaigns: Campaign[],
  id: string,
): Campaign | undefined => campaigns.find((c) => c.id === id);

/** Earnings accrued by a clip at its current view count. */
export function earnedOf(
  submission: Submission,
  campaigns: Campaign[],
): number {
  const campaign = campaignById(campaigns, submission.campaignId);
  if (!campaign || submission.status === "rejected") return 0;
  if (submission.views < campaign.minViews) return 0;
  return (submission.views / 1000) * campaign.ratePer1k;
}

export function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return `${n}`;
}

export function fmtFull(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Clipper directory (brand console) — built from real records         */
/* ------------------------------------------------------------------ */

export interface CreatorProfile {
  name: string;
  handle: string;
  platform: Platform;
  connectedAt: number;
  /** Clips they have submitted, and how they performed. */
  clips: {
    campaignId: string;
    platform: Platform;
    views: number;
    status: SubmissionStatus;
    daysAgo: number;
  }[];
}

/** Totals for one creator row in the admin directory. */
export function creatorTotals(creator: CreatorProfile) {
  const live = creator.clips.filter((c) => c.status !== "rejected");
  return {
    clips: creator.clips.length,
    views: live.reduce((sum, c) => sum + c.views, 0),
    inReview: creator.clips.filter((c) => c.status === "pending").length,
    paid: creator.clips.filter((c) => c.status === "paid").length,
  };
}

export function fmtMoney(n: number, cents = false): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function fmtRate(ratePer1k: number): string {
  return `$${ratePer1k.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shortMonth(time: number): string {
  return new Date(time).toLocaleString("en-US", { month: "long" });
}

export function daysAgo(time: number): string {
  const days = Math.max(0, Math.floor((Date.now() - time) / DAY));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
