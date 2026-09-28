import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlatformChip } from "@/components/ClipVaultUI";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { PLATFORMS, PLATFORM_META, type Platform } from "@/lib/clip-vault-data";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";

type AssetKind = "image" | "video" | "link";

type Asset = { label: string; url: string; kind: AssetKind };

/** A request as `campaignRequests.mine` returns it. */
type Request_ = {
  id: Id<"campaignRequests">;
  title: string;
  description: string;
  budgetUsd: number;
  ratePer1k: number;
  minViews: number;
  days: number;
  platforms: Platform[];
  assets: Asset[];
  status: "pending" | "approved" | "declined";
  reason: string | null;
  requestedAt: number;
};

const STATUS: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: {
    label: "Awaiting review",
    icon: Clock3,
    className: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  approved: {
    label: "Approved — live",
    icon: CheckCircle2,
    className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  },
  declined: {
    label: "Declined",
    icon: XCircle,
    className: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  },
};

function num(value: string): number {
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function when(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A brand asking Clip Vault to set up a campaign.
 *
 * The brand fills in everything a campaign actually needs — name, description,
 * budget, rate, platforms, and the photos/videos/links clippers should work
 * from — and an operator approves or declines it. Nothing goes live on its own,
 * which is why the list below always shows the decision rather than implying
 * one.
 *
 * While a request is still pending it is the brand's to change: they can edit
 * the details or delete it outright. After a decision it is a record, and only
 * the operator can close it.
 */
export function RequestCampaignView() {
  const { user } = useAuth();
  const requests = useQuery(api.campaignRequests.mine);
  const submit = useMutation(api.campaignRequests.submit);
  const edit = useMutation(api.campaignRequests.edit);
  const remove = useMutation(api.campaignRequests.remove);

  const [editingId, setEditingId] = useState<Id<"campaignRequests"> | null>(
    null,
  );
  const [deletingId, setDeletingId] =
    useState<Id<"campaignRequests"> | null>(null);
  const [brandName, setBrandName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [rate, setRate] = useState("");
  const [minViews, setMinViews] = useState("");
  const [days, setDays] = useState("30");
  const [platforms, setPlatforms] = useState<Platform[]>([
    "tiktok",
    "instagram",
  ]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (requests ?? []).filter((r) => r.status === "pending");
  const editing = (requests ?? []).find((r) => r.id === editingId) ?? null;

  const clearForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setBudget("");
    setRate("");
    setMinViews("");
    setDays("30");
    setAssets([]);
    setNote("");
  };

  const startEdit = (r: Request_) => {
    setEditingId(r.id);
    setBrandName("");
    setTitle(r.title);
    setDescription(r.description);
    setBudget(String(r.budgetUsd));
    setRate(String(r.ratePer1k));
    setMinViews(String(r.minViews));
    setDays(String(r.days));
    setPlatforms(r.platforms);
    setAssets(r.assets);
    setNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePlatform = (p: Platform) =>
    setPlatforms((current) =>
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    );

  const updateAsset = (index: number, patch: Partial<Asset>) =>
    setAssets((current) =>
      current.map((asset, i) => (i === index ? { ...asset, ...patch } : asset)),
    );

  const fields = {
    brandName: brandName.trim() || (user?.name ?? "").trim(),
    title: title.trim(),
    description: description.trim(),
    budgetUsd: num(budget),
    ratePer1k: num(rate),
    minViews: num(minViews),
    days: num(days) || 30,
    platforms,
    assets: assets
      .filter((a) => a.url.trim().length > 0)
      .map((a) => ({ label: a.label, url: a.url, kind: a.kind })),
    note: note.trim() || undefined,
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (platforms.length === 0) {
      toast.error("Pick at least one platform.");
      return;
    }
    setBusy(true);
    try {
      const result = editingId
        ? await edit({ requestId: editingId, ...fields })
        : await submit(fields);
      /* The server answers with the reason as data rather than throwing, so a
         validation problem shows up as a sentence instead of "Server Error". */
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      clearForm();
      toast.success(editingId ? "Request updated" : "Request sent", {
        description: editingId
          ? "An operator will review the new details."
          : "An operator reviews it and you'll see the decision here and in Messages.",
      });
    } catch (err) {
      /* Convex attaches a request id to its own errors. Showing it turns an
         unexplained failure into something that can actually be traced. */
      const requestId =
        err && typeof err === "object" && "requestId" in err
          ? String((err as { requestId?: unknown }).requestId ?? "")
          : "";
      toast.error(
        err instanceof Error
          ? err.message
          : "We couldn't reach Clip Vault. Check your connection and try again.",
        requestId ? { description: `Request ID: ${requestId}` } : undefined,
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    const id = deletingId;
    if (!id) return;
    setDeletingId(null);
    if (editingId === id) clearForm();
    try {
      await remove({ requestId: id });
      toast.success("Request deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
    }
  };

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel rounded-2xl p-5"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <Megaphone className="h-4 w-4" />
          </span>
          <h2 className="text-[15px] font-bold tracking-tight">
            Request a campaign
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Tell us what you want to run and we set it up: the rate, the rules, the
          budget and the brief clippers read. An operator reviews every request,
          so nothing is live — and nothing is billed — until you see it marked
          approved.
        </p>
      </motion.section>

      {(requests ?? []).length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel rounded-2xl p-5"
        >
          <h3 className="text-[15px] font-bold tracking-tight">
            Your campaign requests
          </h3>
          <ul className="mt-4 space-y-3">
            {(requests ?? []).map((r) => {
              const meta = STATUS[r.status] ?? STATUS.pending;
              const Icon = meta.icon;
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        ${r.budgetUsd} budget · ${r.ratePer1k}/1k views · sent{" "}
                        {when(r.requestedAt)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {r.description}
                  </p>
                  {r.status === "approved" && (
                    <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2 text-xs leading-relaxed text-emerald-200">
                      It&apos;s live. Verified creators can join it from the
                      Campaigns page right now.
                    </p>
                  )}
                  {r.status === "declined" && r.reason && (
                    <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2 text-xs leading-relaxed text-rose-200">
                      {r.reason}
                    </p>
                  )}

                  {/* While it is still pending the details are the brand's to
                      change. After a decision it is a record. */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="glass-chip gap-1.5"
                        onClick={() => startEdit(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    {/* Shown on every request, including an approved one: if the
                        campaign behind it was taken down, this is how the brand
                        clears the record. The server refuses while the campaign
                        is still live. */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground hover:text-red-500"
                      onClick={() => setDeletingId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold tracking-tight">
            {editing ? `Editing “${editing.title}”` : "New request"}
          </h3>
          {editing && (
            <Button size="sm" variant="ghost" onClick={clearForm} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </Button>
          )}
        </div>
        {editing && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Saving replaces the details the operator has not looked at yet.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Brand
              </label>
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Glow Labs"
                className="mt-2"
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Campaign name
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Spring serum launch"
                className="mt-2"
                maxLength={120}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the product is, who it's for, the angle you want clips to take, and anything a clipper must or must not say."
              className="mt-2 min-h-32 resize-y"
              maxLength={4000}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Budget (USD)
              </label>
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="2500"
                inputMode="decimal"
                className="mt-2 font-mono"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                $ per 1k views
              </label>
              <Input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="12"
                inputMode="decimal"
                className="mt-2 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Min views
              </label>
              <Input
                value={minViews}
                onChange={(e) => setMinViews(e.target.value)}
                placeholder="1000"
                inputMode="numeric"
                className="mt-2 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Days
              </label>
              <Input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="30"
                inputMode="numeric"
                className="mt-2 font-mono"
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Platforms clips may post on
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`glass-chip inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-brand/60 bg-brand/20 text-[#E4D6FF]"
                        : "text-muted-foreground hover:text-[#C9AEFF]"
                    }`}
                  >
                    <PlatformChip platform={p} size="sm" />
                    {PLATFORM_META[p].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Photos, videos &amp; links
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="glass-chip gap-1.5"
                onClick={() =>
                  setAssets((current) => [
                    ...current,
                    { label: "", url: "", kind: "video" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Paste a Drive folder, a Loom or YouTube link, a product page —
              whatever a clipper needs to make the clip from.
            </p>
            {assets.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-black/12 px-4 py-5 text-center text-xs text-muted-foreground dark:border-white/15">
                No files added yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {assets.map((asset, index) => (
                  <li
                    key={index}
                    className="flex flex-col gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-center"
                  >
                    <select
                      value={asset.kind}
                      onChange={(e) =>
                        updateAsset(index, {
                          kind: e.target.value as AssetKind,
                        })
                      }
                      className="h-9 rounded-lg border border-black/10 bg-transparent px-2 text-xs font-semibold dark:border-white/15 sm:w-28"
                    >
                      <option value="video">Video</option>
                      <option value="image">Photo</option>
                      <option value="link">Link</option>
                    </select>
                    <Input
                      value={asset.label}
                      onChange={(e) =>
                        updateAsset(index, { label: e.target.value })
                      }
                      placeholder="What is it?"
                      className="h-9 sm:w-48"
                      maxLength={120}
                    />
                    <Input
                      value={asset.url}
                      onChange={(e) =>
                        updateAsset(index, { url: e.target.value })
                      }
                      placeholder="https://…"
                      className="h-9 flex-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAssets((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      title="Remove"
                      className="shrink-0 self-end rounded-md p-1.5 text-muted-foreground transition-colors hover:text-red-500 sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Anything else
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Timing, products we should not push, exclusivity, invoice details (optional)"
              className="mt-2 min-h-20 resize-y"
              maxLength={2000}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={busy || (!editing && open.length >= 2)}
              className="liquid glow-primary bg-gradient-to-b from-[#A855F7] to-[#8B3FE2]"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editing ? (
                <FileText className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {editing ? "Save changes" : "Send request"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {editing
                ? "Only this request changes — nothing else is touched."
                : open.length >= 2
                  ? "You have two requests waiting — we'll answer those first."
                  : `Sending as ${user?.email ?? "your account"}.`}
            </span>
          </div>
        </form>
      </motion.section>

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-5">
            <h3 className="text-[15px] font-bold">Delete this request?</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              It is removed for good and nothing is sent to anyone. If it is
              already live as a campaign, delete the campaign itself instead —
              the request goes with it.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeletingId(null)}
              >
                Keep it
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-500"
                onClick={() => void confirmDelete()}
              >
                Delete it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
