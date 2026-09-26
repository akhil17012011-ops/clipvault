import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Loader2,
  Megaphone,
  Radio,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { fmtFull, type AdminMessage, type AdminUser } from "@/lib/cliptic-data";

function when(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Composes messages to creators — one person, or everyone at once.
 *
 * The two are kept visually distinct on purpose. A note to one clipper and an
 * announcement to the whole platform are different acts, and the composer
 * should make the difference obvious before the send button is pressed.
 */
export function AdminMessages({
  users,
  history,
  onSendToUser,
  onBroadcast,
}: {
  users: AdminUser[];
  history: AdminMessage[];
  onSendToUser: (userId: string, title: string, body: string) => Promise<void>;
  onBroadcast: (title: string, body: string) => Promise<number>;
}) {
  const [mode, setMode] = useState<"user" | "everyone">("user");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        )
      : users;
    return list.slice(0, 8);
  }, [users, search]);

  const send = async () => {
    setError(null);
    setSent(null);
    if (!body.trim()) {
      setError("Write something before sending.");
      return;
    }
    if (mode === "user" && !target) {
      setError("Pick who this is for.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "everyone") {
        const count = await onBroadcast(title, body);
        setSent(`Sent to ${count} ${count === 1 ? "person" : "people"}.`);
      } else {
        await onSendToUser(target, title, body);
        setSent("Sent.");
      }
      setBody("");
      setTitle("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't send that.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-white/8 bg-card/60 p-5 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
          <Megaphone className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold tracking-tight">Messages</h2>
          <p className="text-[11px] text-muted-foreground">
            Reach one creator or the whole platform.
          </p>
        </div>
      </div>

      {/* Two distinct acts, so they get two distinct controls. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            { id: "user" as const, label: "One creator", icon: Sparkles },
            { id: "everyone" as const, label: "Everyone", icon: Radio },
          ]
        ).map((tab) => {
          const active = mode === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`relative flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12.5px] font-bold transition-colors duration-200 ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="admin-msg-mode"
                  className="absolute inset-0 rounded-lg border border-brand/40 bg-brand/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="relative h-3.5 w-3.5" />
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {mode === "user" ? (
        <div className="mt-3.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="h-9 pl-8.5 text-[12.5px]"
            />
          </div>
          <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-2 py-3 text-center text-[12px] text-muted-foreground">
                No creators match that.
              </li>
            ) : (
              matches.map((user) => (
                <li key={user.userId}>
                  <button
                    type="button"
                    onClick={() => setTarget(user.userId)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-200 ${
                      target === user.userId
                        ? "bg-brand/12 ring-1 ring-brand/35"
                        : "hover:bg-white/[0.05]"
                    }`}
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] to-[#5B0FA6] text-[10px] font-bold text-white">
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">
                        {user.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                      {user.accounts.length} acct
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <p className="mt-3.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-200">
          This writes a message into every one of the {users.length} inboxes.
          There's no undo — send to a single creator if you only need one person
          to know.
        </p>
      )}

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Subject (optional)"
        className="mt-3.5 h-9 text-[12.5px]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="What do you want to say?"
        className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12.5px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/50"
      />

      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      {sent && <p className="mt-2 text-[12px] text-neon">{sent}</p>}

      <Button
        className="mt-3.5 w-full gap-1.5 glow-primary"
        onClick={send}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {busy
          ? "Sending…"
          : mode === "everyone"
            ? `Send to all ${users.length}`
            : "Send message"}
      </Button>

      {history.length > 0 && (
        <div className="mt-6 border-t border-white/8 pt-4">
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Sent recently
          </h3>
          <ul className="mt-2.5 space-y-2">
            {history.slice(0, 12).map((message) => (
              <li
                key={message.id}
                className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12.5px] font-bold">
                    {message.title ?? "Message"}
                  </p>
                  <span className="text-[10.5px] text-muted-foreground">
                    {when(message.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[11.5px] text-muted-foreground">
                  {message.body}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                  {message.kind === "notice" ? "auto" : "to"} {message.userName}
                  {message.read ? " · read" : " · unread"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}
