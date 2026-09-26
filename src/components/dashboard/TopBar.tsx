import { ClipticLogo } from "@/components/ClipticMark";
import { ThemeToggle } from "@/components/ThemeToggle";
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
import { motion } from "framer-motion";
import { Home, LogOut, RotateCcw, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export type DashboardView = "creator" | "admin";

const MODES: { id: DashboardView; label: string }[] = [
  { id: "creator", label: "Creator" },
  { id: "admin", label: "Admin" },
];

export function TopBar({
  view,
  onViewChange,
  onReset,
}: {
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  onReset: () => void;
}) {
  const { user, signOut } = useAuth();
  const { profile } = useCliptic();
  const navigate = useNavigate();

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
      console.error("Sign out error:", error);
    }
  };

  const handleReset = () => {
    onReset();
    toast.success("Demo data reset", {
      description: "Campaigns, clips and accounts are back to their defaults.",
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-black/8 dark:border-white/10 bg-white/75 dark:bg-[#0C0A14]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <ClipticLogo markClassName="h-8 w-8" textClassName="text-base" />
          <span className="hidden rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand sm:inline-block">
            Beta
          </span>
        </Link>

        <div className="relative flex rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] p-1">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onViewChange(mode.id)}
              aria-pressed={view === mode.id}
              className="relative rounded-full px-4 py-1.5 text-xs font-bold tracking-wide sm:px-5"
            >
              {view === mode.id && (
                <motion.span
                  layoutId="cliptic-mode-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-gradient-to-b from-[#7C5CFF] to-[#5B37E8] shadow-[0_6px_18px_-8px_rgb(109_74_255/0.9)]"
                />
              )}
              <span
                className={`relative z-10 ${
                  view === mode.id
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden items-center gap-2 rounded-full border border-neon/20 bg-neon/10 px-3 py-1.5 text-xs font-semibold text-neon md:inline-flex">
            <Wallet className="h-3.5 w-3.5" />
            Payouts every Friday
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] py-1 pl-1 pr-2.5 transition-colors hover:border-black/15 dark:hover:border-white/25"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
                  {initials}
                </span>
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
      </div>
    </header>
  );
}
