import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../theme";

export type BarDatum = { label: string; value: number };

export const MiniBarChart: React.FC<{
  data: BarDatum[];
  startFrame?: number;
  width?: number;
  height?: number;
}> = ({ data, startFrame = 0, width = 780, height = 200 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const max = Math.max(...data.map((d) => d.value));
  const barGap = 22;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  const containerOpacity = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: containerOpacity,
        width,
        display: "flex",
        alignItems: "flex-end",
        gap: barGap,
        height,
      }}
    >
      {data.map((d, i) => {
        const delay = startFrame + 8 + i * 6;
        const localBar = frame - delay;
        const grow = interpolate(localBar, [0, 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const barHeight = (d.value / max) * (height - 34) * grow;

        return (
          <div
            key={d.label}
            style={{
              width: barWidth,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              height,
            }}
          >
            <div
              style={{
                width: "100%",
                height: barHeight,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.55))",
                borderRadius: 4,
              }}
            />
            <div
              style={{
                marginTop: 10,
                fontFamily,
                fontWeight: 600,
                fontSize: 16,
                letterSpacing: 0.5,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
