import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fmtCents,
  payoutMethodLabel,
  shortAddress,
  type AdminPayoutRequest,
} from "@/lib/clip-vault-data";
import { useClipVault } from "@/lib/clip-vault-store";
import {
  Check,
  Clock3,
  Copy,
  Loader2,
  ReceiptText,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The operator's payout queue.
 *
 * A request is only ever money that has already left the creator's available
 * balance, so this screen is deliberately about deciding, not about approving
 * spending. Marking one paid clears the pending balance and messages the
 * creator; rejecting one requires a reason, returns the money, and sends that
 * reason to their inbox — because a silent rejection is the one outcome that
 * makes a creator think the platform is ignoring them.
 */
export function AdminPayouts() {
  const { adminPayoutRequests, markPayoutPaid, rejectPayout } = useClipVault();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [reference, setReference] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const pending = adminPayoutRequests.filter((r) => r.status === "pending");
  const history = adminPayoutRequests.filter((r) => r.status !== "pending");
  const pendingTotal = pending.reduce((sum, r) => sum + r.amountCents, 0);
  const paidTotal = history
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + r.amountCents, 0);

  const run = async (
    id: string,
    action: () => Promise<void>,
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

  const copy = async (request: AdminPayoutRequest) => {
    try {
      await navigator.clipboard.writeText(request.address);
      setCopied(request.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked — the address is selectable on screen */
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Waiting on you
          </p>
          <p className="mt-1 font-mono text-xl font-extrabold text-foreground">
            {fmtCents(pendingTotal)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {pending.length}{" "}
            {pending.length === 1 ? "request" : "requests"}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Paid out
          </p>
          <p className="mt-1 font-mono text-xl font-extrabold text-neon">
            {fmtCents(paidTotal)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {history.filter((r) => r.status === "paid").length} settled
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Pending requests
        </h3>
        {pending.length === 0 ? (
          <p className="glass-chip mt-2 rounded-xl px-4 py-5 text-center text-xs text-muted-foreground">
            Nothing waiting. When a creator requests a payout it appears here
            with the address to send it to.
          </p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {pending.map((request) => (
              <li
                key={request.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold">
                      {request.creatorName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {request.creatorEmail ?? "No email on file"} ·{" "}
                      {new Date(request.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-extrabold text-brand">
                    {fmtCents(request.amountCents)}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-black/[0.3] px-3 py-2">
                  <span className="shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand">
                    {payoutMethodLabel(request.method, request.network)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">
                    {request.address}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(request)}
                    title="Copy address"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {copied === request.id ? (
                      <Check className="h-3.5 w-3.5 text-neon" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {rejectingId === request.id ? (
                  <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5">
                    <p className="text-[11.5px] font-semibold">
                      Why is this being sent back?
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      The creator sees this word for word in their messages, and
                      the amount goes straight back to their balance.
                    </p>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. That address is on the wrong network"
                      className="mt-2 h-9 text-[12px]"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11.5px]"
                        onClick={() => {
                          setRejectingId(null);
                          setReason("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 bg-red-600 text-[11.5px] hover:bg-red-700"
                        disabled={busyId === request.id || reason.trim().length === 0}
                        onClick={() =>
                          run(
                            request.id,
                            async () => {
                              await rejectPayout(request.id, reason.trim());
                              setRejectingId(null);
                              setReason("");
                            },
                            "Sent back — the creator has been told why",
                          )
                        }
                      >
                        {busyId === request.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Send back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      value={reference[request.id] ?? ""}
                      onChange={(e) =>
                        setReference((prev) => ({
                          ...prev,
                          [request.id]: e.target.value,
                        }))
                      }
                      placeholder="Transaction hash (optional)"
                      className="h-9 min-w-0 flex-1 font-mono text-[11.5px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-[11.5px]"
                      onClick={() => {
                        setRejectingId(request.id);
                        setReason("");
                      }}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 bg-neon text-[11.5px] text-black hover:opacity-90"
                      disabled={busyId === request.id}
                      onClick={() =>
                        run(
                          request.id,
                          () =>
                            markPayoutPaid(
                              request.id,
                              reference[request.id]?.trim() || undefined,
                            ),
                          "Marked paid — the creator has been notified",
                        )
                      }
                    >
                      {busyId === request.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Mark paid
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Payout log
        </h3>
        {history.length === 0 ? (
          <p className="glass-chip mt-2 rounded-xl px-4 py-5 text-center text-xs text-muted-foreground">
            Paid and sent-back payouts are kept here as a permanent record.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 glass-chip rounded-xl px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold">
                    {request.creatorName}
                    <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                      {payoutMethodLabel(request.method, request.network)} ·{" "}
                      {shortAddress(request.address)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {request.decidedAt
                      ? new Date(request.decidedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : null}
                    {request.reference ? ` · ${request.reference}` : null}
                    {request.reason ? ` · ${request.reason}` : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[13px] font-bold">
                    {fmtCents(request.amountCents)}
                  </p>
                  <p
                    className={`flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      request.status === "paid" ? "text-neon" : "text-red-500"
                    }`}
                  >
                    {request.status === "paid" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <ReceiptText className="h-3 w-3" />
                    )}
                    {request.status === "paid" ? "Paid" : "Sent back"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Clock3 className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            Money in the pending queue is already deducted from each
            creator&apos;s available balance, so it cannot be requested twice
            while you decide.
          </p>
        ) : null}
      </div>
    </div>
  );
}
