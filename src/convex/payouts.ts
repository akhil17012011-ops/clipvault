import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./access";
import {
  MIN_WITHDRAWAL_USD,
  payoutMethodValidator,
  usdtNetworkValidator,
} from "./schema";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

/**
 * Creator wallets and payout requests.
 *
 * The money has exactly one lifecycle, and it is enforced here rather than in
 * the UI:
 *
 *   clip approved  ->  earnings row  ->  wallet.available
 *   request payout ->  wallet.pending, request.status = "pending"
 *   admin pays     ->  pending cleared, request.status = "paid"
 *   admin rejects  ->  money back to available, request.status = "rejected"
 *
 * Two rules make this safe to run from a browser:
 *  - a creator can only ever touch their own wallet, and
 *  - an amount only moves when a ledger row says why, so the balance can always
 *    be explained rather than being a number nobody can account for.
 *
 * All amounts are whole US cents. See the `wallets` table in the schema for
 * why that matters.
 */

/** Dollars a creator needs cleared before they can request a payout. */
const MIN_CENTS = MIN_WITHDRAWAL_USD * 100;

/** Guards against a fat-fingered request for an absurd balance. */
const MAX_CENTS = 100_000_00;

type Ctx = QueryCtx | MutationCtx;
/* The users table's id type, taken from a real read so it cannot drift. */
type UserId = Awaited<ReturnType<typeof requireUser>>["_id"];

/* ------------------------------------------------------------------ */
/* Address validation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Checks the shape of a destination address for the chosen method.
 *
 * This is deliberately shape only. It cannot prove the address belongs to the
 * creator, and a crypto send is irreversible, so the UI says so too rather than
 * claiming the address was verified.
 */
export function checkAddress(
  method: "sol" | "ltc" | "btc" | "usdt",
  network: "trc20" | "erc20" | "bep20" | undefined,
  address: string,
): string | null {
  switch (method) {
    case "sol":
      /* Base58, 32-44 characters. Case is meaningful, so it is not folded. */
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
        ? null
        : "That doesn't look like a Solana address — 32–44 base58 characters, starting with 1, 3 or 4.";
    case "ltc":
      return /^(ltc1[0-9ac-hj-np-z]{25,62}|[LM3][0-9A-HJ-NP-Za-km-z]{25,34})$/i.test(
        address,
      )
        ? null
        : "That doesn't look like a Litecoin address — it starts with ltc1, L or M.";
    case "btc":
      return /^(bc1[0-9ac-hj-np-z]{25,62}|[13][0-9A-HJ-NP-Za-km-z]{25,34})$/i.test(
        address,
      )
        ? null
        : "That doesn't look like a Bitcoin address — it starts with bc1, 1 or 3.";
    case "usdt": {
      if (!network) return "Pick a network for USDT.";
      if (network === "trc20") {
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
          ? null
          : "A TRC20 address is a T followed by 33 base58 characters.";
      }
      return /^0x[0-9a-fA-F]{40}$/.test(address)
        ? null
        : "That doesn't look like an EVM address — 0x followed by 40 hex characters.";
    }
  }
}

function checkAmountCents(cents: number): string | null {
  if (!Number.isInteger(cents)) {
    return "That amount isn't a whole number of cents.";
  }
  if (cents < MIN_CENTS) {
    return `The minimum withdrawal is $${MIN_WITHDRAWAL_USD}.`;
  }
  if (cents > MAX_CENTS) {
    return "Ask support about balances above $100,000.";
  }
  return null;
}

/** The creator's wallet row, or null when they have never earned anything. */
async function readWallet(ctx: Ctx, userId: UserId) {
  return await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * The signed-in creator's wallet.
 *
 * Always returns numbers, even before the creator has earned anything, so the
 * payments page never has to render a blank balance.
 */
export const myWallet = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const wallet = await readWallet(ctx, user._id);
    return {
      availableCents: wallet?.availableCents ?? 0,
      pendingCents: wallet?.pendingCents ?? 0,
      lifetimeCents: wallet?.lifetimeCents ?? 0,
      minWithdrawalCents: MIN_CENTS,
    };
  },
});

/** Every payout request the signed-in creator has made, newest first. */
export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("payoutRequests")
      .withIndex("by_user_requested", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .map((row) => ({
        id: row._id,
        amountCents: row.amountCents,
        method: row.method,
        network: row.network ?? null,
        address: row.address,
        status: row.status,
        requestedAt: row.requestedAt,
        decidedAt: row.decidedAt ?? null,
        reference: row.reference ?? null,
        reason: row.reason ?? null,
      }));
  },
});

/** The creator's ledger, newest first: what was earned and what was taken out. */
export const myEarnings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("earnings")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
      .map((row) => ({
        id: row._id,
        amountCents: row.amountCents,
        reason: row.reason,
        campaignId: row.campaignId ?? null,
        createdAt: row.createdAt,
      }));
  },
});

/** Every payout request on the platform, waiting ones first. Admin only. */
export const allRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("payoutRequests").collect();
    const ids = [...new Set(rows.map((r) => r.userId))];
    const users = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const byId = new Map(
      users.filter(Boolean).map((u) => [u!._id, u!]),
    );
    return rows
      .sort((a, b) => {
        /* Anything still waiting for an operator comes first. */
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return b.requestedAt - a.requestedAt;
      })
      .map((row) => ({
        id: row._id,
        userId: row.userId,
        creatorName:
          row.creatorName ||
          byId.get(row.userId)?.name ||
          byId.get(row.userId)?.email?.split("@")[0] ||
          "Creator",
        creatorEmail: byId.get(row.userId)?.email ?? null,
        amountCents: row.amountCents,
        method: row.method,
        network: row.network ?? null,
        address: row.address,
        status: row.status,
        requestedAt: row.requestedAt,
        decidedAt: row.decidedAt ?? null,
        reference: row.reference ?? null,
        reason: row.reason ?? null,
      }));
  },
});

/* ------------------------------------------------------------------ */
/* Creator writes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ask to be paid.
 *
 * The address is taken here, at request time, instead of being saved to the
 * profile up front. That is the point of the flow: one request, one
 * destination, one decision.
 */
export const requestPayout = mutation({
  args: {
    amountCents: v.number(),
    method: payoutMethodValidator,
    network: v.optional(usdtNetworkValidator),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const amountError = checkAmountCents(args.amountCents);
    if (amountError) throw new Error(amountError);

    const address = args.address.trim();
    if (address.length > 120) throw new Error("That address is too long.");
    const addressError = checkAddress(args.method, args.network, address);
    if (addressError) throw new Error(addressError);
    if (args.method !== "usdt" && args.network) {
      throw new Error("Only USDT payouts need a network.");
    }

    /* One request at a time. A second live request would be asking for money
       that is already locked in the first one. */
    const live = await ctx.db
      .query("payoutRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    if (live) {
      throw new Error(
        "You already have a payout waiting to be processed. We'll message you the moment it's actioned.",
      );
    }

    const wallet = await readWallet(ctx, user._id);
    const available = wallet?.availableCents ?? 0;
    if (available < MIN_CENTS) {
      throw new Error(
        `You need at least $${MIN_WITHDRAWAL_USD} in your balance before you can request a payout.`,
      );
    }
    if (args.amountCents > available) {
      throw new Error("That's more than your available balance.");
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("payoutRequests", {
      userId: user._id,
      creatorName: user.name ?? user.email?.split("@")[0] ?? "Creator",
      amountCents: args.amountCents,
      method: args.method,
      network: args.method === "usdt" ? args.network : undefined,
      address,
      status: "pending",
      requestedAt: now,
    });

    /* Move the money into pending, and write down that we did. */
    const remaining = available - args.amountCents;
    if (wallet) {
      await ctx.db.patch(wallet._id, {
        availableCents: remaining,
        pendingCents: wallet.pendingCents + args.amountCents,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("wallets", {
        userId: user._id,
        availableCents: remaining,
        pendingCents: args.amountCents,
        lifetimeCents: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("earnings", {
      userId: user._id,
      amountCents: -args.amountCents,
      reason: `Payout requested to ${args.method.toUpperCase()} ${address.slice(0, 6)}…${address.slice(-4)}`,
      createdAt: now,
    });

    return { id: requestId, availableCents: remaining };
  },
});

/* ------------------------------------------------------------------ */
/* Admin writes                                                        */
/* ------------------------------------------------------------------ */

/**
 * Mark a request as paid.
 *
 * The operator has sent the money; this records it, clears the pending balance
 * and tells the creator in their inbox. It only ever runs against a pending
 * request, so a double click cannot pay the same request twice.
 */
export const markPaid = mutation({
  args: {
    requestId: v.id("payoutRequests"),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("That payout request no longer exists.");
    if (request.status !== "pending") {
      throw new Error("That payout has already been actioned.");
    }

    const now = Date.now();
    const reference = args.reference?.trim() || undefined;
    await ctx.db.patch(args.requestId, {
      status: "paid",
      decidedAt: now,
      reference,
    });

    const wallet = await readWallet(ctx, request.userId);
    if (wallet) {
      /* Never let pending go negative, even if a row was edited by hand. */
      await ctx.db.patch(wallet._id, {
        pendingCents: Math.max(0, wallet.pendingCents - request.amountCents),
        updatedAt: now,
      });
    }

    await ctx.runMutation(internal.messages.notify, {
      userId: request.userId,
      title: "Your payout has been sent",
      body: [
        `We paid $${(request.amountCents / 100).toFixed(2)} to your ${request.method.toUpperCase()} address.`,
        reference ? `Transaction: ${reference}` : null,
      ]
        .filter(Boolean)
        .join(" "),
      link: "/dashboard/payments",
    });

    return true;
  },
});

/**
 * Reject a payout request.
 *
 * A reason is mandatory. The money goes straight back to the creator's
 * available balance and the reason is delivered to their inbox, because a
 * rejected payout with no explanation is indistinguishable from a platform that
 * is ignoring them.
 */
export const markRejected = mutation({
  args: {
    requestId: v.id("payoutRequests"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("That payout request no longer exists.");
    if (request.status !== "pending") {
      throw new Error("That payout has already been actioned.");
    }

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("Give a reason — the creator sees it in their messages.");
    }
    if (reason.length > 1000) {
      throw new Error("Keep the reason under 1,000 characters.");
    }

    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: "rejected",
      decidedAt: now,
      reason,
    });

    const wallet = await readWallet(ctx, request.userId);
    if (wallet) {
      /* Only give back what is actually still locked, so a hand-edited wallet
         can never mint money. */
      const released = Math.min(wallet.pendingCents, request.amountCents);
      await ctx.db.patch(wallet._id, {
        availableCents: wallet.availableCents + released,
        pendingCents: wallet.pendingCents - released,
        updatedAt: now,
      });
      if (released > 0) {
        await ctx.db.insert("earnings", {
          userId: request.userId,
          amountCents: released,
          reason: "Payout request returned to your balance",
          createdAt: now,
        });
      }
    }

    await ctx.runMutation(internal.messages.notify, {
      userId: request.userId,
      title: "Your payout request needs a change",
      body: `${reason} — $${(request.amountCents / 100).toFixed(2)} is back in your available balance.`,
      link: "/dashboard/payments",
    });

    return true;
  },
});

/* ------------------------------------------------------------------ */
/* Crediting earnings                                                  */
/* ------------------------------------------------------------------ */

/**
 * Credit a creator for a clip that has just been approved.
 *
 * Called from clip review rather than from the client, and safe to call twice:
 * if this clip has already paid out, it does nothing.
 */
export const creditEarnings = internalMutation({
  args: {
    userId: v.id("users"),
    submissionId: v.optional(v.id("submissions")),
    campaignId: v.optional(v.id("campaigns")),
    amountCents: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.submissionId) {
      const already = await ctx.db
        .query("earnings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("submissionId"), args.submissionId))
        .first();
      if (already) return false;
    }

    const now = Date.now();
    const wallet = await readWallet(ctx, args.userId);
    if (wallet) {
      await ctx.db.patch(wallet._id, {
        availableCents: wallet.availableCents + args.amountCents,
        lifetimeCents: wallet.lifetimeCents + args.amountCents,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("wallets", {
        userId: args.userId,
        availableCents: args.amountCents,
        pendingCents: 0,
        lifetimeCents: args.amountCents,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("earnings", {
      userId: args.userId,
      submissionId: args.submissionId,
      campaignId: args.campaignId,
      amountCents: args.amountCents,
      reason: args.reason,
      createdAt: now,
    });

    return true;
  },
});

/**
 * Add the difference when a measured view count turns out higher than the count
 * a clip was approved on.
 *
 * Only ever pays upwards. Clawing money back after a creator has seen it, or
 * after part of it is already locked in a payout request, is a decision for a
 * human — a correction should never silently reduce a balance someone is
 * about to withdraw.
 */
export const creditTopUp = internalMutation({
  args: {
    userId: v.id("users"),
    campaignId: v.optional(v.id("campaigns")),
    amountCents: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.amountCents <= 0) return false;

    const now = Date.now();
    const wallet = await readWallet(ctx, args.userId);
    if (wallet) {
      await ctx.db.patch(wallet._id, {
        availableCents: wallet.availableCents + args.amountCents,
        lifetimeCents: wallet.lifetimeCents + args.amountCents,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("wallets", {
        userId: args.userId,
        availableCents: args.amountCents,
        pendingCents: 0,
        lifetimeCents: args.amountCents,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("earnings", {
      userId: args.userId,
      campaignId: args.campaignId,
      amountCents: args.amountCents,
      reason: args.reason,
      createdAt: now,
    });

    return true;
  },
});
