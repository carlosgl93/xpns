// Animates a number from 0 to a target over a duration (default 700ms).
// Used by KPI cards for the "punch" of arriving on the dashboard.
// Respects prefers-reduced-motion: when the user prefers reduced motion,
// returns the final value immediately with no animation.

import { useEffect, useState } from 'preact/hooks';

const DEFAULT_DURATION_MS = 700;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(target: number, duration: number = DEFAULT_DURATION_MS): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    if (target <= 0 || duration <= 0) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let raf = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic: decelerate toward target
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return value;
}
