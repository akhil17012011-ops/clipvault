import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { CampaignCard } from "@/components/CampaignCard";
import { ClipticLogo, ClipticMark } from "@/components/ClipticMark";
import { PlatformChip, PlatformIcon, StatusBadge } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
import { fmtRate, type Platform } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { EASE } from "@/lib/motion";
import { useAuth } from "@/hooks/use-auth";
import { useTilt } from "@/hooks/use-tilt";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Megaphone,
  MousePointerClick,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 30, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-70px" },
  transition: {
    duration: 0.7,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
};

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function SiteNav() {
  const { isAuthenticated } = useAuth();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 transition-all duration-300 sm:px-5 sm:pt-4">
      <nav
        className={`relative mx-auto flex h-16 max-w-6xl items-center justify-between overflow-hidden rounded-2xl px-4 transition-all duration-300 sm:px-5 ${
          scrolled
            ? "glass shadow-[0_20px_50px_-26px_rgb(76_29_149/0.45)]"
            : "border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl"
        }`}
      >
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
          <a href="#creators" className="transition-colors hover:text-foreground">
            For creators
          </a>
        </div>
        <div className="flex items-center gap-2">

          {isAuthenticated ? (
            <Button
              asChild
              variant="ghost"
              className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
          <Button asChild className="liquid glow-primary">
            <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
              {isAuthenticated ? "Open dashboard" : "Get Started"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <motion.div
          style={{ scaleX: progress }}
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-[#8B3FE2] via-[#8B5CF6] to-[#8B3FE2]"
        />
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: left copy + floating clip cluster (clipping.net layout)      */
/* ------------------------------------------------------------------ */

type ClipCardData = {
  platform: Platform;
  title: string;
  views: string;
  tone: string;
  tilt: string;
  bob: string;
  delay: number;
  wide: boolean;
};

const CLIP_CARDS: ClipCardData[] = [
  {
    platform: "tiktok",
    title: "Ring walk cut",
    views: "1.2M",
    tone: "from-[#8B3FE2] to-[#2C1B7E]",
    tilt: "-rotate-3",
    bob: "float-a",
    delay: 0.15,
    wide: false,
  },
  {
    platform: "youtube",
    title: "Podcast highlight",
    views: "840K",
    tone: "from-[#7C3AED] to-[#4C1D95]",
    tilt: "rotate-2",
    bob: "float-b",
    delay: 0.3,
    wide: true,
  },
  {
    platform: "instagram",
    title: "Training reel",
    views: "2.4M",
    tone: "from-[#8B5CF6] to-[#8B3FE2]",
    tilt: "-rotate-1",
    bob: "float-a",
    delay: 0.45,
    wide: false,
  },
];

/**
 * A single clip tile. Three transform layers keep concerns separate:
 * entrance animation (outer), pointer parallax (middle), CSS bobbing (inner)
 * — stacking them on one element would let the CSS keyframes win the cascade.
 */
function ParallaxClipCard({
  card,
  index,
  mx,
  my,
}: {
  card: ClipCardData;
  index: number;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const depth = index === 1 ? 30 : index === 0 ? 16 : 21;
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  /* Per-card 3D tilt layered on top of the cluster parallax. */
  const tilt = useTilt(10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 46, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay: card.delay, ease: EASE }}
      className={index === 1 ? "z-10 -mt-6" : ""}
    >
      <motion.div
        style={{ x, y, ...tilt.style }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        className="cursor-pointer"
      >
        <div
          className={`w-32 rounded-[26px] border border-white/70 bg-gradient-to-b ${card.tone} p-2 shadow-[0_34px_70px_-34px_rgb(76_20_130/0.6)] sm:w-40 ${card.tilt}`}
        >
          <div className="flex items-center justify-between px-0.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur">
              <PlatformIcon platform={card.platform} className="h-4 w-4" />
            </span>
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-white backdrop-blur">
              TRACKING
            </span>
          </div>
          <div
            className={`mt-2 flex ${card.wide ? "aspect-[9/15]" : "aspect-[9/17]"} flex-col items-center justify-center rounded-[18px] bg-white/15`}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-brand shadow-lg transition-transform duration-300 hover:scale-110">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 px-0.5 pb-0.5 pt-2 text-white">
            <p className="truncate text-[10.5px] font-semibold">
              {card.title}
            </p>
            <p className="font-mono text-[10.5px] font-bold">
              {card.views}
            </p>
          </div>
          {/* Violet specular glare following the pointer */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[26px]"
            style={{ backgroundImage: tilt.glare }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ClipCluster() {
  /* Pointer position across the cluster, normalised to -1..1 and smoothed. */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 140, damping: 18, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 140, damping: 18, mass: 0.4 });

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mx.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    my.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[#7C3AED]/20 blur-3xl" />
      <div
        onPointerMove={handleMove}
        onPointerLeave={reset}
        className="relative flex items-end justify-center gap-2.5 sm:gap-3.5"
      >
        {CLIP_CARDS.map((card, i) => (
          <ParallaxClipCard
            key={card.title}
            card={card}
            index={i}
            mx={sx}
            my={sy}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
        className="mt-7 flex items-center justify-center gap-2.5"
      >
        {(["youtube", "tiktok", "instagram", "youtube", "tiktok"] as Platform[]).map(
          (platform, i) => (
            <span
              key={`${platform}-${i}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-white/10 text-foreground shadow-sm transition-transform duration-300 hover:-translate-y-1"
            >
              <PlatformIcon platform={platform} className="h-4 w-4" />
            </span>
          ),
        )}
      </motion.div>
    </div>
  );
}

function Hero() {
  const { isAuthenticated } = useAuth();
  const { campaigns } = useCliptic();
  const ctaTarget = isAuthenticated ? "/dashboard" : "/auth";
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "active",
  ).length;
  const topRate = campaigns.reduce(
    (max, c) => Math.max(max, c.ratePer1k),
    0,
  );
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const blobY1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, 340]);
  const blobY3 = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const clusterY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden pb-20 pt-32 sm:pt-40"
    >
      {/* Parallax blooms drawn as radial gradients rather than blurred divs:
          animating `y` on a `filter: blur(150px)` layer re-rasterises that
          layer every frame, which is the single most expensive thing a hero
          can do. A gradient moves on the compositor for free. */}
      <motion.div
        style={{ y: blobY1 }}
        className="pointer-events-none absolute -top-52 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(109_40_217/0.4),transparent)]"
      />
      <motion.div
        style={{ y: blobY2 }}
        className="pointer-events-none absolute -left-40 top-64 h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,rgb(168_85_247/0.26),transparent)]"
      />
      <motion.div
        style={{ y: blobY3 }}
        className="pointer-events-none absolute -right-40 top-96 h-[340px] w-[340px] rounded-full bg-[radial-gradient(closest-side,rgb(59_15_122/0.4),transparent)]"
      />
      <div className="grid-page pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-10 pt-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="text-center lg:text-left">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.75, ease: EASE }}
          className="inline-flex items-center gap-2.5 rounded-full border border-brand/35 bg-brand/10 px-4 py-1.5 text-[12.5px] font-semibold text-brand"
        >
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-neon text-neon" />
          The UGC clipping network · Clip · Post · Get Paid
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
          className="mt-7 max-w-4xl text-balance text-5xl font-extrabold leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:mx-0 lg:text-7xl"
        >
          Grow, Earn, and Go Viral with <span className="text-grad">CLIPTIC</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.75, delay: 0.16, ease: EASE }}
          className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0"
        >
          A creative marketplace uniting brands and digital talent. Brands launch
          campaigns, expert clippers craft viral content, and every verified view
          pays out.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.75, delay: 0.24, ease: EASE }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
        >
          <Button
            asChild
            size="lg"
            className="liquid glow-primary h-12 bg-gradient-to-b from-[#A855F7] to-[#8B3FE2] px-7 text-base hover:from-[#8B6BFF] hover:to-[#6642EE]"
          >
            <Link to={ctaTarget}>
              {isAuthenticated ? "Open dashboard" : "Start clipping"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 border-black/15 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] px-7 text-base text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <Link
              to={
                isAuthenticated
                  ? "/dashboard"
                  : "/auth?returnTo=/dashboard"
              }
            >
              <Megaphone className="mr-2 h-4 w-4" />
              {isAuthenticated ? "Admin console" : "Start campaign"}
            </Link>
          </Button>
        </motion.div>

        <p className="mt-4 text-xs text-muted-foreground">
          Free to join · No following required
        </p>

        <dl className="mx-auto mt-12 grid w-full max-w-2xl grid-cols-3 divide-x divide-black/10 dark:divide-white/10 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] py-5 backdrop-blur lg:mx-0">
          {[
            { value: `${activeCampaigns}`, label: "live campaigns" },
            { value: fmtRate(topRate), label: "top rate / 1K views" },
            { value: "3", label: "platforms tracked" },
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
        </div>

        <motion.div style={{ y: clusterY }}>
          <ClipCluster />
        </motion.div>
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
  /* Mock product panels tilt toward the pointer in 3D. */
  const tilt = useTilt(4);
  return (
    <motion.div
      style={tilt.style}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      className="panel-fx rounded-2xl border border-black/10 dark:border-white/10 bg-card p-5 shadow-[0_36px_90px_-45px_rgb(139_63_226/0.9)]"
    >
      {title && (
        <p className="relative z-[2] mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
      )}
      <div className="relative z-[2]">{children}</div>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ backgroundImage: tilt.glare }}
      />
    </motion.div>
  );
}

function MockCampaign() {
  return (
    <MockFrame title="Live campaign">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#C084FC] to-[#5B0FA6] text-sm font-bold text-white ring-1 ring-black/10 dark:ring-white/15">
          RA
        </span>
        <div>
          <p className="text-sm font-semibold">Ripple Audio</p>
          <p className="text-[13px] font-bold tracking-tight">
            Ripple Air Pro Launch
          </p>
        </div>
        <span className="ml-auto rounded-lg border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-bold text-brand">
          50d left
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between rounded-xl border border-black/8 dark:border-white/10 bg-background/60 px-4 py-3">
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-brand">
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
            className="flex items-center justify-between rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-2.5"
          >
            <span className="font-mono text-[13px] text-foreground">
              {account.handle}
            </span>
            <StatusBadge status={account.status} />
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-brand" />
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
                : "border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05]"
            }`}
          >
            <span className="flex items-center gap-2.5 font-semibold">
              <Wallet className={`h-4 w-4 ${i === 0 ? "text-brand" : "text-muted-foreground"}`} />
              {method.name}
            </span>
            <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
              {method.note}
              {i === 0 && <Check className="h-4 w-4 text-brand" />}
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
                : "border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] text-muted-foreground"
            }`}
          >
            {tab.label}
          </span>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-background/60 px-3.5 py-3">
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
      <div className="overflow-hidden rounded-xl border border-black/8 dark:border-white/10">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-black/[0.04] dark:bg-white/[0.06] text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3.5 py-2 font-semibold">Cycle</th>
              <th className="px-3.5 py-2 font-semibold">Status</th>
              <th className="px-3.5 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/8 dark:divide-white/10">
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
                <td className="px-3.5 py-2.5 text-right font-mono font-bold text-brand">
                  {cycle.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <CircleDollarSign className="h-4 w-4 text-brand" />
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

/* ---------------- brand-side steps ("For brands" tab) ---------------- */

function MockBrandLaunch() {
  return (
    <MockFrame title="New campaign">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-4 py-3">
          <span className="text-sm font-semibold">Ripple Audio</span>
          <span className="rounded-lg bg-brand/10 px-2 py-1 text-[11px] font-bold text-brand">
            Fall Drop
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-black/8 dark:border-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Rate / 1K
            </p>
            <p className="mt-1 text-xl font-extrabold text-brand">
              {fmtRate(1.5)}
            </p>
          </div>
          <div className="rounded-xl border border-black/8 dark:border-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Budget
            </p>
            <p className="mt-1 text-xl font-extrabold">$25,000</p>
          </div>
        </div>
        <div className="flex gap-2">
          <PlatformChip platform="tiktok" size="sm" />
          <PlatformChip platform="instagram" size="sm" />
          <PlatformChip platform="youtube" size="sm" />
        </div>
        <span className="block rounded-xl bg-foreground px-4 py-2.5 text-center text-xs font-bold text-background">
          Launch campaign
        </span>
      </div>
    </MockFrame>
  );
}

function MockBrandReach() {
  const stats = [
    { label: "Clips live", value: "1,284" },
    { label: "Verified views", value: "357M" },
    { label: "Avg CPM", value: "$0.90" },
  ];
  return (
    <MockFrame title="Campaign is live">
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-black/8 dark:border-white/10 px-3 py-3 text-center"
          >
            <p className="font-mono text-lg font-extrabold tracking-tight">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-black/8 dark:border-white/10 px-4 py-3">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Budget spent</span>
          <span className="font-semibold">$18,420 / $25,000</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
          <div className="h-full w-[73%] rounded-full bg-gradient-to-r from-brand to-[#a78bfa]" />
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-neon text-neon" />
        Clippers are posting right now — stats refresh live.
      </p>
    </MockFrame>
  );
}

function MockBrandInvoice() {
  const invoices = [
    { brand: "Ripple Audio", status: "Paid", tone: "border-neon/25 bg-neon/10 text-neon", amount: "$8,420" },
    { brand: "Monolith", status: "Sent", tone: "border-amber-400/25 bg-amber-400/10 text-amber-600 dark:text-amber-300", amount: "$5,140" },
    { brand: "Pulse", status: "Draft", tone: "border-black/12 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] text-muted-foreground", amount: "$2,980" },
  ];
  return (
    <MockFrame title="One invoice per cycle">
      <ul className="space-y-2.5">
        {invoices.map((invoice) => (
          <li
            key={invoice.brand}
            className="flex items-center justify-between rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-4 py-2.5"
          >
            <span className="text-[13px] font-semibold">{invoice.brand}</span>
            <span className="flex items-center gap-3">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${invoice.tone}`}
              >
                {invoice.status}
              </span>
              <span className="font-mono text-sm font-bold text-brand">
                {invoice.amount}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-brand" />
        Pay only for verified, bot-filtered views.
      </p>
    </MockFrame>
  );
}

const BRAND_STEPS = [
  {
    n: "01",
    kicker: "Launch",
    title: "Set rate, rules & budget",
    body: "Define what a verified view pays, which platforms are allowed, and the guidelines clippers must follow. Everything is public before anyone joins.",
    mock: <MockBrandLaunch />,
  },
  {
    n: "02",
    kicker: "Reach",
    title: "Clippers do the rest",
    body: "Thousands of verified creators pick up your campaign and post. Views, engagement and attribution are tracked straight from the source platform.",
    mock: <MockBrandReach />,
  },
  {
    n: "03",
    kicker: "Pay",
    title: "Only for verified views",
    body: "When a cycle closes you review the numbers and get a single invoice. You pay for real, verified views — nothing else, no waste.",
    mock: <MockBrandInvoice />,
  },
];

function HowItWorks() {
  const [audience, setAudience] = useState<"clippers" | "brands">("clippers");
  const steps = audience === "clippers" ? STEPS : BRAND_STEPS;
  return (
    <section id="how" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-brand" />
            How it works
          </span>
          <h2 className="mt-5 text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
            {audience === "clippers"
              ? "Five steps to your first payout."
              : "Three steps to a live campaign."}
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            {audience === "clippers" ? (
              <>
                No following, no application, no catch. Pick a campaign, post
                your clips, and watch the views turn into earnings.
              </>
            ) : (
              <>
                Set the rate, fund the budget, and only pay for verified views.
                Clippers handle the reach — you handle the creative brief.
              </>
            )}
          </p>

          {/* clipping.net audience switch */}
          <div className="mt-7 inline-flex rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] p-1">
            {(["clippers", "brands"] as const).map((audienceOption) => (
              <button
                key={audienceOption}
                type="button"
                onClick={() => setAudience(audienceOption)}
                aria-pressed={audience === audienceOption}
                className="relative rounded-xl px-5 py-2.5 text-sm font-bold transition-colors"
              >
                {audience === audienceOption && (
                  <motion.span
                    layoutId="cliptic-audience-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-foreground"
                  />
                )}
                <span
                  className={`relative z-10 ${
                    audience === audienceOption
                      ? "text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {audienceOption === "clippers"
                    ? "For clippers"
                    : "For brands"}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        <div key={audience} className="mt-16 space-y-20">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.09 }}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/35 bg-brand/10 font-mono text-sm font-bold text-brand">
                    {step.n}
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.22em] text-brand">
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
      className="scroll-mt-24 border-y border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.03] py-24"
    >
      <div className="mx-auto max-w-6xl px-5">
        <motion.div {...fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
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
          {preview.map((campaign, i) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{
                duration: 0.85,
                delay: i * 0.09,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <CampaignCard
                campaign={campaign}
                onJoin={() => handleJoin(campaign.id, campaign.brand)}
              />
            </motion.div>
          ))}
          {preview.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/12 px-6 py-14 text-center dark:border-white/15">
              <Sparkles className="h-6 w-6 text-brand" />
              <p className="mt-3 text-sm font-semibold">
                Campaigns appear here the moment a brand launches one
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Every campaign shows its reward rate, qualifying threshold and
                rules before you join — there is nothing to apply for.
              </p>
              <Button asChild className="mt-5 gap-1.5 glow-primary">
                <Link to="/auth?returnTo=/dashboard">
                  Create your free account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        <motion.div {...fadeUp} className="mt-10 text-center">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-black/15 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
              {isAuthenticated
                ? "Open your campaign feed"
                : `Browse all ${campaigns.length} campaigns`}
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
  const { isAuthenticated } = useAuth();
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
      cta: isAuthenticated ? "Open dashboard" : "Start clipping",
      to: isAuthenticated ? "/dashboard" : "/auth",
      accent: "from-brand/25 to-brand/[0.04]",
      iconColor: "text-brand bg-brand/15 border-brand/30",
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
      cta: isAuthenticated ? "Open admin console" : "Start a campaign",
      to: isAuthenticated
        ? "/dashboard"
        : "/auth?returnTo=/dashboard",
      accent: "from-brand/15 to-transparent",
      iconColor: "text-brand bg-brand/10 border-brand/30",
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
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              className={`panel-fx group relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-b ${card.accent} p-8`}
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
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
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
                    : "glow-primary bg-gradient-to-b from-[#A855F7] to-[#8B3FE2] hover:from-[#8B6BFF] hover:to-[#6642EE]"
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
  const { isAuthenticated } = useAuth();
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <motion.div
        {...fadeUp}
        className="panel-fx relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-b from-brand/20 to-brand/[0.03] px-6 py-16 text-center sm:py-20"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-[#6D28D9]/45 blur-[110px]" />
        <div className="relative">
          <ClipticMark className="mx-auto h-14 w-14" />
          <h2 className="mx-auto mt-6 max-w-2xl text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
            Your next clip could be worth{" "}
            <span className="text-grad">real money</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
            Connect an account, join a campaign and watch every verified view
            turn into earnings. It takes about two minutes to get started.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="liquid glow-primary h-12 bg-gradient-to-b from-[#A855F7] to-[#8B3FE2] px-7 text-base hover:from-[#8B6BFF] hover:to-[#6642EE]"
            >
              <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
                {isAuthenticated ? "Open dashboard" : "Start clipping"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-black/20 dark:border-white/20 bg-black/[0.03] dark:bg-white/[0.05] px-7 text-base hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <Link
                to={
                  isAuthenticated
                    ? "/dashboard"
                    : "/auth?returnTo=/dashboard"
                }
              >
                {isAuthenticated ? "Admin console" : "Start campaign"}
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
    <footer className="border-t border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <ClipticLogo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The UGC clipping platform connecting brands with creators. Clip ·
            Post · Get Paid.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">
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
      <div className="border-t border-black/8 dark:border-white/10 py-5">
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
        <HowItWorks />
        <CampaignsSection />
        <TwoSides />
        <FinalCTA />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
