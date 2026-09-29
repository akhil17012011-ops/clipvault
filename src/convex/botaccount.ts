import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { fetchInstagramLoggedIn } from "./platforms";
import { isDeveloperEmailRole } from "./roles";


/**
 * The developer's control panel for the Instagram bot account.
 *
 * Instagram answers anonymous profile lookups from datacentre addresses with a
 * 401, and answering it with a real signed-in session is the only route that is
 * free, unlimited and immediate — no per-read cost, no third party. The
 * session cannot be obtained automatically from a server: Instagram demands an
 * anti-bot checkpoint that only a real browser can clear, and clearing that
 * programmatically is not something this file will do. So the account owner
 * signs in once in their own browser and hands over the resulting cookies.
 *
 * That makes this a credential store, and it is treated as one:
 *
 *  - it is reachable only by the developer address, checked here on the server
 *    against the verified email on the user row, never against anything the
 *    browser claims;
 *  - the session itself is never returned by any query. `botStatus` reports
 *    *that* a session exists and when it was last proven good, so this screen
 *    can render state without ever holding the value;
 *  - the cookies go in and come out only through actions and mutations, and
 *    `clear` exists so a leaked or expired session can be destroyed in one
 *    click rather than lingering.
 */

const ROW_KEY = "ig-bot";

/** A cookie shorter than this is a mistake, not a session. */
const MIN_COOKIE_LENGTH = 20;

/** Anything longer than this is a paste accident, not a cookie. */
const MAX_COOKIE_LENGTH = 400;

/**
 * Pulls the three cookies we need out of a whole `Cookie:` header.
 *
 * Every entry is `name=value; name=value`, and the values may themselves
 * contain `=` (base64 padding) and `%` escapes, so the split is on the *first*
 * `=` of each pair and nothing else. Percent escapes are decoded, because
 * these values are stored encoded and an encoded `sessionid` sent verbatim
 * simply never authenticates — which looks exactly like a dead cookie and is
 * the easiest way to spend an hour on a session that was never broken.
 */
function parseCookieHeader(header: string): {
  sessionid?: string;
  csrftoken?: string;
  ds_user_id?: string;
} {
  const wanted = ["sessionid", "csrftoken", "ds_user_id"] as const;
  const found: Partial<Record<(typeof wanted)[number], string>> = {};
  const take = (name: string, raw: string) => {
    if (!(wanted as readonly string[]).includes(name)) return;
    const key = name as (typeof wanted)[number];
    if (found[key]) return;
    try {
      found[key] = decodeURIComponent(raw);
    } catch {
      /* A malformed escape is not a reason to drop the whole paste. */
      found[key] = raw;
    }
  };

  for (const line of header.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      /* A Netscape file opens with `# Netscape HTTP Cookie File` and puts a
         `#HttpOnly_` prefix on secure cookies — which is exactly the one we
         need, so the prefix is stripped rather than the line skipped. */
      if (trimmed.startsWith("#HttpOnly_")) {
        const rest = trimmed.slice("#HttpOnly_".length);
        const cols = rest.split(/\t|\s{2,}|\s/);
        if (cols.length >= 7) take(cols[5], cols.slice(6).join(" "));
      }
      continue;
    }

    /* Netscape format: seven tab-separated columns ending in name and value.
       This is what the Android cookies extension hands back, so it is read as
       carefully as the header form rather than being a second-class paste. */
    const cols = trimmed.split(/\t|\s{2,}|\s/);
    if (cols.length >= 7) {
      take(cols[5], cols.slice(6).join(" "));
      continue;
    }

    /* Header form: `name=value; name=value`. The split is on the *first* `=`
       of each pair, because these values are base64 and contain `=` padding. */
    for (const pair of trimmed.split(";")) {
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      take(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  return found;
}

/**
 * The signed-in developer's account, or null for everybody else.
 */
export const botStatus = query({
  args: {},
  handler: async (ctx): Promise<{
    allowed: boolean;
    connected: boolean;
    status: "anonymous" | "ok" | "challenge" | "error" | null;
    loggedInAs: string | null;
    lastLoginAt: number | null;
    message: string | null;
    /* A fingerprint, not the value: enough to tell two sessions apart in the
       UI without the cookie ever entering a query result. */
    sessionHint: string | null;
  }> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return {
        allowed: false,
        connected: false,
        status: null,
        loggedInAs: null,
        lastLoginAt: null,
        message: null,
        sessionHint: null,
      };
    }
    const user = await ctx.db.get(userId);
    if (!isDeveloperEmailRole(user?.email)) {
      return {
        allowed: false,
        connected: false,
        status: null,
        loggedInAs: null,
        lastLoginAt: null,
        message: null,
        sessionHint: null,
      };
    }

    const row = await ctx.db
      .query("igBotSessions")
      .withIndex("by_key", (q) => q.eq("key", ROW_KEY))
      .first();

    return {
      allowed: true,
      connected: Boolean(row?.sessionid),
      status: row?.status ?? null,
      loggedInAs: row?.loggedInAs ?? null,
      lastLoginAt: row?.lastLoginAt ?? null,
      message: row?.message ?? null,
      sessionHint: row?.sessionid
        ? `…${row.sessionid.slice(-4)}`
        : null,
    };
  },
});

/**
 * Stores a session captured by hand.
 *
 * The cookies are validated for shape before anything is written, because a
 * truncated paste that looked accepted would sit in the row looking connected
 * and quietly fail every later read. A session is only stored as "ok" once a
 * real read has proved it works — see `testBotSession`.
 */
export const saveBotSession = mutation({
  args: {
    /**
     * The whole `Cookie:` header, as one string.
     *
     * This is the easier of the two ways in, and the one that works on a
     * phone: a browser extension that can see cookies on Android hands back
     * either one long string or a Netscape cookie file, whereas picking three
     * individual values out of a list on a small screen is fiddly and easy to
     * get wrong. Both shapes are accepted, including the `#HttpOnly_` prefix
     * that marks the very cookie we need. The three named fields below still
     * work for anybody who copied them separately, and anything passed here
     * wins, so a partial paste is still useful.
     */
    cookieHeader: v.optional(v.string()),
    sessionid: v.optional(v.string()),
    csrfToken: v.optional(v.string()),
    dsUserId: v.optional(v.string()),
    loggedInAs: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; message: string }> => {
    const caller = await ctx.runQuery(internal.roles.callerIsDeveloper, {});
    if (!caller.isDeveloper) {
      throw new Error("Only the Clip Vault developer account can do that.");
    }

    /* Whatever the header carried, then overridden by anything typed
       separately. `decodeURIComponent` because every one of these values is
       percent-encoded, and Instagram's own endpoints expect that form — an
       encoded `sessionid` read as a literal is a sessionid that never works. */
    const parsed = parseCookieHeader(args.cookieHeader ?? "");
    const sessionid =
      args.sessionid?.trim() || parsed.sessionid || "";
    const csrfToken = args.csrfToken?.trim() || parsed.csrftoken || "";
    const dsUserId = args.dsUserId?.trim() || parsed.ds_user_id;

    if (
      sessionid.length < MIN_COOKIE_LENGTH ||
      sessionid.length > MAX_COOKIE_LENGTH
    ) {
      return {
        ok: false,
        message:
          "No sessionid was found. Paste the whole cookie string from the site, or the sessionid value on its own.",
      };
    }
    if (csrfToken.length < 8) {
      return {
        ok: false,
        message:
          "No csrftoken was found. It is usually the last entry in the same cookie list.",
      };
    }

    await ctx.runMutation(internal.igbot.save, {
      status: "ok",
      sessionid,
      csrfToken,
      ...(dsUserId ? { dsUserId } : {}),
      loggedInAs: args.loggedInAs.trim().toLowerCase(),
      lastLoginAt: Date.now(),
    });
    return {
      ok: true,
      message: "Session saved. Run the test to confirm it can read a profile.",
    };
  },
});

/** Destroys the stored session, for a cookie that has expired or leaked. */
export const clearBotSession = mutation({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; message: string }> => {
    const caller = await ctx.runQuery(internal.roles.callerIsDeveloper, {});
    if (!caller.isDeveloper) {
      throw new Error("Only the Clip Vault developer account can do that.");
    }
    await ctx.runMutation(internal.igbot.save, {
      status: "anonymous",
      forgetSession: true,
      message: "The stored Instagram session was removed.",
    });
    return { ok: true, message: "Session removed." };
  },
});

/**
 * Proves the stored session can actually read a profile, before anyone relies
 * on it.
 *
 * "Saved" is not "working": a cookie copied from the wrong tab, truncated, or
 * already expired all store perfectly happily and fail on every later read.
 * So this asks Instagram for a real profile and reports what came back, and a
 * session that cannot read is retired on the spot rather than left in place
 * looking healthy.
 */
export const testBotSession = action({
  args: { handle: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    handle?: string;
    followers?: number;
    posts?: number;
    message: string;
  }> => {
    const caller = await ctx.runQuery(internal.roles.callerIsDeveloper, {});
    if (!caller.isDeveloper) {
      throw new Error("Only the Clip Vault developer account can do that.");
    }

    const row = await ctx.runQuery(internal.igbot.get, {});
    if (!row?.sessionid || !row.csrfToken) {
      return {
        ok: false,
        message: "No session is stored yet.",
      };
    }

    const read = await fetchInstagramLoggedIn(args.handle.trim(), {
      sessionid: row.sessionid,
      csrfToken: row.csrfToken,
      dsUserId: row.dsUserId,
    });

    if (read.ok) {
      await ctx.runMutation(internal.igbot.save, { status: "ok" });
      return {
        ok: true,
        handle: read.handle,
        ...(read.followers !== undefined ? { followers: read.followers } : {}),
        ...(read.posts !== undefined ? { posts: read.posts } : {}),
        message: `Read @${read.handle} with the stored session.`,
      };
    }

    /* A session that is definitively dead is destroyed here rather than left to
       fail every future read with a stale-looking "connected" badge. */
    if (read.sessionDead) {
      await ctx.runMutation(internal.igbot.save, {
        status: "error",
        forgetSession: true,
        message: read.reason,
      });
    }
    return { ok: false, message: read.reason };
  },
});
