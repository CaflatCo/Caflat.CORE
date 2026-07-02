import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { ShowcaseHookScene } from "./scenes/ShowcaseHookScene";
import { ModeBeat, ModeBeatProps } from "./scenes/ModeBeat";
import { RapidFlashScene, RAPID_FLASH_DURATION } from "./scenes/RapidFlashScene";
import { ShowcasePayoffScene } from "./scenes/ShowcasePayoffScene";
import { ShowcaseEndCard } from "./scenes/ShowcaseEndCard";
import { theme } from "./theme";

const HOOK_DUR = 110;
const BEAT_DUR = 90;
const FOUNDATION_DUR = 95;
const PAYOFF_DUR = 110;
const ENDCARD_DUR = 130;

const T_FADE_LONG = 18;
const T_SLIDE = 14;
const T_FADE_SHORT = 16;

export const BEATS: ModeBeatProps[] = [
  {
    index: "00",
    badge: "The Foundation",
    headline: ["One counter.", "Everything connected."],
    eyebrow: "LIVE ON EVERY SALE",
    rows: [
      { label: "Order #142", value: "$18.50" },
      { label: "Butter", value: "420g left" },
      { label: "Today's Revenue", value: "$2,340", accent: true },
    ],
  },
  {
    index: "01",
    badge: "Supplier Mode",
    headline: ["Know what's owed.", "Nothing slips through."],
    eyebrow: "OPEN ORDERS",
    rows: [
      { label: "Kalsada Roasters", value: "$245 due" },
      { label: "Dayrit Farms", value: "$0 due" },
      { label: "Next Delivery", value: "Jul 6", accent: true },
    ],
  },
  {
    index: "02",
    badge: "Production Mode",
    headline: ["Built to run.", "Tracked to the batch."],
    eyebrow: "TODAY'S JOBS",
    rows: [
      { label: "Croissant Batch #12", value: "In Progress" },
      { label: "Cost per Unit", value: "$0.86" },
      { label: "Waste Logged", value: "2.1%", accent: true },
    ],
  },
  {
    index: "03",
    badge: "Events Mode",
    headline: ["Take your coffee", "beyond the counter."],
    eyebrow: "PIPELINE",
    rows: [
      { label: "Corporate — 200 pax", value: "Booked" },
      { label: "Market Weekend", value: "Quoted" },
      { label: "Profit per Event", value: "$540", accent: true },
    ],
  },
  {
    index: "04",
    badge: "Origin Mode",
    headline: ["Traceability that", "tells a story."],
    eyebrow: "LOT TRACKING",
    rows: [
      { label: "Lot #A-114", value: "Benguet, PH" },
      { label: "Process", value: "Washed" },
      { label: "Status", value: "Roasted", accent: true },
    ],
  },
  {
    index: "05",
    badge: "Treasury",
    headline: ["Every transaction,", "accounted for."],
    eyebrow: "TOTAL BALANCE",
    rows: [
      { label: "Cash on Hand", value: "$1,240" },
      { label: "Bank", value: "$5,920" },
      { label: "Today's Net", value: "+$180", accent: true },
    ],
  },
];

export const calculateShowcaseDuration = () => {
  const beatDurations = [FOUNDATION_DUR, ...BEATS.slice(1).map(() => BEAT_DUR)];
  const slideTransitions = beatDurations.length - 1; // between consecutive beats
  const sumScenes =
    HOOK_DUR +
    beatDurations.reduce((a, b) => a + b, 0) +
    RAPID_FLASH_DURATION +
    PAYOFF_DUR +
    ENDCARD_DUR;
  const sumTransitions =
    T_FADE_LONG + // hook -> beat 00
    slideTransitions * T_SLIDE + // between beats
    T_FADE_SHORT + // last beat -> rapid flash
    T_FADE_LONG + // rapid flash -> payoff
    T_FADE_LONG; // payoff -> end card
  return sumScenes - sumTransitions;
};

export const ShowcaseAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.dark }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_DUR}>
          <ShowcaseHookScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE_LONG })}
        />

        <TransitionSeries.Sequence durationInFrames={FOUNDATION_DUR}>
          <ModeBeat {...BEATS[0]} />
        </TransitionSeries.Sequence>

        {BEATS.slice(1).map((beat, i) => (
          <React.Fragment key={beat.index}>
            <TransitionSeries.Transition
              presentation={slide({
                direction: i % 2 === 0 ? "from-right" : "from-left",
              })}
              timing={linearTiming({ durationInFrames: T_SLIDE })}
            />
            <TransitionSeries.Sequence durationInFrames={BEAT_DUR}>
              <ModeBeat {...beat} />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE_SHORT })}
        />

        <TransitionSeries.Sequence durationInFrames={RAPID_FLASH_DURATION}>
          <RapidFlashScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE_LONG })}
        />

        <TransitionSeries.Sequence durationInFrames={PAYOFF_DUR}>
          <ShowcasePayoffScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE_LONG })}
        />

        <TransitionSeries.Sequence durationInFrames={ENDCARD_DUR}>
          <ShowcaseEndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
