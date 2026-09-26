import type { MutationCtx, QueryCtx } from "./_generated/server";
import { auth } from "./auth";

/**
 * Every privileged operation goes through these helpers. The client's role is
 * never trusted: the role is read from the user's row in the database on every
 * single call.
 */

type Ctx = QueryCtx | MutationCtx;

export class NotSignedInError extends Error {
  constructor() {
    super("You must be signed in to do that.");
  }
}

export class NotAllowedError extends Error {
  constructor(message = "You do not have access to that.") {
    super(message);
  }
}

async function userRow(ctx: Ctx) {
  const userId = await auth.getUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof userRow>>>;

/** The signed-in user row, or null. */
export async function getCurrentUser(ctx: Ctx): Promise<CurrentUser | null> {
  return await userRow(ctx);
}

/** The signed-in user row, or a thrown error. */
export async function requireUser(ctx: Ctx): Promise<CurrentUser> {
  const user = await userRow(ctx);
  if (!user) throw new NotSignedInError();
  return user;
}

/** The signed-in user row, or a thrown error unless they are an admin. */
export async function requireAdmin(ctx: Ctx): Promise<CurrentUser> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new NotAllowedError("This action is restricted to Clip Vault staff.");
  }
  return user;
}
