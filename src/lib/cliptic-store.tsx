import { api } from "@/convex/_generated/api";
import type { GenericId } from "convex/values";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  earnedOf,
  type AccountStats,
  type AdminUser,
  type CreatorMessage,
  type PayoutCurrency,
  type Campaign,
  type CampaignAsset,
  type ClipMetrics,
  type CreatorProfile,
  type LinkedAccount,
  type Platform,
  type Submission,
} from "@/lib/cliptic-data";

/**
 * CLIPTIC's data layer.
 *
 * Everything here is reactive Convex data — there is no local cache and no
 * invented numbers. The context exists so the dashboard components have one
 * place to reach for campaigns, connected accounts and clips, and so writes
 * are expressed as intent ("join this campaign") rather than local state
 * juggling.
 *
 * Record ids arrive as Convex ids; they are surfaced as plain strings because
 * that is all the UI needs.
 */

export interface Profile {
  /** Where the creator asked to be paid, if they have set it. */
  payoutCurrency?: PayoutCurrency;
  payoutAddress?: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface ClipticContextValue {
  profile: Profile | null;
  /** True when the signed-in user is a CLIPTIC operator. */
  isAdmin: boolean;
  accounts: LinkedAccount[];
  /** Admin-only: every connected account on the platform. */
  allAccounts: LinkedAccount[];
  /** Clips, views and earnings for each of my own connected accounts. */
  accountStats: AccountStats[];
  /** My inbox: system notices and direct messages from CLIPTIC. */
  messages: CreatorMessage[];
  /** Unread messages, for the bell badge. */
  unreadCount: number;
  markAllRead: () => Promise<void>;
  /** Save where I want to be paid. */
  updatePayout: (patch: {
    currency?: PayoutCurrency;
    address?: string;
  }) => Promise<void>;
  /** Admin: overwrite a clip's view count with the measured figure. */
  confirmViews: (id: string, views: number) => Promise<void>;
  /** Admin-only: every user with their accounts and totals. */
  adminUsers: AdminUser[];
  /** Change the display name and picture shown across CLIPTIC. */
  updateProfile: (patch: { name?: string; image?: string }) => Promise<void>;
  campaigns: Campaign[];
  /** Clips belonging to the signed-in creator. */
  submissions: Submission[];
  /** Admin-only: every clip on the platform. */
  allSubmissions: Submission[];

  addAccount: (platform: Platform, handle: string) => Promise<LinkedAccount>;
  verifyAccount: (
    id: string,
  ) => Promise<{
    verified: boolean;
    message: string;
    bio: string | null;
    /** False when the lookup was refused, so no bio could be read. */
    bioRead: boolean;
  }>;
  removeAccount: (id: string) => Promise<void>;

  toggleJoinCampaign: (id: string) => Promise<void>;

  submitClip: (input: {
    campaignId: string;
    link: string;
    caption: string;
    author: string;
    metrics?: ClipMetrics;
  }) => Promise<void>;

  createCampaign: (input: {
    brand: string;
    title: string;
    logo?: string;
    brief?: string;
    referenceLinks: CampaignAsset[];
    sourceFiles: CampaignAsset[];
    ratePer1k: number;
    minViews: number;
    budget: number;
    daysLeft: number;
    platforms: Platform[];
    guidelines: string[];
  }) => Promise<void>;
  updateCampaign: (id: string, patch: Partial<Campaign>) => Promise<void>;
  setCampaignStatus: (
    id: string,
    status: Campaign["status"],
  ) => Promise<void>;
  cycleInvoice: (id: string) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;

  reviewSubmission: (
    id: string,
    decision: "accept" | "decline",
    note?: string,
  ) => Promise<void>;
  settleSubmission: (id: string, status: "paid" | "rejected") => Promise<void>;
}

const ClipticContext = createContext<ClipticContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Id helpers                                                          */
/*                                                                     */
/* The UI works with plain strings for record ids, but the Convex        */
/* mutations insist on branded ids. These ids all come from Convex       */
/* queries in the first place, so narrowing them back is safe.          */
/* ------------------------------------------------------------------ */

const campaignId = (id: string) => id as GenericId<"campaigns">;
const accountId = (id: string) => id as GenericId<"connectedAccounts">;
const submissionId = (id: string) => id as GenericId<"submissions">;

/** Tells `useQuery` not to run a query at all. */
const SKIP = "skip" as const;

/* ---------------- mapping between Convex rows and UI shapes ---------------- */

type AccountRow = {
  _id: string;
  platform: Platform;
  handle: string;
  code: string;
  status: LinkedAccount["status"];
  connectedAt?: number;
  ownerName?: string;
  followers?: number | null;
  posts?: number | null;
};

const toAccount = (row: AccountRow, mine: boolean): LinkedAccount => ({
  id: row._id,
  platform: row.platform,
  handle: row.handle,
  code: row.code,
  status: row.status,
  connectedAt: row.connectedAt,
  mine,
  /* Only the brand console's directory rows carry the account's owner. */
  ownerName: row.ownerName,
  followers: row.followers ?? null,
  posts: row.posts ?? null,
});

const toCampaign = (row: {
  _id: string;
  brand: string;
  title: string;
  logo?: string;
  brief?: string;
  referenceLinks: CampaignAsset[];
  sourceFiles: CampaignAsset[];
  ratePer1k: number;
  minViews: number;
  platforms: Platform[];
  daysLeft: number;
  budget: number;
  spent: number;
  clippers: number;
  guidelines: string[];
  status: Campaign["status"];
  invoice: Campaign["invoice"];
  joined: boolean;
  createdAt: number;
}): Campaign => ({
  id: row._id,
  brand: row.brand,
  title: row.title,
  logo: row.logo,
  brief: row.brief,
  referenceLinks: row.referenceLinks ?? [],
  sourceFiles: row.sourceFiles ?? [],
  ratePer1k: row.ratePer1k,
  minViews: row.minViews,
  platforms: row.platforms,
  daysLeft: row.daysLeft,
  budget: row.budget,
  spent: row.spent,
  clippers: row.clippers,
  guidelines: row.guidelines,
  status: row.status,
  invoice: row.invoice,
  joined: row.joined,
  createdAt: row.createdAt,
});

type SubmissionRow = {
  _id: string;
  campaignId: string;
  creator: string;
  platform: Platform;
  link: string;
  tags?: string[];
  author: string;
  verifiedOwner: boolean;
  platformOk: boolean;
  metrics?: ClipMetrics;
  views: number;
  status: Submission["status"];
  submittedAt: number;
  reviewNote?: string;
};

const toSubmission = (row: SubmissionRow, mine: boolean): Submission => ({
  id: row._id,
  campaignId: row.campaignId,
  creator: row.creator,
  mine,
  platform: row.platform,
  link: row.link,
  tags: row.tags,
  author: row.author,
  verifiedOwner: row.verifiedOwner,
  platformOk: row.platformOk,
  metrics: row.metrics,
  views: row.views,
  status: row.status,
  submittedAt: row.submittedAt,
  reviewNote: row.reviewNote,
});

/* ------------------------------------------------------------------ */

export function ClipticProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();

  const user = useQuery(api.users.currentUser);
  const isAdmin = user?.role === "admin";

  /* Signed-out visitors still see the campaign catalog on the landing page, so
     the public list is used until there is a session to read joins from. */
  const rawPublicCampaigns = useQuery(
    api.campaigns.publicList,
    isAuthenticated ? SKIP : {},
  );
  const rawCampaigns = useQuery(
    api.campaigns.list,
    isAuthenticated ? {} : SKIP,
  );

  /* Admin-only reads are skipped entirely for creators, so the server never
     sees a request it would have to reject. */
  const rawAccounts = useQuery(api.accounts.listMine, isAuthenticated ? {} : SKIP);
  const rawAllAccounts = useQuery(
    api.accounts.listAll,
    isAdmin ? {} : SKIP,
  );
  const rawMine = useQuery(api.submissions.listMine, isAuthenticated ? {} : SKIP);
  const rawAll = useQuery(
    api.submissions.listAll,
    isAdmin ? {} : SKIP,
  );
  const rawAccountStats = useQuery(
    api.accounts.stats,
    isAuthenticated ? {} : SKIP,
  );
  const rawAdminUsers = useQuery(api.admin.users, isAdmin ? {} : SKIP);
  const rawMessages = useQuery(
    api.messages.listMine,
    isAuthenticated ? {} : SKIP,
  );
  const rawUnread = useQuery(
    api.messages.unreadCount,
    isAuthenticated ? {} : SKIP,
  );
  const markAllReadMutation = useMutation(api.messages.markAllRead);
  const updatePayoutMutation = useMutation(api.users.updatePayout);
  const confirmViewsMutation = useMutation(api.submissions.confirmViews);

  const requestAccount = useMutation(api.accounts.request);
  const removeAccountMutation = useMutation(api.accounts.remove);
  const joinCampaign = useMutation(api.campaigns.join);
  const leaveCampaign = useMutation(api.campaigns.leave);
  const submitClipMutation = useMutation(api.submissions.submit);
  const createCampaignMutation = useMutation(api.campaigns.create);
  const updateCampaignMutation = useMutation(api.campaigns.update);
  const setStatusMutation = useMutation(api.campaigns.setStatus);
  const setInvoiceMutation = useMutation(api.campaigns.setInvoice);
  const removeCampaignMutation = useMutation(api.campaigns.remove);
  const reviewMutation = useMutation(api.submissions.review);
  const settleMutation = useMutation(api.submissions.settle);
  const updateProfileMutation = useMutation(api.users.updateProfile);

  /* The profile is the real auth record, not anything the browser can set. */
  const profile: Profile | null = useMemo(() => {
    if (!user) return null;
    return {
      name: user.name ?? user.email?.split("@")[0] ?? "Creator",
      email: user.email ?? "",
      avatarUrl: user.image,
      payoutCurrency: user.payoutCurrency,
      payoutAddress: user.payoutAddress,
    };
  }, [user]);

  const accounts = useMemo(
    () => (rawAccounts ?? []).map((row) => toAccount(row, true)),
    [rawAccounts],
  );

  const allAccounts = useMemo(
    () => (rawAllAccounts ?? []).map((row) => toAccount(row, false)),
    [rawAllAccounts],
  );

  const accountStats = useMemo(
    () => (rawAccountStats ?? []) as AccountStats[],
    [rawAccountStats],
  );

  const adminUsers = useMemo(
    () => (rawAdminUsers ?? []) as AdminUser[],
    [rawAdminUsers],
  );

  const messages = useMemo(
    () => (rawMessages ?? []) as CreatorMessage[],
    [rawMessages],
  );

  const markAllRead = useCallback(async () => {
    await markAllReadMutation();
  }, [markAllReadMutation]);

  const updatePayout = useCallback(
    async (patch: { currency?: PayoutCurrency; address?: string }) => {
      await updatePayoutMutation(patch);
    },
    [updatePayoutMutation],
  );

  const confirmViews = useCallback(
    async (id: string, views: number) => {
      await confirmViewsMutation({ submissionId: submissionId(id), views });
    },
    [confirmViewsMutation],
  );

  const updateProfile = useCallback(
    async (patch: { name?: string; image?: string }) => {
      await updateProfileMutation(patch);
    },
    [updateProfileMutation],
  );

  const campaigns = useMemo(
    () => (rawCampaigns ?? rawPublicCampaigns ?? []).map((row) => toCampaign(row)),
    [rawCampaigns, rawPublicCampaigns],
  );

  const submissions = useMemo(
    () => (rawMine ?? []).map((row) => toSubmission(row, true)),
    [rawMine],
  );

  const allSubmissions = useMemo(
    () => (rawAll ?? []).map((row) => toSubmission(row, false)),
    [rawAll],
  );

  /* ---------------- writes ---------------- */

  const addAccount = useCallback(
    async (platform: Platform, handle: string) => {
      const created = await requestAccount({ platform, handle });
      if (!created) throw new Error("We couldn't start that connection.");
      return toAccount(created, true);
    },
    [requestAccount],
  );

  const verifyAccount = useCallback(
    async (id: string) => {
      const account = (rawAccounts ?? []).find((row) => row._id === id);
      if (!account) {
        return {
          verified: false,
          message: "That connection request no longer exists.",
          bio: null,
          bioRead: false,
        };
      }
      /* Only the row is named. The server reads the platform, handle and code
         from the database itself, so the browser cannot assert a
         verification or point the bio check at a different profile. */
      const result = await convex.action(api.accounts.verifyBio, {
        accountId: account._id,
      });
      return {
        verified: result.verified,
        message: result.message,
        bio: result.bio,
        bioRead: result.bioRead,
      };
    },
    [convex, rawAccounts],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      await removeAccountMutation({ accountId: accountId(id) });
    },
    [removeAccountMutation],
  );

  const toggleJoinCampaign = useCallback(
    async (id: string) => {
      /* The landing page is public. Its Join button sends signed-out visitors
         to sign in first, so there is nothing to do here without a session. */
      if (!isAuthenticated) return;
      const campaign = (rawCampaigns ?? []).find((row) => row._id === id);
      if (!campaign) return;
      if (campaign.joined) {
        await leaveCampaign({ campaignId: campaignId(id) });
      } else {
        await joinCampaign({ campaignId: campaignId(id) });
      }
    },
    [isAuthenticated, rawCampaigns, joinCampaign, leaveCampaign],
  );

  const submitClip = useCallback(
    async (input: {
      campaignId: string;
      link: string;
      caption: string;
      author: string;
      metrics?: ClipMetrics;
    }) => {
      await submitClipMutation({
        campaignId: campaignId(input.campaignId),
        link: input.link,
        caption: input.caption,
        author: input.author,
        metrics: input.metrics,
      });
    },
    [submitClipMutation],
  );

  const createCampaign = useCallback(
    async (input: {
      brand: string;
      title: string;
      logo?: string;
      brief?: string;
      referenceLinks: CampaignAsset[];
      sourceFiles: CampaignAsset[];
      ratePer1k: number;
      minViews: number;
      budget: number;
      daysLeft: number;
      platforms: Platform[];
      guidelines: string[];
    }) => {
      await createCampaignMutation(input);
    },
    [createCampaignMutation],
  );

  const updateCampaign = useCallback(
    async (id: string, patch: Partial<Campaign>) => {
      /* `id` and `joined` are client-only fields the server does not own. */
      const { id: _id, joined: _joined, ...rest } = patch;
      void _id;
      void _joined;
      await updateCampaignMutation({ campaignId: campaignId(id), patch: rest });
    },
    [updateCampaignMutation],
  );

  const setCampaignStatus = useCallback(
    async (id: string, status: Campaign["status"]) => {
      await setStatusMutation({ campaignId: campaignId(id), status });
    },
    [setStatusMutation],
  );

  const cycleInvoice = useCallback(
    async (id: string) => {
      const campaign = (rawCampaigns ?? []).find((row) => row._id === id);
      if (!campaign) return;
      const next =
        campaign.invoice === "draft"
          ? "sent"
          : campaign.invoice === "sent"
            ? "paid"
            : "draft";
      await setInvoiceMutation({ campaignId: campaignId(id), invoice: next });
    },
    [rawCampaigns, setInvoiceMutation],
  );

  const deleteCampaign = useCallback(
    async (id: string) => {
      await removeCampaignMutation({ campaignId: campaignId(id) });
    },
    [removeCampaignMutation],
  );

  const reviewSubmission = useCallback(
    async (id: string, decision: "accept" | "decline", note?: string) => {
      await reviewMutation({ submissionId: submissionId(id), decision, note });
    },
    [reviewMutation],
  );

  const settleSubmission = useCallback(
    async (id: string, status: "paid" | "rejected") => {
      await settleMutation({ submissionId: submissionId(id), status });
    },
    [settleMutation],
  );

  const value = useMemo<ClipticContextValue>(
    () => ({
      profile,
      isAdmin,
      accounts,
      allAccounts,
      accountStats,
      adminUsers,
      updateProfile,
      messages,
      unreadCount: rawUnread ?? 0,
      markAllRead,
      updatePayout,
      confirmViews,
      campaigns,
      submissions,
      allSubmissions,
      addAccount,
      verifyAccount,
      removeAccount,
      toggleJoinCampaign,
      submitClip,
      createCampaign,
      updateCampaign,
      setCampaignStatus,
      cycleInvoice,
      deleteCampaign,
      settleSubmission,
      reviewSubmission,
    }),
    [
      profile,
      isAdmin,
      accounts,
      allAccounts,
      accountStats,
      adminUsers,
      updateProfile,
      messages,
      rawUnread,
      markAllRead,
      updatePayout,
      confirmViews,
      campaigns,
      submissions,
      allSubmissions,
      addAccount,
      verifyAccount,
      removeAccount,
      toggleJoinCampaign,
      submitClip,
      createCampaign,
      updateCampaign,
      setCampaignStatus,
      cycleInvoice,
      deleteCampaign,
      settleSubmission,
      reviewSubmission,
    ],
  );

  return (
    <ClipticContext.Provider value={value}>{children}</ClipticContext.Provider>
  );
}

export function useCliptic() {
  const ctx = useContext(ClipticContext);
  if (!ctx) throw new Error("useCliptic must be used within ClipticProvider");
  return ctx;
}

/* ---------------- derived selectors ---------------- */

export function useCreatorStats() {
  const { submissions, campaigns } = useCliptic();
  return useMemo(() => {
    const mine = submissions.filter((s) => s.mine && s.status !== "rejected");
    const totalViews = mine.reduce((sum, s) => sum + s.views, 0);
    const totalEarned = mine.reduce(
      (sum, s) => sum + earnedOf(s, campaigns),
      0,
    );
    const paidOut = mine
      .filter((s) => s.status === "paid")
      .reduce((sum, s) => sum + earnedOf(s, campaigns), 0);
    const activeCampaigns = campaigns.filter(
      (c) => c.joined && c.status === "active",
    ).length;
    return {
      mine,
      totalViews,
      totalEarned,
      paidOut,
      pending: Math.max(0, totalEarned - paidOut),
      activeCampaigns,
    };
  }, [submissions, campaigns]);
}

export function useAdminStats() {
  const { allSubmissions: submissions, campaigns } = useCliptic();
  return useMemo(() => {
    const settled = submissions.filter((s) => s.status !== "rejected");
    const paidOut = settled
      .filter((s) => s.status === "paid")
      .reduce((sum, s) => sum + earnedOf(s, campaigns), 0);
    const pending = settled
      .filter((s) => s.status === "pending" || s.status === "active")
      .reduce((sum, s) => sum + earnedOf(s, campaigns), 0);
    const volume = settled.reduce((sum, s) => sum + s.views, 0);
    const reviewQueue = submissions.filter((s) => s.status === "pending").length;
    const live = campaigns.filter((c) => c.status === "active").length;
    const budget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    return { paidOut, pending, volume, reviewQueue, live, budget };
  }, [submissions, campaigns]);
}

/**
 * Clippers the brand console knows about, built from the accounts and clips
 * that actually exist. Nothing in this list is generated.
 */
export function useCreatorDirectory(): CreatorProfile[] {
  const { allAccounts, allSubmissions } = useCliptic();
  return useMemo(() => {
    return allAccounts
      .filter((account) => account.status === "connected")
      .map((account) => ({
        name: account.ownerName ?? account.handle,
        handle: account.handle,
        platform: account.platform,
        connectedAt: account.connectedAt ?? 0,
        clips: allSubmissions
          .filter(
            (submission) =>
              submission.author.toLowerCase() === account.handle.toLowerCase(),
          )
          .map((submission) => ({
            campaignId: submission.campaignId,
            platform: submission.platform,
            views: submission.views,
            status: submission.status,
            daysAgo: Math.max(
              0,
              Math.floor((Date.now() - submission.submittedAt) / 86_400_000),
            ),
          })),
      }))
      .sort((a, b) => b.connectedAt - a.connectedAt);
  }, [allAccounts, allSubmissions]);
}
