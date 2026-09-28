import { Infer, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./access";
import { fetchProfile } from "./platforms";

/**
 * Social accounts a creator has bio-verified.
 *
 * Verification is done on the server: the platform's public profile page is
 * fetched and the one-time code has to actually appear in it. The client
 * cannot mark an account connected on its own.
 */

const PLATFORM = v.union(
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("x"),
);

/**
 * Codes look like `VAULT-K7QX`: the brand prefix plus four characters from a
 * 31-symbol alphabet with the look-alikes removed (no I/1, O/0), so a creator
 * reading one off a phone screen cannot mistype it into a dead end.
 *
 * The old `CLIPTIC-`/`CLIPVAULT-` codes are still accepted on read. Those are
 * already sitting in real users' bios, and neither a rebrand nor a format
 * change may silently un-verify an account that verified correctly.
 */
const CODE_PATTERN =
  /^(VAULT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}|CLIPVAULT-[0-9]{6}|CLIPTIC-[0-9]{6})$/;

/** 31 symbols — every letter and digit except I, O, 0 and 1. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Handles are 1-30 chars of letters, digits, dot or underscore. */
const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Minimum time between real platform lookups for one account.
 *
 * The dashboard polls every 2 seconds for a live feel, but each poll is a
 * request from this deployment's shared IP, and the platforms throttle those
 * aggressively — Instagram already answers this deployment with degraded
 * responses. The cooldown is what keeps the poller from burning the very
 * access that bio verification depends on: polls inside the window are
 * answered from the stored row, at full speed.
 */
const STATS_REFRESH_COOLDOWN_MS = 15_000;

type Platform = Infer<typeof PLATFORM>;

/** Domains a profile link for each platform can legitimately come from. */
const PROFILE_DOMAINS: Record<Platform, readonly string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  x: ["x.com", "twitter.com"],
};

/**
 * Turns whatever a creator pasted into a bare handle.
 *
 * Handles get copied out of bios in many shapes — "@nasa",
 * "instagram.com/nasa", "https://www.instagram.com/nasa/?hl=en" — and all of
 * them name the same account, so a connection should not be rejected over a
 * prefix. Returns null when it cannot be reduced to a plain handle, including
 * when a link points at a different site's domain, which would otherwise look
 * like a plausible handle.
 */
function normalizeHandle(raw: string, platform: Platform): string | null {
  // A query string or fragment is never part of a handle.
  let value = raw.trim().split(/[?#]/)[0];

  // Drop the scheme and any leading "www.".
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^www\./i, "");

  if (value.includes("/")) {
    const [host, ...segments] = value.split("/");
    const known = PROFILE_DOMAINS[platform].includes(host.toLowerCase());
    if (!known) return null;
    value = segments[0] ?? "";
  }

  value = value.replace(/^@+/, "").trim();
  return HANDLE_PATTERN.test(value) ? value : null;
}

/**
 * Four random characters from {@link CODE_ALPHABET}, drawn from the platform's
 * CSPRNG rather than `Math.random`, which is neither uniform nor unpredictable
 * enough for something that stands in for proof of account ownership.
 * 31^4 is ~1M combinations, on par with the six-digit format it replaces.
 */
function makeCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    /* The modulo bias here is ~3% against a 256/31 split — irrelevant for a
       code whose real defence is that it must appear in a live bio. */
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `VAULT-${code}`;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const accounts = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return accounts.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/**
 * Clips a creator has published from a given handle, with the money those
 * clips earned under the same rule the payout screen uses: a clip only earns
 * once it is past the campaign's view threshold, and rejected clips never pay.
 */
function totalsFor(
  submissions: Array<{
    views: number;
    status: string;
    campaignId: unknown;
    viewsConfirmed?: boolean;
  }>,
  campaigns: Map<unknown, { minViews: number; ratePer1k: number }>,
): { clips: number; views: number; earned: number } {
  let views = 0;
  let earned = 0;
  for (const submission of submissions) {
    if (submission.status === "rejected") continue;
    /* Only a confirmed count is real. An unverified number is the creator's
       claim, so it counts for nothing — here or in a payout. */
    if (!submission.viewsConfirmed) continue;
    views += submission.views;
    const campaign = campaigns.get(submission.campaignId);
    if (!campaign) continue;
    if (submission.views < campaign.minViews) continue;
    earned += (submission.views / 1000) * campaign.ratePer1k;
  }
  return { clips: submissions.length, views, earned };
}

/**
 * Per connected account: how many clips came from it, how many views they
 * have, and what they have earned. Matched on the handle the platform
 * reported, so only a genuinely connected account can carry views.
 */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const accounts = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const campaignRows = await ctx.db.query("campaigns").collect();
    const campaigns = new Map(
      campaignRows.map((c) => [c._id, { minViews: c.minViews, ratePer1k: c.ratePer1k }]),
    );

    return accounts.map((account) => {
      const mine = submissions.filter(
        (s) => s.author.toLowerCase() === account.handle.toLowerCase(),
      );
      return {
        accountId: account._id,
        ...totalsFor(mine, campaigns),
        followers: account.followers ?? null,
        posts: account.posts ?? null,
      };
    });
  },
});

/** Every connected account on the platform — admin only. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const accounts = await ctx.db.query("connectedAccounts").collect();
    const users = await Promise.all(
      [...new Set(accounts.map((account) => account.userId))].map((userId) =>
        ctx.db.get(userId),
      ),
    );
    const byId = new Map(
      users.filter(Boolean).map((user) => [user!._id, user!]),
    );
    return accounts
      .map((account) => ({
        ...account,
        ownerName:
          byId.get(account.userId)?.name ??
          byId.get(account.userId)?.email?.split("@")[0] ??
          "Creator",
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Start a connection: stores a freshly generated one-time code.
 *
 * A creator can connect as many accounts as they post from, including several
 * on the same platform — the handle is what identifies an account, not the
 * platform. Looking rows up by (user, platform) instead used to hand back the
 * first account every time a second one was added, so the wizard showed the
 * old handle and its code, and the new handle could never be connected at all.
 */
export const request = mutation({
  args: { platform: PLATFORM, handle: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const handle = normalizeHandle(args.handle, args.platform);
    if (!handle) {
      throw new Error(
        "That doesn't look like a valid username — letters, numbers, dots and underscores only.",
      );
    }

    /* One account per (user, platform, handle). The handle is compared in JS
       rather than in an index because platform handles are case-insensitive,
       and a creator has a handful of accounts at most. */
    const mine = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const existing = mine.find(
      (row) =>
        row.platform === args.platform &&
        row.handle.toLowerCase() === handle.toLowerCase(),
    );

    /* Already connected — nothing to do. */
    if (existing && existing.status === "connected") return existing;

    /* Keep the code that is already on the row.

       Rotating it on every visit used to hand out a fresh code each time the
       wizard was opened, which silently invalidated a code the creator had
       already pasted into their bio. That turned a working setup into a
       failure that looked like the platform had changed underneath them. */
    if (existing) return existing;

    const accountId = await ctx.db.insert("connectedAccounts", {
      userId: user._id,
      platform: args.platform,
      handle,
      code: makeCode(),
      status: "pending",
      createdAt: Date.now(),
    });
    return await ctx.db.get(accountId);
  },
});

export const remove = mutation({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    /* Admins can tidy up anyone's connection; creators only their own. */
    if (account.userId !== user._id && user.role !== "admin") {
      throw new Error("You can only disconnect your own accounts.");
    }
    await ctx.db.delete(args.accountId);
  },
});

/** Marks an account connected or failed once the code was found (or not). */
export const setStatus = internalMutation({
  args: {
    accountId: v.id("connectedAccounts"),
    status: v.union(
      v.literal("pending"),
      v.literal("connected"),
      v.literal("failed"),
    ),
    /** Real counts read from the platform, recorded only on success. */
    followers: v.optional(v.number()),
    posts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("That connection request no longer exists.");
    await ctx.db.patch(args.accountId, {
      status: args.status,
      connectedAt: args.status === "connected" ? Date.now() : undefined,
      // Only refreshed on a successful check, so a blocked lookup can never
      // wipe numbers we already hold.
      followers:
        args.status === "connected" ? args.followers : account.followers,
      posts: args.status === "connected" ? args.posts : account.posts,
    });
  },
});

type CheckResult = {
  verified: boolean;
  /** The bio text we read, when we could read one. */
  bio: string | null;
  /**
   * Whether the platform actually returned the profile.
   *
   * This separates "we asked and the profile has an empty bio" from "the
   * lookup itself was refused", which are very different problems for a
   * creator and must not be shown the same way.
   */
  bioRead: boolean;
  message: string;
};

/**
 * Fetches the creator's public profile and looks for the one-time code in the
 * bio. The profile is read on the server, and the code has to genuinely appear
 * there — the client cannot assert that a verification happened.
 */
/**
 * Re-reads the public profile of an account and records a fresh follower and
 * post count.
 *
 * Follower counts move, so a number captured when the bio was verified is
 * stale within days. This is what keeps it live: it asks the platform again and
 * writes down only what the platform actually published. A platform that
 * refuses the lookup leaves the previous numbers exactly as they were and says
 * so — a refresh must never replace a real count with a guess, nor wipe it
 * because one call failed.
 *
 * Callers are their own owner, or an operator looking at that creator.
 */
export const refreshStats = action({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    /** True when the platform itself was asked on this call. */
    fetched: boolean;
    followers: number | null;
    posts: number | null;
    /** When the platform was last actually asked, per the stored row. */
    refreshedAt: number | null;
    reason?: string;
  }> => {
    /* An action cannot read the database, and the decision about whose account
       this is has to be made from stored rows — never from the browser. The
       read and the ownership check therefore happen together, in an internal
       query, the same way `verifyBio` does it. */
    const account = await ctx.runQuery(internal.accounts.getForStats, {
      accountId: args.accountId,
    });
    if (!account) {
      return {
        ok: false,
        fetched: false,
        followers: null,
        posts: null,
        refreshedAt: null,
        reason: "That connection request is no longer available to you.",
      };
    }

    /* The dashboard polls every couple of seconds, but every poll is a real
       request from this deployment's shared IP — and the platforms throttle
       those hard (Instagram already serves this deployment degraded
       responses). A poller that outruns the cooldown is answered from the
       stored row instead, so the page stays live while the platform sees at
       most one request per account per interval. */
    if (
      account.statsRefreshedAt != null &&
      Date.now() - account.statsRefreshedAt < STATS_REFRESH_COOLDOWN_MS
    ) {
      return {
        ok: true,
        fetched: false,
        followers: account.followers ?? null,
        posts: account.posts ?? null,
        refreshedAt: account.statsRefreshedAt,
      };
    }

    const profile = await fetchProfile(account.platform, account.handle);
    if (!profile.ok) {
      /* The attempt itself is stamped even though nothing was read: without
         it, every refused lookup would be retried at full poll speed and the
         throttling would only deepen. The count we already hold is untouched
         — one refused lookup must never turn a real follower count into a
         zero. */
      await ctx.runMutation(internal.accounts.setStats, {
        accountId: account._id,
      });
      return {
        ok: false,
        fetched: true,
        followers: account.followers ?? null,
        posts: account.posts ?? null,
        refreshedAt: Date.now(),
        reason: profile.reason,
      };
    }

    /* Only the fields the platform actually published are passed on. A field
       it did not publish is simply omitted, and `setStats` leaves the stored
       value untouched. */
    await ctx.runMutation(internal.accounts.setStats, {
      accountId: account._id,
      ...(profile.followers !== undefined ? { followers: profile.followers } : {}),
      ...(profile.posts !== undefined ? { posts: profile.posts } : {}),
    });
    return {
      ok: true,
      fetched: true,
      followers: profile.followers ?? account.followers ?? null,
      posts: profile.posts ?? account.posts ?? null,
      refreshedAt: Date.now(),
    };
  },
});

/**
 * Reads a connection row for a refresh, but only for the account that owns
 * it. "Gone" and "not yours" both return null, so this cannot be used to
 * discover which account ids exist.
 */
export const getForStats = internalQuery({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;
    if (account.userId !== user._id && user.role !== "admin") return null;
    return {
      _id: account._id,
      platform: account.platform,
      handle: account.handle,
      followers: account.followers,
      posts: account.posts,
      statsRefreshedAt: account.statsRefreshedAt,
    };
  },
});

/**
 * Writes a refreshed count.
 *
 * Both fields are optional on purpose. A refresh that could not read one of
 * them omits that field and the stored number survives; only a field the
 * platform genuinely published is written back. Nothing here ever writes a
 * zero over a real count, and nothing is written at all when the lookup failed.
 */
export const setStats = internalMutation({
  args: {
    accountId: v.id("connectedAccounts"),
    followers: v.optional(v.number()),
    posts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    await ctx.db.patch(args.accountId, {
      followers: args.followers ?? account.followers,
      posts: args.posts ?? account.posts,
      statsRefreshedAt: Date.now(),
    });
  },
});

/**
 * Reads the stored verification inputs for a row, but only for the account
 * that owns it. Both "gone" and "not yours" return null so a caller cannot use
 * this to discover which account ids exist.
 */
export const getForVerify = internalQuery({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;
    if (account.userId !== user._id && user.role !== "admin") return null;
    return {
      _id: account._id,
      platform: account.platform,
      handle: account.handle,
      code: account.code,
    };
  },
});

export const verifyBio = action({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args): Promise<CheckResult> => {
    /* Everything that decides a verification is read from the stored row, not
       from the browser, and the caller has to own it. An action cannot reach
       the database directly, so the read happens in an internal query that
       enforces that.

       If the handle or code came from the client, someone could create a
       connection row for a handle they do not own, then verify it while
       pointing the bio check at a profile they do own. Their own bio would
       satisfy the code check and the row would flip to "connected" while
       naming somebody else's handle — which is exactly the person whose clips
       and payouts it would then carry. */
    const account = await ctx.runQuery(internal.accounts.getForVerify, {
      accountId: args.accountId,
    });
    if (!account) {
      return {
        verified: false,
        bio: null,
        bioRead: false,
        message: "That connection request is no longer available to you.",
      };
    }

    if (!CODE_PATTERN.test(account.code)) {
      return {
        verified: false,
        bio: null,
        bioRead: false,
        message: "That code is not valid.",
      };
    }

    const profile = await fetchProfile(account.platform, account.handle);

    if (!profile.ok) {
      await ctx.runMutation(internal.accounts.setStatus, {
        accountId: account._id,
        status: "failed",
      });
      return {
        verified: false,
        bio: null,
        bioRead: false,
        message: profile.reason,
      };
    }

    /* A platform can resolve a different account than the one requested, so
       the handle has to match what we looked for. */
    if (profile.handle !== account.handle.toLowerCase()) {
      await ctx.runMutation(internal.accounts.setStatus, {
        accountId: account._id,
        status: "failed",
      });
      return {
        verified: false,
        bio: profile.bio,
        bioRead: true,
        message: `That link points to @${profile.handle}, not @${account.handle}.`,
      };
    }

    const bio = profile.bio ?? "";
    /* Match case-insensitively: platforms and phones both love to helpfully
       change the case of a code someone pasted into their bio. */
    const found = bio.toUpperCase().includes(account.code);

    await ctx.runMutation(internal.accounts.setStatus, {
      accountId: account._id,
      status: found ? "connected" : "failed",
      followers: profile.followers,
      posts: profile.posts,
    });

    if (found) {
      return {
        verified: true,
        bio,
        bioRead: true,
        message: `We found ${account.code} in the bio on @${account.handle}.`,
      };
    }

    /* We did read the profile here — the bio just doesn't carry the code (or
       is empty), which is a different fix for the creator than being blocked. */
    return {
      verified: false,
      bio,
      bioRead: true,
      message: bio
        ? `We read @${account.handle}'s bio but ${account.code} isn't in it yet. Paste the code into the bio, save, then hit Verify again.`
        : `@${account.handle}'s bio is empty right now. Add the ${account.code} code, save, then hit Verify again.`,
    };
  },
});

