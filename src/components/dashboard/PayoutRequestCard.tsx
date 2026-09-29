import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PAYOUT_METHODS,
  fmtCents,
  payoutMethodLabel,
  shortAddress,
  type PayoutMethod,
  type UsdtNetwork,
} from "@/lib/clip-vault-data";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Ask to be paid.
 *
 * There is no saved wallet on purpose. The method, the network and the address
 * belong to this one request, and the moment it is submitted the amount leaves
 * the available balance and sits in pending until an operator has actually paid
 * it. That is why the balance drops straight away and the request shows as
 * "waiting" rather than as done.
 */
export function PayoutRequestCard() {
  const { wallet, payoutRequests, requestPayout } = useClipVault();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("sol");
  const [network, setNetwork] = useState<UsdtNetwork>("trc20");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(
    () => PAYOUT_METHODS.find((m) => m.id === method) ?? PAYOUT_METHODS[0],
    [method],
  );

  const minCents = wallet.minWithdrawalCents;
  const availableCents = wallet.availableCents;
  const liveRequest = payoutRequests.find((r) => r.status === "pending");
  const canRequest = availableCents >= minCents && !liveRequest;

  const submit = async () => {
    setError(null);
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter how much you want to withdraw.");
      return;
    }
    if (!address.trim()) {
      setError("Enter the address you want the money sent to.");
      return;
    }
    setBusy(true);
    try {
      /* Dollars in the field, cents on the wire. Rounding here rather than in
         the mutation keeps "5.00" from becoming 499 cents through a float. */
      await requestPayout({
        amountCents: Math.round(dollars * 100),
        method,
        network: method === "usdt" ? network : undefined,
        address: address.trim(),
      });
      setAmount("");
      setAddress("");
      toast.success("Payout requested", {
        description:
          "The amount moved into your pending balance. You'll get a message the moment it's paid.",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't request that payout.",
      );
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the field is selectable on screen */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel rounded-xl px-4 py-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <Wallet className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-[13px] font-bold tracking-tight">
            Request a payout
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Minimum {fmtCents(minCents)}
        </span>
      </div>

      {liveRequest ? (
        <div className="mt-3.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold">
            <Clock3 className="h-3.5 w-3.5 text-amber-500" />
            {fmtCents(liveRequest.amountCents)} waiting to be paid
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            To {payoutMethodLabel(liveRequest.method, liveRequest.network)} ·{" "}
            {shortAddress(liveRequest.address)}. We&apos;ll message you the moment
            it is sent.
          </p>
        </div>
      ) : null}

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {PAYOUT_METHODS.map((coin) => (
          <button
            key={coin.id}
            type="button"
            disabled={!canRequest}
            onClick={() => setMethod(coin.id)}
            className={`rounded-lg border px-3 py-2 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${
              method === coin.id
                ? "border-brand/50 bg-brand/10"
                : "border-black/10 bg-black/[0.02] hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
            }`}
          >
            <span className="block text-[12.5px] font-bold">
              {coin.label}
              {method === coin.id ? (
                <Check className="ml-1.5 inline h-3.5 w-3.5 text-brand" />
              ) : null}
            </span>
            <span className="block text-[10.5px] text-muted-foreground">
              {coin.hint}
            </span>
          </button>
        ))}
      </div>

      {selected.networks ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {selected.networks.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setNetwork(option.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 ${
                network === option.id
                  ? "border-brand/50 bg-brand/10"
                  : "border-black/10 bg-black/[0.02] hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
              }`}
            >
              <span className="block text-[11.5px] font-bold">
                {option.label}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <Label
        htmlFor="payout-amount"
        className="mt-4 block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        Amount
      </Label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted-foreground">
          $
        </span>
        <Input
          id="payout-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder={canRequest ? (availableCents / 100).toFixed(2) : "—"}
          disabled={!canRequest}
          className="h-10 pl-7 pr-14 font-mono text-[12px]"
        />
        {canRequest ? (
          <button
            type="button"
            onClick={() => setAmount((availableCents / 100).toFixed(2))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10.5px] font-bold text-brand transition-colors hover:bg-brand/10"
          >
            MAX
          </button>
        ) : null}
      </div>

      <Label
        htmlFor="payout-address"
        className="mt-3.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {payoutMethodLabel(method, method === "usdt" ? network : null)} address
      </Label>
      <div className="relative mt-2">
        <Input
          id="payout-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={selected.hint}
          disabled={!canRequest}
          spellCheck={false}
          autoComplete="off"
          className="h-10 pr-10 font-mono text-[12px]"
        />
        {address ? (
          <button
            type="button"
            onClick={copyAddress}
            title="Copy address"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-neon" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
        Crypto payments can&apos;t be reversed. Check the address carefully — we
        can never recover a transfer to the wrong wallet.
      </p>

      {error ? <p className="mt-2 text-[12px] text-red-500">{error}</p> : null}

      <Button
        className="mt-3.5 w-full gap-1.5 glow-primary"
        onClick={submit}
        disabled={busy || !canRequest}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Requesting…" : "Request payout"}
        {!busy ? <ArrowUpRight className="h-4 w-4" /> : null}
      </Button>

      {!canRequest && !liveRequest ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          Approved clips need to add up to {fmtCents(minCents)} before you can
          withdraw. You have {fmtCents(availableCents)} available.
        </p>
      ) : null}
    </motion.div>
  );
}

/** The creator's payout history: what was requested, paid, or sent back. */
export function PayoutHistory() {
  const { payoutRequests } = useClipVault();

  return (
    <div>
      <h3 className="mt-5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Payout requests
      </h3>
      {payoutRequests.length === 0 ? (
        <p className="glass-chip mt-2 rounded-xl px-4 py-4 text-center text-xs text-muted-foreground">
          You haven&apos;t requested a payout yet. They show up here with their
          status — waiting, paid, or sent back.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {payoutRequests.map((request) => (
            <li key={request.id} className="glass-chip rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">
                    {payoutMethodLabel(request.method, request.network)}{" "}
                    <span className="font-mono text-[11.5px] font-normal text-muted-foreground">
                      {shortAddress(request.address)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(request.requestedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {request.reference ? ` · ${request.reference}` : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[14px] font-bold">
                    {fmtCents(request.amountCents)}
                  </p>
                  <p
                    className={`text-[10.5px] font-bold uppercase tracking-[0.12em] ${
                      request.status === "paid"
                        ? "text-neon"
                        : request.status === "rejected"
                          ? "text-red-500"
                          : "text-amber-500"
                    }`}
                  >
                    {request.status === "paid"
                      ? "Paid"
                      : request.status === "rejected"
                        ? "Sent back"
                        : "Waiting"}
                  </p>
                </div>
              </div>
              {request.reason ? (
                <p className="mt-2 rounded-lg bg-black/[0.25] px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  {request.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
