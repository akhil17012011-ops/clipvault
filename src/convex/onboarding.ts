import { mutation, query } from "./_generated/server";
import { requireUser } from "./access";

/**
 * The first-run tour of the console.
 *
 * A new account lands in an empty dashboard with six things to do and no idea
 * which is which. The tour walks through them once, in the order they actually
 * need doing, and the fact that it has been seen is stored on the user row —
 * not in the browser — so a new device does not greet someone who already knows
 * the product with a walkthrough they did not ask for.
 */

export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { completedAt: user.tourCompletedAt ?? null };
  },
});

/** Marks the tour as seen. Also used by "Skip". */
export const complete = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { tourCompletedAt: Date.now() });
    return true;
  },
});

/** Lets anyone replay it from the sidebar. */
export const restart = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { tourCompletedAt: undefined });
    return true;
  },
});


