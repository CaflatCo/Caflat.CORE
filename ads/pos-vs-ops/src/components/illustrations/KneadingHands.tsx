import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

const KNEAD_PERIOD = 42;

const FlourPuff: React.FC<{ x: number; y: number; offset: number }> = ({
  x,
  y,
  offset,
}) => {
  const frame = useCurrentFrame();
  const t = ((frame + offset) % KNEAD_PERIOD) / KNEAD_PERIOD;
  const drift = 26 * t;
  const opacity = Math.sin(t * Math.PI) * 0.35;
  const scale = 0.6 + t * 0.9;

  return (
    <g
      opacity={opacity}
      transform={`translate(${x + (x > 500 ? drift : -drift)} ${y - drift * 0.7}) scale(${scale})`}
    >
      <circle r={11} fill={theme.cream} />
      <circle cx={14} cy={5} r={7} fill={theme.cream} />
      <circle cx={-13} cy={7} r={8} fill={theme.cream} />
    </g>
  );
};

export const KneadingHands: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const phase = (frame / KNEAD_PERIOD) * Math.PI * 2;
  // dough squashes when a hand presses
  const squash = Math.max(Math.sin(phase), Math.sin(phase + Math.PI)) * 0.5 + 0.5;
  const sx = 1 + squash * 0.14;
  const sy = 1 - squash * 0.14;

  const hand1Y = Math.max(0, Math.sin(phase)) * 34;
  const hand2Y = Math.max(0, Math.sin(phase + Math.PI)) * 34;

  return (
    <svg
      viewBox="0 0 1000 640"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <g opacity={enter} transform={`translate(0 ${(1 - enter) * 40})`}>
        {/* counter */}
        <rect x={0} y={520} width={1000} height={120} fill={theme.mocha} />
        <rect x={0} y={520} width={1000} height={10} fill={theme.caramel} opacity={0.6} />

        {/* flour dust on counter */}
        <ellipse cx={330} cy={528} rx={60} ry={7} fill={theme.cream} opacity={0.25} />
        <ellipse cx={680} cy={530} rx={80} ry={8} fill={theme.cream} opacity={0.2} />

        {/* flour puffs */}
        <FlourPuff x={360} y={470} offset={0} />
        <FlourPuff x={648} y={462} offset={21} />

        {/* dough — squash & stretch anchored to the counter */}
        <g transform={`translate(500 520) scale(${sx} ${sy})`}>
          <ellipse cx={0} cy={-72} rx={148} ry={86} fill={theme.cream} />
          <ellipse cx={-34} cy={-96} rx={62} ry={34} fill="#fff" opacity={0.35} />
          <ellipse cx={30} cy={-46} rx={70} ry={30} fill={theme.latte} opacity={0.5} />
        </g>

        {/* hands — alternate pressing */}
        <g transform={`translate(0 ${hand1Y})`}>
          <rect x={196} y={210} width={94} height={200} rx={46} fill={theme.caramel} />
          <ellipse cx={286} cy={402} rx={78} ry={54} fill={theme.latte} />
        </g>
        <g transform={`translate(0 ${hand2Y})`}>
          <rect x={706} y={200} width={94} height={200} rx={46} fill={theme.caramel} />
          <ellipse cx={710} cy={396} rx={78} ry={54} fill={theme.latte} />
        </g>
      </g>
    </svg>
  );
};
