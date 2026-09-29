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

/**
 * Currencies a creator can be paid in. Chosen at payout-request time rather
 * than saved up front, so nobody is locked into a wallet they signed up with.
 */
export const PAYOUT_METHODS = ["sol", "ltc", "btc", "usdt"] as const;
export const payoutMethodValidator = v.union(
  v.literal("sol"),
  v.literal("ltc"),
  v.literal("btc"),
  v.literal("usdt"),
);
export type PayoutMethod = Infer<typeof payoutMethodValidator>;

/** Networks USDT can be sent on. The address shape depends on this. */
export const USDT_NETWORKS = ["trc20", "erc20", "bep20"] as const;
export const usdtNetworkValidator = v.union(
  v.literal("trc20"),
  v.literal("erc20"),
  v.literal("bep20"),
);
export type UsdtNetwork = Infer<typeof usdtNetworkValidator>;

/** The smallest withdrawal a creator can request, in whole dollars. */
export const MIN_WITHDRAWAL_USD = 5;

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

      /* There is deliberately no payout address on the user row. A creator
         picks the currency, network and address on the payout request itself —
         see the `payoutRequests` table — so a stale wallet can never be paid by
         accident. */
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /* ------------------------------------------------------------------ */
    /* Clip Vault product data                                                */
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

    // A social account a creator has bio-verified on Clip Vault.
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
      /**
       * Real follower and post counts, read from the platform at the moment
       * the bio check succeeded. Null when the platform does not publish them
       * in the profile we read — we never invent these.
       */
      followers: v.optional(v.number()),
      posts: v.optional(v.number()),
      /** When the follower/post counts were last re-read from the platform. */
      statsRefreshedAt: v.optional(v.number()),
      /**
       * RETIRED: the meter for the paid fallback route, which no longer
       * exists. The field is kept in the schema — not written, not read — so
       * any row that recorded it before the route was removed stays writable.
       */
      fallbackRefreshedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_platform", ["userId", "platform"]),

    /**
     * The logged-in Instagram session used to read profiles when Instagram
     * refuses anonymous lookups from this server. A singleton — one row, the
     * fixed `_id` below — because it represents one configured test account,
     * not per-user state.
     *
     * The credentials themselves are NOT stored here: they live in the
     * deployment's environment (`IG_BOT_USERNAME` / `IG_BOT_PASSWORD`) and
     * only ever appear inside the login routine. What is stored is the result
     * of the login — the cookies that let later reads skip another login —
     * plus the status so the dashboard can show a human what to do when
     * Instagram asks the login to be confirmed.
     */
    igBotSessions: defineTable({
      /** Singleton key; always "ig-bot". */
      key: v.string(),
      status: v.union(
        v.literal("anonymous"),
        v.literal("ok"),
        v.literal("challenge"),
        v.literal("error"),
      ),
      sessionid: v.optional(v.string()),
      csrfToken: v.optional(v.string()),
      dsUserId: v.optional(v.string()),
      /** What happened, in words a human can act on. Never secrets. */
      message: v.optional(v.string()),
      loggedInAs: v.optional(v.string()),
      lastLoginAt: v.optional(v.number()),
      lastAttemptAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_key", ["key"]),

    // An outstanding email-verification challenge. Only the SHA-256 digest of
    // the code is stored, never the code itself.
    emailVerifications: defineTable({
      userId: v.id("users"),
      codeHash: v.string(),
      sentAt: v.number(),
      expiresAt: v.number(),
      attempts: v.number(),
    }).index("by_user", ["userId"]),

    /**
     * A message in a creator's inbox.
     *
     * Two kinds share one table so there is a single place to read: `notice`
     * is written by the system when something happens to the creator's work,
     * `admin` is a direct message a Clip Vault operator sent them. Both are
     * delivered to the same place, because from the creator's side they are
     * the same thing — news about their account.
     */
    messages: defineTable({
      userId: v.id("users"),
      kind: v.union(v.literal("notice"), v.literal("admin")),
      title: v.optional(v.string()),
      body: v.string(),
      /** Set once the creator has seen it; null means unread. */
      readAt: v.optional(v.number()),
      /** Link the creator back to the clip or campaign this is about. */
      link: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

    /**
     * A creator's money. One row per user, created with the account.
     *
     * Every amount is stored in whole US cents. Dollars are not exactly
     * representable in binary floating point, and a balance that drifts by a
     * fraction of a cent across hundreds of clips becomes a balance that does
     * not match the sum of its own ledger.
     */
    wallets: defineTable({
      userId: v.id("users"),
      /** Cleared earnings, in cents. What a creator can request a payout from. */
      availableCents: v.number(),
      /** Locked inside a payout request that an operator has not actioned. */
      pendingCents: v.number(),
      /** Every cent ever credited, paid out or not. */
      lifetimeCents: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    /**
     * One row per credit to a wallet, so the balance can always be explained.
     *
     * `submissionId` is unique in practice: approving the same clip twice must
     * not pay twice, and this is what makes that checkable rather than a
     * convention.
     */
    earnings: defineTable({
      userId: v.id("users"),
      /** The clip this money came from, when it came from a clip. */
      submissionId: v.optional(v.id("submissions")),
      campaignId: v.optional(v.id("campaigns")),
      /** Signed, in cents. Negative when a payout request took money out. */
      amountCents: v.number(),
      /**
       * What this credit was worth before the platform's transaction fee.
       *
       * The creator is paid `amountCents` — the figure after the fee, which is
       * the only one ever shown to them — but a later top-up has to be measured
       * against the same basis the first credit used, otherwise the difference
       * would be computed against a smaller number and over-credit. This stays
       * on the server: it is not part of the creator's ledger view.
       */
      grossCents: v.optional(v.number()),
      /**
       * True only on the developer's fee rows.
       *
       * The fee is private: it is never shown to creators, and it must not
       * count towards anybody's public standing either — otherwise the
       * platform's cut would surface as one account quietly sitting at the
       * top of the leaderboard with everyone's five percent.
       */
      isFee: v.optional(v.boolean()),
      /** Plain-language reason, shown in the creator's history. */
      reason: v.string(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

    /**
     * A creator asking to be paid, and the operator's answer to it.
     *
     * The amount moves from `availableCents` to `pendingCents` the moment the
     * request is made, so the money cannot be requested twice while an operator
     * is still deciding. Marking it paid clears the pending balance; rejecting
     * it requires a reason and returns the money to available.
     */
    payoutRequests: defineTable({
      userId: v.id("users"),
      /** Name shown to the operator, snapshotted when the request was made. */
      creatorName: v.string(),
      amountCents: v.number(),
      method: payoutMethodValidator,
      /** Only set for USDT, where the address shape depends on the network. */
      network: v.optional(usdtNetworkValidator),
      address: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("rejected"),
      ),
      requestedAt: v.number(),
      decidedAt: v.optional(v.number()),
      /** Transaction hash or note the operator recorded when paying. */
      reference: v.optional(v.string()),
      /** Required on rejection, and shown to the creator. */
      reason: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_user_requested", ["userId", "requestedAt"])
      .index("by_status", ["status"])
      .index("by_requested", ["requestedAt"]),

    /**
     * A brand asking for a campaign to be set up.
     *
     * A brand never creates a campaign directly from the marketing site: they
     * sign in, fill in the campaign (name, description, budget, rate, platforms
     * and the photos/videos/links clippers should work from), and an operator
     * approves or declines it from the console. Approving it creates the real
     * `campaigns` row, so what creators join is exactly what the brand asked
     * for.
     */
    campaignRequests: defineTable({
      userId: v.id("users"),
      /** Snapshotted so the queue still reads correctly if the user is deleted. */
      brandName: v.string(),
      brandEmail: v.string(),
      /** Campaign name, as the brand wrote it. */
      title: v.string(),
      /** The brief: what the campaign is, who it is for, what a clip should say. */
      description: v.string(),
      /** Total budget in whole US dollars, as the brand wrote it. */
      budgetUsd: v.number(),
      /** US dollars offered per 1,000 verified views. */
      ratePer1k: v.number(),
      /** Views a single clip needs before it starts earning. */
      minViews: v.number(),
      /** How long the campaign should run, in days. */
      days: v.number(),
      /** Where clips may be published. */
      platforms: v.array(platformValidator),
      /** Photos, videos and links the brand shared, for clippers to work from. */
      assets: v.array(
        v.object({
          label: v.string(),
          url: v.string(),
          kind: v.union(
            v.literal("image"),
            v.literal("video"),
            v.literal("link"),
          ),
        }),
      ),
      /** Anything else the brand wants the operator to know. */
      note: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("declined"),
      ),
      /** The campaign an approval created, so the request and the campaign agree. */
      campaignId: v.optional(v.id("campaigns")),
      requestedAt: v.number(),
      decidedAt: v.optional(v.number()),
      decidedBy: v.optional(v.id("users")),
      /** Required on a decline, and sent to the brand. */
      reason: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"]),

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
      /**
       * True once a Clip Vault operator has confirmed the view count. Until then
       * the clip is carrying the number the creator's platform reported, which
       * is a claim rather than a measurement.
       */
      viewsConfirmed: v.optional(v.boolean()),
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
