import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import { VignetteStage } from "../components/VignetteStage";
import {
  CountUp,
  FlipChip,
  LevelBar,
  PopBadge,
  ScreenRow,
  hexToRgba,
  lerpRgba,
} from "../screens/screenUi";
import { fontFamily, theme } from "../theme";
import { Seg, segValue } from "./camera";

/**
 * Reel 2 — "Your café is leaking money in 3 places." (The Kintsugi Cup)
 * One continuous take: a cutaway ceramic vessel of golden liquid (the
 * café's monthly profit) drains through three cracks. The camera dives
 * to each crack, names the leak, and Caflat.CORE seals it with a
 * kintsugi gold seam. Pull back: the whole cup laced with glowing gold,
 * the level climbs back, payoff + CTA.
 *
 * Hard rule learned from Reel 1: nothing animates off-screen. Every
 * reveal begins only after the camera has settled on it.
 */

export const REEL2_DURATION = 870; // 29s @ 30fps

/* ── world geometry ─────────────────────────────────────────── */

const WORLD_H = 4400;
// cutaway vessel: wall bands left 240–280 / right 800–840, interior 280–800
const INT_TOP = 350;
const INT_BOTTOM = 3520;
const surfaceY = (level: number) => INT_BOTTOM - level * (INT_BOTTOM - INT_TOP);

/* ── camera ─────────────────────────────────────────────────── */

const FOCUS_SEGS: Seg[] = [
  [0, 100, 950, 950],
  [100, 145, 950, 1610], // dive to leak 1
  [145, 330, 1610, 1610],
  [330, 375, 1610, 2250], // leak 2
  [375, 550, 2250, 2250],
  [550, 595, 2250, 2810], // leak 3
  [595, 700, 2810, 2810],
  [700, 780, 2810, 1935], // pull back — the kintsugi reveal
  [780, 870, 1935, 1935],
];

const SCALE_SEGS: Seg[] = [
  [0, 100, 1, 1.06], // hook breathes
  [100, 122, 1.06, 1.18],
  [122, 145, 1.18, 1.3],
  [145, 330, 1.3, 1.3],
  [330, 352, 1.3, 1.24], // ease out to travel…
  [352, 375, 1.24, 1.3], // …and back in on arrival
  [375, 550, 1.3, 1.3],
  [550, 572, 1.3, 1.24],
  [572, 595, 1.24, 1.3],
  [595, 700, 1.3, 1.3],
  [700, 780, 1.3, 0.42],
  [780, 870, 0.42, 0.42],
];

// subtle banking roll during each dive
const ROLL_SEGS: Seg[] = [
  [0, 100, 0, 0],
  [100, 122, 0, 1.2],
  [122, 145, 1.2, 0],
  [145, 330, 0, 0],
  [330, 352, 0, -1.2],
  [352, 375, -1.2, 0],
  [375, 550, 0, 0],
  [550, 572, 0, 1.0],
  [572, 595, 1.0, 0],
  [595, 870, 0, 0],
];

/* the liquid level IS the story: drains through the leaks, slows a
 * little after each seal, refills in the payoff */
const LEVEL_SEGS: Seg[] = [
  [0, 110, 0.72, 0.7],
  [110, 300, 0.7, 0.61],
  [300, 330, 0.61, 0.6],
  [330, 540, 0.6, 0.505],
  [540, 550, 0.505, 0.5],
  [550, 695, 0.5, 0.435],
  [695, 725, 0.435, 0.43],
  [725, 800, 0.43, 0.76],
  [800, 870, 0.76, 0.76],
];

/* ── cracks (hand-authored jagged polylines across the wall bands) ── */

type Pt = [number, number];

const CRACK_1: Pt[] = [
  [800, 1620],
  [814, 1638],
  [806, 1658],
  [822, 1676],
  [810, 1694],
  [826, 1712],
  [840, 1730],
];
const FORK_1: Pt[] = [
  [822, 1676],
  [838, 1686],
];

const CRACK_2: Pt[] = [
  [280, 2260],
  [266, 2278],
  [274, 2298],
  [258, 2316],
  [270, 2334],
  [254, 2352],
  [240, 2370],
];
const FORK_2: Pt[] = [
  [258, 2316],
  [242, 2326],
];

const CRACK_3: Pt[] = [
  [800, 2820],
  [816, 2836],
  [804, 2856],
  [824, 2878],
  [812, 2898],
  [828, 2914],
  [840, 2930],
];
const FORK_3: Pt[] = [
  [824, 2878],
  [840, 2888],
];

const toPath = (pts: Pt[]) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

/** point at eased fraction t along a polyline (for the seam's leading tip) */
const pointAlong = (pts: Pt[], t: number): Pt => {
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    lens.push(
      lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  const target = t * lens[lens.length - 1];
  for (let i = 1; i < pts.length; i++) {
    if (target <= lens[i]) {
      const f = (target - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return [
        pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
        pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
      ];
    }
  }
  return pts[pts.length - 1];
};

/* ── crack + kintsugi seam ──────────────────────────────────── */

const SEAL_DRAW = 45;

const KintsugiCrack: React.FC<{
  pts: Pt[];
  fork: Pt[];
  sealStart: number;
  dir: 1 | -1; // which side of the wall the crack exits (spark fan direction)
}> = ({ pts, fork, sealStart, dir }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [sealStart, sealStart + SEAL_DRAW], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // sealed seams keep breathing — precious, not static
  const shimmer =
    draw >= 1 ? 0.88 + 0.12 * Math.sin((frame - sealStart - SEAL_DRAW) / 9) : 1;
  const d = toPath(pts);
  const df = toPath(fork);
  const tip = pointAlong(pts, draw);

  return (
    <g>
      {/* the fissure itself: dark cut + faint inner-edge highlight */}
      <path d={d} stroke="#0d0a08" strokeWidth={5} fill="none" strokeLinejoin="round" />
      <path d={df} stroke="#0d0a08" strokeWidth={4} fill="none" />
      <path
        d={d}
        stroke="rgba(255,241,220,0.14)"
        strokeWidth={1.5}
        fill="none"
        style={{ translate: "1.5px 1.5px" }}
      />
      {/* kintsugi seam — three layered strokes drawn along the crack */}
      {draw > 0 && (
        <g opacity={shimmer}>
          <path
            d={d}
            stroke="rgba(200,163,117,0.20)"
            strokeWidth={15}
            strokeLinecap="round"
            fill="none"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - draw * 100}
          />
          <path
            d={d}
            stroke="#c8a375"
            strokeWidth={6.5}
            strokeLinecap="round"
            fill="none"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - draw * 100}
          />
          <path
            d={d}
            stroke="#f3d9a4"
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - draw * 100}
          />
          <path
            d={df}
            stroke="#c8a375"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            opacity={interpolate(draw, [0.5, 0.85], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
        </g>
      )}
      {/* bright welding tip riding the draw front */}
      {draw > 0 && draw < 1 && (
        <g>
          <circle cx={tip[0]} cy={tip[1]} r={14} fill="rgba(243,217,164,0.25)" />
          <circle cx={tip[0]} cy={tip[1]} r={6} fill="#fff4dd" />
        </g>
      )}
      {/* spark particles fanning off the weld */}
      {[0, 1, 2, 3, 4].map((k) => {
        const birth = sealStart + 5 + k * 8;
        const local = frame - birth;
        if (local < 0 || local > 16) return null;
        const t = local / 16;
        const origin = pointAlong(
          pts,
          interpolate(birth, [sealStart, sealStart + SEAL_DRAW], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          }),
        );
        return (
          <circle
            key={k}
            cx={origin[0] + dir * (8 + k * 5) * t}
            cy={origin[1] - 10 * t + 34 * t * t}
            r={3 * (1 - t)}
            fill="#f3d9a4"
            opacity={1 - t}
          />
        );
      })}
    </g>
  );
};

/* ── drips: deterministic droplet lanes, nothing pops ───────── */

const GRAV = 0.55;

const DripEmitter: React.FC<{
  exitX: number;
  exitY: number;
  dir: 1 | -1;
  firstBirth: number;
  lastBirth: number;
  period: number;
}> = ({ exitX, exitY, dir, firstBirth, lastBirth, period }) => {
  const frame = useCurrentFrame();
  const births: number[] = [];
  for (let b = firstBirth; b <= lastBirth; b += period) births.push(b);

  return (
    <g>
      {births.map((b) => {
        const local = frame - b;
        if (local < 0 || local > 46) return null;
        // swell at the crack lip (0–10), detach + fall (10–44), fade (36–44)
        const swell = interpolate(local, [0, 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
        const ft = Math.max(0, local - 10);
        const dy = GRAV * ft * ft;
        const stretch = interpolate(ft, [0, 22], [1, 1.28], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const fade = interpolate(local, [36, 44], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <g key={b} opacity={fade}>
            <g
              style={{
                translate: `${exitX + dir * 7}px ${exitY + dy}px`,
                scale: `${swell} ${swell * stretch}`,
              }}
            >
              <path
                d="M0,-11 C4,-5 6.5,-1 6.5,3.5 A6.5,6.5 0 1,1 -6.5,3.5 C-6.5,-1 -4,-5 0,-11"
                fill="#d9b06a"
                stroke="#8f6a35"
                strokeWidth={1}
              />
              <circle cx={-1.8} cy={2.5} r={1.8} fill="rgba(255,244,221,0.75)" />
            </g>
            {/* satellite specks, slightly behind and slower */}
            {ft > 3 && (
              <>
                <circle
                  cx={exitX + dir * 13}
                  cy={exitY + 0.42 * ft * ft}
                  r={2.2}
                  fill="#d9b06a"
                  opacity={0.7 * fade}
                />
                <circle
                  cx={exitX + dir * 3}
                  cy={exitY - 12 + 0.36 * ft * ft}
                  r={1.6}
                  fill="#c8a375"
                  opacity={0.55 * fade}
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};

/* ── leak panel (station-card family, always revealed on-screen) ── */

const LeakPanel: React.FC<{
  x: number;
  y: number;
  width?: number;
  revealAt: number;
  exitAt: number;
  eyebrow: string;
  children: React.ReactNode;
}> = ({ x, y, width = 540, revealAt, exitAt, eyebrow, children }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [revealAt, revealAt + 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // drift away as the camera departs — sealed leaks leave a clean cup
  const exit = interpolate(frame, [exitAt, exitAt + 26], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: x,
        width,
        opacity: reveal * exit,
        translate: `0px ${(1 - reveal) * 46 - (1 - exit) * 24}px`,
        scale: 0.94 + reveal * 0.06,
        background: "rgba(10,10,11,0.9)",
        border: "1.5px solid rgba(200,163,117,0.4)",
        borderRadius: 24,
        padding: "26px 34px 22px",
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 23,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: theme.coffee,
          marginBottom: 14,
        }}
      >
        {eyebrow}
      </div>
      {children}
    </div>
  );
};

/** thin gold leader line drawing from the crack toward its panel */
const LeaderLine: React.FC<{ pts: Pt[]; drawAt: number }> = ({ pts, drawAt }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [drawAt, drawAt + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  if (draw <= 0) return null;
  return (
    <path
      d={toPath(pts)}
      stroke="rgba(200,163,117,0.55)"
      strokeWidth={2.5}
      fill="none"
      pathLength={100}
      strokeDasharray={100}
      strokeDashoffset={100 - draw * 100}
    />
  );
};

/* ── margin bar for leak 2 (cost vs margin, both eased) ─────── */

const MarginBar: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const costW = interpolate(frame, [startFrame, startFrame + 30], [0, 62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const marginW = interpolate(
    frame,
    [startFrame + 22, startFrame + 50],
    [0, 38],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const labelIn = interpolate(frame, [startFrame + 30, startFrame + 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          height: 14,
          borderRadius: 7,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            width: `${costW}%`,
            background: theme.amber,
            borderRadius: "7px 0 0 7px",
          }}
        />
        <div style={{ width: `${marginW}%`, background: theme.coffee }} />
      </div>
      <div
        style={{
          opacity: labelIn,
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontFamily,
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: 1,
        }}
      >
        <span style={{ color: theme.amber }}>COST 62%</span>
        <span style={{ color: theme.coffee }}>MARGIN 38%</span>
      </div>
    </div>
  );
};

/* ── per-word rising text ───────────────────────────────────── */

const RiseWords: React.FC<{
  words: React.ReactNode[];
  startFrame: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  gap?: number;
  exitAt?: number;
}> = ({
  words,
  startFrame,
  fontSize = 74,
  fontWeight = 900,
  color = "#ffffff",
  gap = 5,
  exitAt,
}) => {
  const frame = useCurrentFrame();
  const exit =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt, exitAt + 24], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: fontSize * 0.3,
        opacity: exit,
        translate: `0px ${(1 - exit) * -24}px`,
      }}
    >
      {words.map((w, i) => {
        const t = interpolate(
          frame,
          [startFrame + i * gap, startFrame + i * gap + 22],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          },
        );
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily,
              fontWeight,
              fontSize,
              color,
              opacity: t,
              translate: `0px ${(1 - t) * 26}px`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/* ── the vessel + liquid (all SVG, no filters) ──────────────── */

const Vessel: React.FC<{ level: number }> = ({ level }) => {
  const frame = useCurrentFrame();
  const surf = surfaceY(level);

  // liquid surface: three incommensurate harmonics — never visibly loops
  const pts: string[] = [];
  for (let x = 280; x <= 800; x += 20) {
    const y =
      surf +
      7 * Math.sin(x / 105 + frame / 23) +
      4 * Math.sin(x / 61 - frame / 31) +
      2 * Math.sin(x / 34 + frame / 17);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  const surfacePath = `M${pts.join(" L")} L800,${INT_BOTTOM} L280,${INT_BOTTOM} Z`;
  const meniscus = `M${pts.join(" L")}`;

  return (
    <svg
      width={1080}
      height={WORLD_H}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <defs>
        <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9c98a" />
          <stop offset="35%" stopColor="#b98747" />
          <stop offset="100%" stopColor="#7a5526" />
        </linearGradient>
        <linearGradient id="spec" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,244,221,0)" />
          <stop offset="30%" stopColor="rgba(255,244,221,0.13)" />
          <stop offset="70%" stopColor="rgba(255,244,221,0.13)" />
          <stop offset="100%" stopColor="rgba(255,244,221,0)" />
        </linearGradient>
        <clipPath id="interior">
          <rect x={280} y={INT_TOP} width={520} height={INT_BOTTOM - INT_TOP} rx={20} />
        </clipPath>
      </defs>

      {/* warm key glow behind the vessel */}
      <ellipse cx={430} cy={950} rx={720} ry={950} fill="rgba(200,163,117,0.07)" />

      {/* interior (dark ceramic inside, the hook text's backdrop) */}
      <rect
        x={280}
        y={INT_TOP}
        width={520}
        height={INT_BOTTOM - INT_TOP}
        rx={20}
        fill="#17110d"
      />

      {/* the liquid, clipped to the interior */}
      <g clipPath="url(#interior)">
        <path d={surfacePath} fill="url(#liquid)" />
        <path d={meniscus} stroke="rgba(255,244,221,0.5)" strokeWidth={3} fill="none" />
        {/* drifting sheen on the surface */}
        <ellipse
          cx={540 + 34 * Math.sin(frame / 40)}
          cy={surf + 18}
          rx={150}
          ry={11}
          fill="rgba(255,244,221,0.10)"
        />
        {/* rising bubbles — fade in at depth, out near the surface */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const period = 110 + i * 7;
          const local = (frame + i * 37) % period;
          const t = local / period;
          const by = surf + 430 - t * 385;
          return (
            <circle
              key={i}
              cx={330 + i * 70 + 8 * Math.sin(frame / 25 + i)}
              cy={by}
              r={3 + (i % 3)}
              fill="none"
              stroke="rgba(255,244,221,0.4)"
              strokeWidth={1.5}
              opacity={Math.sin(Math.PI * t) * 0.5}
            />
          );
        })}
      </g>

      {/* wall bands */}
      <rect x={240} y={INT_TOP} width={40} height={INT_BOTTOM - INT_TOP + 40} fill="#2a2119" />
      <rect x={800} y={INT_TOP} width={40} height={INT_BOTTOM - INT_TOP + 40} fill="#2a2119" />
      <rect x={240} y={INT_BOTTOM} width={600} height={40} rx={18} fill="#2a2119" />
      <line x1={240} y1={INT_TOP} x2={240} y2={INT_BOTTOM + 20} stroke="rgba(200,163,117,0.5)" strokeWidth={2.5} />
      <line x1={840} y1={INT_TOP} x2={840} y2={INT_BOTTOM + 20} stroke="rgba(200,163,117,0.5)" strokeWidth={2.5} />

      {/* lip flares */}
      <path d="M228,300 L292,300 L284,350 L248,350 Z" fill="#33281e" />
      <path d="M788,300 L852,300 L844,350 L808,350 Z" fill="#33281e" />
      <line x1={228} y1={300} x2={292} y2={300} stroke="rgba(200,163,117,0.7)" strokeWidth={3} />
      <line x1={788} y1={300} x2={852} y2={300} stroke="rgba(200,163,117,0.7)" strokeWidth={3} />

      {/* glazed-ceramic speculars on the walls */}
      <rect x={253} y={430} width={9} height={2960} fill="url(#spec)" />
      <rect x={818} y={430} width={9} height={2960} fill="url(#spec)" />
    </svg>
  );
};

/* ── screen-space HUD: profit counter tied to the liquid level ── */

const Hud: React.FC<{ level: number }> = ({ level }) => {
  const frame = useCurrentFrame();
  const dollars = Math.round((8400 * level) / 0.72);
  const inT = interpolate(frame, [60, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const outT = interpolate(frame, [796, 818], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // number warms to gold as the refill lands
  const goldT = interpolate(frame, [725, 780], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const numColor = lerpRgba([255, 255, 255, 0.92], hexToRgba(theme.coffee, 1), goldT);

  return (
    <div
      style={{
        position: "absolute",
        top: 88,
        width: "100%",
        textAlign: "center",
        opacity: inT * outT,
        translate: `0px ${(1 - inT) * -18}px`,
      }}
    >
      {/* soft scrim so the counter stays legible over the bright liquid */}
      <div
        style={{
          position: "absolute",
          top: -34,
          left: "50%",
          translate: "-50% 0px",
          width: 520,
          height: 160,
          borderRadius: 80,
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(10,9,8,0.55) 0%, rgba(10,9,8,0) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          fontFamily,
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: 4,
          color: "rgba(255,255,255,0.42)",
          marginBottom: 6,
        }}
      >
        PROFIT THIS MONTH
      </div>
      <div
        style={{
          position: "relative",
          fontFamily,
          fontWeight: 900,
          fontSize: 54,
          color: numColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${dollars.toLocaleString("en-US")}
      </div>
    </div>
  );
};

/* ── payoff overlay + endcard ───────────────────────────────── */

const SealedOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const underline = interpolate(frame, [768, 800], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const exit = interpolate(frame, [804, 826], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        width: "100%",
        textAlign: "center",
        opacity: exit,
      }}
    >
      <RiseWords words={["Sealed."]} startFrame={748} fontSize={104} />
      <div
        style={{
          margin: "10px auto 26px",
          width: 230 * underline,
          height: 6,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${theme.coffee}, #f3d9a4, ${theme.coffee})`,
        }}
      />
      <RiseWords
        words={[
          <span key="b" style={{ color: theme.coffee }}>
            Caflat.CORE
          </span>,
          "finds",
          "every",
          "leak.",
        ]}
        startFrame={776}
        fontSize={42}
        fontWeight={700}
        color="rgba(255,255,255,0.88)"
      />
    </div>
  );
};

const MINI_SEAM: Pt[] = [
  [-74, 8],
  [-42, -6],
  [-12, 5],
  [18, -8],
  [46, 3],
  [74, -4],
];

const Endcard: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [800, 838], [1920, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const seamDraw = interpolate(frame, [838, 862], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const pill = interpolate(frame, [846, 864], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const site = interpolate(frame, [854, 870], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        translate: `0px ${rise}px`,
        background:
          "radial-gradient(90% 60% at 50% 42%, #1c140d 0%, #0b0908 70%)",
        justifyContent: "center",
        alignItems: "center",
        gap: 30,
      }}
    >
      {/* kintsugi flourish above the wordmark */}
      <svg width={160} height={26} viewBox="-80 -13 160 26">
        <path
          d={toPath(MINI_SEAM)}
          stroke="#c8a375"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - seamDraw * 100}
        />
      </svg>
      <div style={{ fontFamily, fontWeight: 900, fontSize: 72, color: "#ffffff" }}>
        Caflat<span style={{ color: theme.coffee }}>.CORE</span>
      </div>
      <div
        style={{
          scale: pill,
          fontFamily,
          fontWeight: 800,
          fontSize: 27,
          letterSpacing: 1.5,
          color: theme.coffee,
          border: `2.5px solid ${theme.coffee}`,
          borderRadius: 999,
          padding: "16px 42px",
        }}
      >
        Follow @caflat.core
      </div>
      <div
        style={{
          opacity: site,
          fontFamily,
          fontWeight: 600,
          fontSize: 24,
          letterSpacing: 3,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        caflat.co
      </div>
    </AbsoluteFill>
  );
};

/* ── SFX ────────────────────────────────────────────────────── */

type SfxEvent = { file: string; frame: number; volume: number };

const REEL2_SFX: SfxEvent[] = [
  { file: "drip", frame: 30, volume: 0.5 },
  { file: "drip", frame: 72, volume: 0.42 },
  { file: "alertf", frame: 158, volume: 0.5 },
  { file: "tickdown", frame: 216, volume: 0.45 },
  { file: "seal", frame: 255, volume: 0.55 },
  { file: "confirm", frame: 297, volume: 0.45 },
  { file: "drip", frame: 382, volume: 0.35 },
  { file: "alertf", frame: 386, volume: 0.5 },
  { file: "tickdown", frame: 440, volume: 0.45 },
  { file: "seal", frame: 495, volume: 0.55 },
  { file: "confirm", frame: 537, volume: 0.45 },
  { file: "drip", frame: 604, volume: 0.35 },
  { file: "alertf", frame: 608, volume: 0.5 },
  { file: "seal", frame: 655, volume: 0.55 },
  { file: "confirm", frame: 690, volume: 0.45 },
  { file: "tickup", frame: 730, volume: 0.5 },
  { file: "pop", frame: 848, volume: 0.4 },
];

/* ── the reel ───────────────────────────────────────────────── */

export const Reel2: React.FC = () => {
  const frame = useCurrentFrame();

  const focus = segValue(FOCUS_SEGS, frame);
  const S = segValue(SCALE_SEGS, frame);
  const roll = segValue(ROLL_SEGS, frame);
  const level = segValue(LEVEL_SEGS, frame);

  const tx = 540 - 540 * S;
  const ty = 960 - focus * S;

  return (
    <AbsoluteFill style={{ background: "#0b0908" }}>
      <VignetteStage lightY={26}>
        {/* camera roll wrapper (screen-centered) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            rotate: `${roll}deg`,
          }}
        >
          {/* the world */}
          <div
            style={{
              position: "absolute",
              width: 1080,
              height: WORLD_H,
              transform: `translate(${tx}px, ${ty}px) scale(${S})`,
              transformOrigin: "0 0",
            }}
          >
            <Vessel level={level} />

            {/* cracks + seams + drips (world SVG overlay) */}
            <svg
              width={1080}
              height={WORLD_H}
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              <KintsugiCrack pts={CRACK_1} fork={FORK_1} sealStart={255} dir={1} />
              <KintsugiCrack pts={CRACK_2} fork={FORK_2} sealStart={495} dir={-1} />
              <KintsugiCrack pts={CRACK_3} fork={FORK_3} sealStart={655} dir={1} />

              <DripEmitter exitX={846} exitY={1732} dir={1} firstBirth={20} lastBirth={271} period={34} />
              <DripEmitter exitX={234} exitY={2372} dir={-1} firstBirth={200} lastBirth={511} period={34} />
              <DripEmitter exitX={846} exitY={2932} dir={1} firstBirth={400} lastBirth={671} period={34} />

              <LeaderLine pts={[[800, 1660], [762, 1620], [740, 1620]]} drawAt={147} />
              <LeaderLine pts={[[280, 2300], [318, 2260], [340, 2260]]} drawAt={377} />
              <LeaderLine pts={[[800, 2860], [762, 2822], [740, 2822]]} drawAt={597} />
            </svg>

            {/* hook copy — inside the cup, above the crema */}
            <div style={{ position: "absolute", top: 520, width: 1080, padding: "0 60px" }}>
              <RiseWords
                words={["Your", "café", "is", "leaking", "money."]}
                startFrame={12}
                exitAt={96}
              />
            </div>
            <div style={{ position: "absolute", top: 700, width: 1080 }}>
              <RiseWords
                words={[
                  <span key="3" style={{ color: theme.coffee, fontSize: 110 }}>
                    3
                  </span>,
                  "places.",
                  "Right",
                  "now.",
                ]}
                startFrame={48}
                fontSize={62}
                exitAt={96}
              />
            </div>

            {/* leak panels — each revealed only after the camera settles */}
            <LeakPanel x={200} y={1300} revealAt={152} exitAt={330} eyebrow="Leak 01 — Expired stock">
              <Sequence from={150} layout="none">
                <LevelBar label="Flour — batch 03" fromPct={64} toPct={18} startFrame={44} low />
                <ScreenRow
                  label="Written off"
                  value={<CountUp prefix="−$" to={38} startFrame={66} suffix=" /wk" />}
                  valueColor={theme.red}
                  startFrame={62}
                />
                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <FlipChip before="NO ALERTS" after="EXPIRY ALERTS" flipFrame={145} />
                </div>
              </Sequence>
            </LeakPanel>

            <LeakPanel x={340} y={1940} revealAt={382} exitAt={550} eyebrow="Leak 02 — Priced by guesswork">
              <Sequence from={380} layout="none">
                <ScreenRow label="You charge" value="$3.00" startFrame={40} />
                <ScreenRow
                  label="True cost"
                  value={<CountUp prefix="$" to={1.87} decimals={2} startFrame={60} durationFrames={36} />}
                  valueColor={theme.amber}
                  startFrame={56}
                />
                <MarginBar startFrame={96} />
                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <FlipChip before="GUESSWORK" after="COSTED" flipFrame={155} />
                </div>
              </Sequence>
            </LeakPanel>

            <LeakPanel x={200} y={2560} revealAt={602} exitAt={700} eyebrow="Leak 03 — Untracked invoices">
              <Sequence from={600} layout="none">
                <ScreenRow
                  label="Sunrise Mills"
                  value="$245.00"
                  valueColor={theme.amber}
                  startFrame={36}
                />
                <div style={{ textAlign: "center", margin: "18px 0 20px" }}>
                  <PopBadge text="14 DAYS OVERDUE" color={theme.red} startFrame={50} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <FlipChip before="OVERDUE" after="PAID" flipFrame={88} />
                </div>
              </Sequence>
            </LeakPanel>
          </div>
        </div>

        {/* floating dust motes (screen space — parallax depth) */}
        <svg width={1080} height={1920} style={{ position: "absolute", top: 0, left: 0 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <circle
              key={i}
              cx={((i * 127) % 1080) + 24 * Math.sin(frame / (60 + i * 9) + i * 2)}
              cy={((i * 211 + 130) % 1920) + 16 * Math.cos(frame / (70 + i * 7) + i)}
              r={2 + (i % 3)}
              fill="#f3d9a4"
              opacity={0.05 + 0.03 * Math.sin(frame / 50 + i * 1.7)}
            />
          ))}
        </svg>

        <Hud level={level} />
        <SealedOverlay />
        <Endcard />
      </VignetteStage>

      {/* SFX */}
      {REEL2_SFX.map(({ file, frame: f, volume }, i) => (
        <Sequence key={`${file}-${i}`} from={f}>
          <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
