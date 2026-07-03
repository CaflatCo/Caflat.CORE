import React from "react";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { LightLeak } from "@remotion/light-leaks";
import { Audio } from "@remotion/media";
import { ColdOpen } from "./scenes/ColdOpen";
import { ModeVignette, ModeVignetteProps } from "./scenes/ModeVignette";
import {
  RapidFlashScene,
  RAPID_FLASH_DURATION,
} from "./scenes/RapidFlashScene";
import { ShowcasePayoffScene } from "./scenes/ShowcasePayoffScene";
import { ShowcaseEndCard } from "./scenes/ShowcaseEndCard";
import { MODE_ICONS } from "./components/icons";
import { EspressoCup } from "./components/illustrations/EspressoCup";
import { SupplierHandoff } from "./components/illustrations/SupplierHandoff";
import { KneadingHands } from "./components/illustrations/KneadingHands";
import { CoffeeCartRide } from "./components/illustrations/CoffeeCartRide";
import { BeanBagScan } from "./components/illustrations/BeanBagScan";
import { CashierCounter } from "./components/illustrations/CashierCounter";
import { PosScreen } from "./screens/PosScreen";
import { SupplierScreen } from "./screens/SupplierScreen";
import { ProductionScreen } from "./screens/ProductionScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { OriginScreen } from "./screens/OriginScreen";
import { TreasuryScreen } from "./screens/TreasuryScreen";
import { theme } from "./theme";

const COLD_OPEN_DUR = 120;
const PAYOFF_DUR = 120;
const ENDCARD_DUR = 130;

const T_FADE = 18;
const T_FADE_SLOW = 24;
const T_SLIDE = 22;
const LIGHT_LEAK_DUR = 40;

type VignetteDef = ModeVignetteProps & { key: string; duration: number };

const VIGNETTES: VignetteDef[] = [
  {
    key: "pos",
    label: "Point of Sale",
    icon: MODE_ICONS.foundation,
    Illustration: EspressoCup,
    Screen: PosScreen,
    screenTitle: "Checkout",
    illustrationFrames: 70,
    duration: 200,
  },
  {
    key: "supplier",
    label: "Supplier Mode",
    icon: MODE_ICONS.supplier,
    Illustration: SupplierHandoff,
    Screen: SupplierScreen,
    screenTitle: "Suppliers",
    illustrationFrames: 88,
    duration: 190,
  },
  {
    key: "production",
    label: "Production Mode",
    icon: MODE_ICONS.production,
    Illustration: KneadingHands,
    Screen: ProductionScreen,
    screenTitle: "Production",
    illustrationFrames: 84,
    duration: 190,
  },
  {
    key: "events",
    label: "Events Mode",
    icon: MODE_ICONS.events,
    Illustration: CoffeeCartRide,
    Screen: EventsScreen,
    screenTitle: "Events",
    illustrationFrames: 90,
    duration: 200,
  },
  {
    key: "origin",
    label: "Origin Mode",
    icon: MODE_ICONS.origin,
    Illustration: BeanBagScan,
    Screen: OriginScreen,
    screenTitle: "Origin",
    illustrationFrames: 92,
    duration: 210,
  },
  {
    key: "treasury",
    label: "Treasury",
    icon: MODE_ICONS.treasury,
    Illustration: CashierCounter,
    Screen: TreasuryScreen,
    screenTitle: "Treasury",
    illustrationFrames: 90,
    duration: 200,
  },
];

export const calculateShowcaseDuration = () => {
  const sumScenes =
    COLD_OPEN_DUR +
    VIGNETTES.reduce((a, v) => a + v.duration, 0) +
    RAPID_FLASH_DURATION +
    PAYOFF_DUR +
    ENDCARD_DUR;
  const sumTransitions =
    T_FADE + // cold open -> first vignette
    (VIGNETTES.length - 1) * T_SLIDE + // between vignettes
    // last vignette -> rapid flash: hard cut under a LightLeak overlay
    T_FADE_SLOW + // rapid flash -> payoff (unhurried)
    T_FADE; // payoff -> end card
  return sumScenes - sumTransitions;
};

export const ShowcaseAd: React.FC = () => {
  const totalDuration = calculateShowcaseDuration();

  return (
    <AbsoluteFill style={{ backgroundColor: theme.dark }}>
      {/* quiet music bed under the SFX */}
      <Audio
        src={staticFile("bg-music.mp3")}
        volume={(f: number) =>
          interpolate(
            f,
            [0, 30, totalDuration - 60, totalDuration],
            [0, 0.22, 0.22, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={COLD_OPEN_DUR}>
          <ColdOpen />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE })}
        />

        {VIGNETTES.map((vignette, i) => (
          <React.Fragment key={vignette.key}>
            {i > 0 ? (
              <TransitionSeries.Transition
                presentation={slide({
                  direction: i % 2 === 1 ? "from-right" : "from-left",
                })}
                timing={springTiming({
                  config: { damping: 200 },
                  durationInFrames: T_SLIDE,
                })}
              />
            ) : null}
            <TransitionSeries.Sequence durationInFrames={vignette.duration}>
              <ModeVignette {...vignette} />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}

        {/* light leak punctuates the pivot into the recap */}
        <TransitionSeries.Overlay durationInFrames={LIGHT_LEAK_DUR}>
          <LightLeak seed={3} hueShift={0} />
        </TransitionSeries.Overlay>

        <TransitionSeries.Sequence durationInFrames={RAPID_FLASH_DURATION}>
          <RapidFlashScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE_SLOW })}
        />

        <TransitionSeries.Sequence durationInFrames={PAYOFF_DUR}>
          <ShowcasePayoffScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T_FADE })}
        />

        <TransitionSeries.Sequence durationInFrames={ENDCARD_DUR}>
          <ShowcaseEndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
