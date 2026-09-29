import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { readYoutubeMetrics } from "./social";
import { NotAllowedError, requireAdmin, requireUser } from "./access";
import { MIN_WITHDRAWAL_USD } from "./schema";

/**
 * What a clip is worth to its creator, in whole cents.
 *
 * A clip only earns once it has cleared its campaign's minimum view threshold —
 * that rule is the same one the dashboard uses, and it is applied here so the
 * balance can never disagree with what the creator was shown.
 */
function earnedCents(views: number, ratePer1k: number, minViews: number) {
  if (views < minViews) return 0;
  return Math.round((views / 1000) * ratePer1k * 100);
}

/**
 * The views that count.
 *
 * A view count straight off a creator's link is a claim, not a measurement:
 * anyone can paste a number. Views only become real once an operator has
 * confirmed the count, so an unconfirmed clip contributes nothing here — not to
 * a payout, not to a total, not to a leaderboard. Confirming the count is what
 * releases the money.
 */
function countedViews(submission: {
  views: number;
  viewsConfirmed?: boolean;
}): number {
  return submission.viewsConfirmed ? submission.views : 0;
}

/**
 * Clips creators submit to campaigns.
 *
 * The client runs a scan to give fast feedback, but every rule is re-checked
 * here before anything is written. A client that skips these checks gains
 * nothing: the mutation is the source of truth.
 */

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

    /* A campaign whose budget is gone has stopped: approving this clip would
       commit money the brand is no longer offering. The gate lives here, not
       only on the button, so no path can slip a clip in after the money ran
       out — and an operator who raises the budget reopens it. */
    if (campaign.spent >= campaign.budget) {
      throw new NotAllowedError(
        "This campaign's budget has been fully spent, so it is no longer accepting clips.",
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

    /* Tell the people who have to act on it.
     *
     * A submitted clip is a review queue entry with a deadline attached, and a
     * queue nobody is watching is a queue that goes stale. Every operator is
     * told directly, so the clip does not sit unseen until a creator chases
     * it. The message says what to open, not just that something happened. */
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
    for (const admin of admins) {
      if (admin._id === user._id) continue;
      await ctx.runMutation(internal.messages.notify, {
        userId: admin._id,
        title: "New clip submitted",
        body: `${match.handle} submitted a ${platform} clip to ${campaign.title}. It's waiting on review.`,
        link: "/dashboard/moderation",
      });
    }

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
      /* A decline without a reason is a dead end for the creator: they cannot
         fix a clip nobody told them about. So the reason is required here, not
         merely suggested in the UI. */
      const reason = args.note?.trim();
      if (!reason) {
        throw new Error(
          "Give the creator a reason for declining — they see it in their messages.",
        );
      }
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
        link: "/dashboard/clips",
      });
      return;
    }

    await ctx.db.patch(args.submissionId, {
      status: "active",
      reviewNote: args.note?.trim() || undefined,
    });

    /* Approval is what turns a clip into money: the balance is credited here,
       in the same transaction as the review, so a creator can never have an
       approved clip that was not paid for.

       Only a *verified* count pays. Approving a clip whose number nobody has
       checked would pay out against a claim, so an operator sets the count
       first (or does it straight after) and the difference is released then. */
    const creditedCents = campaign
      ? earnedCents(
          countedViews(submission),
          campaign.ratePer1k,
          campaign.minViews,
        )
      : 0;
    /* What the creator's balance is told about is the credit that actually
       landed — the amount after the platform's transaction fee. The brand's
       budget below is charged the full amount, so the fee is never a line
       item for the creator, just a smaller number in their balance. */
    let paidToCreatorCents = 0;
    if (creditedCents > 0) {
      const credit = await ctx.runMutation(internal.payouts.creditEarnings, {
        userId: submission.userId,
        submissionId: submission._id,
        campaignId: submission.campaignId,
        amountCents: creditedCents,
        reason: `Clip approved for ${campaign!.title}`,
      });
      paidToCreatorCents = credit.creditedCents;
      /* What the campaign has committed goes up by the same amount, so the
         brand's budget meter reflects the clips actually approved against it. */
      await ctx.db.patch(campaign!._id, {
        spent: Math.round((campaign!.spent + creditedCents / 100) * 100) / 100,
      });
    }

    await ctx.runMutation(internal.messages.notify, {
      userId: submission.userId,
      title: `Clip approved for ${campaignName}`,
      body: paidToCreatorCents > 0
        ? [
            args.note?.trim() || null,
            `$${(paidToCreatorCents / 100).toFixed(2)} has been added to your balance. You can request a payout once you're over $${MIN_WITHDRAWAL_USD}.`,
          ]
            .filter(Boolean)
            .join(" ")
        : args.note?.trim() ||
          (submission.viewsConfirmed
            ? "Your clip is approved. It starts earning once it passes the campaign's view threshold."
            : "Your clip is approved. An operator still has to confirm the real view count — the money follows the verified number, not the one from the link."),
      link: "/dashboard/clips",
    });

    if (campaign) {
      await ctx.db.patch(campaign._id, {
        clippers: campaign.clippers + 1,
      });
    }
  },
});

/**
 * Whether the caller may refresh this clip's views.
 *
 * An action has no `ctx.db`, so the check is made from stored rows in an
 * internal query: the submission's own `userId`, compared against the caller's
 * session, plus the admin escape hatch operators need to re-read a clip while
 * moderating it.
 */
export const viewCaller = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<{ allowed: boolean }> => {
    const user = await requireUser(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return { allowed: false };
    return {
      allowed: user.role === "admin" || submission.userId === user._id,
    };
  },
});

/** The fields a view refresh needs, read in one place. */
export const forViewRefresh = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;
    return {
      platform: submission.platform,
      link: submission.link,
      views: submission.views,
    };
  },
});

/** Writes a freshly read count, without ever marking it confirmed. */
export const setRefreshedViews = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    views: v.number(),
    metrics: v.object({
      views: v.number(),
      likes: v.number(),
      comments: v.number(),
      shares: v.number(),
      fetchedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return;
    await ctx.db.patch(args.submissionId, {
      views: args.views,
      metrics: args.metrics,
    });
  },
});

/**
 * Re-reads a clip's live view count from the platform.
 *
 * A creator pastes a link the moment they publish, when the number is
 * essentially zero — so the figure on a fresh submission is the least useful
 * one it will ever have. This asks the platform again later and stores what it
 * says.
 *
 * The result is a *claim*, not a confirmation: it is stored without
 * `viewsConfirmed`, so it improves what the operator sees and what the creator
 * sees, but money still only ever moves on a count a human confirmed. An
 * automated number must not be able to pay anybody on its own.
 *
 * Owner-or-operator only. A clip belongs to the creator who submitted it, and
 * reading someone's clip is not open to the public.
 */
export const refreshViews = action({
  args: { submissionId: v.id("submissions") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    views?: number;
    message: string;
  }> => {
    const caller = await ctx.runQuery(internal.submissions.viewCaller, {
      submissionId: args.submissionId,
    });
    if (!caller.allowed) {
      throw new Error("That clip isn't yours to refresh.");
    }

    const read = await ctx.runQuery(internal.submissions.forViewRefresh, {
      submissionId: args.submissionId,
    });
    if (!read) {
      return { ok: false, message: "That clip no longer exists." };
    }

    /* Only YouTube publishes a view count through the routes we can reach
       without an API. The others are reported honestly rather than guessed. */
    if (read.platform !== "youtube") {
      return {
        ok: false,
        message:
          read.platform === "instagram"
            ? "Instagram doesn't publish a view count we can read for a single post. An operator records the real number at review time."
            : "We can only read a live view count for YouTube right now. An operator records the number for other platforms.",
      };
    }

    const metrics = await readYoutubeMetrics(new URL(read.link));
    if (!metrics) {
      return {
        ok: false,
        message:
          "YouTube didn't answer that link. Check it is public and try again.",
      };
    }

    /* Only ever moves the stored number forward. A platform that reports less
       on a later read is a glitch, not a lost view, and a payout must not
       shrink because one read disagreed with another. */
    const next = Math.max(read.views, metrics.views);
    await ctx.runMutation(internal.submissions.setRefreshedViews, {
      submissionId: args.submissionId,
      views: next,
      metrics,
    });

    return {
      ok: true,
      views: next,
      message: `YouTube now reports ${metrics.views.toLocaleString()} views.`,
    };
  },
});

/**
 * Fixes the view count on a clip.
 *
 * The number a creator's platform reports is their claim, and it drifts. A
 * Clip Vault operator records the count they actually measured at review time and
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
    let releasedCents = 0;

    /* A clip that was already approved, and that now measures higher than it
       did at review, earns the difference. Money only ever moves upwards here. */
    if (campaign && submission.status === "active") {
      const alreadyPaid = await ctx.db
        .query("earnings")
        .withIndex("by_user", (q) => q.eq("userId", submission.userId))
        .filter((q) => q.eq(q.field("submissionId"), submission._id))
        .first();
      const nowWorth = earnedCents(
        Math.round(args.views),
        campaign.ratePer1k,
        campaign.minViews,
      );
      const wasWorth = earnedCents(
        /* Before this confirmation the clip was worth nothing, because an
           unverified number is not a measurement. */
        countedViews(submission),
        campaign.ratePer1k,
        campaign.minViews,
      );
      /* Measured against what the clip was credited *before* the fee, so the
         difference is a gross figure and the fee is taken from it in the
         credit itself — otherwise the top-up would be computed against the
         smaller, after-fee number and over-credit. */
      const delta = nowWorth - (alreadyPaid
        ? (alreadyPaid.grossCents ?? alreadyPaid.amountCents)
        : wasWorth);
      if (delta > 0) {
        await ctx.db.patch(campaign._id, {
          spent: Math.round((campaign.spent + delta / 100) * 100) / 100,
        });
        const credit = await ctx.runMutation(internal.payouts.creditTopUp, {
          userId: submission.userId,
          campaignId: submission.campaignId,
          amountCents: delta,
          reason: `View count verified for ${campaign.title}`,
        });
        /* The creator is told what reached their balance, after the fee. */
        releasedCents = credit.creditedCents;
      }
    }

    await ctx.runMutation(internal.messages.notify, {
      userId: submission.userId,
      title: `Views verified for ${campaign?.title ?? "your clip"}`,
      body: `Your clip is now recorded at ${Math.round(args.views).toLocaleString(
        "en-US",
      )} verified views.${
        releasedCents > 0
          ? ` $${(releasedCents / 100).toFixed(2)} has been added to your balance.`
          : ""
      }`,
      link: "/dashboard/clips",
    });
    return true;
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
