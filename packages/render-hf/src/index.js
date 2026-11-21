// HyperFrames renderer for ReelForge.
//
// buildProject() turns a job's cached assets (scene PNGs, narration, storyboard) plus its creative plan
// into a HyperFrames project directory: index.html (root) + compositions/s<N>.html (one per scene).
// renderProject() renders that directory to MP4 with the local HyperFrames CLI.
// Neither step calls any AI provider; rendering is deterministic and works from cached files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LAYOUT_BUILDERS, LAYOUT_NAMES, P, clean, esc} from './layouts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1920;
const GSAP = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js';
// Same fallback ladder as the Remotion renderer uses for scenes that have no creative plan.
const LEGACY_LAYOUTS = ['kinetic_hook', 'stat_highlight', 'editorial_card', 'split_headline', 'swipe_gallery', 'brand_endcard'];
const PRESETS = {editorial: {travel: .72, zoom: .75}, energetic: {travel: 1.55, zoom: 1.65}, cinematic: {travel: 1.05, zoom: 1.45}, showcase: {travel: 1.15, zoom: 1.15}};
const APPROVED_BG = [P.ink, P.cream, P.white, P.peach, P.orange];

const bgFor = (layout, scene, i) => {
  if (['kinetic_hook', 'word_wall', 'spotlight_reveal'].includes(layout)) return P.ink;
  if (layout === 'brand_endcard') return P.orange;
  if (['bold_statement', 'split_headline'].includes(layout)) return P.cream;
  const bg = scene?.graphic?.background;
  return APPROVED_BG.includes(bg) ? bg : [P.ink, P.cream, P.white, P.cream, P.peach, P.orange][i % 6];
};

function decoration(p, preset, dark, D) {
  const col = dark ? '#FFFFFF' : P.orange;
  if (preset === 'editorial') return {html: `<div id="${p}-d1" style="position:absolute;top:215px;right:75px;width:240px;height:10px;background:${col};opacity:.8;transform-origin:right center;"></div>`, js: `tl.fromTo("#${p}-d1",{scaleX:0},{scaleX:1,duration:.9,ease:"power3.out"},.1);`};
  if (preset === 'energetic') return {html: `<div id="${p}-d1" style="position:absolute;top:240px;right:70px;width:300px;height:300px;border:10px solid ${col};border-radius:50%;opacity:.1;"></div>`, js: `tl.fromTo("#${p}-d1",{scale:.4},{scale:1.5,duration:${D},ease:"power1.out"},0);`};
  if (preset === 'cinematic') return {html: `<div id="${p}-d1" style="position:absolute;top:350px;right:-190px;width:620px;height:620px;border:7px solid ${col};border-radius:50%;opacity:.12;"></div>`, js: `tl.fromTo("#${p}-d1",{scale:.6},{scale:1.3,duration:${D},ease:"none"},0);`};
  return {html: `<div id="${p}-d1" style="position:absolute;top:202px;right:55px;width:240px;height:74px;border-radius:45px;border:4px solid ${col};opacity:.12;"></div>`, js: `tl.fromTo("#${p}-d1",{x:220},{x:0,duration:.9,ease:"power3.out"},.1);`};
}

// Stage entrance/exit mirrors Remotion's MotionStage: slide | zoom | wipe | pop, then a short fade-out.
function stageTweens(p, transition, travel, D) {
  const out = Math.max(0, D - 0.37);
  const enter = {
    slide: `tl.fromTo("#${p}-stage",{opacity:0,x:${(75 * travel).toFixed(1)},y:${(38 * travel).toFixed(1)}},{opacity:1,x:0,y:0,duration:.5,ease:"power3.out"},0);`,
    zoom: `tl.fromTo("#${p}-stage",{opacity:0,scale:.84},{opacity:1,scale:1,duration:.5,ease:"power3.out"},0);`,
    pop: `tl.fromTo("#${p}-stage",{opacity:0,scale:.92,y:${(38 * travel).toFixed(1)}},{opacity:1,scale:1,y:0,duration:.5,ease:"back.out(1.4)"},0);`,
    wipe: `tl.fromTo("#${p}-stage",{opacity:1,clipPath:"inset(0% 100% 0% 0%)"},{opacity:1,clipPath:"inset(0% 0% 0% 0%)",duration:.55,ease:"power3.out"},0);`,
  }[transition] || '';
  return `${enter}tl.to("#${p}-stage",{opacity:0,duration:.37,ease:"power1.in"},${out.toFixed(3)});`;
}

function captions(p, scene, wordCaptions, startAt, D, dark) {
  const style = `position:absolute;bottom:168px;left:60px;right:60px;display:flex;justify-content:center;opacity:0;`;
  const pill = `padding:17px 27px;border-radius:17px;max-width:960px;background:${dark ? 'rgba(255,255,255,.93)' : 'rgba(24,24,24,.92)'};color:${dark ? P.ink : P.white};font-weight:800;font-size:37px;text-align:center;line-height:1.18;box-shadow:0 12px 24px rgba(0,0,0,.13);`;
  const words = (wordCaptions || []).filter((w) => Number(w.end) > startAt && Number(w.start) < startAt + D && clean(w.text));
  if (!words.length) {
    const text = clean(scene.subtitle || scene.narration, 92);
    if (!text) return {html: '', js: ''};
    return {html: `<div id="${p}-cap" style="${style}"><div style="${pill}">${esc(text)}</div></div>`, js: `tl.to("#${p}-cap",{opacity:1,duration:.25},.25);`};
  }
  // Word-aligned captions: one element per word, switched on/off at its own timestamps.
  let html = '', js = '';
  words.forEach((w, k) => {
    const a = Math.max(0, Number(w.start) - startAt), b = Math.min(D, Math.max(a + 0.08, Number(w.end) - startAt));
    html += `<div id="${p}-cap${k}" style="${style}"><div style="${pill}">${esc(clean(w.text, 40))}</div></div>`;
    js += `tl.set("#${p}-cap${k}",{opacity:1},${a.toFixed(3)});tl.set("#${p}-cap${k}",{opacity:0},${b.toFixed(3)});`;
  });
  return {html, js};
}

export function sceneComposition({scene, scenes, index, D, startAt, layout, preset, energy, transition, title, wordCaptions}) {
  const p = `s${index}`;
  const factor = 0.45 + Math.max(0, Math.min(100, Number(energy) || 0)) / 100;
  const cfg = PRESETS[preset] || PRESETS.showcase;
  const ctx = {p, scene, scenes, D, travel: cfg.travel * factor, zoom: cfg.zoom * factor};
  const bg = bgFor(layout, scene, index), dark = [P.ink, P.orange].includes(bg);
  ctx.dark = dark;
  const build = LAYOUT_BUILDERS[layout] || LAYOUT_BUILDERS.kinetic_hook;
  const body = build(ctx);
  const deco = decoration(p, preset, dark, D);
  const cap = captions(p, scene, wordCaptions, startAt, D, dark);
  const brand = `<div style="position:absolute;top:104px;left:72px;display:flex;gap:14px;align-items:center;z-index:20;"><div style="background:${P.orange};color:#fff;font-size:23px;font-weight:900;border-radius:10px;padding:8px 11px;letter-spacing:-1px;">PS</div><div style="font-size:33px;font-weight:900;letter-spacing:-1.2px;color:${dark ? '#fff' : P.ink};">PropShort</div></div>`;
  const track = `<div style="position:absolute;height:8px;bottom:72px;left:70px;right:70px;border-radius:20px;background:${dark ? 'rgba(255,255,255,.27)' : 'rgba(24,24,24,.14)'};overflow:hidden;"><div id="${p}-bar" style="height:100%;width:100%;background:${dark ? '#fff' : P.orange};transform-origin:left center;"></div></div>`;
  return `<template>
  <style>
    #root{position:absolute;inset:0;font-family:Inter,Arial,Helvetica,sans-serif;overflow:hidden;}
    #root img{display:block;}
  </style>
  <div id="root" data-composition-id="${p}" data-width="${W}" data-height="${H}">
    <div id="${p}-bg" class="clip" data-start="0" data-duration="${D}" data-track-index="0" style="position:absolute;inset:0;background:${bg};color:${dark ? '#fff' : P.ink};overflow:hidden;">
      ${deco.html}
      <div id="${p}-stage" style="position:absolute;inset:0;">${body.html}</div>
      ${brand}
      ${cap.html}
      ${track}
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${deco.js}
    ${stageTweens(p, transition, ctx.travel, D)}
    ${body.js}
    ${cap.js}
    tl.fromTo("#${p}-bar",{scaleX:0},{scaleX:1,duration:${D},ease:"none"},0);
    window.__timelines["${p}"] = tl;
  </script>
</template>
`;
}

// Creates or refreshes `projectDir` from a job directory. Returns {projectDir, duration, scenes}.
export async function buildProject({jobDir, projectDir, plan, creativePlan, creativePreset = 'showcase', creativeIntensity = 70, creativeTransition = 'slide', wordCaptions = [], title = 'ReelForge'}) {
  const scenes = (plan.scenes || []).map((s) => ({...s}));
  if (!scenes.length) throw new Error('Storyboard has no scenes');
  await fs.rm(projectDir, {recursive: true, force: true});
  await fs.mkdir(path.join(projectDir, 'compositions'), {recursive: true});
  await fs.mkdir(path.join(projectDir, 'assets'), {recursive: true});
  // Assets are copied, not linked: the project must be self-contained for the renderer.
  for (let i = 0; i < scenes.length; i++) {
    const src = path.join(jobDir, `scene-${i}.png`);
    if (await fs.stat(src).then(() => true, () => false)) {
      await fs.copyFile(src, path.join(projectDir, 'assets', `scene-${i}.png`));
      scenes[i].__asset = `assets/scene-${i}.png`;
    }
  }
  const narration = path.join(jobDir, 'narration.mp3');
  const hasAudio = await fs.stat(narration).then(() => true, () => false);
  if (hasAudio) await fs.copyFile(narration, path.join(projectDir, 'assets', 'narration.mp3'));

  let at = 0;
  const hosts = [];
  for (let i = 0; i < scenes.length; i++) {
    const D = Math.max(0.1, Number(scenes[i].duration) || 5);
    const layout = scenes[i]?.graphic?.layout || creativePlan?.layouts?.[i] || LEGACY_LAYOUTS[Math.min(i, LEGACY_LAYOUTS.length - 1)];
    const html = sceneComposition({
      scene: scenes[i], scenes, index: i, D, startAt: at, layout, title, wordCaptions,
      preset: scenes[i]?.graphic?.motion_preset || creativePreset,
      energy: scenes[i]?.graphic?.motion_intensity ?? creativePlan?.energy ?? creativeIntensity,
      transition: scenes[i]?.graphic?.transition || creativePlan?.transitions?.[i] || creativeTransition,
    });
    await fs.writeFile(path.join(projectDir, 'compositions', `s${i}.html`), html);
    hosts.push(`    <div id="s${i}" data-composition-id="s${i}" data-composition-src="compositions/s${i}.html" data-start="${at.toFixed(3)}" data-duration="${D}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`);
    at += D;
  }
  const total = Number(at.toFixed(3));
  const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="${GSAP}"></script>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${P.ink};}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${hosts.join('\n')}
${hasAudio ? `      <audio id="narration" class="clip" src="assets/narration.mp3" data-start="0" data-track-index="2" data-volume="1"></audio>` : ''}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
  await fs.writeFile(path.join(projectDir, 'index.html'), index);
  await fs.writeFile(path.join(projectDir, 'hyperframes.json'), JSON.stringify({paths: {blocks: 'compositions', components: 'compositions/components', assets: 'assets'}}, null, 2));
  await fs.writeFile(path.join(projectDir, 'meta.json'), JSON.stringify({id: path.basename(projectDir), name: clean(title, 60), generatedBy: 'reelforge'}, null, 2));
  return {projectDir, duration: total, scenes: scenes.length};
}

const cliBin = (root) => path.join(root, 'node_modules', '.bin', 'hyperframes');
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    let out = '';
    const child = spawn(cmd, args, {...opts, stdio: ['ignore', 'pipe', 'pipe']});
    const keep = (d) => { out = (out + d.toString()).slice(-6000); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`hyperframes exited ${code}: ${out.slice(-900)}`))));
  });
}

// Lint/validate the generated project. Returns the CLI's text output; throws on errors.
export const checkProject = (root, projectDir) => run(cliBin(root), ['check', '--json'], {cwd: projectDir, env: process.env});

export async function renderProject({root, projectDir, output, quality = process.env.HYPERFRAMES_QUALITY || 'delivery', fps = 30}) {
  await fs.mkdir(path.dirname(output), {recursive: true});
  return run(cliBin(root), ['render', '--output', output, '--quality', quality, '--fps', String(fps)], {cwd: projectDir, env: process.env});
}

export {LAYOUT_NAMES, here as moduleDir};
