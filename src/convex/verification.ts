import { v } from "convex/values";
import { internalAction, internalMutation, action, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./access";
import { sendOtpEmail } from "./auth/emailOtp";

/**
 * Email verification for accounts that signed up with a password.
 *
 * Google sign-in already proves the address, so Convex Auth stamps
 * `emailVerificationTime` on those users and they never come through here.
 * Password accounts have to prove they own the inbox: we mail a six-digit
 * code, they enter it, and only then is the account marked verified.
 *
 * The code is never stored in plain text — only a SHA-256 digest is, so a
 * database dump does not hand over live codes.
 *
 * Sending happens in an action because Convex mutations are not allowed to
 * make outbound HTTP calls; the database writes go through internal
 * mutations that the action drives.
 */

const CODE_TTL_MS = 15 * 60 * 1000;
/** Resend cooldown, so the relay cannot be abused to spam an address. */
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function randomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(value % 1_000_000).padStart(6, "0");
}

export async function digestCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison, so a wrong code cannot be brute-forced by
 *  timing the response. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** The most recent live challenge for a user, or null. */
function liveChallenge(
  rows: {
    _id: Id<"emailVerifications">;
    codeHash: string;
    sentAt: number;
    expiresAt: number;
    attempts: number;
  }[],
  now: number,
) {
  return rows
    .filter((row) => row.expiresAt > now)
    .sort((a, b) => b.sentAt - a.sentAt)[0];
}

export type VerificationStatus = {
  verified: boolean;
  /** A code is currently outstanding. */
  pending: boolean;
  /** True once the resend cooldown has passed. */
  canResend: boolean;
  secondsUntilResend: number;
  /**
   * When the resend cooldown lifts, as an absolute timestamp.
   *
   * The client counts down from this rather than from `secondsUntilResend`, so
   * the countdown stays correct across a tab that was in the background (where
   * timers are throttled and a naive "seconds minus one per tick" drifts). It is
   * `null` whenever there is no cooldown running.
   */
  resendAvailableAt: number | null;
  attemptsLeft: number;
  email: string;
};

/** Whether the signed-in user still has to verify their email. */
export const status = query({
  args: {},
  handler: async (ctx): Promise<VerificationStatus> => {
    const user = await requireUser(ctx);
    const now = Date.now();

    if (user.emailVerificationTime != null) {
      return {
        verified: true,
        pending: false,
        canResend: false,
        secondsUntilResend: 0,
        resendAvailableAt: null,
        attemptsLeft: 0,
        email: user.email ?? "",
      };
    }

    const rows = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const record = liveChallenge(rows, now);

    const resendAvailableAt =
      record == null ? null : record.sentAt + RESEND_COOLDOWN_MS;

    return {
      verified: false,
      pending: record != null,
      canResend: resendAvailableAt === null || now >= resendAvailableAt,
      secondsUntilResend:
        resendAvailableAt === null
          ? 0
          : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)),
      resendAvailableAt,
      attemptsLeft: record == null ? MAX_ATTEMPTS : record.attempts,
      email: user.email ?? "",
    };
  },
});

/* ------------------------------------------------------------------ */
/* Internal writes, driven by the action below                          */
/* ------------------------------------------------------------------ */

export const prepareSend = internalMutation({
  args: {
    userId: v.id("users"),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    /* Prune anything outside the window we rate-limit over. */
    for (const row of rows) {
      if (now - row.sentAt > 60 * 60 * 1000) await ctx.db.delete(row._id);
    }

    const recent = rows.filter((row) => now - row.sentAt < 60 * 60 * 1000);
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      return {
        ok: false as const,
        waitSeconds: 0,
        reason: "You've requested a lot of codes. Try again in an hour.",
      };
    }

    const latest = [...recent].sort((a, b) => b.sentAt - a.sentAt)[0];
    if (latest && now - latest.sentAt < RESEND_COOLDOWN_MS) {
      return {
        ok: false as const,
        waitSeconds: Math.ceil(
          (RESEND_COOLDOWN_MS - (now - latest.sentAt)) / 1000,
        ),
        reason: "Please wait a moment before requesting another code.",
      };
    }

    /* A resend supersedes the previous code. */
    if (latest) await ctx.db.delete(latest._id);

    await ctx.db.insert("emailVerifications", {
      userId: args.userId,
      codeHash: args.codeHash,
      sentAt: now,
      expiresAt: now + CODE_TTL_MS,
      attempts: MAX_ATTEMPTS,
    });

    return { ok: true as const, waitSeconds: 0, reason: "" };
  },
});

export const clearChallenge = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

/* ------------------------------------------------------------------ */
/* Mail a code to the signed-in user                                    */
/* ------------------------------------------------------------------ */

export const sendCode = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ sent: boolean; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { sent: false, message: "You must be signed in to do that." };
    }

    /* The user row has to be read through a query, since actions have no
       database handle of their own. */
    const user = await ctx.runQuery(api.users.currentUser, {});
    if (!user) {
      return { sent: false, message: "You must be signed in to do that." };
    }
    if (user.emailVerificationTime != null) {
      return { sent: false, message: "Your email is already verified." };
    }
    if (!user.email) {
      return { sent: false, message: "This account has no email to verify." };
    }

    const code = randomCode();
    const prepared = await ctx.runMutation(internal.verification.prepareSend, {
      userId,
      codeHash: await digestCode(code),
    });

    if (!prepared.ok) {
      return { sent: false, message: prepared.reason };
    }

    try {
      await sendOtpEmail({
        to: user.email,
        otp: code,
        subject: "Confirm your Clip Vault email",
      });
    } catch (error) {
      /* Do not leave a live code behind that was never delivered. */
      await ctx.runMutation(internal.verification.clearChallenge, { userId });
      console.error("Mail relay failed:", error);
      return {
        sent: false,
        message:
          "We couldn't reach the mail service just now. Please try again in a minute.",
      };
    }

    return { sent: true, message: `We sent a code to ${user.email}.` };
  },
});

/** The client-facing entry point for requesting a verification code. */
export const requestCode = action({
  args: {},
  handler: async (ctx): Promise<{ sent: boolean; message: string }> => {
    return await ctx.runAction(internal.verification.sendCode, {});
  },
});

/* ------------------------------------------------------------------ */
/* Check a code the creator typed in                                    */
/* ------------------------------------------------------------------ */

export const checkCode = mutation({
  args: { code: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ verified: boolean; message: string }> => {
    const user = await requireUser(ctx);

    if (user.emailVerificationTime != null) {
      return { verified: true, message: "Your email is already verified." };
    }

    const rows = await ctx.db
      .query("emailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const record = liveChallenge(rows, Date.now());

    if (!record) {
      return {
        verified: false,
        message: "Request a code first, then enter it here.",
      };
    }
    if (record.attempts <= 0) {
      await ctx.db.delete(record._id);
      return {
        verified: false,
        message: "Too many wrong tries. Request a new code.",
      };
    }

    const candidate = args.code.replace(/\D/g, "");
    if (candidate.length !== 6) {
      return { verified: false, message: "That code should be 6 digits." };
    }

    if (!safeEqual(await digestCode(candidate), record.codeHash)) {
      const left = record.attempts - 1;
      if (left <= 0) await ctx.db.delete(record._id);
      else await ctx.db.patch(record._id, { attempts: left });
      return {
        verified: false,
        message: `That code isn't right. ${left} tr${left === 1 ? "y" : "ies"} left.`,
      };
    }

    /* Verified: stamp the auth record and clear the challenge. */
    await ctx.db.patch(user._id, { emailVerificationTime: Date.now() });
    await ctx.db.delete(record._id);

    return { verified: true, message: "Email verified — welcome to Clip Vault." };
  },
});
