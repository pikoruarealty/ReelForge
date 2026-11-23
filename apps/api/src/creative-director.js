import crypto from 'node:crypto';
// All layouts have Remotion implementations. A plan is reproducible from its seed.
export const LAYOUTS = Object.freeze([
  'kinetic_hook','word_wall','bold_statement','split_headline',
  'phone_focus','floating_phone','phone_zoom','app_spotlight',
  'news_stack','news_grid','headline_ticker','editorial_card',
  'stat_highlight','news_compare','city_pills','swipe_gallery',
  'spotlight_reveal','brand_endcard'
]);
const CATEGORIES={
  kinetic_hook:'text',word_wall:'text',bold_statement:'text',split_headline:'text',
  phone_focus:'phone',floating_phone:'phone',phone_zoom:'phone',app_spotlight:'phone',
  news_stack:'news',news_grid:'news',headline_ticker:'news',editorial_card:'news',
  stat_highlight:'data',news_compare:'news',city_pills:'news',swipe_gallery:'news',
  spotlight_reveal:'phone',brand_endcard:'brand'
};
export const TRANSITIONS=['slide','zoom','wipe','pop'];
const hash=(x)=>crypto.createHash('sha256').update(String(x)).digest().readUInt32LE(0);
const rand=(seed)=>{let state=(seed>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296}};
const categoriesFor={auto:['text','phone','news','data'],kinetic:['text','text','news','phone'],showcase:['phone','news','phone','text'],news:['news','data','text','phone'],cinematic:['phone','text','news','phone']};
export function buildCreativePlan({scenes,seed,mode='auto',variety=85,energy=75,previous=[]}={}){
 if(!Array.isArray(scenes)||!scenes.length)throw Error('Storyboard scenes required');
 if(!Object.hasOwn(categoriesFor,mode))throw Error('Unknown creative direction');
 const random=rand(Number(seed)>>>0);const prior=new Set(previous.slice(-4).flatMap(x=>x.layouts||[]));
 const layouts=[];const transitions=[];const used=new Set();
 for(let i=0;i<scenes.length;i++){
  const last=i===scenes.length-1;const first=i===0;
  const cats=categoriesFor[mode];
  let desired=first?'text':last?'brand':cats[Math.floor(random()*cats.length)];
  // Never two scenes of the same family back to back (e.g. two phone mockups in a row): re-draw from the others.
  if(!first&&!last&&desired===CATEGORIES[layouts.at(-1)]){const others=cats.filter(x=>x!==desired);if(others.length)desired=others[Math.floor(random()*others.length)];}
  const pool=LAYOUTS.filter(x=>CATEGORIES[x]===desired);
  const nonRepeating=pool.filter(x=>x!==layouts.at(-1));
  const candidates=nonRepeating.length?nonRepeating:LAYOUTS.filter(x=>x!==layouts.at(-1)&&x!=='brand_endcard');
  const ranked=[...candidates].sort((a,b)=>{
   const score=(v)=> (used.has(v)?12:0)+(prior.has(v)?Math.max(0,Number(variety))/17:0)+(CATEGORIES[v]===CATEGORIES[layouts.at(-1)]?8:0)+((hash(`${seed}:${i}:${v}`)%1000)/1000);
   return score(a)-score(b);
  });
  const selected=last?'brand_endcard':ranked[0];layouts.push(selected);used.add(selected);
  transitions.push(TRANSITIONS[Math.floor(random()*TRANSITIONS.length)]);
 }
 return {version:1,seed:Number(seed)>>>0,mode,variety:Math.max(0,Math.min(100,Number(variety)||0)),energy:Math.max(0,Math.min(100,Number(energy)||0)),layouts,transitions,createdAt:new Date().toISOString()};
}
export function randomSeed(){return crypto.randomBytes(4).readUInt32LE(0)};
export function applyCreativePlan(storyboard,creativePlan){
 return {...storyboard,scenes:storyboard.scenes.map((scene,i)=>({...scene,graphic:{...scene.graphic,layout:creativePlan.layouts[i],transition:creativePlan.transitions[i],motion_intensity:creativePlan.energy}}))};
}
