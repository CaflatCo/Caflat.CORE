import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/**
 * Warm cinematic wrapper for the illustrated vignettes.
 * Deep espresso gradient, warm key light from above, film grain, vignette.
 * The app mockup screens stay monochrome — this warmth is for the world
 * around the app, not the app itself.
 */
export const VignetteStage: React.FC<{
  children?: React.ReactNode;
  /** vertical position of the warm key light, 0-100 (%) */
  lightY?: number;
}> = ({ children, lightY = 30 }) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.espresso2} 0%, ${theme.espresso} 60%, #120c07 100%)`,
      }}
    >
      {/* warm key light */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 55% at 50% ${lightY}%, rgba(200,163,117,0.20) 0%, rgba(200,163,117,0.05) 45%, rgba(0,0,0,0) 70%)`,
        }}
      />
      {children}
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {/* film grain */}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_SVG,
          opacity: 0.06,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
