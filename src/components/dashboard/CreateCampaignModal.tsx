import { PlatformChip } from "@/components/ClipVaultUI";
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
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/clip-vault-data";
import { useClipVault } from "@/lib/clip-vault-store";
import { toast } from "sonner";
import { useState } from "react";
import { HardDriveDownload, Link2, Plus, Trash2, DollarSign, Rocket } from "lucide-react";

/** Admin form for launching or editing a brand campaign. */
export function CreateCampaignModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createCampaign } = useClipVault();
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [logo, setLogo] = useState("");
  const [brief, setBrief] = useState("");
  const [rate, setRate] = useState("1.50");
  const [minViews, setMinViews] = useState("50000");
  const [budget, setBudget] = useState("25000");
  const [daysLeft, setDaysLeft] = useState("30");
  const [platforms, setPlatforms] = useState<Platform[]>(["tiktok"]);
  const [guidelines, setGuidelines] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<
    { label: string; url: string }[]
  >([]);
  const [sourceFiles, setSourceFiles] = useState<
    { label: string; url: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const addRow = (
    setter: React.Dispatch<
      React.SetStateAction<{ label: string; url: string }[]>
    >,
  ) => setter((prev) => [...prev, { label: "", url: "" }]);

  const updateRow = (
    setter: React.Dispatch<
      React.SetStateAction<{ label: string; url: string }[]>
    >,
    index: number,
    patch: Partial<{ label: string; url: string }>,
  ) =>
    setter((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const removeRow = (
    setter: React.Dispatch<
      React.SetStateAction<{ label: string; url: string }[]>
    >,
    index: number,
  ) => setter((prev) => prev.filter((_, i) => i !== index));

  /* Only rows with a URL are kept — an empty draft row isn't an asset. */
  const cleanRows = (rows: { label: string; url: string }[], kind: "drive" | "link") =>
    rows
      .filter((row) => row.url.trim().length > 0)
      .map((row) => ({
        label: row.label.trim() || (kind === "drive" ? "Source file" : "Reference"),
        url: row.url.trim(),
        kind,
      }));

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
      logo: logo.trim() || undefined,
      brief: brief.trim() || undefined,
      referenceLinks: cleanRows(referenceLinks, "link"),
      sourceFiles: cleanRows(sourceFiles, "drive"),
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
      description: `${brand.trim()} is now visible to every clipper on Clip Vault.`,
    });
    onOpenChange(false);
  };

  const fieldClass =
    "mt-2 h-11 bg-background/60 [&>option]:bg-white";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto p-0 sm:max-w-2xl [&>button]:z-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-[#8B3FE2]/20 blur-[80px]" />

          <div className="relative p-6 sm:p-7">
            <DialogHeader className="text-left">
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
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

              {/* brand mark */}
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Brand logo
                </span>
                <Input
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="🎧 or paste an image URL"
                  className={fieldClass}
                />
              </label>
              <div className="hidden sm:block" />

              <label className="block sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Campaign brief
                </span>
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="What should the clip show? Tone, angles, anything clippers should know before they cut."
                  rows={3}
                  className={`${fieldClass} h-auto py-2.5`}
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
                      : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-muted-foreground hover:border-black/15 dark:hover:border-white/25"
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

            {/* reference links */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Reference links
                </span>
                <button
                  type="button"
                  onClick={() => addRow(setReferenceLinks)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-brand transition-opacity hover:opacity-70"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add link
                </button>
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Product pages, brand channels, moodboards.
              </p>
              <div className="mt-2.5 space-y-2">
                {referenceLinks.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        updateRow(setReferenceLinks, index, { label: e.target.value })
                      }
                      placeholder="Product page"
                      className="h-10 w-[38%]"
                    />
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={row.url}
                        onChange={(e) =>
                          updateRow(setReferenceLinks, index, { url: e.target.value })
                        }
                        placeholder="https://…"
                        className="h-10 pl-8 font-mono text-[12.5px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(setReferenceLinks, index)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-600 dark:hover:text-red-300"
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* source footage clippers can cut from */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Source footage &amp; Drive files
                </span>
                <button
                  type="button"
                  onClick={() => addRow(setSourceFiles)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-brand transition-opacity hover:opacity-70"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add file
                </button>
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Footage clippers download and cut from — paste any Drive or
                file link.
              </p>
              <div className="mt-2.5 space-y-2">
                {sourceFiles.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        updateRow(setSourceFiles, index, { label: e.target.value })
                      }
                      placeholder="Hero footage (4K)"
                      className="h-10 w-[38%]"
                    />
                    <div className="relative flex-1">
                      <HardDriveDownload className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={row.url}
                        onChange={(e) =>
                          updateRow(setSourceFiles, index, { url: e.target.value })
                        }
                        placeholder="https://drive.google.com/…"
                        className="h-10 pl-8 font-mono text-[12.5px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(setSourceFiles, index)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-600 dark:hover:text-red-300"
                      aria-label="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>}

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
