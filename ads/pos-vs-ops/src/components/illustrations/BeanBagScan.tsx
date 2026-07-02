import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme, fontFamily } from "../../theme";

const CHIPS = ["ORIGIN", "FARMER", "PROCESS", "HARVEST"];

export const BeanBagScan: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // scan beam sweeps down the bag once
  const beamT = interpolate(frame, [28, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const beamY = 150 + beamT * 360;
  const beamOpacity =
    frame >= 28 && frame <= 66 ? Math.sin(beamT * Math.PI) * 0.9 : 0;

  return (
    <svg
      viewBox="0 0 800 640"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <g opacity={enter} transform={`translate(0 ${(1 - enter) * 40})`}>
        {/* ground shadow */}
        <ellipse cx={400} cy={556} rx={190} ry={22} fill="#000" opacity={0.35} />

        {/* bag */}
        <path
          d="M258,190 L542,190 L556,530 C556,548 542,556 524,556 L276,556 C258,556 244,548 244,530 Z"
          fill={theme.mocha}
        />
        {/* crimped fold at the top */}
        <rect x={244} y={150} width={312} height={52} rx={10} fill={theme.caramel} />
        <path d="M244,176 L556,176" stroke={theme.espresso} strokeWidth={3} opacity={0.4} />

        {/* label */}
        <rect x={296} y={252} width={208} height={214} rx={12} fill={theme.cream} />
        {/* bean glyph */}
        <g transform="translate(400 300)">
          <ellipse rx={26} ry={34} fill={theme.mocha} transform="rotate(-18)" />
          <path
            d="M-8,-26 C6,-10 -6,12 8,26"
            stroke={theme.cream}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            transform="rotate(-18)"
          />
        </g>
        {/* label text lines */}
        <rect x={324} y={352} width={152} height={10} rx={5} fill={theme.mocha} opacity={0.7} />
        <rect x={338} y={374} width={124} height={8} rx={4} fill={theme.mocha} opacity={0.45} />
        {/* QR square */}
        <g transform="translate(376 400)">
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) =>
              (r + c) % 2 === 0 ? (
                <rect
                  key={`${r}${c}`}
                  x={c * 17}
                  y={r * 17}
                  width={14}
                  height={14}
                  fill={theme.mocha}
                />
              ) : null,
            ),
          )}
        </g>

        {/* scan beam */}
        <g opacity={beamOpacity}>
          <rect x={230} y={beamY - 4} width={340} height={8} fill={theme.coffee} />
          <rect
            x={230}
            y={beamY - 30}
            width={340}
            height={56}
            fill={theme.coffee}
            opacity={0.18}
          />
        </g>

        {/* extracted data chips */}
        {CHIPS.map((chip, i) => {
          const chipIn = interpolate(
            frame,
            [46 + i * 7, 60 + i * 7],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            },
          );
          const y = 200 + i * 64;
          return (
            <g
              key={chip}
              opacity={chipIn}
              transform={`translate(${600 - (1 - chipIn) * 40} ${y})`}
            >
              <rect
                width={158}
                height={46}
                rx={23}
                fill="rgba(200,163,117,0.12)"
                stroke={theme.coffee}
                strokeWidth={2}
              />
              <text
                x={79}
                y={30}
                textAnchor="middle"
                fill={theme.coffee}
                fontFamily={fontFamily}
                fontSize={19}
                fontWeight={700}
                letterSpacing={2.5}
              >
                {chip}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
