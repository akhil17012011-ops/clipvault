/**
 * Shared types and pure helpers for Clip Vault.
 *
 * There is no catalog data and no simulated telemetry in this file any more.
 * Campaigns, connected accounts and submissions all come from the database;
 * the helpers here only describe the rules those records have to satisfy.
 */

export type Platform = "tiktok" | "instagram" | "youtube" | "x";

/**
 * The community. Every "come talk to us" link in the product points here, so
 * the invite lives in one place instead of being pasted into each surface.
 */
export const DISCORD_INVITE = "https://discord.gg/6cj5kYujD4";

/**
 * Every email Clip Vault sends goes here: support, suggestions, bug reports,
 * password resets and verification codes. One inbox, one constant, so there is
 * never a question about which address a person should use.
 */
export const SUPPORT_EMAIL = "Support.clipvault.ae@gmail.com";

export const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube", "x"];

/**
 * Platform chips stay neutral (zinc) on purpose — the palette is reserved for
 * black + purple, with green/red used only for success/failure states.
 */
export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; color: string; domain: string }
> = {
  tiktok: {
    label: "TikTok",
    short: "TT",
    color: "#52525B",
    domain: "tiktok.com/@",
  },
  instagram: {
    label: "Instagram Reels",
    short: "IG",
    color: "#52525B",
    domain: "instagram.com/",
  },
  youtube: {
    label: "YouTube Shorts",
    short: "YT",
    color: "#52525B",
    domain: "youtube.com/@",
  },
  x: { label: "X", short: "X", color: "#52525B", domain: "x.com/" },
};

/**
 * Whether the creator is pasting a profile link rather than typing a bare
 * handle. Only used for presentation — the authoritative parsing happens on the
 * server, which normalises a pasted link down to the username.
 */
export function looksLikeProfileLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(trimmed)
  );
}

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
  /** Real counts read from the platform. Null when it does not publish them. */
  followers?: number | null;
  posts?: number | null;
}

/** A message in a creator's inbox. */
export type MessageKind = "notice" | "admin";

export interface CreatorMessage {
  id: string;
  kind: MessageKind;
  title: string | null;
  body: string;
  link: string | null;
  createdAt: number;
  read: boolean;
}

/** A message row as the admin console sees it. */
export interface AdminMessage {
  id: string;
  userId: string;
  userName: string;
  kind: MessageKind;
  title: string | null;
  body: string;
  createdAt: number;
  read: boolean;
}

/**
 * How a creator gets paid.
 *
 * There is no saved wallet: the method and the address are chosen at the moment
 * the payout is requested, and they belong to that one request. That is what
 * lets someone switch networks between payouts without losing anything, and it
 * means a stale address saved months ago can never be paid by accident.
 */
export type PayoutMethod = "sol" | "ltc" | "btc" | "usdt";

/** Networks USDT can be sent on. The address shape depends on the network. */
export type UsdtNetwork = "trc20" | "erc20" | "bep20";

/** Smallest withdrawal a creator can request, in whole dollars. */
export const MIN_WITHDRAWAL_USD = 5;

export const PAYOUT_METHODS: {
  id: PayoutMethod;
  label: string;
  /** What a valid address for this method starts with. */
  hint: string;
  networks?: { id: UsdtNetwork; label: string; hint: string }[];
  arrival: string;
}[] = [
  {
    id: "sol",
    label: "Solana",
    hint: "Starts with 1, 3 or 4",
    arrival: "Seconds",
  },
  {
    id: "ltc",
    label: "Litecoin",
    hint: "Starts with ltc1, L or M",
    arrival: "A few minutes",
  },
  {
    id: "btc",
    label: "Bitcoin",
    hint: "Starts with bc1, 1 or 3",
    arrival: "A few blocks",
  },
  {
    id: "usdt",
    label: "USDT",
    hint: "Tron or Ethereum address",
    arrival: "Minutes to hours",
    networks: [
      { id: "trc20", label: "TRC20 (Tron)", hint: "Starts with T" },
      { id: "erc20", label: "ERC20 (Ethereum)", hint: "Starts with 0x" },
      { id: "bep20", label: "BEP20 (BNB)", hint: "Starts with 0x" },
    ],
  },
];

export function payoutMethodLabel(
  method: PayoutMethod,
  network?: UsdtNetwork | null,
): string {
  if (method !== "usdt") {
    return PAYOUT_METHODS.find((m) => m.id === method)?.label ?? method.toUpperCase();
  }
  const suffix = network ? ` (${network.toUpperCase()})` : "";
  return `USDT${suffix}`;
}

/** Shortens an address for display without pretending to be the whole thing. */
export function shortAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export type PayoutRequestStatus = "pending" | "paid" | "rejected";

/** One line of a creator's money history. */
export interface PayoutRequest {
  id: string;
  amountCents: number;
  method: PayoutMethod;
  network: UsdtNetwork | null;
  address: string;
  status: PayoutRequestStatus;
  requestedAt: number;
  decidedAt: number | null;
  reference: string | null;
  reason: string | null;
}

/** The same request as the brand console sees it, with the creator attached. */
export interface AdminPayoutRequest extends PayoutRequest {
  userId: string;
  creatorName: string;
  creatorEmail: string | null;
}

/** A single movement of money, positive or negative. */
export interface EarningEntry {
  id: string;
  amountCents: number;
  reason: string;
  campaignId: string | null;
  createdAt: number;
}

/** A creator's money, in whole cents. */
export interface Wallet {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  minWithdrawalCents: number;
}

/** Formats cents as dollars, without floating point drift. */
export function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** How much a single connected account has actually produced. */
export interface AccountStats {
  accountId: string;
  clips: number;
  views: number;
  /** Dollars earned by this account's clips, using the payout rule. */
  earned: number;
  followers: number | null;
  posts: number | null;
}

/** One row of the admin users table. */
export interface AdminUser {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  joined: number;
  accounts: Array<{
    id: string;
    platform: Platform;
    handle: string;
    status: AccountStatus;
    followers: number | null;
    posts: number | null;
    connectedAt: number | null;
  }>;
  clips: number;
  views: number;
  earned: number;
  /** What is actually withdrawable right now, in cents. */
  availableCents: number;
  /** Locked in a payout request waiting on Clip Vault. */
  pendingCents: number;
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
 * real platform response — Clip Vault does not invent them.
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

/**
 * The first-run tour, in the order the work actually happens.
 *
 * Each step carries the page it is about, a concrete checklist and the specific
 * outcome, so "Next" both moves the user to the place being described and tells
 * them what to actually do there. The order is the order of the job: connect a
 * handle, join something, submit, get paid — with the brand step kept in the
 * middle, because a user can be either.
 */
export const TOUR_STEPS = [
  {
    to: "/dashboard",
    icon: "sparkles",
    kicker: "Step 1 · Welcome",
    title: "This is your Clip Vault console",
    body: "Everything here is read live from your account — nothing is a demo. Six short steps and you are set up: a verified account, a campaign to clip, a clip submitted, and money on the way.",
    points: [
      "The sidebar is your whole product: every page lives there",
      "The bell at the top is how the site talks to you",
      "Nothing here needs a follow-up email or a form",
    ],
  },
  {
    to: "/dashboard/accounts",
    icon: "shield",
    kicker: "Step 2 · Accounts",
    title: "Connect the handle you post from",
    body: "Views are only counted from an account we can prove is yours, so this is the one step that unlocks everything else. It takes about a minute per account.",
    points: [
      "Press Connect account, pick your platform, type your @handle",
      "Copy the code Clip Vault generates into that account's bio",
      "Press Verify — we read your public profile and confirm the code",
      "Add a second account any time: one per platform or several",
    ],
  },
  {
    to: "/dashboard/campaigns",
    icon: "megaphone",
    kicker: "Step 3 · Campaigns",
    title: "Join a campaign and see what it pays",
    body: "Every campaign publishes its rate before you join. There is no application, no follower minimum and no audition — you see the number, you decide.",
    points: [
      "Join in one tap from the card",
      "Open a joined campaign to read the brief and the creative rules",
      "The rate is dollars per 1,000 verified views — it cannot change later",
    ],
  },
  {
    to: "/dashboard/clips",
    icon: "clapperboard",
    kicker: "Step 4 · Clips",
    title: "Post the clip, submit the link, get paid for views",
    body: "Post your clip on the platform the campaign accepts, then submit the link. An operator checks the clip and confirms the real view count — a number that has been measured, not one a link claimed.",
    points: [
      "Submit a clip from here or from the campaign page",
      "A clip only earns once it clears the campaign's view threshold",
      "On approval the money is added to your balance automatically",
      "2,000 views at $1 per 1,000 means $2.00 in your balance",
    ],
  },
  {
    to: "/dashboard/request",
    icon: "send",
    kicker: "Step 5 · Brands",
    title: "Running a brand? Request a campaign",
    body: "You do not need an admin panel to run a campaign here. Send what you want to run, and an operator sets up the rate, rules and budget — then publishes it or tells you why not.",
    points: [
      "Name, description, budget, platforms",
      "Add the photos, videos or links clippers should work from",
      "Edit or delete it while it is still waiting on a decision",
      "Approved means live: creators can join the same day",
    ],
  },
  {
    to: "/dashboard/payments",
    icon: "wallet",
    kicker: "Step 6 · Payments",
    title: "Get paid when you clear the minimum",
    body: "Your balance holds everything your approved clips have earned. Request a payout once you are over the minimum, and follow it all the way to paid from this same page.",
    points: [
      "Available is what you can withdraw right now",
      "Pending is money locked in a request you have made",
      "You pick the network and address on the request itself",
      "The bell tells you when something needs a decision",
    ],
  },
] as const;

/**
 * What a view count is worth on a campaign, before it has been paid.
 *
 * The same rule the server pays by, shown on screen so the number an operator
 * types and the money that lands in a creator's balance are visibly the same
 * calculation: $1 per 1,000 views at 2,000 views is $2.
 */
export function payoutPreview(
  views: number,
  ratePer1k: number,
  minViews: number,
): { qualifies: boolean; dollars: number; viewsNeeded: number } {
  const qualifies = views >= minViews;
  return {
    qualifies,
    dollars: qualifies ? (views / 1000) * ratePer1k : 0,
    viewsNeeded: Math.max(0, minViews - views),
  };
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
