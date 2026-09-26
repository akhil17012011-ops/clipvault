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
 * Lets a creator set the display name and picture shown across CLIPTIC.
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
 * Where the creator wants to be paid, in crypto.
 *
 * The address is validated for shape only. Sending to a wrong address is
 * irreversible, so the wording tells the creator to check it rather than
 * implying we verified that the wallet is theirs.
 */
export const updatePayout = mutation({
  args: {
    currency: v.optional(v.union(v.literal("sol"), v.literal("ltc"))),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in to do that.");

    if (args.address === undefined && args.currency === undefined) {
      return await ctx.db.get(userId);
    }

    const patch: {
      payoutAddress?: string;
      payoutCurrency?: "sol" | "ltc";
    } = {};

    if (args.currency !== undefined) {
      patch.payoutCurrency = args.currency;
    }

    if (args.address !== undefined) {
      const address = args.address.trim();
      if (address) {
        if (address.length > 120) throw new Error("That address is too long.");
        // Base58 (Solana) and bech32 (Litecoin) are both mixed case, so case is
        // meaningful here and must survive untouched.
        if (!/^[1-9A-HJ-NP-Za-km-z]{26,120}$/.test(address)) {
          throw new Error("That doesn't look like a Solana or Litecoin address.");
        }
        patch.payoutAddress = address;
      } else {
        patch.payoutAddress = undefined;
      }
    }

    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});
