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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ClipticLogo, ClipticMark } from "@/components/ClipticMark";
import { useAuth } from "@/hooks/use-auth";
import { useCliptic } from "@/lib/cliptic-store";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function GoogleG({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.28 7.28 0 0 1 0-4.58V6.62H1.29a11.86 11.86 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

const GOOGLE_ACCOUNTS = [
  { name: "Ava Rivera", email: "ava.rivera@gmail.com", tint: "from-violet-500 to-indigo-600" },
  { name: "Marcus Lee", email: "marcus.clips@gmail.com", tint: "from-fuchsia-500 to-violet-600" },
  { name: "CLIPTIC Admin", email: "admin@cliptic.com", tint: "from-zinc-900 to-zinc-600" },
];

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const { setProfile } = useCliptic();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [pickingEmail, setPickingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  /** Simulated Google account picker → real session via anonymous auth. */
  const handleGoogleAccount = async (account: {
    name: string;
    email: string;
  }) => {
    setPickingEmail(account.email);
    setError(null);
    try {
      await signIn("anonymous");
      setProfile({ name: account.name, email: account.email });
      navigate(redirect);
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Sign-in failed. Try again or continue with email.");
      setPickingEmail(null);
      setGoogleOpen(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "");
      await signIn("email-otp", formData);
      setProfile({
        name: email.split("@")[0] || "Creator",
        email,
      });
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------- brand panel ---------------- */}
      <aside className="relative hidden overflow-hidden border-r border-black/8 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#5B37E8]/35 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[420px] w-[420px] rounded-full bg-[#7C3AED]/25 blur-[130px]" />
        <div className="grid-fade pointer-events-none absolute inset-0" />

        <div className="relative">
          <ClipticLogo textClassName="text-xl" />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/35 bg-brand/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand">
            <BadgeCheck className="h-3.5 w-3.5" />
            For creators & brands
          </span>
          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] xl:text-5xl">
            Turn views into <span className="text-grad">real income</span>.
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Join campaigns from real brands, clip their content, post it to your
            accounts and earn for every verified view.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              { icon: Wallet, text: "Published rates — up to $3 per 1K views" },
              { icon: ShieldCheck, text: "Bio-verification links your accounts once" },
              { icon: CheckCircle2, text: "Weekly payouts via PayPal, USDC or USDT" },
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-3 text-sm text-foreground/85"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                  <item.icon className="h-4 w-4" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative grid max-w-md grid-cols-3 gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] p-5 backdrop-blur">
          {[
            { v: "Free", l: "to join" },
            { v: "3", l: "platforms tracked" },
            { v: "Weekly", l: "payout cycles" },
          ].map((stat) => (
            <div key={stat.l}>
              <p className="font-mono text-xl font-extrabold tracking-tight">
                {stat.v}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.l}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* ---------------- sign-in ---------------- */}
      <main className="relative flex items-center justify-center px-5 py-12">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[420px] -translate-x-1/2 rounded-full bg-[#5B37E8]/20 blur-[120px] lg:hidden" />

        <div className="relative w-full max-w-[404px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <ClipticLogo textClassName="text-xl" />
          </div>

          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-7 shadow-[0_40px_100px_-60px_rgb(91_55_232/0.5)] backdrop-blur-xl sm:p-8">
            <div className="flex justify-center">
              <ClipticMark className="mb-5 h-14 w-14" />
            </div>

            {step === "signIn" ? (
              <>
                <h2 className="text-center text-2xl font-extrabold tracking-tight">
                  Welcome to CLIPTIC
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Sign in or create an account — it takes less than a minute.
                </p>

                <button
                  type="button"
                  onClick={() => setGoogleOpen(true)}
                  disabled={isLoading}
                  className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleG />
                  )}
                  Continue with Google
                </button>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    or
                  </span>
                  <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
                </div>

                <form onSubmit={handleEmailSubmit}>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="h-11 pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      size="icon"
                      className="h-11 w-11 shrink-0 glow-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
                  )}
                </form>

                <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground">
                  By continuing you agree to CLIPTIC&apos;s{" "}
                  <span className="text-foreground/70 underline decoration-black/25 dark:decoration-white/25 underline-offset-2">
                    Terms
                  </span>{" "}
                  and{" "}
                  <span className="text-foreground/70 underline decoration-black/25 dark:decoration-white/25 underline-offset-2">
                    Privacy Policy
                  </span>
                  .
                </p>
              </>
            ) : (
              <>
                <h2 className="text-center text-2xl font-extrabold tracking-tight">
                  Check your email
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  We&apos;ve sent a code to {step.email}
                </p>
                <form onSubmit={handleOtpSubmit} className="mt-7">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
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
                    <p className="mt-3 text-center text-sm text-red-500 dark:text-red-400">
                      {error}
                    </p>
                  )}
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Didn&apos;t receive a code?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-brand"
                      onClick={() => setStep("signIn")}
                    >
                      Try again
                    </Button>
                  </p>

                  <div className="mt-6 flex flex-col gap-2">
                    <Button
                      type="submit"
                      className="h-11 w-full glow-primary"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full text-muted-foreground"
                    >
                      Use a different email
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Demo access · sign in with an{" "}
            <span className="font-semibold text-foreground">admin@…</span> email
            for the brand console — any other email is a creator account.
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Free to join · No following required
          </p>
        </div>
      </main>

      {/* ---------------- Google account picker ---------------- */}
      <Dialog open={googleOpen} onOpenChange={setGoogleOpen}>
        <DialogContent className="max-w-[380px] overflow-hidden rounded-2xl border-black/10 dark:border-white/10 bg-white p-0 sm:max-w-[380px] [&>button]:text-zinc-500">
          <DialogHeader className="sr-only">
            <DialogTitle>Choose an account</DialogTitle>
            <DialogDescription>
              Sign in to CLIPTIC with Google
            </DialogDescription>
          </DialogHeader>

          <div className="bg-white p-6 text-zinc-900">
            <GoogleG className="h-6 w-6" />
            <h3 className="mt-4 text-xl font-medium text-zinc-900">
              Choose an account
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              to continue to{" "}
              <span className="font-semibold text-zinc-900">CLIPTIC</span>
            </p>

            <ul className="mt-5 divide-y divide-zinc-100 border-y border-zinc-100">
              {GOOGLE_ACCOUNTS.map((account) => {
                const busy = pickingEmail === account.email;
                return (
                  <li key={account.email}>
                    <button
                      type="button"
                      disabled={pickingEmail !== null}
                      onClick={() => handleGoogleAccount(account)}
                      className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-zinc-50 disabled:opacity-70"
                    >
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${account.tint}`}
                      >
                        {account.name[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-900">
                          {account.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {account.email}
                        </span>
                      </span>
                      {busy && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                      )}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  disabled={pickingEmail !== null}
                  onClick={() => {
                    setGoogleOpen(false);
                    setStep("signIn");
                  }}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-70"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  Use another account
                </button>
              </li>
            </ul>

            <p className="mt-5 text-[11px] leading-relaxed text-zinc-500">
              To continue, Google will share your name and email address with
              CLIPTIC. This demo simulates the picker and opens a real session.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
