import { CampaignCard } from "@/components/CampaignCard";
import {
  MarketingCTA,
  MarketingShell,
  PageHero,
  fadeUp,
} from "@/components/marketing/MarketingShell";
import { useAuth } from "@/hooks/use-auth";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import { Megaphone, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export default function CampaignsPage() {
  const { campaigns, toggleJoinCampaign } = useClipVault();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const live = campaigns.filter((c) => c.status === "active");
  const paused = campaigns.filter((c) => c.status !== "active");

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
    <MarketingShell>
      <PageHero
        eyebrow="Live campaigns"
        title="Every campaign paying right now."
        lead="Each one shows its rate per 1,000 verified views, the platforms it accepts and the rules before you join. No application, no fee, no catch."
        icon={Megaphone}
      />

      <section className="mx-auto max-w-5xl px-5 py-20">
        {live.length === 0 ? (
          <motion.div
            {...fadeUp}
            className="rounded-3xl border border-black/8 bg-black/[0.02] p-12 text-center dark:border-white/10 dark:bg-white/[0.03]"
          >
            <Search className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-4 text-lg font-extrabold tracking-tight">
              No campaigns are open yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Brands are onboarding now. Join the Discord and you will hear
              about the first launch before it goes wide.
            </p>
          </motion.div>
        ) : (
          <motion.div
            {...fadeUp}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {live.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onJoin={() => handleJoin(campaign.id, campaign.brand)}
              />
            ))}
          </motion.div>
        )}

        {paused.length > 0 && (
          <motion.div {...fadeUp} className="mt-14">
            <h2 className="text-lg font-extrabold tracking-[-0.03em]">
              Paused campaigns
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              These have stopped accepting clips. Their clips still count toward
              any cycle they were part of.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paused.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </motion.div>
        )}
      </section>

      <MarketingCTA
        title="Join one and post your first clip."
        body="Connecting an account takes about two minutes, and the first payout is one cycle away."
      />
    </MarketingShell>
  );
}
