// Speech-driven moments inside a scene. Pure functions over word timings (local seconds from the scene host start).
//
// Two kinds of moment drive the "intermediary" animation while the voice is speaking:
//   beats   - clause boundaries (comma, full stop, dash). The screenshot camera steps on these, a ripple can fire.
//   impacts - the few words worth showing big (numbers, the highlight word, long key terms). Each is stamped on
//             screen at the instant it is spoken, so picture and voice land together instead of running captions.

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'are', 'was', 'from', 'what', 'why', 'how', 'will', 'can', 'not', 'but', 'about', 'they', 'their', 'have', 'has', 'had', 'into', 'than', 'then', 'there', 'here', 'when', 'where', 'which', 'would', 'could', 'should', 'just', 'more', 'most', 'some', 'only', 'before', 'after', 'check', 'verify']);
const NUMBER_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'fifteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand']);
const UNIT_WORDS = new Set(['lakh', 'lakhs', 'crore', 'crores', 'percent', '%', 'million', 'billion', 'rupees', 'rs', 'sqft', 'acres', 'acre', 'months', 'years', 'days']);

const norm = (w) => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}%₹]/gu, '');
const clean = (w) => String(w || '').replace(/^["'“‘(]+|[.,;:!?…"'”’)]+$/g, '');

export const endsClause = (w) => /[.,;:!?…—–]["')\]]?$/.test(String(w));

// Clause boundaries, at least `gap` seconds apart and away from the scene edges.
export function sceneBeats(words, D, {gap = 1.25, from = 0.9, tail = 0.9} = {}) {
  const out = [];
  words.forEach((w, i) => {
    if (!endsClause(w.text) || !words[i + 1]) return;
    const t = Number(words[i + 1].start);
    if (t < from || t > D - tail) return;
    if (!out.length || t - out.at(-1) >= gap) out.push(Number(t.toFixed(3)));
  });
  return out;
}

function score(w, hint) {
  const n = norm(w.text);
  if (!n) return 0;
  if (hint && n === norm(hint)) return 6;
  if (/\d/.test(n) || n.includes('₹')) return 5;
  if (NUMBER_WORDS.has(n)) return 4;
  if (UNIT_WORDS.has(n)) return 2;
  if (STOP.has(n)) return 0;
  if (n.length >= 8) return 3;
  if (n.length >= 6) return 2;
  return 0;
}

// Choose up to `max` words to stamp, spaced `gap` seconds apart. A number joins its neighbours so
// "twenty three percent" is one stamp, not three.
export function impactMoments(words, D, {hint = '', max = 2, gap = 1.6, from = 0.8, tail = 0.9} = {}) {
  const ranked = words.map((w, i) => ({i, s: score(w, hint)})).filter((x) => x.s > 0 && words[x.i].start >= from && words[x.i].start <= D - tail)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const picked = [];
  for (const r of ranked) {
    if (picked.length >= max) break;
    const t = words[r.i].start;
    if (picked.some((p) => Math.abs(words[p.i].start - t) < gap)) continue;
    picked.push(r);
  }
  return picked.sort((a, b) => a.i - b.i).map(({i}) => {
    let a = i, b = i;
    const isNum = (k) => NUMBER_WORDS.has(norm(words[k]?.text)) || /\d/.test(words[k]?.text || '');
    const isUnit = (k) => UNIT_WORDS.has(norm(words[k]?.text));
    if (isNum(i) || isUnit(i)) {
      while (a > 0 && isNum(a - 1) && i - a < 2) a--;
      while (b < words.length - 1 && (isNum(b + 1) || isUnit(b + 1)) && b - i < 2) b++;
      if (isNum(a) && !isUnit(b) && b === i && isUnit(i + 1)) b = i + 1;
    }
    const text = words.slice(a, b + 1).map((w) => clean(w.text)).join(' ').toUpperCase();
    return {t: Number(words[a].start.toFixed(3)), text};
  });
}

// When is the headline's accent word spoken? Falls back to the first impact, then to a fixed early beat.
export function spokenAt(words, hint, fallback) {
  const n = norm(hint);
  const w = n && words.find((x) => norm(x.text) === n);
  return w ? Number(w.start.toFixed(3)) : fallback;
}
