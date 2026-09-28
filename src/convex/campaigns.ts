import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { NotAllowedError, requireAdmin, requireUser } from "./access";

/**
 * Campaigns, joined campaigns, and the admin-side campaign controls.
 *
 * Visibility rules:
 *  - any signed-in user can read campaigns
 *  - joining and leaving is tracked per user
 *  - creating, editing, pausing and invoicing are admin-only
 */

const PLATFORM = v.union(
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("x"),
);

const ASSET = v.object({
  label: v.string(),
  url: v.string(),
  kind: v.union(v.literal("drive"), v.literal("video"), v.literal("link")),
});

/** Every campaign field an admin can write. */
const CAMPAIGN_PATCH = v.object({
  brand: v.optional(v.string()),
  title: v.optional(v.string()),
  logo: v.optional(v.string()),
  brief: v.optional(v.string()),
  referenceLinks: v.optional(v.array(ASSET)),
  sourceFiles: v.optional(v.array(ASSET)),
  ratePer1k: v.optional(v.number()),
  minViews: v.optional(v.number()),
  platforms: v.optional(v.array(PLATFORM)),
  daysLeft: v.optional(v.number()),
  budget: v.optional(v.number()),
  spent: v.optional(v.number()),
  clippers: v.optional(v.number()),
  guidelines: v.optional(v.array(v.string())),
  status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  invoice: v.optional(
    v.union(v.literal("draft"), v.literal("sent"), v.literal("paid")),
  ),
});

/** Every campaign field, all optional — used for creating a campaign. */
const CAMPAIGN_FIELDS = v.object({
  brand: v.string(),
  title: v.string(),
  logo: v.optional(v.string()),
  brief: v.optional(v.string()),
  referenceLinks: v.optional(v.array(ASSET)),
  sourceFiles: v.optional(v.array(ASSET)),
  ratePer1k: v.number(),
  minViews: v.number(),
  platforms: v.optional(v.array(PLATFORM)),
  daysLeft: v.optional(v.number()),
  budget: v.number(),
  spent: v.optional(v.number()),
  clippers: v.optional(v.number()),
  guidelines: v.optional(v.array(v.string())),
  status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  invoice: v.optional(
    v.union(v.literal("draft"), v.literal("sent"), v.literal("paid")),
  ),
});

/**
 * Every campaign, newest first, with a `joined` flag for the caller and the
 * total number of creators who joined it. Join totals are counted in one
 * pass over the joins table rather than one query per campaign — a feed of
 * twenty campaigns would otherwise read it twenty times.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const campaigns = await ctx.db.query("campaigns").collect();
    const joins = await ctx.db.query("campaignJoins").collect();

    const joinedIds = new Set<string>();
    const counts = new Map<string, number>();
    for (const join of joins) {
      counts.set(join.campaignId, (counts.get(join.campaignId) ?? 0) + 1);
      if (join.userId === user._id) joinedIds.add(join.campaignId);
    }

    return campaigns
      .map((campaign) => ({
        ...campaign,
        joined: joinedIds.has(campaign._id),
        joinCount: counts.get(campaign._id) ?? 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * The public campaign catalog, used by the landing page before anyone has
 * signed in. It carries no per-user data, so it needs no session.
 */
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("campaigns").collect();
    const joins = await ctx.db.query("campaignJoins").collect();

    const counts = new Map<string, number>();
    for (const join of joins) {
      counts.set(join.campaignId, (counts.get(join.campaignId) ?? 0) + 1);
    }

    return campaigns
      .map((campaign) => ({
        ...campaign,
        joined: false,
        joinCount: counts.get(campaign._id) ?? 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.campaignId);
  },
});

export const create = mutation({
  args: CAMPAIGN_FIELDS,
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const brand = args.brand.trim();
    const title = args.title.trim();
    if (!brand || !title) {
      throw new Error("A campaign needs a brand and a title.");
    }
    if (args.ratePer1k < 0 || args.budget < 0 || args.minViews < 0) {
      throw new Error("Rate, budget and minimum views cannot be negative.");
    }

    return await ctx.db.insert("campaigns", {
      brand,
      title,
      logo: args.logo,
      brief: args.brief,
      referenceLinks: args.referenceLinks ?? [],
      sourceFiles: args.sourceFiles ?? [],
      ratePer1k: args.ratePer1k,
      minViews: args.minViews,
      platforms: args.platforms ?? ["tiktok", "instagram", "youtube"],
      daysLeft: args.daysLeft ?? 30,
      budget: args.budget,
      spent: args.spent ?? 0,
      clippers: args.clippers ?? 0,
      guidelines: args.guidelines ?? [],
      status: args.status ?? "active",
      invoice: args.invoice ?? "draft",
      createdAt: Date.now(),
      createdBy: user._id,
    });
  },
});

export const update = mutation({
  args: { campaignId: v.id("campaigns"), patch: CAMPAIGN_PATCH },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("That campaign no longer exists.");

    const patch = args.patch;
    await ctx.db.patch(args.campaignId, {
      ...patch,
      brand: patch.brand?.trim() || campaign.brand,
      title: patch.title?.trim() || campaign.title,
    });
  },
});

export const setStatus = mutation({
  args: {
    campaignId: v.id("campaigns"),
    status: v.union(v.literal("active"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("That campaign no longer exists.");
    await ctx.db.patch(args.campaignId, { status: args.status });
  },
});

export const setInvoice = mutation({
  args: {
    campaignId: v.id("campaigns"),
    invoice: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("That campaign no longer exists.");
    await ctx.db.patch(args.campaignId, { invoice: args.invoice });
  },
});

/** Delete a campaign along with its joins and clips. Admin only. */
export const remove = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    const joins = await ctx.db
      .query("campaignJoins")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const join of joins) await ctx.db.delete(join._id);

    const clips = await ctx.db
      .query("submissions")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const clip of clips) await ctx.db.delete(clip._id);

    await ctx.db.delete(args.campaignId);

    /* A campaign that came from a brand request is only as real as the
       campaign. Leaving the request behind would keep telling that brand
       "approved — live" for something that no longer exists, so the request
       goes with it. */
    const requests = await ctx.db
      .query("campaignRequests")
      .filter((q) => q.eq(q.field("campaignId"), args.campaignId))
      .collect();
    for (const request of requests) await ctx.db.delete(request._id);
  },
});

/** Join a campaign. Idempotent. */
export const join = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("That campaign no longer exists.");

    const existing = await ctx.db
      .query("campaignJoins")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (existing) return;

    /* The budget is the campaign's life support: every approved clip takes
       money out of it, and once it is gone there is nothing left to pay a new
       member with — so the door closes here, server-side, not just on the
       button. An operator can reopen simply by raising the budget. */
    if (campaign.spent >= campaign.budget) {
      throw new NotAllowedError(
        "This campaign's budget has been fully spent, so it isn't taking new members.",
      );
    }

    await ctx.db.insert("campaignJoins", {
      campaignId: args.campaignId,
      userId: user._id,
      joinedAt: Date.now(),
    });
  },
});

/** Leave a campaign. Idempotent. */
export const leave = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("campaignJoins")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!existing) return;
    await ctx.db.delete(existing._id);
  },
});
