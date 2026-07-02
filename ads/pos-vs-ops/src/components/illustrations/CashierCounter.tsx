import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

/**
 * Café supply run: items slide onto the counter, a card taps the
 * terminal, the terminal flashes and a receipt rises.
 * 0-30   items slide in (staggered)
 * 34-52  card hand enters and taps
 * 52+    terminal check + receipt prints
 */
export const CashierCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  const itemIn = (i: number) =>
    interpolate(frame, [4 + i * 8, 24 + i * 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });

  const handIn = interpolate(frame, [34, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const tap = interpolate(frame, [46, 50, 54], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const paid = frame >= 52;
  const receiptRise = interpolate(frame, [54, 76], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  return (
    <svg
      viewBox="0 0 1000 640"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* counter */}
      <rect x={0} y={470} width={1000} height={170} fill={theme.mocha} />
      <rect x={0} y={470} width={1000} height={12} fill={theme.caramel} opacity={0.6} />

      {/* flour sack */}
      <g
        opacity={itemIn(0)}
        transform={`translate(${(1 - itemIn(0)) * -220} 0)`}
      >
        <path
          d="M150,330 L280,330 L296,470 L134,470 Z"
          fill={theme.latte}
        />
        <rect x={168} y={306} width={94} height={36} rx={10} fill={theme.caramel} />
        <rect x={172} y={382} width={86} height={12} rx={6} fill={theme.mocha} opacity={0.5} />
      </g>

      {/* milk carton */}
      <g
        opacity={itemIn(1)}
        transform={`translate(${(1 - itemIn(1)) * -220} 0)`}
      >
        <path d="M340,338 L432,338 L420,306 L352,306 Z" fill={theme.caramel} />
        <rect x={340} y={338} width={92} height={132} fill={theme.cream} />
        <rect x={340} y={392} width={92} height={34} fill={theme.caramel} opacity={0.6} />
      </g>

      {/* bottle */}
      <g
        opacity={itemIn(2)}
        transform={`translate(${(1 - itemIn(2)) * -220} 0)`}
      >
        <rect x={488} y={300} width={20} height={40} rx={6} fill={theme.caramel} />
        <path
          d="M482,338 C468,362 464,382 464,404 L464,452 C464,462 472,470 482,470 L514,470 C524,470 532,462 532,452 L532,404 C532,382 528,362 514,338 Z"
          fill={theme.latte}
        />
        <rect x={472} y={396} width={52} height={44} rx={8} fill={theme.cream} opacity={0.8} />
      </g>

      {/* payment terminal */}
      <g>
        <rect x={690} y={330} width={150} height={140} rx={16} fill={theme.espresso2} stroke={theme.caramel} strokeWidth={4} />
        <rect
          x={712}
          y={352}
          width={106}
          height={62}
          rx={8}
          fill={paid ? "rgba(61,189,122,0.25)" : "#0d0d10"}
        />
        {paid ? (
          <path
            d="M746,384 L760,398 L786,368"
            stroke={theme.green}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <rect x={726} y={376} width={78} height={10} rx={5} fill={theme.caramel} opacity={0.5} />
        )}
        {/* receipt */}
        <g>
          <rect
            x={730}
            y={330 - receiptRise * 96}
            width={70}
            height={receiptRise * 96}
            fill={theme.cream}
          />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={740}
              y={330 - receiptRise * 96 + 14 + i * 22}
              width={50 - i * 12}
              height={7}
              rx={3}
              fill={theme.mocha}
              opacity={receiptRise > (i + 1) * 0.28 ? 0.5 : 0}
            />
          ))}
        </g>
      </g>

      {/* hand with gold card */}
      <g
        opacity={handIn}
        transform={`translate(${(1 - handIn) * 260} ${tap * 22})`}
      >
        <rect x={840} y={168} width={80} height={170} rx={40} fill={theme.caramel} />
        <ellipse cx={880} cy={334} rx={52} ry={40} fill={theme.latte} />
        <rect
          x={796}
          y={318}
          width={104}
          height={66}
          rx={10}
          fill={theme.coffee}
          transform="rotate(-14 848 351)"
        />
        <rect
          x={806}
          y={332}
          width={44}
          height={9}
          rx={4}
          fill={theme.espresso}
          opacity={0.5}
          transform="rotate(-14 848 351)"
        />
      </g>
    </svg>
  );
};
