// HyperFrames layout builders.
//
// Each builder returns {html, js}: absolutely-positioned markup for a 1080x1920 scene and the
// GSAP statements that animate it. `js` runs inside the scene's paused timeline `tl`.
// Every id is prefixed with the scene id (`p`) because ids must be unique across the page.
// Animation is a pure function of timeline time (no timers, no Math.random).

export const P = {orange: '#E65323', coral: '#F17643', ink: '#181818', cream: '#F8F5F0', peach: '#F6DACA', white: '#FFFFFF', muted: '#756E69'};

export const clean = (t, n = 115) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const headline = (s) => clean(s?.graphic?.headline || s?.subtitle || s?.narration, 84);
const body = (s) => clean(s?.graphic?.subheading || s?.subtitle || s?.narration, 115);
const num = (n) => Number(n.toFixed(3));

// ---- building blocks -------------------------------------------------------------------------

const box = (id, css, inner = '', tag = 'div') => `<${tag} id="${id}" style="position:absolute;${css}">${inner}</${tag}>`;

// Entrance tween shared by text blocks: rise + fade, like Remotion's TextReveal/Title.
const rise = (id, at, travel = 60, dur = 0.55) =>
  `tl.fromTo("#${id}",{opacity:0,y:${num(travel)},scale:.94},{opacity:1,y:0,scale:1,duration:${dur},ease:"power3.out"},${num(at)});`;

function title(c, id, text, {top, left, width = 930, size = 95, color, at = 0.08, align = 'left'}) {
  const i = `${c.p}-${id}`;
  return {
    html: box(i, `top:${top}px;left:${left}px;width:${width}px;font-size:${size}px;font-weight:900;letter-spacing:${-size * 0.035}px;line-height:1.06;text-align:${align};color:${color || (c.dark ? P.white : P.ink)};overflow-wrap:break-word;`, esc(clean(text, 105))),
    js: rise(i, at, 70 * c.travel),
  };
}

function kicker(c, id, text, {top, left, color, at = 0}) {
  const i = `${c.p}-${id}`;
  return {
    html: box(i, `top:${top}px;left:${left}px;font-size:28px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:${color || (c.dark ? P.peach : P.orange)};`, esc(text)),
    js: rise(i, at, 24, 0.4),
  };
}

function mark(c, id, {top, left, width = 390, at = 0.3, color = P.orange}) {
  const i = `${c.p}-${id}`;
  return {
    html: box(i, `top:${top}px;left:${left}px;width:${width}px;height:13px;border-radius:12px;background:${color};transform-origin:left center;`),
    js: `tl.fromTo("#${i}",{scaleX:0},{scaleX:1,duration:.7,ease:"power3.out"},${num(at)});`,
  };
}

// Phone-style or flat media card holding a scene image, with a slow push-in on the image itself.
function media(c, id, scene, {top, left, width = 560, height = 1030, rot = -4, mode = 'phone', at = 0.2, fromX = 200, opacity = 1}) {
  const i = `${c.p}-${id}`, src = scene?.__asset;
  const frame = mode === 'phone' ? 'border:13px solid #242424;border-radius:52px;' : 'border:5px solid #EFE5DC;border-radius:24px;';
  const inner = src
    ? `<img id="${i}-img" src="${src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;">`
    : `<div style="padding:40px;color:${P.ink};font-size:42px;">PropShort · Your news, your city</div>`;
  const notch = mode === 'phone' ? '<div style="position:absolute;width:120px;height:15px;border-radius:20px;background:#242424;top:6px;left:50%;margin-left:-60px;"></div>' : '';
  return {
    html: box(i, `top:${top}px;left:${left}px;width:${width}px;height:${height}px;background:#fff;${frame}overflow:hidden;box-shadow:0 34px 85px rgba(0,0,0,.27);opacity:${opacity};`, inner + notch),
    js: `tl.fromTo("#${i}",{opacity:0,x:${num(fromX * c.travel)},y:${num(150 * c.travel)},rotation:${rot + 10},scale:.83},{opacity:${opacity},x:0,y:0,rotation:${rot},scale:1,duration:.75,ease:"power3.out"},${num(at)});`
      + (src ? `tl.fromTo("#${i}-img",{scale:1},{scale:${num(1 + 0.16 * c.zoom)},duration:${c.D},ease:"none"},0);` : ''),
  };
}

function tile(c, id, scene, {top, left, width = 450, height = 550, tilt = 0, at = 0.1}) {
  const i = `${c.p}-${id}`, src = scene?.__asset;
  const inner = `<div style="position:absolute;left:0;right:0;top:0;height:77%;overflow:hidden;background:#fff;">${src ? `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:contain;">` : ''}</div>`
    + `<div style="position:absolute;left:0;right:0;bottom:0;height:23%;padding:0 22px;display:flex;align-items:center;font-size:26px;font-weight:800;color:${P.ink};background:#fff;overflow:hidden;">${esc(clean(scene?.subtitle || scene?.narration, 48))}</div>`;
  return {
    html: box(i, `top:${top}px;left:${left}px;width:${width}px;height:${height}px;border-radius:32px;background:#fff;border:4px solid #EBDDD4;box-shadow:0 22px 48px rgba(0,0,0,.14);overflow:hidden;opacity:0;`, inner),
    js: `tl.fromTo("#${i}",{opacity:0,y:180,rotation:${tilt}},{opacity:1,y:0,rotation:${tilt},duration:.65,ease:"power3.out"},${num(at)});`,
  };
}

function counter(c, id, scene, {top, left}) {
  const k = scene?.graphic?.counter;
  if (!k || !Number.isFinite(Number(k.to)) || Number(k.to) < 0) return null;
  const i = `${c.p}-${id}`, from = Number(k.from) || 0, to = Math.min(10000000, Number(k.to));
  return {
    html: box(i, `top:${top}px;left:${left}px;font-size:145px;font-weight:900;letter-spacing:-8px;line-height:1.04;color:${P.orange};font-variant-numeric:tabular-nums;white-space:nowrap;`, esc(`${clean(k.prefix, 8)}${from.toLocaleString('en-IN')}${clean(k.suffix, 25)}`)),
    // Deterministic count-up: the value is a function of timeline time via onUpdate.
    js: `(function(){var o={v:${from}},el=document.getElementById("${i}");tl.fromTo(o,{v:${from}},{v:${to},duration:1.6,ease:"power2.out",onUpdate:function(){el.textContent=${JSON.stringify(clean(k.prefix, 8))}+Math.round(o.v).toLocaleString("en-IN")+${JSON.stringify(clean(k.suffix, 25))};}},.25);})();`,
  };
}

const join = (...parts) => parts.filter(Boolean).reduce((a, p) => ({html: a.html + p.html, js: a.js + p.js}), {html: '', js: ''});

// ---- layouts ---------------------------------------------------------------------------------

export const LAYOUT_BUILDERS = {
  kinetic_hook(c) {
    const words = headline(c.scene).split(' ').slice(0, 8);
    const wordHtml = words.map((w, k) => `<span id="${c.p}-w${k}" style="display:inline-block;margin-right:20px;font-size:110px;font-weight:900;letter-spacing:-4px;color:${k % 3 === 0 ? P.orange : P.white};opacity:0;">${esc(w)}</span>`).join('');
    const wordJs = words.map((_, k) => `tl.fromTo("#${c.p}-w${k}",{opacity:0,y:100},{opacity:1,y:0,duration:.4,ease:"power3.out"},${num(k * 0.17)});`).join('');
    return join(
      {html: box(`${c.p}-words`, 'top:340px;left:70px;right:60px;', wordHtml), js: wordJs},
      kicker(c, 'k', 'What is happening in your city?', {top: 290, left: 70}),
      mark(c, 'm', {top: 760, left: 70, at: 0.8}),
      media(c, 'media', c.scene, {top: 1160, left: 950, width: 520, height: 800, rot: -6, opacity: 0.68, at: 0.4}),
    );
  },
  word_wall(c) {
    const words = headline(c.scene).toUpperCase().split(' ').slice(0, 12);
    const wordHtml = words.map((w, k) => `<div id="${c.p}-w${k}" style="font-weight:900;font-size:${k % 3 === 0 ? 115 : 83}px;background:${k % 3 === 0 ? P.orange : 'transparent'};color:${P.white};padding:5px 10px;opacity:0;">${esc(w)}</div>`).join('');
    const wordJs = words.map((_, k) => `tl.fromTo("#${c.p}-w${k}",{opacity:0,scale:.7},{opacity:1,scale:1,duration:.4,ease:"back.out(1.6)"},${num(k * 0.13)});`).join('');
    return join(
      {html: box(`${c.p}-wall`, 'top:330px;left:55px;right:55px;display:flex;flex-wrap:wrap;gap:20px;', wordHtml), js: wordJs},
      kicker(c, 'k', 'PropShort / Real estate news', {top: 1340, left: 70}),
    );
  },
  bold_statement(c) {
    return join(
      kicker(c, 'k', 'The headline', {top: 270, left: 75}),
      title(c, 't', headline(c.scene), {top: 330, left: 75, size: 118}),
      mark(c, 'm', {top: 800, left: 75}),
      media(c, 'media', c.scene, {top: 890, left: 280, width: 540, height: 800, rot: 3}),
    );
  },
  split_headline(c) {
    return join(
      kicker(c, 'k', 'Fast updates', {top: 215, left: 67}),
      title(c, 't', headline(c.scene), {top: 275, left: 67, width: 470, size: 86}),
      mark(c, 'm', {top: 1150, left: 67}),
      media(c, 'media', c.scene, {top: 340, left: 540, width: 570, height: 1160, rot: 8, fromX: 300}),
    );
  },
  phone_focus(c) {
    return join(
      kicker(c, 'k', 'News on your screen', {top: 235, left: 70}),
      title(c, 't', headline(c.scene), {top: 285, left: 70, width: 915, size: 74}),
      media(c, 'media', c.scene, {top: 650, left: 260, width: 550, height: 1050, rot: 0}),
    );
  },
  floating_phone(c) {
    const m = media(c, 'media', c.scene, {top: 700, left: 230, width: 575, height: 1000, rot: -12});
    return join(
      kicker(c, 'k', 'Your property news', {top: 220, left: 70}),
      title(c, 't', headline(c.scene), {top: 270, left: 70, width: 830, size: 77}),
      m,
      // Gentle drift on the card's wrapper-free sibling shadow is skipped; the image push-in provides motion.
    );
  },
  phone_zoom(c) {
    return join(
      kicker(c, 'k', 'Open PropShort', {top: 230, left: 70}),
      title(c, 't', headline(c.scene), {top: 280, left: 70, size: 80}),
      media(c, 'media', c.scene, {top: 755, left: 140, width: 730, height: 1120, rot: 2}),
    );
  },
  app_spotlight(c) {
    const glow = {html: box(`${c.p}-glow`, `top:760px;left:180px;width:720px;height:720px;border-radius:50%;background:${P.orange};opacity:.24;filter:blur(85px);`), js: `tl.fromTo("#${c.p}-glow",{scale:.8},{scale:1,duration:1.6,ease:"power2.out"},0);`};
    return join(
      kicker(c, 'k', 'PropShort app', {top: 255, left: 70}),
      title(c, 't', headline(c.scene), {top: 305, left: 70, size: 76}),
      glow,
      media(c, 'media', c.scene, {top: 760, left: 210, width: 660, height: 1050, rot: -2}),
    );
  },
  news_stack(c) {
    const [a, b] = [c.scenes[0] || c.scene, c.scenes[1] || c.scene];
    return join(
      kicker(c, 'k', 'Stories that matter', {top: 215, left: 68}), title(c, 't', headline(c.scene), {top: 265, left: 68, width: 960, size: 75}), mark(c, 'm', {top: 520, left: 68}),
      tile(c, 'a', a, {top: 665, left: 295, width: 490, height: 750, tilt: -14}),
      tile(c, 'b', b, {top: 610, left: 140, width: 490, height: 750, tilt: 7, at: 0.35}),
    );
  },
  news_grid(c) {
    const pool = [c.scenes[0] || c.scene, c.scenes[1] || c.scene, c.scenes[2] || c.scene, c.scene];
    return join(
      kicker(c, 'k', 'Stories that matter', {top: 215, left: 68}), title(c, 't', headline(c.scene), {top: 265, left: 68, width: 960, size: 75}), mark(c, 'm', {top: 520, left: 68}),
      ...pool.map((s, k) => tile(c, `g${k}`, s, {top: 660 + Math.floor(k / 2) * 443, left: 68 + (k % 2) * 478, width: 455, height: 420, tilt: k % 2 ? 2 : -2, at: 0.1 + k * 0.23})),
    );
  },
  swipe_gallery(c) {
    const pool = [c.scenes[0] || c.scene, c.scenes[1] || c.scene, c.scenes[2] || c.scene];
    const cards = join(...pool.map((s, k) => tile(c, `s${k}`, s, {top: 680, left: 30 + k * 345, width: 410, height: 730, tilt: k % 2 ? 5 : -5, at: 0.1 + k * 0.3})));
    // The whole row drifts left over the scene, like the Remotion swipe.
    const row = {html: box(`${c.p}-row`, 'top:0;left:0;width:1080px;height:1920px;', cards.html), js: cards.js + `tl.fromTo("#${c.p}-row",{x:0},{x:-190,duration:${c.D},ease:"none"},0);`};
    return join(
      kicker(c, 'k', 'Stories that matter', {top: 215, left: 68}), title(c, 't', headline(c.scene), {top: 265, left: 68, width: 960, size: 75}), mark(c, 'm', {top: 520, left: 68}),
      row,
    );
  },
  headline_ticker(c) {
    const lines = [headline(c.scene), body(c.scene), 'PROPSHORT NEWS', 'YOUR CITY · YOUR UPDATES'];
    const bands = lines.map((t, k) => ({
      html: box(`${c.p}-b${k}`, `left:-130px;top:${780 + k * 180}px;width:1340px;padding:26px 90px;background:${k % 2 ? P.ink : P.orange};color:${P.white};font-size:54px;font-weight:900;white-space:nowrap;overflow:hidden;`, esc(clean(t, 60))),
      js: `tl.fromTo("#${c.p}-b${k}",{x:${k % 2 ? 260 : -260},rotation:${k % 2 ? -2 : 2},opacity:0},{x:${k % 2 ? -80 : 80},rotation:${k % 2 ? -2 : 2},opacity:1,duration:${c.D},ease:"none"},${num(k * 0.12)});`,
    }));
    return join(kicker(c, 'k', 'Breaking down the news', {top: 230, left: 60}), title(c, 't', headline(c.scene), {top: 280, left: 60, size: 80}), ...bands);
  },
  editorial_card(c) {
    return join(
      kicker(c, 'k', 'In focus', {top: 225, left: 65}), title(c, 't', headline(c.scene), {top: 275, left: 65, size: 78}),
      tile(c, 'card', c.scene, {top: 700, left: 125, width: 820, height: 820}),
    );
  },
  stat_highlight(c) {
    const count = counter(c, 'n', c.scene, {top: 320, left: 70});
    return join(
      kicker(c, 'k', 'The number behind the story', {top: 230, left: 70}),
      count || title(c, 't', headline(c.scene), {top: 290, left: 70, size: 94}),
      title(c, 'sub', body(c.scene), {top: count ? 520 : 560, left: 70, size: 52, at: 0.5}),
      media(c, 'media', c.scene, {top: 820, left: 340, width: 600, height: 890, rot: -8}),
    );
  },
  news_compare(c) {
    const [a, b] = [c.scenes[0] || c.scene, c.scenes[1] || c.scene];
    return join(
      kicker(c, 'k', 'Multiple stories · one feed', {top: 230, left: 75}), title(c, 't', headline(c.scene), {top: 280, left: 75, size: 74}),
      tile(c, 'a', a, {top: 650, left: 85, width: 430, height: 790}),
      tile(c, 'b', b, {top: 650, left: 535, width: 430, height: 790, at: 0.4}),
    );
  },
  city_pills(c) {
    const cities = ['DELHI', 'MUMBAI', 'AHMEDABAD', 'BENGALURU', 'PUNE', 'CHANDIGARH'];
    const pills = cities.map((v, k) => `<div id="${c.p}-c${k}" style="background:${k % 2 ? P.white : P.orange};color:${k % 2 ? P.ink : P.white};border:3px solid ${P.orange};padding:20px 32px;border-radius:90px;font-size:47px;font-weight:900;opacity:0;">${v}</div>`).join('');
    const js = cities.map((_, k) => `tl.fromTo("#${c.p}-c${k}",{opacity:0,y:60,scale:.8},{opacity:1,y:0,scale:1,duration:.45,ease:"back.out(1.5)"},${num(0.2 + k * 0.14)});`).join('');
    return join(kicker(c, 'k', 'City-wise coverage', {top: 235, left: 70}), title(c, 't', headline(c.scene), {top: 285, left: 70, size: 78}), {html: box(`${c.p}-pills`, 'top:795px;left:60px;width:960px;display:flex;flex-wrap:wrap;gap:18px;', pills), js});
  },
  spotlight_reveal(c) {
    const glow = {html: box(`${c.p}-glow`, `top:840px;left:180px;width:740px;height:740px;border-radius:50%;background:${P.orange};filter:blur(100px);opacity:.45;`), js: `tl.fromTo("#${c.p}-glow",{opacity:0,scale:.6},{opacity:.45,scale:1,duration:1.2,ease:"power2.out"},0);`};
    return join(
      kicker(c, 'k', 'In your pocket', {top: 245, left: 75}), title(c, 't', headline(c.scene), {top: 295, left: 75, size: 88}),
      glow, media(c, 'media', c.scene, {top: 800, left: 210, width: 660, height: 950, rot: -10}),
    );
  },
  brand_endcard(c) {
    const cta = {
      html: box(`${c.p}-cta`, `top:1010px;left:75px;background:${P.white};color:${P.orange};padding:28px 38px;font-size:44px;font-weight:900;border-radius:24px;white-space:nowrap;opacity:0;`, 'EXPLORE PROPSHORT ↗'),
      js: `tl.fromTo("#${c.p}-cta",{opacity:0,y:45},{opacity:1,y:0,duration:.6,ease:"power3.out"},.8);`,
    };
    return join(
      title(c, 't', 'PropShort.', {top: 335, left: 75, size: 154, color: P.white}),
      title(c, 'tag', 'Real estate, filtered for you.', {top: 580, left: 75, width: 900, size: 74, color: P.white, at: 0.45}),
      cta,
    );
  },
};

export const LAYOUT_NAMES = Object.keys(LAYOUT_BUILDERS);
