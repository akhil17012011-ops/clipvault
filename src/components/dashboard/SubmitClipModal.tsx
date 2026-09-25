import { BrandAvatar, PlatformChip } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PLATFORMS, PLATFORM_META, fmtRate, type Platform } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { toast } from "sonner";
import { useState } from "react";
import { ExternalLink, Link2, Megaphone, Upload } from "lucide-react";

/** Paste-a-link modal used by creators to submit a clip to a joined campaign. */
export function SubmitClipModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { campaigns, submitClip } = useCliptic();
  const joined = campaigns.filter(
    (c) => c.joined && c.status === "active",
  );
  /* The modal mounts fresh each time it opens, so initial state seeds it. */
  const [campaignId, setCampaignId] = useState(joined[0]?.id ?? "");
  const [platform, setPlatform] = useState<Platform>(
    joined[0]?.platforms[0] ?? "tiktok",
  );
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = campaigns.find((c) => c.id === campaignId);

  const submit = () => {
    const trimmed = link.trim();
    if (!selected) {
      setError("Choose the campaign this clip belongs to.");
      return;
    }
    if (!trimmed || !trimmed.includes(".")) {
      setError("Paste a valid link to your published clip.");
      return;
    }
    if (!PLATFORM_META[platform]) {
      setError("Choose the platform you posted to.");
      return;
    }
    submitClip({ campaignId: selected.id, platform, link: trimmed });
    toast.success("Clip submitted", {
      description: "Views sync automatically once the clip clears review.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto p-0 sm:max-w-xl [&>button]:z-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[#5B37E8]/35 blur-[80px]" />

          {joined.length === 0 ? (
            <div className="relative p-7 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Megaphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight">
                Join a campaign first
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Pick a live campaign from your feed — then come back and paste
                the link to your clip.
              </p>
              <Button
                className="mt-6 glow-primary"
                onClick={() => onOpenChange(false)}
              >
                Browse campaigns
              </Button>
            </div>
          ) : (
            <div className="relative p-6 sm:p-7">
              <DialogHeader className="text-left">
                <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-[#c4b5fd]">
                  <Upload className="h-5 w-5" />
                </div>
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  Submit a clip
                </DialogTitle>
                <DialogDescription>
                  Paste the link to your published clip. Views are pulled
                  straight from the source platform.
                </DialogDescription>
              </DialogHeader>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Campaign
              </p>
              <div className="mt-2.5 space-y-2.5">
                {joined.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => {
                      setCampaignId(campaign.id);
                      setPlatform(campaign.platforms[0]);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                      campaignId === campaign.id
                        ? "border-brand/50 bg-brand/12"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <BrandAvatar name={campaign.brand} className="h-9 w-9 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {campaign.title}
                      </span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        {campaign.brand} · {fmtRate(campaign.ratePer1k)} per 1K
                      </span>
                    </span>
                    {campaignId === campaign.id && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-neon" />
                    )}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Posted to
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {PLATFORMS.filter((p) =>
                  selected ? selected.platforms.includes(p) : true,
                ).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      platform === p
                        ? "border-brand/50 bg-brand/12 text-foreground"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <PlatformChip platform={p} size="sm" />
                    {PLATFORM_META[p].label}
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Clip link
              </label>
              <div className="relative mt-2.5">
                <Link2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="https://tiktok.com/@you/video/…"
                  className="h-11 pl-9 font-mono text-[13px]"
                  autoFocus
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

              <div className="mt-7 flex gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 gap-1.5 glow-primary" onClick={submit}>
                  <ExternalLink className="h-4 w-4" />
                  Submit clip
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
