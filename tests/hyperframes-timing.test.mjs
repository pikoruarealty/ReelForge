import test from 'node:test';
import assert from 'node:assert/strict';
import {planTimeline, estimateWordTimes, captionGroups, assignWhisperWords} from '../packages/render-hf/src/timing.js';
import {numberFrom, pickHighlight} from '../packages/render-hf/src/layouts.js';

const scenes = [
  {duration: 3, narration: 'Stop scrolling. Prices just moved.'},
  {duration: 4, narration: 'Sector 17 saw a 12 percent jump in one quarter, which surprised almost every analyst.'},
  {duration: 5, narration: 'Here is what that means for you.'},
  {duration: 6, narration: 'Check the registry before you pay any token amount.'},
  {duration: 6, narration: 'Compare three nearby listings.'},
  {duration: 6, narration: 'Follow PropShort for more.'},
];

test('scene boundaries follow the speech, not the fixed 3/4/5/6/6/6 split', () => {
  const t = planTimeline({scenes, audio: {duration: 26, speechStart: 0.4, speechEnd: 25}});
  assert.equal(t.source, 'estimated');
  assert.equal(t.scenes[0].start, 0);
  // Scene 2 has by far the most words, so it must be the longest scene, unlike the fixed template.
  const lengths = t.scenes.map((s) => s.duration);
  assert.equal(lengths.indexOf(Math.max(...lengths)), 1);
  // contiguous, ordered, ends exactly at the total
  t.scenes.forEach((s, i) => { if (i) assert.equal(s.start, t.scenes[i - 1].end); assert.ok(s.duration >= 1.5); });
  assert.equal(t.scenes.at(-1).end, t.total);
  assert.ok(t.total <= 26.4 && t.total >= 25);
});

test('without narration audio the storyboard durations are kept', () => {
  const t = planTimeline({scenes, audio: null});
  assert.equal(t.source, 'storyboard');
  assert.equal(t.total, 30);
});

test('whisper words, when present, win over the estimate', () => {
  const whisper = [];
  let at = 0.5;
  for (const s of scenes) for (const w of s.narration.split(' ')) { whisper.push({text: w, start: at, end: at + 0.3}); at += 0.34; }
  const t = planTimeline({scenes, audio: {duration: at + 1, speechStart: 0.5, speechEnd: at}, whisper});
  assert.equal(t.source, 'whisper');
  assert.equal(t.words.length, whisper.length);
  const mapped = assignWhisperWords(scenes, whisper);
  assert.equal(mapped.flat().length, whisper.length);
});

test('word estimates are monotonic and stay inside the speech span', () => {
  const per = estimateWordTimes(scenes, 1, 20).flat();
  per.forEach((w, i) => { assert.ok(w.end > w.start); if (i) assert.ok(w.start >= per[i - 1].start); });
  assert.ok(per[0].start >= 1 && per.at(-1).end <= 20.001);
});

test('caption groups are short and break on punctuation', () => {
  const words = estimateWordTimes(scenes, 0.5, 24).flat();
  const groups = captionGroups(words);
  assert.ok(groups.every((g) => g.words.length <= 3));
  assert.ok(groups.every((g) => g.end > g.start));
  groups.forEach((g, i) => { if (i) assert.ok(g.start >= groups[i - 1].start); });
});

test('stat layout finds a real number and skips years', () => {
  assert.deepEqual(numberFrom({narration: 'Prices rose 12% in a quarter'}), {to: 12, prefix: '', suffix: '%'});
  assert.equal(numberFrom({narration: 'The market in 2026 looks calm'}), null);
  assert.equal(numberFrom({narration: 'A calm market'}), null);
  assert.equal(numberFrom({graphic: {headline: 'Check #1: Registry Status'}}), null);
  assert.equal(numberFrom({subtitle: 'Three steps, 3 checks'}), null);
  assert.deepEqual(numberFrom({graphic: {headline: 'Cost: 6 Months + ₹5 Lakhs'}}), {to: 5, prefix: '₹', suffix: ' Lakh'});
  assert.equal(numberFrom({graphic: {counter: {to: 450, prefix: '₹', suffix: ' Cr'}}}).to, 450);
  assert.equal(numberFrom({graphic: {counter: {to: 18, prefix: '₹', suffix: 'Lakh'}}}).suffix, ' Lakh');
  assert.equal(numberFrom({graphic: {counter: {to: 23, suffix: '%'}}}).suffix, '%');
});

test('highlight prefers the hint, then numbers, then the longest meaningful word', () => {
  assert.equal(pickHighlight(['Prices', 'JUMP', 'fast'], 'jump'), 1);
  assert.equal(pickHighlight(['Up', '12%', 'now'], null), 1);
  assert.equal(pickHighlight(['Registry', 'checks', 'matter'], null), 0);
});

// ---- Hindi --------------------------------------------------------------------------------------------------------
import {impactMoments, sceneBeats, endsClause} from '../packages/render-hf/src/beats.js';

test('hindi: the danda ends a sentence for timing, beats and caption groups', () => {
  assert.ok(endsClause('हैं।'));
  const hi = [{duration: 5, narration: 'यह पहला वाक्य है। यह दूसरा वाक्य है।'}, {duration: 5, narration: 'तीसरा वाक्य यहाँ है।'}];
  const t = estimateWordTimes(hi, 0.5, 12).flat();
  const groups = captionGroups(t);
  assert.ok(groups.length >= 3);
  assert.ok(groups.every((g) => g.words.length <= 3));
});

test('hindi: number words become one impact stamp and stop words never do', () => {
  const words = 'एक ख़रीदार ने अठारह लाख रुपये देकर प्लॉट ख़रीदा जो विक्रेता का था ही नहीं'.split(' ').map((text, i) => ({text, start: 1 + i * 0.45, end: 1.3 + i * 0.45}));
  const m = impactMoments(words, 8);
  assert.ok(m.some((x) => x.text.includes('अठारह') && x.text.includes('लाख')));
  assert.ok(m.every((x) => !['का', 'ही', 'नहीं', 'जो'].includes(x.text)));
});

test('hindi: counters get their unit with a separating space', () => {
  assert.equal(numberFrom({graphic: {counter: {to: 18, prefix: '₹', suffix: 'लाख'}}}).suffix, ' लाख');
  assert.deepEqual(numberFrom({narration: 'कीमत 12 प्रतिशत बढ़ी'}), {to: 12, prefix: '', suffix: '%'});
  assert.equal(numberFrom({graphic: {headline: 'फ्रीहोल्ड नियम बदल सकते हैं'}}), null);
});

test('hindi: the highlight word is found even with vowel signs', () => {
  assert.equal(pickHighlight(['रिज़र्व', 'प्राइस', 'उछला'], 'उछला'), 2);
});
