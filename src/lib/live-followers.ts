import { useClipVault } from "@/lib/clip-vault-store";
import type { LinkedAccount } from "@/lib/clip-vault-data";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * How often follower counts are re-read from the platforms.
 *
 * Every tick is a real HTTP lookup against TikTok, Instagram, YouTube or X.
 * Two seconds is a deliberately aggressive, "watch it move" cadence for the
 * page a creator is actively looking at; raise it if a platform starts
 * refusing the lookups — the stored count survives a refusal either way, so a
 * slower tick is always safe.
 */
export const LIVE_FOLLOWER_INTERVAL_MS = 2_000;

/**
 * Keeps the follower and post counts of the given accounts current.
 *
 * The counts are read from the platforms on the server, not guessed here, and
 * the rows are written back through Convex — so the numbers on screen are the
 * platform's own, and every other view of them (tiles, per-account stats, the
 * leaderboard) updates from the same rows at the same time.
 *
 * Two things keep this from hammering the platforms from a background tab:
 * it skips ticks while the document is hidden, and it never runs a second
 * batch while one is still in flight. A tick that fails leaves the previous
 * count exactly as it was — the page shows a real number or nothing, never a
 * zero invented by a dropped request.
 */
export function useLiveFollowers(
  accounts: LinkedAccount[],
  enabled = true,
): { syncedAt: number | null } {
  const { refreshAccountStats } = useClipVault();
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

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

  useEffect(() => {
    if (!enabled || !ids) return;

    let cancelled = false;
    const targets = ids.split(",");

    const tick = async () => {
      if (cancelled || inFlight.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      inFlight.current = true;
      try {
        await Promise.all(
          targets.map((id) => refreshAccountStats(id).catch(() => undefined)),
        );
        if (!cancelled) setSyncedAt(Date.now());
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

  return { syncedAt };
}
