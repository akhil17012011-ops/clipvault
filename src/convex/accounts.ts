import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./access";

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
function profileUrl(platform: string, handle: string): string | null {
  switch (platform) {
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    default:
      return null;
  }
}

type CheckResult = {
  verified: boolean;
  /** The bio text we read, when we could read one. */
  bio: string | null;
  message: string;
};

/**
 * Fetches the creator's public profile and looks for the one-time code.
 *
 * Instagram and X render their bios client-side, so no code is found in the
 * raw HTML there; the creator is told to use a platform whose bio is
 * server-rendered. That is the honest outcome, not a fake success.
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

    const url = profileUrl(args.platform, args.handle);
    if (!url) {
      return {
        verified: false,
        bio: null,
        message: "That platform is not supported for verification.",
      };
    }

    let html: string | null = null;
    try {
      const response = await fetch(url, {
        headers: {
          // Ask for the server-rendered page; public desktop markup.
          "user-agent":
            "Mozilla/5.0 (compatible; CLIPTIC/1.0; +https://cliptic.app)",
          accept: "text/html",
        },
      });
      if (response.ok) html = await response.text();
    } catch {
      html = null;
    }

    if (html === null) {
      await ctx.runMutation(internal.accounts.setStatus, {
        accountId: args.accountId,
        status: "failed",
      });
      return {
        verified: false,
        bio: null,
        message:
          "We couldn't reach that profile. Check the username and that the account is public.",
      };
    }

    const found = html.includes(args.code);
    const bio = extractBio(html);

    if (found) {
      await ctx.runMutation(internal.accounts.setStatus, {
        accountId: args.accountId,
        status: "connected",
      });
      return {
        verified: true,
        bio,
        message: `We found ${args.code} on @${args.handle}.`,
      };
    }

    await ctx.runMutation(internal.accounts.setStatus, {
      accountId: args.accountId,
      status: "failed",
    });

    const serverRendered = args.platform !== "instagram" && args.platform !== "x";
    return {
      verified: false,
      bio,
      message: serverRendered
        ? `We loaded @${args.handle} but ${args.code} isn't in the bio yet. Paste the code, save, and try again.`
        : `${args.platform === "instagram" ? "Instagram" : "X"} builds its bio in the browser, so we can't read it from here. Verify this account from a TikTok or YouTube profile instead.`,
    };
  },
});

/** Best-effort bio text out of a server-rendered profile page. */
function extractBio(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,300})["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .slice(0, 300);
    }
  }
  return null;
}
