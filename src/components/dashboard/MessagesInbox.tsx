import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { MailOpen, MessageSquare, Sparkles } from "lucide-react";
import { fmtFull, type CreatorMessage } from "@/lib/cliptic-data";
import { useCliptic } from "@/lib/cliptic-store";

function when(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * The creator's inbox: system notices about their clips and direct messages
 * from CLIPTIC, newest first. Approval and rejection reasons arrive here, which
 * is why a declined clip always has something to read above it.
 */
export function MessagesInbox() {
  const { messages, markAllRead } = useCliptic();
  const unread = messages.filter((m) => !m.read).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-black/8 bg-card p-5 dark:border-white/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <MessageSquare className="h-4 w-4" />
          </span>
          <h2 className="text-[15px] font-bold tracking-tight">Messages</h2>
        </div>
        {unread > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void markAllRead()}
            className="gap-1.5"
          >
            <MailOpen className="h-3.5 w-3.5" />
            Mark {unread} read
          </Button>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-sm text-muted-foreground dark:border-white/15">
          Nothing here yet. Approvals, declines and anything CLIPTIC sends you
          will show up in this list.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {messages.map((message, i) => (
            <MessagesInboxRow key={message.id} message={message} index={i} />
          ))}
        </ul>
      )}
    </motion.section>
  );
}

function MessagesInboxRow({
  message,
  index,
}: {
  message: CreatorMessage;
  index: number;
}) {
  const isAdmin = message.kind === "admin";
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.05, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`rounded-xl border px-4 py-3 transition-colors ${
        message.read
          ? "border-black/8 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]"
          : "border-brand/35 bg-brand/[0.07]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
            isAdmin
              ? "bg-brand/15 text-brand"
              : "bg-black/[0.05] text-muted-foreground dark:bg-white/10"
          }`}
        >
          {isAdmin ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-bold tracking-tight">
              {message.title ?? "Message"}
            </p>
            <span className="text-[11px] text-muted-foreground">
              {when(message.createdAt)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-foreground/80">
            {message.body}
          </p>
          {message.link ? (
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {message.link}
            </p>
          ) : null}
        </div>
      </div>
    </motion.li>
  );
}
