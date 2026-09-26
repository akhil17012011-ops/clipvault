import { ClipticMark } from "@/components/ClipticMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useCliptic } from "@/lib/cliptic-store";
import { scrollToSection } from "@/lib/smooth-scroll";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Bug,
  ChevronUp,
  Clapperboard,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Megaphone,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import type { DashboardView } from "./TopBar";

type NavItem = { id: string; label: string; icon: LucideIcon };

const NAV: Record<DashboardView, NavItem[]> = {
  creator: [
    { id: "top", label: "Dashboard", icon: LayoutDashboard },
    { id: "campaigns", label: "Campaigns", icon: Megaphone },
    { id: "clips", label: "Clips", icon: Clapperboard },
    { id: "payouts", label: "Payments", icon: Wallet },
    { id: "accounts", label: "Accounts", icon: UserRound },
  ],
  admin: [
    { id: "top", label: "Dashboard", icon: LayoutDashboard },
    { id: "payouts", label: "Payouts", icon: Wallet },
    { id: "invoices", label: "Invoices", icon: ReceiptText },
    { id: "campaigns", label: "Campaigns", icon: Megaphone },
    { id: "moderation", label: "Moderation", icon: ShieldCheck },
  ],
};

export function Sidebar({
  role,
  open,
  onClose,
  onReset,
}: {
  role: DashboardView;
  /** Mobile drawer visibility (desktop rail is always rendered). */
  open: boolean;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <>
      {/* Desktop rail — fixed liquid-glass column */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-black/8 bg-white/70 dark:border-white/10 dark:bg-[#0C0A14]/70 backdrop-blur-2xl lg:flex">
        <SidebarBody layoutKey="nav-desktop" role={role} onReset={onReset} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="sidebar-backdrop"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              key="sidebar-drawer"
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-black/10 bg-white/85 dark:border-white/10 dark:bg-[#0C0A14]/90 backdrop-blur-2xl lg:hidden"
              initial={{ x: -300, opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 330, damping: 34 }}
            >
              <SidebarBody
                layoutKey="nav-mobile"
                role={role}
                onReset={onReset}
                onNavigate={onClose}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarBody({
  role,
  layoutKey,
  onReset,
  onNavigate,
}: {
  role: DashboardView;
  /** Unique layoutId per instance so the active pill animates per rail. */
  layoutKey: string;
  onReset: () => void;
  onNavigate?: () => void;
}) {
  const items = NAV[role];
  const { user, signOut } = useAuth();
  const { profile } = useCliptic();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("top");

  const name =
    profile?.name ?? user?.name ?? user?.email?.split("@")[0] ?? "Creator";
  const email = profile?.email ?? user?.email ?? "";
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /* Scrollspy: highlight the section currently under the reading band. */
  useEffect(() => {
    const sectionIds = items
      .map((item) => item.id)
      .filter((id) => id !== "top");
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const next = sectionIds.find((id) => visible.has(id));
        if (next) setActive(next);
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: 0 },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    const onScroll = () => {
      if (window.scrollY < 220) setActive("top");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [items]);

  const go = (id: string) => {
    scrollToSection(id);
    setActive(id);
    onNavigate?.();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleReset = () => {
    onReset();
    toast.success("Demo data reset", {
      description: "Campaigns, clips and accounts are back to their defaults.",
    });
  };

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Brand + notifications */}
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2.5">
          <ClipticMark className="h-9 w-9" />
          <span className="leading-none">
            <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Beta
            </span>
            <span className="block text-[15px] font-extrabold tracking-tight">
              CLIPTIC
            </span>
          </span>
        </Link>
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={() =>
            toast("No new notifications", {
              description: "Campaign alerts and payout receipts show up here.",
            })
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/[0.03] text-muted-foreground transition-colors hover:border-brand/35 hover:bg-brand/10 hover:text-brand dark:border-white/10 dark:bg-white/[0.05]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Quick search — filters the section list */}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="w-full rounded-xl border border-black/10 bg-black/[0.03] py-2.5 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-brand/45 focus:bg-brand/[0.06] focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-white/[0.05] dark:focus:border-brand/50"
        />
      </label>

      {/* Section navigation */}
      <nav
        data-lenis-prevent
        className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1 pb-2"
      >
        {filtered.map((item, index) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.05 + index * 0.05,
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold"
            >
              {isActive && (
                <motion.span
                  layoutId={`${layoutKey}-active`}
                  className="absolute inset-0 rounded-xl border border-brand/25 bg-brand/10 shadow-[0_8px_20px_-10px_rgb(91_55_232/0.55)]"
                  transition={{ type: "spring", stiffness: 430, damping: 34 }}
                />
              )}
              <Icon
                className={`relative h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110 ${
                  isActive
                    ? "text-brand"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span
                className={`relative transition-colors ${
                  isActive
                    ? "text-brand"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            No sections match “{query}”.
          </p>
        )}
      </nav>

      {/* Feedback */}
      <div className="space-y-1 border-t border-black/8 pt-3 dark:border-white/10">
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Feedback
        </p>
        <button
          type="button"
          onClick={() =>
            toast("Report a bug", {
              description:
                "Demo build — nothing is sent. Production opens your mail client.",
            })
          }
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-all hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
        >
          <Bug className="h-4 w-4 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
          Report Bug
        </button>
        <button
          type="button"
          onClick={() =>
            toast("Request a feature", {
              description:
                "Demo build — nothing is sent. Production opens the roadmap form.",
            })
          }
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-all hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
        >
          <Lightbulb className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          Request Feature
        </button>
      </div>

      {/* Account card */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="glass flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition-shadow duration-300 hover:shadow-[0_14px_34px_-14px_rgb(91_55_232/0.55)]"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B37E8] to-[#2F0FA6] text-xs font-bold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">
                {name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {email || "Signed in"}
              </span>
            </span>
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel>
            <p className="truncate text-sm font-semibold">{name}</p>
            {email && (
              <p className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </p>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            Landing page
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
