import { PlatformChip } from "@/components/ClipticUI";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { toast } from "sonner";
import { useState } from "react";
import { DollarSign, Rocket } from "lucide-react";

/** Admin form for launching a new brand campaign. */
export function CreateCampaignModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createCampaign } = useCliptic();
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [rate, setRate] = useState("1.50");
  const [minViews, setMinViews] = useState("50000");
  const [budget, setBudget] = useState("25000");
  const [daysLeft, setDaysLeft] = useState("30");
  const [platforms, setPlatforms] = useState<Platform[]>(["tiktok"]);
  const [guidelines, setGuidelines] = useState("");
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  const submit = () => {
    const rateValue = Number(rate);
    const min = Number(minViews);
    const budgetValue = Number(budget);
    const days = Number(daysLeft);

    if (!brand.trim() || !title.trim()) {
      setError("Brand name and campaign title are required.");
      return;
    }
    if (!Number.isFinite(rateValue) || rateValue <= 0) {
      setError("Reward rate must be greater than zero.");
      return;
    }
    if (platforms.length === 0) {
      setError("Select at least one allowed platform.");
      return;
    }
    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      setError("Set a campaign budget greater than zero.");
      return;
    }

    createCampaign({
      brand: brand.trim(),
      title: title.trim(),
      ratePer1k: rateValue,
      minViews: Number.isFinite(min) && min > 0 ? min : 10_000,
      budget: budgetValue,
      daysLeft: Number.isFinite(days) && days > 0 ? days : 30,
      platforms,
      guidelines: guidelines
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
    toast.success("Campaign live", {
      description: `${brand.trim()} is now visible to every clipper on CLIPTIC.`,
    });
    onOpenChange(false);
  };

  const fieldClass =
    "mt-2 h-11 bg-background/60 [&>option]:bg-[#141319]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto p-0 sm:max-w-2xl [&>button]:z-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-[#5B37E8]/35 blur-[80px]" />

          <div className="relative p-6 sm:p-7">
            <DialogHeader className="text-left">
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-[#c4b5fd]">
                <Rocket className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-extrabold tracking-tight">
                Create campaign
              </DialogTitle>
              <DialogDescription>
                Set the reward rate, platforms and rules. Clippers see all of it
                before they join.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Brand name
                </span>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ripple Audio"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Campaign title
                </span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Fall Product Drop"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Reward per 1K views ($)
                </span>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    step="0.05"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className={`${fieldClass} pl-9`}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Min views to qualify
                </span>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={minViews}
                  onChange={(e) => setMinViews(e.target.value)}
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Budget ($)
                </span>
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Days live
                </span>
                <Input
                  type="number"
                  min="1"
                  value={daysLeft}
                  onChange={(e) => setDaysLeft(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Allowed platforms
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    platforms.includes(p)
                      ? "border-brand/50 bg-brand/12 text-foreground"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <PlatformChip platform={p} size="sm" />
                  {PLATFORM_META[p].label}
                </button>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Guidelines (one rule per line)
              </span>
              <Textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                placeholder={
                  "Show the product within the first 2 seconds\nUse #FallDrop in the caption\nNo competitor branding in shot"
                }
                rows={4}
                className="mt-2 resize-none bg-background/60 leading-relaxed"
              />
            </label>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-7 flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1 gap-1.5 glow-primary" onClick={submit}>
                <Rocket className="h-4 w-4" />
                Launch campaign
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
