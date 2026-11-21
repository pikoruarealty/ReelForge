// Word-by-word karaoke captions as ONE composition spanning the whole video (HyperFrames convention:
// a single `captions` host holds every caption group). The band sits in x 130-780, y <= 1248, which
// every platform UI (Reels, Shorts, TikTok action rail) leaves clear. Timing comes from real Whisper words when
// available, otherwise from the narration-based estimate in timing.js.
import {captionGroups} from './timing.js';
import {num, q} from './motion.js';
import {esc} from './layouts.js';

const W = 1080, H = 1920;
const BOTTOM = H - 1240; // caption block sits on the bottom edge of the platform-safe band

export function captionsComposition({words, total}) {
  const groups = captionGroups(words);
  let html = '', js = '';
  groups.forEach((g, gi) => {
    const id = `cg${gi}`;
    const spans = g.words.map((w, wi) => `<span id="${id}-w${wi}" style="display:inline-block;margin:0 .2em;">${esc(w.text.toUpperCase())}</span>`).join(' ');
    html += `<div id="${id}" class="clip" data-start="${g.start}" data-duration="${num(g.end - g.start)}" data-track-index="0" style="position:absolute;left:130px;right:300px;bottom:${BOTTOM}px;display:flex;justify-content:center;">`
      + `<div id="${id}-in" style="max-width:650px;padding:12px 24px 16px;border-radius:28px;background:rgba(24,24,24,.84);color:#fff;font-size:52px;font-weight:900;letter-spacing:-1px;line-height:1.12;text-align:center;">${spans}</div></div>\n`;
    js += `tl.fromTo(${q('#' + id + '-in')},{opacity:0,y:26,scale:.9},{opacity:1,y:0,scale:1,duration:.18,ease:"back.out(1.7)"},${g.start});`;
    g.words.forEach((w, wi) => {
      js += `tl.fromTo(${q('#' + id + '-w' + wi)},{color:"#FFFFFF",scale:1},{color:"#FF7A3D",scale:1.1,duration:.1,ease:"power2.out"},${num(Math.max(g.start, w.start))});`;
    });
  });
  return `<template>
  <style>
    #root{position:absolute;inset:0;font-family:Inter,Arial,Helvetica,sans-serif;}
  </style>
  <div id="root" data-composition-id="captions" data-width="${W}" data-height="${H}">
${html}  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${js}
    window.__timelines["captions"] = tl;
  </script>
</template>
`;
}
