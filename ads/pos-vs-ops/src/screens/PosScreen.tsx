import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";
import { CountUp, Eyebrow, LevelBar, PopBadge, ScreenRow } from "./screenUi";

/**
 * A sale rings up — and the operations layer reacts: ingredient
 * levels deplete live and a low-stock alert fires. The POS-vs-platform
 * money shot.
 */
export const PosScreen: React.FC = () => {
  const frame = useCurrentFrame();

  // tap ripple on the order row
  const ripple = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "relative" }}>
      <Eyebrow>Order #142</Eyebrow>
      <div style={{ position: "relative" }}>
        <ScreenRow label="Flat White ×2" value="$9.00" startFrame={4} />
        <ScreenRow label="Butter Croissant" value="$4.50" startFrame={10} />
        <ScreenRow
          label="Total"
          value={<CountUp to={13.5} startFrame={16} decimals={2} prefix="$" />}
          valueColor="#ffffff"
          startFrame={14}
        />
        {/* tap ripple */}
        <div
          style={{
            position: "absolute",
            right: 30,
            top: 20,
            width: 90,
            height: 90,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.6)",
            scale: ripple * 1.6,
            opacity: (1 - ripple) * 0.8,
          }}
        />
      </div>

      <div style={{ marginTop: 40 }}>
        <Eyebrow>Inventory — live</Eyebrow>
        <LevelBar label="Milk" fromPct={64} toPct={58} startFrame={34} />
        <LevelBar label="Butter" fromPct={41} toPct={33} startFrame={40} />
        <LevelBar label="Flour" fromPct={22} toPct={12} startFrame={46} low />
      </div>

      <div style={{ marginTop: 26, textAlign: "center" }}>
        <PopBadge text="⚠ LOW STOCK — FLOUR" color={theme.amber} startFrame={78} />
      </div>

      <div
        style={{
          marginTop: 30,
          textAlign: "center",
          fontFamily,
          fontWeight: 600,
          fontSize: 20,
          color: "rgba(255,255,255,0.35)",
          opacity: interpolate(frame, [90, 104], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Deducted automatically. Nothing typed.
      </div>
    </div>
  );
};
