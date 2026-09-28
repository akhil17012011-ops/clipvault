import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { TOUR_STEPS } from "@/lib/clip-vault-data";

/**
 * The first-run tour.
 *
 * Six steps in the order the work actually happens, each one taking the user to
 * the page it is about, so the tour ends with them already knowing where
 * everything is. It is skippable, it never reappears on its own, and it can be
 * replayed from the sidebar — being shown a walkthrough you have already seen is
 * worse than being shown none.
 */
export function DashboardTour({
  /** Lets anything outside the tour start it again. */
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const status = useQuery(api.onboarding.status);
  const complete = useMutation(api.onboarding.complete);
  const { role } = useAuth();
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  /* An operator has no campaign-request form — they have the queue that answers
     one — so their fifth step is the other half of the same job. */
  const steps = useMemo(
    () =>
      role === "admin"
        ? TOUR_STEPS.map((s) =>
            s.to === "/dashboard/request"
              ? {
                  ...s,
                  to: "/dashboard/requests",
                  kicker: "Step 5 · Brands",
                  title: "Answer the brands asking for a campaign",
                  body: "Every campaign a brand wants starts as a request: the description, the budget, the platforms and their files. Approving publishes it live at the numbers they gave; declining asks you for a reason, and the brand reads it.",
                }
              : s,
          )
        : TOUR_STEPS,
    [role],
  );
  const STEPS = steps;

  /* A brand that has never seen the tour is walked through it once. The
     "not started yet" state is a fact on the server, so there is nothing to
     guess at and no flash before the answer arrives. */
  useEffect(() => {
    if (status && status.completedAt === null) onOpenChange(true);
  }, [status, onOpenChange]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goTo = (index: number) => {
    setStep(index);
    if (STEPS[index].to !== location.pathname) navigate(STEPS[index].to);
  };

  const finish = async () => {
    await complete();
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          key="tour"
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-5 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2"
        >
          <div className="glass-panel overflow-hidden p-0">
            <div className="flex items-start gap-3.5 p-5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                {step === 0 ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <Compass className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#C9AEFF]">
                  {current.kicker}
                </p>
                <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.02em]">
                  {current.title}
                </h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {current.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void finish()}
                aria-label="Skip the tour"
                title="Skip the tour"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress: one dot per step, filled up to where you are. */}
            <div className="flex items-center gap-1.5 px-5">
              {STEPS.map((s, i) => (
                <button
                  key={s.to}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? "w-6 bg-[#A855F7]"
                      : i < step
                        ? "w-1.5 bg-[#A855F7]/50"
                        : "w-1.5 bg-white/15"
                  }`}
                />
              ))}
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {step + 1} / {STEPS.length}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2.5 border-t border-white/[0.07] px-5 py-3.5">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={step === 0}
                onClick={() => goTo(step - 1)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void finish()}>
                Skip tour
              </Button>
              {isLast ? (
                <Button
                  size="sm"
                  className="ml-auto gap-1.5 glow-primary"
                  onClick={() => void finish()}
                >
                  <Check className="h-3.5 w-3.5" />
                  Start clipping
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="ml-auto gap-1.5 glow-primary"
                  onClick={() => goTo(step + 1)}
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
