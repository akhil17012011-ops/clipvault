import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";

/** Mirrors what `campaignRequests.listAll` returns. */
type Request_ = {
  id: Id<"campaignRequests">;
  brandName: string;
  brandEmail: string;
  title: string;
  description: string;
  budgetUsd: number;
  ratePer1k: number;
  minViews: number;
  days: number;
  platforms: string[];
  assets: { label: string; url: string; kind: "image" | "video" | "link" }[];
  note: string | null;
  status: "pending" | "approved" | "declined";
  reason: string | null;
};

const STATUS: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Awaiting decision",
    className: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  },
  declined: {
    label: "Declined",
    className: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  },
};

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url.slice(0, 24);
  }
}

/**
 * The operator's campaign-request queue.
 *
 * A brand describing a campaign is not a campaign yet. Approving here creates
 * the real campaign row — at the brand's own budget, rate and platforms — so
 * creators only ever join something a human has read. Declining requires a
 * reason, because a brand told nothing assumes the platform is ignoring them.
 */
export function AdminCampaignRequests() {
  const requests = useQuery(api.campaignRequests.listAll);
  const approve = useMutation(api.campaignRequests.approve);
  const decline = useMutation(api.campaignRequests.decline);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const run = async (
    id: string,
    action: () => Promise<unknown>,
    success: string,
  ) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const history = (requests ?? []).filter((r) => r.status !== "pending");

  const row = (r: Request_, decided: boolean) => {
    const meta = STATUS[r.status] ?? STATUS.pending;
    const busy = busyId === r.id;
    return (
      <li
        key={r.id}
        className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="text-xs text-muted-foreground">
              {r.brandName} · {r.brandEmail}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
          >
            {meta.label}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Budget", `$${r.budgetUsd}`],
            ["Per 1k views", `$${r.ratePer1k}`],
            ["Min views", `${r.minViews}`],
            ["Days", `${r.days}`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-white/[0.07] bg-black/[0.02] px-2.5 py-1.5 dark:bg-white/[0.02]"
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 font-mono text-[13px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed">
          {r.description}
        </p>

        <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Platforms
        </p>
        <p className="mt-1 text-xs text-foreground/85">
          {r.platforms.join(", ")}
        </p>

        {r.assets.length > 0 && (
          <>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Files ({r.assets.length})
            </p>
            <ul className="mt-1.5 space-y-1">
              {r.assets.map((asset, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  {asset.kind === "image" ? (
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <a
                    href={asset.url.startsWith("http") ? asset.url : `https://${asset.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 truncate text-foreground/85 underline underline-offset-4 hover:text-[#C9AEFF]"
                  >
                    {asset.label || hostOf(asset.url)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                    {asset.kind}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {r.note && (
          <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/[0.02] px-3 py-2 text-xs leading-relaxed text-muted-foreground dark:bg-white/[0.02]">
            {r.note}
          </p>
        )}

        {r.reason && (
          <p className="mt-3 text-xs leading-relaxed text-rose-200">
            Told them: {r.reason}
          </p>
        )}

        {!decided && (
          <div className="mt-4">
            {rejectingId === r.id ? (
              <div className="space-y-2">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why can't you run this? The brand sees this."
                  maxLength={1000}
                  className="min-h-20 resize-y"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(
                        r.id,
                        () => decline({ requestId: r.id, reason: reason.trim() }),
                        "Request declined",
                      );
                      if (ok) {
                        setRejectingId(null);
                        setReason("");
                      }
                    }}
                    className="bg-rose-600 hover:bg-rose-500"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-3.5 w-3.5" />
                    )}
                    Confirm decline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRejectingId(null);
                      setReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      r.id,
                      () => approve({ requestId: r.id }),
                      "Campaign is live",
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-3.5 w-3.5" />
                  )}
                  Approve &amp; publish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRejectingId(r.id);
                    setReason("");
                  }}
                >
                  <X className="mr-2 h-3.5 w-3.5" />
                  Decline
                </Button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
          <Megaphone className="h-4 w-4" />
        </span>
        <h2 className="text-[15px] font-bold tracking-tight">
          Campaign requests
        </h2>
        {pending.length > 0 && (
          <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-amber-300">
            {pending.length} waiting
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Approving publishes the campaign at the brand&apos;s own rate, budget
        and platforms, and tells them it is live.
      </p>

      {requests === undefined ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </p>
      ) : (
        <>
          {pending.length === 0 && history.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-sm text-muted-foreground dark:border-white/15">
              No brand has requested a campaign yet. Requests appear here the
              moment a signed-in brand sends one.
            </p>
          )}

          {pending.length > 0 && (
            <ul className="mt-4 space-y-3">{pending.map((r) => row(r, false))}</ul>
          )}

          {history.length > 0 && (
            <div className="mt-6 border-t border-white/[0.07] pt-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Decided
              </p>
              <ul className="mt-3 space-y-3">{history.map((r) => row(r, true))}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
