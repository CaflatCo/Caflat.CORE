import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

const WHEEL_R = 46;

const Wheel: React.FC<{ cx: number; rotation: number }> = ({
  cx,
  rotation,
}) => (
  <g transform={`translate(${cx} 470) rotate(${rotation})`}>
    <circle r={WHEEL_R} fill={theme.espresso2} stroke={theme.caramel} strokeWidth={8} />
    <circle r={8} fill={theme.caramel} />
    {[0, 45, 90, 135].map((a) => (
      <rect
        key={a}
        x={-3.5}
        y={-WHEEL_R + 10}
        width={7}
        height={2 * WHEEL_R - 20}
        rx={3}
        fill={theme.caramel}
        transform={`rotate(${a})`}
      />
    ))}
  </g>
);

const Steam: React.FC<{ x: number; y: number; offset: number }> = ({
  x,
  y,
  offset,
}) => {
  const frame = useCurrentFrame();
  const t = ((frame + offset) % 60) / 60;
  const opacity = Math.sin(t * Math.PI) * 0.45;
  return (
    <circle
      cx={x + Math.sin(t * Math.PI * 2) * 8}
      cy={y - 55 * t}
      r={9 + t * 9}
      fill={theme.cream}
      opacity={opacity}
    />
  );
};

export const CoffeeCartRide: React.FC = () => {
  const frame = useCurrentFrame();

  // cart rolls in from off-screen left and settles center
  const cartX = interpolate(frame, [0, 55], [-620, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.61, 0.36, 1),
  });
  const wheelRotation = (cartX / (2 * Math.PI * WHEEL_R)) * 360;
  const rolling = frame < 58;
  const bob = rolling ? Math.sin(frame / 3) * 2.5 : 0;

  // background parallax strips drift the opposite way while rolling
  const bgX = interpolate(frame, [0, 55], [140, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 0.61, 0.36, 1),
  });

  return (
    <svg
      viewBox="0 0 1000 640"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* distant awning + lamp silhouettes, parallax */}
      <g transform={`translate(${bgX} 0)`} opacity={0.28}>
        <rect x={80} y={240} width={14} height={230} fill={theme.caramel} />
        <circle cx={87} cy={228} r={26} fill={theme.caramel} />
        <rect x={700} y={210} width={240} height={36} rx={8} fill={theme.caramel} />
        <rect x={710} y={246} width={16} height={224} fill={theme.caramel} />
        <rect x={904} y={246} width={16} height={224} fill={theme.caramel} />
      </g>

      {/* ground */}
      <rect x={0} y={512} width={1000} height={128} fill="#120c07" />
      <rect x={0} y={512} width={1000} height={6} fill={theme.caramel} opacity={0.5} />

      <g transform={`translate(${cartX + 500 - 190} ${bob})`}>
        {/* ground shadow */}
        <ellipse cx={190} cy={520} rx={250} ry={20} fill="#000" opacity={0.4} />

        {/* awning */}
        <path d="M-20,170 L400,170 L370,110 L10,110 Z" fill={theme.caramel} />
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M${10 + i * 90 + (i % 2 === 0 ? 0 : 0)},110 L${100 + i * 90},110 L${105 + i * 90 + 10},170 L${5 + i * 90 + 10},170 Z`}
            fill={i % 2 === 0 ? theme.cream : theme.caramel}
            opacity={i % 2 === 0 ? 0.85 : 1}
          />
        ))}
        <rect x={0} y={168} width={380} height={10} rx={5} fill={theme.mocha} />
        {/* awning posts */}
        <rect x={14} y={178} width={12} height={130} fill={theme.mocha} />
        <rect x={354} y={178} width={12} height={130} fill={theme.mocha} />

        {/* espresso machine on top */}
        <rect x={120} y={230} width={140} height={78} rx={10} fill={theme.espresso2} stroke={theme.caramel} strokeWidth={4} />
        <rect x={148} y={288} width={18} height={22} fill={theme.caramel} />
        <Steam x={158} y={228} offset={0} />
        <Steam x={196} y={222} offset={26} />

        {/* cart body */}
        <rect x={0} y={306} width={380} height={150} rx={16} fill={theme.latte} />
        <rect x={22} y={330} width={336} height={102} rx={10} fill={theme.caramel} opacity={0.5} />
        {/* cup emblem on the side panel */}
        <g transform="translate(190 380)">
          <path d="M-30,-18 L30,-18 L23,18 C20,26 10,30 0,30 C-10,30 -20,26 -23,18 Z" fill={theme.cream} />
          <path d="M30,-12 C48,-10 50,8 34,14" stroke={theme.cream} strokeWidth={7} fill="none" strokeLinecap="round" />
        </g>

        {/* wheels */}
        <Wheel cx={86} rotation={wheelRotation} />
        <Wheel cx={296} rotation={wheelRotation} />

        {/* push handle */}
        <path
          d="M380,330 C430,326 448,360 442,392"
          stroke={theme.mocha}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
};
