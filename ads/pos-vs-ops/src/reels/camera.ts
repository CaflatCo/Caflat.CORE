import { Easing } from "remotion";

/** [frameStart, frameEnd, valueStart, valueEnd] */
export type Seg = [number, number, number, number];

/** Piecewise value over frames; each segment eases inOut(cubic) so joins
 * always land with zero velocity — no kinks, no snaps. */
export const segValue = (segs: Seg[], frame: number): number => {
  for (const [f0, f1, v0, v1] of segs) {
    if (frame < f1) {
      if (frame <= f0) return v0;
      const t = Easing.inOut(Easing.cubic)((frame - f0) / (f1 - f0));
      return v0 + (v1 - v0) * t;
    }
  }
  return segs[segs.length - 1][3];
};
