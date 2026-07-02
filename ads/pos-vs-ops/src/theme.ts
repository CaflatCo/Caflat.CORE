// Caflat.CORE brand palette, mirrored from landing/css/style.css
export const theme = {
  dark: "#0a0a0b",
  dark2: "#0f0f12",
  darkCard: "#131318",
  darkCard2: "#18181e",
  border: "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.13)",

  textWhite: "#f4f2ee",
  textDim: "rgba(244,242,238,0.50)",
  textMuted: "rgba(244,242,238,0.24)",

  coffee: "#c8a375",
  green: "#3dbd7a",
  red: "#e05c5c",
  amber: "#d4a800",

  // Warm vignette palette — used only in the illustrated scenes,
  // never inside the app mockup screens (those stay monochrome).
  espresso: "#1a120c",
  espresso2: "#241811",
  mocha: "#3a2a1d",
  caramel: "#8a6844",
  latte: "#d9b98c",
  cream: "#f2e3cc",
} as const;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// System stack — no network fetch required at render time.
export const fontFamily =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif";
