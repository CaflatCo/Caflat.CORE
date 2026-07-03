import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { VignetteStage } from "../components/VignetteStage";
import { TabletMockup } from "../components/TabletMockup";
import { CinematicBackground } from "../components/CinematicBackground";
import { AnimatedIcon } from "../components/AnimatedIcon";
import { fontFamily, theme } from "../theme";

export type ModeVignetteProps = {
  label: string;
  icon: string[];
  Illustration: React.FC;
  Screen: React.FC;
  screenTitle: string;
  /** frames spent in the illustration phase before the match-cut */
  illustrationFrames: number;
};

const CUT_LEN = 12;

/**
 * Scene template: warm illustrated vignette → quick match-cut →
 * monochrome tablet mockup reacting in the app. The mode label chip
 * stays anchored top-center across both phases for continuity.
 */
export const ModeVignette: React.FC<ModeVignetteProps> = ({
  label,
  icon,
  Illustration,
  Screen,
  screenTitle,
  illustrationFrames,
}) => {
  const frame = useCurrentFrame();
  const cutStart = illustrationFrames;

  // Illustration exits: scale up + fade fast
  const illuOut = interpolate(
    frame,
    [cutStart, cutStart + CUT_LEN],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const illuVisible = frame < cutStart + CUT_LEN;

  // Tablet phase fades up right behind it
  const tabletIn = interpolate(
    frame,
    [cutStart + 4, cutStart + CUT_LEN + 6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const labelIn = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      {/* Phase 2 background sits underneath from the start */}
      <AbsoluteFill style={{ opacity: tabletIn }}>
        <CinematicBackground tint="rgba(200,163,117,0.08)" />
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div style={{ marginTop: 60 }}>
            <TabletMockup
              startFrame={cutStart + 6}
              screenTitle={screenTitle}
            >
              {/* screen animations start counting only once the
                  tablet is revealed — not while the illustration
                  still covers it */}
              <Sequence from={cutStart + 10} layout="none">
                <Screen />
              </Sequence>
            </TabletMockup>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Phase 1: warm illustrated vignette */}
      {illuVisible ? (
        <AbsoluteFill
          style={{
            opacity: 1 - illuOut,
            scale: 1 + illuOut * 0.1,
          }}
        >
          <VignetteStage>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                padding: "220px 40px 200px",
              }}
            >
              <Illustration />
            </AbsoluteFill>
          </VignetteStage>
        </AbsoluteFill>
      ) : null}

      {/* Mode label chip — persists across both phases */}
      <AbsoluteFill
        style={{ alignItems: "center", pointerEvents: "none" }}
      >
        <div
          style={{
            opacity: labelIn,
            translate: `0px ${(1 - labelIn) * -16 + 130}px`,
            display: "flex",
            alignItems: "center",
            gap: 20,
            border: "1.5px solid rgba(200,163,117,0.5)",
            background: "rgba(10,10,11,0.6)",
            borderRadius: 999,
            padding: "18px 44px",
          }}
        >
          <AnimatedIcon paths={icon} size={46} delayFrames={6} />
          <span
            style={{
              fontFamily,
              fontWeight: 800,
              fontSize: 38,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: theme.cream,
            }}
          >
            {label}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
