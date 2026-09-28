import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import {
  fetchInstagramLoggedIn,
  instagramLogin,
  type ProfileResult,
} from "./platforms";

/**
 * The signed-in route for reading Instagram profiles.
 *
 * Instagram answers anonymous lookups from datacentre IPs with throttling —
 * that is exactly what happened to this deployment: the first bio check
 * succeeded, and every count refresh after it was silently refused. A logged
 * in session is treated as a normal app rather than a scraper, so the same
 * public numbers come back reliably, for free, without the paid fallback.
 *
 * Three layers of restraint, because this is the part that can go wrong:
 *
 *  - credentials live only in the environment (`IG_BOT_USERNAME` /
 *    `IG_BOT_PASSWORD`), never in the database and never in a message;
 *  - sign-ins are metered, so a datacentre IP can never hammer Instagram's
 *    login endpoint the way that gets accounts locked;
 *  - a demanded human confirmation *stops* the loop and tells a person what
 *    to do, instead of retrying into the same wall.
 */

type ActionCtx = GenericActionCtx<DataModel>;

const ROW_KEY = "ig-bot";

/** Never sign in more often than this, even when asked to. */
const LOGIN_MIN_GAP_MS = 10 * 60_000;

/** How long a demanded human confirmation blocks further sign-in attempts. */
const CHALLENGE_LOCK_MS = 30 * 60_000;

const CHALLENGE_HINT =
  "Instagram wants this account to confirm the new sign-in. Open Instagram on that account's own phone, approve the request, then let the next refresh try again.";

/** The singleton session row, or null when no sign-in has happened yet. */
export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("igBotSessions")
      .withIndex("by_key", (q) => q.eq("key", ROW_KEY))
      .first();
  },
});

/**
 * Writes the session row.
 *
 * Cookie fields are only touched when the caller actually supplies them: a
 * failed sign-in must never wipe a session that is still working, and a
 * success must clear any stale message so the dashboard stops repeating a
 * problem that is over. `forgetSession` is how a dead cookie is retired on
 * purpose so the next round signs in fresh.
 */
export const save = internalMutation({
  args: {
    status: v.union(
      v.literal("anonymous"),
      v.literal("ok"),
      v.literal("challenge"),
      v.literal("error"),
    ),
    sessionid: v.optional(v.string()),
    csrfToken: v.optional(v.string()),
    dsUserId: v.optional(v.string()),
    message: v.optional(v.string()),
    loggedInAs: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    forgetSession: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("igBotSessions")
      .withIndex("by_key", (q) => q.eq("key", ROW_KEY))
      .first();
    const now = Date.now();

    const patch: {
      status: "anonymous" | "ok" | "challenge" | "error";
      message?: string;
      sessionid?: string;
      csrfToken?: string;
      dsUserId?: string;
      loggedInAs?: string;
      lastLoginAt?: number;
      lastAttemptAt: number;
    } = { status: args.status, lastAttemptAt: now };

    /* Assigning undefined removes an optional field — which is what we want
       on success: the previous failure message must not outlive it. */
    patch.message = args.message;

    if (args.sessionid && args.csrfToken) {
      patch.sessionid = args.sessionid;
      patch.csrfToken = args.csrfToken;
      patch.dsUserId = args.dsUserId;
      patch.loggedInAs = args.loggedInAs;
    }
    if (args.lastLoginAt !== undefined) patch.lastLoginAt = args.lastLoginAt;
    if (args.forgetSession) {
      patch.sessionid = undefined;
      patch.csrfToken = undefined;
      patch.dsUserId = undefined;
    }

    if (row) {
      await ctx.db.patch(row._id, patch);
    } else {
      /* Inserted without undefined-valued keys: an optional field is either
         a real value or absent, never present-but-undefined. */
      const doc: {
        key: string;
        createdAt: number;
        status: "anonymous" | "ok" | "challenge" | "error";
        message?: string;
        sessionid?: string;
        csrfToken?: string;
        dsUserId?: string;
        loggedInAs?: string;
        lastLoginAt?: number;
        lastAttemptAt: number;
      } = {
        key: ROW_KEY,
        createdAt: now,
        status: patch.status,
        lastAttemptAt: now,
      };
      if (patch.message !== undefined) doc.message = patch.message;
      if (patch.sessionid !== undefined) doc.sessionid = patch.sessionid;
      if (patch.csrfToken !== undefined) doc.csrfToken = patch.csrfToken;
      if (patch.dsUserId !== undefined) doc.dsUserId = patch.dsUserId;
      if (patch.loggedInAs !== undefined) doc.loggedInAs = patch.loggedInAs;
      if (patch.lastLoginAt !== undefined) doc.lastLoginAt = patch.lastLoginAt;
      await ctx.db.insert("igBotSessions", doc);
    }
  },
});

/**
 * Builds the reader that `fetchProfile` calls when the anonymous Instagram
 * route has been refused.
 *
 * It returns `null` to mean "nothing to say, keep going" — unconfigured
 * credentials or a transient blip — so the paid fallback stays in charge of
 * its own meter. Every other outcome carries a sentence that explains why a
 * count is missing, because that is what the dashboard shows a human.
 *
 * Session order matters: the saved session is tried first because it is free
 * and usually still valid; only a genuinely dead one is dropped and replaced,
 * and replacement itself is metered.
 */
export function createInstagramSessionReader(
  ctx: ActionCtx,
): (handle: string) => Promise<ProfileResult | null> {
  return async (handle: string): Promise<ProfileResult | null> => {
    const username = process.env.IG_BOT_USERNAME;
    const password = process.env.IG_BOT_PASSWORD;
    if (!username || !password) return null;

    let row = await ctx.runQuery(internal.igbot.get, {});
    const now = Date.now();

    if (
      row?.status === "challenge" &&
      row.lastLoginAt != null &&
      now - row.lastLoginAt < CHALLENGE_LOCK_MS
    ) {
      /* A human has to approve this on the account's own phone. Retrying in
         the meantime would only re-trigger it and risk the account, so the
         stored sentence is simply repeated until the window passes. */
      return { ok: false, reason: row.message ?? CHALLENGE_HINT };
    }

    if (row?.sessionid && row.csrfToken) {
      const read = await fetchInstagramLoggedIn(handle, {
        sessionid: row.sessionid,
        csrfToken: row.csrfToken,
        dsUserId: row.dsUserId,
      });
      if (read.ok) {
        return {
          ok: true,
          handle: read.handle,
          bio: read.bio,
          ...(read.followers !== undefined ? { followers: read.followers } : {}),
          ...(read.posts !== undefined ? { posts: read.posts } : {}),
        };
      }
      /* A blip is not a verdict: fall out of the session route without
         burning a sign-in, and let the chain continue. */
      if (read.transient) return null;
      if (!read.sessionDead) return { ok: false, reason: read.reason };

      /* The cookie is dead. Retire it and sign in fresh in this same round,
         so the page never wedges on a session that no longer works. */
      await ctx.runMutation(internal.igbot.save, {
        status: "error",
        message: read.reason,
        forgetSession: true,
      });
      row = null;
    }

    /* Sign-in meter. After a dead-session retirement this round still gets
       one attempt — `row` was just cleared — but the attempt stamps the
       meter, so the *next* round waits. A datacentre IP that signs in every
       fifteen seconds is how the account gets locked. */
    if (row?.lastLoginAt != null && now - row.lastLoginAt < LOGIN_MIN_GAP_MS) {
      return {
        ok: false,
        reason:
          row.message ??
          "The saved Instagram sign-in isn't ready yet — waiting before signing in again.",
      };
    }

    const login = await instagramLogin(username, password);
    if (login.ok) {
      await ctx.runMutation(internal.igbot.save, {
        status: "ok",
        sessionid: login.session.sessionid,
        csrfToken: login.session.csrfToken,
        dsUserId: login.session.dsUserId,
        loggedInAs: username,
        lastLoginAt: now,
      });
      const read = await fetchInstagramLoggedIn(handle, login.session);
      if (read.ok) {
        return {
          ok: true,
          handle: read.handle,
          bio: read.bio,
          ...(read.followers !== undefined ? { followers: read.followers } : {}),
          ...(read.posts !== undefined ? { posts: read.posts } : {}),
        };
      }
      if (read.transient) return null;
      return { ok: false, reason: read.reason };
    }

    await ctx.runMutation(internal.igbot.save, {
      status: login.challenge ? "challenge" : "error",
      lastLoginAt: now,
      message: login.reason,
    });
    return { ok: false, reason: login.reason };
  };
}
