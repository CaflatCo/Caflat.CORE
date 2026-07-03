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
import { MiniBarChart } from "../components/MiniBarChart";
import {
  CountUp,
  LevelBar,
  PopBadge,
  ScreenRow,
} from "../screens/screenUi";
import { CinematicBackground } from "../components/CinematicBackground";
import { fontFamily, theme } from "../theme";
import { Seg, segValue } from "./camera";

/**
 * Reel 1 — "The Fork": one sale, three things happen automatically —
 * at the same instant, not in sequence. A single tap forks a spark
 * into three simultaneous, camera-toured branches (inventory / audit
 * log / dashboard), which then reunite into the wordmark. Every beat
 * here maps to a verified real, no-extra-click behavior of the app —
 * see the plan for the file:line audit. No mid-video cuts.
 */

/* ── world geometry ─────────────────────────────────────────── */

const WORLD_W = 2000;
const WORLD_H = 2000;
const CUP_Y = 500; // cup + charge-button center
const FORK_X = 990; // fuse fork junction (== center branch x)
const FUSE_TOP = 820; // fuse starts under the charge button
const FORK_Y = 1100; // where the single fuse splits into 3
const ROW_Y = 1500; // world y of the branch card row
const BX = [350, 990, 1630]; // branch x-centers: left / center / right
const CARD_W = 540;

/* camera: focus (world y/x at screen center) + zoom, piecewise inOut */

const FOCUS_SEGS: Seg[] = [
  [0, 90, CUP_Y + 100, CUP_Y + 100], // hook hold (frames cup + button)
  [90, 115, CUP_Y + 100, FORK_Y],
  [115, 145, FORK_Y, FORK_Y], // hold at the fork while it splays
  [145, 180, FORK_Y, ROW_Y], // arrive at LEFT
  [180, 265, ROW_Y, ROW_Y], // dwell LEFT
  [265, 295, ROW_Y, ROW_Y], // pan to CENTER (y constant)
  [295, 380, ROW_Y, ROW_Y], // dwell CENTER
  [380, 410, ROW_Y, ROW_Y], // pan to RIGHT (y constant)
  [410, 495, ROW_Y, ROW_Y], // dwell RIGHT
  [495, 565, ROW_Y, 1350], // pull back — see all 3 branches at once
  [565, 660, 1350, 1350], // reunite + bezel reveal
];

const PAN_SEGS: Seg[] = [
  [0, 145, FORK_X, FORK_X], // hook + fork hold, centered on the fork axis
  [145, 180, FORK_X, BX[0]], // pan to LEFT
  [180, 265, BX[0], BX[0]], // dwell LEFT
  [265, 295, BX[0], BX[1]], // pan to CENTER
  [295, 380, BX[1], BX[1]], // dwell CENTER
  [380, 410, BX[1], BX[2]], // pan to RIGHT
  [410, 495, BX[2], BX[2]], // dwell RIGHT
  [495, 565, BX[2], FORK_X], // pull back to center
  [565, 660, FORK_X, FORK_X], // reunite + bezel reveal
];

const SCALE_SEGS: Seg[] = [
  [0, 90, 1, 1],
  [90, 145, 1, 1.15], // slight zoom toward the fork
  [145, 180, 1.15, 2.0], // zoom into a branch
  [180, 495, 2.0, 2.0], // constant through all 3 dwells + pans between
  [495, 565, 2.0, 0.5], // pull back — whole fork visible at once
  [565, 660, 0.5, 0.5],
];

const CHAIN_DUR = 660;
const PAYOFF_DUR = 170;
const T_SLIDE = 22;
export const REEL1_DURATION = CHAIN_DUR + PAYOFF_DUR - T_SLIDE; // 808

/* ── shared card shell for branches ─────────────────────────── */

const BranchCard: React.FC<{
  x: number;
  label: string;
  revealAt: number;
  children: React.ReactNode;
}> = ({ x, label, revealAt, children }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [revealAt, revealAt + 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // During the pull-back all 3 cards are on screen at once — large blur
  // shadows there make 4K software rasterization catastrophically slow.
  // Fade the shadow's alpha out over a window instead of an instant cut.
  const shadowAlpha = interpolate(frame, [495, 520], [0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
  <div
    style={{
      position: "absolute",
      top: ROW_Y - 370,
      left: x - CARD_W / 2,
      width: CARD_W,
      opacity: reveal,
      translate: `0px ${(1 - reveal) * 60}px`,
      scale: 0.92 + reveal * 0.08,
      background: "rgba(10,10,11,0.88)",
      border: "1.5px solid rgba(200,163,117,0.4)",
      borderRadius: 24,
      padding: "28px 34px 24px",
      boxShadow: `0 40px 90px rgba(0,0,0,${shadowAlpha.toFixed(3)})`,
    }}
  >
    <div
      style={{
        fontFamily,
        fontWeight: 800,
        fontSize: 24,
        letterSpacing: 4,
        textTransform: "uppercase",
        color: theme.coffee,
        marginBottom: 18,
      }}
    >
      {label}
    </div>
    {children}
  </div>
  );
};

/** Same instant, every branch — the on-screen proof this is one event,
 * not three separate ones. */
const TimestampTag: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        textAlign: "center",
        marginTop: 12,
        fontFamily,
        fontWeight: 600,
        fontSize: 14,
        letterSpacing: 0.5,
        color: "rgba(255,255,255,0.35)",
      }}
    >
      ⏱ 14:32:07 — same instant, everywhere
    </div>
  );
};

/* ── branches ───────────────────────────────────────────────── */

const InventoryBranch: React.FC = () => (
  <div>
    <LevelBar label="Beans" fromPct={57} toPct={51} startFrame={0} />
    <LevelBar label="Milk" fromPct={64} toPct={58} startFrame={6} />
    <LevelBar label="Flour" fromPct={22} toPct={12} startFrame={12} low />
    <div style={{ textAlign: "center", marginTop: 10 }}>
      <PopBadge text="3 INGREDIENTS · DEDUCTED" color={theme.coffee} startFrame={34} />
    </div>
    <TimestampTag startFrame={48} />
  </div>
);

/** One row of the auto-logged movement entry — ingredient, quantity
 * used, and the auto-filled timestamp + role that make it a real
 * audit trail rather than a decorative list. */
const LogRow: React.FC<{ label: string; qty: string; startFrame: number }> = ({
  label,
  qty,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const opacity = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tx = interpolate(local, [0, 14], [-16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <div
      style={{
        opacity,
        translate: `${tx}px 0px`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "11px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span style={{ fontFamily, fontWeight: 600, fontSize: 21, color: "rgba(255,255,255,0.75)" }}>
        {label}
      </span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 20, color: theme.red }}>{qty}</div>
        <div style={{ fontFamily, fontWeight: 600, fontSize: 12, letterSpacing: 0.5, color: "rgba(255,255,255,0.35)" }}>
          14:32:07 · STAFF
        </div>
      </div>
    </div>
  );
};

const LedgerBranch: React.FC = () => (
  <div>
    <LogRow label="Beans" qty="−18g" startFrame={0} />
    <LogRow label="Milk" qty="−60ml" startFrame={10} />
    <LogRow label="Flour" qty="−14g" startFrame={20} />
    <div style={{ textAlign: "center", marginTop: 16 }}>
      <PopBadge text="AUTO-LOGGED ✓" color={theme.coffee} startFrame={40} />
    </div>
  </div>
);

const DASHBOARD_DATA = [
  { label: "Mon", value: 38 },
  { label: "Tue", value: 44 },
  { label: "Wed", value: 41 },
  { label: "Thu", value: 48 },
];

const DashboardBranch: React.FC = () => (
  <div>
    <ScreenRow
      label="Iced Latte"
      value={<CountUp from={46} to={47} startFrame={20} suffix=" sold" />}
      valueColor={theme.green}
      startFrame={10}
    />
    <div style={{ marginTop: 16 }}>
      <MiniBarChart data={DASHBOARD_DATA} startFrame={26} width={460} height={130} />
    </div>
    <div style={{ textAlign: "center", marginTop: 14 }}>
      <PopBadge text="DASHBOARD ✓ LIVE" color={theme.coffee} startFrame={70} />
    </div>
    <TimestampTag startFrame={84} />
  </div>
);

const BRANCHES: {
  label: string;
  x: number;
  revealAt: number;
  contentFrom: number;
  Content: React.FC;
}[] = [
  { label: "Inventory", x: BX[0], revealAt: 145, contentFrom: 180, Content: InventoryBranch },
  { label: "Ledger", x: BX[1], revealAt: 265, contentFrom: 295, Content: LedgerBranch },
  { label: "Dashboard", x: BX[2], revealAt: 380, contentFrom: 410, Content: DashboardBranch },
];

/* ── the one-take fork act ──────────────────────────────────── */

const ChainAct: React.FC = () => {
  const frame = useCurrentFrame();

  const focusY = segValue(FOCUS_SEGS, frame);
  const focusX = segValue(PAN_SEGS, frame);
  const S = segValue(SCALE_SEGS, frame);
  const tx = 540 - focusX * S;
  const ty = 960 - focusY * S;

  // tap impact: a hard flash + a quick press on the charge button —
  // the one deliberately fast beat in the piece, since it's an impact,
  // not a reveal.
  const flash = interpolate(frame, [0, 3, 11], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tapScale = interpolate(frame, [0, 3, 9], [1, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // hook text — still eased, just a shorter window right after the
  // impact (the one place a punchier pace than usual is earned)
  const line1 = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const line2 = interpolate(frame, [26, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // fuse: single spark travels from the button down to the fork
  // junction (frames 90–115), matching the camera's move to FORK_Y.
  const fuseT = interpolate(frame, [90, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const fuseSparkY = FUSE_TOP + (FORK_Y - FUSE_TOP) * fuseT;

  // the fork: 3 sparks travel outward SIMULTANEOUSLY along straight
  // diagonals from the junction to each branch — one event forking
  // into three, not three events queued one after another.
  const forkT = interpolate(frame, [115, 145], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const stubY0 = ROW_Y - 40; // where each diagonal meets its card's stub

  // reunite: the three arrival points travel back to the fork
  // junction and converge — a mirror of the opening fork.
  const reuniteT = interpolate(frame, [565, 600], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const bloomT = interpolate(frame, [596, 615], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // reveal overlays (bezel + caption), after the reunite bloom
  const bezelIn = interpolate(frame, [605, 635], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const revealText = interpolate(frame, [618, 638], [0, 1], {
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
          width: WORLD_W,
          height: WORLD_H,
          transform: `translate(${tx}px, ${ty}px) scale(${S})`,
          transformOrigin: "0 0",
        }}
      >
        {/* fuse + fork lines (behind cards) */}
        <svg
          width={WORLD_W}
          height={WORLD_H}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {/* single fuse: button → fork junction */}
          <line
            x1={FORK_X}
            y1={FUSE_TOP}
            x2={FORK_X}
            y2={fuseSparkY}
            stroke={theme.coffee}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.8}
          />
          {frame >= 115 &&
            BX.map((bx, i) => {
              const ex = FORK_X + (bx - FORK_X) * forkT;
              const ey = FORK_Y + (stubY0 - FORK_Y) * forkT;
              // arrival point drifts back toward the fork junction
              // during the reunite beat — same points, reverse trip.
              const px = ex + (FORK_X - bx) * reuniteT;
              const py = ey + (FORK_Y - stubY0) * reuniteT;
              const pulse = 0.7 + Math.sin(frame / 2.2 + i) * 0.3;
              return (
                <g key={i}>
                  <line
                    x1={FORK_X}
                    y1={FORK_Y}
                    x2={ex}
                    y2={ey}
                    stroke={theme.coffee}
                    strokeWidth={4}
                    strokeLinecap="round"
                    opacity={0.75 * (1 - reuniteT)}
                  />
                  {forkT >= 1 && reuniteT < 1 && (
                    <line
                      x1={bx}
                      y1={stubY0}
                      x2={bx}
                      y2={ROW_Y}
                      stroke={theme.coffee}
                      strokeWidth={4}
                      strokeLinecap="round"
                      opacity={0.75 * (1 - reuniteT)}
                    />
                  )}
                  <circle cx={px} cy={py} r={12} fill={theme.coffee} opacity={0.9 * pulse} />
                  <circle cx={px} cy={py} r={5} fill={theme.cream} />
                </g>
              );
            })}
          {/* bloom at the reunite point */}
          <circle
            cx={FORK_X}
            cy={FORK_Y}
            r={20 + bloomT * 130}
            fill={theme.cream}
            opacity={bloomT * (1 - bloomT) * 3.2}
          />
        </svg>

        {/* hook: the cup + charge button */}
        <div
          style={{
            position: "absolute",
            top: CUP_Y - 260,
            left: FORK_X - 310,
            width: 620,
            height: 465,
          }}
        >
          <EspressoCup />
        </div>
        <div
          style={{
            position: "absolute",
            top: CUP_Y + 250,
            left: FORK_X - 165,
            width: 330,
            scale: tapScale,
            textAlign: "center",
            fontFamily,
            fontWeight: 800,
            fontSize: 32,
            color: theme.dark,
            background: theme.cream,
            padding: "20px 0",
            borderRadius: 20,
          }}
        >
          Charge $4.50
        </div>

        {/* hook lines — above the cup, so the downward flow reads
            text → cup → tap → fuse → fork without any overlap */}
        <div
          style={{
            position: "absolute",
            top: CUP_Y - 480,
            left: FORK_X - 540,
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
            Under a second.
          </div>
          <div
            style={{
              opacity: line2,
              translate: `0px ${(1 - line2) * 20}px`,
              fontFamily,
              fontWeight: 600,
              fontSize: 38,
              color: theme.coffee,
              marginTop: 16,
            }}
          >
            Here's everything that happens, automatically ↓
          </div>
        </div>

        {/* branches */}
        {BRANCHES.map(({ label, x, revealAt, contentFrom, Content }) => (
          <BranchCard key={label} x={x} label={label} revealAt={revealAt}>
            <Sequence from={contentFrom} layout="none">
              <Content />
            </Sequence>
          </BranchCard>
        ))}
      </div>

      {/* tap-impact flash */}
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />

      {/* tablet bezel closing around the reunited machine, with the
          reveal caption grouped underneath it */}
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

  const line1 = interpolate(frame, [4, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const line2 = interpolate(frame, [24, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const markIn = interpolate(frame, [70, 94], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
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
            You made the sale.
          </div>
          <div
            style={{
              opacity: line2,
              translate: `0px ${(1 - line2) * 18}px`,
              fontFamily,
              fontWeight: 900,
              fontSize: 56,
              lineHeight: 1.22,
              color: "#ffffff",
              textAlign: "center",
              maxWidth: 880,
            }}
          >
            Caflat.CORE did the rest{" "}
            <span style={{ color: theme.coffee }}>— automatically.</span>
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

const REEL1_SFX: SfxEvent[] = [
  { file: "confirm", frame: 2, volume: 0.65 }, // tap impact
  { file: "tickup", frame: 117, volume: 0.5 }, // the fork splits

  // branch 1 — inventory drains, then confirmed
  { file: "tickdown", frame: 200, volume: 0.5 },
  { file: "confirm", frame: 222, volume: 0.45 },

  // branch 2 — log rows ticking in, then auto-logged
  { file: "confirm", frame: 305, volume: 0.45 },
  { file: "confirm", frame: 318, volume: 0.4 },
  { file: "confirm", frame: 345, volume: 0.45 },

  // branch 3 — dashboard number + chart, then live badge
  { file: "tickup", frame: 420, volume: 0.5 },
  { file: "confirm", frame: 460, volume: 0.45 },

  // reunite — the three branches converge and bloom
  { file: "seal", frame: 565, volume: 0.55 },
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
