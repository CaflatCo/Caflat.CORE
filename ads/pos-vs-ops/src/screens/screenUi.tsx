import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";

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

/** Pill chip whose text+color flips at `flipFrame` (e.g. Pending → Delivered). */
export const FlipChip: React.FC<{
  before: string;
  after: string;
  flipFrame: number;
  afterColor?: string;
}> = ({ before, after, flipFrame, afterColor = theme.green }) => {
  const frame = useCurrentFrame();
  const flipped = frame >= flipFrame;
  const pop = interpolate(frame, [flipFrame, flipFrame + 10], [1.25, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  return (
    <span
      style={{
        display: "inline-block",
        scale: flipped ? pop : 1,
        fontFamily,
        fontWeight: 700,
        fontSize: 19,
        letterSpacing: 1,
        padding: "8px 20px",
        borderRadius: 999,
        color: flipped ? afterColor : "rgba(255,255,255,0.55)",
        border: `2px solid ${flipped ? afterColor : "rgba(255,255,255,0.25)"}`,
        background: flipped ? `${afterColor}1f` : "transparent",
      }}
    >
      {flipped ? `${after} ✓` : before}
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
  const settled = frame >= startFrame + 22;
  const barColor = low && settled ? theme.amber : "rgba(255,255,255,0.85)";

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
