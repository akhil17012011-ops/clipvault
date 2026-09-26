import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
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

    const handle = args.handle.trim().replace(/^@+/, "");
    if (!HANDLE_PATTERN.test(handle)) {
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

/**
 * Public profile URL for a platform + handle. Used to fetch the bio during
 * verification.
 */
type CheckResult = {
  verified: boolean;
  /** The bio text we read, when we could read one. */
  bio: string | null;
  message: string;
};

/**
 * Fetches the creator's public profile and looks for the one-time code in the
 * bio. The profile is read on the server, and the code has to genuinely appear
 * there — the client cannot assert that a verification happened.
 */
export const verifyBio = action({
  args: {
    accountId: v.id("connectedAccounts"),
    platform: PLATFORM,
    handle: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args): Promise<CheckResult> => {
    if (!CODE_PATTERN.test(args.code)) {
      return { verified: false, bio: null, message: "That code is not valid." };
    }

    const profile = await fetchProfile(args.platform, args.handle);

    if (!profile.ok) {
      await ctx.runMutation(internal.accounts.setStatus, {
        accountId: args.accountId,
        status: "failed",
      });
      return { verified: false, bio: null, message: profile.reason };
    }

    /* A platform can resolve a different account than the one requested, so
       the handle has to match what we looked for. */
    if (profile.handle !== args.handle.toLowerCase()) {
      await ctx.runMutation(internal.accounts.setStatus, {
        accountId: args.accountId,
        status: "failed",
      });
      return {
        verified: false,
        bio: profile.bio,
        message: `That link points to @${profile.handle}, not @${args.handle}.`,
      };
    }

    const bio = profile.bio ?? "";
    const found = bio.includes(args.code);

    await ctx.runMutation(internal.accounts.setStatus, {
      accountId: args.accountId,
      status: found ? "connected" : "failed",
    });

    if (found) {
      return {
        verified: true,
        bio,
        message: `We found ${args.code} in the bio on @${args.handle}.`,
      };
    }

    return {
      verified: false,
      bio,
      message: bio
        ? `We read @${args.handle}'s bio but ${args.code} isn't in it yet. Paste the code into the bio, save, then hit Verify again.`
        : `We reached @${args.handle} but couldn't read a bio. Make sure the account is public and has the ${args.code} code in its bio.`,
    };
  },
});

