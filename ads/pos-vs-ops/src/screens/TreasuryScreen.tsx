import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily, theme } from "../theme";
import { CountUp, Eyebrow, PopBadge, ScreenRow } from "./screenUi";

/**
 * The supply-run payment lands in the ledger: deduct recorded,
 * balance updates itself.
 */
export const TreasuryScreen: React.FC = () => {
  const frame = useCurrentFrame();

  const balanceOpacity = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div>
      <Eyebrow>Total balance</Eyebrow>
      <div
        style={{
          opacity: balanceOpacity,
          fontFamily,
          fontWeight: 900,
          fontSize: 62,
          color: "#fff",
          fontVariantNumeric: "tabular-nums",
          marginBottom: 34,
        }}
      >
        <CountUp
          from={7160}
          to={7973.6}
          startFrame={50}
          durationFrames={30}
          decimals={2}
          prefix="$"
        />
      </div>

      <Eyebrow>Today</Eyebrow>
      <ScreenRow
        label="Supplies — Cash"
        value="−$86.40"
        valueColor={theme.red}
        startFrame={24}
      />
      <ScreenRow
        label="Owner Deposit — Bank"
        value="+$500.00"
        valueColor={theme.green}
        startFrame={34}
      />
      <ScreenRow
        label="Sales Deposit — Cash"
        value="+$400.00"
        valueColor={theme.green}
        startFrame={44}
      />

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <PopBadge
          text="EVERY TRANSACTION RECORDED"
          color={theme.coffee}
          startFrame={70}
        />
      </div>
    </div>
  );
};
