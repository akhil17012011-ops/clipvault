import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { MIN_WITHDRAWAL_USD, SUPPORT_EMAIL } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import { Clock3, ShieldCheck, Wallet, Zap, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

type Method = {
  name: string;
  note: string;
  prefixes: string;
  arrival: string;
  icon: LucideIcon;
};

const METHODS: Method[] = [
  {
    name: "Solana",
    note: "Fast finality and the lowest fee of the four. Funds usually land within seconds of the transfer.",
    prefixes: "Starts with 1, 3 or 4",
    arrival: "Seconds",
    icon: Zap,
  },
  {
    name: "Litecoin",
    note: "One address, no memo field, nothing else to fill in. Confirms in a couple of blocks.",
    prefixes: "Starts with ltc1, L or M",
    arrival: "A few minutes",
    icon: Wallet,
  },
  {
    name: "Bitcoin",
    note: "Native on-chain BTC. Confirmations take longer, so allow a few blocks after we send it.",
    prefixes: "Starts with bc1, 1 or 3",
    arrival: "A few blocks",
    icon: Clock3,
  },
  {
    name: "USDT",
    note: "Pick the network you actually hold it on — Tron, Ethereum or BNB. The wrong network means the money is unrecoverable.",
    prefixes: "Tron: T… · Ethereum and BNB: 0x…",
    arrival: "Minutes to hours",
    icon: ShieldCheck,
  },
];

const STEPS = [
  {
    n: "01",
    title: "Earn from approved clips",
    body: "The moment an operator approves one of your clips, what it earned is added to your Clip Vault balance. Nothing is batched or held for a Friday run.",
  },
  {
    n: "02",
    title: `Reach $${MIN_WITHDRAWAL_USD}`,
    body: `That is the minimum withdrawal. Until your available balance hits $${MIN_WITHDRAWAL_USD} there is nothing to request — the number on the payments page tells you exactly how far off you are.`,
  },
  {
    n: "03",
    title: "Request the payout",
    body: "Choose how much, which currency, which network for USDT, and paste the address. There is no wallet saved to your account, so what you type is what gets paid.",
  },
  {
    n: "04",
    title: "We pay it",
    body: "The amount moves out of your available balance and into a pending balance so it cannot be requested twice. An operator pays it, and you get a message the moment it is sent.",
  },
];

export default function PayoutsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Payout methods"
        title={`Request a payout whenever you pass $${MIN_WITHDRAWAL_USD}.`}
        lead="Approve a clip, the money lands in your balance, and you pull it out yourself — in whichever currency and to whichever address you want that day."
        icon={Wallet}
      />

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            How getting paid works
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            There is no saved payout address and no automatic run. You ask, we
            send, and you can see exactly where every request stands.
          </p>
          <div className="mt-7 space-y-4">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="flex gap-4 rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/35 bg-brand/10 font-mono text-sm font-bold text-brand">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-extrabold tracking-tight">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              Supported currencies
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Choose per request — you are not locked into whatever you signed up
              with, and you are not stuck reusing an old address.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {METHODS.map((method) => (
                <div
                  key={method.name}
                  className="panel-fx rounded-2xl border border-black/8 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                    <method.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-base font-extrabold tracking-tight">
                    {method.name}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {method.note}
                  </p>
                  <dl className="mt-4 space-y-1.5 text-[13px]">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Address</dt>
                      <dd className="font-semibold">{method.prefixes}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Arrives in</dt>
                      <dd className="font-semibold">{method.arrival}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Bank transfer and other stablecoins are not supported yet. If that
              is a blocker, tell us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            If a request is sent back
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If we cannot pay a request — an address on the wrong network, say —
            we send it back with a reason and the full amount returns to your
            available balance immediately. You are told why in your messages,
            word for word, and you can request again once it is fixed. A request
            is never quietly dropped.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              `Only one request can be open at a time, so nothing is ever queued behind a decision you have not been told about.`,
              "The amount is locked the moment you request it, so you cannot accidentally withdraw the same balance twice.",
              "When a payout is sent, the transaction reference is recorded against the request and shown in your history.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5 text-sm leading-relaxed">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="text-muted-foreground">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Rates and how much a view pays are on the{" "}
            <Link
              to="/pricing"
              className="text-foreground underline underline-offset-4"
            >
              pricing page
            </Link>
            ; the full question list is on the{" "}
            <Link to="/faq" className="text-foreground underline underline-offset-4">
              FAQ
            </Link>
            .
          </p>
        </motion.div>
      </section>

      <MarketingCTA
        title="Approve a clip, reach $5, get paid."
        body="Connect an account, join a campaign and your balance builds from the moment a clip is approved."
      />
    </MarketingShell>
  );
}
