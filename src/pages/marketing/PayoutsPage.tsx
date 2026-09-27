import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { SUPPORT_EMAIL } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import { Clock3, ShieldCheck, Wallet, Zap, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

type Method = {
  name: string;
  note: string;
  prefixes: string;
  speed: string;
  icon: LucideIcon;
};

const METHODS: Method[] = [
  {
    name: "Solana",
    note: "Fast finality and the lowest fee of the two. Funds usually land within seconds of the cycle closing.",
    prefixes: "Starts with 1, 3 or 4",
    speed: "Seconds",
    icon: Zap,
  },
  {
    name: "Litecoin",
    note: "A single address that confirms in a couple of blocks. One address, no memo field, nothing else to fill in.",
    prefixes: "Starts with L or M",
    speed: "A few minutes",
    icon: Wallet,
  },
];

const TIMELINE = [
  {
    n: "01",
    title: "A cycle closes",
    body: "Earnings run on weekly cycles. When a cycle closes, every clip in it is locked and reviewed.",
  },
  {
    n: "02",
    title: "Your total is confirmed",
    body: "Clips that passed review and cleared their campaign's view threshold are totalled into one payout.",
  },
  {
    n: "03",
    title: "Sent on Friday",
    body: "The payout is sent to the wallet saved in Payout settings. There is nothing to request and no minimum to clear.",
  },
];

export default function PayoutsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Payout methods"
        title="Paid every Friday, straight to your wallet."
        lead="Add a wallet once and every closed cycle pays out to it automatically. No payout request, no minimum transfer, no chasing."
        icon={Wallet}
      />

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            Supported currencies
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Clip Vault pays in two crypto currencies. Pick the one you already
            use and paste the address — we validate the format before saving it
            so a typo never costs you a payout.
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
                    <dd className="font-semibold">{method.speed}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Other currencies and bank transfer are not supported yet. If that is
            a blocker for you, tell us at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-foreground underline underline-offset-4"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </motion.div>
      </section>

      <section className="border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                <Clock3 className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
                How a payout happens
              </h2>
            </div>
            <div className="mt-7 space-y-4">
              {TIMELINE.map((step) => (
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
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              Keeping your money safe
            </h2>
          </div>
          <ul className="mt-6 space-y-3">
            {[
              "Only add a wallet you control the keys to. Clip Vault never asks for a seed phrase and support will never ask for one either.",
              "Check the address prefix before you save it — Solana starts with 1, 3 or 4 and Litecoin starts with L or M.",
              "Change your wallet any time from Payout settings. The next closed cycle uses whatever address is saved at that point.",
              "Rejected clips never enter the earning pool, and the reviewer's reason sits next to the clip so you can fix and resubmit.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5 text-sm leading-relaxed">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="text-muted-foreground">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Rates and how much a view pays are covered on the{" "}
            <Link to="/pricing" className="text-foreground underline underline-offset-4">
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
        title="Add a wallet and get paid on Friday."
        body="Connect an account, join a campaign and your first payout is one cycle away."
      />
    </MarketingShell>
  );
}
