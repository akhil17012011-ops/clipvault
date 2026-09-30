import { Infer, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./access";
import { createInstagramSessionReader } from "./igbot";
import { fetchInstagramGraph, fetchProfile } from "./platforms";

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
 * How many connected accounts one creator may hold.
 *
 * A real clipping kit is a handful of handles; this cap exists so the table
 * the stats poller walks cannot be filled with thousands of throwaway rows by
 * one scripted client.
 */
const MAX_ACCOUNTS_PER_USER = 12;

/**
 * Minimum time between real platform lookups for one account.
 *
 * This was 900ms, sized to sit just under a one-second dashboard poll so every
 * tick produced a real read. That was a mistake: a follower count does not
 * change in a second, and a request-per-second from one shared IP is exactly
 * the pattern Instagram throttles — which is why the numbers went missing.
 *
 * The background poll now runs every ten minutes and this window matches it,
 * so a tick that is due does a real read and a duplicate cannot. A press of
 * Sync ignores this entirely, because a person asking is not the poller.
 */
const STATS_REFRESH_COOLDOWN_MS = 10 * 60_000;

/**
 * Minimum time between bio-verification attempts on one account.
 *
 * A verification is a live read of somebody's public profile. Sixty seconds is
 * short enough that a real creator never notices it and long enough that a
 * button held down cannot become a request flood.
 */
const VERIFY_COOLDOWN_MS = 60_000;

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
    /* Copied field by field for the same reason as `listAll`: the Graph API
       token is a bearer credential and must not reach the browser, not even
       on the creator's own page. */
    return accounts
      .map((account) => ({
        _id: account._id,
        userId: account.userId,
        platform: account.platform,
        handle: account.handle,
        code: account.code,
        status: account.status,
        connectedAt: account.connectedAt,
        followers: account.followers,
        posts: account.posts,
        statsRefreshedAt: account.statsRefreshedAt,
        statsNote: account.statsNote,
        hasGraphToken: Boolean(account.graphToken),
        createdAt: account.createdAt,
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
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
        /* The row is copied field by field rather than spread. Spreading it
           would ship the Graph API token to the browser, where it would sit in
           a network response and in any devtools panel open on this page. The
           operator is told only that a token exists. */
        _id: account._id,
        userId: account.userId,
        platform: account.platform,
        handle: account.handle,
        code: account.code,
        status: account.status,
        connectedAt: account.connectedAt,
        followers: account.followers,
        posts: account.posts,
        statsRefreshedAt: account.statsRefreshedAt,
        statsNote: account.statsNote,
        hasGraphToken: Boolean(account.graphToken),
        createdAt: account.createdAt,
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

    if (mine.length >= MAX_ACCOUNTS_PER_USER) {
      throw new Error(
        `You can connect up to ${MAX_ACCOUNTS_PER_USER} accounts. Remove one first to add another.`,
      );
    }

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
  args: {
    accountId: v.id("connectedAccounts"),
    /**
     * Asked for by a person, not by the poller.
     *
     * A press of Sync skips the cooldown and the backoff, because a human has
     * decided the answer changed — usually right after posting, or after
     * pasting a new token. This is the only way to reach a platform that has
     * been refusing us, and it is deliberately one request per press: a
     * button that spammed on hold would reproduce the very rate limit the
     * backoff exists to avoid.
     *
     * Staff only, and the handler says so: the flag is ignored for anyone
     * else, because it also decides whether the paid reader runs.
     */
    force: v.optional(v.boolean()),
  },
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

    /* `force` is honoured for staff only.

       It skips the cooldown and the backoff, and it is the one flag that
       hands the paid reader key to the platform — so it is decided here,
       from the role on the caller's own row, and never from whatever the
       browser sends. A creator asking for it gets the ordinary metered path
       instead of spending this deployment's budget from their own console. */
    const force = args.force === true && account.callerIsStaff;

    /* The poller asks every second. Every ask is a real request from this
       deployment's shared IP, and the platforms throttle those hard — the
       backoff is what stops a refusal from becoming permanent. A person
       pressing Sync is exempt: that is the escape hatch the backoff leaves
       open, and it is also how a fresh token is tested the moment it lands. */
    if (!force) {
      if (
        account.statsRetryAfter != null &&
        Date.now() < account.statsRetryAfter
      ) {
        return {
          ok: false,
          fetched: false,
          followers: account.followers ?? null,
          posts: account.posts ?? null,
          refreshedAt: account.statsRefreshedAt ?? null,
          reason:
            account.statsNote ??
            "The platform is not answering right now. Press Sync to try again.",
        };
      }
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
    }

    /* Instagram first goes to its own API when a token is attached. That route
       is the one that actually answers from this server, and it is also the
       one that does not spend this deployment's IP on every poll. */
    const profile =
      account.platform === "instagram" && account.graphToken
        ? await fetchInstagramGraph(account.graphToken, account.handle)
        : await fetchProfile(account.platform, account.handle, {
            /* The bot account leads the chain; anonymous Instagram and the
               hosted reader follow it. The reader's key is read here, inside
               an action, from the environment — it is never stored on the row
               and never returned to a browser. */
            sessionReader: createInstagramSessionReader(ctx),
            /* Only a person pressing Sync reaches the hosted reader. The
               one-second poller must not: a paid reader on a one-second timer
               is ~86,000 reads a day per account, which would drain a free
               plan in minutes. The free routes are what the timer uses, and
               they are free exactly because they are cheap. */
            scraperToken: force
              ? (process.env.APIFY_TOKEN ?? null)
              : null,
          });

    if (!profile.ok) {
      /* The attempt itself is stamped even though nothing was read, and the
         failure is counted so the next ask waits longer than the last. The
         count we already hold is untouched — one refused lookup must never
         turn a real follower count into a zero. */
      await ctx.runMutation(internal.accounts.setStats, {
        accountId: account._id,
        failed: true,
        note: profile.reason,
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
       value untouched. A success clears the failure count and the sentence,
       so a fixed problem stops being reported. */
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
 * Attaches (or replaces) the Instagram Graph API token for one account.
 *
 * The token is a bearer credential for somebody's Instagram account, so it
 * goes straight into the row and is never returned, logged, or put in a query
 * result — `getForStats` reads it inside an action, and everything the browser
 * sees is `hasGraphToken`, a boolean. Attaching clears the stored failure
 * sentence and the backoff, because the whole point is that something just
 * changed; the next poll goes out immediately instead of waiting out a
 * backoff earned against the previous token.
 */
export const attachGraphToken = mutation({
  args: {
    accountId: v.id("connectedAccounts"),
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
    const token = args.token.trim();
    if (token.length < 20) {
      return {
        ok: false,
        message: "That doesn't look like an Instagram access token.",
      };
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      return { ok: false, message: "That connection request no longer exists." };
    }
    const user = await requireUser(ctx);
    if (account.userId !== user._id && user.role !== "admin") {
      return { ok: false, message: "That account isn't yours." };
    }
    if (account.platform !== "instagram") {
      return {
        ok: false,
        message: "Only Instagram accounts use the Graph API token.",
      };
    }

    await ctx.db.patch(args.accountId, {
      graphToken: token,
      statsNote: undefined,
      statsFailures: undefined,
      statsRetryAfter: undefined,
    });
    return {
      ok: true,
      message: "Token saved. Press Sync to read the real follower count.",
    };
  },
});

/** Removes the token. The counts already read are kept. */
export const detachGraphToken = mutation({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return { ok: false };
    const user = await requireUser(ctx);
    if (account.userId !== user._id && user.role !== "admin") return { ok: false };
    await ctx.db.patch(args.accountId, { graphToken: undefined });
    return { ok: true };
  },
});

/**
 * Reads a connection row for a refresh, but only for the account that owns
 * it. "Gone" and "not yours" both return null, so this cannot be used to
 * discover which account ids exist.
 */
/** Records that a bio check just happened, so the next one waits. */
export const stampVerifyAttempt = internalMutation({
  args: { accountId: v.id("connectedAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    await ctx.db.patch(args.accountId, { lastAttemptAt: Date.now() });
  },
});

/**
 * Everything a stats refresh is allowed to know about an account, read on the
 * server with the ownership check applied.
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
      statsNote: account.statsNote,
      statsRetryAfter: account.statsRetryAfter,
      /* Read by the action and never by the browser. */
      graphToken: account.graphToken,
      /* Decided from the rows, never from the browser: only staff may take
         the path that skips the cooldown and spends the paid reader key. */
      callerIsStaff: user.role === "admin" || user.role === "developer",
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
 *
 * A failure records two things: the sentence, so whoever looks next knows what
 * is actually wrong, and a backoff window, so the poller stops asking a
 * platform that has already said no. The window grows with each consecutive
 * failure and is wiped by the first success.
 */
/**
 * How long to wait after a failed read, given how many have failed in a row.
 *
 * Doubling from a minute and capped at half an hour. The point is not to be
 * clever: it is to stop a poller from turning a refusal into a block. A
 * platform that says no once is usually a rate limit, and a rate limit that
 * keeps being hit never lifts.
 */
function backoffMs(consecutiveFailures: number): number {
  const capped = Math.min(Math.max(consecutiveFailures, 1), 5);
  return Math.min(60_000 * 2 ** (capped - 1), 30 * 60_000);
}

export const setStats = internalMutation({
  args: {
    accountId: v.id("connectedAccounts"),
    followers: v.optional(v.number()),
    posts: v.optional(v.number()),
    /** True when this write records a failed read rather than counts. */
    failed: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;

    if (args.failed) {
      const failures = (account.statsFailures ?? 0) + 1;
      await ctx.db.patch(args.accountId, {
        statsRefreshedAt: Date.now(),
        statsNote: args.note,
        statsFailures: failures,
        /* A minute, doubling up to half an hour. Long enough that a rate limit
           gets a chance to expire, short enough that a token fixed in the
           meantime starts counting again without anyone filing a ticket. */
        statsRetryAfter: Date.now() + backoffMs(failures),
      });
      return;
    }

    await ctx.db.patch(args.accountId, {
      followers: args.followers ?? account.followers,
      posts: args.posts ?? account.posts,
      statsRefreshedAt: Date.now(),
      /* A success ends the sentence and the waiting. */
      statsNote: undefined,
      statsFailures: undefined,
      statsRetryAfter: undefined,
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
      /* Read so a repeated check can be refused before it costs a platform
         read. Never returned to a browser. */
      lastAttemptAt: account.lastAttemptAt ?? null,
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

    /* One platform read per verification attempt, then a wait.
     *
     * Every check here is a live request to the platform from this
     * deployment's shared IP. Without a floor, a signed-in user can hold down
     * the verify button and turn one click into hundreds of reads, which is the
     * traffic that gets the whole deployment rate-limited — so the expensive
     * route is metered here rather than trusted to the interface. A person who
     * has genuinely just changed their bio waits a minute, which is shorter
     * than the time it takes to walk to the page. */
    if (
      account.lastAttemptAt != null &&
      Date.now() - account.lastAttemptAt < VERIFY_COOLDOWN_MS
    ) {
      const wait = Math.ceil(
        (VERIFY_COOLDOWN_MS - (Date.now() - account.lastAttemptAt)) / 1000,
      );
      return {
        verified: false,
        bio: null,
        bioRead: false,
        message: `Just checked. Try again in ${wait} second${wait === 1 ? "" : "s"} — each check is a real request to the platform, and checking repeatedly is what gets us rate-limited.`,
      };
    }
    await ctx.runMutation(internal.accounts.stampVerifyAttempt, {
      accountId: args.accountId,
    });

    if (!CODE_PATTERN.test(account.code)) {
      return {
        verified: false,
        bio: null,
        bioRead: false,
        message: "That code is not valid.",
      };
    }

    const profile = await fetchProfile(account.platform, account.handle, {
      /* Same routes as a count refresh. A human watching this screen can
         tolerate a session sign-in happening behind it, and a bio read that
         only worked once per IP was never dependable anyway. */
      sessionReader: createInstagramSessionReader(ctx),
      /* The hosted reader is a paid call, so a bio check does not get to make
         one. Bio verification is a one-off, human-initiated act, and leaving
         the paid reader off this path means the most expensive route in the
         product cannot be driven by a user clicking "verify" repeatedly. The
         free routes plus the saved session are what this relies on; if neither
         can read the profile, the creator is told that plainly. */
      scraperToken: null,
    });

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

