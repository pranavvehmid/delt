// The DELT wordmark as shapes (no font needed), for app icons on every platform.
// Heavy "DELT" with the red dot, centred in a 108×108 box and inside Android's 66-unit safe circle.
// android/.../drawable/ic_launcher_foreground.xml uses the same path (checked in tests/logo.test.ts).
export const WORDMARK =
  "M25 45H30A9 9 0 0 1 30 63H25Z M29.4 49.4H30A4.6 4.6 0 0 1 30 58.6H29.4Z " + // D
  "M41 45H51V49.2H45.4V51.9H50V56.1H45.4V58.8H51V63H41Z " + // E
  "M53 45H57.4V58.8H62V63H53Z " + // L
  "M63.5 45H75.5V49.2H71.7V63H67.3V49.2H63.5Z"; // T
export const DOT = { cx: 79.6, cy: 60.5, r: 2.5 };
export const INK = "#1c1917";
export const RED = "#c8102e";
export const PAPER = "#fafaf9";
