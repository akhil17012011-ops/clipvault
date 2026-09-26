import {
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

/**
 * Pointer-driven 3D tilt for cards: the element rotates toward the cursor on
 * the X/Y axes (spring-smoothed) and carries a violet specular glare that
 * follows the pointer — iOS-style depth on hover.
 *
 * Spread the returned `style` on a motion.* element, the handlers on its
 * interactive root, and render `glare` as an overlay span.
 */
export function useTilt(max = 7) {
  const px = useMotionValue(50);
  const py = useMotionValue(50);
  /* HIG: Reduce Motion drops morphing/refraction animation entirely. */
  const reduceMotion = useReducedMotion();

  const rotateX = useSpring(useTransform(py, [0, 100], [max, -max]), {
    stiffness: 190,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(px, [0, 100], [-max, max]), {
    stiffness: 190,
    damping: 20,
  });

  const glare = useMotionTemplate`radial-gradient(340px circle at ${px}% ${py}%, rgb(124 92 255 / 0.16), transparent 62%)`;

  const onMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const rect = event.currentTarget.getBoundingClientRect();
      px.set(((event.clientX - rect.left) / rect.width) * 100);
      py.set(((event.clientY - rect.top) / rect.height) * 100);
    },
    [px, py, reduceMotion],
  );

  const onMouseLeave = useCallback(() => {
    px.set(50);
    py.set(50);
  }, [px, py]);

  return {
    style: reduceMotion
      ? {}
      : { rotateX, rotateY, transformPerspective: 1000 },
    glare: reduceMotion ? undefined : glare,
    onMouseMove,
    onMouseLeave,
  };
}
