/**
 * Shared motion language for the Clip Vault console.
 *
 * Every transition in the app pulls its easing from here, so the whole product
 * accelerates and settles the same way: a long, soft expo-out that reads as
 * weighted rather than springy, plus one spring for the few cases that must
 * track a moving target (the active nav pill, drawers).
 */
import type { Transition, Variants } from "framer-motion";

/** House curve — quick departure, long settle. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Softer sibling of {@link EASE} for large surfaces. */
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

/** Spring for elements that follow something else (pills, drawers, toggles). */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 32,
  mass: 0.9,
};

/** Spring for the sidebar's shared-layout pill, which needs a little more life. */
export const SPRING_PILL: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

/** Page-to-page transition used by the dashboard section router. */
export const SECTION_TRANSITION: Transition = {
  duration: 0.62,
  ease: EASE,
};

/** Container that staggers its children in. */
export const stagger = (staggerChildren = 0.055, delayChildren = 0.02): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

/** A single grid cell / list row rising into place. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.66, ease: EASE },
  },
};

/** Scale-in for badges and chips. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 26 },
  },
};

/** Tap feedback that never feels like a bounce. */
export const press = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.18, ease: EASE },
} as const;
