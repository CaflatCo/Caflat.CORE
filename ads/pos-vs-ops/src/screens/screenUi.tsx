import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";

/** rgba(...) string interpolated continuously between two hex colors —
 * used everywhere a "state A" → "state B" color needs to happen over
 * time instead of snapping at a threshold frame. */
type RGBA = [number, number, number, number];
export const hexToRgba = (hex: string, alpha = 1): RGBA => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
};
export const lerpRgba = (a: RGBA, b: RGBA, t: number): string => {
  const r = a[0] + (b[0] - a[0]) * t;
  const g = a[1] + (b[1] - a[1]) * t;
  const bch = a[2] + (b[2] - a[2]) * t;
  const al = a[3] + (b[3] - a[3]) * t;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bch)}, ${al.toFixed(3)})`;
};

/** Animated count-up for "$1,240"-style strings. */
export const CountUp: React.FC<{
  from?: number;
  to: number;
  startFrame: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}> = ({
  from = 0,
  to,
  startFrame,
  durationFrames = 24,
  prefix = "",
  suffix = "",
  decimals = 0,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const value = from + (to - from) * progress;
  return (
    <>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      fontFamily,
      fontWeight: 600,
      fontSize: 17,
      letterSpacing: 3,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.4)",
      marginBottom: 16,
    }}
  >
    {children}
  </div>
);

/** A row that slides in from the left at `startFrame`. */
export const ScreenRow: React.FC<{
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  startFrame: number;
}> = ({ label, value, valueColor = "rgba(255,255,255,0.92)", startFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const opacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tx = interpolate(local, [0, 12], [-16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        opacity,
        translate: `${tx}px 0px`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "17px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: 24,
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 27,
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
};

/** Pill chip whose text+color flips at `flipFrame` (e.g. Pending → Delivered).
 * Everything — text, color, border, background, scale — is a continuous
 * function of frame; nothing toggles on a boolean threshold. */
export const FlipChip: React.FC<{
  before: string;
  after: string;
  flipFrame: number;
  afterColor?: string;
}> = ({ before, after, flipFrame, afterColor = theme.green }) => {
  const frame = useCurrentFrame();
  // Easing.out fronts most of its motion in the first third of the window —
  // still reads as a fast pop. inOut ramps up and back down symmetrically,
  // so there's no instant burst right at the trigger frame.
  const FLIP_LEN = 30;
  const t = interpolate(frame, [flipFrame, flipFrame + FLIP_LEN], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // continuous bounce that is exactly 1 at t=0 and t=1, peaks mid-flip —
  // never jumps, unlike a boolean-gated scale.
  const scale = 1 + Math.sin(t * Math.PI) * 0.14;

  const textColor = lerpRgba(
    [255, 255, 255, 0.55],
    hexToRgba(afterColor, 1),
    t,
  );
  const borderColor = lerpRgba(
    [255, 255, 255, 0.25],
    hexToRgba(afterColor, 1),
    t,
  );
  const bgColor = lerpRgba([0, 0, 0, 0], hexToRgba(afterColor, 0.12), t);
  // true dissolve — both labels overlap and always sum to 1, so there
  // is never a blank frame between them.
  const beforeOpacity = 1 - t;
  const afterOpacity = t;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        scale,
        fontFamily,
        fontWeight: 700,
        fontSize: 19,
        letterSpacing: 1,
        padding: "8px 20px",
        minWidth: 168,
        borderRadius: 999,
        color: textColor,
        border: `2px solid ${borderColor}`,
        background: bgColor,
      }}
    >
      <span style={{ opacity: beforeOpacity, position: afterOpacity > 0 ? "absolute" : "static" }}>
        {before}
      </span>
      <span style={{ opacity: afterOpacity, position: beforeOpacity > 0 ? "absolute" : "static" }}>
        {after} ✓
      </span>
    </span>
  );
};

/** Horizontal level bar that animates from one fill to another. */
export const LevelBar: React.FC<{
  label: string;
  fromPct: number;
  toPct: number;
  startFrame: number;
  low?: boolean;
}> = ({ label, fromPct, toPct, startFrame, low }) => {
  const frame = useCurrentFrame();
  const pct = interpolate(
    frame,
    [startFrame, startFrame + 26],
    [fromPct, toPct],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // ramps to amber continuously as the bar finishes draining, instead
  // of snapping color the instant a "settled" threshold is crossed.
  const amberT = low
    ? interpolate(frame, [startFrame + 14, startFrame + 26], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const barColor = lerpRgba([255, 255, 255, 0.85], hexToRgba(theme.amber, 1), amberT);

  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 21,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily,
            fontWeight: 800,
            fontSize: 21,
            color: barColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(pct)}%
        </span>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 6,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 6,
            background: barColor,
          }}
        />
      </div>
    </div>
  );
};

/** Small badge that pops in with a bounce. */
export const PopBadge: React.FC<{
  text: string;
  color: string;
  startFrame: number;
}> = ({ text, color, startFrame }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  return (
    <div
      style={{
        scale,
        display: "inline-block",
        fontFamily,
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: 1.5,
        padding: "10px 24px",
        borderRadius: 999,
        color,
        border: `2px solid ${color}`,
        background: `${color}1f`,
      }}
    >
      {text}
    </div>
  );
};
