// Persistent brand chrome shared by every scene: the PropShort chip and a progress line.
// Sits above the platform UI band by design (brand marks and progress are texture, not reading copy).
import {P} from './layouts.js';
import {num} from './motion.js';
import {FONT_STACK} from './fonts.js';

const W = 1080, H = 1920;

export function chromeComposition({total, fontCss = ''}) {
  return `<template>
  <style>
    ${fontCss}
    #root{position:absolute;inset:0;font-family:${FONT_STACK};}
  </style>
  <div id="root" data-composition-id="chrome" data-width="${W}" data-height="${H}">
    <div id="chrome-brand" class="clip" data-start="0" data-duration="${num(total)}" data-track-index="0" data-layout-ignore style="position:absolute;top:128px;left:72px;display:flex;align-items:center;gap:12px;padding:8px 22px 8px 8px;border-radius:40px;background:rgba(255,255,255,.94);">
      <span style="background:${P.orange};color:#fff;font-size:28px;font-weight:900;border-radius:30px;padding:8px 14px;letter-spacing:-1px;">PS</span>
      <span style="font-size:32px;font-weight:900;letter-spacing:-1px;color:${P.ink};">PropShort</span>
    </div>
    <div id="chrome-bar" class="clip" data-start="0" data-duration="${num(total)}" data-track-index="1" style="position:absolute;top:88px;left:72px;width:936px;height:7px;border-radius:6px;background:${P.orange};"></div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#chrome-bar",{scaleX:0,transformOrigin:"0% 50%"},{scaleX:1,duration:${num(total)},ease:"none"},0);
    window.__timelines["chrome"] = tl;
  </script>
</template>
`;
}
