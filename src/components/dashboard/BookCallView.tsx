import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PhoneCall,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";

/** Status pill colours, keyed off the server's status union. */
const STATUS: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: {
    label: "Awaiting approval",
    icon: CalendarClock,
    className: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  approved: {
    label: "Confirmed",
    icon: CheckCircle2,
    className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  },
  declined: {
    label: "Declined",
    icon: XCircle,
    className: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  },
};

/** Slots are generated in UTC and shown in the reader's own timezone. */
function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fullLabel(ms: number): string {
  return `${dayLabel(ms)} at ${timeLabel(ms)}`;
}

/**
 * The brand's booking page: pick a 30-minute slot, say what the call is about,
 * and track whether it was approved.
 *
 * Requesting a slot is not booking it. The request lands in the operator's
 * console and the slot is only confirmed once an operator approves it, so this
 * screen always shows the decision rather than implying one.
 */
export function BookCallView() {
  const { user } = useAuth();
  const slots = useQuery(api.calls.availableSlots);
  const bookings = useQuery(api.calls.mine);
  const requestCall = useMutation(api.calls.requestCall);

  const [picked, setPicked] = useState<number | null>(null);
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  /* Group the flat slot list into days so the picker reads like a calendar. */
  const days = useMemo(() => {
    const grouped = new Map<number, number[]>();
    for (const ms of slots ?? []) {
      const d = new Date(ms);
      const key = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      ).getTime();
      const list = grouped.get(key) ?? [];
      list.push(ms);
      grouped.set(key, list);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [slots]);

  const open = (bookings ?? []).filter(
    (b) => b.status === "pending" || b.status === "approved",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (picked === null) {
      toast.error("Pick a time first.");
      return;
    }
    if (topic.trim().length < 3) {
      toast.error("Tell us what the call is about.");
      return;
    }
    setBusy(true);
    try {
      await requestCall({
        startsAt: picked,
        topic: topic.trim(),
        company: company.trim() || undefined,
        note: note.trim() || undefined,
      });
      setPicked(null);
      setTopic("");
      setNote("");
      toast.success("Request sent", {
        description:
          "An operator will confirm or decline it here — nothing is booked until then.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That didn't work. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel rounded-2xl p-5"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <PhoneCall className="h-4 w-4" />
          </span>
          <h2 className="text-[15px] font-bold tracking-tight">
            Book a 30-minute call
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Thirty minutes with the Clip Vault team to walk through your campaign:
          rate, guidelines, budget and which creators already fit your niche.
          Times are shown in your local timezone, and every call is 30 minutes.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Requests are confirmed by an operator — you will see the decision on
          this page and in{" "}
          <span className="text-foreground">Messages</span>.
        </p>
      </motion.section>

      {(bookings ?? []).length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel rounded-2xl p-5"
        >
          <h3 className="text-[15px] font-bold tracking-tight">
            Your call requests
          </h3>
          <ul className="mt-4 space-y-3">
            {(bookings ?? []).map((b) => {
              const meta = STATUS[b.status] ?? STATUS.pending;
              const Icon = meta.icon;
              return (
                <li
                  key={b.id}
                  className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {fullLabel(b.startsAt)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {b.topic}
                    {b.company ? ` · ${b.company}` : ""}
                  </p>
                  {b.status === "declined" && b.reason && (
                    <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2 text-xs leading-relaxed text-rose-200">
                      {b.reason} Pick another slot below and we'll confirm it
                      there.
                    </p>
                  )}
                  {b.status === "approved" && (
                    <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2 text-xs leading-relaxed text-emerald-200">
                      Confirmed. We'll send the joining link before the call.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold tracking-tight">
            Available times
          </h3>
          <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            30 min · {slots?.length ?? 0} open
          </span>
        </div>

        {slots === undefined ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading availability…
          </p>
        ) : days.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-black/12 px-4 py-8 text-center text-sm text-muted-foreground dark:border-white/15">
            No slots are open right now. Message us on Discord and we'll find a
            time.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {days.map(([day, list]) => (
              <div key={day}>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {dayLabel(list[0])}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.map((ms) => {
                    const active = picked === ms;
                    return (
                      <button
                        key={ms}
                        type="button"
                        onClick={() => setPicked(active ? null : ms)}
                        className={`glass-chip rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "border-brand/60 bg-brand/20 text-[#E4D6FF]"
                            : "text-muted-foreground hover:text-[#C9AEFF]"
                        }`}
                      >
                        {timeLabel(ms)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-3 border-t border-white/[0.07] pt-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {picked === null
              ? "Pick a time to continue"
              : `Requesting ${fullLabel(picked)}`}
          </p>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company or brand name (optional)"
            maxLength={120}
          />
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should we cover? e.g. launching a skincare campaign"
            maxLength={200}
            required
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything we should read first — links, budget, target platforms (optional)"
            maxLength={1000}
            className="min-h-24 resize-y"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={busy || open.length > 0 || picked === null}
              className="liquid glow-primary bg-gradient-to-b from-[#A855F7] to-[#8B3FE2]"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarCheck className="mr-2 h-4 w-4" />
              )}
              Request this time
            </Button>
            <span className="text-xs text-muted-foreground">
              {open.length > 0
                ? "You already have a request in the works — we'll confirm it above."
                : `Sending as ${user?.email ?? "your account"}.`}
            </span>
          </div>
        </form>
      </motion.section>
    </div>
  );
}
