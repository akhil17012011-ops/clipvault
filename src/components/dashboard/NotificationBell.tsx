import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Megaphone,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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

/**
 * The notification bell.
 *
 * Notifications are not a page you have to remember to visit: the badge is the
 * count, the panel is the list, and each one can be dismissed on the spot. A
 * notification you have dealt with should stop being in the way, so there is a
 * delete on every row and a "mark all read" that only clears the badge.
 */
export function NotificationBell() {
  const { messages, unreadCount, markAllRead } = useClipVault();
  const { role } = useAuth();
  const removeMessage = useMutation(api.messages.remove);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();

  /* Opening the panel is the read receipt. */
  useEffect(() => {
    if (open && unreadCount > 0) void markAllRead();
  }, [open, unreadCount, markAllRead]);

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
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-background"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
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
            <p className="text-[11px] text-muted-foreground">
              {messages.length === 0
                ? "Nothing here yet"
                : unreadCount > 0
                  ? `${unreadCount} unread`
                  : "All caught up"}
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={async () => {
                /* Cleared one row at a time, so a single failure cannot strand
                   the rest of the list. */
                for (const message of messages) {
                  try {
                    await removeMessage({ messageId: message.id as never });
                  } catch {
                    /* keep going */
                  }
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>

        {messages.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Approvals, declines and anything Clip Vault sends you land here.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {messages.map((message) => (
              <li
                key={message.id}
                className="group flex items-start gap-2.5 border-b border-white/[0.05] px-4 py-3 last:border-0"
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                  {message.kind === "admin" ? (
                    <Megaphone className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (message.link) navigate(message.link);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[12.5px] font-semibold">
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
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCheck className="h-3.5 w-3.5" />
            Opening clears the badge
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
