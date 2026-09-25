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
  "Hit Verify — we scan the bio and connect the account",
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

  const generate = () => {
    const clean = handle.trim().replace(/^@+/, "");
    if (!clean) {
      setError("Enter the username you post from.");
      return;
    }
    setError(null);
    const created = addAccount(platform, clean);
    setAccount(created);
    setStep("code");
  };

  const verify = async () => {
    if (!account) return;
    setStep("verifying");
    await verifyAccount(account.id);
    setStep("success");
    toast.success("Account verified", {
      description: `@${account.handle} is connected — views now track back to you.`,
    });
    window.setTimeout(() => onOpenChange(false), 1_300);
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

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto gap-0 p-0 sm:max-w-xl [&>button]:z-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[#5B37E8]/35 blur-[80px]" />

          {step === "form" && (
            <div className="relative p-6 sm:p-7">
              <DialogHeader className="text-left">
                <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-[#c4b5fd]">
                  <ScanSearch className="h-5 w-5" />
                </div>
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  Connect a social account
                </DialogTitle>
                <DialogDescription>
                  Add the handle you post from. CLIPTIC generates a one-time
                  code you drop into your bio so we can track your views.
                </DialogDescription>
              </DialogHeader>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Platform
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                {PLATFORMS.filter((p) => p !== "x").map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
                      platform === p
                        ? "border-brand/50 bg-brand/12 text-foreground"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <PlatformChip platform={p} size="sm" />
                    {PLATFORM_META[p].label}
                    {platform === p && (
                      <Check className="ml-auto h-4 w-4 text-[#c4b5fd]" />
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
                  placeholder="avaclips"
                  className="h-11 pl-8 font-mono"
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
                <Button className="flex-1 glow-primary" onClick={generate}>
                  Generate code
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
                  className="mt-4 gap-1.5 border-white/15 bg-white/5 hover:bg-white/10"
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
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 font-mono text-[10px] font-bold text-muted-foreground">
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
                  onClick={() => setStep("form")}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button className="flex-1 gap-1.5 glow-primary" onClick={verify}>
                  <ShieldCheck className="h-4 w-4" /> Verify account
                </Button>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Demo mode — bio checks are simulated locally.
              </p>
            </div>
          )}

          {step === "verifying" && account && (
            <div className="relative px-6 py-14 text-center sm:px-7">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
                <Loader2 className="h-6 w-6 animate-spin text-[#c4b5fd]" />
              </div>
              <h3 className="mt-5 text-lg font-extrabold tracking-tight">
                Checking @{account.handle}&apos;s bio…
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Looking for{" "}
                <span className="font-mono font-semibold text-foreground">
                  {account.code}
                </span>{" "}
                on {PLATFORM_META[account.platform].label}
              </p>
              <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-white/8">
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
