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
import {
  PLATFORMS,
  PLATFORM_META,
  extractTags,
  fmtRate,
  platformFromLink,
  requiredTags,
  type Platform,
} from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Hash,
  Link2,
  Loader2,
  Megaphone,
  ScanSearch,
  Upload,
  X,
} from "lucide-react";

/**
 * Submit a clip with real validation:
 *  - the platform is detected from the pasted link (not trusted from input)
 *  - the detected platform must be one the campaign accepts
 *  - hashtags in the caption are checked against the campaign's guidelines
 * then a scan animation reports each check with green/red results.
 */

type Phase = "form" | "scanning" | "passed" | "failed";

interface ScanCheck {
  label: string;
  detail: string;
  ok: boolean;
}

interface ScanPlan {
  checks: ScanCheck[];
  allOk: boolean;
  payload: {
    campaignId: string;
    platform: Platform;
    link: string;
    tags: string[];
  };
}

export function SubmitClipModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { campaigns, submitClip } = useCliptic();
  const joined = campaigns.filter((c) => c.joined && c.status === "active");

  const [campaignId, setCampaignId] = useState(joined[0]?.id ?? "");
  const [link, setLink] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [scan, setScan] = useState<ScanPlan | null>(null);
  const [revealed, setRevealed] = useState(0);

  const selected = campaigns.find((c) => c.id === campaignId);
  const detected = platformFromLink(link.trim());
  const captionTags = extractTags(caption);
  const required = selected ? requiredTags(selected) : [];
  const missingTags = required.filter((tag) => !captionTags.includes(tag));

  /* ---- validation → build the scan plan ---- */
  const buildScan = (): ScanPlan | null => {
    const trimmed = link.trim();
    if (!selected) {
      setError("Choose the campaign this clip belongs to.");
      return null;
    }
    if (!trimmed || !trimmed.includes(".")) {
      setError("Paste a valid link to your published clip.");
      return null;
    }
    const detectedPlatform = platformFromLink(trimmed);
    if (!detectedPlatform) {
      setError(
        "We couldn't recognize the platform from this link — use a TikTok, Instagram or YouTube URL.",
      );
      return null;
    }
    const allowed = selected.platforms.includes(detectedPlatform);
    const tagsOk = missingTags.length === 0;

    setError(null);
    let host = trimmed;
    try {
      host = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
        .hostname.replace(/^www\./, "");
    } catch {
      /* keep raw string — it already passed validation */
    }
    const checks: ScanCheck[] = [
      {
        label: "Clip link recognized",
        detail: host,
        ok: true,
      },
      {
        label: "Platform supported by campaign",
        detail: allowed
          ? `${PLATFORM_META[detectedPlatform].label} · ${selected.title}`
          : `${PLATFORM_META[detectedPlatform].label} not accepted — allows ${allowedLabels}`,
        ok: allowed,
      },
      {
        label: "Guidelines & hashtags",
        detail: tagsOk
          ? required.length > 0
            ? `${required.length} required tag${required.length > 1 ? "s" : ""} found`
            : "no required tags"
          : `missing ${missingTags.join(" ")}`,
        ok: tagsOk,
      },
      {
        label: "View tracking activated",
        detail:
          allowed && tagsOk
            ? "views sync from the source platform"
            : "blocked until the checks above pass",
        ok: allowed && tagsOk,
      },
    ];
    return {
      checks,
      allOk: allowed && tagsOk,
      payload: {
        campaignId: selected.id,
        platform: detectedPlatform,
        link: trimmed,
        tags: captionTags,
      },
    };
  };

  const startScan = () => {
    const plan = buildScan();
    if (!plan) return;
    setScan(plan);
    setRevealed(0);
    setPhase("scanning");
  };

  /* ---- scan animation: reveal one check at a time, then verdict ---- */
  useEffect(() => {
    if (phase !== "scanning" || !scan) return;
    if (revealed < scan.checks.length) {
      const timer = window.setTimeout(
        () => setRevealed((r) => r + 1),
        revealed === 0 ? 350 : 700,
      );
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      if (scan.allOk) {
        submitClip(scan.payload);
        toast.success("Clip submitted", {
          description:
            "All checks passed — views will sync once the clip clears review.",
        });
        setPhase("passed");
      } else {
        toast.error("Scan failed", {
          description:
            "The clip doesn't match this campaign's platform or hashtag rules.",
        });
        setPhase("failed");
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [phase, revealed, scan, submitClip]);

  useEffect(() => {
    if (phase !== "passed") return;
    const timer = window.setTimeout(() => onOpenChange(false), 1_400);
    return () => window.clearTimeout(timer);
  }, [phase, onOpenChange]);

  const close = (next: boolean) => {
    if (phase === "scanning") return; // don't dismiss mid-scan
    onOpenChange(next);
  };

  const allowedLabels = (selected?.platforms ?? [])
    .map((p) => PLATFORM_META[p].label)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto p-0 sm:max-w-xl [&>button]:z-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[#5B37E8]/20 blur-[80px]" />

          {/* ---------------- form ---------------- */}
          {phase === "form" &&
            (joined.length === 0 ? (
              <div className="relative p-7 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.05]">
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
                  <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                    <Upload className="h-5 w-5" />
                  </div>
                  <DialogTitle className="text-xl font-extrabold tracking-tight">
                    Submit a clip
                  </DialogTitle>
                  <DialogDescription>
                    Paste your clip link — we detect the platform, check it
                    against the campaign rules and scan your hashtags before it
                    goes live.
                  </DialogDescription>
                </DialogHeader>

                {/* campaign picker */}
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
                        setError(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                        campaignId === campaign.id
                          ? "border-brand/50 bg-brand/10"
                          : "border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] hover:border-black/15 dark:hover:border-white/25"
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

                {/* allowed platforms — unsupported ones are visibly disabled */}
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Platforms this campaign accepts
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const isAllowed = selected?.platforms.includes(p) ?? false;
                    return (
                      <span
                        key={p}
                        className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-opacity ${
                          isAllowed
                            ? "border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] text-foreground"
                            : "border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-muted-foreground/60 line-through opacity-60"
                        }`}
                        title={
                          isAllowed
                            ? `${PLATFORM_META[p].label} clips are accepted`
                            : `${PLATFORM_META[p].label} clips are not accepted`
                        }
                      >
                        <PlatformChip platform={p} size="sm" />
                        {PLATFORM_META[p].label}
                        {isAllowed ? (
                          <Check className="h-3.5 w-3.5 text-neon" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* link + live detection */}
                <label className="mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Clip link
                </label>
                <div className="relative mt-2.5">
                  <Link2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") startScan();
                    }}
                    placeholder="https://tiktok.com/@you/video/…"
                    className="h-11 pl-9 font-mono text-[13px]"
                    autoFocus
                  />
                </div>
                {link.trim().length > 3 && (
                  <p
                    className={`mt-2 flex items-center gap-1.5 text-[12px] font-semibold ${
                      detected
                        ? "text-neon"
                        : "text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {detected ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {PLATFORM_META[detected].label} link detected
                        {selected && !selected.platforms.includes(detected)
                          ? " — not accepted by this campaign"
                          : ""}
                      </>
                    ) : (
                      <>
                        <ScanSearch className="h-3.5 w-3.5" />
                        Paste a TikTok, Instagram or YouTube link
                      </>
                    )}
                  </p>
                )}

                {/* caption hashtags vs campaign requirements */}
                <label className="mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Caption hashtags
                </label>
                <div className="relative mt-2.5">
                  <Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value);
                      setError(null);
                    }}
                    placeholder={
                      required.length > 0
                        ? required.join(" ")
                        : "#yourhashtag #fromcaption"
                    }
                    className="h-11 pl-9 font-mono text-[13px]"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {required.length > 0 ? (
                    required.map((tag) => {
                      const found = captionTags.includes(tag);
                      return (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                            found
                              ? "border-neon/25 bg-neon/10 text-neon"
                              : "border-amber-400/25 bg-amber-400/10 text-amber-600 dark:text-amber-300"
                          }`}
                        >
                          {found ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {tag}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[11.5px] text-muted-foreground">
                      No required tags for this campaign.
                    </span>
                  )}
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
                  <Button className="flex-1 gap-1.5 glow-primary" onClick={startScan}>
                    <ScanSearch className="h-4 w-4" />
                    Scan & submit
                  </Button>
                </div>
              </div>
            ))}

          {/* ---------------- scanning ---------------- */}
          {phase === "scanning" && scan && (
            <div className="relative px-6 py-8 sm:px-7">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
                <ScanSearch className="h-6 w-6 animate-pulse text-brand" />
              </div>
              <h3 className="mt-5 text-center text-lg font-extrabold tracking-tight">
                Scanning your clip…
              </h3>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Checking the link, platform, hashtags and campaign rules
              </p>

              <ul className="mx-auto mt-6 max-w-sm space-y-2.5">
                {scan.checks.map((check, i) => {
                  const done = i < revealed;
                  return (
                    <li
                      key={check.label}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-300 ${
                        done
                          ? "border-black/8 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] opacity-100"
                          : "border-black/8 dark:border-white/10 opacity-40"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          !done
                            ? "bg-black/[0.05] dark:bg-white/[0.08]"
                            : check.ok
                              ? "bg-neon/15 text-neon"
                              : "bg-red-500/10 text-red-500 dark:text-red-400"
                        }`}
                      >
                        {!done ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : check.ok ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold">
                          {check.label}
                        </span>
                        {done && (
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {check.detail}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ---------------- passed ---------------- */}
          {phase === "passed" && (
            <div className="relative px-6 py-14 text-center sm:px-7">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-neon/30 bg-neon/10">
                <Check className="h-8 w-8 text-neon" />
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight">
                All checks passed
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Your clip is in review — views start syncing as soon as it goes
                live.
              </p>
            </div>
          )}

          {/* ---------------- failed ---------------- */}
          {phase === "failed" && scan && (
            <div className="relative px-6 py-10 text-center sm:px-7">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10">
                <X className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight">
                Scan failed
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                One or more checks didn&apos;t pass. Fix the highlighted items
                and run the scan again.
              </p>
              <Button
                className="mt-6 gap-1.5 glow-primary"
                onClick={() => {
                  setPhase("form");
                  setRevealed(0);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to form
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
