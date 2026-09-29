import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./access";

/**
 * A creator's inbox: system notices and direct messages from Clip Vault.
 *
 * Everything a creator needs to be told lands here in one chronological list.
 * That matters because the alternative — scattering a notification into the
 * campaign view, another into the clips view, and a third into a mail relay —
 * means a creator can be told something important in a place they are not
 * looking, which is the same as not telling them.
 *
 * Only the creator's own messages and the total unread count are readable from
 * the client. Writing a notice is internal, so it can only be triggered by
 * server code that has already decided the event really happened.
 */

const KINDS = { NOTICE: "notice", ADMIN: "admin" } as const;

/** A creator's messages, newest first. */
export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 100)
      .map((m) => ({
        id: m._id,
        kind: m.kind,
        title: m.title ?? null,
        body: m.body,
        link: m.link ?? null,
        createdAt: m.createdAt,
        read: m.readAt !== undefined,
      }));
  },
});

/** How many unread messages the creator has, for the bell badge. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows.filter((m) => m.readAt === undefined).length;
  },
});

/** Mark everything as read, so the badge clears. */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const unread = rows.filter((m) => m.readAt === undefined);
    for (const message of unread) {
      await ctx.db.patch(message._id, { readAt: Date.now() });
    }
    return unread.length;
  },
});

/**
 * Mark a single notification as read.
 *
 * The badge counts what has not been seen yet, so reading has to be per row —
 * clearing the whole inbox on open would erase the list's own record of what
 * was new, and the next notice would arrive with nothing to distinguish it
 * from last week's. Only the owner can mark their copy read.
 */
export const markRead = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    if (message.userId !== user._id) {
      throw new Error("You can only read your own notifications.");
    }
    if (message.readAt === undefined) {
      await ctx.db.patch(message._id, { readAt: Date.now() });
    }
  },
});

/**
 * Removes a notification from the inbox.
 *
 * A creator deletes their own; an operator can clear any notification, which
 * is what makes a mistaken broadcast recoverable. Nothing is softened to
 * "archived" — the user asked for it to be gone, and leaving it in a hidden
 * state only moves the problem.
 */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    if (message.userId !== user._id && user.role !== "admin") {
      throw new Error("You can only delete your own notifications.");
    }
    await ctx.db.delete(args.messageId);
  },
});

/** Sends a direct message to a creator. Admin only. */
export const sendToCreator = mutation({
  args: {
    userId: v.id("users"),
    body: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const body = args.body.trim();
    if (!body) throw new Error("Write something before sending.");
    if (body.length > 2000) throw new Error("That message is too long.");

    const creator = await ctx.db.get(args.userId);
    if (!creator) throw new Error("That user no longer exists.");

    await ctx.db.insert("messages", {
      userId: args.userId,
      kind: KINDS.ADMIN,
      title: args.title?.trim() || "Message from Clip Vault",
      body,
      createdAt: Date.now(),
    });
    return true;
  },
});

/**
 * Sends the same message to every user on the platform. Admin only.
 *
 * Broadcast is deliberately its own path rather than a loop over the direct
 * send, so it is obvious in the code and in review that this writes N rows and
 * costs N messages. It is also capped, because a broadcast to a large list is
 * the easiest way in this product to be expensive by accident.
 */
export const broadcast = mutation({
  args: {
    body: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const body = args.body.trim();
    if (!body) throw new Error("Write something before sending.");
    if (body.length > 2000) throw new Error("That message is too long.");

    const users = await ctx.db.query("users").collect();
    if (users.length > 500) {
      throw new Error(
        "That's more than 500 people. Send it in smaller groups instead.",
      );
    }
    if (users.length === 0) throw new Error("There is nobody to send it to.");

    const now = Date.now();
    const title = args.title?.trim() || "News from Clip Vault";
    for (const user of users) {
      await ctx.db.insert("messages", {
        userId: user._id,
        kind: KINDS.ADMIN,
        title,
        body,
        createdAt: now,
      });
    }
    return users.length;
  },
});

/**
 * Writes a system notice. Internal, so no client can announce something to a
 * creator that did not actually happen.
 */
export const notify = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      userId: args.userId,
      kind: KINDS.NOTICE,
      title: args.title,
      body: args.body,
      link: args.link,
      createdAt: Date.now(),
    });
  },
});

/** Every message on the platform, newest first. Admin only. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("messages").collect();
    const users = await Promise.all(
      [...new Set(rows.map((m) => m.userId))].map((id) => ctx.db.get(id)),
    );
    const byId = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200)
      .map((m) => ({
        id: m._id,
        userId: m.userId,
        userName:
          byId.get(m.userId)?.name ??
          byId.get(m.userId)?.email?.split("@")[0] ??
          "Creator",
        kind: m.kind,
        title: m.title ?? null,
        body: m.body,
        createdAt: m.createdAt,
        read: m.readAt !== undefined,
      }));
  },
});
