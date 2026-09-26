/** Shared types, catalog data and formatting helpers for CLIPTIC. */

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
  code: string;
  status: AccountStatus;
  connectedAt?: number;
}

export type InvoiceStatus = "draft" | "sent" | "paid";
export type CampaignStatus = "active" | "paused";

export interface Campaign {
  id: string;
  brand: string;
  title: string;
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
  views: number;
  status: SubmissionStatus;
  submittedAt: number;
}

export interface DemoProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const makeCode = () =>
  `CLIPTIC-${Math.floor(1000 + Math.random() * 9000)}`;

const DAY = 86_400_000;

/**
 * Sign-in decides the dashboard: `admin@…` accounts land on the brand/admin
 * console, everything else lands on the creator dashboard. No manual switch.
 */
export function roleForEmail(
  email?: string | null,
): "admin" | "creator" {
  const local = (email ?? "").split("@")[0].toLowerCase().trim();
  return local === "admin" || local.startsWith("admin") ? "admin" : "creator";
}

/** Detect the source platform of a pasted clip URL. */
export function platformFromLink(link: string): Platform | null {
  const url = link.toLowerCase();
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("twitter.com") || url.includes("x.com")) return "x";
  return null;
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

/** Live campaign catalog shown on the landing page, creator feed and admin console. */
export const seedCampaigns = (): Campaign[] => [
  {
    id: "cmp-ripple",
    brand: "Ripple Audio",
    title: "Ripple Air Pro Launch",
    ratePer1k: 0.4,
    minViews: 100_000,
    platforms: ["tiktok", "instagram", "youtube"],
    daysLeft: 50,
    budget: 40_000,
    spent: 0,
    clippers: 0,
    guidelines: [
      "Show the product within the first 2 seconds",
      "Use #RippleAirPro + #CLIPTIC in the caption",
      "No unboxing-free footage, must show the case",
    ],
    status: "active",
    invoice: "draft",
    joined: false,
    createdAt: Date.now() - 22 * DAY,
  },
  {
    id: "cmp-monolith",
    brand: "Monolith",
    title: "Monolith Drop Season 04",
    ratePer1k: 3.0,
    minViews: 10_000,
    platforms: ["tiktok", "instagram"],
    daysLeft: 40,
    budget: 120_000,
    spent: 0,
    clippers: 0,
    guidelines: [
      "Streetwear try-on or styling angle",
      "Tag @monolith in the caption",
      "Original audio preferred, trending audio allowed",
    ],
    status: "active",
    invoice: "draft",
    joined: false,
    createdAt: Date.now() - 9 * DAY,
  },
  {
    id: "cmp-pulse",
    brand: "Pulse Energy",
    title: "Pulse Summer Circuit",
    ratePer1k: 0.65,
    minViews: 50_000,
    platforms: ["tiktok", "youtube", "x"],
    daysLeft: 31,
    budget: 25_000,
    spent: 0,
    clippers: 0,
    guidelines: [
      "Outdoor / sports setting required",
      "Can must be visible in frame for 3+ seconds",
      "No competitor branding in shot",
    ],
    status: "active",
    invoice: "draft",
    joined: false,
    createdAt: Date.now() - 4 * DAY,
  },
  {
    id: "cmp-vertex",
    brand: "Vertex Gaming",
    title: "Vertex Bounty Pool",
    ratePer1k: 1.8,
    minViews: 500_000,
    platforms: ["youtube", "tiktok"],
    daysLeft: 300,
    budget: 60_000,
    spent: 0,
    clippers: 0,
    guidelines: [
      "Gameplay highlight with commentary",
      "Disclose #VertexPartner",
      "Clips must be from the current season",
    ],
    status: "active",
    invoice: "draft",
    joined: false,
    createdAt: Date.now() - 60 * DAY,
  },
  {
    id: "cmp-halo",
    brand: "Hälo Studios",
    title: "Hälo Creator Fund",
    ratePer1k: 1.2,
    minViews: 50_000,
    platforms: ["instagram", "youtube", "x"],
    daysLeft: 64,
    budget: 75_000,
    spent: 0,
    clippers: 0,
    guidelines: [
      "Behind-the-scenes or studio tour angle",
      "Tag @halostudios",
      "Keep clips under 45 seconds",
    ],
    status: "active",
    invoice: "draft",
    joined: false,
    createdAt: Date.now() - 2 * DAY,
  },
  {
    id: "cmp-northwind",
    brand: "Northwind",
    title: "Northwind Trail Series",
    ratePer1k: 0.9,
    minViews: 25_000,
    platforms: ["tiktok", "instagram"],
    daysLeft: 12,
    budget: 18_000,
    spent: 0,
    clippers: 0,
    guidelines: ["Outdoor trail footage", "Show the product logo clearly"],
    status: "paused",
    invoice: "draft",
    joined: false,
    createdAt: Date.now() - 35 * DAY,
  },
];

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
