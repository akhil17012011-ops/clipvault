import { PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtCents, fmtFull, fmtViews } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Clapperboard,
  Eye,
  Loader2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useQuery } from "convex/react";

function when(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * One creator, in full, for the operator.
 *
 * The Users list answers "who is on the platform". This answers the question
 * that actually matters before putting a campaign in front of someone: what have
 * they verified, how big is it, what do their clips average, and what have they
 * been posting lately. Every figure comes from the same records a payout is
 * built from, so it cannot flatter anyone.
 */
export function UserDetail({
  userId,
  onClose,
}: {
  userId: Id<"users"> | null;
  onClose: () => void;
}) {
  const detail = useQuery(
    api.leaderboard.userDetail,
    userId ? { userId } : "skip",
  );

  if (!userId) return null;
  /* `null` is the server saying there is no such user any more; there is
     nothing to show, so the panel closes rather than rendering a half-empty
     profile. */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 60, opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="glass-panel flex h-full w-full max-w-lg flex-col overflow-y-auto rounded-l-3xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {detail?.image ? (
              <img
                src={detail.image}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] to-[#5B0FA6] text-sm font-bold text-white">
                {(detail?.name ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold tracking-tight">
                {detail?.name ?? "Loading…"}
              </p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {detail?.email}
              </p>
              {detail && (
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3 w-3" />
                    {detail.role}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    joined {when(detail.joined)}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {detail === undefined || detail === null ? (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading their numbers…
          </p>
        ) : (
          <>
            {/* Averages first: the figures an operator decides on. */}
            <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                {
                  label: "Views",
                  value: fmtViews(detail.totals.views),
                  icon: Eye,
                },
                {
                  label: "Avg / clip",
                  value: fmtViews(detail.totals.avgViews),
                  icon: BarChart3,
                },
                {
                  label: "Best clip",
                  value: fmtViews(detail.totals.bestViews),
                  icon: Clapperboard,
                },
                {
                  label: "Earned",
                  value: fmtCents(detail.totals.earnedCents),
                  icon: Wallet,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/[0.07] bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.02]"
                >
                  <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-mono text-[16px] font-extrabold tracking-tight">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-2.5 text-[11.5px] text-muted-foreground">
              {detail.totals.accounts} verified account
              {detail.totals.accounts === 1 ? "" : "s"} · {fmtFull(detail.totals.followers)}{" "}
              followers · {detail.totals.clips} clips ·{" "}
              {detail.totals.campaigns} campaign
              {detail.totals.campaigns === 1 ? "" : "s"}
            </p>

            <h3 className="mt-6 flex items-center gap-2 text-[13px] font-bold">
              <BadgeCheck className="h-4 w-4 text-brand" />
              Connected accounts
            </h3>
            {detail.accounts.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-black/12 px-4 py-6 text-center text-xs text-muted-foreground dark:border-white/15">
                Nothing connected — this account cannot earn yet.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {detail.accounts.map((account) => (
                  <li
                    key={account.id}
                    className="glass-chip rounded-xl px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <PlatformChip platform={account.platform} size="sm" />
                      <span className="text-[13px] font-semibold">
                        @{account.handle}
                      </span>
                      <StatusBadge status={account.status} />
                      {account.connectedAt && (
                        <span className="ml-auto text-[10.5px] text-muted-foreground">
                          verified {when(account.connectedAt)}
                        </span>
                      )}
                    </div>
                    <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-2.5 sm:grid-cols-4">
                      {[
                        ["Followers", account.followers != null ? fmtViews(account.followers) : "—"],
                        ["Posts", account.posts != null ? fmtFull(account.posts) : "—"],
                        ["Views", fmtViews(account.views)],
                        ["Earned", account.earnedCents > 0 ? fmtCents(account.earnedCents) : "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-0.5 font-mono text-[12.5px] font-bold">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {account.followers == null && account.status === "connected" && (
                      <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                        This platform does not publish a follower count.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-6 flex items-center gap-2 text-[13px] font-bold">
              <Clapperboard className="h-4 w-4 text-brand" />
              Latest uploads
            </h3>
            {detail.uploads.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-black/12 px-4 py-6 text-center text-xs text-muted-foreground dark:border-white/15">
                No clips submitted yet.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {detail.uploads.map((clip) => (
                  <li
                    key={clip.id}
                    className="rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformChip platform={clip.platform} size="sm" />
                      <a
                        href={clip.link}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[12.5px] font-semibold underline-offset-4 hover:underline"
                      >
                        @{clip.author}
                      </a>
                      <StatusBadge status={clip.status} />
                      <span className="ml-auto text-[10.5px] text-muted-foreground">
                        {when(clip.submittedAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {clip.brand} · {clip.campaign}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
                      <span className="font-mono font-bold">
                        {fmtViews(clip.views)} views
                      </span>
                      {clip.likes != null && (
                        <span className="text-muted-foreground">
                          {fmtFull(clip.likes)} likes
                        </span>
                      )}
                      {clip.comments != null && (
                        <span className="text-muted-foreground">
                          {fmtFull(clip.comments)} comments
                        </span>
                      )}
                      {clip.viewsConfirmed && (
                        <span className="text-neon">confirmed</span>
                      )}
                      <span className="ml-auto font-mono font-bold text-neon">
                        {clip.earnedCents > 0
                          ? fmtCents(clip.earnedCents)
                          : "below threshold"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
