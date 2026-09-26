import { BrandAvatar, PlatformChip, StatusBadge } from "@/components/ClipVaultUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PLATFORM_META,
  fmtFull,
  fmtMoney,
  fmtRate,
  fmtViews,
  requiredTags,
  validateClip,
  type Campaign,
  type ClipMetrics,
} from "@/lib/clip-vault-data";
import { api } from "@/convex/_generated/api";
import { useConvex } from "convex/react";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  HardDriveDownload,
  Link2,
  ListChecks,
  Send,
  Sparkles,
  X,
} from "lucide-react";

/**
 * The inside of a joined campaign: everything the brand shared on the left
 * (brief, rules, reference links, source footage), and a place to paste the
 * clip you published on the right — the same validation the submit modal runs.
 */
export function CampaignDetail({
  campaign,
  onBack,
}: {
  campaign: Campaign;
  onBack: () => void;
}) {
  const { accounts, submitClip } = useClipVault();
  const convex = useConvex();
  const [link, setLink] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | { views: number; likes: number }>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const connected = accounts
    .filter((a) => a.status === "connected")
    .map((a) => a.handle.toLowerCase());
  const required = requiredTags(campaign);
  const budgetPct = Math.min(
    100,
    Math.round((campaign.spent / Math.max(campaign.budget, 1)) * 100),
  );

  const handleSubmit = async () => {
    const result = validateClip({
      campaign,
      link,
      caption,
      connectedHandles: connected,
    });
    if (!result.ok || !result.platform) {
      setError(result.error);
      setSent(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      /* Read the real post, then hand it to the server for review. */
      let metrics: ClipMetrics | undefined;
      try {
        const inspected = await convex.action(api.social.inspectClip, {
          link: result.link,
          platform: result.platform,
        });
        if (inspected.metrics) metrics = inspected.metrics;
      } catch (err) {
        console.error("Could not read the post:", err);
      }

      await submitClip({
        campaignId: campaign.id,
        link: result.link,
        caption,
        author: result.author,
        metrics,
      });

      setSent({ views: metrics?.views ?? 0, likes: metrics?.likes ?? 0 });
      setLink("");
      setCaption("");
      toast.success("Clip sent to review", {
        description:
          "A Clip Vault operator checks it by hand before it goes live on the campaign.",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't submit that clip.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-5 lg:grid-cols-[1.35fr_1fr]"
    >
      {/* ----------------------------- left: the brief ----------------------------- */}
      <div className="space-y-5">
        <div className="panel-fx glass-panel rounded-2xl p-5">
          <div className="flex items-start gap-4">
            {campaign.logo ? (
              <span className="glass-chip inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl">
                {campaign.logo.startsWith("http") ? (
                  <img
                    src={campaign.logo}
                    alt={campaign.brand}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  campaign.logo
                )}
              </span>
            ) : (
              <BrandAvatar name={campaign.brand} className="h-14 w-14 text-lg" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {campaign.brand}
              </p>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight">
                {campaign.title}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {campaign.platforms.map((p) => (
                  <PlatformChip key={p} platform={p} size="sm" />
                ))}
                <span className="text-[11.5px] text-muted-foreground">
                  {campaign.daysLeft}d left
                </span>
              </div>
            </div>
          </div>

          {/* the numbers that matter to a clipper */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Pay rate"
              value={`${fmtRate(campaign.ratePer1k)}`}
              hint="per 1K views"
            />
            <Stat
              label="Min views"
              value={fmtViews(campaign.minViews)}
              hint="per clip to qualify"
            />
            <Stat
              label="Clippers"
              value={`${campaign.clippers}`}
              hint="on this campaign"
            />
            <Stat
              label="Budget left"
              value={fmtMoney(campaign.budget - campaign.spent, true)}
              hint={`${budgetPct}% committed`}
            />
          </div>
        </div>

        {campaign.brief && (
          <div className="glass-panel rounded-2xl p-5">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              The brief
            </p>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-foreground/90">
              {campaign.brief}
            </p>
          </div>
        )}

        {/* source footage — the clips people actually cut from */}
        {campaign.sourceFiles.length > 0 && (
          <div className="glass-panel rounded-2xl p-5">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <HardDriveDownload className="h-3.5 w-3.5 text-brand" />
              Source footage &amp; files
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Download, cut it your way, then post the result.
            </p>
            <ul className="mt-3 space-y-2">
              {campaign.sourceFiles.map((file) => (
                <li key={file.url}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-chip group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:border-[#A855F7]/40"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                      <Download className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {file.label}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {file.url}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100">
                      Open
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* references + rules */}
        <div className="grid gap-5 sm:grid-cols-2">
          {campaign.referenceLinks.length > 0 && (
            <div className="glass-panel rounded-2xl p-5">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 text-brand" />
                References
              </p>
              <ul className="mt-3 space-y-1.5">
                {campaign.referenceLinks.map((ref) => (
                  <li key={ref.url}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-brand underline-offset-4 hover:underline"
                    >
                      {ref.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass-panel rounded-2xl p-5">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5 text-brand" />
              Rules
            </p>
            <ul className="mt-3 space-y-2">
              {campaign.guidelines.map((rule) => (
                <li
                  key={rule}
                  className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground/85"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  {rule}
                </li>
              ))}
            </ul>
            {required.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                Required in your caption:
                {required.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono font-semibold text-brand"
                  >
                    {tag}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------- right: submit your clip ----------------------------- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel-fx glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Your clip
            </p>
            <h3 className="mt-0.5 text-[15px] font-extrabold tracking-tight">
              Post it, then paste the link
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              We check it's from your account, that this campaign takes{" "}
              {campaign.platforms
                .map((p) => PLATFORM_META[p].label)
                .join(" / ")}
              , and that your caption has the required tags.
            </p>
          </div>

          <div className="space-y-4 p-5">
            {connected.length === 0 && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-3 text-[12px] font-medium text-amber-700 dark:text-amber-200">
                Connect a verified account before submitting clips.
              </div>
            )}

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Clip link
              </span>
              <div className="relative mt-2">
                <Link2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setError(null);
                    setSent(null);
                  }}
                  placeholder="https://tiktok.com/@you/video/…"
                  className="h-11 pl-9 font-mono text-[13px]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Caption tags
              </span>
              <Input
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setError(null);
                }}
                placeholder={required.join(" ") || "#yourhashtag"}
                className="mt-2 h-11 font-mono text-[13px]"
              />
            </label>

            {error && (
              <p className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.08] px-3.5 py-3 text-[12.5px] font-medium text-red-600 dark:text-red-300">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            {sent && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-neon/25 bg-neon/[0.08] px-3.5 py-3"
              >
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-neon">
                  <Check className="h-3.5 w-3.5" />
                  Sent to review
                </p>
                <p className="mt-1 flex items-center gap-3 font-mono text-[11.5px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {fmtFull(sent.views)} views
                  </span>
                  <span>{fmtFull(sent.likes)} likes</span>
                </p>
              </motion.div>
            )}

            <Button
              className="w-full gap-1.5 glow-primary"
              onClick={handleSubmit}
              disabled={busy}
            >
              <Send className="h-4 w-4" />
              {busy ? "Checking…" : "Scan & submit"}
            </Button>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <StatusBadge status="pending" />
              <span className="pt-0.5">
                Clips go to an admin first. Once accepted they&apos;re sent to
                the campaign and start earning.
              </span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-chip rounded-xl px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-extrabold tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}
