import { loadFont } from "@remotion/fonts";
import nunito500 from "./fontfiles/nunito-latin-500-normal.woff2";
import nunito600 from "./fontfiles/nunito-latin-600-normal.woff2";
import nunito700 from "./fontfiles/nunito-latin-700-normal.woff2";
import nunito800 from "./fontfiles/nunito-latin-800-normal.woff2";
import nunito900 from "./fontfiles/nunito-latin-900-normal.woff2";

// Nunito — the Caflat.CORE brand font (matches the app's --font-main).
// The woff2 files are inlined as data: URIs by webpack (asset/inline in
// remotion.config.ts), so font loading never touches the network — a
// render-page restart once stalled fetching these over HTTP and timed
// out the whole render.
const FONTS: [string, string][] = [
  ["500", nunito500],
  ["600", nunito600],
  ["700", nunito700],
  ["800", nunito800],
  ["900", nunito900],
];

export const fontsReady = Promise.all(
  FONTS.map(([weight, url]) =>
    loadFont({ family: "Nunito", url, format: "woff2", weight }),
  ),
);
