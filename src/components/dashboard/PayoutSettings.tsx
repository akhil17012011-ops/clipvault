import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, TriangleAlert, Wallet } from "lucide-react";
import type { PayoutCurrency } from "@/lib/clip-vault-data";

const COINS: Array<{ id: PayoutCurrency; label: string; hint: string }> = [
  { id: "sol", label: "Solana", hint: "Starts with 1, 3 or 4" },
  { id: "ltc", label: "Litecoin", hint: "Starts with L or M" },
];

/**
 * Where this creator gets paid.
 *
 * The address is only checked for shape — crypto sends are irreversible, so a
 * typo cannot be undone by support. The copy is deliberately blunt about that
 * rather than implying we confirmed the wallet belongs to them.
 */
export function PayoutSettings() {
  const { profile, updatePayout } = useClipVault();
  const [currency, setCurrency] = useState<PayoutCurrency>("sol");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = profile as
      | (typeof profile & { payoutCurrency?: PayoutCurrency })
      | null;
    if (user?.payoutCurrency) setCurrency(user.payoutCurrency);
    if (user?.payoutAddress) setAddress(user.payoutAddress);
  }, [profile]);

  const save = async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updatePayout({ currency, address });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't save that address.",
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the field is selectable on screen */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel rounded-xl px-4 py-4"
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
          <Wallet className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-[13px] font-bold tracking-tight">Payout address</h3>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {COINS.map((coin) => (
          <button
            key={coin.id}
            type="button"
            onClick={() => setCurrency(coin.id)}
            className={`rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
              currency === coin.id
                ? "border-brand/50 bg-brand/10"
                : "border-black/10 bg-black/[0.02] hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
            }`}
          >
            <span className="block text-[12.5px] font-bold">
              {coin.label}
              {currency === coin.id ? (
                <Check className="ml-1.5 inline h-3.5 w-3.5 text-brand" />
              ) : null}
            </span>
            <span className="block text-[10.5px] text-muted-foreground">
              {coin.hint}
            </span>
          </button>
        ))}
      </div>

      <Label
        htmlFor="payout-address"
        className="mt-4 block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {currency === "sol" ? "Solana" : "Litecoin"} address
      </Label>
      <div className="relative mt-2">
        <Input
          id="payout-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={
            currency === "sol" ? "Your Solana wallet" : "Your Litecoin wallet"
          }
          spellCheck={false}
          className="h-10 pr-10 font-mono text-[12px]"
        />
        {address ? (
          <button
            type="button"
            onClick={copy}
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
        Crypto payments can't be reversed. Check the address carefully before
        saving — we can't recover a transfer to the wrong wallet.
      </p>

      {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}

      <Button
        className="mt-3.5 w-full gap-1.5 glow-primary"
        onClick={save}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {busy ? "Saving…" : saved ? "Saved" : "Save payout address"}
      </Button>
    </motion.div>
  );
}
