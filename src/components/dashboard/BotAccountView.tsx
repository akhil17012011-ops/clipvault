import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

/**
 * The developer's Instagram bot connection.
 *
 * Instagram refuses profile reads from datacentre addresses, and the only
 * route that answers them for free — a real signed-in session — cannot be
 * obtained from a server, because Instagram demands an anti-bot checkpoint that
 * only a genuine browser clears. So the account owner signs in once, in their
 * own browser, and pastes the cookies here.
 *
 * From then on every follower count is a plain authenticated request from our
 * own server: no API, no per-read cost, no third party, and no ceiling.
 *
 * The cookies are credentials for a real account. They are stored server-side,
 * never returned by any query, and this screen shows only the last four
 * characters so two sessions can be told apart. Anyone who is not the developer
 * never sees this page, and the server refuses the writes regardless.
 */

/** Cookie values are long, and an input truncates what it accepts. */
const COOKIE = { autoComplete: "off", spellCheck: false } as const;

export function BotAccountView() {
  const status = useQuery(api.botaccount.botStatus, {});
  const save = useMutation(api.botaccount.saveBotSession);
  const clear = useMutation(api.botaccount.clearBotSession);
  const test = useAction(api.botaccount.testBotSession);

  const [sessionid, setSessionid] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [dsUserId, setDsUserId] = useState("");
  const [cookieHeader, setCookieHeader] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState<"save" | "clear" | "test" | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    null,
  );

  /* Non-developers get nothing at all. The server enforces the same rule on
     every write, so this is presentation, not the boundary. */
  if (status && !status.allowed) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center">
        <p className="text-sm font-semibold">This page is for the developer.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign in with the developer account to manage the Instagram bot
          connection.
        </p>
      </div>
    );
  }

  const connected = status?.connected ?? false;

  const onSave = async () => {
    setBusy("save");
    setNote(null);
    try {
      const result = await save({
        cookieHeader: cookieHeader.trim() || undefined,
        sessionid: sessionid.trim() || undefined,
        csrfToken: csrfToken.trim() || undefined,
        dsUserId: dsUserId.trim() || undefined,
        loggedInAs: "clipzx.studio",
      });
      setNote({ tone: result.ok ? "ok" : "bad", text: result.message });
      if (result.ok) {
        setSessionid("");
        setCsrfToken("");
        setDsUserId("");
        setCookieHeader("");
      }
    } catch (error) {
      setNote({
        tone: "bad",
        text: error instanceof Error ? error.message : "That didn't save.",
      });
    } finally {
      setBusy(null);
    }
  };

  const onTest = async () => {
    if (!handle.trim()) {
      setNote({ tone: "bad", text: "Enter a handle to test against." });
      return;
    }
    setBusy("test");
    setNote(null);
    try {
      const result = await test({ handle: handle.trim() });
      const summary = [
        result.handle ? `@${result.handle}` : null,
        result.followers != null ? `${result.followers} followers` : null,
        result.posts != null ? `${result.posts} posts` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setNote({
        tone: result.ok ? "ok" : "bad",
        text: summary ? `${summary} — ${result.message}` : result.message,
      });
    } catch (error) {
      setNote({
        tone: "bad",
        text: error instanceof Error ? error.message : "The test failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const onClear = async () => {
    setBusy("clear");
    setNote(null);
    try {
      const result = await clear({});
      setNote({ tone: result.ok ? "ok" : "bad", text: result.message });
    } catch (error) {
      setNote({
        tone: "bad",
        text: error instanceof Error ? error.message : "That didn't clear.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <UserCheck className="h-5 w-5 text-brand" />
          Instagram bot connection
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Instagram blocks profile reads from datacentre addresses. Signing the
          bot account in once, in a real browser, lifts that — and then every
          follower count is a direct read from our own server: free, unlimited,
          and immediate.
        </p>
      </header>

      {/* Current state, stated plainly. */}
      <div
        className={`rounded-2xl border p-4 ${
          connected
            ? "border-neon/30 bg-neon/[0.06]"
            : "border-white/10 bg-black/[0.02] dark:bg-white/[0.02]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {connected ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">
              {connected
                ? `Connected as @${status?.loggedInAs ?? "the bot account"}`
                : "Not connected"}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {connected
                ? `Session ${status?.sessionHint ?? ""} · saved ${
                    status?.lastLoginAt
                      ? new Date(status.lastLoginAt).toLocaleString()
                      : "recently"
                  }`
                : "Follow the steps below to sign the bot account in once."}
            </p>
          </div>
          {connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={busy !== null}
            >
              {busy === "clear" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          )}
        </div>
        {status?.message && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            {status.message}
          </p>
        )}
      </div>

      {/* The steps. Numbered because they have to happen in this order, in a
          browser the developer controls, not on the server. */}
      <ol className="space-y-2.5">
        {[
          {
            title: "Sign in to the bot account",
            body: "A laptop is easiest — the session belongs to the account, not the device, so a desktop sign-in works perfectly well. On Android, see the note below the steps.",
          },
          {
            title: "Get the cookie string",
            body: "Desktop: devtools → Application → Cookies → https://www.instagram.com, then copy the cookies as one string. Android: use Kiwi Browser (Chrome with extension support) and any cookie-viewer extension, or Firefox for Android with a cookies extension.",
          },
          {
            title: "Paste it below",
            body: "One long paste is enough — we pull out sessionid, csrftoken and ds_user_id and ignore the rest. It goes straight to the server and is never shown again.",
          },
        ].map((step, index) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-xl border border-white/[0.07] bg-black/[0.02] px-4 py-3 dark:bg-white/[0.02]"
          >
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold">{step.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* The form. */}
      <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/[0.02] p-4 dark:bg-white/[0.02]">
        <p className="flex items-center gap-1.5 text-[12px] font-bold">
          <KeyRound className="h-3.5 w-3.5 text-brand" />
          Session cookies
        </p>

        {/* The easy path, and the one that works on a phone: one long paste.
            The individual fields below stay for anyone who copied them out of a
            desktop devtools panel. */}
        <div>
          <label
            htmlFor="bot-cookie-header"
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Whole cookie string — easiest
          </label>
          <textarea
            id="bot-cookie-header"
            value={cookieHeader}
            onChange={(event) => setCookieHeader(event.target.value)}
            rows={3}
            placeholder={"sessionid=1234%3Aabc…; csrftoken=def…\n—or the whole cookie file from the extension—"}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[11.5px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/40"
            {...COOKIE}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Paste the lot — we pull out the three we need and ignore the rest.
            A cookie string and a cookie file both work.
          </p>
        </div>

        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Or paste the three values separately
          </summary>
          <div className="mt-2.5 space-y-3">
            <Field
              label="sessionid"
              value={sessionid}
              onChange={setSessionid}
              placeholder="1234%3Aabcd…"
            />
            <Field
              label="csrftoken"
              value={csrfToken}
              onChange={setCsrfToken}
              placeholder="abcdef0123456789"
            />
            <Field
              label="ds_user_id (optional)"
              value={dsUserId}
              onChange={setDsUserId}
              placeholder="12345678"
              optional
            />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            onClick={onSave}
            disabled={
              busy !== null ||
              (!cookieHeader.trim() &&
                !(sessionid.trim() && csrfToken.trim()))
            }
            size="sm"
          >
            {busy === "save" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save session
          </Button>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={busy !== null || !connected}
            size="sm"
          >
            {busy === "test" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Test a read
          </Button>
        </div>

        {/* The test target, only useful once a session is saved. */}
        <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.07] pt-3">
          <div className="min-w-[180px] flex-1">
            <label
              htmlFor="bot-test-handle"
              className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Test against
            </label>
            <Input
              id="bot-test-handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="a handle you have connected"
              {...COOKIE}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHandle("");
              setNote(null);
            }}
            disabled={busy !== null}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Android has no DevTools, so the desktop instructions above do not
          apply. These are the routes that do, in the order they usually work. */}
      <div className="rounded-2xl border border-white/[0.07] bg-black/[0.02] p-4 dark:bg-white/[0.02]">
        <p className="text-[12px] font-bold">On Android</p>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Kiwi Browser</span> — a
            Chrome for Android that runs Chrome extensions. Install a cookie
            viewer there, open instagram.com, and copy the cookie string.
          </li>
          <li>
            <span className="font-semibold text-foreground">Firefox for Android</span>{" "}
            — you have this. Menu → Add-ons and themes → search “cookies” →
            install a cookies extension → sign in to Instagram → open the
            extension → copy or export. Paste the whole thing into the box
            above; the file format works as well as a plain string.
          </li>
          <li>
            <span className="font-semibold text-foreground">Or just use a
            laptop.</span> The session is tied to the account, not the phone, so
            signing in on any computer and pasting from there gives exactly the
            same result.
          </li>
        </ul>
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Chrome on Android has no developer-tools panel, so there is no way to
          read these cookies out of it directly. A bookmarklet will not help
          either — the session cookie is marked HttpOnly precisely so that
          page scripts cannot read it.
        </p>
      </div>

      {note && (
        <p
          className={`rounded-xl border px-4 py-3 text-[12px] leading-relaxed ${
            note.tone === "ok"
              ? "border-neon/30 bg-neon/[0.06] text-neon"
              : "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
          }`}
        >
          {note.text}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        These cookies are a live credential for the bot account. Treat them like
        a password: anyone holding them can act as that account. If one ever
        leaks, disconnect here, change the bot account's password on Instagram,
        and sign in again.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  optional?: boolean;
}) {
  const id = `bot-${label.replace(/\W+/g, "-")}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
        {optional && <span className="ml-1 font-normal normal-case">— optional</span>}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="font-mono text-[12px]"
        {...COOKIE}
      />
    </div>
  );
}
