// Timeline planning for the HyperFrames renderer. Pure functions, no I/O, no randomness.
//
// The old pipeline gave every scene a fixed duration ([3,4,5,6,6,6]) no matter how long the narration
// actually took, so pictures and speech drifted apart. Here scene boundaries come from the narration
// itself: from real word timestamps when Whisper ran, otherwise from an estimate that spreads the
// measured speech span over the words by length and punctuation. Costs nothing either way.

export const splitWords = (text) => String(text || '').split(/\s+/).filter(Boolean);

const letters = (w) => w.replace(/[^\p{L}\p{N}]/gu, '');
const weight = (w) => Math.max(2, letters(w).length);
const pause = (w) => (/[.!?…]["')\]]?$/.test(w) ? 5 : /[,;:—–-]["')\]]?$/.test(w) ? 2.5 : 0);

// Spread the speech span [start, end] over every narration word. Returns one word array per scene.
export function estimateWordTimes(scenes, start, end) {
  const per = scenes.map((s) => splitWords(s.narration));
  const total = per.flat().reduce((a, w) => a + weight(w) + pause(w), 0) || 1;
  const unit = Math.max(0.01, end - start) / total;
  let cursor = start;
  return per.map((list) => list.map((text) => {
    const a = cursor;
    cursor += (weight(text) + pause(text)) * unit;
    return {text, start: a, end: Math.min(cursor, a + weight(text) * unit)};
  }));
}

// Assign real (Whisper) words to scenes by walking the narration word counts. The recogniser can
// split or merge words, so we map by proportion rather than by exact index.
export function assignWhisperWords(scenes, whisper) {
  const counts = scenes.map((s) => splitWords(s.narration).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  let seen = 0;
  return counts.map((n, i) => {
    const from = Math.round((seen / total) * whisper.length);
    seen += n;
    const to = i === counts.length - 1 ? whisper.length : Math.round((seen / total) * whisper.length);
    return whisper.slice(from, to).map((w) => ({text: String(w.text), start: Number(w.start), end: Number(w.end)}));
  });
}

const valid = (w) => Array.isArray(w) && w.length > 4 && w.every((x) => Number.isFinite(Number(x.start)) && Number.isFinite(Number(x.end)));

export function planTimeline({scenes, audio = null, whisper = null, lead = 0.18, minScene = 1.6, tail = 1.1}) {
  if (!scenes?.length) throw new Error('No scenes to plan');
  const fixedTotal = scenes.reduce((a, s) => a + (Number(s.duration) || 5), 0);
  const hasAudio = audio && audio.duration > 1;
  const speechStart = hasAudio ? Math.max(0, audio.speechStart || 0) : 0.3;
  const speechEnd = hasAudio ? Math.max(speechStart + 1, audio.speechEnd || audio.duration) : fixedTotal - 0.6;

  let perScene, source;
  if (hasAudio && valid(whisper)) {
    perScene = assignWhisperWords(scenes, whisper);
    source = 'whisper';
  } else {
    perScene = estimateWordTimes(scenes, speechStart, speechEnd);
    source = hasAudio ? 'estimated' : 'storyboard';
  }

  const lastWord = perScene.flat().at(-1);
  const spoken = lastWord ? lastWord.end : speechEnd;
  const total = Number((hasAudio ? Math.min(audio.duration + 0.4, Math.max(spoken + tail, audio.duration)) : fixedTotal).toFixed(3));

  // A scene starts when its first word is spoken, a hair early so the picture leads the voice.
  const starts = scenes.map((_, i) => {
    if (i === 0) return 0;
    const first = perScene[i][0];
    return first ? Math.max(0, first.start - lead) : null;
  });
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] === null) starts[i] = starts[i - 1] + (total / scenes.length);
    starts[i] = Math.max(starts[i], starts[i - 1] + minScene);
  }
  // Squeeze from the end if minimum lengths pushed a start past the video.
  for (let i = starts.length - 1; i >= 1; i--) starts[i] = Math.min(starts[i], total - minScene * (starts.length - i));
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 0.5);

  const out = starts.map((s, i) => {
    const end = i === starts.length - 1 ? total : starts[i + 1];
    return {start: Number(s.toFixed(3)), end: Number(end.toFixed(3)), duration: Number((end - s).toFixed(3))};
  });
  return {total, scenes: out, words: perScene.flat(), wordsByScene: perScene, source, speech: {start: speechStart, end: speechEnd}};
}

// Karaoke caption groups: short bursts that break on punctuation, never wider than ~3 words.
export function captionGroups(words, {maxWords = 3, maxChars = 16} = {}) {
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  for (const w of words) {
    const text = String(w.text || '').replace(/^["'“‘(]+|["'”’)]+$/g, '');
    if (!text) continue;
    const next = {text, start: Number(w.start), end: Number(w.end)};
    const chars = [...cur, next].map((x) => x.text).join(' ').length;
    if (cur.length >= maxWords || (cur.length && chars > maxChars)) flush();
    cur.push(next);
    if (/[.!?,;:…]$/.test(text)) flush();
  }
  flush();
  return groups.map((g, i) => {
    const start = g[0].start;
    const natural = g.at(-1).end + 0.12;
    const nextStart = groups[i + 1]?.[0].start;
    const end = nextStart !== undefined && nextStart - natural < 0.5 ? nextStart : natural;
    return {words: g, start: Number(start.toFixed(3)), end: Number(Math.max(end, start + 0.35).toFixed(3))};
  });
}
