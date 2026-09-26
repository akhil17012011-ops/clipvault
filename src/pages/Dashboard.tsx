import { AdminView } from "@/components/dashboard/AdminView";
import { ConnectAccountModal } from "@/components/dashboard/ConnectAccountModal";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { CreatorView } from "@/components/dashboard/CreatorView";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SubmitClipModal } from "@/components/dashboard/SubmitClipModal";
import { TopBar, type DashboardView } from "@/components/dashboard/TopBar";
import type { AdminSection } from "@/components/dashboard/AdminView";
import type { CreatorSection } from "@/components/dashboard/CreatorView";
import { useAuth } from "@/hooks/use-auth";
import { roleForEmail } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

const CREATOR_SECTIONS: CreatorSection[] = [
  "overview",
  "campaigns",
  "clips",
  "payments",
  "accounts",
];
const ADMIN_SECTIONS: AdminSection[] = [
  "overview",
  "payouts",
  "invoices",
  "campaigns",
  "moderation",
];

type ModalKind = "connect" | "submit" | "create" | null;

export default function Dashboard() {
  const { accounts, profile, resetDemo } = useCliptic();
  const { user } = useAuth();
  /* The email you signed in with decides the dashboard — no manual switch. */
  const view: DashboardView = roleForEmail(profile?.email ?? user?.email);
  const [modal, setModal] = useState<ModalKind>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const onboardedOnce = useRef(accounts.length > 0);
  const navigate = useNavigate();
  const params = useParams();

  /* One page per sidebar section: /dashboard/:section, validated per role. */
  const requested = params.section ?? "overview";
  const allowed: string[] =
    view === "admin" ? ADMIN_SECTIONS : CREATOR_SECTIONS;
  const section = allowed.includes(requested) ? requested : "overview";

  useEffect(() => {
    if (section !== requested) {
      navigate("/dashboard", { replace: true });
    }
  }, [section, requested, navigate]);

  /* First run: walk creators straight into bio verification. */
  useEffect(() => {
    if (view !== "creator") return;
    if (onboardedOnce.current) return;
    if (accounts.length > 0) {
      onboardedOnce.current = true;
      return;
    }
    if (onboardingSkipped) return;
    const timer = window.setTimeout(
      () => setModal((current) => current ?? "connect"),
      750,
    );
    return () => window.clearTimeout(timer);
  }, [view, accounts.length, onboardingSkipped]);

  const handleConnectOpenChange = (open: boolean) => {
    if (open) {
      setModal("connect");
      return;
    }
    setModal((current) => (current === "connect" ? null : current));
    if (accounts.length === 0) setOnboardingSkipped(true);
  };

  const handleReset = () => {
    resetDemo();
    setOnboardingSkipped(false);
    onboardedOnce.current = false;
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[#7C3AED]/25 via-[#5B21B6]/10 to-transparent" />
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-[520px] rounded-full bg-[#6D28D9]/25 blur-[130px]" />

      <Sidebar
        role={view}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onReset={handleReset}
      />

      <div className="relative lg:pl-[264px]">
        <TopBar
          role={view}
          onReset={handleReset}
          onMenu={() => setMenuOpen(true)}
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === "creator" ? (
                <CreatorView
                  section={section as CreatorSection}
                  onConnect={() => setModal("connect")}
                  onSubmitClip={() => setModal("submit")}
                />
              ) : (
                <AdminView
                  section={section as AdminSection}
                  onCreateCampaign={() => setModal("create")}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="relative border-t border-black/8 dark:border-white/10 py-6 text-center text-xs text-muted-foreground">
          CLIPTIC demo console · views, earnings and payouts update live from
          simulated data.
        </footer>
      </div>

      {modal === "connect" && (
        <ConnectAccountModal open onOpenChange={handleConnectOpenChange} />
      )}
      {modal === "submit" && (
        <SubmitClipModal
          open
          onOpenChange={(next) => {
            if (!next) setModal(null);
          }}
        />
      )}
      {modal === "create" && (
        <CreateCampaignModal
          open
          onOpenChange={(next) => {
            if (!next) setModal(null);
          }}
        />
      )}
    </main>
  );
}
