import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin, requireUser } from "./access";

/**
 * Who is doing what on Clip Vault.
 *
 * A leaderboard is only worth having if every number on it can be explained, so
 * each row is assembled from the same records the payouts are made from — the
 * `earnings` ledger for money, `submissions` for views and clips, and the
 * bio-verified `connectedAccounts` for reach. Nothing here is a number someone
 * typed in.
 *
 * It is readable by any signed-in user, which is the point: creators should be
 * able to see where they sit without asking.
 */
export const board = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);

    const users = await ctx.db.query("users").collect();
    const [earnings, submissions, accounts, campaigns] = await Promise.all([
      ctx.db.query("earnings").collect(),
      ctx.db.query("submissions").collect(),
      ctx.db.query("connectedAccounts").collect(),
      ctx.db.query("campaigns").collect(),
    ]);
    const rateById = new Map(campaigns.map((c) => [c._id, c]));

    const rows = users.map((user) => {
      const mine = earnings.filter((e) => e.userId === user._id);
      const clips = submissions.filter((s) => s.userId === user._id);
      const handles = accounts.filter((a) => a.userId === user._id);

      /* Only approved, *verified* clips count, exactly as they do for a payout.
         A view count nobody has confirmed is a claim, so it is worth nothing
         here either — otherwise the board would rank people on numbers they
         typed in. */
      let views = 0;
      let earningCents = 0;
      let bestViews = 0;
      for (const clip of clips) {
        if (clip.status === "rejected") continue;
        if (!clip.viewsConfirmed) continue;
        const campaign = rateById.get(clip.campaignId);
        if (!campaign) continue;
        views += clip.views;
        if (clip.views > bestViews) bestViews = clip.views;
        if (clip.views < campaign.minViews) continue;
        earningCents += Math.round((clip.views / 1000) * campaign.ratePer1k * 100);
      }

      const verified = handles.filter((h) => h.status === "connected");
      const followers = verified.reduce(
        (sum, h) => sum + (h.followers ?? 0),
        0,
      );

      return {
        userId: user._id,
        name: user.name ?? user.email?.split("@")[0] ?? "Creator",
        image: user.image ?? null,
        handle: verified[0]?.handle ?? handles[0]?.handle ?? null,
        isViewer: user._id === viewer._id,
        /* Money comes from the ledger when there is one, because that is what
           was actually paid; before a creator has been paid, the same rule the
           payout uses is applied to their clips. */
        earningsCents:
          mine.length > 0
            ? mine.reduce((sum, e) => sum + e.amountCents, 0)
            : earningCents,
        views,
        clips: clips.filter((c) => c.status !== "rejected").length,
        accounts: verified.length,
        followers,
        bestViews,
      };
    });

    /* Anyone who has actually done something is on it; a board of zeroes is
       noise, and a new account should not be told it is last. */
    return rows
      .filter((r) => r.clips > 0 || r.earningsCents > 0 || r.views > 0)
      .sort((a, b) => b.earningsCents - a.earningsCents)
      .slice(0, args.limit ?? 50);
  },
});

/**
 * Everything about one creator, for the operator's user page.
 *
 * The Users list shows a row; this is what is behind it — the handles they have
 * verified and what each one produced, their latest uploads, and the averages an
 * operator would otherwise have to compute by hand before deciding whether a
 * campaign should go to them.
 */
export const userDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const [accounts, submissions, earnings] = await Promise.all([
      ctx.db
        .query("connectedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("earnings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);
    const campaigns = await ctx.db.query("campaigns").collect();
    const byId = new Map(campaigns.map((c) => [c._id, c]));

    /* Per-account performance, matched on the handle the clip was published
       from — the same match the payout uses, so this cannot disagree with it. */
    const accountRows = accounts
      .map((account) => {
        const clips = submissions.filter(
          (s) => s.author.toLowerCase() === account.handle.toLowerCase(),
        );
        let views = 0;
        let earnedCents = 0;
        for (const clip of clips) {
          if (clip.status === "rejected") continue;
          /* Unverified counts are a claim; they do not count here either. */
          if (!clip.viewsConfirmed) continue;
          views += clip.views;
          const campaign = byId.get(clip.campaignId);
          if (!campaign || clip.views < campaign.minViews) continue;
          earnedCents += Math.round(
            (clip.views / 1000) * campaign.ratePer1k * 100,
          );
        }
        return {
          id: account._id,
          platform: account.platform,
          handle: account.handle,
          status: account.status,
          followers: account.followers ?? null,
          posts: account.posts ?? null,
          connectedAt: account.connectedAt ?? null,
          createdAt: account.createdAt,
          clips: clips.length,
          views,
          earnedCents,
        };
      })
      .sort((a, b) => b.views - a.views);

    const live = submissions.filter(
      (s) => s.status !== "rejected" && s.viewsConfirmed,
    );
    const totalViews = live.reduce((sum, s) => sum + s.views, 0);
    const best = live.reduce(
      (acc, s) => (s.views > (acc?.views ?? 0) ? s : acc),
      live[0] as (typeof live)[number] | undefined,
    );

    return {
      userId: user._id,
      name: user.name ?? user.email?.split("@")[0] ?? "Creator",
      email: user.email ?? "",
      image: user.image ?? null,
      role: user.role ?? "user",
      joined: user._creationTime,
      verified: user.emailVerificationTime ?? null,
      accounts: accountRows,
      totals: {
        accounts: accountRows.filter((a) => a.status === "connected").length,
        clips: submissions.filter((s) => s.status !== "rejected").length,
        verifiedClips: live.length,
        views: totalViews,
        avgViews: live.length > 0 ? Math.round(totalViews / live.length) : 0,
        bestViews: best?.views ?? 0,
        followers: accountRows.reduce((sum, a) => sum + (a.followers ?? 0), 0),
        earnedCents: earnings.reduce((sum, e) => sum + e.amountCents, 0),
        campaigns: [
          ...new Set(
            submissions.map((s) => byId.get(s.campaignId)?.title).filter(Boolean),
          ),
        ].length,
      },
      /* Newest first: what a creator is posting *now* is the useful question,
         not everything they have ever posted. */
      uploads: live
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .slice(0, 12)
        .map((s) => {
          const campaign = byId.get(s.campaignId);
          const qualifies = campaign ? s.views >= campaign.minViews : false;
          return {
            id: s._id,
            link: s.link,
            platform: s.platform,
            author: s.author,
            status: s.status,
            views: s.views,
            viewsConfirmed: s.viewsConfirmed ?? false,
            likes: s.metrics?.likes ?? null,
            comments: s.metrics?.comments ?? null,
            shares: s.metrics?.shares ?? null,
            fetchedAt: s.metrics?.fetchedAt ?? null,
            submittedAt: s.submittedAt,
            campaign: campaign?.title ?? "Campaign",
            brand: campaign?.brand ?? "",
            qualifies,
            earnedCents: qualifies && campaign
              ? Math.round((s.views / 1000) * campaign.ratePer1k * 100)
              : 0,
          };
        }),
    };
  },
});
