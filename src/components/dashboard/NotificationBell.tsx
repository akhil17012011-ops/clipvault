import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useClipVault } from "@/lib/clip-vault-store";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Megaphone,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useMutation } from "convex/react";

function ago(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type Bucket = "Today" | "Yesterday" | "Earlier";

function bucketOf(ts: number): Bucket {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(new Date(ts))) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  return "Earlier";
}

const BUCKET_ORDER: Bucket[] = ["Today", "Yesterday", "Earlier"];

/**
 * The notification bell.
 *
 * The badge counts what has not been read yet, and reading is per row: the
 * panel opening does not wipe the badge, so a notice you have not looked at
 * survives an accidental click elsewhere. Each row can be marked read on
 * sight, marked all at once, or dismissed on the spot — and dismissal runs
 * row by row so one failure cannot strand the rest of the list.
 */
export function NotificationBell() {
  const { messages, unreadCount, markAllRead, markRead } = useClipVault();
  const { role } = useAuth();
  const removeMessage = useMutation(api.messages.remove);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      await removeMessage({ messageId: id as never });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    try {
      await markAllRead();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
    }
  };

  const clearAll = async () => {
    setClearing(true);
    /* One row at a time, so a single failure cannot strand the rest. */
    for (const message of messages) {
      try {
        await removeMessage({ messageId: message.id as never });
      } catch {
        /* keep going */
      }
    }
    setClearing(false);
  };

  const openRow = (message: (typeof messages)[number]) => {
    setOpen(false);
    if (!message.read) void markRead(message.id).catch(() => {});
    if (message.link) navigate(message.link);
  };

  /* Grouped, in a stable order — a bucket only shows when it has rows. The
     header and its rows are flattened into one list so the dividers stay
     interleaved with their own notifications as rows come and go. */
  const entries = BUCKET_ORDER.flatMap((bucket) => {
    const rows = messages.filter((m) => bucketOf(m.createdAt) === bucket);
    if (rows.length === 0) return [];
    return [
      { kind: "header" as const, key: `header-${bucket}`, bucket, message: null },
      ...rows.map((message) => ({
        kind: "row" as const,
        key: message.id,
        bucket,
        message,
      })),
    ];
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] transition-all duration-300 hover:border-brand/40 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-brand/35 dark:hover:bg-white/[0.09]"
        >
          <Bell className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-background"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="glass-panel w-[min(22rem,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
          <div>
            <p className="text-[13px] font-bold">Notifications</p>
            <p
              className={`text-[11px] ${unreadCount > 0 ? "font-semibold text-brand" : "text-muted-foreground"}`}
            >
              {messages.length === 0
                ? "Nothing here yet"
                : unreadCount > 0
                  ? `${unreadCount} new`
                  : "All caught up"}
            </p>
          </div>
          {messages.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => void markAll()}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={clearing}
                title="Clear all notifications"
                aria-label="Clear all notifications"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                onClick={() => void clearAll()}
              >
                {clearing ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-9 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-brand">
              <Bell className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[13px] font-semibold">
              You&apos;re all caught up
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Approvals, declines and anything Clip Vault sends you land here.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            <AnimatePresence initial={false}>
              {entries.map((entry) => {
                if (entry.kind === "header") {
                  return (
                    <motion.li
                      key={entry.key}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-4 pb-1 pt-2.5"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                        {entry.bucket}
                      </span>
                    </motion.li>
                  );
                }
                const message = entry.message;
                return (
                  <motion.li
                    key={entry.key}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={`group relative flex items-start gap-2.5 border-b border-white/[0.05] px-4 py-3 last:border-0 ${
                      message.read ? "" : "bg-brand/[0.05]"
                    }`}
                  >
                  {!message.read && (
                    <span
                      aria-hidden
                      className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand"
                    />
                  )}
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                      message.read
                        ? "border-brand/20 bg-brand/[0.06] text-brand/70"
                        : "border-brand/35 bg-brand/15 text-brand"
                    }`}
                  >
                    {message.kind === "admin" ? (
                      <Megaphone className="h-3.5 w-3.5" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => openRow(message)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={`truncate text-[12.5px] ${
                        message.read
                          ? "font-medium text-foreground/80"
                          : "font-bold"
                      }`}
                    >
                      {message.title ?? "Clip Vault"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                      {message.body}
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted-foreground/70">
                      {ago(message.createdAt)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void dismiss(message.id)}
                    disabled={busyId === message.id}
                    title="Delete notification"
                    aria-label="Delete notification"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCheck className="h-3.5 w-3.5" />
            {messages.length} total
          </span>
          {role === "admin" && (
            <Link
              to="/dashboard/messages"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-[#C9AEFF] hover:underline"
            >
              Message creators
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
