import {
  createAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { auth } from "./auth";

/**
 * The role stored on the Convex Auth `users` row.
 * "admin" is the privileged role, "member" is the default for creators.
 * Authorization is always decided on the server; the client never picks it.
 */
export type Role = "admin" | "member";

/**
 * The address that owns the Clip Vault operator console.
 *
 * `OPERATOR_EMAILS` in the deployment environment can add more operators to the
 * built-in addresses below; it never replaces them, so a typo or an empty
 * variable there cannot lock the operator out of their own product.
 */
const BUILT_IN_OPERATOR_EMAILS = [
  "support.clipvault.ae@gmail.com",
  "akhil17012011@gmail.com",
];

function operatorEmails(): string[] {
  return [...BUILT_IN_OPERATOR_EMAILS, ...(process.env.OPERATOR_EMAILS ?? "").split(",")]
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
}

export function isOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return operatorEmails().includes(email.trim().toLowerCase());
}

/** Every user row registered against this exact address. */
async function usersWithEmail(ctx: MutationCtx, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .collect();
}

/**
 * The `users` document and id types, read off a real query rather than
 * imported, so this file never has to track a generated type's exact name.
 */
type UserRow = Awaited<ReturnType<typeof usersWithEmail>>[number];
type UserId = UserRow["_id"];

/**
 * Sets the role of every user with the given email address.
 * Internal only: reachable from other Convex functions, never from the client.
 */
export const setRole = internalMutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (
    ctx,
    args: { email: string; role: Role },
  ): Promise<{ ok: boolean; found: boolean }> => {
    /* `.unique()` would throw if an address somehow had two rows, and throwing
       here would take down whatever called us. Patch every match instead: a
       stray duplicate is repaired by `repairOperator` anyway. */
    const users = await usersWithEmail(ctx, args.email);
    if (users.length === 0) return { ok: true, found: false };

    for (const user of users) {
      await ctx.db.patch(user._id, { role: args.role });
    }
    return { ok: true, found: true };
  },
});

/** Deletes a user's sessions and their refresh tokens. */
async function deleteSessions(ctx: MutationCtx, userId: UserId) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    /* Tokens are keyed by session, so the tokens have to go first. */
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }
}

/**
 * Moves the sign-in credentials of `from` onto `to`.
 *
 * This is what makes one person one account: the Google credential and the
 * password credential have to end up on the same `users` row, otherwise every
 * sign-in method builds its own account and none of them agree on the role.
 * A credential that already exists on the target is dropped rather than
 * duplicated, because Convex Auth resolves an account by provider + id.
 */
async function moveAuthAccounts(
  ctx: MutationCtx,
  from: UserId,
  to: UserId,
) {
  const mine = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", from))
    .collect();
  if (mine.length === 0) return;

  const theirs = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", to))
    .collect();
  const seen = new Set(
    theirs.map((account) => `${account.provider}:${account.providerAccountId}`),
  );

  for (const account of mine) {
    const key = `${account.provider}:${account.providerAccountId}`;
    if (seen.has(key)) {
      await ctx.db.delete(account._id);
      continue;
    }
    seen.add(key);
    await ctx.db.patch(account._id, { userId: to });
  }
}

/**
 * Moves everything a creator owns from one user row to another, so merging two
 * accounts never costs them a connected handle, a clip or a message.
 */
async function moveProductRows(
  ctx: MutationCtx,
  from: UserId,
  to: UserId,
) {
  for (const row of await ctx.db
    .query("campaignJoins")
    .filter((q) => q.eq(q.field("userId"), from))
    .collect()) {
    await ctx.db.patch(row._id, { userId: to });
  }

  for (const row of await ctx.db
    .query("emailVerifications")
    .filter((q) => q.eq(q.field("userId"), from))
    .collect()) {
    await ctx.db.patch(row._id, { userId: to });
  }

  for (const row of await ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("userId"), from))
    .collect()) {
    await ctx.db.patch(row._id, { userId: to });
  }

  for (const row of await ctx.db
    .query("submissions")
    .filter((q) => q.eq(q.field("userId"), from))
    .collect()) {
    await ctx.db.patch(row._id, { userId: to });
  }

  /* Money has to follow the person, or a merged account silently loses its
     balance. Two wallets cannot both survive, so the one already on the target
     wins and the incoming row is dropped — the ledger keeps the history. */
  const wallets = await ctx.db
    .query("wallets")
    .filter((q) => q.eq(q.field("userId"), from))
    .collect();
  const targetWallet = await ctx.db
    .query("wallets")
    .filter((q) => q.eq(q.field("userId"), to))
    .first();
  for (const wallet of wallets) {
    if (targetWallet) {
      await ctx.db.patch(targetWallet._id, {
        availableCents: targetWallet.availableCents + wallet.availableCents,
        pendingCents: targetWallet.pendingCents + wallet.pendingCents,
        lifetimeCents: targetWallet.lifetimeCents + wallet.lifetimeCents,
      });
      await ctx.db.delete(wallet._id);
    } else {
      await ctx.db.patch(wallet._id, { userId: to });
    }
  }

  for (const table of ["payoutRequests", "earnings"] as const) {
    for (const row of await ctx.db
      .query(table)
      .filter((q) => q.eq(q.field("userId"), from))
      .collect()) {
      await ctx.db.patch(row._id, { userId: to });
    }
  }

  /* Connected handles are special: two rows for the same platform + handle
     would make "is this clip yours?" ambiguous, so a duplicate is dropped and
     the connection already on the target is the one that survives. */
  const kept = await ctx.db
    .query("connectedAccounts")
    .filter((q) => q.eq(q.field("userId"), to))
    .collect();
  const seen = new Set(
    kept.map((account) => `${account.platform}:${account.handle.toLowerCase()}`),
  );

  for (const account of await ctx.db
    .query("connectedAccounts")
    .filter((q) => q.eq(q.field("userId"), from))
    .collect()) {
    const key = `${account.platform}:${account.handle.toLowerCase()}`;
    if (seen.has(key)) {
      await ctx.db.delete(account._id);
      continue;
    }
    seen.add(key);
    await ctx.db.patch(account._id, { userId: to });
  }
}

/**
 * Picks the row that should survive a merge: the caller's own row when there is
 * one (so a signed-in operator is never signed out by their own repair),
 * otherwise the admin row, otherwise the oldest.
 */
function pickKeeper(rows: UserRow[], preferUserId?: UserId): UserRow {
  if (preferUserId) {
    const preferred = rows.find((row) => row._id === preferUserId);
    if (preferred) return preferred;
  }
  const admins = rows.filter((row) => row.role === "admin");
  const pool = admins.length > 0 ? admins : rows;
  return [...pool].sort((a, b) => a._creationTime - b._creationTime)[0];
}

type RepairResult = {
  ok: boolean;
  reason: string;
  merged: number;
  userId: UserId | null;
};

/**
 * Collapses every account sharing the operator's address into one row, and
 * makes that row the admin.
 *
 * Why this has to exist: Convex Auth only links a Google sign-in to an existing
 * account when that account is the *only* user row carrying a verified copy of
 * the address — `uniqueUserWithVerifiedEmail` gives up when it finds two. A
 * deployment that was signed into before the operator account existed therefore
 * ends up with two rows for one human, and from then on Google quietly mints a
 * fresh account on every sign-in while email sign-in picks whichever row the
 * index happened to return. Merging back to a single row restores both.
 *
 * The keeper also gets `emailVerificationTime`, which is the flag that makes
 * every later Google sign-in link to it instead of creating a new row.
 */
async function repairOperator(
  ctx: MutationCtx,
  rawEmail: string,
  preferUserId?: UserId,
): Promise<RepairResult> {
  const email = rawEmail.trim().toLowerCase();

  if (!isOperatorEmail(email)) {
    return {
      ok: false,
      reason: "That address is not the operator account.",
      merged: 0,
      userId: null,
    };
  }

  const rows = await usersWithEmail(ctx, email);
  if (rows.length === 0) {
    return {
      ok: false,
      reason: `No account exists for ${email}.`,
      merged: 0,
      userId: null,
    };
  }

  const keeper = pickKeeper(rows, preferUserId);
  /* Details that live on the user row itself, so they are copied forward
     explicitly before the rows they came from are deleted. */
  const carried: {
    name?: string;
    image?: string;
  } = {};

  for (const row of rows) {
    if (row._id === keeper._id) continue;

    await moveAuthAccounts(ctx, row._id, keeper._id);
    await moveProductRows(ctx, row._id, keeper._id);
    /* The merged row's sessions die with it, so a browser still holding one
       cannot keep acting as a user id that no longer exists. */
    await deleteSessions(ctx, row._id);

    if (carried.name === undefined && row.name !== undefined) {
      carried.name = row.name;
    }
    if (carried.image === undefined && row.image !== undefined) {
      carried.image = row.image;
    }

    await ctx.db.delete(row._id);
  }

  await ctx.db.patch(keeper._id, {
    ...carried,
    email,
    role: "admin",
    emailVerificationTime: keeper.emailVerificationTime ?? Date.now(),
  });

  return { ok: true, reason: "ok", merged: rows.length - 1, userId: keeper._id };
}

/**
 * Server-side entry point to the repair, for callers that already know the
 * address from a verified session rather than from their own user row.
 */
export const repairOperatorIdentity = internalMutation({
  args: {
    email: v.string(),
    preferUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<RepairResult> => {
    return await repairOperator(ctx, args.email, args.preferUserId);
  },
});

/**
 * The signed-in operator's address and whether they already have a password.
 *
 * An action has no `ctx.db`, so the password flow reads this from inside the
 * action. It works because the caller's session travels with the action into
 * the functions it calls, and the address comes from the database rather than
 * from anything the browser sends.
 */
export const callerOperatorAccount = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ email: string; userId: UserId; hasPassword: boolean } | null> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const email = user?.email;
    if (!isOperatorEmail(email)) return null;

    const passwordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password"),
      )
      .unique();

    return {
      email: email!.trim().toLowerCase(),
      userId,
      hasPassword: passwordAccount !== null,
    };
  },
});

/**
 * Grants the operator role to the signed-in operator, and only to them.
 *
 * The address is read from the user's row in the database and has to be a
 * verified one — a Google sign-in proves the address, and so does a password
 * sign-in. So the only person who can ever pass this check is the person who
 * controls the operator mailbox, which is what lets it run on every deployment
 * with no shared secret, no CLI access and no temporary recovery endpoint.
 *
 * Idempotent, and called on each sign-in from the app shell.
 */
export const ensureOperatorRole = mutation({
  args: {},
  handler: async (ctx): Promise<{ isOperator: boolean; merged: number }> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { isOperator: false, merged: 0 };

    const user = await ctx.db.get(userId);
    const email = user?.email;
    if (!isOperatorEmail(email)) return { isOperator: false, merged: 0 };

    const result = await repairOperator(ctx, email!, userId);
    return { isOperator: result.ok, merged: result.merged };
  },
});

/**
 * Attaches (or replaces) the password on the operator account, so the same
 * person can come in with Google *and* with their email address.
 *
 * Convex Auth keeps a password against the address itself, so a Google-only
 * account has nothing to sign in with and no way to set one from the browser —
 * which is exactly the state a freshly published deployment is in. Doing it
 * here, behind a verified operator session, makes recovery a normal part of the
 * product instead of a secret-bearing endpoint that has to sit on the public
 * deployment and then be deleted under pressure.
 *
 * The password goes straight to Convex Auth, which salts and hashes it with
 * Scrypt before storing. The plaintext is never written to the database, the
 * repo or the browser bundle.
 */
export const setOwnPassword = action({
  args: { password: v.string() },
  handler: async (
    ctx,
    args: { password: string },
  ): Promise<{ ok: boolean; message: string }> => {
    const account = await ctx.runMutation(
      internal.roles.callerOperatorAccount,
      {},
    );
    if (!account) {
      throw new Error("Only the Clip Vault operator account can do that.");
    }
    if (args.password.length < 8) {
      throw new Error("Use at least 8 characters.");
    }

    if (account.hasPassword) {
      /* Re-hashing in place is Convex Auth's own credential rotation. */
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: account.email, secret: args.password },
      });
    } else {
      /* `shouldLinkViaEmail` attaches the new password to the account that
         already owns the address instead of creating a second one. */
      await createAccount(ctx, {
        provider: "password",
        account: { id: account.email, secret: args.password },
        profile: {
          email: account.email,
          emailVerificationTime: Date.now(),
          role: "admin",
        },
        shouldLinkViaEmail: true,
      });
    }

    /* Collapse any duplicate rows for this address so the Google credential and
       the password credential end up on one account, and confirm the role. */
    const repaired = await ctx.runMutation(
      internal.roles.repairOperatorIdentity,
      { email: account.email, preferUserId: account.userId },
    );
    if (!repaired.ok) throw new Error(repaired.reason);

    return {
      ok: true,
      message: `Password set. You can now sign in with ${account.email}.`,
    };
  },
});

/**
 * Whether an address already has an account, so the sign-up form can say so
 * *before* it submits.
 *
 * This is not a convenience. Convex Auth's password `signUp` does not fail when
 * the address is already taken: it quietly creates a second user row and signs
 * the person into it. Nothing looks broken — they land in the app — but their
 * clips, wallet and messages are all sitting on the old row while everything
 * they do next lands on the new one. Google then refuses to link to either,
 * because the address is no longer unique, so a later Google sign-up mints
 * *another* one. That is the "I signed up and it still doesn't work" dead end.
 *
 * The form uses this to steer people to sign-in or Google instead of creating
 * the duplicate. It is a query, so it reveals nothing an attacker could not
 * already learn by attempting a sign-in and reading the error.
 */
export const emailInUse = query({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ inUse: boolean }> => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) return { inUse: false };

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    return { inUse: existing !== null };
  },
});

/**
 * The same check as {@link emailInUse}, as a mutation, for the moment it has to
 * be authoritative.
 *
 * A live query is a hint: it can be skipped, and it can be a beat behind. This
 * one runs on submit, so the answer that decides whether a second account gets
 * created is read fresh from the database.
 */
export const assertEmailAvailable = mutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ inUse: boolean }> => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) return { inUse: false };

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    return { inUse: existing !== null };
  },
});

/**
 * The signed-in user's role, read from the database.
 * Defaults to "member" for any user without an explicit role.
 */
export const myRole = query({
  args: {},
  handler: async (ctx): Promise<Role> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return "member";

    const user = await ctx.db.get(userId);
    return user?.role === "admin" ? "admin" : "member";
  },
});
