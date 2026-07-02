import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const PATH_LEN = 60;

export const AnimatedIcon: React.FC<{
  paths: string[];
  size?: number;
  delayFrames?: number;
  color?: string;
}> = ({ paths, size = 64, delayFrames = 0, color = "#ffffff" }) => {
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
  const scale = interpolate(local, [0, 26], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity, scale }}
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
  );
};
