import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";

export type DataRow = {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "positive" | "warning" | "neutral";
};

const TONE_COLOR: Record<string, string> = {
  positive: theme.green,
  warning: theme.coffee,
  neutral: "rgba(255,255,255,0.92)",
};

// Splits "$2,340" / "420g left" / "+$180" / "2.1%" into
// prefix ("$" / "+$"), the numeric magnitude, and a trailing suffix.
const NUMERIC_RE = /^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/;

const AnimatedValue: React.FC<{ value: string; delayFrames: number }> = ({
  value,
  delayFrames,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;
  const match = value.match(NUMERIC_RE);

  if (!match) return <>{value}</>;

  const [, prefix, numStr, suffix] = match;
  const target = parseFloat(numStr.replace(/,/g, ""));
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;

  const progress = interpolate(local, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const current = target * progress;
  const formatted = current.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <>
      {prefix}
      {formatted}
      {suffix}
    </>
  );
};

const StatusDot: React.FC<{ color: string; delayFrames: number }> = ({
  color,
  delayFrames,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;

  const scale = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const glow = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        scale,
        marginRight: 10,
        boxShadow: `0 0 ${8 * glow}px ${color}`,
      }}
    />
  );
};

const Row: React.FC<{ row: DataRow; delayFrames: number }> = ({
  row,
  delayFrames,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;
  const isNumeric = NUMERIC_RE.test(row.value);
  const toneColor = row.tone ? TONE_COLOR[row.tone] : null;

  const opacity = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const translateX = interpolate(local, [0, 14], [-18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const valueColor = toneColor
    ? toneColor
    : row.accent
      ? "#ffffff"
      : "rgba(255,255,255,0.92)";

  return (
    <div
      style={{
        opacity,
        translate: `${translateX}px 0px`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 0",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: 26,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: 0.2,
        }}
      >
        {row.label}
      </span>
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 30,
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {!isNumeric && toneColor ? (
          <StatusDot color={toneColor} delayFrames={delayFrames + 4} />
        ) : null}
        <AnimatedValue value={row.value} delayFrames={delayFrames + 6} />
      </span>
    </div>
  );
};

export const DataPanel: React.FC<{
  eyebrow: string;
  rows: DataRow[];
  startFrame?: number;
}> = ({ eyebrow, rows, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const panelOpacity = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelScale = interpolate(local, [0, 20], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        opacity: panelOpacity,
        scale: panelScale,
        width: 780,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.14)",
        borderTop: `1px solid rgba(200,163,117,0.28)`,
        borderRadius: 22,
        padding: "34px 40px 14px",
        boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          marginBottom: 18,
        }}
      >
        {eyebrow}
      </div>
      {rows.map((row, i) => (
        <Row key={row.label} row={row} delayFrames={startFrame + 10 + i * 8} />
      ))}
    </div>
  );
};
