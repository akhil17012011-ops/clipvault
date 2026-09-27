import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useVerification } from "@/hooks/use-verification";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell,
  CheckCircle2,
  Loader2,
  LogOut,
  MailCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Nudges password accounts to confirm their email — without trapping them.
 *
 * Google sign-in already proves the address, so this only ever has work to do
 * for someone who signed up with a password.
 *
 * It used to be a full-screen wall in front of the whole product. That was a
 * mistake in both directions: a person whose code took a minute to arrive, or
 * whose mail provider silently swallowed it, was locked out of Clip Vault
 * entirely with no way forward except signing out and trying again. It is now
 * a dismissible banner over the real app, so confirming an address improves an
 * account instead of deciding whether the account exists.
 */
const DISMISS_KEY = "clipvault.verify-banner-dismissed";

export function RequireVerified({ children }: { children: ReactNode }) {
  const { isLoading, isVerified, status } = useVerification();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  /* Nothing is shown while the check resolves or once the address is proven —
     `isLoading` is undefined-then-true-then-false, and flashing a banner for an
     account that turns out to be a Google one is worse than a brief absence.
     A stale dismissal cannot outlive the problem: the banner is simply not
     rendered for a verified account, and confirming clears the flag below. */
  if (isLoading || isVerified || dismissed) return <>{children}</>;

  return (
    <>
      {children}
      <VerifyBanner
        email={status?.email ?? "your inbox"}
        onVerify={() => setDialogOpen(true)}
        onDismiss={dismiss}
      />
      {dialogOpen && <VerifyDialog onClose={() => setDialogOpen(false)} />}
    </>
  );
}

/**
 * Sits above the app rather than inside it: the dashboard owns its own scroll
 * containers, so a banner rendered in the page tree would either scroll away or
 * need layout surgery in every view.
 */
function VerifyBanner({
  email,
  onVerify,
  onDismiss,
}: {
  email: string;
  onVerify: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div className="glass-panel pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border-brand/30 p-3.5 shadow-[0_24px_60px_-30px_rgb(139_63_226/0.7)] sm:p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
          <MailCheck className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            Confirm your email to secure your account
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            We&apos;ll send a 6-digit code to{" "}
            <span className="font-semibold text-foreground">{email}</span>. It
            protects your payouts and lets us reach you about campaigns. You can
            keep working either way.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8 gap-1.5" onClick={onVerify}>
              <MailCheck className="h-3.5 w-3.5" />
              Send code
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
              onClick={onDismiss}
            >
              Not now
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function VerifyDialog({ onClose }: { onClose: () => void }) {
  const { status, requestCode, checkCode } = useVerification();
  const { signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Count the resend cooldown down so the button re-enables by itself.

     The server sends the moment the cooldown lifts as an absolute timestamp,
     so the button is compared against the clock rather than against a counter
     that has to be decremented. That matters when the tab has been in the
     background: timers are throttled there, and a "seconds minus one per tick"
     counter silently drifts and leaves the button disabled long after the
     cooldown is actually over. */
  const [now, setNow] = useState(() => Date.now());
  const resendAt = status?.resendAvailableAt ?? null;
  const seconds =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const send = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestCode();
      setMessage(result.message);
      if (!result.sent) setError(result.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't send a code just now. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [requestCode]);

  /* Ask for a code as soon as the dialog opens. The ref stops a failed send
     from turning into a retry loop against the mail relay. */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void send();
  }, [send]);

  /* Close as soon as the server says the address is proven — the banner is
     gone by then and the dialog has nothing left to do. The dismissal is
     cleared at the same time so a later unverified session can show it again. */
  useEffect(() => {
    if (!status?.verified) return;
    sessionStorage.removeItem(DISMISS_KEY);
    onClose();
  }, [status?.verified, onClose]);

  const verify = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await checkCode({ code });
      if (result.verified) {
        /* The status query flips and the effect above closes this. */
        return;
      }
      setError(result.message);
      setCode("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <div
        className="glass-panel w-full max-w-[420px] rounded-3xl p-7 text-center sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm your email"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
          <MailCheck className="h-6 w-6 text-brand" />
        </div>

        <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
          Confirm your email
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-foreground">
            {status?.email ?? "your inbox"}
          </span>
          . Enter it here to finish setting up your account.
        </p>

        <div className="mt-7 flex justify-center">
          <InputOTP
            value={code}
            onChange={setCode}
            maxLength={6}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6 && !busy) verify();
            }}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
        {message && !error && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-neon" />
            {message}
          </p>
        )}

        <Button
          className="mt-6 h-11 w-full gap-2 glow-primary"
          onClick={verify}
          disabled={busy || code.length !== 6}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailCheck className="h-4 w-4" />
          )}
          Verify my email
        </Button>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={send}
            disabled={busy || seconds > 0}
          >
            {seconds > 0 ? `Resend code in ${seconds}s` : "Send a new code"}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <Bell className="h-3 w-3" />
            Remind me later
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>

        <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
          {status?.attemptsLeft !== undefined && status.attemptsLeft < 5
            ? `${status.attemptsLeft} tr${
                status.attemptsLeft === 1 ? "y" : "ies"
              } left before you need a new code.`
            : "Codes expire after 15 minutes."}
        </p>
      </div>
    </div>
  );
}
