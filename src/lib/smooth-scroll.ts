import Lenis from "lenis";

let lenis: Lenis | null = null;

/**
 * Start inertia-based smooth scrolling (reflect.app-style easing) once per
 * page load. No-op when the user prefers reduced motion — the CSS
 * `scroll-behavior: smooth` fallback takes over there.
 */
export function ensureSmoothScroll() {
  if (lenis) return;
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  lenis = new Lenis({
    lerp: 0.12,
    smoothWheel: true,
    /* Momentum on touch devices so phones get the same glide as desktop. */
    syncTouch: true,
    syncTouchLerp: 0.085,
    touchMultiplier: 1.6,
    wheelMultiplier: 1.05,
  });
  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/** Jump to the top of the page (used on route changes). */
export function resetScroll() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

/** Smoothly glide to a section id — used by the sidebar nav and anchors. */
export function scrollToSection(id: string) {
  if (id === "top") {
    resetScroll();
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, {
      offset: -96,
      duration: 1.25,
      /* Ease-out-expo-ish glide rather than a linear ramp. */
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
