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

/** Codes are uppercase alphanumerics, e.g. CLIPTIC-4821. */
const CODE_PATTERN = /^CLIPTIC-[0-9]{6}$/;

/** Handles are 1-30 chars of letters, digits, dot or underscore. */
const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

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

function makeCode(): string {
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `CLIPTIC-${digits}`;
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

/** Start a connection: stores a freshly generated one-time code. */
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

    const existing = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_user_platform", (q) =>
        q
          .eq("userId", user._id)
          .eq("platform", args.platform),
      )
      .unique();

    /* Already verified — nothing to do. */
    if (existing && existing.status === "connected") return existing;

    /* Re-issue a code for an account that has not connected yet. */
    if (existing) {
      const code = makeCode();
      await ctx.db.patch(existing._id, { code, status: "pending" });
      return { ...existing, code, status: "pending" as const };
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
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("That connection request no longer exists.");
    await ctx.db.patch(args.accountId, {
      status: args.status,
      connectedAt: args.status === "connected" ? Date.now() : undefined,
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
    const found = bio.includes(account.code);

    await ctx.runMutation(internal.accounts.setStatus, {
      accountId: account._id,
      status: found ? "connected" : "failed",
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

