import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Megaphone,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";

const CALL_POINTS = [
  "One form: campaign name, description, budget, rate, platforms and your files.",
  "An operator reads it, sets up the rate and rules, and approves or declines it here.",
  "Approved means live — verified creators can join and clip it the same day.",
];

const SETUP = [
  {
    n: "01",
    title: "Set the rate",
    body: "Pick what a verified view pays, per 1,000 views. It is public and it stays fixed for the life of the campaign.",
  },
  {
    n: "02",
    title: "Set the rules",
    body: "Choose the platforms you accept, the minimum view threshold a clip has to clear, and the creative guidelines clippers must follow.",
  },
  {
    n: "03",
    title: "Fund the budget",
    body: "Decide how much you are willing to spend. The budget caps the pool — the rate never changes mid-campaign.",
  },
];

const REVIEW_RULES = [
  "Clips must use your source material and follow the published creative guidelines.",
  "Only clips from accounts the creator has verified in Clip Vault can be submitted.",
  "A clip has to clear your minimum view threshold before it starts earning.",
  "Every clip is checked by an operator before it counts, and rejections never reach your invoice.",
  "Clips submitted from a platform you did not allow are rejected automatically.",
];

const INVOICING_POINTS = [
  "One invoice per closed cycle, covering every verified view in it.",
  "Only reviewed, threshold-clearing clips appear on it — rejected clips are not billed.",
  "The invoice itemises each clip so you can audit the number before you pay.",
  "You pay the campaign rate, so the invoice total is directly checkable against your rate and budget.",
];

export default function BrandsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="For brands"
        title="Three steps to a live campaign."
        lead="Set the rate, publish the rules, fund the budget. Verified creators pick it up and post, and you only ever pay for views that passed review."
        icon={Megaphone}
      />

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            Setting up a campaign
          </h2>
          <div className="mt-7 space-y-4">
            {SETUP.map((step) => (
              <div
                key={step.n}
                className="panel-fx rounded-2xl border border-black/8 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/35 bg-brand/10 font-mono text-sm font-bold text-brand">
                    {step.n}
                  </span>
                  <h3 className="text-lg font-extrabold tracking-[-0.03em]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section
        id="rules"
        className="scroll-mt-24 border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
                Campaign rules
              </h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              You write the creative rules; these are the ones Clip Vault
              enforces on every campaign so a clip can be judged consistently.
            </p>
            <ul className="mt-6 space-y-3">
              {REVIEW_RULES.map((rule) => (
                <li key={rule} className="flex gap-2.5 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{rule}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Your own rules sit on top of these and are shown on the campaign
              page. See the{" "}
              <Link
                to="/how-it-works"
                className="text-foreground underline underline-offset-4"
              >
                full walkthrough
              </Link>{" "}
              for what creators see when they join.
            </p>
          </motion.div>
        </div>
      </section>

      <section
        id="invoicing"
        className="scroll-mt-24 mx-auto max-w-3xl px-5 py-20"
      >
        <motion.div {...fadeUp}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
              <ReceiptText className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              Brand invoicing
            </h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            No per-clip bookkeeping and no weekly reconciliation. When a cycle
            closes you get one invoice and you pay it.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {INVOICING_POINTS.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <p className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{point}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Rates and how they are worked out are on the{" "}
            <Link
              to="/pricing"
              className="text-foreground underline underline-offset-4"
            >
              pricing page
            </Link>
            ; brand questions are answered on the{" "}
            <Link to="/faq" className="text-foreground underline underline-offset-4">
              FAQ
            </Link>
            .
          </p>
        </motion.div>
      </section>

      <section
        id="call"
        className="scroll-mt-24 border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                <PhoneCall className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
                Request your campaign
              </h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              There is no brand admin panel to learn. Sign in, describe the
              campaign you want — name, description, budget, the platforms, and
              the photos, videos or links clippers should work from — and an
              operator sets it up and comes back to you on the same page.
            </p>
            <ul className="mt-6 space-y-3">
              {CALL_POINTS.map((point) => (
                <li key={point} className="flex gap-2.5 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              You will see whether your request was approved or declined on the
              same page — nothing goes live until an operator approves it.
            </p>
            <Button
              asChild
              className="liquid glow-primary mt-6 h-11 bg-gradient-to-b from-[#A855F7] to-[#8B3FE2] px-6 hover:from-[#8B6BFF] hover:to-[#6642EE]"
            >
              <Link to="/auth?returnTo=/dashboard/request">
                Request a campaign
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <MarketingCTA
        title="Launch your first campaign."
        body="Describe the campaign and budget; we set the rate, publish the rules and let verified creators do the reach."
        primaryLabel="Request a campaign"
        primaryTo="/auth?returnTo=/dashboard/request"
      />
    </MarketingShell>
  );
}
