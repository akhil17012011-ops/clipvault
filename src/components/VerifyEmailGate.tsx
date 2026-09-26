import { ClipticLogo } from "@/components/ClipticMark";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useVerification } from "@/hooks/use-verification";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, LogOut, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Blocks the product until the signed-in user has proven they own their email.
 *
 * Google sign-in already proves the address, so this screen appears only for
 * password accounts. The code is checked by the server, never by the browser.
 */
export function RequireVerified({ children }: { children: ReactNode }) {
  const { isLoading, isVerified } = useVerification();
  const { signOut } = useAuth();

  if (isLoading) {
    /* Same rule as the rest of the app: hold the page background rather than
       flashing a loader for a check that resolves in a few hundred ms. */
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  if (!isVerified) {
    return <VerifyEmailPanel onSignOut={() => void signOut()} />;
  }

  return children;
}

function VerifyEmailPanel({ onSignOut }: { onSignOut: () => void }) {
  const { status, requestCode, checkCode } = useVerification();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Count the resend cooldown down so the button re-enables by itself. */
  const [seconds, setSeconds] = useState(status?.secondsUntilResend ?? 0);
  useEffect(() => {
    setSeconds(status?.secondsUntilResend ?? 0);
  }, [status?.secondsUntilResend]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  /* Ask for a code once, as soon as they land here. The ref stops a failed
     send from turning into a retry loop against the mail relay. */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    if (status && !status.pending && !status.verified) {
      asked.current = true;
      void send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.pending, status?.verified]);

  const send = async () => {
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
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await checkCode({ code });
      if (result.verified) {
        /* The gate re-renders on the status query and shows the product. */
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-12">
      <div className="console-field pointer-events-none absolute inset-0" />
      <div className="grid-page pointer-events-none absolute inset-0" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <ClipticLogo textClassName="text-xl" />
        </div>

        <div className="glass-panel rounded-3xl p-7 text-center sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
            <MailCheck className="h-6 w-6 text-brand" />
          </div>

          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
            Confirm your email
          </h1>
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
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          )}

          <Button
            className="mt-6 h-11 w-full gap-2 glow-primary"
            onClick={verify}
            disabled={busy || code.length !== 6}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
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
              {seconds > 0
                ? `Resend code in ${seconds}s`
                : "Send a new code"}
            </Button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>

          <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
            {status?.attemptsLeft !== undefined &&
            status.attemptsLeft < 5
              ? `${status.attemptsLeft} tr${status.attemptsLeft === 1 ? "y" : "ies"} left before you need a new code.`
              : "Codes expire after 15 minutes."}
          </p>
        </div>
      </div>
    </main>
  );
}
