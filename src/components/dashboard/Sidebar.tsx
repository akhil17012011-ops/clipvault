import { ClipVaultMark } from "@/components/ClipVaultMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { DISCORD_INVITE, SUPPORT_EMAIL } from "@/lib/clip-vault-data";
import { useClipVault } from "@/lib/clip-vault-store";
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
  Search,
  ShieldCheck,
  UserRound,
  Users,
  MessageSquare,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { EASE, SPRING, SPRING_PILL } from "@/lib/motion";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import type { DashboardView } from "./TopBar";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Heading this item sits under; a label is drawn when the group changes. */
  group: "Workspace" | "Manage";
};

/** Every sidebar entry is a separate page under /dashboard/:section. */
const NAV: Record<DashboardView, NavItem[]> = {
  creator: [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      group: "Workspace",
    },
    {
      to: "/dashboard/campaigns",
      label: "Campaigns",
      icon: Megaphone,
      group: "Workspace",
    },
    {
      to: "/dashboard/clips",
      label: "Clips",
      icon: Clapperboard,
      group: "Workspace",
    },
    {
      to: "/dashboard/accounts",
      label: "Accounts",
      icon: UserRound,
      group: "Workspace",
    },
    {
      to: "/dashboard/payments",
      label: "Payments",
      icon: Wallet,
      group: "Manage",
    },
    {
      to: "/dashboard/messages",
      label: "Messages",
      icon: MessageSquare,
      group: "Manage",
    },
  ],
  admin: [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      group: "Workspace",
    },
    {
      to: "/dashboard/creators",
      label: "Creators",
      icon: UserRound,
      group: "Workspace",
    },
    {
      to: "/dashboard/campaigns",
      label: "Campaigns",
      icon: Megaphone,
      group: "Workspace",
    },
    {
      to: "/dashboard/moderation",
      label: "Moderation",
      icon: ShieldCheck,
      group: "Workspace",
    },
    {
      to: "/dashboard/users",
      label: "Users",
      icon: Users,
      group: "Manage",
    },
    {
      to: "/dashboard/payouts",
      label: "Payouts",
      icon: Wallet,
      group: "Manage",
    },
    {
      to: "/dashboard/invoices",
      label: "Invoices",
      icon: ReceiptText,
      group: "Manage",
    },
    {
      to: "/dashboard/messages",
      label: "Messages",
      icon: MessageSquare,
      group: "Manage",
    },
  ],
};

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: DashboardView;
  /** Mobile drawer visibility (desktop rail is always rendered). */
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Desktop rail — fixed column */}
      <aside className="glass-rail fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-white/[0.07] lg:flex">
        <SidebarBody layoutKey="nav-desktop" role={role} />
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
              className="glass-rail fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 lg:hidden"
              initial={{ x: -300, opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={SPRING}
            >
              <SidebarBody
                layoutKey="nav-mobile"
                role={role}
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
  onNavigate,
}: {
  role: DashboardView;
  /** Unique layoutId per instance so the active pill animates per rail. */
  layoutKey: string;
  onNavigate?: () => void;
}) {
  const items = NAV[role];
  const { user, signOut } = useAuth();
  const { profile } = useClipVault();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const location = useLocation();

  const name =
    profile?.name ?? user?.name ?? user?.email?.split("@")[0] ?? "Creator";
  const email = profile?.email ?? user?.email ?? "";
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /* Active entry follows the route. */
  const go = (to: string) => {
    navigate(to);
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

  /* Opens the visitor's mail client with the report details prefilled. Every
     message lands in the one support inbox; the subject is what tells them
     apart once it arrives. */
  const openFeedback = (subject: string) => {
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[Clip Vault] ${subject} — ${email || "signed-in user"}`,
    )}`;
    window.location.href = href;
  };

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Brand + notifications */}
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2.5">
          <ClipVaultMark className="h-9 w-9" />
          <span className="leading-none">
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Beta
            </span>
            <span className="block text-[15px] font-extrabold tracking-tight">
              Clip Vault
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
          className="glass-chip inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-[#C9AEFF] lg:h-9 lg:w-9"
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
          className="glass-chip w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[#A855F7]/50 focus:ring-2 focus:ring-[#A855F7]/20"
        />
      </label>

      {/* Section navigation */}
      <nav
        data-lenis-prevent
        className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1 pb-2"
      >
        {filtered.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          const showGroup =
            index === 0 || filtered[index - 1]?.group !== item.group;
          return (
            <div key={item.to} className={showGroup ? "pt-4 first:pt-0" : ""}>
            {showGroup && (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                {item.group}
              </p>
            )}
            <motion.button
              type="button"
              onClick={() => go(item.to)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, x: -16, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{
                delay: 0.04 + index * 0.045,
                duration: 0.6,
                ease: EASE,
              }}
              className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13.5px] font-semibold transition-colors lg:py-2.5"
            >
              {isActive && (
                <motion.span
                  layoutId={`${layoutKey}-active`}
                  className="absolute inset-0 rounded-xl border border-[#A855F7]/35 bg-gradient-to-r from-[#7C3AED]/25 to-[#A855F7]/10 shadow-[0_10px_30px_-12px_rgb(168_85_247/0.75)]"
                  transition={SPRING_PILL}
                />
              )}
              <Icon
                className={`relative h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110 ${
                  isActive ? "text-[#C9AEFF]" : "text-[#A855F7]/60"
                }`}
              />
              <span
                className={`relative transition-colors ${
                  isActive
                    ? "text-[#E4D6FF]"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {item.label}
              </span>
            </motion.button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            No sections match “{query}”.
          </p>
        )}
      </nav>

      {/* Community + feedback */}
      <div className="space-y-1 border-t border-white/[0.07] pt-3">
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Community
        </p>
        <button
          type="button"
          onClick={() => openFeedback("Bug report")}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground lg:py-2"
        >
          <Bug className="h-4 w-4 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
          Report Bug
        </button>
        <button
          type="button"
          onClick={() => openFeedback("Feature request")}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground lg:py-2"
        >
          <Lightbulb className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          Request Feature
        </button>
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noreferrer"
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground lg:py-2"
        >
          <MessageSquare className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          Join the Discord
        </a>
      </div>

      {/* Account card */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="glass-panel flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition-colors hover:border-white/20"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/20"
              />
            ) : (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B3FE2] to-[#5B0FA6] text-xs font-bold text-white">
              {initials}
            </span>
            )}
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
