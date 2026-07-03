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
import {
  TransitionSeries,
  springTiming,
} from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { VignetteStage } from "../components/VignetteStage";
import { EspressoCup } from "../components/illustrations/EspressoCup";
import {
  CountUp,
  FlipChip,
  LevelBar,
  PopBadge,
  ScreenRow,
} from "../screens/screenUi";
import { CinematicBackground } from "../components/CinematicBackground";
import { fontFamily, theme } from "../theme";
import { Seg, segValue } from "./camera";

/**
 * Reel 1 (redo) — "One sale. Watch what it triggers."
 * A chain-reaction one-take: a gold fuse carries a spark from a single
 * coffee sale down through inventory → alert → supplier → ledger,
 * then the camera pulls back to reveal the whole machine and swallows
 * it into a tablet. No mid-video cuts.
 */

/* ── world geometry ─────────────────────────────────────────── */

const WORLD_H = 4810;
const CUP_Y = 700; // cup center
const ST_Y = [1750, 2450, 3150, 3850]; // station centers
const FUSE_TOP = 860; // fuse starts under the cup

/* camera focus (world y that sits at screen center) + zoom */

const FOCUS_SEGS: Seg[] = [
  [0, 75, 960, 960], // hook hold
  [75, 115, 960, ST_Y[0]],
  [115, 165, ST_Y[0], ST_Y[0]], // dwell 1
  [165, 205, ST_Y[0], ST_Y[1]],
  [205, 255, ST_Y[1], ST_Y[1]], // dwell 2
  [255, 295, ST_Y[1], ST_Y[2]],
  [295, 345, ST_Y[2], ST_Y[2]], // dwell 3
  [345, 385, ST_Y[2], ST_Y[3]],
  [385, 445, ST_Y[3], ST_Y[3]], // dwell 4
  [445, 545, ST_Y[3], 2405], // pull back to world middle
  [545, 660, 2405, 2405],
];

const SCALE_SEGS: Seg[] = [
  [0, 445, 1, 1],
  [445, 545, 1, 0.4],
  [545, 605, 0.4, 0.33],
  [605, 660, 0.33, 0.33],
];

const CHAIN_DUR = 660;
const PAYOFF_DUR = 170;
const T_SLIDE = 22;
export const REEL1_DURATION = CHAIN_DUR + PAYOFF_DUR - T_SLIDE; // 808

/* ── shared card shell for stations ─────────────────────────── */

const StationCard: React.FC<{
  y: number;
  label: string;
  revealAt: number;
  children: React.ReactNode;
}> = ({ y, label, revealAt, children }) => {
  const frame = useCurrentFrame();
  // Easing.out fronts most of its motion in the first third of the window —
  // still reads as a fast pop. inOut ramps up and back down symmetrically,
  // so there's no instant burst right at the trigger frame.
  const reveal = interpolate(frame, [revealAt, revealAt + 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // During the pull-back every card is on screen at once — large blur
  // shadows there make 4K software rasterization catastrophically slow.
  // Fade the shadow's alpha out over a window instead of an instant cut.
  const shadowAlpha = interpolate(frame, [415, 440], [0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
  <div
    style={{
      position: "absolute",
      top: y - 330,
      left: 120,
      width: 840,
      opacity: reveal,
      translate: `0px ${(1 - reveal) * 60}px`,
      scale: 0.92 + reveal * 0.08,
      background: "rgba(10,10,11,0.88)",
      border: "1.5px solid rgba(200,163,117,0.4)",
      borderRadius: 24,
      padding: "30px 40px 24px",
      boxShadow: `0 40px 90px rgba(0,0,0,${shadowAlpha.toFixed(3)})`,
    }}
  >
    <div
      style={{
        fontFamily,
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: 5,
        textTransform: "uppercase",
        color: theme.coffee,
        marginBottom: 20,
      }}
    >
      {label}
    </div>
    {children}
  </div>
  );
};

/* ── stations ───────────────────────────────────────────────── */

const InventoryStation: React.FC = () => (
  <div>
    <LevelBar label="Beans" fromPct={57} toPct={51} startFrame={0} />
    <LevelBar label="Milk" fromPct={64} toPct={58} startFrame={6} />
    <LevelBar label="Flour" fromPct={22} toPct={12} startFrame={12} low />
    <div style={{ textAlign: "center", marginTop: 10 }}>
      <PopBadge text="INGREDIENTS DEDUCTED" color={theme.coffee} startFrame={34} />
    </div>
  </div>
);

const AlertStation: React.FC = () => {
  const frame = useCurrentFrame();
  const chipX = interpolate(frame, [22, 44], [-60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const chipOpacity = interpolate(frame, [22, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ scale: 1.25, display: "inline-block", margin: "10px 0 26px" }}>
        <PopBadge text="⚠ LOW STOCK — FLOUR" color={theme.amber} startFrame={4} />
      </div>
      <div
        style={{
          opacity: chipOpacity,
          translate: `${chipX}px 0px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          fontFamily,
          fontWeight: 700,
          fontSize: 26,
          color: theme.cream,
        }}
      >
        <span style={{ color: theme.coffee, fontSize: 34 }}>→</span>
        Reorder sent to Sunrise Mills
      </div>
    </div>
  );
};

const SupplierStation: React.FC = () => {
  const frame = useCurrentFrame();
  const boxIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        {/* box glyph */}
        <svg
          width={130}
          height={90}
          viewBox="0 0 130 90"
          style={{
            opacity: boxIn,
            translate: `${(1 - boxIn) * -50}px 0px`,
          }}
        >
          <circle cx={40} cy={22} r={16} fill={theme.latte} />
          <circle cx={66} cy={16} r={19} fill={theme.cream} />
          <circle cx={92} cy={22} r={15} fill={theme.caramel} />
          <rect x={10} y={26} width={110} height={60} rx={8} fill={theme.latte} />
          <rect x={10} y={26} width={110} height={16} rx={8} fill={theme.caramel} />
          <rect x={58} y={26} width={16} height={60} fill={theme.caramel} opacity={0.55} />
        </svg>
        <FlipChip before="IN TRANSIT" after="DELIVERED" flipFrame={26} />
      </div>
      <ScreenRow
        label="Outstanding balance"
        value={<CountUp from={245} to={0} startFrame={40} decimals={2} prefix="$" />}
        valueColor={theme.green}
        startFrame={34}
      />
    </div>
  );
};

const LedgerStation: React.FC = () => (
  <div>
    <ScreenRow label="Supplies — Cash" value="−$245.00" valueColor={theme.red} startFrame={2} />
    <ScreenRow label="Sale — Card" value="+$4.50" valueColor={theme.green} startFrame={12} />
    <ScreenRow
      label="Balance"
      value={<CountUp from={7160} to={6919.5} startFrame={26} decimals={2} prefix="$" />}
      valueColor="#ffffff"
      startFrame={22}
    />
    <div style={{ textAlign: "center", marginTop: 12 }}>
      <PopBadge text="EVERY CENT RECORDED" color={theme.coffee} startFrame={44} />
    </div>
  </div>
);

const STATIONS: { label: string; dwell: number; Content: React.FC }[] = [
  { label: "Inventory", dwell: 115, Content: InventoryStation },
  { label: "Alert", dwell: 205, Content: AlertStation },
  { label: "Supplier", dwell: 295, Content: SupplierStation },
  { label: "Treasury", dwell: 385, Content: LedgerStation },
];

/* ── the one-take chain act ─────────────────────────────────── */

const ChainAct: React.FC = () => {
  const frame = useCurrentFrame();

  const focusY = segValue(FOCUS_SEGS, frame);
  const S = segValue(SCALE_SEGS, frame);
  const tx = 540 - 540 * S;
  const ty = 960 - focusY * S;

  // fuse draws down to the spark; spark rides the camera focus.
  // Once the chain has completed (dwell 4), the fuse stays fully drawn
  // so the pull-back shows the whole circuit.
  const sparkY =
    frame >= 385 ? ST_Y[3] : Math.max(FUSE_TOP, Math.min(focusY, ST_Y[3]));
  // fades in/out instead of popping in/out at a boolean threshold
  const sparkFade =
    interpolate(frame, [70, 82], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [433, 445], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const sparkPulse = 0.7 + Math.sin(frame / 2.2) * 0.3;

  // hook text
  const line1 = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const line2 = interpolate(frame, [36, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const saleChip = interpolate(frame, [26, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  // reveal overlays
  const bezelIn = interpolate(frame, [560, 590], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const revealText = interpolate(frame, [590, 610], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <VignetteStage lightY={22} />

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
        {/* fuse line + spark (behind cards) */}
        <svg
          width={1080}
          height={WORLD_H}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <line
            x1={540}
            y1={FUSE_TOP}
            x2={540}
            y2={sparkY}
            stroke={theme.coffee}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.8}
          />
          <circle cx={540} cy={sparkY} r={26} fill={theme.coffee} opacity={0.25 * sparkPulse * sparkFade} />
          <circle cx={540} cy={sparkY} r={12} fill={theme.coffee} opacity={0.9 * sparkFade} />
          <circle cx={540} cy={sparkY} r={5} fill={theme.cream} opacity={sparkFade} />
        </svg>

        {/* hook: the cup */}
        <div
          style={{
            position: "absolute",
            top: CUP_Y - 260,
            left: 230,
            width: 620,
            height: 465,
          }}
        >
          <EspressoCup />
        </div>
        {/* $4.50 chip */}
        <div
          style={{
            position: "absolute",
            top: CUP_Y - 300,
            left: 660,
            scale: saleChip,
            fontFamily,
            fontWeight: 800,
            fontSize: 34,
            color: theme.dark,
            background: theme.cream,
            padding: "12px 26px",
            borderRadius: 999,
            rotate: "6deg",
          }}
        >
          $4.50
        </div>
        {/* hook lines */}
        <div
          style={{
            position: "absolute",
            top: CUP_Y + 320,
            width: 1080,
            textAlign: "center",
          }}
        >
          <div
            style={{
              opacity: line1,
              translate: `0px ${(1 - line1) * 20}px`,
              fontFamily,
              fontWeight: 900,
              fontSize: 74,
              color: "#ffffff",
            }}
          >
            One coffee sale.
          </div>
          <div
            style={{
              opacity: line2,
              translate: `0px ${(1 - line2) * 20}px`,
              fontFamily,
              fontWeight: 600,
              fontSize: 44,
              color: theme.coffee,
              marginTop: 16,
            }}
          >
            Watch what it triggers ↓
          </div>
        </div>

        {/* stations */}
        {STATIONS.map(({ label, dwell, Content }, i) => (
          <StationCard
            key={label}
            y={ST_Y[i]}
            label={label}
            revealAt={dwell - 46}
          >
            <Sequence from={dwell - 6} layout="none">
              <Content />
            </Sequence>
          </StationCard>
        ))}
      </div>

      {/* tablet bezel closing around the shrunken machine, with the
          reveal caption grouped underneath it (not pinned to the raw
          frame edge — that sat too close to where TikTok/Reels UI
          chrome lives) */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 64,
          }}
        >
          <div
            style={{
              opacity: bezelIn,
              scale: 1.18 - bezelIn * 0.18,
              width: 790,
              height: 1290,
              border: "3px solid #2a2a30",
              borderRadius: 46,
              // hard offset ring only — no blur, cheap at 4K
              boxShadow: "0 0 0 14px #060607",
            }}
          />
          <div
            style={{
              opacity: revealText,
              translate: `0px ${(1 - revealText) * 18}px`,
              fontFamily,
              fontWeight: 900,
              fontSize: 58,
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            All of it.{" "}
            <span style={{ color: theme.coffee }}>Automatic.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── payoff + CTA ───────────────────────────────────────────── */

const PayoffCta: React.FC = () => {
  const frame = useCurrentFrame();

  const line1 = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const line2 = interpolate(frame, [24, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const markIn = interpolate(frame, [70, 86], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const pillIn = interpolate(frame, [88, 104], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const siteIn = interpolate(frame, [104, 118], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <CinematicBackground tint="rgba(200,163,117,0.09)" />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 90px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              opacity: line1,
              translate: `0px ${(1 - line1) * 18}px`,
              fontFamily,
              fontWeight: 500,
              fontSize: 52,
              color: "rgba(255,255,255,0.6)",
              textAlign: "center",
            }}
          >
            You sell the coffee.
          </div>
          <div
            style={{
              opacity: line2,
              translate: `0px ${(1 - line2) * 18}px`,
              fontFamily,
              fontWeight: 900,
              fontSize: 60,
              lineHeight: 1.22,
              color: "#ffffff",
              textAlign: "center",
              maxWidth: 880,
            }}
          >
            Caflat.CORE{" "}
            <span style={{ color: theme.coffee }}>handles the rest.</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              marginTop: 44,
            }}
          >
            <div
              style={{
                opacity: markIn,
                fontFamily,
                fontWeight: 900,
                fontSize: 54,
                color: "#ffffff",
              }}
            >
              Caflat.CORE
            </div>
            <div
              style={{
                scale: pillIn,
                fontFamily,
                fontWeight: 700,
                fontSize: 28,
                color: theme.dark,
                background: "#ffffff",
                padding: "18px 42px",
                borderRadius: 999,
              }}
            >
              Follow for more café ops
            </div>
            <div
              style={{
                opacity: siteIn,
                fontFamily,
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: 1.5,
                color: theme.coffee,
              }}
            >
              caflatcore.com
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── futuristic UI sound design ─────────────────────────────── */

type SfxEvent = { file: string; frame: number; volume: number };

// Only two categories of sound remain: numbers ticking (tickup/
// tickdown) and notifications (confirm/alertf). No whooshes, no sound
// on the spark's travel, nothing from the pull-back reveal onward.
const REEL1_SFX: SfxEvent[] = [
  // station 1 — inventory drains, then confirmed
  { file: "tickdown", frame: 110, volume: 0.5 },
  { file: "confirm", frame: 143, volume: 0.45 },

  // station 2 — alert
  { file: "alertf", frame: 203, volume: 0.55 },

  // station 3 — delivered + balance pays down
  { file: "confirm", frame: 315, volume: 0.5 },
  { file: "tickdown", frame: 329, volume: 0.5 },

  // station 4 — ledger rows, balance, recorded
  { file: "tickup", frame: 405, volume: 0.5 },
  { file: "confirm", frame: 423, volume: 0.45 },
];

/* ── composition ────────────────────────────────────────────── */

export const Reel1: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.dark }}>
      {REEL1_SFX.map((e, i) => (
        <Sequence key={i} from={e.frame} layout="none">
          <Audio src={staticFile(`sfx/${e.file}.wav`)} volume={e.volume} />
        </Sequence>
      ))}

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={CHAIN_DUR}>
          <ChainAct />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={springTiming({
            config: { damping: 200 },
            durationInFrames: T_SLIDE,
          })}
        />
        <TransitionSeries.Sequence durationInFrames={PAYOFF_DUR}>
          <PayoffCta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
