import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { fmtRate } from "@/lib/clip-vault-data";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import { CircleDollarSign, Clock3, TrendingUp } from "lucide-react";
import { Link } from "react-router";

export default function PricingPage() {
  const { campaigns } = useClipVault();
  const live = campaigns.filter((c) => c.status === "active");
  const rates = live.map((c) => c.ratePer1k).filter((r) => r > 0);
  const low = rates.length ? Math.min(...rates) : null;
  const high = rates.length ? Math.max(...rates) : null;

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Pricing & rates"
        title="What a view is actually worth."
        lead="No tiers to decode and nothing held back. Every campaign publishes its own rate and the view count it has to pass, and you see both before you join."
        icon={CircleDollarSign}
      />

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div
          {...fadeUp}
          className="panel-fx relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-b from-brand/15 to-brand/[0.03] p-8 text-center sm:p-10"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[480px] -translate-x-1/2 rounded-full bg-[#8B3FE2]/30 blur-[100px]" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Live campaigns right now
            </p>
            <p className="mt-4 font-mono text-5xl font-extrabold tracking-tight sm:text-6xl">
              {low !== null && high !== null ? (
                low === high ? (
                  fmtRate(low)
                ) : (
                  <>
                    {fmtRate(low)}
                    <span className="mx-2 text-muted-foreground">–</span>
                    {fmtRate(high)}
                  </>
                )
              ) : (
                <span className="text-3xl sm:text-4xl">Opening soon</span>
              )}
            </p>
            {low !== null && (
              <p className="mt-3 text-sm text-muted-foreground">
                per 1,000 verified views · across {live.length} open{" "}
                {live.length === 1 ? "campaign" : "campaigns"}
              </p>
            )}
            <Link
              to="/campaigns"
              className="mt-6 inline-flex items-center text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Browse the campaigns paying these rates
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="border-y border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <motion.div {...fadeUp}>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              How a rate is worked out
            </h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: "A view only counts once it is verified",
                  body: "Views are read from the source platform after a clip has been reviewed. Anything below the campaign's minimum view threshold never enters the earning pool at all.",
                },
                {
                  title: "Each campaign sets its own rate",
                  body: "Brands publish a rate per 1,000 verified views when they launch. It stays fixed for the life of the campaign, so you always know what a view pays before you post.",
                },
                {
                  title: "Budget caps the pool, not your rate",
                  body: "When a campaign's budget is spent it closes. Your rate never changes mid-cycle — the campaign simply stops accepting new clips.",
                },
                {
                  title: "Joining and clipping are free",
                  body: "There is no subscription, no seat fee and no minimum clip volume. You need a verified account, and that is it.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <p className="text-sm font-extrabold tracking-tight">{item.title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            Common questions about money
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                title: "Rates go live",
                body: "A campaign's rate is public the moment it launches, and the current range is shown above.",
              },
              {
                icon: Clock3,
                title: "Cycles close weekly",
                body: "Earnings run on weekly cycles and pay out on Friday to the wallet in your payout settings.",
              },
              {
                icon: CircleDollarSign,
                title: "No minimum transfer",
                body: "There is no payout threshold to clear. Whatever a closed cycle earns is what gets sent.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <item.icon className="h-5 w-5 text-brand" />
                <p className="mt-3 text-sm font-extrabold tracking-tight">{item.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            More detail in the{" "}
            <Link to="/faq" className="text-foreground underline underline-offset-4">
              FAQ
            </Link>{" "}
            and on the{" "}
            <Link to="/payouts" className="text-foreground underline underline-offset-4">
              payout methods
            </Link>{" "}
            page.
          </p>
        </motion.div>
      </section>

      <MarketingCTA
        title="See which campaigns are paying."
        body="Browse what is live right now and join the one that fits how you post."
      />
    </MarketingShell>
  );
}
