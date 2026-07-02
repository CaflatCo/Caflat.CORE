import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export const CinematicBackground: React.FC<{
  tint?: string;
}> = ({ tint }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.dark }}>
      {/* base radial glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 80% at 50% 15%, ${
            tint ?? "rgba(200,163,117,0.10)"
          } 0%, rgba(10,10,11,0) 55%)`,
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* film grain */}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_SVG,
          opacity: 0.05,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
