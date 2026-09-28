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
  countedViews,
  earnedOf,
  type AccountStats,
  type AdminUser,
  type AdminMessage,
  type CreatorMessage,
  type AdminPayoutRequest,
  type EarningEntry,
  type PayoutMethod,
  type PayoutRequest,
  type UsdtNetwork,
  type Wallet,
  type Campaign,
  type CampaignAsset,
  type ClipMetrics,
  type CreatorProfile,
  type LinkedAccount,
  type Platform,
  type Submission,
} from "@/lib/clip-vault-data";

/**
 * Clip Vault's data layer.
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
  name: string;
  email: string;
  avatarUrl?: string;
}

interface ClipVaultContextValue {
  profile: Profile | null;
  /** True when the signed-in user is a Clip Vault operator. */
  isAdmin: boolean;
  accounts: LinkedAccount[];
  /** Admin-only: every connected account on the platform. */
  allAccounts: LinkedAccount[];
  /** Clips, views and earnings for each of my own connected accounts. */
  accountStats: AccountStats[];
  /** My inbox: system notices and direct messages from Clip Vault. */
  messages: CreatorMessage[];
  /** Unread messages, for the bell badge. */
  unreadCount: number;
  markAllRead: () => Promise<void>;

  /* ---- money ---- */
  /** My balance: available, locked in a request, and lifetime. */
  wallet: Wallet;
  /** Every payout I have requested, newest first. */
  payoutRequests: PayoutRequest[];
  /** Every movement of my money, newest first. */
  earnings: EarningEntry[];
  /**
   * Ask to be paid. The method and address belong to this request only — there
   * is no saved wallet.
   */
  requestPayout: (input: {
    amountCents: number;
    method: PayoutMethod;
    network?: UsdtNetwork;
    address: string;
  }) => Promise<void>;
  /** Admin-only: every payout request on the platform. */
  adminPayoutRequests: AdminPayoutRequest[];
  /** Admin-only: mark a request paid and release the pending balance. */
  markPayoutPaid: (id: string, reference?: string) => Promise<void>;
  /** Admin-only: reject a request, return the money, and explain why. */
  rejectPayout: (id: string, reason: string) => Promise<void>;
  /** Admin: overwrite a clip's view count with the measured figure. */
  confirmViews: (id: string, views: number) => Promise<void>;
  /** Admin-only: every user with their accounts and totals. */
  adminUsers: AdminUser[];
  /** Admin-only: every message sent on the platform. */
  adminMessages: AdminMessage[];
  /** Admin-only: message one creator. */
  sendToCreator: (userId: string, title: string, body: string) => Promise<void>;
  /** Admin-only: message every creator. Returns how many inboxes it wrote. */
  broadcast: (title: string, body: string) => Promise<number>;
  /** Change the display name and picture shown across Clip Vault. */
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
  /**
   * Re-read one connected account's follower and post count from its platform.
   *
   * Only the row is named — the server reads the handle, the platform and the
   * ownership check from the database itself. Used by the live follower
   * poller; the counts it writes are ordinary reactive rows, so everything
   * that shows a follower number updates from the same write. The server may
   * answer from the row it already holds (see the cooldown in
   * `accounts.refreshStats`), which is why the result carries the time of the
   * last real platform read rather than this call's own timestamp.
   */
  refreshAccountStats: (
    id: string,
  ) => Promise<{
    ok: boolean;
    fetched: boolean;
    followers: number | null;
    posts: number | null;
    refreshedAt: number | null;
    reason?: string;
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
}

const ClipVaultContext = createContext<ClipVaultContextValue | null>(null);

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
const userId = (id: string) => id as GenericId<"users">;
const payoutRequestId = (id: string) => id as GenericId<"payoutRequests">;

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
  viewsConfirmed?: boolean;
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
  /* Absent means never verified, which is worth zero — the same as false. */
  viewsConfirmed: row.viewsConfirmed ?? false,
  status: row.status,
  submittedAt: row.submittedAt,
  reviewNote: row.reviewNote,
});

/* ------------------------------------------------------------------ */

export function ClipVaultProvider({ children }: { children: ReactNode }) {
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
  const requestPayoutMutation = useMutation(api.payouts.requestPayout);
  const markPayoutPaidMutation = useMutation(api.payouts.markPaid);
  const rejectPayoutMutation = useMutation(api.payouts.markRejected);
  const rawWallet = useQuery(api.payouts.myWallet, isAuthenticated ? {} : SKIP);
  const rawRequests = useQuery(
    api.payouts.myRequests,
    isAuthenticated ? {} : SKIP,
  );
  const rawEarnings = useQuery(
    api.payouts.myEarnings,
    isAuthenticated ? {} : SKIP,
  );
  const rawAdminRequests = useQuery(
    api.payouts.allRequests,
    isAdmin ? {} : SKIP,
  );
  const confirmViewsMutation = useMutation(api.submissions.confirmViews);
  const rawAdminMessages = useQuery(api.messages.listAll, isAdmin ? {} : SKIP);
  const sendToCreatorMutation = useMutation(api.messages.sendToCreator);
  const broadcastMutation = useMutation(api.messages.broadcast);

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
  const updateProfileMutation = useMutation(api.users.updateProfile);

  /* The profile is the real auth record, not anything the browser can set. */
  const profile: Profile | null = useMemo(() => {
    if (!user) return null;
    return {
      name: user.name ?? user.email?.split("@")[0] ?? "Creator",
      email: user.email ?? "",
      avatarUrl: user.image,
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

  /* ---- money ---- */

  const wallet = useMemo<Wallet>(
    () => ({
      availableCents: rawWallet?.availableCents ?? 0,
      pendingCents: rawWallet?.pendingCents ?? 0,
      lifetimeCents: rawWallet?.lifetimeCents ?? 0,
      minWithdrawalCents: rawWallet?.minWithdrawalCents ?? 500,
    }),
    [rawWallet],
  );

  const payoutRequests = useMemo(
    () => (rawRequests ?? []) as PayoutRequest[],
    [rawRequests],
  );

  const earnings = useMemo(
    () => (rawEarnings ?? []) as EarningEntry[],
    [rawEarnings],
  );

  const adminPayoutRequests = useMemo(
    () => (rawAdminRequests ?? []) as AdminPayoutRequest[],
    [rawAdminRequests],
  );

  const requestPayout = useCallback(
    async (input: {
      amountCents: number;
      method: PayoutMethod;
      network?: UsdtNetwork;
      address: string;
    }) => {
      await requestPayoutMutation(input);
    },
    [requestPayoutMutation],
  );

  const markPayoutPaid = useCallback(
    async (id: string, reference?: string) => {
      await markPayoutPaidMutation({
        requestId: payoutRequestId(id),
        reference,
      });
    },
    [markPayoutPaidMutation],
  );

  const rejectPayout = useCallback(
    async (id: string, reason: string) => {
      await rejectPayoutMutation({
        requestId: payoutRequestId(id),
        reason,
      });
    },
    [rejectPayoutMutation],
  );

  const confirmViews = useCallback(
    async (id: string, views: number) => {
      await confirmViewsMutation({ submissionId: submissionId(id), views });
    },
    [confirmViewsMutation],
  );

  const adminMessages = useMemo(
    () => (rawAdminMessages ?? []) as AdminMessage[],
    [rawAdminMessages],
  );

  const sendToCreator = useCallback(
    async (target: string, title: string, body: string) => {
      await sendToCreatorMutation({ userId: userId(target), title, body });
    },
    [sendToCreatorMutation],
  );

  const broadcast = useCallback(
    async (title: string, body: string) =>
      (await broadcastMutation({ title, body })) as number,
    [broadcastMutation],
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

  const refreshAccountStats = useCallback(
    async (id: string) => {
      /* Deliberately not reading the row out of `rawAccounts` first: the
         server checks that this caller owns the account anyway, and a stable
         callback keeps the 2-second poller from restarting on every render. */
      const result = (await convex.action(api.accounts.refreshStats, {
        accountId: accountId(id),
      })) as {
        ok: boolean;
        fetched: boolean;
        followers: number | null;
        posts: number | null;
        refreshedAt: number | null;
        reason?: string;
      };
      return result;
    },
    [convex],
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

  const value = useMemo<ClipVaultContextValue>(
    () => ({
      profile,
      isAdmin,
      accounts,
      allAccounts,
      accountStats,
      adminUsers,
      adminMessages,
      sendToCreator,
      broadcast,
      updateProfile,
      messages,
      unreadCount: rawUnread ?? 0,
      markAllRead,
      wallet,
      payoutRequests,
      earnings,
      requestPayout,
      adminPayoutRequests,
      markPayoutPaid,
      rejectPayout,
      confirmViews,
      campaigns,
      submissions,
      allSubmissions,
      addAccount,
      verifyAccount,
      refreshAccountStats,
      removeAccount,
      toggleJoinCampaign,
      submitClip,
      createCampaign,
      updateCampaign,
      setCampaignStatus,
      cycleInvoice,
      deleteCampaign,
      reviewSubmission,
    }),
    [
      profile,
      isAdmin,
      accounts,
      allAccounts,
      accountStats,
      adminUsers,
      adminMessages,
      sendToCreator,
      broadcast,
      updateProfile,
      messages,
      rawUnread,
      markAllRead,
      wallet,
      payoutRequests,
      earnings,
      requestPayout,
      adminPayoutRequests,
      markPayoutPaid,
      rejectPayout,
      confirmViews,
      campaigns,
      submissions,
      allSubmissions,
      addAccount,
      verifyAccount,
      refreshAccountStats,
      removeAccount,
      toggleJoinCampaign,
      submitClip,
      createCampaign,
      updateCampaign,
      setCampaignStatus,
      cycleInvoice,
      deleteCampaign,
      reviewSubmission,
    ],
  );

  return (
    <ClipVaultContext.Provider value={value}>{children}</ClipVaultContext.Provider>
  );
}

export function useClipVault() {
  const ctx = useContext(ClipVaultContext);
  if (!ctx) throw new Error("useClipVault must be used within ClipVaultProvider");
  return ctx;
}

/* ---------------- derived selectors ---------------- */

export function useCreatorStats() {
  const { submissions, campaigns } = useClipVault();
  return useMemo(() => {
    const mine = submissions.filter((s) => s.mine && s.status !== "rejected");
    /* Two different numbers, and the difference matters. `totalViews` is what
       a creator can actually bank: only clips an operator has verified count.
       `awaitingViews` is the view count sitting on clips still waiting for
       that check — real reach, but not yet worth anything. Collapsing them
       into one figure would promise money the server has not released. */
    const totalViews = mine.reduce((sum, s) => sum + countedViews(s), 0);
    const awaitingViews = mine
      .filter((s) => !s.viewsConfirmed)
      .reduce((sum, s) => sum + s.views, 0);
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
      awaitingViews,
      awaitingClips: mine.filter((s) => !s.viewsConfirmed).length,
      totalEarned,
      paidOut,
      pending: Math.max(0, totalEarned - paidOut),
      activeCampaigns,
    };
  }, [submissions, campaigns]);
}

export function useAdminStats() {
  const { allSubmissions: submissions, campaigns } = useClipVault();
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
  const { allAccounts, allSubmissions } = useClipVault();
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
