import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { MIN_WITHDRAWAL_USD } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import { Check, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Link } from "react-router";

const REQUIREMENTS = [
  {
    title: "An account on a supported platform",
    body: "TikTok, Instagram Reels or YouTube Shorts. You can add more than one, and every account you post from should be verified.",
  },
  {
    title: "A crypto address",
    body: "Whichever one you want to be paid to. You do not save it up front — you choose the currency and paste the address when you request the payout.",
  },
  {
    title: "The right to use the footage",
    body: "You can only clip material the brand owns or that is licensed for reuse. Clipping a creator's video without permission is the fastest way to a rejection.",
  },
];

const RULES = [
  "Post only from an account you have verified in Clip Vault.",
  "Use the campaign's source material — do not swap in your own footage.",
  "Follow the creative rules in the campaign brief; they are public.",
  "Do not submit the same clip twice, or to two different campaigns.",
  "Submit the link once the clip is live, with views already coming in.",
  "Keep the clip up. Removing it before a cycle closes voids it.",
];

const EARNINGS = [
  {
    title: "You set the pace",
    body: "Clip as much or as little as you want. There is no minimum volume and no quota to hit.",
  },
  {
    title: "Rates are published up front",
    body: "Each campaign states what a verified view pays before you join it, so you can pick the ones worth your time.",
  },
  {
    title: "Rejected clips cost you nothing",
    body: "A rejected clip never enters the earning pool and the reason is shown next to the clip so you can fix it.",
  },
];

export default function CreatorsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="For creators"
        title="Clip. Post. Get paid."
        lead="Clip Vault turns short-form clipping into a weekly income. No following required, no application, no fee — just post the clip and let verified views do the rest."
        icon={Sparkles}
      />

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            What you need to start
          </h2>
          <div className="mt-6 space-y-3">
            {REQUIREMENTS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <p className="flex items-start gap-2.5 text-sm font-bold">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  {item.title}
                </p>
                <p className="mt-2 pl-6.5 text-[13px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
                The rules that keep clips approved
              </h2>
            </div>
            <ul className="mt-6 space-y-3">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-2.5 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{rule}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Every campaign can add its own rules on top of these, and they
              are shown on the campaign before you join. The full breakdown of
              what a clip goes through is on the{" "}
              <Link
                to="/how-it-works"
                className="text-foreground underline underline-offset-4"
              >
                how it works page
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            What you earn
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {EARNINGS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <p className="text-sm font-extrabold tracking-tight">{item.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="payouts" className="scroll-mt-24 border-t border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                <Wallet className="h-5 w-5" />
              </span>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              Payouts
            </h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Nothing is saved to your account. When your balance passes $
            {MIN_WITHDRAWAL_USD} you request a payout, choose Solana, Litecoin,
            Bitcoin or USDT, paste the address, and we send it. The amount moves
            into a pending balance while we action it so it can never be
            requested twice, and you are notified the second it goes out.
          </p>
            <Link
              to="/payouts"
              className="mt-4 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Full payout details
            </Link>
          </motion.div>
        </div>
      </section>

      <MarketingCTA
        title="Your balance builds as clips get approved."
        body="Connect an account, join a campaign and post. Reach $5 and the money is yours to withdraw."
      />
    </MarketingShell>
  );
}
