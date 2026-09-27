import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { DISCORD_INVITE, SUPPORT_EMAIL } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import { Check, HelpCircle, MessagesSquare } from "lucide-react";
import { Link } from "react-router";

const CREATOR_QUESTIONS = [
  {
    q: "Do I need a following or an application?",
    a: "No. Join any open campaign, post the clip and it counts. There is no follower minimum, no application and no fee to join.",
  },
  {
    q: "Which platforms can I post on?",
    a: "TikTok, Instagram Reels and YouTube Shorts. Each campaign says which of those it accepts, and you can only submit from an account you have verified in Clip Vault.",
  },
  {
    q: "How are views verified?",
    a: "A Clip Vault operator checks every clip by hand before it goes live. We use the numbers the platform publishes, and a clip only starts earning once it passes its campaign's minimum view threshold.",
  },
  {
    q: "What if a clip is rejected?",
    a: "It never enters the earning pool, and the reviewer's reason sits next to the clip so you can fix it and resubmit.",
  },
  {
    q: "When do I get paid?",
    a: "As soon as your balance passes $5 you can request a payout. You pick the amount, the currency and the address; the money then moves into a pending balance until an operator sends it, and you get a message the moment it is.",
  },
  {
    q: "How much can I withdraw at once?",
    a: "Any amount from $5 up to your whole available balance. There is no maximum transfer and no fee for requesting one.",
  },
  {
    q: "Which crypto can I be paid in?",
    a: "Solana, Litecoin, Bitcoin and USDT. USDT can go out on Tron, Ethereum or BNB — pick the network that matches the wallet you actually hold it in, because a transfer on the wrong network cannot be recovered.",
  },
  {
    q: "Do I have to save a wallet address?",
    a: "No. The currency, network and address belong to the payout request itself, so an address you used months ago can never be paid by accident and you are free to use a different one each time.",
  },
  {
    q: "What if my payout is rejected?",
    a: "You get a reason in your messages and the full amount goes straight back into your available balance, so you can fix the address and request again.",
  },
  {
    q: "What can get a clip rejected?",
    a: "Posting the wrong source material, ignoring the campaign's creative rules, using footage you do not have the right to use, or submitting a clip that was already submitted for a payout. The reason is always shown on the clip.",
  },
  {
    q: "Can I clip the same video for two campaigns?",
    a: "Only if both campaigns are for the same brand and say so in their rules. Submitting the same clip to two different campaigns is not allowed and both submissions are rejected.",
  },
  {
    q: "How long does verification take?",
    a: "Usually minutes. We generate a one-time code, you paste it into your bio on the platform, and the account is confirmed as soon as the platform shows the code.",
  },
  {
    q: "How much can I earn?",
    a: "Every campaign publishes its own rate per 1,000 verified views. The current range across all live campaigns is on the pricing page.",
  },
];

const BRAND_QUESTIONS = [
  {
    q: "How do I set a rate?",
    a: "You pick a rate per 1,000 verified views and a total budget when you create the campaign. Both are public, and they stay fixed for the life of the campaign.",
  },
  {
    q: "How do payouts actually reach creators?",
    a: "Creators accrue a balance as their clips are approved and withdraw it themselves once they pass $5. We pay each request manually in the currency and to the address they chose, then mark it paid in the console.",
  },
  {
    q: "What happens when the budget runs out?",
    a: "The campaign closes and stops accepting new clips. Rates never change mid-cycle — the campaign simply closes.",
  },
  {
    q: "How are clips reviewed?",
    a: "An operator checks every clip against your rules before it counts. Rejected clips never enter the earning pool, so you are never billed for a clip that broke the brief.",
  },
  {
    q: "When do I get invoiced?",
    a: "When a cycle closes you get a single invoice covering the verified views in that cycle. One invoice, one payment, no per-clip bookkeeping.",
  },
  {
    q: "Do I need a contract?",
    a: "No contract and no minimum spend. You fund a budget, clippers pick it up, and you pay for verified views only.",
  },
  {
    q: "Can I restrict which platforms are used?",
    a: "Yes. Each campaign declares the platforms it accepts, and clips submitted from any other platform are rejected automatically.",
  },
  {
    q: "What do clippers see?",
    a: "Your rate, your budget, your minimum view threshold, your platforms and your creative rules — all public before anyone joins. Nothing is hidden behind an application.",
  },
  {
    q: "How do I talk to the community?",
    a: "The Discord is where campaign feedback, clip ideas and support requests live. Brands and clippers are in the same channels.",
  },
];

function QuestionList({
  items,
  offset = 0,
}: {
  items: { q: string; a: string }[];
  offset?: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <motion.div
          key={item.q}
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: (offset + i) * 0.03 }}
          className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <p className="flex items-start gap-2.5 text-sm font-bold leading-snug">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {item.q}
          </p>
          <p className="mt-2.5 pl-6.5 text-[13px] leading-relaxed text-muted-foreground">
            {item.a}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export default function FaqPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="FAQ"
        title="Questions creators and brands ask first."
        lead="Straight answers about joining, verification, rates, review and payouts. If something is missing, the Discord is the fastest way to get it."
        icon={HelpCircle}
      />

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            For creators
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Joining, posting and getting paid.
          </p>
        </motion.div>
        <div className="mt-6">
          <QuestionList items={CREATOR_QUESTIONS} />
        </div>
      </section>

      <section className="border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              For brands
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Launching campaigns, review and invoicing.
            </p>
          </motion.div>
          <div className="mt-6">
            <QuestionList
              items={BRAND_QUESTIONS}
              offset={CREATOR_QUESTIONS.length}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            Still stuck?
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noreferrer"
              className="panel-fx group rounded-2xl border border-black/8 bg-black/[0.02] p-5 transition-colors hover:border-brand/40 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <MessagesSquare className="h-5 w-5 text-brand" />
              <p className="mt-3 text-sm font-extrabold tracking-tight">
                Ask in the Discord
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Campaign questions, clip ideas and help from other clippers.
              </p>
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="panel-fx rounded-2xl border border-black/8 bg-black/[0.02] p-5 transition-colors hover:border-brand/40 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <HelpCircle className="h-5 w-5 text-brand" />
              <p className="mt-3 text-sm font-extrabold tracking-tight">
                Email support
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {SUPPORT_EMAIL} — best for account and payment issues.
              </p>
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Reading up first? The{" "}
            <Link to="/how-it-works" className="text-foreground underline underline-offset-4">
              how it works page
            </Link>
            ,{" "}
            <Link to="/pricing" className="text-foreground underline underline-offset-4">
              pricing
            </Link>{" "}
            and{" "}
            <Link to="/payouts" className="text-foreground underline underline-offset-4">
              payout methods
            </Link>{" "}
            cover the mechanics in detail.
          </p>
        </motion.div>
      </section>

      <MarketingCTA
        title="Ready when you are."
        body="Connect an account, join a campaign and watch verified views turn into earnings."
      />
    </MarketingShell>
  );
}
