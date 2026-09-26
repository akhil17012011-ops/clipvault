import { ClipticLogo } from "@/components/ClipticMark";
import { motion } from "framer-motion";

/**
 * Shown while the app works out who (if anyone) is signed in.
 *
 * Without this the protected routes flash their "sign in to continue" gate and
 * then swap to the dashboard, which reads as a broken page rather than a page
 * that was still loading. The bar is indeterminate on purpose: we genuinely do
 * not know how long a cold Convex query will take, and a fake percentage would
 * be a lie that eventually stalls short of 100%.
 */
export function AppLoading({ label = "Loading CLIPTIC" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <ClipticLogo className="h-9" />
      </motion.div>

      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#4C1D95]"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.25 }}
        className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
      >
        {label}
      </motion.p>
    </div>
  );
}
