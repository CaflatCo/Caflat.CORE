import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

/**
 * Two silhouette arms exchange a box of baked goods.
 * 0-25   left arm carries the box in from the left
 * 22-45  right arm reaches in from the right
 * 45-62  box transfers right with a little arc; left arm withdraws
 * 64+    gold check pops above the box
 */
export const SupplierHandoff: React.FC = () => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  const leftIn = interpolate(frame, [0, 25], [-380, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const leftOut = interpolate(frame, [46, 64], [0, -240], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const rightIn = interpolate(frame, [22, 45], [400, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  const transfer = interpolate(frame, [45, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const boxX = leftIn + transfer * 96;
  const boxDip = Math.sin(transfer * Math.PI) * -16;
  const boxTilt = Math.sin(transfer * Math.PI) * -3;

  const checkScale = interpolate(frame, [66, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  return (
    <svg
      viewBox="0 0 1000 640"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ground shadow */}
      <ellipse cx={500} cy={520} rx={280} ry={26} fill="#000" opacity={0.35} />

      {/* left arm (supplier) */}
      <g transform={`translate(${leftIn + leftOut} 0)`}>
        <rect x={-40} y={330} width={330} height={64} rx={32} fill={theme.caramel} />
        <circle cx={300} cy={362} r={40} fill={theme.cream} />
      </g>

      {/* right arm (café) */}
      <g transform={`translate(${rightIn} 0)`}>
        <rect x={700} y={370} width={340} height={64} rx={32} fill={theme.mocha} />
        <circle cx={700} cy={402} r={40} fill={theme.cream} />
      </g>

      {/* box of baked goods */}
      <g
        transform={`translate(${boxX + 330} ${300 + boxDip}) rotate(${boxTilt})`}
      >
        {/* bread bumps peeking out */}
        <circle cx={62} cy={-6} r={34} fill={theme.latte} />
        <circle cx={118} cy={-14} r={40} fill={theme.cream} />
        <circle cx={174} cy={-4} r={32} fill={theme.caramel} />
        {/* box */}
        <rect x={0} y={0} width={240} height={150} rx={12} fill={theme.latte} />
        <rect x={0} y={0} width={240} height={34} rx={12} fill={theme.caramel} />
        <rect x={104} y={0} width={32} height={150} fill={theme.caramel} opacity={0.55} />
      </g>

      {/* gold confirmation check */}
      <g
        transform={`translate(500 190) scale(${checkScale})`}
        opacity={checkScale}
      >
        <circle r={44} fill="none" stroke={theme.coffee} strokeWidth={5} />
        <path
          d="M-18,0 L-5,14 L20,-14"
          stroke={theme.coffee}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
};
