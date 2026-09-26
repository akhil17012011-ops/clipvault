import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  earnedOf,
  makeCode,
  seedCampaigns,
  uid,
  type Campaign,
  type ClipMetrics,
  type DemoProfile,
  type LinkedAccount,
  type Platform,
  type Submission,
} from "@/lib/cliptic-data";

/**
 * Client-side demo store for CLIPTIC. It powers the whole product journey
 * (bio verification, campaign joins, clip submissions, admin moderation) with
 * live view-count simulation, persisted to localStorage so a refresh keeps the
 * story intact.
 */

const STORAGE_KEY = "cliptic.demo.v3";
const TICK_MS = 2_800;
/** A fresh submission stays "in review" for a couple of ticks. */
const REVIEW_MS = 11_000;

interface ClipticState {
  profile: DemoProfile | null;
  accounts: LinkedAccount[];
  campaigns: Campaign[];
  submissions: Submission[];
}

const initialState = (): ClipticState => ({
  profile: null,
  accounts: [],
  campaigns: seedCampaigns(),
  submissions: [],
});

function loadState(): ClipticState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<ClipticState>;
    if (!parsed || !Array.isArray(parsed.campaigns) || !Array.isArray(parsed.submissions)) {
      return initialState();
    }
    return {
      profile: parsed.profile ?? null,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      campaigns: parsed.campaigns,
      submissions: parsed.submissions,
    };
  } catch {
    return initialState();
  }
}

interface ClipticContextValue extends ClipticState {
  setProfile: (profile: DemoProfile | null) => void;
  addAccount: (platform: Platform, handle: string) => LinkedAccount;
  verifyAccount: (id: string) => Promise<boolean>;
  removeAccount: (id: string) => void;
  toggleJoinCampaign: (id: string) => void;
  submitClip: (input: {
    campaignId: string;
    platform: Platform;
    link: string;
    tags: string[];
    author: string;
    verifiedOwner: boolean;
    platformOk: boolean;
    metrics: ClipMetrics;
  }) => void;
  createCampaign: (input: {
    brand: string;
    title: string;
    ratePer1k: number;
    minViews: number;
    budget: number;
    daysLeft: number;
    platforms: Platform[];
    guidelines: string[];
  }) => void;
  setCampaignStatus: (id: string, status: Campaign["status"]) => void;
  cycleInvoice: (id: string) => void;
  settleSubmission: (id: string, status: "paid" | "rejected") => void;
  /**
   * Admin moderation: accepting sends the clip to the campaign (it goes live
   * and starts earning), declining removes it and tells the creator why.
   */
  reviewSubmission: (
    id: string,
    decision: "accept" | "decline",
    note?: string,
  ) => void;
  resetDemo: () => void;
}

const ClipticContext = createContext<ClipticContextValue | null>(null);

export function ClipticProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClipticState>(loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — demo still works in-memory */
    }
  }, [state]);

  /* Live simulation: view counts climb, earnings accrue, reviews clear. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        let changed = false;
        const submissions = prev.submissions.map((sub) => {
          if (sub.status === "paid" || sub.status === "rejected") return sub;
          changed = true;
          /* Only clips an admin has accepted go live and start earning. */
          if (sub.status === "active") {
            const growth =
              Math.floor(Math.random() * 3_600) + 400 +
              Math.floor(sub.views * 0.004);
            return {
              ...sub,
              views: sub.views + growth,
              metrics: sub.metrics
                ? { ...sub.metrics, views: sub.metrics.views + growth }
                : undefined,
            };
          }
          return sub;
        });
        return changed ? { ...prev, submissions } : prev;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const setProfile = useCallback((profile: DemoProfile | null) => {
    setState((prev) => ({ ...prev, profile }));
  }, []);

  const addAccount = useCallback((platform: Platform, handle: string) => {
    const account: LinkedAccount = {
      id: uid(),
      platform,
      handle: handle.replace(/^@+/, ""),
      code: makeCode(),
      status: "pending",
    };
    setState((prev) => ({ ...prev, accounts: [...prev.accounts, account] }));
    return account;
  }, []);

  const verifyAccount = useCallback((id: string) => {
    return new Promise<boolean>((resolve) => {
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === id ? { ...a, status: "checking" } : a,
        ),
      }));
      window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === id
              ? { ...a, status: "connected", connectedAt: Date.now() }
              : a,
          ),
        }));
        resolve(true);
      }, 1_900);
    });
  }, []);

  const removeAccount = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  }, []);

  const toggleJoinCampaign = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((c) =>
        c.id === id
          ? {
              ...c,
              joined: !c.joined,
              clippers: c.clippers + (c.joined ? -1 : 1),
            }
          : c,
      ),
    }));
  }, []);

  const submitClip = useCallback(
    (input: {
      campaignId: string;
      platform: Platform;
      link: string;
      tags: string[];
      author: string;
      verifiedOwner: boolean;
      platformOk: boolean;
      metrics: ClipMetrics;
    }) => {
      setState((prev) => {
        const campaign = prev.campaigns.find(
          (c) => c.id === input.campaignId,
        );
        /* The platform must be one the campaign actually accepts, and the
           clip must come from one of the creator's verified accounts. */
        if (
          !campaign ||
          !input.platformOk ||
          !campaign.platforms.includes(input.platform) ||
          !input.verifiedOwner
        ) {
          return prev;
        }
        const submission: Submission = {
          id: uid(),
          campaignId: input.campaignId,
          creator: "you",
          mine: true,
          platform: input.platform,
          link: input.link,
          tags: input.tags,
          author: input.author,
          verifiedOwner: input.verifiedOwner,
          platformOk: input.platformOk,
          metrics: input.metrics,
          views: input.metrics.views,
          /* Queued for a human — it only goes live once an admin accepts. */
          status: "pending",
          submittedAt: Date.now(),
        };
        return { ...prev, submissions: [submission, ...prev.submissions] };
      });
    },
    [],
  );

  const createCampaign = useCallback(
    (input: {
      brand: string;
      title: string;
      ratePer1k: number;
      minViews: number;
      budget: number;
      daysLeft: number;
      platforms: Platform[];
      guidelines: string[];
    }) => {
      const campaign: Campaign = {
        id: uid(),
        ...input,
        spent: 0,
        clippers: 0,
        status: "active",
        invoice: "draft",
        joined: false,
        createdAt: Date.now(),
      };
      setState((prev) => ({ ...prev, campaigns: [campaign, ...prev.campaigns] }));
    },
    [],
  );

  const setCampaignStatus = useCallback(
    (id: string, status: Campaign["status"]) => {
      setState((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) =>
          c.id === id ? { ...c, status } : c,
        ),
      }));
    },
    [],
  );

  const cycleInvoice = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((c) => {
        if (c.id !== id) return c;
        const next =
          c.invoice === "draft" ? "sent" : c.invoice === "sent" ? "paid" : "draft";
        return { ...c, invoice: next };
      }),
    }));
  }, []);

  const reviewSubmission = useCallback(
    (id: string, decision: "accept" | "decline", note?: string) => {
      setState((prev) => {
        const target = prev.submissions.find((s) => s.id === id);
        if (!target || target.status !== "pending") return prev;
        const accepted = decision === "accept";
        return {
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: accepted ? ("active" as const) : ("rejected" as const),
                  reviewNote: accepted ? undefined : (note ?? "Didn't meet the campaign brief."),
                }
              : s,
          ),
          /* An accepted clip joins the campaign it was sent to. */
          campaigns: accepted
            ? prev.campaigns.map((c) =>
                c.id === target.campaignId
                  ? { ...c, clippers: c.clippers + 1 }
                  : c,
              )
            : prev.campaigns,
        };
      });
    },
    [],
  );

  const settleSubmission = useCallback(
    (id: string, status: "paid" | "rejected") => {
      setState((prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === id ? { ...s, status } : s,
        ),
      }));
    },
    [],
  );

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState((prev) => ({ ...initialState(), profile: prev.profile }));
  }, []);

  const value = useMemo<ClipticContextValue>(
    () => ({
      ...state,
      setProfile,
      addAccount,
      verifyAccount,
      removeAccount,
      toggleJoinCampaign,
      submitClip,
      createCampaign,
      setCampaignStatus,
      cycleInvoice,
      settleSubmission,
      reviewSubmission,
      resetDemo,
    }),
    [
      state,
      setProfile,
      addAccount,
      verifyAccount,
      removeAccount,
      toggleJoinCampaign,
      submitClip,
      createCampaign,
      setCampaignStatus,
      cycleInvoice,
      settleSubmission,
      reviewSubmission,
      resetDemo,
    ],
  );

  return <ClipticContext.Provider value={value}>{children}</ClipticContext.Provider>;
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
  const { submissions, campaigns } = useCliptic();
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
