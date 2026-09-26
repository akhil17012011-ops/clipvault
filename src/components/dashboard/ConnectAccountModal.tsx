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
import { PLATFORMS, PLATFORM_META, type LinkedAccount, type Platform } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";
import { toast } from "sonner";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

type Step = "form" | "code" | "verifying" | "success";

const INSTRUCTIONS = [
  "Open your profile and make sure the account is public",
  "Paste the code into your bio (it can sit next to your link)",
  "Save the profile, then come back here",
  "Hit Verify — we load your profile and look for the code",
];

export function ConnectAccountModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addAccount, verifyAccount } = useCliptic();
  const [step, setStep] = useState<Step>("form");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [handle, setHandle] = useState("");
  const [account, setAccount] = useState<LinkedAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seenBio, setSeenBio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    const clean = handle.trim().replace(/^@+/, "");
    if (!clean) {
      setError("Enter the username you post from.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      /* The code is generated and stored on the server, not in the browser. */
      const created = await addAccount(platform, clean);
      setAccount(created);
      setStep("code");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't start that connection. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!account) return;
    setStep("verifying");
    setError(null);
    setSeenBio(null);
    try {
      /* The bio is fetched and checked server-side. */
      const result = await verifyAccount(account.id);
      if (result.verified) {
        setStep("success");
        toast.success("Account connected", {
          description: `@${account.handle} is verified — views from it count toward your earnings.`,
        });
        window.setTimeout(() => onOpenChange(false), 1_600);
      } else {
        setStep("code");
        setError(result.message);
        setSeenBio(result.bio ?? null);
      }
    } catch (err) {
      setStep("code");
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't check that profile. Try again in a moment.",
      );
    }
  };

  const copyCode = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      /* clipboard unavailable — the code is selectable on screen */
    }
  };

  const close = (next: boolean) => {
    // don't let the wizard be dismissed while a bio check is running
    if (step === "verifying") return;
    onOpenChange(next);
  };

  const reset = () => {
    setStep("form");
    setHandle("");
    setAccount(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto gap-0 p-0 sm:max-w-xl [&>button]:z-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[#8B3FE2]/20 blur-[80px]" />

          {step === "form" && (
            <div className="relative p-6 sm:p-7">
              <DialogHeader className="text-left">
                <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                  <ScanSearch className="h-5 w-5" />
                </div>
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  Connect a social account
                </DialogTitle>
                <DialogDescription>
                  Add the handle you post from. CLIPTIC generates a one-time
                  code you drop into your bio, then reads your public profile to
                  confirm it's really there.
                </DialogDescription>
              </DialogHeader>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Platform
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
                      platform === p
                        ? "border-brand/50 bg-brand/12 text-foreground"
                        : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-muted-foreground hover:border-black/15 dark:hover:border-white/25"
                    }`}
                  >
                    <PlatformChip platform={p} size="sm" />
                    {PLATFORM_META[p].label}
                    {platform === p && (
                      <Check className="ml-auto h-4 w-4 text-brand" />
                    )}
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Username
              </label>
              <div className="relative mt-2.5">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") generate();
                  }}
                  placeholder="yourhandle"
                  className="h-11 pl-8 font-mono"
                  autoFocus
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>}

              <div className="mt-7 flex gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 glow-primary" onClick={generate} disabled={busy}>
                  {busy ? "Generating…" : "Generate code"}
                </Button>
              </div>
            </div>
          )}

          {step === "code" && account && (
            <div className="relative p-6 sm:p-7">
              <DialogHeader className="text-left">
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  Add this code to your bio
                </DialogTitle>
                <DialogDescription>
                  On {PLATFORM_META[account.platform].label} as{" "}
                  <span className="font-mono text-foreground">@{account.handle}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 rounded-2xl border border-dashed border-brand/45 bg-brand/10 px-4 py-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Verification code
                </p>
                <p className="mt-2.5 select-all font-mono text-3xl font-extrabold tracking-[0.06em] text-foreground">
                  {account.code}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5 border-black/12 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                  onClick={copyCode}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-neon" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy code
                    </>
                  )}
                </Button>
              </div>

              <ol className="mt-5 space-y-2.5">
                {INSTRUCTIONS.map((text, i) => (
                  <li key={text} className="flex gap-3 text-[13px] leading-snug">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/12 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] font-mono text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={reset}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button className="flex-1 gap-1.5 glow-primary" onClick={verify}>
                  <ShieldCheck className="h-4 w-4" /> Verify account
                </Button>
              </div>
              {error && (
                <p className="mt-3 text-center text-[12px] text-red-500 dark:text-red-400">
                  {error}
                </p>
              )}
              {/* Show the bio we actually read, so a mismatch is obvious. */}
              {seenBio !== null && (
                <div className="mt-3 rounded-xl border border-black/8 bg-black/[0.03] px-3 py-2.5 text-left dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Bio we read
                  </p>
                  <p className="mt-1 line-clamp-3 text-[12px] text-foreground/80">
                    {seenBio || <span className="text-muted-foreground">This profile has no bio text.</span>}
                  </p>
                </div>
              )}
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                We load your public profile and look for the code above.
              </p>
            </div>
          )}

          {step === "verifying" && account && (
            <div className="relative px-6 py-14 text-center sm:px-7">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
              <h3 className="mt-5 text-lg font-extrabold tracking-tight">
                Checking @{account.handle}&apos;s profile…
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Looking for{" "}
                <span className="font-mono font-semibold text-foreground">
                  {account.code}
                </span>{" "}
                on {PLATFORM_META[account.platform].label}
              </p>
              <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                <div className="shimmer h-full w-full rounded-full bg-gradient-to-r from-brand to-[#a78bfa]" />
              </div>
            </div>
          )}

          {step === "success" && account && (
            <div className="relative px-6 py-14 text-center sm:px-7">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-neon/30 bg-neon/12">
                <CheckCircle2 className="h-8 w-8 text-neon" />
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight">
                Account connected
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-mono text-foreground">
                  @{account.handle}
                </span>{" "}
                is verified — every view from this account counts toward your
                earnings.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
