import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Nunito — the Caflat.CORE brand font (matches the app's --font-main).
// Loaded from local woff2 files (Google Fonts is unreachable at render
// time in this environment).
const WEIGHTS = ["400", "500", "600", "700", "800", "900"] as const;

export const fontsReady = Promise.all(
  WEIGHTS.map((weight) =>
    loadFont({
      family: "Nunito",
      url: staticFile(`fonts/nunito-latin-${weight}-normal.woff2`),
      weight,
    }),
  ),
);
