import { useClipVault } from "@/lib/clip-vault-store";
import type { LinkedAccount } from "@/lib/clip-vault-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * How often the page re-checks the counts of its connected accounts.
 *
 * Every ten minutes. This used to be once a second, which looked lively and
 * was actively harmful: every tick is a real request from this deployment's
 * shared IP, and a follower count does not change measurably in a second.
 * Hammering Instagram that hard is what earns a `429` for the whole deployment,
 * so a fast poll made the numbers *less* available, not more.
 *
 * Ten minutes is a deliberate trade: a count that moves meaningfully is picked
 * up within ten minutes without the platform ever seeing enough traffic to
 * throttle us. A person who cannot wait ten minutes has the Sync button, which
 * asks once, on purpose, and is exempt from the cooldown.
 */
export const LIVE_FOLLOWER_INTERVAL_MS = 10 * 60_000;

/**
 * Keeps the follower and post counts of the given accounts current.
 *
 * The counts are read from the platforms on the server, not guessed here, and
 * the rows are written back through Convex — so the numbers on screen are the
 * platform's own, and every other view of them (tiles, per-account stats, the
 * leaderboard) updates from the same rows at the same time.
 *
 * It also reports *why* a count is missing. A refused lookup, a lost
 * connection and a platform that simply publishes no count are three
 * different situations for the creator; collapsing them into one blank line
 * is how a broken call ends up reading as "not published", which blames the
 * platform for something on our side.
 */
export function useLiveFollowers(
  accounts: LinkedAccount[],
  enabled = true,
): {
  syncedAt: number | null;
  reason: string | null;
  /**
   * Asks one account to be re-read now, ignoring the cooldown and the backoff.
   *
   * This is what the Sync button calls. The poller deliberately gives up on a
   * platform that is refusing us and waits, which is right for a background
   * read and useless for a person who has just posted or just pasted a new
   * token — so the escape hatch is a single explicit request, not a faster
   * timer.
   */
  syncNow: (id: string) => Promise<void>;
  /** Ids with a read in flight, for the button's own spinner. */
  syncing: string[];
} {
  const { refreshAccountStats } = useClipVault();
  /* When the platforms were last really asked, as reported by the server.
     This is deliberately not "when we last polled": inside the server's
     cooldown a poll is answered from the stored row, and stamping that poll
     with the current time would show "read 1s ago" about numbers that are
     actually minutes old. */
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  /* The server's own explanation for a missing count, if it gave one. */
  const [reason, setReason] = useState<string | null>(null);

  /* Only verified accounts have a count worth refreshing, and the joined ids
     are the effect's identity — a plain array would be a new reference on
     every render and would restart the timer continuously. */
  const ids = useMemo(
    () =>
      accounts
        .filter((a) => a.status === "connected")
        .map((a) => a.id)
        .sort()
        .join(","),
    [accounts],
  );

  const inFlight = useRef(false);
  const [syncing, setSyncing] = useState<string[]>([]);

  const syncNow = useCallback(
    async (id: string) => {
      setSyncing((current) =>
        current.includes(id) ? current : [...current, id],
      );
      try {
        const result = await refreshAccountStats(id, { force: true });
        setReason(result.ok ? null : (result.reason ?? null));
        if (result.refreshedAt != null) {
          setSyncedAt((prev) => Math.max(prev ?? 0, result.refreshedAt!));
        }
      } catch (err) {
        /* A failed press still has to say something. A Sync button that
           silently does nothing is indistinguishable from a broken one. */
        setReason(
          err instanceof Error && err.message
            ? err.message
            : "We couldn't reach Clip Vault to sync that account.",
        );
      } finally {
        setSyncing((current) => current.filter((value) => value !== id));
      }
    },
    [refreshAccountStats],
  );

  useEffect(() => {
    if (!enabled || !ids) return;

    let cancelled = false;
    const targets = ids.split(",");

    const tick = async () => {
      if (cancelled || inFlight.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      inFlight.current = true;
      try {
        const results = await Promise.all(
          targets.map((id) =>
            refreshAccountStats(id).catch((err: unknown) => ({
              ok: false,
              fetched: false,
              followers: null,
              posts: null,
              refreshedAt: null,
              /* A call that produced no result at all — a missing function
                 after a partial publish, a lost connection, an auth failure —
                 must not vanish. Silently dropping it is what made a broken
                 call read as "not published by the platform", blaming the
                 platform for something on our side. */
              reason:
                err instanceof Error && err.message
                  ? err.message
                  : "We couldn't refresh this count from Clip Vault.",
            })),
          ),
        );
        /* The freshest real read across the accounts drives the label. A
           result without a timestamp (account gone, call failed) never
           advances it, and it can only move forward — a slower poll landing
           after a faster one must not drag the label backwards. */
        const times = results
          .map((r) => r.refreshedAt)
          .filter((t): t is number => t != null);
        if (!cancelled && times.length > 0) {
          setSyncedAt((prev) => Math.max(prev ?? 0, ...times));
        }
        if (!cancelled) {
          /* Any count still missing keeps its explanation; a batch with no
             failures clears it, so the hint never holds a stale reason. */
          const explanations = results
            .map((r) => (r.ok ? null : (r.reason ?? null)))
            .filter((r): r is string => r != null);
          setReason(
            explanations.length > 0
              ? explanations[explanations.length - 1]
              : null,
          );
        }
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, LIVE_FOLLOWER_INTERVAL_MS);

    /* Coming back to the tab refreshes straight away rather than waiting out
       whatever was left of the interval. */
    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, ids, refreshAccountStats]);

  return { syncedAt, reason, syncNow, syncing };
}
