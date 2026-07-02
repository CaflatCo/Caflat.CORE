import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";
import { CountUp, Eyebrow, ScreenRow } from "./screenUi";

const STAGES = ["INQUIRY", "QUOTED", "BOOKED", "PAID"];

/**
 * Event pipeline lights up stage by stage, then the profit resolves.
 */
export const EventsScreen: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div>
      <Eyebrow>Corporate event — 200 pax</Eyebrow>

      {/* pipeline dots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          margin: "20px 0 36px",
        }}
      >
        {STAGES.map((stage, i) => {
          const lit = interpolate(
            frame,
            [10 + i * 12, 20 + i * 12],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return (
            <React.Fragment key={stage}>
              {i > 0 ? (
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: `rgba(255,255,255,${0.1 + lit * 0.4})`,
                  }}
                />
              ) : null}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: `3px solid ${
                      lit > 0.5 ? theme.coffee : "rgba(255,255,255,0.25)"
                    }`,
                    background: lit > 0.5 ? theme.coffee : "transparent",
                    boxShadow:
                      lit > 0.5 ? `0 0 ${12 * lit}px ${theme.coffee}` : "none",
                  }}
                />
                <span
                  style={{
                    fontFamily,
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: 1.5,
                    color:
                      lit > 0.5
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(255,255,255,0.3)",
                  }}
                >
                  {stage}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <ScreenRow
        label="Package revenue"
        value={<CountUp to={1850} startFrame={54} prefix="$" />}
        startFrame={50}
      />
      <ScreenRow
        label="Expenses"
        value={<CountUp to={1310} startFrame={62} prefix="−$" />}
        valueColor={theme.red}
        startFrame={58}
      />
      <ScreenRow
        label="Profit — this event"
        value={<CountUp to={540} startFrame={72} prefix="$" />}
        valueColor={theme.green}
        startFrame={68}
      />
    </div>
  );
};
