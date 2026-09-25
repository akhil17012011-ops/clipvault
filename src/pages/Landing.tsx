import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { CampaignCard } from "@/components/CampaignCard";
import { ClipticLogo, ClipticMark } from "@/components/ClipticMark";
import { PlatformChip, StatusBadge } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtRate, fmtViews, type Platform } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Megaphone,
  MousePointerClick,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/8 bg-background/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="shrink-0">
          <ClipticLogo />
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#campaigns" className="transition-colors hover:text-foreground">
            Campaigns
          </a>
          <a href="#brands" className="transition-colors hover:text-foreground">
            Brands
          </a>
          <a href="#creators" className="transition-colors hover:text-foreground">
            For creators
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild className="glow-primary">
            <Link to="/auth">
              Start clipping
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero + live product preview                                         */
/* ------------------------------------------------------------------ */

function HeroPreview() {
  const [views, setViews] = useState(4_812_400);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setViews((v) => v + Math.floor(Math.random() * 2_400) + 700);
    }, 1_500);
    return () => window.clearInterval(timer);
  }, []);

  const earned = (views / 1000) * 0.9;
  const rows: { platform: Platform; campaign: string; views: number }[] = [
    { platform: "tiktok", campaign: "Ripple Air Pro Launch", views: Math.round(views * 0.52) },
    { platform: "instagram", campaign: "Monolith Drop Season 04", views: Math.round(views * 0.31) },
    { platform: "youtube", campaign: "Pulse Summer Circuit", views: Math.round(views * 0.17) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 44 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      className="relative mx-auto mt-16 max-w-4xl"
    >
      <div className="float-a absolute -left-4 top-14 z-10 hidden md:block">
        <div className="flex items-center gap-2 rounded-xl border border-neon/25 bg-[#0d1410]/95 px-3 py-2 text-xs font-semibold text-neon shadow-2xl backdrop-blur">
          <BadgeCheck className="h-4 w-4" />
          @avaclips verified
        </div>
      </div>
      <div className="float-b absolute -right-4 bottom-20 z-10 hidden md:block">
        <div className="flex items-center gap-2 rounded-xl border border-brand/35 bg-[#100c22]/95 px-3 py-2 text-xs font-semibold text-[#c4b5fd] shadow-2xl backdrop-blur">
          <TrendingUp className="h-4 w-4" />
          +{fmtViews(48_210)} views today
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0b12]/90 shadow-[0_50px_140px_-50px_rgb(91_55_232/0.85)] backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="flex-1 rounded-md bg-white/5 px-3 py-1 text-center font-mono text-[11px] text-muted-foreground">
            app.cliptic.com/dashboard
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-5 sm:p-5">
          <div className="space-y-2.5 sm:col-span-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Your clips
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/25 bg-neon/10 px-2 py-0.5 text-[10px] font-bold text-neon">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-neon text-neon" />
                LIVE
              </span>
            </div>
            {rows.map((row) => (
              <div
                key={row.campaign}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <PlatformChip platform={row.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">
                    {row.campaign}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtViews(row.views)} views
                  </p>
                </div>
                <p className="font-mono text-[13px] font-bold text-neon">
                  {fmtMoney((row.views / 1000) * 0.9, true)}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3 sm:col-span-2">
            <div className="rounded-xl border border-brand/25 bg-gradient-to-b from-brand/15 to-transparent p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Total earnings
              </p>
              <p className="mt-1.5 font-mono text-3xl font-extrabold tracking-tight text-foreground">
                {fmtMoney(earned, true)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-neon">
                <TrendingUp className="h-3.5 w-3.5" /> +18.2% this week
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Next payout</span>
                <span className="font-semibold text-foreground">in 3 days</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-brand to-neon" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Accounts</span>
                <span className="inline-flex items-center gap-1 font-semibold text-neon">
                  <ShieldCheck className="h-3.5 w-3.5" /> 3 of 3 verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
      <div className="pointer-events-none absolute -top-52 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-[#5B37E8]/35 blur-[150px]" />
      <div className="pointer-events-none absolute -left-40 top-64 h-[380px] w-[380px] rounded-full bg-[#8B5CF6]/20 blur-[130px]" />
      <div className="pointer-events-none absolute -right-40 top-96 h-[340px] w-[340px] rounded-full bg-[#4C1D95]/30 blur-[120px]" />
      <div className="grid-fade pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-6xl px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center gap-2.5 rounded-full border border-brand/35 bg-brand/10 px-4 py-1.5 text-[12.5px] font-semibold text-[#c9bcff]"
        >
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-neon text-neon" />
          The UGC clipping network · Clip · Post · Get Paid
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
          className="mx-auto mt-7 max-w-4xl text-balance text-5xl font-extrabold leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
        >
          Grow, Earn, and Go Viral with <span className="text-grad">CLIPTIC</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          A creative marketplace uniting brands and digital talent. Brands launch
          campaigns, expert clippers craft viral content, and every verified view
          pays out.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: "easeOut" }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button
            asChild
            size="lg"
            className="glow-primary h-12 bg-gradient-to-b from-[#7C5CFF] to-[#5B37E8] px-7 text-base hover:from-[#8B6BFF] hover:to-[#6642EE]"
          >
            <Link to="/auth">
              Start clipping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 border-white/15 bg-white/5 px-7 text-base text-foreground hover:bg-white/10"
          >
            <Link to="/auth?returnTo=/dashboard?tab=admin">
              <Megaphone className="mr-2 h-4 w-4" />
              Start campaign
            </Link>
          </Button>
        </motion.div>

        <p className="mt-4 text-xs text-muted-foreground">
          Free to join · No following required
        </p>

        <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] py-5 backdrop-blur">
          {[
            { value: "$60M+", label: "paid to clippers" },
            { value: "77,000+", label: "clippers ready" },
            { value: "200+", label: "brand campaigns" },
          ].map((stat) => (
            <div key={stat.label} className="px-3">
              <dt className="font-mono text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {stat.value}
              </dt>
              <dd className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>

        <HeroPreview />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Brand marquee                                                       */
/* ------------------------------------------------------------------ */

function BrandMarquee() {
  const brands = [
    "MONOLITH",
    "Ripple",
    "PULSE",
    "VERTEX",
    "HÄLO",
    "NORTHWIND",
    "KOVA",
    "LUMA",
    "ARCADIA",
    "BRIGHTSIDE",
  ];
  return (
    <section id="brands" className="scroll-mt-24 border-y border-white/8 bg-white/[0.015] py-10">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Trusted by top brands
      </p>
      <div
        className="relative mt-6 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div className="marquee">
          {[0, 1].map((set) => (
            <div key={set} className="flex shrink-0 gap-14 pr-14" aria-hidden={set === 1}>
              {brands.map((brand) => (
                <span
                  key={brand}
                  className="whitespace-nowrap text-2xl font-extrabold tracking-tight text-white/35 transition-colors duration-300 hover:text-white/75"
                >
                  {brand}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works — five steps with mock product cards                   */
/* ------------------------------------------------------------------ */

function MockFrame({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card/70 p-5 shadow-[0_36px_90px_-45px_rgb(91_55_232/0.9)]">
      {title && (
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function MockCampaign() {
  return (
    <MockFrame title="Live campaign">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white ring-1 ring-white/15">
          RA
        </span>
        <div>
          <p className="text-sm font-semibold">Ripple Audio</p>
          <p className="text-[13px] font-bold tracking-tight">
            Ripple Air Pro Launch
          </p>
        </div>
        <span className="ml-auto rounded-lg border border-neon/25 bg-neon/10 px-2 py-1 text-[11px] font-bold text-neon">
          50d left
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between rounded-xl border border-white/8 bg-background/60 px-4 py-3">
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-neon">
            {fmtRate(0.4)}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">
              / 1K views
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Min to qualify
          </p>
          <p className="text-sm font-bold">100K views</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <PlatformChip platform="tiktok" size="sm" />
          <PlatformChip platform="instagram" size="sm" />
          <PlatformChip platform="youtube" size="sm" />
        </div>
        <span className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Join in one tap
        </span>
      </div>
    </MockFrame>
  );
}

function MockAccounts() {
  const accounts = [
    { handle: "@bb****ps", status: "connected" as const },
    { handle: "@cl****lt", status: "connected" as const },
    { handle: "@ne****ig", status: "checking" as const },
    { handle: "@sc****yn", status: "connected" as const },
  ];
  return (
    <MockFrame title="Connected accounts">
      <ul className="space-y-2.5">
        {accounts.map((account) => (
          <li
            key={account.handle}
            className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5"
          >
            <span className="font-mono text-[13px] text-foreground">
              {account.handle}
            </span>
            <StatusBadge status={account.status} />
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-neon" />
        Verified once — views track back to you automatically.
      </p>
    </MockFrame>
  );
}

function MockPayout() {
  const methods = [
    { name: "PayPal", note: "Fast, no fees" },
    { name: "USDC", note: "Ethereum" },
    { name: "USDT", note: "Ethereum" },
  ];
  return (
    <MockFrame title="Payout method">
      <div className="grid gap-2.5">
        {methods.map((method, i) => (
          <div
            key={method.name}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
              i === 0
                ? "border-brand/45 bg-brand/10"
                : "border-white/8 bg-white/[0.03]"
            }`}
          >
            <span className="flex items-center gap-2.5 font-semibold">
              <Wallet className={`h-4 w-4 ${i === 0 ? "text-[#c4b5fd]" : "text-muted-foreground"}`} />
              {method.name}
            </span>
            <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
              {method.note}
              {i === 0 && <Check className="h-4 w-4 text-neon" />}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Clock3 className="h-4 w-4 text-brand" />
        Paid out automatically when a cycle closes.
      </p>
    </MockFrame>
  );
}

function MockPost() {
  const tabs: { label: string; active?: boolean }[] = [
    { label: "TikTok", active: true },
    { label: "Reels" },
    { label: "Shorts" },
    { label: "X" },
  ];
  return (
    <MockFrame title="Drop your clip">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <span
            key={tab.label}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              tab.active
                ? "bg-primary text-primary-foreground"
                : "border border-white/10 bg-white/5 text-muted-foreground"
            }`}
          >
            {tab.label}
          </span>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-white/10 bg-background/60 px-3.5 py-3">
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-[12.5px] text-muted-foreground">
          tiktok.com/@avaclips/video/74018…
        </span>
        <span className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
          Submit
        </span>
      </div>
      <p className="mt-3.5 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Search className="h-4 w-4 text-brand" />
        Views are pulled straight from the source platform.
      </p>
    </MockFrame>
  );
}

function MockCycles() {
  const cycles = [
    { label: "Ripple · August", status: "Paid" as const, amount: "$1,820" },
    { label: "Monolith · July", status: "Paid" as const, amount: "$940" },
    { label: "Pulse · July", status: "pending" as const, amount: "$1,460" },
  ];
  return (
    <MockFrame title="Your payout cycles">
      <div className="overflow-hidden rounded-xl border border-white/8">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3.5 py-2 font-semibold">Cycle</th>
              <th className="px-3.5 py-2 font-semibold">Status</th>
              <th className="px-3.5 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {cycles.map((cycle) => (
              <tr key={cycle.label}>
                <td className="px-3.5 py-2.5 font-medium">{cycle.label}</td>
                <td className="px-3.5 py-2.5">
                  {cycle.status === "Paid" ? (
                    <StatusBadge status="paid" />
                  ) : (
                    <StatusBadge status="pending" />
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono font-bold text-neon">
                  {cycle.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <CircleDollarSign className="h-4 w-4 text-neon" />
        Earnings climb live as views roll in.
      </p>
    </MockFrame>
  );
}

const STEPS = [
  {
    n: "01",
    kicker: "Start clipping",
    title: "Pick a campaign",
    body: "Browse live campaigns from real brands. See the rate, platforms, and rules up front, then join in one tap. No following or application required.",
    mock: <MockCampaign />,
  },
  {
    n: "02",
    kicker: "Connect",
    title: "Verify your accounts",
    body: "Add the TikTok, Reels, or Shorts accounts you post from. CLIPTIC generates a one-time code for your bio — verify once and every view is tracked back to you.",
    mock: <MockAccounts />,
  },
  {
    n: "03",
    kicker: "Set up",
    title: "Add your payout method",
    body: "Choose how you want to get paid — PayPal or crypto (USDC and USDT on Ethereum) — so your earnings land automatically when a cycle closes.",
    mock: <MockPayout />,
  },
  {
    n: "04",
    kicker: "Post",
    title: "Drop your clips",
    body: "Post to your connected accounts, then paste the link. Views and engagement are pulled straight from the source platform, no manual reporting.",
    mock: <MockPost />,
  },
  {
    n: "05",
    kicker: "Cash out",
    title: "Get paid per view",
    body: "Your earnings climb live as views roll in. When the cycle closes and views are verified, your payout is sent to your chosen method.",
    mock: <MockCycles />,
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-neon" />
            How it works
          </span>
          <h2 className="mt-5 text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
            Five steps to your first payout.
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            No following, no application, no catch. Pick a campaign, post your
            clips, and watch the views turn into earnings.
          </p>
        </motion.div>

        <div className="mt-16 space-y-20">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              {...fadeUp}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/35 bg-brand/10 font-mono text-sm font-bold text-[#c4b5fd]">
                    {step.n}
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.22em] text-neon">
                    {step.kicker}
                  </span>
                </div>
                <h3 className="mt-5 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : undefined}>
                {step.mock}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live campaigns                                                      */
/* ------------------------------------------------------------------ */

function CampaignsSection() {
  const { campaigns, toggleJoinCampaign } = useCliptic();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const preview = campaigns
    .filter((c) => c.status === "active")
    .slice(0, 3);

  const handleJoin = (id: string, brand: string) => {
    if (!isAuthenticated) {
      navigate("/auth?returnTo=/dashboard");
      return;
    }
    toggleJoinCampaign(id);
    toast.success(`Joined ${brand}`, {
      description: "Open your dashboard to submit your first clip.",
    });
  };

  return (
    <section
      id="campaigns"
      className="scroll-mt-24 border-y border-white/8 bg-white/[0.015] py-24"
    >
      <div className="mx-auto max-w-6xl px-5">
        <motion.div {...fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[#c4b5fd]" />
              Live campaigns
            </span>
            <h2 className="mt-5 text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
              Real brands. Published rates.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Every campaign shows its reward rate, qualifying threshold and rules
            before you join. What you see is what a verified view pays.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((campaign) => (
            <motion.div key={campaign.id} {...fadeUp}>
              <CampaignCard
                campaign={campaign}
                onJoin={() => handleJoin(campaign.id, campaign.brand)}
              />
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} className="mt-10 text-center">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/5 hover:bg-white/10"
          >
            <Link to="/auth">
              Browse all 200+ campaigns
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Two sides + final CTA                                               */
/* ------------------------------------------------------------------ */

function TwoSides() {
  const cards = [
    {
      icon: Wallet,
      title: "Clippers",
      desc: "Get paid per view on the clips you already post. Pick a campaign, drop your edit, watch the counter climb.",
      bullets: [
        "Per-view payouts, published up front",
        "No follower minimum, no application",
        "Weekly cycles, PayPal or crypto",
      ],
      cta: "Start clipping",
      to: "/auth",
      accent: "from-brand/25 to-brand/[0.04]",
      iconColor: "text-[#c4b5fd] bg-brand/15 border-brand/30",
    },
    {
      icon: Megaphone,
      title: "Brands",
      desc: "Reach you only pay for when it's verified. Set the rate, the rules and the budget — creators do the rest.",
      bullets: [
        "Verified views only, bot-filtered",
        "Full control of rate, rules and budget",
        "Invoice tracking and payout reporting",
      ],
      cta: "Start a campaign",
      to: "/auth?returnTo=/dashboard?tab=admin",
      accent: "from-neon/15 to-transparent",
      iconColor: "text-neon bg-neon/10 border-neon/25",
    },
  ];

  return (
    <section id="creators" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
            Two sides. One platform.
            <br />
            <span className="text-grad">Pick yours.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Clippers get paid per view. Brands get reach they only pay for when
            it is verified.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <motion.div
              key={card.title}
              {...fadeUp}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${card.accent} p-8 transition-all duration-300 hover:border-white/20`}
            >
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${card.iconColor}`}
              >
                <card.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight">
                {card.title}
              </h3>
              <p className="mt-2.5 leading-relaxed text-muted-foreground">
                {card.desc}
              </p>
              <ul className="mt-6 space-y-2.5">
                {card.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-start gap-2.5 text-sm text-foreground/85"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className={`mt-8 w-full ${
                  card.title === "Brands"
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "glow-primary bg-gradient-to-b from-[#7C5CFF] to-[#5B37E8] hover:from-[#8B6BFF] hover:to-[#6642EE]"
                }`}
              >
                <Link to={card.to}>
                  {card.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <motion.div
        {...fadeUp}
        className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-b from-brand/20 to-brand/[0.03] px-6 py-16 text-center sm:py-20"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-[#5B37E8]/40 blur-[110px]" />
        <div className="relative">
          <ClipticMark className="mx-auto h-14 w-14" />
          <h2 className="mx-auto mt-6 max-w-2xl text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
            Your next clip could be worth{" "}
            <span className="text-neon">$1,820</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
            Join 77,000+ clippers turning short-form video into income. It takes
            two minutes to connect an account and join your first campaign.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="glow-primary h-12 bg-gradient-to-b from-[#7C5CFF] to-[#5B37E8] px-7 text-base hover:from-[#8B6BFF] hover:to-[#6642EE]"
            >
              <Link to="/auth">
                Start clipping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/20 bg-white/5 px-7 text-base hover:bg-white/10"
            >
              <Link to="/auth?returnTo=/dashboard?tab=admin">
                Start campaign
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Free to join · No following required
          </p>
        </div>
      </motion.div>
    </section>
  );
}

function SiteFooter() {
  const columns: { title: string; links: string[] }[] = [
    { title: "Product", links: ["How it works", "Campaigns", "Payouts", "Pricing"] },
    { title: "Creators", links: ["Start clipping", "Verify accounts", "Payout methods", "Creator FAQ"] },
    { title: "Brands", links: ["Start a campaign", "Campaign rules", "Brand invoicing", "Case studies"] },
    { title: "Company", links: ["About", "Careers", "Privacy", "Terms"] },
  ];
  return (
    <footer className="border-t border-white/8 bg-black/25">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <ClipticLogo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The UGC clipping platform connecting brands with creators. Clip ·
            Post · Get Paid.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[11px] font-bold text-neon">
            <MousePointerClick className="h-3.5 w-3.5" />
            Demo build
          </span>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {column.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link}>
                  <a
                    href="#how"
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8 py-5">
        <p className="mx-auto max-w-6xl px-5 text-center text-xs text-muted-foreground">
          © 2026 CLIPTIC · Clip. Post. Get Paid. · Demo interface, simulated
          data.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
      className="min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      <SiteNav />
      <main>
        <Hero />
        <BrandMarquee />
        <HowItWorks />
        <CampaignsSection />
        <TwoSides />
        <FinalCTA />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
