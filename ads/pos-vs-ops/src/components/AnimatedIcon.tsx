import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

const PATH_LEN = 60;

export const AnimatedIcon: React.FC<{
  paths: string[];
  size?: number;
  delayFrames?: number;
  color?: string;
}> = ({
  paths,
  size = 64,
  delayFrames = 0,
  color = "rgba(200,163,117,0.85)",
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delayFrames);

  const draw = interpolate(local, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(local, [0, 20], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(local, [0, 26], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: size * 2.4,
          height: size * 2.4,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.coffee} 0%, rgba(200,163,117,0) 70%)`,
          opacity: glowOpacity,
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ opacity, scale, position: "relative" }}
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={PATH_LEN}
            strokeDashoffset={PATH_LEN * (1 - draw)}
          />
        ))}
      </svg>
    </div>
  );
};
