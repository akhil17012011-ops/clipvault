import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformChip, StatusBadge } from "@/components/ClipticUI";
import { fmtFull, fmtMoney, fmtViews, type Campaign } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Check, Eye, Loader2, X } from "lucide-react";

type Bucket = "pending" | "approved" | "rejected";

const BUCKETS: Array<{ id: Bucket; label: string; hint: string }> = [
  { id: "pending", label: "Pending", hint: "Waiting on your review" },
  { id: "approved", label: "Approved", hint: "Counting toward payout" },
  { id: "rejected", label: "Rejected", hint: "Declined, with a reason sent" },
];

/**
 * One campaign's clips, split into the three places a clip can be.
 *
 * Admin only, deliberately. A creator seeing their own clip in "Rejected" with
 * a reason is useful; a creator seeing the whole campaign's review queue is not
 * theirs to see. The view count is editable because the number a creator's
 * link reported is a claim, and the figure that drives a payout should be one
 * an operator actually looked at.
 */
export function CampaignModeration({ campaign }: { campaign: Campaign }) {
  const { allSubmissions, reviewSubmission, confirmViews } = useCliptic();
  const [tab, setTab] = useState<Bucket>("pending");
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [viewsDraft, setViewsDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const clips = useMemo(
    () => allSubmissions.filter((s) => s.campaignId === campaign.id),
    [allSubmissions, campaign.id],
  );

  const grouped: Record<Bucket, typeof clips> = {
    pending: clips.filter((c) => c.status === "pending"),
    approved: clips.filter((c) => c.status === "active" || c.status === "paid"),
    rejected: clips.filter((c) => c.status === "rejected"),
  };

  const decide = async (
    id: string,
    decision: "accept" | "decline",
    note?: string,
  ) => {
    setBusyId(id);
    try {
      await reviewSubmission(id, decision, note);
      setReasonFor(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  };

  const confirm = async (id: string, current: number) => {
    const raw = (viewsDraft[id] ?? "").trim();
    if (!raw) return;
    const parsed = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setBusyId(id);
    try {
      await confirmViews(id, parsed);
      setViewsDraft((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5">
        {BUCKETS.map((bucket) => {
          const count = grouped[bucket.id].length;
          const active = tab === bucket.id;
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => setTab(bucket.id)}
              className={`relative rounded-lg px-3 py-2 text-left transition-colors duration-200 ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mod-tab"
                  className="absolute inset-0 rounded-lg border border-brand/40 bg-brand/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative block text-[12.5px] font-bold">
                {bucket.label}
                <span className="ml-1.5 font-mono text-[11px] opacity-70">
                  {count}
                </span>
              </span>
              <span className="relative block text-[10.5px] opacity-70">
                {bucket.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2.5">
        {grouped[tab].length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/12 px-4 py-6 text-center text-[13px] text-muted-foreground dark:border-white/15">
            Nothing in {BUCKETS.find((b) => b.id === tab)?.label.toLowerCase()}.
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {grouped[tab].map((clip) => (
              <motion.div
                key={clip.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="glass-chip rounded-xl px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <PlatformChip platform={clip.platform} size="sm" />
                  <span className="text-[13px] font-bold">{clip.creator}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    @{clip.author}
                  </span>
                  <StatusBadge status={clip.status} />
                  <a
                    href={clip.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    <Eye className="h-3 w-3" />
                    open
                  </a>
                </div>

                {clip.tags?.length ? (
                  <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                    {clip.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                ) : null}

                {/* The recorded view count, and the control to correct it. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Views
                  </span>
                  <span className="font-mono text-[13px] font-bold">
                    {fmtFull(clip.views)}
                  </span>
                  {clip.metrics?.fetchedAt ? (
                    <span className="text-[10.5px] text-muted-foreground">
                      from the platform link
                    </span>
                  ) : null}

                  <span className="ml-auto flex items-center gap-1.5">
                    <Input
                      value={viewsDraft[clip.id] ?? ""}
                      onChange={(e) =>
                        setViewsDraft((d) => ({
                          ...d,
                          [clip.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void confirm(clip.id, clip.views);
                      }}
                      placeholder="set view count"
                      inputMode="numeric"
                      className="h-8 w-32 text-[12px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void confirm(clip.id, clip.views)}
                      disabled={busyId === clip.id || !(viewsDraft[clip.id] ?? "").trim()}
                      className="h-8"
                    >
                      {busyId === clip.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Set
                    </Button>
                  </span>
                </div>

                {tab === "pending" && (
                  <div className="mt-3">
                    {reasonFor === clip.id ? (
                      <div className="space-y-2">
                        <Input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason sent to the creator"
                          className="h-9 text-[12px]"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              setReasonFor(null);
                              setReason("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 gap-1.5"
                            disabled={busyId === clip.id}
                            onClick={() => void decide(clip.id, "decline", reason)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Send reason & reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5"
                          disabled={busyId === clip.id}
                          onClick={() => void decide(clip.id, "accept")}
                        >
                          {busyId === clip.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => {
                            setReasonFor(clip.id);
                            setReason("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject with reason
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {clip.reviewNote && tab !== "pending" ? (
                  <p className="glass-chip mt-2.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
                    <span className="font-bold text-foreground/80">
                      Reason sent:{" "}
                    </span>
                    {clip.reviewNote}
                  </p>
                ) : null}

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {fmtViews(clip.views)} views ·{" "}
                  {fmtMoney(
                    clip.views >= campaign.minViews
                      ? (clip.views / 1000) * campaign.ratePer1k
                      : 0,
                  )}{" "}
                  earned ·{" "}
                  {clip.views >= campaign.minViews
                    ? "past threshold"
                    : `${fmtFull(campaign.minViews - clip.views)} more views needed`}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
