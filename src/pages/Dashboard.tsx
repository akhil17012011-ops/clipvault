import { AdminView } from "@/components/dashboard/AdminView";
import { ConnectAccountModal } from "@/components/dashboard/ConnectAccountModal";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { CreatorView } from "@/components/dashboard/CreatorView";
import { SubmitClipModal } from "@/components/dashboard/SubmitClipModal";
import { TopBar, type DashboardView } from "@/components/dashboard/TopBar";
import { useCliptic } from "@/lib/cliptic-store";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

type ModalKind = "connect" | "submit" | "create" | null;

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const { accounts, resetDemo } = useCliptic();
  const [view, setView] = useState<DashboardView>(
    searchParams.get("tab") === "admin" ? "admin" : "creator",
  );
  const [modal, setModal] = useState<ModalKind>(null);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const onboardedOnce = useRef(accounts.length > 0);

  /* First run: walk the creator straight into bio verification. */
  useEffect(() => {
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
  }, [accounts.length, onboardingSkipped]);

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
    setView("creator");
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand/[0.09] to-transparent" />

      <TopBar view={view} onViewChange={setView} onReset={handleReset} />

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

      <footer className="relative border-t border-white/8 py-6 text-center text-xs text-muted-foreground">
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
