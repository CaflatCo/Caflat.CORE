import React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";

type SfxEvent = { file: string; frame: number; volume?: number };

/**
 * Every sound effect in the film, as absolute composition frames.
 * Scene starts (see ShowcaseAd): cold open 0, vignettes at
 * 102 / 280 / 448 / 616 / 794 / 982, flash 1182, payoff 1322,
 * end card 1424. Screen content starts (tablet reveal + 10):
 * 182 / 378 / 542 / 716 / 896 / 1082.
 */
const EVENTS: SfxEvent[] = [
  // ── cold open ──
  { file: "whoosh", frame: 0, volume: 0.35 },

  // ── slide transitions between vignettes ──
  { file: "whoosh", frame: 269, volume: 0.45 },
  { file: "whoosh", frame: 437, volume: 0.45 },
  { file: "whoosh", frame: 605, volume: 0.45 },
  { file: "whoosh", frame: 783, volume: 0.45 },
  { file: "whoosh", frame: 971, volume: 0.45 },

  // ── match-cuts (illustration → tablet) ──
  { file: "whoosh", frame: 172, volume: 0.4 },
  { file: "whoosh", frame: 368, volume: 0.4 },
  { file: "whoosh", frame: 532, volume: 0.4 },
  { file: "whoosh", frame: 706, volume: 0.4 },
  { file: "whoosh", frame: 886, volume: 0.4 },
  { file: "whoosh", frame: 1072, volume: 0.4 },

  // ── POS (screen at 182) ──
  { file: "tap", frame: 192, volume: 0.6 },
  { file: "alert", frame: 260, volume: 0.45 },

  // ── Supplier: handoff check (illustration), delivered, payment ──
  { file: "thud", frame: 332, volume: 0.55 }, // box transfer settles
  { file: "ding", frame: 348, volume: 0.4 }, // gold check pops
  { file: "ding", frame: 394, volume: 0.5 }, // DELIVERED flip
  { file: "cash", frame: 426, volume: 0.5 }, // payment sent

  // ── Production: card crosses the board ──
  { file: "whoosh", frame: 568, volume: 0.3 },
  { file: "chime", frame: 590, volume: 0.45 }, // lands in COMPLETED

  // ── Events: pipeline dots + profit ──
  { file: "blip", frame: 726, volume: 0.5 },
  { file: "blip", frame: 738, volume: 0.5 },
  { file: "blip", frame: 750, volume: 0.5 },
  { file: "blip", frame: 762, volume: 0.5 },
  { file: "cash", frame: 788, volume: 0.45 }, // profit resolves

  // ── Origin: scan, chips, typing, recorded ──
  { file: "scan", frame: 822, volume: 0.45 },
  { file: "blip", frame: 840, volume: 0.45 },
  { file: "blip", frame: 847, volume: 0.45 },
  { file: "blip", frame: 854, volume: 0.45 },
  { file: "blip", frame: 861, volume: 0.45 },
  { file: "ticks", frame: 904, volume: 0.5 },
  { file: "ticks", frame: 922, volume: 0.5 },
  { file: "ticks", frame: 940, volume: 0.5 },
  { file: "ticks", frame: 954, volume: 0.5 },
  { file: "chime", frame: 978, volume: 0.45 }, // lot recorded

  // ── Treasury: items land, card tap, receipt, recorded ──
  { file: "thud", frame: 1006, volume: 0.4 },
  { file: "thud", frame: 1014, volume: 0.4 },
  { file: "thud", frame: 1022, volume: 0.4 },
  { file: "tap", frame: 1030, volume: 0.6 }, // card tap
  { file: "print", frame: 1036, volume: 0.45 },
  { file: "blip", frame: 1106, volume: 0.4 }, // ledger rows land
  { file: "blip", frame: 1116, volume: 0.4 },
  { file: "blip", frame: 1126, volume: 0.4 },
  { file: "chime", frame: 1152, volume: 0.45 }, // recorded badge

  // ── pivot into the recap ──
  { file: "riser", frame: 1146, volume: 0.55 },
  { file: "impact", frame: 1182, volume: 0.6 },

  // ── rapid flash cards ──
  { file: "impact", frame: 1196, volume: 0.3 },
  { file: "impact", frame: 1226, volume: 0.3 },
  { file: "impact", frame: 1256, volume: 0.3 },
  { file: "impact", frame: 1286, volume: 0.3 },
  { file: "impact", frame: 1316, volume: 0.3 },

  // ── payoff + end card ──
  { file: "ding", frame: 1362, volume: 0.3 }, // gold line draws
  { file: "whoosh", frame: 1424, volume: 0.35 },
  { file: "tap", frame: 1484, volume: 0.5 }, // CTA pulse
];

export const SfxTrack: React.FC = () => {
  return (
    <>
      {EVENTS.map((e, i) => (
        <Sequence key={i} from={e.frame} layout="none">
          <Audio src={staticFile(`sfx/${e.file}.wav`)} volume={e.volume ?? 0.5} />
        </Sequence>
      ))}
    </>
  );
};
