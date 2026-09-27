import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Lets a creator set the display name and picture shown across Clip Vault.
 *
 * The sign-up record is the starting point, not the last word — a creator
 * publishing under a brand name should not be stuck with the handle their
 * email happened to create. An empty string clears a field.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in to do that.");

    const patch: { name?: string; image?: string } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length > 60) {
        throw new Error("Keep your display name under 60 characters.");
      }
      patch.name = name || undefined;
    }

    if (args.image !== undefined) {
      const image = args.image.trim();
      if (image) {
        if (image.length > 2000) {
          throw new Error("That image link is too long.");
        }
        let url: URL;
        try {
          url = new URL(image);
        } catch {
          throw new Error("That doesn't look like a valid image link.");
        }
        // Only https, so a stored picture can never be fetched over plaintext
        // or point the browser at a javascript: payload.
        if (url.protocol !== "https:") {
          throw new Error("Picture links have to start with https://");
        }
        patch.image = url.toString();
      } else {
        patch.image = undefined;
      }
    }

    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

/**
 * There is deliberately no saved payout wallet here.
 *
 * A creator chooses the currency, the network and the address on the payout
 * request itself, so a wallet added months ago can never silently receive money
 * after they have rotated their keys, and they are never locked into a network
 * they signed up with. See `payouts.requestPayout`.
 */
