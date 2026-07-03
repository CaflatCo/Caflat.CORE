import nunito500 from "./fontfiles/nunito-latin-500-normal.woff2";
import nunito600 from "./fontfiles/nunito-latin-600-normal.woff2";
import nunito700 from "./fontfiles/nunito-latin-700-normal.woff2";
import nunito800 from "./fontfiles/nunito-latin-800-normal.woff2";
import nunito900 from "./fontfiles/nunito-latin-900-normal.woff2";

// Nunito — the Caflat.CORE brand font (matches the app's --font-main).
// The woff2 files are inlined as data: URIs by webpack (asset/inline in
// remotion.config.ts) and registered fire-and-forget via the FontFace
// API — deliberately WITHOUT Remotion's delayRender: on very heavy 4K
// frames the page can be too starved to clear the handle in time, and
// the render dies with a misleading font-loading timeout. Decoding a
// data: URI font is near-instant on any page healthy enough to render
// a frame, so gating the render on it buys nothing.
const FONTS: [string, string][] = [
  ["500", nunito500],
  ["600", nunito600],
  ["700", nunito700],
  ["800", nunito800],
  ["900", nunito900],
];

export const fontsReady =
  typeof document === "undefined"
    ? Promise.resolve([])
    : Promise.all(
        FONTS.map(([weight, url]) => {
          const font = new FontFace("Nunito", `url('${url}') format('woff2')`, {
            weight,
          });
          return font
            .load()
            .then((loaded) => {
              document.fonts.add(loaded);
              return loaded;
            })
            .catch(() => null);
        }),
      );
