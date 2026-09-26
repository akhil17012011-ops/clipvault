import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ClipVaultLogo, ClipVaultMark } from "@/components/ClipVaultMark";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  KeyRound,
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

type Mode = "password" | "code";
type PasswordFlow = "signIn" | "signUp";

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

/** Turns a Convex Auth failure into something a person can act on. */
function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/already exists|already been registered|is taken/i.test(raw)) {
    return "An account already uses that email. Try signing in instead.";
  }
  if (/invalid credentials|incorrect password/i.test(raw)) {
    return "That email and password don't match an account.";
  }
  if (/password/i.test(raw) && /short|invalid|8/i.test(raw)) {
    return "Passwords need to be at least 8 characters.";
  }
  if (/rate limit|too many/i.test(raw)) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (/provider|not configured|clientId|oauth/i.test(raw)) {
    return "That sign-in method isn't available right now. Try another option.";
  }
  return raw.slice(0, 180) || "Something went wrong. Please try again.";
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [mode, setMode] = useState<Mode>("password");
  const [flow, setFlow] = useState<PasswordFlow>("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  /* Real Google OAuth: the browser is handed to Google and comes back. */
  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      /**
       * `redirectTo` must resolve against the Convex site, because that is the
       * OAuth origin — an absolute app URL is rejected by Convex Auth. So we
       * ask to be handed back to a path on the app, and the Convex site's
       * /back-to-app route sends the browser home. `redirect` is already a
       * validated same-app path, so only the path is carried.
       */
      await signIn("google", {
        redirectTo: `/back-to-app?to=${encodeURIComponent(redirect)}`,
      });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(readableError(err));
      setBusy(false);
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow,
      });
      /* On success the auth effect above redirects. */
    } catch (err) {
      console.error("Password sign-in error:", err);
      setError(readableError(err));
      setBusy(false);
    }
  };

  const handleCodeRequest = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("email-otp", { email: email.trim().toLowerCase() } as never);
      setCodeEmail(email.trim().toLowerCase());
      setBusy(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(readableError(err));
      setBusy(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!codeEmail) return;
    setBusy(true);
    setError(null);
    try {
      await signIn("email-otp", {
        email: codeEmail,
        code: otp,
      } as never);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("The verification code you entered is incorrect.");
      setOtp("");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------- brand panel ---------------- */}
      <aside className="relative hidden overflow-hidden border-r border-black/8 bg-white/60 p-10 dark:border-white/10 dark:bg-white/[0.06] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#8B3FE2]/35 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[420px] w-[420px] rounded-full bg-[#7C3AED]/25 blur-[130px]" />
        <div className="console-field pointer-events-none absolute inset-0" />
        <div className="grid-page pointer-events-none absolute inset-0" />

        <div className="relative">
          <ClipVaultLogo textClassName="text-xl" />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/35 bg-brand/10 px-3.5 py-1.5 text-[12px] font-semibold text-brand">
            <BadgeCheck className="h-3.5 w-3.5" />
            For creators &amp; brands
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

        <div className="relative grid max-w-md grid-cols-3 gap-4 rounded-2xl border border-black/10 bg-black/[0.02] p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
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
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[420px] -translate-x-1/2 rounded-full bg-[#8B3FE2]/20 blur-[120px] lg:hidden" />

        <div className="relative w-full max-w-[404px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <ClipVaultLogo textClassName="text-xl" />
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/70 p-7 shadow-[0_40px_100px_-60px_rgb(139_63_226/0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:p-8">
            <div className="flex justify-center">
              <ClipVaultMark className="mb-5 h-14 w-14" />
            </div>

            {codeEmail ? (
              <>
                <h2 className="text-center text-2xl font-extrabold tracking-tight">
                  Check your email
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  We&apos;ve sent a code to {codeEmail}
                </p>
                <form onSubmit={handleOtpSubmit} className="mt-7">
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !busy) {
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
                  <div className="mt-6 flex flex-col gap-2">
                    <Button
                      type="submit"
                      className="h-11 w-full glow-primary"
                      disabled={busy || otp.length !== 6}
                    >
                      {busy ? (
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
                      onClick={() => {
                        setCodeEmail(null);
                        setOtp("");
                        setError(null);
                      }}
                      disabled={busy}
                      className="w-full text-muted-foreground"
                    >
                      Use a different email
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-center text-2xl font-extrabold tracking-tight">
                  Welcome to Clip Vault
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Sign in or create an account — it takes less than a minute.
                </p>

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy}
                  className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md disabled:opacity-60 dark:border-white/10"
                >
                  {busy ? (
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

                {/* mode switch */}
                <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.04]">
                  {(
                    [
                      { id: "password" as const, label: "Password", icon: KeyRound },
                      { id: "code" as const, label: "Email code", icon: Mail },
                    ]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setMode(tab.id);
                        setError(null);
                      }}
                      className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                        mode === tab.id
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {mode === "password" ? (
                  <form onSubmit={handlePasswordSubmit}>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11"
                      disabled={busy}
                      required
                    />
                    <Input
                      type="password"
                      autoComplete={
                        flow === "signUp" ? "new-password" : "current-password"
                      }
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-2.5 h-11"
                      disabled={busy}
                      minLength={8}
                      required
                    />
                    {error && (
                      <p className="mt-3 text-sm text-red-500 dark:text-red-400">
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="mt-4 h-11 w-full glow-primary"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {flow === "signUp" ? "Creating…" : "Signing in…"}
                        </>
                      ) : flow === "signUp" ? (
                        <>
                          Create account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <p className="mt-4 text-center text-[12px] text-muted-foreground">
                      {flow === "signUp"
                        ? "Already have an account?"
                        : "New to Clip Vault?"}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setFlow(flow === "signUp" ? "signIn" : "signUp");
                          setError(null);
                        }}
                        className="font-semibold text-brand underline-offset-2 hover:underline"
                      >
                        {flow === "signUp" ? "Sign in" : "Create an account"}
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleCodeRequest}>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-11 pl-9"
                          disabled={busy}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="icon"
                        className="h-11 w-11 shrink-0 glow-primary"
                        disabled={busy}
                        aria-label="Send verification code"
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-3 text-sm text-red-500 dark:text-red-400">
                        {error}
                      </p>
                    )}
                  </form>
                )}

                <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground">
                  By continuing you agree to Clip Vault&apos;s{" "}
                  <span className="text-foreground/70 underline decoration-black/25 underline-offset-2 dark:decoration-white/25">
                    Terms
                  </span>{" "}
                  and{" "}
                  <span className="text-foreground/70 underline decoration-black/25 underline-offset-2 dark:decoration-white/25">
                    Privacy Policy
                  </span>
                  .
                </p>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Free to join · No following required
          </p>
        </div>
      </main>
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
