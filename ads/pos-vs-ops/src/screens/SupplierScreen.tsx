import React from "react";
import { fontFamily, theme } from "../theme";
import { CountUp, Eyebrow, FlipChip, ScreenRow } from "./screenUi";

/**
 * The delivered box gets marked, payment goes out, balance hits $0.
 */
export const SupplierScreen: React.FC = () => {
  return (
    <div>
      <Eyebrow>Purchase Order #38</Eyebrow>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily,
              fontWeight: 800,
              fontSize: 28,
              color: "#fff",
              marginBottom: 6,
            }}
          >
            Sunrise Bakery
          </div>
          <div
            style={{
              fontFamily,
              fontWeight: 500,
              fontSize: 21,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            24× pastries · delivery
          </div>
        </div>
        <FlipChip before="IN TRANSIT" after="DELIVERED" flipFrame={16} />
      </div>

      <ScreenRow
        label="Invoice total"
        value="$245.00"
        startFrame={30}
      />
      <ScreenRow
        label="Payment sent"
        value={<CountUp to={245} startFrame={48} decimals={2} prefix="$" />}
        valueColor={theme.green}
        startFrame={42}
      />
      <ScreenRow
        label="Outstanding balance"
        value={
          <CountUp from={245} to={0} startFrame={56} decimals={2} prefix="$" />
        }
        valueColor={theme.green}
        startFrame={54}
      />
    </div>
  );
};
