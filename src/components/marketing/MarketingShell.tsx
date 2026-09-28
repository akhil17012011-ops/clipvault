import { ClipVaultLogo, ClipVaultMark } from "@/components/ClipVaultMark";
import { Button } from "@/components/ui/button";
import { DISCORD_INVITE, SUPPORT_EMAIL } from "@/lib/clip-vault-data";
import { useAuth } from "@/hooks/use-auth";
import { EASE } from "@/lib/motion";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, MessagesSquare, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router";

/** Every footer/marketing link, in one place so pages and footer agree. */
export const MARKETING_LINKS: {
  title: string;
  links: { label: string; to: string; external?: boolean }[];
}[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", to: "/how-it-works" },
      { label: "Live campaigns", to: "/campaigns" },
      { label: "Pricing & rates", to: "/pricing" },
      { label: "Payout methods", to: "/payouts" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Creators",
    links: [
      { label: "How to start", to: "/creators" },
      { label: "Start clipping", to: "/auth?returnTo=/dashboard" },
      { label: "My clips", to: "/dashboard/clips" },
      { label: "Verify accounts", to: "/dashboard/accounts" },
      { label: "Payment history", to: "/dashboard/payments" },
      { label: "Creator FAQ", to: "/faq" },
    ],
  },
  {
    title: "Brands",
    links: [
      { label: "How to start", to: "/brands" },
      { label: "Start a campaign", to: "/auth?returnTo=/dashboard/request" },
      { label: "Campaign rules", to: "/brands#rules" },
      { label: "Creator payouts", to: "/creators#payouts" },
      { label: "Brand invoicing", to: "/brands#invoicing" },
      { label: "Brand FAQ", to: "/faq" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Discord server", to: DISCORD_INVITE, external: true },
      { label: "Support email", to: `mailto:${SUPPORT_EMAIL}` },
      { label: "Sign in", to: "/auth" },
      { label: "Open dashboard", to: "/dashboard" },
    ],
  },
];

export const fadeUp = {
  initial: { opacity: 0, y: 28, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.7, ease: EASE },
};

/** Sticky bar for the standalone marketing pages. */
function MarketingHeader() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-background/80 px-5 py-3 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4">
        <Link to="/" className="shrink-0">
          <ClipVaultLogo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link to="/campaigns" className="transition-colors hover:text-foreground">
            Campaigns
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link to="/faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
              {isAuthenticated ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
          <Button asChild className="liquid glow-primary">
            <Link to={isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard"}>
              {isAuthenticated ? "Open dashboard" : "Get started"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-black/8 bg-black/[0.02] py-12 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <ClipVaultLogo />
          <p className="mt-3 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">
            The UGC clipping platform connecting brands with creators. Clip ·
            Post · Get Paid.
          </p>
        </div>
        {MARKETING_LINKS.map((column) => (
          <div key={column.title}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {column.title}
            </p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link.label}
                      <ArrowUpRight className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-5xl px-5 text-xs text-muted-foreground">
        © 2026 Clip Vault · Clip. Post. Get Paid. · Demo interface, simulated data.
      </p>
    </footer>
  );
}

/** Section heading used at the top of every marketing page. */
export function PageHero({
  eyebrow,
  title,
  lead,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  icon?: LucideIcon;
  /** Optional row of buttons under the lead paragraph. */
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-black/8 py-20 dark:border-white/10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[620px] -translate-x-1/2 rounded-full bg-[#8B3FE2]/25 blur-[120px]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative mx-auto max-w-3xl px-5 text-center"
      >
        {Icon && (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
          {lead}
        </p>
        {children && <div className="mt-8">{children}</div>}
      </motion.div>
    </section>
  );
}

/** Wraps a marketing page with the shared header/footer and hash scrolling. */
export function MarketingShell({ children }: { children: ReactNode }) {
  const { hash } = useLocation();
  /* "/brands#rules" style links: a client-side navigation does not move the
     viewport by itself, so the anchor is resolved here instead. */
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

/** Standard closing call to action reused by every marketing page. */
export function MarketingCTA({
  title,
  body,
  discord = true,
  primaryLabel = "Start clipping",
  primaryTo = "/auth?returnTo=/dashboard",
}: {
  title: string;
  body: string;
  /** Offer the Discord invite alongside the auth button. */
  discord?: boolean;
  /** Main call to action. Brands land on the campaign request, not the console. */
  primaryLabel?: string;
  primaryTo?: string;
}) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20">
      <motion.div
        {...fadeUp}
        className="panel-fx relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-b from-brand/15 to-brand/[0.03] px-6 py-14 text-center"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[520px] -translate-x-1/2 rounded-full bg-[#6D28D9]/40 blur-[110px]" />
        <div className="relative">
          <ClipVaultMark className="mx-auto h-12 w-12" />
          <h2 className="mx-auto mt-5 max-w-xl text-balance text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-balance text-sm text-muted-foreground">
            {body}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="liquid glow-primary h-12 bg-gradient-to-b from-[#A855F7] to-[#8B3FE2] px-7 hover:from-[#8B6BFF] hover:to-[#6642EE]"
            >
              <Link to={primaryTo}>
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {discord && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-black/20 bg-black/[0.03] px-6 hover:bg-black/[0.06] dark:border-white/20 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
              >
                <a href={DISCORD_INVITE} target="_blank" rel="noreferrer">
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Join the Discord
                </a>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
