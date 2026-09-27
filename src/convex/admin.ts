import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import {
  createAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./access";

/**
 * One-time provisioning of the Clip Vault operator account.
 *
 * The password is supplied by the operator at call time and is never written
 * into the repo or the browser bundle. It is handed straight to Convex Auth's
 * `createAccount`, which runs the Password provider's own hashing (Scrypt)
 * before persisting it, so the stored credential is a salted hash and the
 * plaintext only ever exists in this process's memory for the length of the
 * call.
 *
 * The action is idempotent: re-running it with the same email simply
 * re-confirms the role, so it is safe to retry.
 *
 * Run from the CLI:
 *   bunx convex run admin:bootstrapAdmin '{"email":"...","password":"..."}'
 */

const PROVIDER = "password";
const PASSWORD_MIN = 8;

type BootstrapArgs = { email: string; password: string };
type BootstrapResult = { ok: boolean; created: boolean; message: string };

export const bootstrapAdmin = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (
    ctx,
    args: BootstrapArgs,
  ): Promise<BootstrapResult> => {
    const email = args.email.trim().toLowerCase();
    const password = args.password;

    if (!email.includes("@")) {
      return { ok: false, created: false, message: "A valid email is required." };
    }
    if (password.length < PASSWORD_MIN) {
      return {
        ok: false,
        created: false,
        message: `Password must be at least ${PASSWORD_MIN} characters.`,
      };
    }

    let created = false;

    try {
      await createAccount(ctx, {
        provider: PROVIDER,
        account: { id: email, secret: password },
        profile: {
          email,
          emailVerificationTime: Date.now(),
          role: "admin",
        },
      });
      created = true;
    } catch (createError) {
      // The most common reason to land here is that the account already
      // exists. Confirm that by checking whether the user row is reachable,
      // and only then treat the failure as benign.
      const existing = await ctx.runMutation(internal.roles.setRole, {
        email,
        role: "admin",
      });
      if (existing.found) {
        return {
          ok: true,
          created: false,
          message: "Operator account already existed; role confirmed.",
        };
      }
      throw createError;
    }

    // The role is also written in the profile above; this second pass makes the
    // action safe to re-run and repairs a user created by any other provider.
    const granted = await ctx.runMutation(internal.roles.setRole, {
      email,
      role: "admin",
    });

    if (!granted.found) {
      return {
        ok: false,
        created,
        message: `No user row matched ${email}; role was not applied.`,
      };
    }

    return {
      ok: true,
      created,
      message: "Operator account created.",
    };
  },
});

/**
 * Moves a password account from one email to another in place, keeping the same
 * `users` row so every record that points at that user id — connected social
 * accounts, submissions, messages, payout settings — stays attached.
 *
 * This is deliberately an in-place rename rather than "create a new admin and
 * delete the old one": a fresh account would start as a stranger with no
 * history, and the old login would keep working until someone remembered to
 * revoke it.
 *
 * Two things happen beyond the rename itself:
 *
 *  - Every session and refresh token for the user is deleted, so a browser
 *    that was already signed in with the old credentials cannot stay signed in
 *    after the operator has deliberately moved the account. The cost is one
 *    re-login, which is the point.
 *  - The `admin` role is re-asserted afterwards, so a role that was somehow
 *    missing cannot leave the operator locked out of their own console.
 *
 * The password itself is not touched here — see {@link rotateAdminCredentials},
 * which re-hashes it through Convex Auth before this runs.
 */
export const renameAccount = internalMutation({
  args: {
    fromEmail: v.string(),
    toEmail: v.string(),
  },
  handler: async (
    ctx,
    args: { fromEmail: string; toEmail: string },
  ): Promise<{ ok: boolean; userId: string | null; sessionsRevoked: number }> => {
    const from = args.fromEmail.trim().toLowerCase();
    const to = args.toEmail.trim().toLowerCase();

    if (!to.includes("@")) {
      throw new Error("The new address is not a valid email.");
    }
    if (from === to) {
      throw new Error("The new address is the same as the old one.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", from))
      .unique();

    if (!user) throw new Error(`No user row matched ${from}.`);

    /* Refuse to collide with an address that is already registered: two rows
       sharing an email would make sign-in resolve to whichever one the index
       happened to return first. */
    const clash = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", to))
      .unique();
    if (clash) throw new Error(`${to} already belongs to another account.`);

    /* `providerAccountId` is the address the password provider signs in
       against, so this is the field that actually makes the old email stop
       working — not the display email on the user row. */
    const passwordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "password"),
      )
      .unique();

    if (!passwordAccount) {
      throw new Error(`${from} has no password account to rename.`);
    }

    await ctx.db.patch(passwordAccount._id, { providerAccountId: to });
    await ctx.db.patch(user._id, { email: to, role: "admin" });

    /* Sessions and their refresh tokens are separate tables; the tokens are
       keyed by session id, so the sessions have to be collected first. */
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();

    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    return {
      ok: true,
      userId: user._id,
      sessionsRevoked: sessions.length,
    };
  },
});

/**
 * One-time rotation of the operator's sign-in credentials — new email *and*
 * new password on the same account.
 *
 * The password is written with Convex Auth's own `modifyAccountCredentials`,
 * so it is salted and hashed by the same Scrypt path a normal sign-up uses.
 * The plaintext is passed in by the operator at call time and is never written
 * into the repo, the database, or the browser bundle; it exists only for the
 * length of this call.
 *
 * Run from the CLI:
 *   bunx convex run admin:rotateAdminCredentials \
 *     '{"fromEmail":"...","toEmail":"...","password":"..."}'
 *
 * Order matters: the secret is re-hashed first (keyed on the *old* address,
 * which is how the account is still identified at that point), then the
 * account is renamed. Doing it the other way round would fail to find the
 * account and leave the password unchanged.
 */
export const rotateAdminCredentials = internalAction({
  args: {
    fromEmail: v.string(),
    toEmail: v.string(),
    password: v.string(),
  },
  handler: async (
    ctx,
    args: { fromEmail: string; toEmail: string; password: string },
  ): Promise<{ ok: boolean; message: string }> => {
    const from = args.fromEmail.trim().toLowerCase();
    const to = args.toEmail.trim().toLowerCase();

    if (args.password.length < 8) {
      return { ok: false, message: "Password must be at least 8 characters." };
    }
    if (!to.includes("@")) {
      return { ok: false, message: "The new address is not a valid email." };
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: from, secret: args.password },
    });

    const renamed = await ctx.runMutation(internal.admin.renameAccount, {
      fromEmail: from,
      toEmail: to,
    });

    /* Belt and braces: the rename already sets the role, but re-asserting it
       through the shared helper means this action cannot finish with the
       operator holding no admin rights even if that patch is ever changed. */
    const granted = await ctx.runMutation(internal.roles.setRole, {
      email: to,
      role: "admin",
    });
    if (!granted.found) {
      return {
        ok: false,
        message: "Credentials rotated, but the admin role could not be confirmed.",
      };
    }

    return {
      ok: true,
      message: `Rotated to ${to}. ${renamed.sessionsRevoked} existing session(s) revoked; sign in again with the new credentials.`,
    };
  },
});

/**
 * Every user on the platform, with the accounts they connected, what their
 * clips have earned, and what is actually in their wallet right now. Admin
 * only.
 *
 * The balance is read from the wallet rather than recomputed from clips,
 * because the wallet is what a payout request is checked against. Recomputing
 * here would be a second definition of "earned", and two definitions drift.
 */
export const users = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const userRows = await ctx.db.query("users").collect();
    const accountRows = await ctx.db.query("connectedAccounts").collect();
    const submissionRows = await ctx.db.query("submissions").collect();
    const campaignRows = await ctx.db.query("campaigns").collect();
    const walletRows = await ctx.db.query("wallets").collect();

    const campaigns = new Map(
      campaignRows.map((c) => [
        c._id,
        { minViews: c.minViews, ratePer1k: c.ratePer1k },
      ]),
    );

    const walletByUser = new Map(
      walletRows.map((wallet) => [wallet.userId, wallet]),
    );

    const accountsByUser = new Map<string, typeof accountRows>();
    for (const account of accountRows) {
      const list = accountsByUser.get(account.userId) ?? [];
      list.push(account);
      accountsByUser.set(account.userId, list);
    }

    return userRows
      .map((user) => {
        const mine = submissionRows.filter((s) => s.userId === user._id);
        let views = 0;
        let earned = 0;
        for (const submission of mine) {
          views += submission.views;
          const campaign = campaigns.get(submission.campaignId);
          if (!campaign) continue;
          if (submission.status === "rejected") continue;
          if (submission.views < campaign.minViews) continue;
          earned += (submission.views / 1000) * campaign.ratePer1k;
        }

        const wallet = walletByUser.get(user._id);

        return {
          userId: user._id,
          name: user.name ?? user.email?.split("@")[0] ?? "Creator",
          email: user.email ?? "",
          image: user.image ?? null,
          role: user.role ?? "user",
          joined: user._creationTime,
          accounts: (accountsByUser.get(user._id) ?? []).map((account) => ({
            id: account._id,
            platform: account.platform,
            handle: account.handle,
            status: account.status,
            followers: account.followers ?? null,
            posts: account.posts ?? null,
            connectedAt: account.connectedAt ?? null,
          })),
          clips: mine.length,
          views,
          earned,
          availableCents: wallet?.availableCents ?? 0,
          pendingCents: wallet?.pendingCents ?? 0,
        };
      })
      .sort((a, b) => b.joined - a.joined);
  },
});
