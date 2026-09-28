import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, Clock3, Loader2, PhoneCall, X, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";

const STATUS: Record<
  string,
  { label: string; className: string }
> = {
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

/** Mirrors what `calls.listAll` returns, without the index type ceremony. */
type Booking = {
  id: Id<"callBookings">;
  brandName: string;
  brandEmail: string;
  company: string | null;
  topic: string;
  note: string | null;
  startsAt: number;
  status: "pending" | "approved" | "declined";
  reason: string | null;
};

function fullLabel(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The operator's call-request queue.
 *
 * A brand asking for a call is not a meeting until somebody approves it, and
 * the queue is where that happens. Declining requires a reason, because the
 * alternative is a brand that was told nothing and assumed they were ignored.
 */
export function AdminCalls() {
  const bookings = useQuery(api.calls.listAll);
  const approve = useMutation(api.calls.approve);
  const decline = useMutation(api.calls.decline);

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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const pending = (bookings ?? []).filter((b) => b.status === "pending");
  const history = (bookings ?? []).filter((b) => b.status !== "pending");

  const row = (b: Booking, decided: boolean) => {
    const meta = STATUS[b.status] ?? STATUS.pending;
    const busy = busyId === b.id;
    return (
      <li
        key={b.id}
        className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{b.brandName}</p>
            <p className="text-xs text-muted-foreground">
              {b.brandEmail}
              {b.company ? ` · ${b.company}` : ""}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
          >
            {meta.label}
          </span>
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#C9AEFF]">
          <Clock3 className="h-3.5 w-3.5" />
          {fullLabel(b.startsAt)}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{b.topic}</p>
        {b.note && (
          <p className="mt-2 rounded-lg border border-white/[0.07] bg-black/[0.02] px-3 py-2 text-xs leading-relaxed text-muted-foreground dark:bg-white/[0.02]">
            {b.note}
          </p>
        )}
        {b.reason && (
          <p className="mt-2 text-xs leading-relaxed text-rose-200">
            Told them: {b.reason}
          </p>
        )}

        {!decided && (
          <div className="mt-4">
            {rejectingId === b.id ? (
              <div className="space-y-2">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why can't you take this slot? The brand sees this."
                  maxLength={1000}
                  className="min-h-20 resize-y"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        b.id,
                        () =>
                          decline({
                            bookingId: b.id,
                            reason: reason.trim(),
                          }),
                        "Request declined",
                      ).then(() => {
                        setRejectingId(null);
                        setReason("");
                      })
                    }
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
                      b.id,
                      () => approve({ bookingId: b.id }),
                      "Call confirmed",
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setRejectingId(b.id);
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
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
          <PhoneCall className="h-4 w-4" />
        </span>
        <h2 className="text-[15px] font-bold tracking-tight">
          Call requests
        </h2>
        {pending.length > 0 && (
          <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-amber-300">
            {pending.length} waiting
          </span>
        )}
      </div>

      {bookings === undefined ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </p>
      ) : (
        <>
          {pending.length === 0 && history.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-sm text-muted-foreground dark:border-white/15">
              No brand has asked for a call yet. They appear here the moment a
              signed-in brand requests a slot.
            </p>
          )}

          {pending.length > 0 && (
            <ul className="mt-4 space-y-3">{pending.map((b) => row(b, false))}</ul>
          )}

          {history.length > 0 && (
            <div className="mt-6 border-t border-white/[0.07] pt-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Decided
              </p>
              <ul className="mt-3 space-y-3">
                {history.map((b) => row(b, true))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
