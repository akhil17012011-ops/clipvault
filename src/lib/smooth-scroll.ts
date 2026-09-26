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
  lenis = new Lenis({ lerp: 0.108, smoothWheel: true });
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
    lenis.scrollTo(el, { offset: -96, duration: 1.15 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
