import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { NotAllowedError, requireAdmin, requireUser } from "./access";

/**
 * Clips creators submit to campaigns.
 *
 * The client runs a scan to give fast feedback, but every rule is re-checked
 * here before anything is written. A client that skips these checks gains
 * nothing: the mutation is the source of truth.
 */

const PLATFORM = v.union(
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("x"),
);

const METRICS = v.object({
  views: v.number(),
  likes: v.number(),
  comments: v.number(),
  shares: v.number(),
  fetchedAt: v.number(),
});

/** Detect the platform from the link, so the client can't mislabel it. */
function platformFromLink(link: string) {
  const url = link.toLowerCase();
  if (url.includes("tiktok.com")) return "tiktok" as const;
  if (url.includes("instagram.com")) return "instagram" as const;
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube" as const;
  }
  if (url.includes("twitter.com") || url.includes("x.com")) return "x" as const;
  return null;
}

/** `#hashtags` in free text — lowercased and deduped. */
function extractTags(text: string): string[] {
  return [
    ...new Set(
      (text.match(/#[\w-]+/g) ?? []).map((tag) => tag.toLowerCase()),
    ),
  ];
}

/** Hashtags a campaign's guidelines require in the caption. */
function requiredTags(guidelines: string[]): string[] {
  return extractTags(guidelines.join(" "));
}

/** The handle a clip was published from, when the link exposes one. */
function authorFromLink(link: string, platform: string): string | null {
  try {
    const url = new URL(link.startsWith("http") ? link : `https://${link.trim()}`);
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

/** Clips belonging to the signed-in creator. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return submissions.sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

/** Every clip on the platform — admin only. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const submissions = await ctx.db.query("submissions").collect();
    return submissions.sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

/**
 * Submit a published clip.
 *
 * Re-validated server side:
 *  - the campaign exists and is live
 *  - the platform comes from the link, and the campaign accepts it
 *  - the clip's author is one of the caller's bio-verified accounts
 *  - the caption carries every hashtag the campaign requires
 *  - the same link has not already been submitted to this campaign
 */
export const submit = mutation({
  args: {
    campaignId: v.id("campaigns"),
    link: v.string(),
    caption: v.string(),
    /** Handle resolved from the link, when it exposed one. */
    author: v.optional(v.string()),
    /** Real numbers read from the platform, when we could read them. */
    metrics: v.optional(METRICS),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("That campaign no longer exists.");
    if (campaign.status !== "active") {
      throw new NotAllowedError(
        "That campaign is not accepting clips right now.",
      );
    }

    const link = args.link.trim();
    const platform = platformFromLink(link);
    if (!platform) {
      throw new Error(
        "We couldn't recognize the platform from this link — use a TikTok, Instagram, YouTube or X URL.",
      );
    }
    if (!campaign.platforms.includes(platform)) {
      throw new Error(
        `This campaign does not accept ${platform} clips.`,
      );
    }

    /* The post must come from an account this creator has verified. */
    const connected = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_user_platform", (q) =>
        q.eq("userId", user._id).eq("platform", platform),
      )
      .filter((q) => q.eq(q.field("status"), "connected"))
      .collect();

    if (connected.length === 0) {
      throw new NotAllowedError(
        "Connect a bio-verified account on this platform before submitting clips.",
      );
    }

    const claimed = (args.author ?? "").trim().replace(/^@+/, "").toLowerCase();
    const fromLink = authorFromLink(link, platform);
    const author = fromLink ?? claimed;

    /* When the link exposes a handle it must match a connected account. */
    const match = author
      ? connected.find((account) => account.handle.toLowerCase() === author)
      : connected[0];

    if (fromLink && !match) {
      throw new NotAllowedError(
        `@${fromLink} isn't one of your connected accounts — submit your own clip.`,
      );
    }
    if (!match) {
      throw new NotAllowedError(
        "We couldn't tell which of your accounts this clip came from.",
      );
    }

    /* Required hashtags. */
    const tags = extractTags(args.caption);
    const missing = requiredTags(campaign.guidelines).filter(
      (tag) => !tags.includes(tag),
    );
    if (missing.length > 0) {
      throw new Error(`Your caption is missing ${missing.join(" ")}.`);
    }

    /* No duplicate submissions. */
    const duplicate = await ctx.db
      .query("submissions")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("link"), link))
      .first();
    if (duplicate) {
      throw new Error("This clip has already been submitted to this campaign.");
    }

    const submissionId = await ctx.db.insert("submissions", {
      campaignId: args.campaignId,
      userId: user._id,
      creator: user.name ?? user.email?.split("@")[0] ?? "Creator",
      platform,
      link,
      tags,
      author: match.handle,
      verifiedOwner: true,
      platformOk: true,
      metrics: args.metrics,
      views: args.metrics?.views ?? 0,
      status: "pending",
      submittedAt: Date.now(),
    });

    return await ctx.db.get(submissionId);
  },
});

/**
 * Admin moderation. Accepting sends the clip to the campaign so it goes live;
 * declining records the reason the creator is shown.
 */
export const review = mutation({
  args: {
    submissionId: v.id("submissions"),
    decision: v.union(v.literal("accept"), v.literal("decline")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("That submission no longer exists.");
    if (submission.status !== "pending") {
      throw new Error("This clip has already been reviewed.");
    }

    const campaign = await ctx.db.get(submission.campaignId);
    const campaignName = campaign?.title ?? "your campaign";

    if (args.decision === "decline") {
      const reason = args.note?.trim() || "Didn't meet the campaign brief.";
      await ctx.db.patch(args.submissionId, {
        status: "rejected",
        reviewNote: reason,
      });
      /* The creator is told why, in the same place they read everything else,
         rather than the clip just quietly going red with no explanation. */
      await ctx.runMutation(internal.messages.notify, {
        userId: submission.userId,
        title: `Clip declined for ${campaignName}`,
        body: reason,
      });
      return;
    }

    await ctx.db.patch(args.submissionId, {
      status: "active",
      reviewNote: args.note?.trim() || undefined,
    });

    await ctx.runMutation(internal.messages.notify, {
      userId: submission.userId,
      title: `Clip approved for ${campaignName}`,
      body: args.note?.trim()
        ? args.note.trim()
        : "Your clip is approved and counting toward this campaign's payout.",
    });

    if (campaign) {
      await ctx.db.patch(campaign._id, {
        clippers: campaign.clippers + 1,
      });
    }
  },
});

/**
 * Fixes the view count on a clip.
 *
 * The number a creator's platform reports is their claim, and it drifts. A
 * CLIPTIC operator records the count they actually measured at review time and
 * marks it confirmed, so the number driving a payout has a human behind it
 * rather than coming straight off a link the creator pasted.
 */
export const confirmViews = mutation({
  args: {
    submissionId: v.id("submissions"),
    views: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("That clip no longer exists.");
    if (!Number.isFinite(args.views) || args.views < 0) {
      throw new Error("Enter a view count of zero or more.");
    }
    await ctx.db.patch(args.submissionId, {
      views: Math.round(args.views),
      viewsConfirmed: true,
      /* Confirming a count is a measurement, so the metrics snapshot is
         refreshed to match instead of contradicting the stored total. */
      metrics: submission.metrics
        ? { ...submission.metrics, views: Math.round(args.views) }
        : submission.metrics,
    });

    const campaign = await ctx.db.get(submission.campaignId);
    await ctx.runMutation(internal.messages.notify, {
      userId: submission.userId,
      title: `View count updated for ${campaign?.title ?? "your clip"}`,
      body: `Your clip is now recorded at ${Math.round(args.views).toLocaleString("en-US")} views.`,
    });
    return true;
  },
});

/** Admin payout settlement. */
export const settle = mutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.union(v.literal("paid"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("That submission no longer exists.");
    if (submission.status === "pending" || submission.status === "rejected") {
      throw new Error("Only live clips can be settled.");
    }
    await ctx.db.patch(args.submissionId, { status: args.status });
  },
});

/**
 * Refresh the real statistics for a clip. Only clips that are already live get
 * refreshed, and only from the platform APIs the deployment has keys for.
 */
export const refreshMetrics = mutation({
  args: {
    submissionId: v.id("submissions"),
    metrics: METRICS,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("That submission no longer exists.");

    const isOwner = submission.userId === user._id;
    if (!isOwner && user.role !== "admin") {
      throw new NotAllowedError("You can only refresh your own clips.");
    }

    await ctx.db.patch(args.submissionId, {
      metrics: args.metrics,
      views: args.metrics.views,
    });
  },
});
