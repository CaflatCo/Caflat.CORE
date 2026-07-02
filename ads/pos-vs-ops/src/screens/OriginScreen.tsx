import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";
import { Eyebrow, PopBadge } from "./screenUi";

const FIELDS: { label: string; value: string; at: number }[] = [
  { label: "Origin", value: "Benguet, Philippines", at: 8 },
  { label: "Farmer", value: "Dayrit Farms", at: 26 },
  { label: "Process", value: "Washed", at: 44 },
  { label: "Harvest", value: "March 2026", at: 58 },
];

/**
 * The scanned bag's data lands in the lot form — fields type
 * themselves in (string slicing, per Remotion best practice).
 */
export const OriginScreen: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div>
      <Eyebrow>New lot — scanned</Eyebrow>

      {FIELDS.map((field) => {
        const chars = Math.max(
          0,
          Math.round(
            interpolate(
              frame,
              [field.at, field.at + 14],
              [0, field.value.length],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          ),
        );
        const typed = field.value.slice(0, chars);
        const active = frame >= field.at && chars < field.value.length;

        return (
          <div key={field.label} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontFamily,
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              {field.label}
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 26,
                color: "#fff",
                padding: "14px 20px",
                border: `1.5px solid ${
                  active ? theme.coffee : "rgba(255,255,255,0.14)"
                }`,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                minHeight: 60,
              }}
            >
              {typed}
              {active ? (
                <span style={{ color: theme.coffee }}>|</span>
              ) : null}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 26, textAlign: "center" }}>
        <PopBadge text="LOT #A-114 RECORDED ✓" color={theme.green} startFrame={82} />
      </div>
    </div>
  );
};
