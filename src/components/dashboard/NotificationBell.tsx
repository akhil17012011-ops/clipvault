import { Button } from "@/components/ui/button";
import { useClipVault } from "@/lib/clip-vault-store";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { Bell, MessageSquare } from "lucide-react";

/**
 * Unread badge and recent messages.
 *
 * The bell only ever links to the creator's own inbox, and clicking through
 * marks everything read, so the badge is a real to-do count rather than a
 * number that never goes away.
 */
export function NotificationBell() {
  const { messages, unreadCount, markAllRead } = useClipVault();
  const recent = messages.slice(0, 4);

  return (
    <Link
      to="/dashboard/messages"
      onClick={() => {
        if (unreadCount > 0) void markAllRead();
      }}
      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] transition-all duration-300 hover:border-brand/40 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-brand/35 dark:hover:bg-white/[0.09]"
      aria-label={
        unreadCount > 0
          ? `Messages, ${unreadCount} unread`
          : "Messages"
      }
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

      {recent.length > 0 && (
        /* A quiet, non-interactive peek. The bell is a link, so a dropdown menu
           here would swallow the navigation the label promises. */
        <span className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 hidden w-64 -translate-y-1/2 rounded-xl border border-black/10 bg-popover p-3 text-left opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100 lg:block dark:border-white/10">
          <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </span>
          {recent.map((message) => (
            <span key={message.id} className="block border-t border-black/5 py-1.5 first:border-0 dark:border-white/5">
              <span className="block truncate text-[12px] font-semibold text-foreground/90">
                {message.title ?? "Message"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {message.body}
              </span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}
