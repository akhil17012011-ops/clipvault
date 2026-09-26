import { AdminView } from "@/components/dashboard/AdminView";
import { ConnectAccountModal } from "@/components/dashboard/ConnectAccountModal";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { CreatorView } from "@/components/dashboard/CreatorView";
import { SubmitClipModal } from "@/components/dashboard/SubmitClipModal";
import { TopBar, type DashboardView } from "@/components/dashboard/TopBar";
import { useAuth } from "@/hooks/use-auth";
import { roleForEmail } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { useEffect, useRef, useState } from "react";

type ModalKind = "connect" | "submit" | "create" | null;

export default function Dashboard() {
  const { accounts, profile, resetDemo } = useCliptic();
  const { user } = useAuth();
  /* The email you signed in with decides the dashboard — no manual switch. */
  const view: DashboardView = roleForEmail(profile?.email ?? user?.email);
  const [modal, setModal] = useState<ModalKind>(null);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const onboardedOnce = useRef(accounts.length > 0);

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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand/[0.09] to-transparent" />

      <TopBar role={view} onReset={handleReset} />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {view === "creator" ? (
          <CreatorView
            onConnect={() => setModal("connect")}
            onSubmitClip={() => setModal("submit")}
          />
        ) : (
          <AdminView onCreateCampaign={() => setModal("create")} />
        )}
      </div>

      <footer className="relative border-t border-black/8 dark:border-white/10 py-6 text-center text-xs text-muted-foreground">
        CLIPTIC demo console · views, earnings and payouts update live from
        simulated data.
      </footer>

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
