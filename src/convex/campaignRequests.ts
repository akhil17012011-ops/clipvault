import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin, requireUser } from "./access";
import type { Id } from "./_generated/dataModel";

/**
 * Campaign requests: a brand describing the campaign it wants, and the
 * operator's answer to it.
 *
 * Brands do not get an admin panel. They sign in, fill in the campaign — name,
 * description, budget, rate, platforms, and the photos/videos/links clippers
 * should work from — and an operator approves or declines it from the console.
 * Approving creates the real campaign row, so creators only ever join something
 * a human has looked at.
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
  kind: v.union(v.literal("image"), v.literal("video"), v.literal("link")),
});

/** One open request per brand at a time, so the queue stays readable. */
const MAX_OPEN_PER_USER = 2;

/** Anything that is not an http(s) link is rejected rather than stored. */
function cleanUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const parsed = new URL(
      value.startsWith("http") ? value : `https://${value}`,
    );
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function cleanAssets(
  raw: Array<{ label: string; url: string; kind: "image" | "video" | "link" }>,
): Array<{ label: string; url: string; kind: "image" | "video" | "link" }> {
  const out: Array<{
    label: string;
    url: string;
    kind: "image" | "video" | "link";
  }> = [];
  for (const asset of raw.slice(0, 20)) {
    const url = cleanUrl(asset.url);
    if (!url) continue;
    out.push({
      label: asset.label.trim().slice(0, 120) || url,
      url,
      kind: asset.kind,
    });
  }
  return out;
}

/** Tells the brand what happened to their request. */
async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string,
  body: string,
) {
  await ctx.db.insert("messages", {
    userId,
    kind: "notice",
    title,
    body,
    link: "/dashboard/request",
    createdAt: Date.now(),
  });
}

/** This brand's own requests, newest first. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("campaignRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .map((r) => ({
        id: r._id,
        title: r.title,
        description: r.description,
        budgetUsd: r.budgetUsd,
        ratePer1k: r.ratePer1k,
        minViews: r.minViews,
        days: r.days,
        platforms: r.platforms,
        assets: r.assets,
        status: r.status,
        campaignId: r.campaignId ?? null,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt ?? null,
        reason: r.reason ?? null,
      }));
  },
});

/** Every request on the platform, newest first. Admin only. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("campaignRequests").collect();
    return rows
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .map((r) => ({
        id: r._id,
        userId: r.userId,
        brandName: r.brandName,
        brandEmail: r.brandEmail,
        title: r.title,
        description: r.description,
        budgetUsd: r.budgetUsd,
        ratePer1k: r.ratePer1k,
        minViews: r.minViews,
        days: r.days,
        platforms: r.platforms,
        assets: r.assets,
        note: r.note ?? null,
        status: r.status,
        campaignId: r.campaignId ?? null,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt ?? null,
        reason: r.reason ?? null,
      }));
  },
});

/**
 * Deletes a request outright.
 *
 * An operator can remove any request; a brand can remove their own. A request
 * that was approved is tied to the campaign it created, and that campaign is
 * the real thing — so the request only goes when the campaign does, which is
 * why deleting a campaign deletes the request that created it too.
 *
 * This is a hard delete: the request is gone from both the brand's list and the
 * operator's queue, with nothing left behind.
 */
export const remove = mutation({
  args: { requestId: v.id("campaignRequests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) return;

    /* The campaign a request was approved into is the real thing. If it is
       still there, the request stays with it — deleting one without the other
       would leave a brand being told a campaign is live when it is not. If the
       campaign has since been removed, the request has nothing left to refer
       to and can go. */
    const live = request.campaignId
      ? ((await ctx.db.get(request.campaignId)) ?? null)
      : null;
    if (live) {
      throw new Error(
        "That request is already live as a campaign — delete the campaign itself to take it down.",
      );
    }
    /* A brand may only touch their own. */
    if (user.role !== "admin" && request.userId !== user._id) {
      throw new Error("You can only remove your own request.");
    }
    await ctx.db.delete(args.requestId);
  },
});

/** Every field a brand fills in, whether sending a request or editing one. */
const REQUEST_FIELDS = {
  brandName: v.string(),
  title: v.string(),
  description: v.string(),
  budgetUsd: v.number(),
  ratePer1k: v.optional(v.number()),
  minViews: v.optional(v.number()),
  days: v.optional(v.number()),
  platforms: v.optional(v.array(PLATFORM)),
  assets: v.optional(v.array(ASSET)),
  note: v.optional(v.string()),
};

type RequestFields = {
  brandName: string;
  title: string;
  description: string;
  budgetUsd: number;
  ratePer1k: number;
  minViews: number;
  days: number;
  platforms: Platform[];
  assets: { label: string; url: string; kind: "image" | "video" | "link" }[];
  note?: string;
};

type Platform = "tiktok" | "instagram" | "youtube" | "x";

/**
 * Validates a request and returns the values as they should be written.
 *
 * Submit and edit share this so a brand cannot be held to rules on the way in
 * and then allowed to break the same ones on the way through an edit.
 */
function cleanRequest(args: {
  brandName: string;
  title: string;
  description: string;
  budgetUsd: number;
  ratePer1k?: number;
  minViews?: number;
  days?: number;
  platforms?: Platform[];
  assets?: { label: string; url: string; kind: "image" | "video" | "link" }[];
  note?: string;
}): RequestFields {
  const brandName = args.brandName.trim();
  const title = args.title.trim();
  const description = args.description.trim();
  if (brandName.length < 2) {
    throw new Error("Which brand is this campaign for?");
  }
  if (title.length < 3) throw new Error("Give the campaign a name.");
  if (description.length < 20) {
    throw new Error(
      "Describe the campaign in a sentence or two, so we know what to set up.",
    );
  }
  if (title.length > 120) throw new Error("That campaign name is too long.");
  if (description.length > 4000) {
    throw new Error("That description is too long.");
  }
  if (!Number.isFinite(args.budgetUsd) || args.budgetUsd < 10) {
    throw new Error("A campaign budget starts at $10.");
  }
  if (args.budgetUsd > 10_000_000) {
    throw new Error("That budget is too large.");
  }

  const ratePer1k = args.ratePer1k ?? 0;
  if (ratePer1k < 0 || ratePer1k > 1000) {
    throw new Error("The rate has to be between $0 and $1,000 per 1,000 views.");
  }
  const minViews = args.minViews ?? 0;
  if (minViews < 0) throw new Error("Minimum views cannot be negative.");
  const days = args.days ?? 30;
  if (days < 1 || days > 365) {
    throw new Error("A campaign runs between 1 and 365 days.");
  }

  const platforms = [...new Set(args.platforms ?? [])] as Platform[];
  if (platforms.length === 0) {
    throw new Error("Pick at least one platform to post on.");
  }

  return {
    brandName,
    title,
    description,
    budgetUsd: args.budgetUsd,
    ratePer1k,
    minViews,
    days,
    platforms,
    assets: cleanAssets(args.assets ?? []),
    note: args.note?.trim() || undefined,
  };
}

function failure(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "We couldn't save that request. Try again in a moment.";
}

/** How many requests are waiting on a decision. Admin only. */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("campaignRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return rows.length;
  },
});

/**
 * Asks for a campaign. Signed-in brands only.
 *
 * The money is stored in whole US dollars here and becomes cents only when the
 * approved campaign is created, so a budget can never carry a fraction of a
 * cent that the wallet maths would later have to explain.
 *
 * Failures come back as `{ ok: false, error }` rather than being thrown.
 * Production deployments deliberately do not send the text of a thrown error
 * back to the browser, which would leave a brand staring at "Server Error" with
 * no idea what to fix. Returning the reason as data keeps this screen honest.
 */
export const submit = mutation({
  args: REQUEST_FIELDS,
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    try {
      const user = await requireUser(ctx);
      const clean = cleanRequest(args);

      const open = await ctx.db
        .query("campaignRequests")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const openCount = open.filter((r) => r.status === "pending").length;
      if (openCount >= MAX_OPEN_PER_USER) {
        throw new Error(
          "You already have two requests waiting — we'll answer those first.",
        );
      }

      const id = await ctx.db.insert("campaignRequests", {
        userId: user._id,
        brandName: clean.brandName,
        brandEmail: user.email ?? "",
        title: clean.title,
        description: clean.description,
        budgetUsd: clean.budgetUsd,
        ratePer1k: clean.ratePer1k,
        minViews: clean.minViews,
        days: clean.days,
        platforms: clean.platforms,
        assets: clean.assets,
        note: clean.note,
        status: "pending",
        requestedAt: Date.now(),
      });
      return { ok: true, id };
    } catch (err) {
      return { ok: false, error: failure(err) };
    }
  },
});

/**
 * Edits a request the brand has not had an answer to yet.
 *
 * Only a pending request can be edited. Once an operator has approved or
 * declined it, the numbers on the row are the record of a decision, and
 * changing them afterwards would make the queue lie about what was agreed.
 */
export const edit = mutation({
  args: {
    requestId: v.id("campaignRequests"),
    ...REQUEST_FIELDS,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    try {
      const user = await requireUser(ctx);
      const request = await ctx.db.get(args.requestId);
      if (!request) throw new Error("That request no longer exists.");
      if (request.userId !== user._id) {
        throw new Error("You can only edit your own request.");
      }
      if (request.status !== "pending") {
        throw new Error(
          request.status === "approved"
            ? "That campaign is already live — open a new request if you need something else."
            : "That request was already declined, so send a new one instead.",
        );
      }

      const clean = cleanRequest(args);
      await ctx.db.patch(args.requestId, {
        brandName: clean.brandName,
        title: clean.title,
        description: clean.description,
        budgetUsd: clean.budgetUsd,
        ratePer1k: clean.ratePer1k,
        minViews: clean.minViews,
        days: clean.days,
        platforms: clean.platforms,
        assets: clean.assets,
        note: clean.note,
      });
      return { ok: true, id: args.requestId };
    } catch (err) {
      return { ok: false, error: failure(err) };
    }
  },
});

/**
 * Approves a request and creates the campaign it describes.
 *
 * The campaign is built from the brand's own numbers rather than a set of
 * defaults, because the whole point of the request is that the brand said what
 * it wanted to pay and for how long. The request keeps a link to the campaign
 * so the queue can show what was created.
 */
export const approve = mutation({
  args: { requestId: v.id("campaignRequests") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("That request no longer exists.");
    if (request.status !== "pending") {
      throw new Error("That request was already actioned.");
    }

    const campaignId = await ctx.db.insert("campaigns", {
      brand: request.brandName,
      title: request.title,
      brief: request.description,
      referenceLinks: request.assets
        .filter((a) => a.kind === "link")
        .map((a) => ({ label: a.label, url: a.url, kind: "link" as const })),
      sourceFiles: request.assets.map((a) => ({
        label: a.label,
        url: a.url,
        kind: a.kind === "video" ? ("video" as const) : ("link" as const),
      })),
      ratePer1k: request.ratePer1k,
      minViews: request.minViews,
      platforms: request.platforms,
      daysLeft: request.days,
      budget: request.budgetUsd,
      spent: 0,
      clippers: 0,
      guidelines: [],
      status: "active",
      invoice: "draft",
      createdAt: Date.now(),
      createdBy: admin._id,
    });

    await ctx.db.patch(args.requestId, {
      status: "approved",
      campaignId,
      decidedAt: Date.now(),
      decidedBy: admin._id,
    });
    await notify(
      ctx,
      request.userId,
      "Your campaign is live",
      `${request.title} is approved and live on Clip Vault at $${request.budgetUsd} budget, $${request.ratePer1k} per 1,000 views. Verified creators can join and start clipping now.`,
    );
    return campaignId;
  },
});

/** Declines a request. A reason is required and is sent to the brand. */
export const decline = mutation({
  args: { requestId: v.id("campaignRequests"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const reason = args.reason.trim();
    if (reason.length < 3) {
      throw new Error("Give the brand a short reason — they see it.");
    }
    if (reason.length > 1000) throw new Error("That reason is too long.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("That request no longer exists.");
    if (request.status !== "pending") {
      throw new Error("That request was already actioned.");
    }

    await ctx.db.patch(args.requestId, {
      status: "declined",
      decidedAt: Date.now(),
      decidedBy: admin._id,
      reason,
    });
    await notify(
      ctx,
      request.userId,
      "About your campaign request",
      `We can't run ${request.title} as described: ${reason} Reply here with the changes and we'll take another look.`,
    );
    return true;
  },
});
