import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock3, Megaphone, XCircle } from "lucide-react";
import { Link } from "react-router";
import { useQuery } from "convex/react";

/**
 * The brand door inside the campaigns page.
 *
 * Creators come here to join campaigns; brands come here to ask for one. This
 * panel says which world you are in, shows where an existing request stands,
 * and takes a brand straight to the request form — no admin panel, no separate
 * product to learn.
 */
export function BrandRequestPanel() {
  const requests = useQuery(api.campaignRequests.mine);
  const latest = (requests ?? [])[0] ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.78 }}
      className="glass-panel relative overflow-hidden rounded-2xl p-5"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#7C3AED]/20" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">
              Running a brand?
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Campaigns are set up for you. Send the name, the description, the
              budget and your files, and an operator publishes it — or tells you
              why not.
            </p>

            {latest && (
              <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    latest.status === "approved"
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                      : latest.status === "declined"
                        ? "border-rose-500/35 bg-rose-500/10 text-rose-300"
                        : "border-amber-500/35 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {latest.status === "approved" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : latest.status === "declined" ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Clock3 className="h-3.5 w-3.5" />
                  )}
                  {latest.title}
                  {latest.status === "pending"
                    ? " · awaiting review"
                    : latest.status === "approved"
                      ? " · live"
                      : " · declined"}
                </span>
              </p>
            )}
          </div>
        </div>

        <Button asChild className="shrink-0 gap-1.5 glow-primary">
          <Link to="/dashboard/request">
            {latest ? "Open my request" : "Request a campaign"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </motion.section>
  );
}
