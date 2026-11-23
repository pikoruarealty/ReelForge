// GSAP motion vocabulary for scene timelines. Every function returns a string of GSAP statements that
// run inside a scene's paused timeline `tl`. All motion is a pure function of timeline time: no timers,
// no Math.random (variants are picked here at build time from a seeded PRNG).
//
// Craft rules applied (from HyperFrames' motion guide):
//  - ease by role: arrivals on long tails (expo/power4.out), camera moves ease both ways
//  - vary the entrance across scenes; never the same rise+fade everywhere
//  - a landed title stays still; motion moves to the next element or the world behind it

export const num = (n) => Number(Number(n).toFixed(3));
export const q = (s) => JSON.stringify(s);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ENTRANCES = ['maskWords', 'blurWords', 'slamWords', 'dropWords'];

// Word entrances. `sel` is a CSS selector matching the inner word spans (.wi).
export function enterWords(sel, kind, at, {stagger = 0.085} = {}) {
  const s = q(sel);
  switch (kind) {
    case 'blurWords':
      return `tl.fromTo(${s},{opacity:0,y:30,filter:"blur(10px)"},{opacity:1,y:0,filter:"blur(0px)",duration:.5,ease:"power3.out",stagger:${stagger}},${num(at)});`;
    case 'slamWords':
      return `tl.fromTo(${s},{opacity:0,scale:1.7,y:-30,rotation:-4,transformOrigin:"50% 70%"},{opacity:1,scale:1,y:0,rotation:0,duration:.46,ease:"expo.out",stagger:${stagger + 0.02}},${num(at)});`;
    case 'dropWords':
      return `tl.fromTo(${s},{opacity:0,y:-120,rotation:5},{opacity:1,y:0,rotation:0,duration:.62,ease:"back.out(1.5)",stagger:${stagger}},${num(at)});`;
    case 'maskWords':
    default:
      return `tl.fromTo(${s},{yPercent:118},{yPercent:0,duration:.66,ease:"expo.out",stagger:${stagger}},${num(at)});`;
  }
}

// The frame-0 hook: the headline is already on screen (it is the thumbnail), it only settles.
export function settleHook(sel) {
  return `tl.fromTo(${q(sel)},{scale:1.07,transformOrigin:"0% 50%"},{scale:1,duration:.7,ease:"expo.out"},0);`;
}

// Slow camera move on an image wrapper. Direction and depth vary per scene so reused images differ.
export function kenBurns(id, D, rng, {zoom = 0.12, base = 1.04} = {}) {
  const dir = [[-1, -1], [1, -1], [-1, 1], [1, 1]][Math.floor(rng() * 4)];
  const px = 22 + Math.floor(rng() * 26), py = 18 + Math.floor(rng() * 24);
  return `tl.fromTo(${q('#' + id)},{scale:${num(base)},x:${dir[0] * px},y:${dir[1] * py}},{scale:${num(base + zoom)},x:${-dir[0] * px},y:${-dir[1] * py},duration:${num(D)},ease:"none"},0);`;
}

// Scene-to-scene transitions. The incoming scene is hosted `ov` seconds before its slot starts and plays
// this over the outgoing one, so every cut has a visible cause. Edge bar rides the wipe's leading edge.
export function transitionIn(kind, p, ov) {
  const stage = q(`#${p}-stage`), edge = q(`#${p}-edge`);
  if (!ov) return '';
  const d = num(ov);
  switch (kind) {
    case 'wipe':
      return `tl.fromTo(${stage},{clipPath:"inset(0% 100% 0% 0%)"},{clipPath:"inset(0% 0% 0% 0%)",duration:${d},ease:"power3.inOut"},0);`
        + `tl.fromTo(${edge},{x:-24,opacity:1},{x:1080,opacity:1,duration:${d},ease:"power3.inOut"},0);`;
    case 'zoom':
      return `tl.fromTo(${stage},{clipPath:"circle(0% at 50% 55%)"},{clipPath:"circle(82% at 50% 55%)",duration:${d},ease:"power3.in"},0);`
        + `tl.fromTo(${stage},{scale:1.14,transformOrigin:"50% 55%"},{scale:1,duration:${num(ov * 1.5)},ease:"power3.out"},0);`;
    case 'pop':
      return `tl.fromTo(${stage},{clipPath:"inset(100% 0% 0% 0%)"},{clipPath:"inset(0% 0% 0% 0%)",duration:${d},ease:"power3.inOut"},0);`
        + `tl.fromTo(${edge},{y:1944,opacity:1},{y:-24,opacity:1,duration:${d},ease:"power3.inOut"},0);`;
    case 'slide':
    default:
      return `tl.fromTo(${stage},{x:1080},{x:0,duration:${d},ease:"power3.inOut"},0);`;
  }
}

export const edgeStyle = (kind) => (kind === 'pop'
  ? 'position:absolute;left:0;top:0;width:1080px;height:24px;background:#E65323;opacity:0;'
  : 'position:absolute;left:0;top:0;width:24px;height:1920px;background:#E65323;opacity:0;');
