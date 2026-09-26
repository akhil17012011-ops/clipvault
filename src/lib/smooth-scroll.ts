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
    /* A touch lower than the usual 0.1 so the glide keeps gliding for longer
       and settles without the rubber-band snap at the end. */
    lerp: 0.085,
    smoothWheel: true,
    /* Momentum on touch devices so phones get the same glide as desktop. */
    syncTouch: true,
    syncTouchLerp: 0.07,
    touchMultiplier: 1.7,
    wheelMultiplier: 1,
    /* Exponential ease-out: fast pickup, very long tail. */
    easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
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
      duration: 1.35,
      /* Ease-out-expo rather than a linear ramp — it arrives and stops. */
      easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
