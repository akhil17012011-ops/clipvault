import { AdminView } from "@/components/dashboard/AdminView";
import { ConnectAccountModal } from "@/components/dashboard/ConnectAccountModal";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { CreatorView } from "@/components/dashboard/CreatorView";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SubmitClipModal } from "@/components/dashboard/SubmitClipModal";
import { TopBar, type DashboardView } from "@/components/dashboard/TopBar";
import { DashboardTour } from "@/components/dashboard/DashboardTour";
import type { AdminSection } from "@/components/dashboard/AdminView";
import type { CreatorSection } from "@/components/dashboard/CreatorView";
import { useAuth } from "@/hooks/use-auth";
import { useClipVault } from "@/lib/clip-vault-store";
import { SECTION_TRANSITION } from "@/lib/motion";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { Platform } from "@/lib/clip-vault-data";

const CREATOR_SECTIONS: CreatorSection[] = [
  "overview",
  "campaigns",
  "clips",
  "payments",
  "accounts",
  "request",
];
const ADMIN_SECTIONS: AdminSection[] = [
  "overview",
  "creators",
  "users",
  "messages",
  "requests",
  "payouts",
  "invoices",
  "campaigns",
  "moderation",
];

type ModalKind = "connect" | "submit" | "create" | null;

export default function Dashboard() {
  const { accounts } = useClipVault();
  /* The role is read from the server's user record, not from the email. */
  const { role } = useAuth();
  const view: DashboardView = role;
  const [modal, setModal] = useState<ModalKind>(null);
  /** Which platform the connect wizard opens on, so "add another" is unambiguous. */
  const [connectPlatform, setConnectPlatform] = useState<Platform>("tiktok");
  /* The first-run tour. It opens itself for an account that has never seen it,
     and the sidebar can bring it back on demand. */
  const [tourOpen, setTourOpen] = useState(false);
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
    /* Nothing to reset — the dashboard reads straight from the database. */
  };

  return (
    <main className="relative min-h-screen bg-background">
      {/* Console backdrop: gradient blooms + a masked grid, no filter blur. */}
      <div className="console-field pointer-events-none absolute inset-0" />
      <div className="grid-page pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#A855F7]/45 to-transparent" />

      <Sidebar
        role={view}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onStartTour={() => setTourOpen(true)}
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
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={SECTION_TRANSITION}
            >
              {view === "creator" ? (
                <CreatorView
                  section={section as CreatorSection}
                  onConnect={(platform) => {
                    if (platform) setConnectPlatform(platform);
                    setModal("connect");
                  }}
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

        <footer className="relative border-t border-white/[0.06] py-6 text-center text-xs text-muted-foreground">
          Clip Vault console · campaigns, clips and payouts are read live from
          your account.
        </footer>
      </div>

      <DashboardTour open={tourOpen} onOpenChange={setTourOpen} />

      {modal === "connect" && (
        <ConnectAccountModal
          key={connectPlatform}
          open
          initialPlatform={connectPlatform}
          onOpenChange={handleConnectOpenChange}
        />
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
