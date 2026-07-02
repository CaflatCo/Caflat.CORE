import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";
import { CountUp, Eyebrow, ScreenRow } from "./screenUi";

const Card: React.FC<{
  title: string;
  sub: string;
  highlight?: boolean;
  slideX?: number;
}> = ({ title, sub, highlight, slideX = 0 }) => (
  <div
    style={{
      translate: `${slideX}px 0px`,
      background: highlight
        ? "rgba(61,189,122,0.10)"
        : "rgba(255,255,255,0.05)",
      border: `1.5px solid ${highlight ? "rgba(61,189,122,0.5)" : "rgba(255,255,255,0.12)"}`,
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 14,
    }}
  >
    <div
      style={{
        fontFamily,
        fontWeight: 700,
        fontSize: 21,
        color: "#fff",
        marginBottom: 4,
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontFamily,
        fontWeight: 500,
        fontSize: 17,
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {sub}
    </div>
  </div>
);

/**
 * Kanban: the cookie-dough job card crosses from IN PROGRESS to
 * COMPLETED while cost-per-unit resolves below.
 */
export const ProductionScreen: React.FC = () => {
  const frame = useCurrentFrame();

  const cross = interpolate(frame, [26, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const crossed = cross >= 0.5;
  // card travels one column width (half of the two-column area + gap)
  const cardX = cross * 372;

  return (
    <div>
      <Eyebrow>Today's production</Eyebrow>

      <div style={{ display: "flex", gap: 24 }}>
        {[
          { title: "IN PROGRESS", side: "left" },
          { title: "COMPLETED", side: "right" },
        ].map((col) => (
          <div key={col.title} style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: 2,
                color:
                  col.side === "right" && crossed
                    ? theme.green
                    : "rgba(255,255,255,0.4)",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              {col.title}
            </div>
            <div
              style={{
                minHeight: 250,
                border: "1.5px dashed rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              {col.side === "left" ? (
                <>
                  {/* travelling card — rendered in the left column, slides right */}
                  <Card
                    title="Cookie Dough #12"
                    sub="48 units · Ana"
                    highlight={crossed}
                    slideX={cardX}
                  />
                  <Card title="Sourdough #9" sub="20 units · Marco" />
                </>
              ) : (
                <>
                  {/* invisible placeholder reserving the landing slot for
                      the travelling card — keeps it from overlapping */}
                  <div style={{ opacity: 0 }}>
                    <Card title="Cookie Dough #12" sub="48 units · Ana" />
                  </div>
                  <Card title="Banana Bread #8" sub="16 units ✓" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <ScreenRow
          label="Batch cost per unit"
          value={<CountUp to={0.86} startFrame={58} decimals={2} prefix="$" />}
          startFrame={54}
        />
        <ScreenRow
          label="Waste logged"
          value="2.1%"
          valueColor={theme.green}
          startFrame={64}
        />
      </div>
    </div>
  );
};
