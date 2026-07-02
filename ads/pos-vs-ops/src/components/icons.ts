// Minimal 24x24 line-icon path data, one per beat. Kept simple so the
// stroke draw-in animation reads clearly at small sizes.
export const MODE_ICONS: Record<string, string[]> = {
  foundation: [
    "M3 5h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z",
    "M8 13h2M8 16.5h6",
    "M8 8.5h8",
  ],
  supplier: [
    "M7 3.5h10a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z",
    "M9 3.5V2.5h6v1",
    "M8.5 9.5h7M8.5 13h7M8.5 16.5h4",
  ],
  production: [
    "M4 5h6v6H4z",
    "M14 5h6v4h-6z",
    "M14 12.5h6v6.5h-6z",
    "M4 14h6v5H4z",
  ],
  events: [
    "M4.5 5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    "M8 3v4M16 3v4M3.5 10h17",
  ],
  origin: [
    "M12 2.5c4 0 7 3.1 7 7 0 5.3-7 12-7 12s-7-6.7-7-12c0-3.9 3-7 7-7z",
    "M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
  treasury: [
    "M3.5 7.5h17a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z",
    "M3 9.5h18",
    "M15.5 14.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  ],
};
