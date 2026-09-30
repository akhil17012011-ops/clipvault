import { ClipVaultLogo } from "@/components/ClipVaultMark";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { fmtCents } from "@/lib/clip-vault-data";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import { Clapperboard, Home, LogOut, Megaphone, Menu, RotateCcw, Settings2, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useState } from "react";

export type DashboardView = "creator" | "admin";

export function TopBar({
  role,
  onMenu,
}: {
  /** Derived from the email used at sign-in — no manual switch. */
  role: DashboardView;
  /** Opens the mobile sidebar drawer (lg and up show the fixed rail). */
  onMenu: () => void;
}) {
  const { user, signOut, accountRole } = useAuth();
  const { profile, wallet } = useClipVault();
  const navigate = useNavigate();
  const [editingProfile, setEditingProfile] = useState(false);

  const name =
    profile?.name ?? user?.name ?? user?.email?.split("@")[0] ?? "Creator";
  const email = profile?.email ?? user?.email ?? "";
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      /* A sign-out that fails silently leaves somebody believing they are
         logged out on a shared machine — so it says so. */
      console.error("Sign out error:", error);
      toast.error("Couldn't sign out just now — please try again.");
    }
  };

  const handleReset = () => {
    /* Nothing to reset: the console reads live from the database. */
    toast("This console shows your live data — nothing to reset.");
  };

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-white/[0.07]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={onMenu}
            className="glass-chip inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-[#C9AEFF] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4.5 w-4.5" />
          </motion.button>

          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <ClipVaultLogo markClassName="h-8 w-8" textClassName="text-base" />
            <span className="glass-chip hidden rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9AEFF] sm:inline-block">
              Beta
            </span>
          </Link>
        </div>

        <div className="glass-chip hidden items-center gap-2 rounded-full px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#C9AEFF] sm:inline-flex font-display">
          {role === "admin" ? (
            <>
              <Megaphone className="h-3.5 w-3.5" />
              Brand console
            </>
          ) : (
            <>
              <Clapperboard className="h-3.5 w-3.5" />
              Creator dashboard
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="glass-chip hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground md:inline-flex">
            <Wallet className="h-3.5 w-3.5" />
            {/* The minimum is the wallet's own number, so the developer's
                exempt floor is never contradicted by a hardcoded $5. */}
            {wallet.minWithdrawalCents <= 1
              ? "No withdrawal minimum"
              : `Withdraw from ${fmtCents(wallet.minWithdrawalCents)}`}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="glass-chip flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:border-white/20"
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] to-[#5B0FA6] text-xs font-bold text-white">
                    {initials}
                  </span>
                )}
                <span className="hidden text-xs font-semibold text-foreground sm:block">
                  {name.split(" ")[0]}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold">{name}</p>
                {email && (
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </p>
                )}
                {/* A label, not a permission: the platform's own account says
                    so here and nothing more. */}
                {accountRole === "developer" && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-brand/35 bg-brand/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-brand">
                    Developer
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/")}>
                <Home className="mr-2 h-4 w-4" />
                Landing page
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  /* Keep the menu from closing over the dialog we just opened. */
                  event.preventDefault();
                  setEditingProfile(true);
                }}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Refresh data
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
      </div>

      {/* Scroll edge: content fades out as it passes under the bar
          instead of colliding with it. */}
      <div className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-[#0C0A14]/70 to-transparent" />

      <ProfileEditor
        open={editingProfile}
        onOpenChange={setEditingProfile}
      />
    </header>
  );
}
