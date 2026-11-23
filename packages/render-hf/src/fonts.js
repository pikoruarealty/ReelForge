// Fonts for Latin + Devanagari (Hindi) text.
//
// HyperFrames bundles Inter and a few others, but only their Latin glyphs. Hindi (Devanagari) text would fall back to whatever the
// machine has, which differs between computers and breaks determinism. So Noto Sans Devanagari (SIL OFL) ships with the renderer and
// is declared with @font-face in every scene. Inter stays first in the stack: Latin glyphs come from Inter, Devanagari from Noto.
export const FONT_STACK = 'Inter,"Noto Sans Devanagari",Arial,Helvetica,sans-serif';
export const DEV_RE = /[\u0900-\u097F]/;
export const hasDevanagari = (text) => DEV_RE.test(String(text ?? ''));
export const fontFaceCss = () => '@font-face{font-family:"Noto Sans Devanagari";src:url("assets/fonts/NotoSansDevanagari.ttf") format("truetype");font-weight:100 900;font-style:normal;}';
