// HyperFrames renderer for ReelForge.
//
// buildProject() turns a job's cached assets (scene images, narration, storyboard) plus its creative plan
// into a HyperFrames project directory:
//   index.html                 root: scene hosts, captions host, narration, optional music, brand chip
//   compositions/s<N>.html     one designed scene per sub-composition (GSAP timeline each)
//   compositions/captions.html word-by-word karaoke captions for the whole video
//   lib/gsap.min.js            local GSAP copy (offline, deterministic, no CDN at render time)
// renderProject() renders that directory to MP4 with the local HyperFrames CLI.
//
// No AI provider is called. Timing is derived from the narration audio (see timing.js), so the cost of a
// render is the same as before; only the picture gets better.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildLayout, familyName, LAYOUT_NAMES, P, clean, esc, headlineText} from './layouts.js';
import {ENTRANCES, mulberry32, transitionIn, edgeStyle, num} from './motion.js';
import {planTimeline} from './timing.js';
import {analyzeNarration} from './audio.js';
import {captionsComposition} from './captions.js';
import {chromeComposition} from './chrome.js';
import {FONT_STACK, DEV_RE, fontFaceCss} from './fonts.js';
import {sceneBeats, impactMoments} from './beats.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const W = 1080, H = 1920;
const OVERLAP = 0.4; // seconds the incoming scene plays its transition over the outgoing one
// Fallback ladder for scenes with no creative plan: hook, fact, device, number, cards, sign-off.
const LEGACY_LAYOUTS = ['kinetic_hook', 'bold_statement', 'phone_focus', 'stat_highlight', 'news_stack', 'brand_endcard'];
const LEGACY_TRANSITIONS = ['wipe', 'zoom', 'pop', 'slide'];
const ALTERNATES = ['news_stack', 'phone_focus', 'headline_ticker', 'bold_statement'];

// Pick every scene's layout, then break up neighbours that would render as the same design family.
// Scenes whose picture is an uploaded screenshot are routed to PROOF, which shows the screenshot whole (never cropped or
// full-bleed). The opening hook and number scenes stay text-only for rhythm; the sign-off is always the end card.
const SCREENSHOT_FAMILIES = new Set(['device', 'statement', 'cards', 'ticker', 'hook']);
function pickLayouts(scenes, creativePlan, images) {
  const layouts = scenes.map((s, i) => s?.graphic?.layout || creativePlan?.layouts?.[i] || LEGACY_LAYOUTS[Math.min(i, LEGACY_LAYOUTS.length - 1)]);
  for (let i = 1; i < layouts.length - 1; i++) {
    if (images[i]?.kind === 'screenshot') continue;
    const fam = (j) => familyName(layouts[j], scenes[j]);
    if (fam(i) !== fam(i - 1)) continue;
    const alt = ALTERNATES.find((a) => { const f = familyName(a, scenes[i]); return f !== fam(i - 1) && f !== familyName(layouts[i + 1], scenes[i + 1]); });
    if (alt && !scenes[i]?.graphic?.layout) layouts[i] = alt; // an explicit per-scene override always wins
  }
  return layouts.map((l, i) => {
    if (images[i]?.kind !== 'screenshot' || i === layouts.length - 1) return l;
    const fam = familyName(l, scenes[i]);
    return SCREENSHOT_FAMILIES.has(fam) && !(fam === 'hook' && i === 0) ? 'screenshot_proof' : l;
  });
}
const exists = (p) => fs.stat(p).then(() => true, () => false);
async function pngSize(file) {
  const fh = await fs.open(file, 'r');
  try {
    const b = Buffer.alloc(24);
    await fh.read(b, 0, 24, 0);
    return b.toString('ascii', 1, 4) === 'PNG' ? {w: b.readUInt32BE(16), h: b.readUInt32BE(20)} : {w: 0, h: 0};
  } finally { await fh.close(); }
}

// Empty a project folder for a fresh build. On Windows the folder itself can be locked (a lingering
// browser or CLI process keeps it as its cwd), so on failure clear its contents instead of removing it.
async function resetDir(dir) {
  try {
    await fs.rm(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 150});
    await fs.mkdir(dir, {recursive: true});
  } catch {
    await fs.mkdir(dir, {recursive: true});
    for (const name of await fs.readdir(dir)) {
      if (name === '.hyperframes') continue; // CLI caches and reports; safe to leave
      await fs.rm(path.join(dir, name), {recursive: true, force: true, maxRetries: 5, retryDelay: 150});
    }
  }
}

// Which scenes carry a real picture (uploaded image or paid AI image) versus local placeholder art?
// Uploaded images that are screenshots (image_fit !== 'cover') keep their own aspect and are shown whole (kind 'screenshot').
// Placeholder scenes borrow the nearest real AI picture (a different crop each time), so the two paid images in a six-scene
// reel cover the whole film instead of leaving gradient scenes. Screenshots are never reused as backgrounds.
function resolveImages(scenes) {
  const shot = (s) => Boolean(s.__asset) && s.visual_source === 'uploaded' && s.image_fit !== 'cover';
  const real = scenes.map((s) => Boolean(s.__asset) && (s.visual_source === 'uploaded' || s.image_real !== false));
  const realIdx = real.map((r, i) => (r && !shot(scenes[i]) ? i : -1)).filter((i) => i >= 0);
  const out = [];
  scenes.forEach((s, i) => {
    const dims = {w: s.__w || 0, h: s.__h || 0};
    if (shot(s)) { out.push({src: s.__asset, real: true, reused: false, from: i, kind: 'screenshot', ...dims}); return; }
    if (real[i]) { out.push({src: s.__asset, real: true, reused: false, from: i, kind: 'photo', ...dims}); return; }
    if (!realIdx.length) { out.push({src: s.__asset || null, real: false, reused: false, from: i, kind: 'placeholder', ...dims}); return; }
    // Prefer a different picture than the scene before; among equals, the nearest one.
    const prev = out[i - 1]?.from;
    const ranked = [...realIdx].sort((a, b) => (Number(a === prev) - Number(b === prev)) || (Math.abs(a - i) - Math.abs(b - i)));
    out.push({src: scenes[ranked[0]].__asset, real: true, reused: true, from: ranked[0], kind: 'photo', w: scenes[ranked[0]].__w || 0, h: scenes[ranked[0]].__h || 0});
  });
  return out;
}

export async function buildProject({jobDir, projectDir, plan, creativePlan, creativePreset = 'showcase', creativeTransition = 'slide', wordCaptions = [], title = 'ReelForge', musicFile = process.env.BACKGROUND_MUSIC, language = 'en'}) {
  const scenes = (plan.scenes || []).map((s) => ({...s}));
  if (!scenes.length) throw new Error('Storyboard has no scenes');
  await resetDir(projectDir);
  for (const d of ['compositions', 'assets', 'lib']) await fs.mkdir(path.join(projectDir, d), {recursive: true});

  // Assets are copied, not linked: the project must be self-contained for the renderer.
  for (let i = 0; i < scenes.length; i++) {
    const src = path.join(jobDir, `scene-${i}.png`);
    if (await exists(src)) {
      await fs.copyFile(src, path.join(projectDir, 'assets', `scene-${i}.png`));
      scenes[i].__asset = `assets/scene-${i}.png`;
      const sz = await pngSize(src);
      scenes[i].__w = sz.w;
      scenes[i].__h = sz.h;
    }
  }
  await fs.copyFile(require.resolve('gsap/dist/gsap.min.js'), path.join(projectDir, 'lib', 'gsap.min.js'));
  // Hindi (Devanagari) anywhere in the script, or a Hindi job: ship the font and declare it in every composition.
  const useDev = language !== 'en' || DEV_RE.test(JSON.stringify(scenes.map((s) => [s.narration, s.subtitle, s.graphic])));
  if (useDev) {
    await fs.mkdir(path.join(projectDir, 'assets', 'fonts'), {recursive: true});
    await fs.copyFile(path.join(here, '..', 'assets', 'fonts', 'NotoSansDevanagari.ttf'), path.join(projectDir, 'assets', 'fonts', 'NotoSansDevanagari.ttf'));
  }
  const fontCss = useDev ? fontFaceCss() : '';

  const narration = path.join(jobDir, 'narration.mp3');
  const hasAudio = await exists(narration);
  let audio = null;
  if (hasAudio) {
    await fs.copyFile(narration, path.join(projectDir, 'assets', 'narration.mp3'));
    audio = await analyzeNarration(narration);
  }
  const timing = planTimeline({scenes, audio, whisper: wordCaptions});
  const total = timing.total;

  const hasMusic = Boolean(musicFile) && await exists(musicFile);
  if (hasMusic) await fs.copyFile(musicFile, path.join(projectDir, 'assets', 'music' + (path.extname(musicFile) || '.mp3')));

  const images = resolveImages(scenes);
  const seed = Number(creativePlan?.seed ?? 20260101) >>> 0;
  const labels = scenes.map((s) => clean(s.subtitle || headlineText(s), 44));
  const hosts = [];
  const layouts = pickLayouts(scenes, creativePlan, images);
  const captionMode = (process.env.CAPTION_MODE || 'impact').toLowerCase(); // impact (default) | karaoke | off
  const karaoke = captionMode === 'karaoke';

  for (let i = 0; i < scenes.length; i++) {
    const slot = timing.scenes[i];
    const ov = i === 0 ? 0 : OVERLAP;
    const hostStart = Number((slot.start - ov).toFixed(3));
    const D = Number((slot.end - hostStart).toFixed(3));
    const layout = layouts[i];
    const tr = scenes[i]?.graphic?.transition || creativePlan?.transitions?.[i] || LEGACY_TRANSITIONS[i % LEGACY_TRANSITIONS.length] || creativeTransition;
    const p = `s${i}`;
    const rng = mulberry32(seed * 7919 + i * 104729 + 17);
    // Words of this scene in scene-local seconds. They drive the beats (clause breaks) and impact stamps (key words spoken).
    const words = (timing.wordsByScene[i] || []).map((w) => ({text: w.text, start: Number((w.start - hostStart).toFixed(3)), end: Number((w.end - hostStart).toFixed(3))}));
    const ctx = {
      p, scene: scenes[i], scenes, index: i, n: scenes.length, D, ov, t0: Number((ov * 0.6).toFixed(3)),
      words, beats: sceneBeats(words, D),
      lang: (language === 'hi' || DEV_RE.test(`${scenes[i]?.graphic?.headline || ''}${scenes[i]?.subtitle || ''}`)) ? 'hi' : 'en',
      shots: images.filter((m) => m.kind === 'screenshot' && m.w && m.h).map((m) => ({src: m.src, w: m.w, h: m.h})),
      impacts: layout === 'brand_endcard' ? [] : impactMoments(words, D, {hint: scenes[i]?.graphic?.highlight, max: D > 7 ? 3 : 2}),
      entrance: ENTRANCES[(seed + i) % ENTRANCES.length], rng, img: images[i],
      pool: [...new Set(images.filter((m) => m.real && m.kind !== 'screenshot').map((m) => m.src))].map((src) => ({src, real: true})),
      labels: labels.slice(i + 1).concat(labels.slice(0, i + 1)),
    };
    const body = buildLayout(layout, ctx);
    const html = `<template>
  <style>
    ${fontCss}
    #root{position:absolute;inset:0;font-family:${FONT_STACK};overflow:hidden;}
    #root img{display:block;}
  </style>
  <div id="root" data-composition-id="${p}" data-width="${W}" data-height="${H}">
    <div id="${p}-clip" class="clip" data-start="0" data-duration="${D}" data-track-index="0" style="position:absolute;inset:0;overflow:hidden;">
      <div id="${p}-stage" style="position:absolute;inset:0;">${body.html}</div>
      <div id="${p}-edge" data-layout-allow-overflow style="${edgeStyle(tr)}"></div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${transitionIn(tr, p, ov)}
    ${body.js}
    window.__timelines["${p}"] = tl;
  </script>
</template>
`;
    await fs.writeFile(path.join(projectDir, 'compositions', `${p}.html`), html);
    // Alternate lanes so the overlapping transition frames never share one; later scenes paint on top.
    hosts.push(`    <div id="${p}" data-composition-id="${p}" data-composition-src="compositions/${p}.html" data-start="${hostStart}" data-duration="${D}" data-track-index="${1 + (i % 2)}" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:${10 + i};"></div>`);
  }

  if (karaoke) await fs.writeFile(path.join(projectDir, 'compositions', 'captions.html'), captionsComposition({words: timing.words, total, fontCss}));
  await fs.writeFile(path.join(projectDir, 'compositions', 'chrome.html'), chromeComposition({total, fontCss}));
  const musicTag = hasMusic
    ? `      <audio id="music" class="clip" src="assets/music${path.extname(musicFile) || '.mp3'}" data-start="0" data-duration="${total}" data-track-index="5" data-volume="0.13" data-fade-out="1.2"></audio>\n` : '';

  const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="lib/gsap.min.js"></script>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${P.ink};}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${hosts.join('\n')}
${karaoke ? `      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${total}" data-track-index="3" data-track-kind="captions" data-width="${W}" data-height="${H}" style="z-index:60;"></div>` : ''}
      <div id="chrome" data-composition-id="chrome" data-composition-src="compositions/chrome.html" data-start="0" data-duration="${total}" data-track-index="4" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:70;"></div>
${hasAudio ? `      <audio id="narration" class="clip" src="assets/narration.mp3" data-start="0" data-track-index="2" data-volume="1"></audio>\n` : ''}${musicTag}    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
  await fs.writeFile(path.join(projectDir, 'index.html'), index);
  await fs.writeFile(path.join(projectDir, 'hyperframes.json'), JSON.stringify({paths: {blocks: 'compositions', components: 'compositions/components', assets: 'assets'}}, null, 2));
  await fs.writeFile(path.join(projectDir, 'meta.json'), JSON.stringify({id: path.basename(projectDir), name: clean(title, 60), generatedBy: 'reelforge'}, null, 2));
  return {projectDir, duration: total, scenes: scenes.length, timing: {source: timing.source, total, slots: timing.scenes, captions: captionMode}};
}

// Run the CLI through `node` on its real entry file. The .bin shim is a shell script on Windows,
// which child_process.spawn cannot execute directly (ENOENT/EINVAL).
const cliEntry = (root) => path.join(root, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
function run(entry, args, opts = {}) {
  return new Promise((resolve, reject) => {
    let out = '';
    const child = spawn(process.execPath, [entry, ...args], {...opts, stdio: ['ignore', 'pipe', 'pipe']});
    const keep = (d) => { out = (out + d.toString()).slice(-6000); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`hyperframes exited ${code}: ${out.slice(-900)}`))));
  });
}

// Lint/validate the generated project. Resolves with the CLI's text output; rejects on errors.
export const checkProject = (root, projectDir) => run(cliEntry(root), ['check', '--json'], {cwd: projectDir, env: process.env});

export async function renderProject({root, projectDir, output, quality = process.env.HYPERFRAMES_QUALITY || 'delivery', fps = 30}) {
  await fs.mkdir(path.dirname(output), {recursive: true});
  return run(cliEntry(root), ['render', '--output', output, '--quality', quality, '--fps', String(fps)], {cwd: projectDir, env: process.env});
}

export {LAYOUT_NAMES, here as moduleDir, num, esc};
