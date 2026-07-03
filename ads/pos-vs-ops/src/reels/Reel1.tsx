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
import { LightLeak } from "@remotion/light-leaks";
import { CinematicBackground } from "../components/CinematicBackground";
import { LevelBar, PopBadge } from "../screens/screenUi";
import { fontFamily, theme } from "../theme";

/**
 * Reel 1 — "POS vs. Operations Platform" (~25s, 1080×1920)
 * Hook → stacked split-frame comparison → payoff → CTA.
 * House style throughout; render with --scale=2 for 2160×3840.
 */

const HOOK_DUR = 105;
const SPLIT_START = 105;
const SPLIT_DUR = 400;
const PAYOFF_START = SPLIT_START + SPLIT_DUR; // 505
const PAYOFF_DUR = 130;
const CTA_START = PAYOFF_START + PAYOFF_DUR; // 635
const CTA_DUR = 115;
export const REEL1_DURATION = CTA_START + CTA_DUR; // 750

/* ── Hook ─────────────────────────────────────────────────────── */

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const pushIn = interpolate(frame, [0, HOOK_DUR], [1, 1.07], {
    extrapolateRight: "clamp",
  });

  const line1In = interpolate(frame, [2, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const cut = 44;
  const line2 = frame >= cut;
  const line2Scale = interpolate(frame, [cut, cut + 12], [1.18, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const flash = interpolate(frame, [cut, cut + 4], [0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: pushIn }}>
        <CinematicBackground
          tint={line2 ? "rgba(224,92,92,0.10)" : "rgba(200,163,117,0.07)"}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 90px",
        }}
      >
        {!line2 ? (
          <div
            style={{
              opacity: line1In,
              translate: `0px ${(1 - line1In) * 22}px`,
              fontFamily,
              fontWeight: 800,
              fontSize: 72,
              lineHeight: 1.2,
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            If you're only
            <br />
            looking at a POS…
          </div>
        ) : (
          <div
            style={{
              scale: line2Scale,
              fontFamily,
              fontWeight: 900,
              fontSize: 84,
              lineHeight: 1.16,
              color: theme.red,
              textAlign: "center",
              textShadow: "0 0 70px rgba(224,92,92,0.4)",
            }}
          >
            you're already
            <br />
            losing money.
          </div>
        )}
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

/* ── Split frame ──────────────────────────────────────────────── */

const PanelLabel: React.FC<{ text: string; gold?: boolean; inAt: number }> = ({
  text,
  gold,
  inAt,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [inAt, inAt + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        fontFamily,
        fontWeight: 800,
        fontSize: 30,
        letterSpacing: 5,
        textTransform: "uppercase",
        color: gold ? theme.coffee : "rgba(255,255,255,0.4)",
        marginBottom: 18,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
};

const DeadPos: React.FC<{ inAt: number }> = ({ inAt }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [inAt, inAt + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        opacity: enter,
        translate: `0px ${(1 - enter) * 34}px`,
        width: 820,
        background: "#3a3a3e",
        borderRadius: 18,
        padding: "30px 38px",
        filter: "grayscale(1)",
      }}
    >
      {["Flat White ×2 — $9.00", "Butter Croissant — $4.50"].map((row) => (
        <div
          key={row}
          style={{
            fontFamily,
            fontWeight: 500,
            fontSize: 27,
            color: "rgba(255,255,255,0.5)",
            padding: "14px 0",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {row}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 18,
          fontFamily,
          fontWeight: 800,
          fontSize: 32,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        <span>Total</span>
        <span>$13.50</span>
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily,
          fontWeight: 500,
          fontSize: 21,
          color: "rgba(255,255,255,0.3)",
          fontStyle: "italic",
        }}
      >
        …and that's all it knows.
      </div>
    </div>
  );
};

const CaflatPanel: React.FC<{ inAt: number }> = ({ inAt }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [inAt, inAt + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        opacity: enter,
        translate: `0px ${(1 - enter) * 34}px`,
        width: 820,
        background: theme.dark,
        border: "1.5px solid rgba(200,163,117,0.4)",
        borderRadius: 18,
        padding: "26px 38px 18px",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 27,
            color: "#fff",
          }}
        >
          Caflat.CORE
        </span>
        <span
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Same sale
        </span>
      </div>

      <Sequence from={inAt + 14} layout="none">
        <div>
          <LevelBar label="Milk" fromPct={64} toPct={58} startFrame={0} />
          <LevelBar label="Butter" fromPct={41} toPct={33} startFrame={8} />
          <LevelBar label="Flour" fromPct={22} toPct={12} startFrame={16} low />
          <div style={{ textAlign: "center", marginTop: 6, marginBottom: 8 }}>
            <PopBadge
              text="⚠ LOW STOCK — FLOUR"
              color={theme.amber}
              startFrame={52}
            />
          </div>
        </div>
      </Sequence>
    </div>
  );
};

const SplitFrame: React.FC = () => {
  const frame = useCurrentFrame();
  const pushIn = interpolate(frame, [0, SPLIT_DUR], [1, 1.05], {
    extrapolateRight: "clamp",
  });

  const questionIn = interpolate(frame, [210, 228], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: pushIn }}>
        <CinematicBackground tint="rgba(200,163,117,0.07)" />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 44,
          }}
        >
          <div>
            <PanelLabel text="What they sell you" inAt={6} />
            <DeadPos inAt={12} />
          </div>

          {/* question banner */}
          <div
            style={{
              opacity: questionIn,
              scale: 0.94 + questionIn * 0.06,
              fontFamily,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.35,
              textAlign: "center",
              color: theme.cream,
              maxWidth: 860,
            }}
          >
            Does your POS know how much
            <br />
            <span style={{ color: theme.coffee }}>butter you have left?</span>
          </div>

          <div>
            <PanelLabel text="What you actually need" gold inAt={60} />
            <CaflatPanel inAt={66} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── Payoff ───────────────────────────────────────────────────── */

const Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const pushIn = interpolate(frame, [0, PAYOFF_DUR], [1.04, 1.1], {
    extrapolateRight: "clamp",
  });

  const line1 = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const line2 = interpolate(frame, [34, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: pushIn }}>
        <CinematicBackground tint="rgba(200,163,117,0.09)" />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 90px",
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 66,
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          <div
            style={{
              opacity: line1,
              translate: `0px ${(1 - line1) * 18}px`,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            That's the difference
            <br />
            between a POS…
          </div>
          <div
            style={{
              opacity: line2,
              translate: `0px ${(1 - line2) * 18}px`,
              fontWeight: 900,
              color: "#ffffff",
              marginTop: 22,
            }}
          >
            …and an{" "}
            <span style={{ color: theme.coffee }}>operations platform.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── CTA ──────────────────────────────────────────────────────── */

const Cta: React.FC = () => {
  const frame = useCurrentFrame();

  const markIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const pillIn = interpolate(frame, [22, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const siteIn = interpolate(frame, [40, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <CinematicBackground tint="rgba(200,163,117,0.08)" />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
          }}
        >
          <div
            style={{
              opacity: markIn,
              translate: `0px ${(1 - markIn) * 16}px`,
              fontFamily,
              fontWeight: 900,
              fontSize: 68,
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
              fontSize: 30,
              color: theme.dark,
              background: "#ffffff",
              padding: "20px 46px",
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
              fontSize: 26,
              letterSpacing: 1.5,
              color: theme.coffee,
            }}
          >
            caflatcore.com
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── Composition ──────────────────────────────────────────────── */

export const Reel1: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.dark }}>
      <Audio
        src={staticFile("bg-music.mp3")}
        volume={(f: number) =>
          interpolate(
            f,
            [0, 24, REEL1_DURATION - 50, REEL1_DURATION],
            [0, 0.22, 0.22, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      <Sequence durationInFrames={HOOK_DUR}>
        <Hook />
      </Sequence>

      {/* gold light-leak accent over the hook → split cut */}
      <Sequence from={HOOK_DUR - 16} durationInFrames={32}>
        <LightLeak seed={5} hueShift={0} />
      </Sequence>

      <Sequence from={SPLIT_START} durationInFrames={SPLIT_DUR}>
        <SplitFrame />
      </Sequence>

      <Sequence from={PAYOFF_START} durationInFrames={PAYOFF_DUR}>
        <Payoff />
      </Sequence>

      {/* second gold accent into the CTA */}
      <Sequence from={CTA_START - 14} durationInFrames={28}>
        <LightLeak seed={2} hueShift={0} />
      </Sequence>

      <Sequence from={CTA_START} durationInFrames={CTA_DUR}>
        <Cta />
      </Sequence>
    </AbsoluteFill>
  );
};
