import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { fontFamily } from "../theme";

const Word: React.FC<{ text: string; delay: number; strong?: boolean }> = ({
  text,
  delay,
  strong,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delay;

  const opacity = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(local, [0, 14], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const blur = interpolate(local, [0, 14], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        translate: `0px ${translateY}px`,
        filter: `blur(${blur}px)`,
        fontFamily,
        fontWeight: strong ? 900 : 500,
        color: strong ? "#ffffff" : "rgba(255,255,255,0.62)",
      }}
    >
      {text}&nbsp;
    </span>
  );
};

export const ShowcaseHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = interpolate(frame, [0, 110], [1.08, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const flashOpacity = interpolate(frame, [0, 5], [1, 0], {
    extrapolateRight: "clamp",
  });

  const line1 = ["Running", "a", "cafe", "takes"];
  const line2Delay = 0.55 * fps;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: bgScale }}>
        <CinematicBackground tint="rgba(255,255,255,0.05)" />
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
            textAlign: "center",
            fontSize: 64,
            lineHeight: 1.28,
            maxWidth: 880,
          }}
        >
          <div>
            {line1.map((w, i) => (
              <Word key={w} text={w} delay={i * 4} />
            ))}
          </div>
          <div>
            <Word text="more" delay={line2Delay} />
            <Word text="than" delay={line2Delay + 4} />
            <Word text="a" delay={line2Delay + 8} />
            <Word text="register." delay={line2Delay + 12} strong />
          </div>
        </div>
      </AbsoluteFill>

      <Sequence from={Math.round(1.5 * fps)} layout="none">
        <AbsoluteFill
          style={{ justifyContent: "flex-end", alignItems: "center" }}
        >
          <SubLine />
        </AbsoluteFill>
      </Sequence>

      <AbsoluteFill
        style={{ backgroundColor: "#fff", opacity: flashOpacity }}
      />
    </AbsoluteFill>
  );
};

const SubLine: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        fontFamily,
        fontWeight: 500,
        fontSize: 30,
        letterSpacing: 1,
        color: "rgba(255,255,255,0.42)",
        marginBottom: 190,
      }}
    >
      Here's everything running underneath.
    </div>
  );
};
