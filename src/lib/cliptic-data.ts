/** Shared types, seed data and formatting helpers for the CLIPTIC demo state. */

export type Platform = "tiktok" | "instagram" | "youtube" | "x";

export const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube", "x"];

export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; color: string }
> = {
  tiktok: { label: "TikTok", short: "TT", color: "#25F4EE" },
  instagram: { label: "Instagram Reels", short: "IG", color: "#E1306C" },
  youtube: { label: "YouTube Shorts", short: "YT", color: "#FF3D3D" },
  x: { label: "X", short: "X", color: "#A1A1AA" },
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
  /** Demo identity of the clipper who submitted the clip. */
  creator: string;
  mine: boolean;
  platform: Platform;
  link: string;
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

/** Live campaigns shown across the landing page, creator feed and admin console. */
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
    spent: 12_480,
    clippers: 1_284,
    guidelines: [
      "Show the product within the first 2 seconds",
      "Use #RippleAirPro + #CLIPTIC in the caption",
      "No unboxing-free footage, must show the case",
    ],
    status: "active",
    invoice: "paid",
    joined: true,
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
    spent: 54_300,
    clippers: 842,
    guidelines: [
      "Streetwear try-on or styling angle",
      "Tag @monolith in the caption",
      "Original audio preferred, trending audio allowed",
    ],
    status: "active",
    invoice: "sent",
    joined: true,
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
    spent: 6_120,
    clippers: 613,
    guidelines: [
      "Outdoor / sports setting required",
      "Can must be visible in frame for 3+ seconds",
      "No competitor branding in shot",
    ],
    status: "active",
    invoice: "draft",
    joined: true,
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
    spent: 18_900,
    clippers: 2_051,
    guidelines: [
      "Gameplay highlight with commentary",
      "Disclose #VertexPartner",
      "Clips must be from the current season",
    ],
    status: "active",
    invoice: "paid",
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
    spent: 9_400,
    clippers: 468,
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
    spent: 15_760,
    clippers: 302,
    guidelines: ["Outdoor trail footage", "Show the product logo clearly"],
    status: "paused",
    invoice: "sent",
    joined: false,
    createdAt: Date.now() - 35 * DAY,
  },
];

/** The signed-in creator's clip history (drives earnings + view totals). */
export const seedSubmissions = (): Submission[] => [
  {
    id: "sub-1",
    campaignId: "cmp-ripple",
    creator: "you",
    mine: true,
    platform: "tiktok",
    link: "https://tiktok.com/@avaclips/video/7401882341",
    views: 1_284_300,
    status: "paid",
    submittedAt: Date.now() - 26 * DAY,
  },
  {
    id: "sub-2",
    campaignId: "cmp-vertex",
    creator: "you",
    mine: true,
    platform: "youtube",
    link: "https://youtube.com/shorts/dQw8-cLp2Ks",
    views: 2_140_900,
    status: "paid",
    submittedAt: Date.now() - 19 * DAY,
  },
  {
    id: "sub-3",
    campaignId: "cmp-monolith",
    creator: "you",
    mine: true,
    platform: "instagram",
    link: "https://instagram.com/reel/C8mTzqLp2A/",
    views: 486_200,
    status: "active",
    submittedAt: Date.now() - 6 * DAY,
  },
  {
    id: "sub-4",
    campaignId: "cmp-pulse",
    creator: "you",
    mine: true,
    platform: "youtube",
    link: "https://youtube.com/shorts/pX9-aZ7nQ1v",
    views: 92_400,
    status: "pending",
    submittedAt: Date.now() - 4_000,
  },
  /* Other clippers — visible in the admin moderation queue. */
  {
    id: "sub-5",
    campaignId: "cmp-monolith",
    creator: "@scrollking",
    mine: false,
    platform: "tiktok",
    link: "https://tiktok.com/@scrollking/video/7402119823",
    views: 3_910_400,
    status: "active",
    submittedAt: Date.now() - 11 * DAY,
  },
  {
    id: "sub-6",
    campaignId: "cmp-ripple",
    creator: "@virality.vee",
    mine: false,
    platform: "instagram",
    link: "https://instagram.com/reel/C8xKq2Vv9L/",
    views: 812_600,
    status: "active",
    submittedAt: Date.now() - 8 * DAY,
  },
  {
    id: "sub-7",
    campaignId: "cmp-vertex",
    creator: "@maxxedits",
    mine: false,
    platform: "youtube",
    link: "https://youtube.com/shorts/kLm2-Nb4vR8",
    views: 5_402_700,
    status: "pending",
    submittedAt: Date.now() - 3 * DAY,
  },
  {
    id: "sub-8",
    campaignId: "cmp-pulse",
    creator: "@clipfiend",
    mine: false,
    platform: "tiktok",
    link: "https://tiktok.com/@clipfiend/video/7403772110",
    views: 264_800,
    status: "pending",
    submittedAt: Date.now() - 1 * DAY,
  },
  {
    id: "sub-9",
    campaignId: "cmp-northwind",
    creator: "@outdooroona",
    mine: false,
    platform: "instagram",
    link: "https://instagram.com/reel/C8hRm3Tt1Q/",
    views: 148_300,
    status: "rejected",
    submittedAt: Date.now() - 14 * DAY,
  },
  {
    id: "sub-10",
    campaignId: "cmp-ripple",
    creator: "@loop.luca",
    mine: false,
    platform: "youtube",
    link: "https://youtube.com/shorts/wQ4-zT8yM3d",
    views: 1_052_100,
    status: "paid",
    submittedAt: Date.now() - 21 * DAY,
  },
];

/** 7-day payout history for the admin analytics chart. */
export const seedPayoutSeries = () => [
  { day: "Mon", value: 4_120 },
  { day: "Tue", value: 5_380 },
  { day: "Wed", value: 3_960 },
  { day: "Thu", value: 6_240 },
  { day: "Fri", value: 7_810 },
  { day: "Sat", value: 9_140 },
  { day: "Sun", value: 6_450 },
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
