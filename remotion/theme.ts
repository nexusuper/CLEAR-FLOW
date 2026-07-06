import { loadFont as loadFredoka } from "@remotion/google-fonts/Fredoka";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";

// Brand fonts — mirror the website (Fredoka display + Nunito body).
const { fontFamily: displayFont } = loadFredoka("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: bodyFont } = loadNunito("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const DISPLAY = displayFont;
export const BODY = bodyFont;

// Teal palette — kept in sync with styles/globals.css.
export const C = {
  bg: "#e2eff1",
  bgDeep: "#c9dde0",
  surface: "#f2f8f9",
  ink: "#075f73",
  ink2: "#568189",
  muted: "#526e7c",
  light: "#afccd0",
  pale: "#d4ecee",
  sky: "#568189",
  skydeep: "#075f73",
  uv: "#7c3aed",
  uvLight: "#a78bfa",
  uvPale: "#ddd6fe",
  white: "#ffffff",
};

// Soft "clay" shadows as inline strings — derived from bg #e2eff1.
export const clayRaised =
  "16px 16px 36px #b3ccce, -16px -16px 36px #ffffff";
export const clayRaisedSm =
  "10px 10px 22px #b7d0d3, -10px -10px 22px #ffffff";
export const clayInset =
  "inset 8px 8px 16px #b3ccce, inset -8px -8px 16px #ffffff";

// Video config shared across compositions. 4K, kept under 10s total.
export const VIDEO = { fps: 30, width: 3840, height: 2160 };

// Per-scene durations (frames @ 30fps). Sum = total duration (<= 300 = 10s).
export const SCENES = {
  intro: 45,
  station: 165,
  ready: 75,
};
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);
