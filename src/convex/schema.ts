import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** The social platforms a clip can be published on. */
export const PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const;
export const platformValidator = v.union(
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("x"),
);
export type Platform = Infer<typeof platformValidator>;

/** A file or page a brand shares so clippers have something to work from. */
export const assetValidator = v.object({
  label: v.string(),
  url: v.string(),
  kind: v.union(v.literal("drive"), v.literal("video"), v.literal("link")),
});
export type CampaignAsset = Infer<typeof assetValidator>;

/** Numbers read back from the source platform for a published clip. */
export const clipMetricsValidator = v.object({
  views: v.number(),
  likes: v.number(),
  comments: v.number(),
  shares: v.number(),
  fetchedAt: v.number(),
});
export type ClipMetrics = Infer<typeof clipMetricsValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /* ------------------------------------------------------------------ */
    /* CLIPTIC product data                                                */
    /* ------------------------------------------------------------------ */

    // A brand campaign that creators can clip.
    campaigns: defineTable({
      brand: v.string(),
      title: v.string(),
      /** Brand mark: an emoji, or an image URL the brand uploaded. */
      logo: v.optional(v.string()),
      /** Long-form brief shown in the campaign detail view. */
      brief: v.optional(v.string()),
      referenceLinks: v.array(
        v.object({
          label: v.string(),
          url: v.string(),
          kind: v.union(
            v.literal("drive"),
            v.literal("video"),
            v.literal("link"),
          ),
        }),
      ),
      sourceFiles: v.array(
        v.object({
          label: v.string(),
          url: v.string(),
          kind: v.union(
            v.literal("drive"),
            v.literal("video"),
            v.literal("link"),
          ),
        }),
      ),
      /** US dollars earned per 1,000 views. */
      ratePer1k: v.number(),
      /** Views needed on a single clip before it starts earning. */
      minViews: v.number(),
      platforms: v.array(platformValidator),
      daysLeft: v.number(),
      budget: v.number(),
      /** Budget already committed to payouts. */
      spent: v.number(),
      clippers: v.number(),
      guidelines: v.array(v.string()),
      status: v.union(v.literal("active"), v.literal("paused")),
      invoice: v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
      ),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_status", ["status"])
      .index("by_createdAt", ["createdAt"]),

    // Which creators joined which campaign.
    campaignJoins: defineTable({
      campaignId: v.id("campaigns"),
      userId: v.id("users"),
      joinedAt: v.number(),
    })
      .index("by_campaign", ["campaignId"])
      .index("by_user", ["userId"]),

    // A social account a creator has bio-verified on CLIPTIC.
    connectedAccounts: defineTable({
      userId: v.id("users"),
      platform: platformValidator,
      handle: v.string(),
      /** One-time code the creator pastes into their bio. */
      code: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("checking"),
        v.literal("connected"),
        v.literal("failed"),
      ),
      /** Set when the bio check actually confirmed the code. */
      connectedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_platform", ["userId", "platform"]),

    // An outstanding email-verification challenge. Only the SHA-256 digest of
    // the code is stored, never the code itself.
    emailVerifications: defineTable({
      userId: v.id("users"),
      codeHash: v.string(),
      sentAt: v.number(),
      expiresAt: v.number(),
      attempts: v.number(),
    }).index("by_user", ["userId"]),

    // A clip a creator submitted to a campaign.
    submissions: defineTable({
      campaignId: v.id("campaigns"),
      userId: v.id("users"),
      /** Display name of the clipper, snapshotted at submission time. */
      creator: v.string(),
      platform: platformValidator,
      link: v.string(),
      /** Hashtags used in the caption. */
      tags: v.optional(v.array(v.string())),
      /** Handle the clip was published from, resolved from the link. */
      author: v.string(),
      /** The handle matched one of the creator's connected accounts. */
      verifiedOwner: v.boolean(),
      /** The campaign accepts clips from this platform. */
      platformOk: v.boolean(),
      /**
       * Numbers read back from the source platform. Null means we have not
       * been able to read them yet — we never invent them.
       */
      metrics: v.optional(
        v.object({
          views: v.number(),
          likes: v.number(),
          comments: v.number(),
          shares: v.number(),
          fetchedAt: v.number(),
        }),
      ),
      views: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("paid"),
        v.literal("rejected"),
      ),
      submittedAt: v.number(),
      /** Why the reviewer declined it, shown back to the creator. */
      reviewNote: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_campaign", ["campaignId"])
      .index("by_status", ["status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
