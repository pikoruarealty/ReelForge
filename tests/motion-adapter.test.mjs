// Offline smoke test: no provider credits consumed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {generateMotion} from '../apps/api/src/motion.js';

const originalFetch=globalThis.fetch;
const originalKey=process.env.OPENROUTER_API_KEY;
const originalModel=process.env.MOTION_MODEL;
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'reelforge-motion-test-'));
let submits=0;
try {
  process.env.OPENROUTER_API_KEY='test-only-not-a-real-key';
  process.env.MOTION_MODEL='bytedance/seedance-2.0-mini';
  const image=path.join(temp,'scene-1.png');
  await fs.writeFile(image,Buffer.from([137,80,78,71,13,10,26,10]));
  globalThis.fetch=async (url,options={})=>{
    const href=String(url);
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
    if(href.endsWith('/videos/models')) return reply({data:[{id:process.env.MOTION_MODEL,supported_durations:[4,5,6],supported_resolutions:['480p'],supported_frame_images:['first_frame']}]});
    if(href.endsWith('/api/v1/videos')&&options.method==='POST'){
      submits++;
      const body=JSON.parse(options.body);
      assert.equal(body.frame_images[0].frame_type,'first_frame');
      assert.equal(body.aspect_ratio,'9:16');
      return reply({id:'job-test',status:'completed',polling_url:'/api/v1/videos/job-test'},202);
    }
    if(href.endsWith('/videos/job-test/content')) return new Response(Buffer.alloc(15000,2),{status:200});
    throw new Error(`Unexpected fetch: ${href}`);
  };
  const result=await generateMotion({duration:5,motion_prompt:'A student looks up'},image,path.join(temp,'clip.mp4'),temp,1);
  assert.equal(result.jobId,'job-test');
  assert.equal((await fs.stat(result.clipPath)).size,15000);
  assert.equal(submits,1);
  // Reuse saved job instead of a second paid request.
  await generateMotion({duration:5,motion_prompt:'A student looks up'},image,path.join(temp,'clip2.mp4'),temp,1);
  assert.equal(submits,1);
  console.log('PASS motion adapter offline smoke test');
} finally {
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=originalKey;
  if(originalModel===undefined)delete process.env.MOTION_MODEL;else process.env.MOTION_MODEL=originalModel;
  await fs.rm(temp,{recursive:true,force:true});
}
