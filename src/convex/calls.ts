import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin, requireUser } from "./access";
import type { Id } from "./_generated/dataModel";

/**
 * 30-minute strategy calls between Clip Vault and a brand.
 *
 * A brand cannot create a campaign from the marketing site. What they can do
 * is sign in, pick a slot, and ask for a call — and then the operator decides,
 * in the admin console, whether to approve it or decline it. Nothing is
 * confirmed until an operator says so, which is why the slot list hides a slot
 * only once it is *approved*: two people can ask for the same time, and the
 * operator picks who gets it.
 */

/** Every call is the same length, so the client never has to guess. */
export const CALL_LENGTH_MINUTES = 30;

/** Bookings may be requested this many days ahead. */
const HORIZON_DAYS = 14;

/** Earliest a request can be for — no "call me right now". */
const LEAD_MINUTES = 120;

/** Calls are offered inside this window, in UTC. */
const DAY_START_UTC_HOUR = 9;
const DAY_END_UTC_HOUR = 20;

/** A person can only have one open request at a time. */
const MAX_OPEN_PER_USER = 1;

const STEP_MINUTES = 30;
const MIN_LEAD = LEAD_MINUTES * 60_000;
const DAY = 86_400_000;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Every bookable instant in the horizon, before any booking is applied. */
function generateSlots(now: number): number[] {
  const slots: number[] = [];
  const firstDay = startOfUtcDay(now);
  for (let day = 0; day < HORIZON_DAYS; day++) {
    const dayStart = firstDay + day * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    /* Closed on Saturday and Sunday. */
    if (weekday === 0 || weekday === 6) continue;
    for (
      let minute = DAY_START_UTC_HOUR * 60;
      minute < DAY_END_UTC_HOUR * 60;
      minute += STEP_MINUTES
    ) {
      const start = dayStart + minute * 60_000;
      /* A slot needs to be far enough away, and the whole call has to fit
         before the window closes. */
      if (start < now + MIN_LEAD) continue;
      slots.push(start);
    }
  }
  return slots;
}

/** Confirms a decision to the brand in their inbox. */
async function notify(ctx: MutationCtx, userId: Id<"users">, body: string) {
  await ctx.db.insert("messages", {
    userId,
    kind: "notice",
    title: "Your 30-minute call",
    body,
    link: "/dashboard/calls",
    createdAt: Date.now(),
  });
}

/**
 * Slots a brand can ask for, as start timestamps.
 *
 * A slot disappears only once it is approved, so two brands can race for the
 * same time and an operator breaks the tie. Slots in the past, or too close to
 * now, are never returned.
 */
export const availableSlots = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const now = Date.now();
    const approved = await ctx.db
      .query("callBookings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const taken = new Set(
      approved
        .map((b) => b.startsAt)
        .filter((ms) => ms > now),
    );
    return generateSlots(now)
      .filter((ms) => !taken.has(ms))
      .slice(0, 200);
  },
});

/** This brand's own requests, newest first. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("callBookings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .map((b) => ({
        id: b._id,
        startsAt: b.startsAt,
        topic: b.topic,
        company: b.company ?? null,
        note: b.note ?? null,
        status: b.status,
        requestedAt: b.requestedAt,
        decidedAt: b.decidedAt ?? null,
        reason: b.reason ?? null,
      }));
  },
});

/**
 * Asks for a 30-minute call. Signed-in brands only.
 *
 * The client cannot invent a time: the slot has to be one the server just
 * offered, and it has to still be open.
 */
export const requestCall = mutation({
  args: {
    startsAt: v.number(),
    topic: v.string(),
    company: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const topic = args.topic.trim();
    if (topic.length < 3) {
      throw new Error("Tell us what the call is about.");
    }
    if (topic.length > 200) throw new Error("That topic is too long.");

    const startsAt = Math.floor(args.startsAt / STEP_MINUTES) * STEP_MINUTES * 60_000;
    const now = Date.now();
    if (!generateSlots(now).includes(startsAt)) {
      throw new Error("That time is not available. Pick another slot.");
    }

    /* One slot, one request — even if it is declined, so the queue stays
       readable and a declined request always has an answer attached. */
    const clash = await ctx.db
      .query("callBookings")
      .withIndex("by_slot", (q) => q.eq("startsAt", startsAt))
      .filter((q) => q.or(
        q.eq(q.field("status"), "pending"),
        q.eq(q.field("status"), "approved"),
      ))
      .first();
    if (clash) {
      throw new Error("Someone just asked for that time. Pick another slot.");
    }

    const open = await ctx.db
      .query("callBookings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const openCount = open.filter(
      (b) => b.status === "pending" || b.status === "approved",
    ).length;
    if (openCount >= MAX_OPEN_PER_USER) {
      throw new Error(
        "You already have a call in the works — we'll confirm the time here.",
      );
    }

    const id = await ctx.db.insert("callBookings", {
      userId: user._id,
      brandName: user.name ?? user.email?.split("@")[0] ?? "Brand",
      brandEmail: user.email ?? "",
      company: args.company?.trim() || undefined,
      topic,
      note: args.note?.trim() || undefined,
      startsAt,
      status: "pending",
      requestedAt: now,
    });
    return id;
  },
});

/** Every request on the platform, newest first. Admin only. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("callBookings").collect();
    return rows
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .map((b) => ({
        id: b._id,
        userId: b.userId,
        brandName: b.brandName,
        brandEmail: b.brandEmail,
        company: b.company ?? null,
        topic: b.topic,
        note: b.note ?? null,
        startsAt: b.startsAt,
        status: b.status,
        requestedAt: b.requestedAt,
        decidedAt: b.decidedAt ?? null,
        reason: b.reason ?? null,
      }));
  },
});

/** Approves a request and locks the slot. Admin only. */
export const approve = mutation({
  args: { bookingId: v.id("callBookings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("That request no longer exists.");
    if (booking.status !== "pending") {
      throw new Error("That request was already actioned.");
    }
    if (booking.startsAt < Date.now()) {
      throw new Error("That slot is in the past — ask for another time.");
    }

    await ctx.db.patch(args.bookingId, {
      status: "approved",
      decidedAt: Date.now(),
      decidedBy: admin._id,
    });
    await notify(
      ctx,
      booking.userId,
      `Your 30-minute call is confirmed for ${new Date(
        booking.startsAt,
      ).toUTCString()}. ${booking.brandName} — we'll send the joining link before it starts.`,
    );
    return true;
  },
});

/** Declines a request. A reason is required and is sent to the brand. */
export const decline = mutation({
  args: { bookingId: v.id("callBookings"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const reason = args.reason.trim();
    if (reason.length < 3) throw new Error("Give the brand a short reason.");
    if (reason.length > 1000) throw new Error("That reason is too long.");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("That request no longer exists.");
    if (booking.status !== "pending") {
      throw new Error("That request was already actioned.");
    }

    await ctx.db.patch(args.bookingId, {
      status: "declined",
      decidedAt: Date.now(),
      decidedBy: admin._id,
      reason,
    });
    await notify(
      ctx,
      booking.userId,
      `We can't take the ${new Date(
        booking.startsAt,
      ).toUTCString()} slot right now: ${reason} Pick another time on the booking page and we'll confirm it there.`,
    );
    return true;
  },
});
