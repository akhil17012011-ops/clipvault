import { PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
import { Button } from "@/components/ui/button";
import {
  fmtFull,
  fmtMoney,
  fmtViews,
  PLATFORMS,
  PLATFORM_META,
  type AccountStats,
  type LinkedAccount,
  type Platform,
  type Submission,
} from "@/lib/clip-vault-data";
import { useLiveFollowers } from "@/lib/live-followers";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Link2,
  Plus,
  ScanSearch,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  accounts: LinkedAccount[];
  stats: AccountStats[];
  /** The creator's own clips, for the averages this page shows. */
  clips: Submission[];
  onConnect: (platform?: Platform) => void;
  onRemove: (id: string) => void;
};

function joined(ms: number | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The creator's connected accounts.
 *
 * An account is the thing that makes a clip earn: views are only counted from a
 * handle that passed the bio check, so this page is really "which of my handles
 * are we actually watching". It shows that plainly — one row per handle, what
 * each has produced, and the code still waiting to be pasted into a bio.
 *
 * More than one account per platform is normal, so the add buttons name the
 * platform instead of offering a single ambiguous "connect".
 */
export function AccountsView({
  accounts,
  stats,
  clips,
  onConnect,
  onRemove,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Follower counts are re-read from the platforms every couple of seconds
     while this page is open, so the numbers here are the platform's current
     ones rather than whatever was true when the bio was verified. */
  const { syncedAt, reason } = useLiveFollowers(accounts);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const connected = accounts.filter((a) => a.status === "connected");
  const pending = accounts.filter((a) => a.status !== "connected");

  const followers = connected.reduce(
    (sum, a) => sum + (a.followers ?? 0),
    0,
  );
  /* A platform that never published a count leaves it null. Summing nulls as
     zero would tell the creator they have no followers, which is a different
     and much worse claim than "this platform has not told us". So the tile
     only shows a number when at least one account actually published one. */
  const anyFollowersKnown = connected.some((a) => a.followers != null);
  const anyPostsKnown = connected.some((a) => a.posts != null);

  /* The hint has to say what actually happened. Green is reserved for a
     count that is genuinely live; everything else is an honest amber note —
     either the server's own explanation for the missing count, or "not
     published" when a platform answered us without publishing one. */
  const hintLive = anyFollowersKnown;
  const liveNote =
    connected.length === 0
      ? null
      : hintLive
        ? syncedAt == null
          ? "Reading live…"
          : `Live · read ${Math.max(0, Math.round((now - syncedAt) / 1000))}s ago`
        : (reason ?? "Not published by the platform");

  const clipCount = stats.reduce((sum, s) => sum + s.clips, 0);
  const views = stats.reduce((sum, s) => sum + s.views, 0);
  const earned = stats.reduce((sum, s) => sum + s.earned, 0);
  const live = clips.filter((c) => c.status !== "rejected");
  const avgViews = live.length > 0 ? Math.round(views / live.length) : 0;
  const bestViews = live.reduce((max, c) => Math.max(max, c.views), 0);
  const platforms = [...new Set(connected.map((a) => a.platform))];

  const countOn = (platform: Platform) =>
    accounts.filter((a) => a.platform === platform).length;

  const copy = async (account: LinkedAccount) => {
    try {
      await navigator.clipboard.writeText(account.code);
      setCopiedId(account.id);
      window.setTimeout(() => setCopiedId(null), 1_800);
    } catch {
      /* clipboard unavailable — the code is selectable on screen */
    }
  };

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
              <BadgeCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">
                Connected accounts
              </h2>
              <p className="text-xs text-muted-foreground">
                Views only count from a handle we verified in your bio
              </p>
            </div>
          </div>
          <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {connected.length}/{accounts.length} verified
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "Verified", value: `${connected.length}`, hint: null },
            {
              label: "Followers",
              value: anyFollowersKnown ? fmtViews(followers) : "—",
              hint: liveNote,
            },
            { label: "Clips", value: fmtFull(clipCount), hint: null },
            { label: "Views", value: fmtViews(views), hint: null },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/[0.07] bg-black/[0.02] px-3.5 py-2.5 dark:bg-white/[0.02]"
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 font-mono text-[17px] font-extrabold tracking-tight">
                {item.value}
              </dd>
              {item.hint && (
                <p
                  className={`mt-1 flex items-start gap-1.5 text-[10px] leading-snug font-semibold ${
                    hintLive
                      ? "text-neon"
                      : "text-amber-500/90 dark:text-amber-300/90"
                  }`}
                >
                  <span
                    className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      hintLive ? "animate-pulse bg-neon" : "bg-amber-400"
                    }`}
                  />
                  <span className="min-w-0 break-words">{item.hint}</span>
                </p>
              )}
            </div>
          ))}
        </dl>

        {earned > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            These accounts have earned{" "}
            <span className="font-mono font-semibold text-neon">
              {fmtMoney(earned)}
            </span>{" "}
            so far.
          </p>
        )}

        {/* The averages a creator actually judges themselves by, computed from
            the same clips the payouts are made from. */}
        <dl className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/[0.07] pt-4 sm:grid-cols-4">
          {[
            { label: "Avg views / clip", value: fmtViews(avgViews) },
            { label: "Best clip", value: fmtViews(bestViews) },
            {
              label: "Platforms",
              value: platforms.length > 0 ? `${platforms.length}` : "—",
            },
            {
              label: "Posts live",
              value: anyPostsKnown
                ? fmtFull(
                    connected.reduce((sum, a) => sum + (a.posts ?? 0), 0),
                  )
                : "—",
            },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 font-mono text-[15px] font-extrabold tracking-tight">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </motion.section>

      {pending.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="flex items-center gap-2.5">
            <TriangleAlert className="h-4 w-4 text-amber-300" />
            <h3 className="text-[15px] font-bold tracking-tight">
              Waiting on a bio code
            </h3>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            These handles are not earning yet. Paste the code into the account
            bio, save it, then open the account again and hit Verify.
          </p>
          <ul className="mt-4 space-y-2.5">
            {pending.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-3.5 py-3"
              >
                <PlatformChip platform={account.platform} size="sm" />
                <span className="font-mono text-[13px] font-semibold">
                  @{account.handle}
                </span>
                <span className="select-all rounded-lg bg-black/[0.04] px-2.5 py-1 font-mono text-[13px] font-extrabold tracking-[0.06em] dark:bg-white/[0.06]">
                  {account.code}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="glass-chip gap-1.5"
                  onClick={() => void copy(account)}
                >
                  {copiedId === account.id ? (
                    <Check className="h-3.5 w-3.5 text-neon" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {copiedId === account.id ? "Copied" : "Copy"}
                </Button>
                <StatusBadge status={account.status} />
                <button
                  type="button"
                  onClick={() => setConfirmId(account.id)}
                  title="Remove this account"
                  className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel rounded-2xl p-5"
      >
        <h3 className="text-[15px] font-bold tracking-tight">
          {connected.length === 0 ? "No accounts verified yet" : "Verified"}
        </h3>

        {connected.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-sm text-muted-foreground dark:border-white/15">
            Connect a handle below and views from it start counting.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {connected.map((account) => {
              const stat = stats.find((s) => s.accountId === account.id);
              return (
                <li
                  key={account.id}
                  className="glass-chip rounded-xl px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <PlatformChip platform={account.platform} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        @{account.handle}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[
                          account.followers != null
                            ? `${fmtViews(account.followers)} followers${
                                liveNote ? " · live" : ""
                              }`
                            : null,
                          account.posts != null
                            ? `${fmtFull(account.posts)} posts`
                            : null,
                          joined(account.connectedAt)
                            ? `connected ${joined(account.connectedAt)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Verified — reach not published"}
                      </p>
                    </div>
                    {stat && stat.earned > 0 && (
                      <span className="shrink-0 font-mono text-[13px] font-bold text-neon">
                        {fmtMoney(stat.earned)}
                      </span>
                    )}
                    <StatusBadge status={account.status} />
                    <button
                      type="button"
                      onClick={() => setConfirmId(account.id)}
                      title="Disconnect account"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {stat && (
                    <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-2.5">
                      {[
                        ["Clips", fmtFull(stat.clips)],
                        ["Views", fmtViews(stat.views)],
                        [
                          "Earned",
                          stat.earned > 0 ? fmtMoney(stat.earned) : "—",
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-0.5 font-mono text-[13px] font-bold">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Add another account
        </p>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onConnect(p)}
              className="panel-fx flex items-center gap-2.5 rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-3 text-left transition-colors hover:border-brand/40 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <PlatformChip platform={p} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">
                  {PLATFORM_META[p].label}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {countOn(p) === 0
                    ? "None connected"
                    : `${countOn(p)} connected — add another`}
                </span>
              </span>
              {countOn(p) > 0 ? (
                <Plus className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ScanSearch className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </motion.section>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-[15px] font-bold">Remove this account?</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Clips already published from it keep their views, but any new
              clips from this handle stop being credited to you until you
              connect it again.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmId(null)}
              >
                Keep it
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-500"
                onClick={() => {
                  onRemove(confirmId);
                  setConfirmId(null);
                }}
              >
                Remove account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
