import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCreativePlan,LAYOUTS,applyCreativePlan} from '../apps/api/src/creative-director.js';
const scenes=Array.from({length:6},()=>({duration:5,narration:'Existing narration',image_prompt:'Existing image'}));
test('plans have six valid layouts and no adjacent repeats across 1000 seeds',()=>{
 for(let seed=0;seed<1000;seed++){
  const plan=buildCreativePlan({scenes,seed,mode:['auto','kinetic','showcase','news','cinematic'][seed%5]});
  assert.equal(plan.layouts.length,6);
  assert.equal(plan.layouts.at(-1),'brand_endcard');
  assert(plan.layouts.every(x=>LAYOUTS.includes(x)));
  assert(plan.layouts.every((x,i)=>i===0||x!==plan.layouts[i-1]));
 }
});
test('same seed yields same design; varying seed varies design',()=>{
 const a=buildCreativePlan({scenes,seed:177}),b=buildCreativePlan({scenes,seed:177});
 assert.deepEqual(a.layouts,b.layouts);assert.deepEqual(a.transitions,b.transitions);
 const unique=new Set(Array.from({length:30},(_,i)=>buildCreativePlan({scenes,seed:i}).layouts.join('|')));
 assert(unique.size>20);
});
test('applying local motion plan preserves script and image prompts',()=>{
 const original={title:'PropShort',scenes};const director=buildCreativePlan({scenes,seed:100});
 const modified=applyCreativePlan(original,director);
 assert.equal(modified.scenes[0].narration,scenes[0].narration);
 assert.equal(modified.scenes[0].image_prompt,scenes[0].image_prompt);
 assert.equal(modified.scenes[0].graphic.layout,director.layouts[0]);
});
