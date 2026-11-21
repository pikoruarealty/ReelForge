// HyperFrames scene layouts for ReelForge (1080x1920, PropShort brand).
//
// Each builder returns {html, js}: absolutely positioned markup plus the GSAP statements that animate it
// inside the scene's paused timeline `tl`. Ids are prefixed with the scene id (`c.p`) because ids must be
// unique across the assembled page.
//
// Design rules (HyperFrames vertical guide + motion guide, plus feedback from real runs):
//  - text lives inside the Reels/TikTok/Shorts safe zone (SAFE); imagery may bleed to the edges
//  - one hero idea per scene, titles big: hero words 60-90% of the width
//  - things ENTER, then HOLD STILL. No continuous zoom or drift on pictures: motion happens on speech moments
//    (clause breaks, spoken key words) so picture and voice land together
//  - uploaded screenshots are shown whole in a device frame (never cropped, never full-bleed)
//  - entrance style varies per scene (c.entrance); frame 0 of the video already shows the hook
//
// The 18 creative-director layout names are kept (they come from creative plans and saved jobs) and map onto
// 8 designed families with per-name variations. Scenes whose picture is an uploaded screenshot render as PROOF.

import {num, q, enterWords, settleHook} from './motion.js';
import {spokenAt} from './beats.js';
import {splitWords} from './timing.js';

export const P = {orange: '#E65323', hot: '#FF7A3D', coral: '#F17643', ink: '#181818', cream: '#F8F5F0', peach: '#F6DACA', white: '#FFFFFF', muted: '#756E69'};
// Intersection of the Reels, Shorts and TikTok zones HyperFrames checks: text x 130-880 above y 840, x 130-780 below it.
export const SAFE = {l: 130, r: 880, w: 750, t: 300, b: 1240, lowW: 650};
const OVF = 'data-layout-allow-overflow';
const OVL = 'data-layout-allow-overlap';

export const clean = (t, n = 115) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const join = (...parts) => parts.filter(Boolean).reduce((a, p) => ({html: a.html + p.html, js: a.js + p.js}), {html: '', js: ''});
const box = (id, css, inner = '', attrs = '') => `<div id="${id}" ${attrs} style="position:absolute;${css}">${inner}</div>`;

// ---- copy -------------------------------------------------------------------------------------------------------

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'are', 'was', 'from', 'what', 'why', 'how', 'will', 'can', 'not', 'but', 'about']);

export function headlineText(scene, max = 80) {
  return clean(scene?.graphic?.headline || scene?.subtitle || scene?.narration, max);
}
const subText = (scene, max = 90) => clean(scene?.graphic?.subheading || '', max);

// The one word that carries the meaning gets the accent colour.
export function pickHighlight(words, hint) {
  const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%₹]/gu, '');
  if (hint) { const i = words.findIndex((w) => norm(w) === norm(hint)); if (i >= 0) return i; }
  const digit = words.findIndex((w) => /\d/.test(w));
  if (digit >= 0) return digit;
  let best = -1, len = 4;
  words.forEach((w, i) => { const n = norm(w); if (n.length > len && !STOP.has(n)) { best = i; len = n.length; } });
  return best;
}

// Greedy wrap estimate so a headline can be sized to fit its box without measuring in a browser.
// Calibrated against real renders: Inter 900 averages ~.56-.62em per mixed-case letter (digits, # and : are wider), ~.70-.76em per capital, ~.27em per space.
function fit(words, {width, max, min, lines, factor, maxH = 0}) {
  for (let s = max; s >= min; s -= 4) {
    const cw = s * factor, sp = s * 0.27;
    let ln = 1, cur = 0, ok = true;
    for (const w of words) {
      const wl = w.length * cw;
      if (wl > width) { ok = false; break; }
      if (cur === 0) cur = wl; else if (cur + sp + wl <= width) cur += sp + wl; else { ln++; cur = wl; }
    }
    if (ok && ln <= lines && (!maxH || ln * s * 1.21 + s * 0.06 <= maxH)) return {size: s, lines: ln};
  }
  return {size: min, lines};
}

// ---- building blocks --------------------------------------------------------------------------------------------

// Headline made of independently animated words. Returns h (estimated height) so the next element can stack under it.
function headline(c, id, text, {top, left = SAFE.l, width = SAFE.w, max = 120, min = 64, lines = 4, upper = false, color, hiColor = P.orange, at = 0, hero = false, align = 'left', chip = false, maxH = 0, flow = false}) {
  const words = splitWords(clean(text, 96));
  if (!words.length) return {html: '', js: '', h: 0};
  const hi = pickHighlight(words, c.scene?.graphic?.highlight);
  // Copy that is already upper-case (Claude's subtitles often are) is as wide as CSS-uppercased copy.
  const lettersOnly = words.join('').replace(/[^A-Za-z]/g, '');
  const caps = upper || (lettersOnly.length > 2 && lettersOnly === lettersOnly.toUpperCase());
  const {size, lines: ln} = fit(words.map((w) => (caps ? w.toUpperCase() : w)), {width, max, min, lines, factor: caps ? 0.76 : 0.62, maxH});
  // The first frame is the thumbnail: the scene-0 headline is on screen at 0 s and only settles.
  const firstFrame = c.index === 0 && (hero || id === 'h');
  const clip = c.entrance === 'maskWords' && !firstFrame;
  const base = color || P.ink;
  const i = `${c.p}-${id}`;
  // The accent word lights up at the moment the voice says it (not at scene start), so emphasis lands with the speech.
  const hint = c.scene?.graphic?.highlight;
  const spoken = hi >= 0 ? (spokenAt(c.words || [], words[hi], null) ?? spokenAt(c.words || [], hint, null)) : null;
  const hiAt = Math.max(c.t0 + 0.45, Math.min(spoken ?? c.t0 + 0.9, firstFrame ? 1 : 99));
  const hiStyle = chip
    ? `color:#fff;background:linear-gradient(${P.orange},${P.orange}) no-repeat 0 50%/0% 100%;border-radius:.12em;padding:0 .12em;`
    : `color:${base};`;
  const spans = words.map((w, k) => `<span style="display:inline-block;${clip ? 'overflow:hidden;' : ''}vertical-align:top;padding:.05em .03em .12em 0;margin-right:.22em;"><span class="wi"${k === hi ? ` id="${i}-hi"` : ''} style="display:inline-block;${k === hi ? hiStyle : ''}">${esc(w)}</span></span>`).join('');
  const h = Math.round(ln * size * 1.21 + size * 0.06);
  let js = firstFrame ? settleHook(`#${i}`) : enterWords(`#${i} .wi`, c.entrance, c.t0 + at);
  if (hi >= 0 && chip) js += `tl.fromTo(${q('#' + i + '-hi')},{backgroundSize:"0% 100%"},{backgroundSize:"100% 100%",duration:.4,ease:"power3.out"},${num(hiAt)});`;
  else if (hi >= 0 && hiColor !== base) js += `tl.fromTo(${q('#' + i + '-hi')},{color:${q(base)}},{color:${q(hiColor)},duration:.25,ease:"power2.out"},${num(hiAt)});`;
  return {
    html: box(i, `${flow ? 'position:relative;' : `top:${top}px;left:${left}px;`}width:${width}px;font-size:${size}px;font-weight:900;letter-spacing:${num(-size * 0.028)}px;line-height:1.04;text-align:${align};${upper ? 'text-transform:uppercase;' : ''}color:${base};`, spans),
    js, h, size,
  };
}

// Text that must sit one under another goes in a flowing column: the browser measures the real height, so a headline that wraps
// to more lines than estimated pushes the rule and sub-line down instead of running into them.
function stack(c, id, parts, {top = 392, gap = 26} = {}) {
  const live = parts.filter(Boolean);
  return {
    html: box(`${c.p}-${id}`, `top:${top}px;left:${SAFE.l}px;width:${SAFE.w}px;display:flex;flex-direction:column;align-items:flex-start;gap:${gap}px;`, live.map((x) => x.html).join('')),
    js: live.map((x) => x.js).join(''),
  };
}

function kicker(c, text, {top = SAFE.t, left = SAFE.l, bg = P.orange, color = P.white, at = 0}) {
  const i = `${c.p}-k`;
  return {
    html: box(i, `top:${top}px;left:${left}px;padding:10px 24px;border-radius:40px;background:${bg};color:${color};font-size:28px;font-weight:900;letter-spacing:3.5px;white-space:nowrap;`, esc(text)),
    js: `tl.fromTo(${q('#' + i)},{opacity:0,x:-36},{opacity:1,x:0,duration:.5,ease:"expo.out"},${num(c.t0 + at)});`,
  };
}

function rule(c, id, {top, left = SAFE.l, width = 260, color = P.orange, at = 0.5, flow = false}) {
  const i = `${c.p}-${id}`;
  return {
    html: box(i, `${flow ? 'position:relative;flex:none;' : `top:${top}px;left:${left}px;`}width:${width}px;height:14px;border-radius:10px;background:${color};`),
    js: `tl.fromTo(${q('#' + i)},{scaleX:0,transformOrigin:"0% 50%"},{scaleX:1,duration:.7,ease:"expo.out"},${num(c.t0 + at)});`,
  };
}

function subline(c, id, text, {top, color = P.white, at = 0.55, size = 46, flow = false}) {
  if (!text) return null;
  const i = `${c.p}-${id}`;
  return {
    html: box(i, `${flow ? 'position:relative;' : `top:${top}px;left:${SAFE.l}px;`}width:${SAFE.lowW}px;font-size:${size}px;font-weight:700;line-height:1.2;color:${color};opacity:.88;`, esc(text)),
    js: `tl.fromTo(${q('#' + i)},{opacity:0,y:24},{opacity:.88,y:0,duration:.6,ease:"power3.out"},${num(c.t0 + at)});`,
  };
}

// Backdrops. 'photo' = full-bleed image under a legibility gradient. The others are brand colour fields with a faint grid and
// slowly drifting light, used when no real picture exists (placeholder art never shows full-frame) and for rhythm between scenes.
function backdrop(c, mode) {
  const id = `${c.p}-back`;
  if (mode === 'photo' && c.img?.src) {
    const base = c.img.reused ? 1.2 : 1;
    const origin = ['30% 35%', '70% 35%', '35% 65%', '65% 60%'][Math.floor(c.rng() * 4)];
    // The picture settles in once, then holds still. A longer scene gets ONE cut-in on a speech beat, not a creeping zoom.
    const at = (c.beats || []).length && c.D > 4.5 ? Math.max(1.6, c.beats[Math.floor(c.beats.length / 2)]) : null;
    return {
      html: `<div id="${id}" style="position:absolute;inset:0;overflow:hidden;background:${P.ink};">`
        + `<div id="${c.p}-kb" ${OVF} style="position:absolute;inset:0;"><img src="${c.img.src}" alt="" style="display:block;width:100%;height:100%;object-fit:cover;"></div>`
        + `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,24,24,.78) 0%,rgba(24,24,24,.40) 34%,rgba(24,24,24,.52) 66%,rgba(24,24,24,.9) 100%);"></div>`
        + `<div style="position:absolute;left:0;bottom:0;width:1080px;height:760px;background:radial-gradient(60% 70% at 0% 100%,rgba(230,83,35,.34),rgba(230,83,35,0));"></div></div>`,
      js: `tl.fromTo(${q('#' + c.p + '-kb')},{scale:${num(base + 0.07)},transformOrigin:"${origin}"},{scale:${num(base)},transformOrigin:"${origin}",duration:1.1,ease:"expo.out"},0);`
        + (at ? `tl.fromTo(${q('#' + c.p + '-kb')},{scale:${num(base)},transformOrigin:"${origin}"},{scale:${num(base + 0.16)},transformOrigin:"${origin}",duration:.55,ease:"expo.out"},${num(at)});` : ''),
    };
  }
  const dark = mode !== 'cream' && mode !== 'orange';
  const bg = mode === 'cream' ? P.cream : mode === 'orange' ? P.orange : P.ink;
  const glowA = mode === 'orange' ? 'rgba(255,255,255,.20)' : 'rgba(230,83,35,.55)';
  const glowB = mode === 'orange' ? 'rgba(24,24,24,.18)' : mode === 'cream' ? 'rgba(246,218,202,.9)' : 'rgba(241,118,67,.28)';
  const line = mode === 'cream' ? 'rgba(24,24,24,.055)' : mode === 'orange' ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.05)';
  const mask = 'radial-gradient(85% 65% at 50% 38%,#000 20%,transparent 78%)';
  const dx = c.rng() > 0.5 ? 1 : -1;
  return {
    html: `<div id="${id}" style="position:absolute;inset:0;overflow:hidden;background:${bg};">`
      + `<div id="${c.p}-ga" ${OVF} style="position:absolute;left:-260px;top:880px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,${glowA},rgba(0,0,0,0));"></div>`
      + `<div id="${c.p}-gb" ${OVF} style="position:absolute;left:380px;top:-280px;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(closest-side,${glowB},rgba(0,0,0,0));"></div>`
      + `<div id="${c.p}-grid" style="position:absolute;inset:0;background-image:linear-gradient(${line} 2px,transparent 2px),linear-gradient(90deg,${line} 2px,transparent 2px);background-size:90px 90px;-webkit-mask-image:${mask};mask-image:${mask};"></div></div>`,
    js: `tl.fromTo(${q('#' + c.p + '-ga')},{x:${-90 * dx},y:60,scale:.92},{x:${90 * dx},y:-70,scale:1.12,duration:${num(c.D)},ease:"none"},0);`
      + `tl.fromTo(${q('#' + c.p + '-gb')},{x:${70 * dx},y:-40},{x:${-70 * dx},y:60,duration:${num(c.D)},ease:"none"},0);`
      + `tl.fromTo(${q('#' + c.p + '-grid')},{opacity:0},{opacity:1,duration:.9,ease:"power2.out"},0);`,
    dark,
  };
}

// A framed image (card). Cover-fitted. It slides in and then holds still.
function frame(c, id, img, {top, left, w, h, radius = 44, tilt = 7, rot = 0, at = 0.2, from = 'bottom', label = '', shadow = true, pos = '50% 50%', z = 1}) {
  const i = `${c.p}-${id}`;
  const label_ = label ? `<div style="position:absolute;left:16px;top:16px;max-width:calc(100% - 32px);padding:8px 16px 9px;border-radius:26px;background:${P.orange};color:#fff;font-size:28px;font-weight:900;letter-spacing:.5px;line-height:1.1;">${esc(clean(label, 40))}</div>` : '';
  const inner = img?.src && img.real !== false
    ? `<div ${OVF} style="position:absolute;inset:0;"><img src="${img.src}" alt="" style="display:block;width:100%;height:100%;object-fit:cover;object-position:${pos};"></div>`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${P.orange},${P.coral});"></div>`;
  const enter = from === 'left' ? `{opacity:0,x:-420,rotation:${rot - 6}}` : from === 'right' ? `{opacity:0,x:420,rotation:${rot + 6}}` : `{opacity:0,y:${tilt ? 520 : 760},rotation:${rot + tilt}}`;
  return {
    html: box(i, `top:${top}px;left:${left}px;width:${w}px;height:${h}px;border-radius:${typeof radius === 'number' ? radius + 'px' : radius};overflow:hidden;background:${P.ink};z-index:${z};${shadow ? 'box-shadow:0 40px 90px rgba(0,0,0,.34);' : ''}`, inner + label_, OVF),
    js: `tl.fromTo(${q('#' + i)},${enter},{opacity:1,x:0,y:0,rotation:${rot},duration:.85,ease:"expo.out"},${num(c.t0 + at)});`,
  };
}

// IMPACT WORDS: the few words worth showing big are stamped on screen the instant the voice says them (c.impacts,
// from beats.js). This replaces running captions: nothing sits over the picture unless it is worth reading.
function stamps(c, {top, left = SAFE.l, width = SAFE.w, align = 'left', alt = false, maxSize = 116}) {
  const list = c.impacts || [];
  if (!list.length) return null;
  let html = '', js = '';
  list.forEach((m, k) => {
    const id = `${c.p}-st${k}`;
    const n = m.text.length;
    const size = Math.max(44, Math.min(maxSize, n <= 8 ? 116 : n <= 14 ? 96 : n <= 22 ? 76 : 60, Math.floor((width - 70) / (n * 0.7))));
    const rot = k % 2 ? 2.5 : -3;
    const right = alt ? k % 2 === 1 : align === 'right';
    html += box(`${id}-w`, `top:${top}px;left:${left}px;width:${width}px;display:flex;justify-content:${right ? 'flex-end' : 'flex-start'};`,
      `<span id="${id}" style="display:inline-block;max-width:${width}px;padding:.08em .3em .16em;border-radius:.24em;background:${P.orange};color:#fff;font-size:${size}px;font-weight:900;letter-spacing:-.02em;line-height:1.05;box-shadow:0 24px 50px rgba(0,0,0,.32);opacity:0;">${esc(m.text)}</span>`, `${OVF} ${OVL}`);
    js += `tl.fromTo(${q('#' + id)},{opacity:0,scale:.55,rotation:${rot - 9}},{opacity:1,scale:1,rotation:${rot},duration:.42,ease:"back.out(1.9)"},${num(m.t)});`;
    const next = list[k + 1]?.t;
    if (next !== undefined) js += `tl.to(${q('#' + id)},{opacity:0,scale:.9,duration:.2,ease:"power2.in"},${num(next - 0.25)});`;
  });
  return {html, js};
}

// A soft ring that radiates on each clause break: a small physical cue that the voice moved on.
function ripples(c, {x = 540, y = 1100} = {}) {
  const beats = (c.beats || []).slice(0, 3);
  if (!beats.length) return null;
  return {
    html: beats.map((_, k) => box(`${c.p}-rp${k}`, `left:${x - 260}px;top:${y - 260}px;width:520px;height:520px;border-radius:50%;border:5px solid rgba(230,83,35,.55);opacity:0;`, '', `${OVF} data-layout-ignore`)).join(''),
    js: beats.map((t, k) => `tl.fromTo(${q('#' + c.p + '-rp' + k)},{scale:.25,opacity:.7},{scale:1.9,opacity:0,duration:1.1,ease:"power2.out"},${num(t)});`).join(''),
  };
}

// A screenshot peeking up from the bottom edge, shown whole at its own aspect (width-fit, top aligned, bleeding off the frame).
// Used by text-only scenes (hook, number) so the lower half is never empty. It rises, lands and then holds still.
function peek(c, {top}) {
  const shots = c.shots || [];
  if (!shots.length) return null;
  const shot = shots[c.index % shots.length];
  const w = 540, bw = 14, id = `${c.p}-pk`;
  return {
    html: box(id, `top:${Math.round(top)}px;left:${(1080 - w) / 2}px;width:${w}px;height:${Math.max(900, Math.round((w - bw * 2) * shot.h / shot.w) + bw * 2)}px;border:${bw}px solid #1b1b1d;border-bottom:0;border-radius:60px 60px 0 0;overflow:hidden;background:#fff;box-shadow:0 -20px 80px rgba(0,0,0,.45),0 0 0 3px #38383b;`,
      `<img src="${shot.src}" alt="" style="display:block;width:100%;height:auto;">`, OVF),
    js: `tl.fromTo(${q('#' + id)},{y:900,rotation:-7,opacity:0},{y:0,rotation:-3,opacity:1,duration:1,ease:"expo.out"},${num(c.t0 + 0.25)});`,
  };
}

// ---- families ---------------------------------------------------------------------------------------------------

const isShot = (c) => c.img?.kind === 'screenshot';
const photoOrInk = (c) => backdrop(c, c.img?.real && !isShot(c) ? 'photo' : 'ink');

// 1. HOOK: giant words over a darkened photo. Frame 0 already shows the headline.
function hook(c) {
  const b = photoOrInk(c);
  const k = kicker(c, 'JUST IN', {});
  const t = headline(c, 'h', headlineText(c.scene, 70), {top: 392, max: 156, min: 84, lines: 5, upper: true, color: P.white, hero: true, at: 0.05, chip: true, maxH: 540, flow: true});
  const r = rule(c, 'r', {width: 300, at: 0.5, flow: true});
  const s = subline(c, 's', subText(c.scene), {flow: true});
  const zone = Math.min(1000, 392 + t.h + 90 + (s ? 130 : 0));
  const pk = peek(c, {top: Math.min(1200, Math.max(1040, 392 + t.h + 170 + (s ? 120 : 0)))});
  return join(b, k, stack(c, 'txt', [t, r, s]), pk, stamps(c, {top: zone}), pk ? null : ripples(c));
}

// 2. STATEMENT: cream page, ink headline, a framed photo revealed at the bottom.
function statement(c) {
  const b = backdrop(c, 'cream');
  const k = kicker(c, 'THE FACT', {});
  const t = headline(c, 'h', headlineText(c.scene, 80), {top: 392, max: 120, min: 66, lines: 4, color: P.ink, maxH: 400, flow: true});
  const r = rule(c, 'r', {width: 220, at: 0.45, flow: true});
  const sub = subline(c, 's', subText(c.scene), {color: P.muted, size: 40, flow: true});
  const ruleTop = 392 + t.h + 18;
  const panelTop = Math.max(ruleTop + (sub ? 184 : 70), 640);
  // The picture is a bottom-bleeding panel: the platform UI covers that band anyway, so it is pure texture.
  const panel = frame(c, 'card', c.img, {top: panelTop, left: 0, w: 1080, h: 1920 - panelTop, radius: '60px 60px 0 0', tilt: 0, at: 0.2, pos: '50% 35%'});
  return join(b, k, stack(c, 'txt', [t, r, sub], {gap: 18}), panel, stamps(c, {top: panelTop - 10}));
}

// 3. DEVICE: dark stage, headline above, a phone rising from below with the picture on its screen.
const DEVICE = {
  phone_focus: {w: 560, h: 1000, left: 260, top: 700, rot: 0},
  floating_phone: {w: 540, h: 970, left: 330, top: 730, rot: -8},
  phone_zoom: {w: 680, h: 1180, left: 200, top: 700, rot: 0},
  app_spotlight: {w: 600, h: 1040, left: 240, top: 690, rot: 3},
  spotlight_reveal: {w: 620, h: 1080, left: 230, top: 700, rot: -4},
};
function device(c) {
  const d = DEVICE[c.layout] || DEVICE.phone_focus;
  const b = backdrop(c, 'ink');
  const k = kicker(c, 'ON PROPSHORT', {});
  const t = headline(c, 'h', headlineText(c.scene, 70), {top: 392, max: 104, min: 64, lines: 3, color: P.white, maxH: 330});
  const top = Math.max(d.top, 392 + t.h + 60);
  const i = `${c.p}-ph`;
  const screen = c.img?.src && c.img.real !== false
    ? `<div ${OVF} style="position:absolute;inset:0;"><img src="${c.img.src}" alt="" style="display:block;width:100%;height:100%;object-fit:cover;"></div>`
    : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${P.orange},${P.coral});"></div>`;
  const phone = {
    html: box(i, `top:${top}px;left:${d.left}px;width:${d.w}px;height:${d.h}px;border:15px solid #232325;border-radius:70px;overflow:hidden;background:#000;box-shadow:0 50px 110px rgba(0,0,0,.55),0 0 0 3px #3a3a3d;`,
      screen
      + `<div style="position:absolute;left:50%;margin-left:-62px;top:12px;width:124px;height:30px;border-radius:20px;background:#0b0b0c;"></div>`
      + `<div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 38%);"></div>`, OVF),
    // The phone rises and lands; the picture on its screen then stays still.
    js: `tl.fromTo(${q('#' + i)},{y:1300,rotation:${d.rot + 9}},{y:0,rotation:${d.rot},duration:1,ease:"expo.out"},${num(c.t0 + 0.12)});`,
  };
  return join(b, k, t, phone, stamps(c, {top: top + d.h - 300}), ripples(c, {y: top + d.h / 2}));
}

// 4. STAT: one giant number counting up. Falls back to STATEMENT when the copy has no number.
const NUM = /(₹|rs\.?\s?)?(\d[\d,]*(?:\.\d+)?)\s?(%|cr(?:ore)?s?\b|lakhs?\b|k\b|m\b|x\b|sq\.?\s?ft\b)?/gi;
// A statistic needs a unit (%, ₹, Cr, Lakh, x, sq ft...): "Check #1" or "3 steps" must not become a giant counter.
export function numberFrom(scene) {
  const g = scene?.graphic?.counter;
  if (g && Number.isFinite(Number(g.to)) && Number(g.to) > 0) {
    // clean() trims, so a word suffix (" Lakh") must get its separating space back; symbols (%, x) stay attached.
    const sfx = clean(g.suffix, 24);
    return {to: Number(g.to), prefix: clean(g.prefix, 8), suffix: /^[A-Za-z]/.test(sfx) ? ` ${sfx}` : sfx};
  }
  const text = `${scene?.graphic?.headline || ''} ${scene?.subtitle || ''} ${scene?.narration || ''}`;
  for (const m of text.matchAll(NUM)) {
    if (text[m.index - 1] === '#' || (!m[1] && !m[3])) continue;
    const to = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(to) || to <= 0 || to > 1e8) continue;
    return {to, prefix: m[1] ? '₹' : '', suffix: m[3] ? (/^cr/i.test(m[3]) ? ' Cr' : /^lakh/i.test(m[3]) ? ' Lakh' : m[3].replace(/\s/g, '')) : ''};
  }
  return null;
}
function stat(c) {
  const n = numberFrom(c.scene);
  if (!n) return statement(c);
  const b = photoOrInk(c);
  const k = kicker(c, 'BY THE NUMBERS', {});
  const i = `${c.p}-n`;
  const decimals = Number.isInteger(n.to) ? 0 : 1;
  const fmt = `function(v){return ${q(n.prefix)}+(${decimals}?v.toFixed(1):Math.round(v).toLocaleString("en-IN"))+${q(n.suffix)};}`;
  const size = Math.max(120, Math.min(250, Math.floor(SAFE.w / (Math.max(3, (n.prefix + String(Math.round(n.to)) + n.suffix).length) * 0.62))));
  const num_ = {
    html: box(i, `top:420px;left:${SAFE.l}px;width:${SAFE.w}px;font-size:${size}px;font-weight:900;letter-spacing:${num(-size * 0.04)}px;line-height:1;color:${P.hot};font-variant-numeric:tabular-nums;white-space:pre;`, esc(`${n.prefix}0${n.suffix}`)),
    js: `(function(){var o={v:0},el=document.getElementById(${q(i)}),f=${fmt};tl.fromTo(o,{v:0},{v:${n.to},duration:1.5,ease:"expo.out",onUpdate:function(){el.textContent=f(o.v);}},${num(c.t0 + 0.1)});})();`,
  };
  const t = headline(c, 'h', headlineText(c.scene, 70), {top: 420 + size + 40, max: 78, min: 54, lines: 3, color: P.white, at: 0.35, chip: Boolean(c.img?.real && !isShot(c)), maxH: 300});
  const bar = {
    html: box(`${c.p}-pb`, `top:${420 + size + 40 + t.h + 36}px;left:${SAFE.l}px;width:${SAFE.w}px;height:16px;border-radius:10px;background:rgba(255,255,255,.2);overflow:hidden;`, `<div id="${c.p}-pf" style="width:100%;height:100%;border-radius:10px;background:${P.orange};"></div>`),
    js: `tl.fromTo(${q('#' + c.p + '-pf')},{scaleX:0,transformOrigin:"0% 50%"},{scaleX:1,duration:1.5,ease:"expo.out"},${num(c.t0 + 0.1)});`,
  };
  const pk = peek(c, {top: Math.max(1040, 420 + size + 40 + t.h + 36 + 16 + 70)});
  return join(b, k, num_, t, bar, pk);
}

// 5. CARDS: several pictures fanned, paired or gridded, each tagged with its own line.
function cards(c) {
  const b = backdrop(c, 'ink');
  const k = kicker(c, 'MORE STORIES', {});
  const t = headline(c, 'h', headlineText(c.scene, 70), {top: 392, max: 88, min: 60, lines: 3, color: P.white, maxH: 300});
  const y0 = Math.max(700, 392 + t.h + 70);
  const pool = c.pool.length ? c.pool : [c.img];
  const pick = (n) => Array.from({length: n}, (_, k_) => ({img: pool[k_ % pool.length], label: c.labels[k_ % c.labels.length], pos: ['50% 30%', '30% 50%', '70% 60%', '50% 70%'][k_ % 4]}));
  let tiles;
  if (c.layout === 'news_grid') {
    tiles = pick(4).map((p_, k_) => frame(c, `g${k_}`, p_.img, {top: y0 + Math.floor(k_ / 2) * 270, left: SAFE.l + (k_ % 2) * 410, w: 390, h: 250, radius: 30, rot: 0, at: 0.15 + k_ * 0.12, from: k_ % 2 ? 'right' : 'left', label: '', pos: p_.pos}));
  } else if (c.layout === 'news_compare') {
    tiles = pick(2).map((p_, k_) => frame(c, `g${k_}`, p_.img, {top: y0, left: SAFE.l + k_ * 390, w: 370, h: 700, radius: 36, rot: k_ ? 3 : -3, at: 0.15 + k_ * 0.2, from: k_ ? 'right' : 'left', label: p_.label, pos: p_.pos}));
  } else {
    // news_stack / swipe_gallery: three tall cards fanned, middle one on top. Labels are chips at the top of each card.
    const spec = [{left: 110, rot: -9, from: 'left', dy: 70}, {left: 590, rot: 9, from: 'right', dy: 70}, {left: 350, rot: 0, from: 'bottom', dy: 0}];
    tiles = pick(3).map((p_, k_) => frame(c, `g${k_}`, p_.img, {top: y0 + spec[k_].dy, left: spec[k_].left, w: 380, h: 700, radius: 34, rot: spec[k_].rot, at: 0.15 + k_ * 0.16, from: spec[k_].from, label: k_ === 1 ? '' : p_.label, pos: p_.pos, z: k_ === 2 ? 3 : 1}));
  }
  return join(b, k, t, ...tiles, stamps(c, {top: y0 + 560}));
}

// 6. TICKER: bold bands sweeping across, for lists, headlines and "live" energy.
const CITIES = ['DELHI', 'MUMBAI', 'PUNE', 'CHANDIGARH'];
function ticker(c) {
  const b = photoOrInk(c);
  const k = kicker(c, 'LIVE', {});
  const t = headline(c, 'h', headlineText(c.scene, 70), {top: 392, max: 108, min: 64, lines: 3, color: P.white, chip: Boolean(c.img?.real && !isShot(c)), maxH: 330});
  const y0 = Math.max(820, 392 + t.h + 70);
  if (c.layout === 'city_pills') {
    const pills = CITIES.map((v, k_) => `<div id="${c.p}-c${k_}" style="padding:20px 38px;border-radius:90px;font-size:52px;font-weight:900;background:${k_ % 2 ? P.white : P.orange};color:${k_ % 2 ? P.ink : P.white};">${v}</div>`).join('');
    return join(b, k, t, {
      html: box(`${c.p}-pills`, `top:${Math.min(y0, 760)}px;left:${SAFE.l}px;width:${SAFE.lowW}px;display:flex;flex-wrap:wrap;gap:18px;`, pills),
      js: CITIES.map((_, k_) => `tl.fromTo(${q('#' + c.p + '-c' + k_)},{opacity:0,y:70,scale:.8},{opacity:1,y:0,scale:1,duration:.55,ease:"back.out(1.5)"},${num(c.t0 + 0.25 + k_ * 0.13)});`).join(''),
    }, stamps(c, {top: 1030}));
  }
  const lines = [headlineText(c.scene, 40), c.labels[0] || 'PROPSHORT', 'PROPSHORT NEWS', 'YOUR CITY · YOUR UPDATES'];
  const bands = lines.map((txt, k_) => {
    const left = k_ % 2;
    return {
      // Marquee text is texture (it is always cropped by the frame), so it is exempt from safe-zone and overflow audits.
      html: box(`${c.p}-b${k_}`, `left:-140px;top:${y0 + k_ * 150}px;width:1360px;padding:24px 100px;background:${left ? P.ink : P.orange};border-top:4px solid ${left ? P.orange : P.ink};color:${P.white};font-size:62px;font-weight:900;letter-spacing:-1px;white-space:nowrap;text-transform:uppercase;`, esc(clean(txt, 44) + '   ✦   ' + clean(txt, 44)), `${OVF} data-layout-ignore`),
      js: `tl.fromTo(${q('#' + c.p + '-b' + k_)},{x:${left ? 320 : -320},rotation:${left ? -2.5 : 2.5}},{x:${left ? -140 : 140},rotation:${left ? -2.5 : 2.5},duration:${num(c.D)},ease:"none"},0);`,
    };
  });
  return join(b, k, t, ...bands);
}

// 7. PROOF: an uploaded screenshot shown WHOLE, in a device frame (never cropped, never full-bleed).
//  - a tall phone screenshot is read by a camera that steps down it on the voice's clause breaks and holds still in between
//  - a wide/other screenshot is shown whole, with one punch-in on a speech beat
// Spoken impact words are stamped over the bottom of the frame at the instant they are said.
const PROOF_KICKERS = ['JUST IN', 'THE STORY', 'WHY IT MATTERS', 'THE DETAIL', 'THE NUMBERS', 'NEXT'];
function proof(c) {
  const dark = c.index % 2 === 0;
  const b = backdrop(c, dark ? 'ink' : 'cream');
  const k = kicker(c, PROOF_KICKERS[c.index % PROOF_KICKERS.length], {});
  const t = headline(c, 'h', headlineText(c.scene, 60), {top: 392, max: 100, min: 60, lines: 2, color: dark ? P.white : P.ink, maxH: 250, hero: c.index === 0});
  const stageTop = Math.max(640, 392 + t.h + 112);
  const stageH = Math.max(780, 1580 - stageTop);
  const stageW = 900, stageL = 90, bw = 14;
  const Wi = stageW - bw * 2, Hi = stageH - bw * 2;
  const iw = c.img.w || 739, ih = c.img.h || 1600;
  const portrait = ih / iw > (Hi / Wi) * 1.15;
  const sc = portrait ? Wi / iw : Math.min(Wi / iw, Hi / ih);
  const sW = iw * sc, sH = ih * sc;
  const o0 = portrait ? Math.min(sH * 0.05, Math.max(0, sH - Hi)) : 0;                // start just below the status bar
  const maxOff = portrait ? Math.max(o0, Math.min(sH - Hi, sH * 0.93 - Hi)) : 0;      // stop above the bottom nav bar
  const range = maxOff - o0;
  const scr = `${c.p}-scr`, rd = `${c.p}-rd`, th = `${c.p}-th`;

  // Camera steps fall on clause breaks; at least one if the scene is long enough to need it.
  const times = [];
  for (const x of c.beats || []) if (x >= 1.1 && x <= c.D - 1.2 && times.length < 3 && (!times.length || x - times.at(-1) >= 1.3)) times.push(x);
  if (!times.length && c.D > 3.2) times.push(Number((c.D * 0.5).toFixed(2)));
  const frac = ({1: [0.6], 2: [0.4, 0.9], 3: [0.3, 0.6, 0.92]})[times.length] || [];

  let js = `tl.fromTo(${q('#' + scr)},{y:780,rotation:3,opacity:0},{y:0,rotation:0,opacity:1,duration:.95,ease:"expo.out"},${num(c.t0 + 0.12)});`;
  const trackH = Hi - 40, thumbH = Math.max(60, Math.min(trackH, trackH * Hi / sH));
  const thumbY = (y) => ((o0 - y) / Math.max(1, sH - Hi)) * (trackH - thumbH);
  const scroll = portrait && range > 40;
  if (scroll) {
    let prev = 0;
    times.forEach((tm, kx) => {
      const to = -range * frac[kx];
      js += `tl.fromTo(${q('#' + rd)},{y:${num(prev)}},{y:${num(to)},duration:.85,ease:"power3.inOut"},${num(tm)});`;
      js += `tl.fromTo(${q('#' + th)},{y:${num(thumbY(prev))}},{y:${num(thumbY(to))},duration:.85,ease:"power3.inOut"},${num(tm)});`;
      prev = to;
    });
  } else if (times.length) {
    const [ox, oy] = [[28, 30], [72, 30], [30, 70], [70, 68]][Math.floor(c.rng() * 4)];
    js += `tl.fromTo(${q('#' + rd)},{scale:1,transformOrigin:"${ox}% ${oy}%"},{scale:1.45,transformOrigin:"${ox}% ${oy}%",duration:.6,ease:"expo.inOut"},${num(times[0])});`;
  }
  const thumb = scroll
    ? `<div style="position:absolute;right:8px;top:20px;width:7px;height:${num(trackH)}px;border-radius:5px;background:rgba(0,0,0,.10);"></div><div id="${th}" style="position:absolute;right:8px;top:20px;width:7px;height:${num(thumbH)}px;border-radius:5px;background:${P.orange};"></div>`
    : '';
  const screen = {
    html: box(scr, `top:${stageTop}px;left:${stageL}px;width:${stageW}px;height:${stageH}px;border:${bw}px solid #1b1b1d;border-radius:64px;overflow:hidden;background:#fff;box-shadow:0 50px 110px rgba(0,0,0,${dark ? 0.55 : 0.28}),0 0 0 3px #38383b;`,
      `<div id="${rd}" ${OVF} style="position:absolute;left:${num((Wi - sW) / 2)}px;top:${num(portrait ? -o0 : (Hi - sH) / 2)}px;width:${num(sW)}px;height:${num(sH)}px;"><img src="${c.img.src}" alt="" style="display:block;width:100%;height:100%;"></div>${thumb}`, OVF),
    js,
  };
  return join(b, k, t, screen, stamps(c, {top: stageTop - 92, left: SAFE.l, width: SAFE.w, alt: true, maxSize: 92}));
}

// 8. ENDCARD: brand sign-off with a call to action.
function endcard(c) {
  const b = backdrop(c, 'orange');
  const rings = [0, 1, 2].map((k_) => ({
    html: box(`${c.p}-ring${k_}`, `left:${540 - 340}px;top:${800 - 340}px;width:680px;height:680px;border-radius:50%;border:6px solid rgba(255,255,255,.3);opacity:0;`, '', OVF),
    // One tween per property: the ring grows while it fades out, so nothing keeps pulsing after it lands.
    js: `tl.fromTo(${q('#' + c.p + '-ring' + k_)},{scale:.3,opacity:.9},{scale:${num(1.3 + k_ * 0.5)},opacity:0,duration:${num(Math.min(c.D - 0.4, 2.2))},ease:"power2.out"},${num(c.t0 + k_ * 0.2)});`,
  }));
  const logo = {
    html: box(`${c.p}-logo`, `top:330px;left:${SAFE.l}px;width:150px;height:150px;border-radius:38px;background:${P.white};color:${P.orange};display:flex;align-items:center;justify-content:center;font-size:76px;font-weight:900;letter-spacing:-4px;`, 'PS'),
    js: `tl.fromTo(${q('#' + c.p + '-logo')},{scale:0,rotation:-25},{scale:1,rotation:0,duration:.7,ease:"back.out(1.6)"},${num(c.t0 + 0.05)});`,
  };
  const word = headline(c, 'w', 'PropShort.', {top: 520, width: SAFE.w, max: 190, min: 100, lines: 1, color: P.white, hiColor: P.white, upper: false});
  const tag = headline(c, 'tag', clean(c.scene?.graphic?.subheading, 60) || 'Real estate, filtered for you.', {top: 520 + word.h + 20, width: SAFE.lowW, max: 62, min: 44, lines: 3, color: P.white, hiColor: P.ink, at: 0.3});
  const cta = {
    html: box(`${c.p}-cta`, `top:${520 + word.h + 20 + tag.h + 44}px;left:${SAFE.l}px;padding:28px 40px;border-radius:28px;background:${P.white};color:${P.orange};font-size:42px;font-weight:900;white-space:nowrap;`, 'EXPLORE PROPSHORT ↗'),
    js: `tl.fromTo(${q('#' + c.p + '-cta')},{opacity:0,y:50,scale:.9},{opacity:1,y:0,scale:1,duration:.65,ease:"expo.out"},${num(c.t0 + 0.8)});`,
  };
  return join(b, ...rings, logo, word, tag, cta);
}

// ---- registry ---------------------------------------------------------------------------------------------------

export const LAYOUT_FAMILY = {
  kinetic_hook: hook, word_wall: hook,
  bold_statement: statement, split_headline: statement, editorial_card: statement,
  phone_focus: device, floating_phone: device, phone_zoom: device, app_spotlight: device, spotlight_reveal: device,
  stat_highlight: stat,
  news_stack: cards, news_grid: cards, news_compare: cards, swipe_gallery: cards,
  headline_ticker: ticker, city_pills: ticker,
  screenshot_proof: proof,
  brand_endcard: endcard,
};
export const LAYOUT_NAMES = Object.keys(LAYOUT_FAMILY);
const FAMILY_NAME = new Map([[hook, 'hook'], [statement, 'statement'], [device, 'device'], [stat, 'stat'], [cards, 'cards'], [ticker, 'ticker'], [proof, 'proof'], [endcard, 'endcard']]);
// The design family a layout name will actually render as (a stat scene without a number renders as a statement).
export function familyName(name, scene) {
  const f = FAMILY_NAME.get(LAYOUT_FAMILY[name]) || 'hook';
  return f === 'stat' && !numberFrom(scene) ? 'statement' : f;
}
export const buildLayout = (name, c) => (LAYOUT_FAMILY[name] || hook)({...c, layout: LAYOUT_FAMILY[name] ? name : 'kinetic_hook'});
