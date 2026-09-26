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
  /** False for accounts belonging to other clippers in the admin console. */
  mine?: boolean;
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

/** Data pulled from the source platform once a clip passes validation. */
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
  /** Snapshot grabbed from the source platform at submission time. */
  metrics?: ClipMetrics;
  views: number;
  status: SubmissionStatus;
  submittedAt: number;
  /** Why the reviewer declined it, shown back to the creator. */
  reviewNote?: string;
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

/**
 * Stand-in for the platform API call that pulls a clip's numbers. The real
 * product hits each platform's public oEmbed/Graph endpoints here; the demo
 * returns a plausible snapshot so the review queue has something to check.
 */
export function fetchClipMetrics(platform: Platform): ClipMetrics {
  const views = Math.floor(Math.random() * 42_000) + 800;
  return {
    views,
    likes: Math.floor(views * (0.02 + Math.random() * 0.07)),
    comments: Math.floor(views * (0.002 + Math.random() * 0.008)),
    shares: Math.floor(views * (0.001 + Math.random() * 0.006)),
    fetchedAt: Date.now(),
  };
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
    logo: "🎧",
    brief:
      "Ripple just launched the Air Pro — the first open-ear headphones with bone-conduction spatial audio. We want creators to show the product in a real moment: commuting, working out, on a call. Cut the footage we share, add your own story, and tag the clip.",
    referenceLinks: [
      {
        label: "Product page",
        url: "https://rippleaudio.com/air-pro",
        kind: "link",
      },
      {
        label: "Brand TikTok",
        url: "https://tiktok.com/@rippleaudio",
        kind: "link",
      },
    ],
    sourceFiles: [
      {
        label: "Air Pro — hero footage (4K)",
        url: "https://drive.google.com/file/d/airpro-hero/view",
        kind: "drive",
      },
      {
        label: "B-roll pack — city & gym",
        url: "https://drive.google.com/drive/folders/airpro-broll",
        kind: "drive",
      },
    ],
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
    logo: "🧥",
    brief:
      "Season 04 is our heaviest drop yet — technical outerwear built for the city. Style it your way: fit checks, street-style transitions, layering in your own wardrobe. Highest rate on CLIPTIC, so bring your best edit.",
    referenceLinks: [
      {
        label: "Drop lookbook",
        url: "https://monolith.co/lookbook/s04",
        kind: "link",
      },
      {
        label: "Monolith on Instagram",
        url: "https://instagram.com/monolith",
        kind: "link",
      },
    ],
    sourceFiles: [
      {
        label: "Season 04 — full campaign cut",
        url: "https://drive.google.com/file/d/monolith-s04/view",
        kind: "video",
      },
    ],
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
    logo: "⚡",
    brief:
      "Zero caffeine, all energy. We want to see the can in motion — training, skating, long drives. Any vertical cut works; the can has to stay visible for at least 3 seconds so viewers can spot it.",
    referenceLinks: [
      {
        label: "Product page",
        url: "https://pulseenergy.com/summer-circuit",
        kind: "link",
      },
    ],
    sourceFiles: [
      {
        label: "Can renders + slow-mo pour",
        url: "https://drive.google.com/drive/folders/pulse-summer",
        kind: "drive",
      },
    ],
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
    logo: "🎮",
    brief:
      "The biggest prize pool of the year, tied to the current competitive season. We want genuine highlights — clutch plays, comebacks, the crowd going wild — with your own commentary on top.",
    referenceLinks: [
      { label: "Season hub", url: "https://vertex.gg/season", kind: "link" },
    ],
    sourceFiles: [
      {
        label: "Match VODs — week 1-4",
        url: "https://drive.google.com/drive/folders/vertex-vods",
        kind: "drive",
      },
    ],
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
    logo: "🎬",
    brief:
      "A fund for studio people: behind-the-scenes, day-in-the-life, setup tours. Show the room, the process, the people. Keep it under 45 seconds and tag us.",
    referenceLinks: [
      {
        label: "Studio journal",
        url: "https://halostudios.tv/journal",
        kind: "link",
      },
    ],
    sourceFiles: [
      {
        label: "Studio tour — raw footage",
        url: "https://drive.google.com/file/d/halo-tour/view",
        kind: "video",
      },
    ],
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
    logo: "🥾",
    brief:
      "Trail-tested gear, filmed where it's used. Paused while the new batch ships — back soon.",
    referenceLinks: [
      { label: "Gear page", url: "https://northwind.gear/trail", kind: "link" },
    ],
    sourceFiles: [],
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
  metrics: ClipMetrics | null;
}

/**
 * Runs the same checks in both submit surfaces: the platform comes from the
 * link, the post must belong to one of the creator's connected accounts, the
 * campaign must accept that platform, and the required hashtags must be in
 * the caption. Metrics are only pulled once everything passes.
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
    metrics: null,
  });

  if (!trimmed || !trimmed.includes(".")) {
    return fail("Paste a valid link to your published clip.");
  }
  const platform = platformFromLink(trimmed);
  if (!platform) {
    return fail(
      "We couldn't recognize the platform from this link — use a TikTok, Instagram or YouTube URL.",
    );
  }

  const linked = authorFromLink(trimmed, platform);
  const author = linked ?? connectedHandles[0] ?? "";
  const verifiedOwner =
    author !== "" &&
    connectedHandles.includes(author.toLowerCase());
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
    metrics: fetchClipMetrics(platform),
  };
}

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

export function fmtViews(n: number): string {  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return `${n}`;
}

export function fmtFull(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Other clippers on the platform (visible in the admin console)       */
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

/**
 * The clippers already working campaigns. These are the records the brand
 * console reviews — they never leak into the signed-in creator's own
 * dashboard, which is scoped to `mine` submissions only.
 */
export const seedCreators = (): CreatorProfile[] => [
  {
    name: "Maya Ortiz",
    handle: "mayamakes",
    platform: "tiktok",
    connectedAt: Date.now() - 19 * DAY,
    clips: [
      { campaignId: "cmp-ripple", platform: "tiktok", views: 412_000, status: "active", daysAgo: 6 },
      { campaignId: "cmp-ripple", platform: "tiktok", views: 268_400, status: "paid", daysAgo: 13 },
      { campaignId: "cmp-pulse", platform: "tiktok", views: 91_200, status: "active", daysAgo: 2 },
    ],
  },
  {
    name: "Devon Park",
    handle: "devoncuts",
    platform: "youtube",
    connectedAt: Date.now() - 27 * DAY,
    clips: [
      { campaignId: "cmp-vertex", platform: "youtube", views: 1_240_000, status: "paid", daysAgo: 9 },
      { campaignId: "cmp-vertex", platform: "youtube", views: 640_500, status: "active", daysAgo: 1 },
    ],
  },
  {
    name: "Ivy Chen",
    handle: "ivyintheloop",
    platform: "instagram",
    connectedAt: Date.now() - 11 * DAY,
    clips: [
      { campaignId: "cmp-monolith", platform: "instagram", views: 156_900, status: "paid", daysAgo: 7 },
      { campaignId: "cmp-halo", platform: "instagram", views: 48_100, status: "pending", daysAgo: 0 },
    ],
  },
  {
    name: "Sam Okafor",
    handle: "samoutside",
    platform: "tiktok",
    connectedAt: Date.now() - 8 * DAY,
    clips: [
      { campaignId: "cmp-pulse", platform: "tiktok", views: 87_600, status: "active", daysAgo: 3 },
      { campaignId: "cmp-ripple", platform: "tiktok", views: 12_400, status: "rejected", daysAgo: 1 },
    ],
  },
];

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
