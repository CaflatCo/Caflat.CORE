import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

const Wisp: React.FC<{ x: number; period: number; offset: number }> = ({
  x,
  period,
  offset,
}) => {
  const frame = useCurrentFrame();
  const t = ((frame + offset) % period) / period;
  const rise = -110 * t;
  const sway = Math.sin(t * Math.PI * 2) * 10;
  const opacity = Math.sin(t * Math.PI) * 0.4;

  return (
    <path
      d={`M${x},300 C${x - 14},270 ${x + 14},240 ${x},210 C${x - 12},185 ${x + 10},165 ${x},140`}
      stroke={theme.cream}
      strokeWidth={7}
      strokeLinecap="round"
      fill="none"
      opacity={opacity}
      transform={`translate(${sway} ${rise})`}
    />
  );
};

export const EspressoCup: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const bob = Math.sin(frame / 26) * 3;

  return (
    <svg
      viewBox="0 0 800 600"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <g
        opacity={enter}
        transform={`translate(0 ${(1 - enter) * 44 + bob})`}
      >
        {/* steam */}
        <Wisp x={360} period={86} offset={0} />
        <Wisp x={405} period={72} offset={30} />
        <Wisp x={445} period={94} offset={55} />

        {/* saucer */}
        <ellipse cx={400} cy={492} rx={205} ry={30} fill={theme.mocha} />
        <ellipse cx={400} cy={486} rx={205} ry={30} fill={theme.caramel} />
        <ellipse cx={400} cy={486} rx={150} ry={20} fill={theme.mocha} />

        {/* handle */}
        <path
          d="M530,352 C600,356 608,420 560,448 C540,460 520,458 512,452"
          stroke={theme.latte}
          strokeWidth={26}
          strokeLinecap="round"
          fill="none"
        />

        {/* cup body */}
        <path
          d="M272,330 L528,330 L502,452 C495,478 460,492 400,492 C340,492 305,478 298,452 Z"
          fill={theme.latte}
        />
        <path
          d="M272,330 L528,330 L520,372 L280,372 Z"
          fill={theme.cream}
          opacity={0.25}
        />

        {/* coffee surface + crema */}
        <ellipse cx={400} cy={330} rx={128} ry={24} fill={theme.espresso2} />
        <ellipse cx={400} cy={328} rx={128} ry={24} fill="#2e1d10" />
        <ellipse cx={400} cy={328} rx={96} ry={16} fill={theme.caramel} opacity={0.85} />
        <ellipse cx={378} cy={325} rx={34} ry={7} fill={theme.latte} opacity={0.7} />
      </g>
    </svg>
  );
};
