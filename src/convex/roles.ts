import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { auth } from "./auth";

/**
 * The role stored on the Convex Auth `users` row.
 * "admin" is the privileged role, "member" is the default for creators.
 * Authorization is always decided on the server; the client never picks it.
 */
export type Role = "admin" | "member";

/**
 * Sets the role of the user with the given email address.
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
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      return { ok: true, found: false };
    }

    await ctx.db.patch(user._id, { role: args.role });
    return { ok: true, found: true };
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
