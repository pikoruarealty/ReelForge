import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {validatePlan} from './providers.js';
import {createPlan,evaluate,improve,makeImage,makeAudio,tightenNarration} from './providers.js';
import {generateMotion} from './motion.js';
import sharp from 'sharp';
import {buildCreativePlan,randomSeed} from './creative-director.js';
import {buildProject,checkProject,renderProject} from '@reel/render-hf';

const here=path.dirname(fileURLToPath(import.meta.url));
export const root=path.resolve(here,'../../..');
export const store=path.join(root,'storage');
const run=(cmd,args,opts={})=>new Promise((resolve,reject)=>{let error='';const child=spawn(cmd,args,{cwd:root,...opts});child.stderr.on('data',d=>{error+=d.toString().slice(-3000);if(error.length>8000)error=error.slice(-8000)});child.on('error',reject);child.on('close',code=>code===0?resolve(error):reject(new Error(`${cmd} exited ${code}: ${error.slice(-650)}`)))});
const exists=async(p)=>!!(await fs.stat(p).catch(()=>null));
const webUrl=(jobId,file)=>`http://127.0.0.1:${process.env.PORT||8787}/media/${jobId}/${file}`;
function safeText(t){return String(t).replace(/[\r\n]/g,' ').slice(0,800)}
// Free narration for demo mode: espeak (Linux/macOS), then the built-in Windows speech engine, then silence.
async function synthesizeFallback(text,wav){const tmp=wav+'.txt';await fs.writeFile(tmp,text,'utf8');try{
 try{await run('espeak',['-s','165','-f',tmp,'-w',wav]);return}catch{}
 if(process.platform==='win32'){const q=(v)=>v.replace(/'/g,"''");try{await run('powershell',['-NoProfile','-NonInteractive','-Command',`Add-Type -AssemblyName System.Speech;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$s.SetOutputToWaveFile('${q(wav)}');$s.Speak((Get-Content -Raw -LiteralPath '${q(tmp)}'));$s.Dispose()`]);return}catch{}}
 await run('ffmpeg',['-y','-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','30',wav]);
}finally{await fs.rm(tmp,{force:true})}}
async function prepareImages(job,plan,changed,real){for(let i=0;i<plan.scenes.length;i++){const file=`scene-${i}.png`,target=path.join(job.dir,file);if(job.imageSource==='uploaded'){
  const assetId=job.assetIds[i%job.assetIds.length];
  if(!/^[0-9a-f-]{36}$/i.test(assetId))throw new Error('Invalid uploaded asset ID');
  const original=path.join(store,'uploads',`${assetId}.png`);
  if(!(await exists(original)))throw new Error(`Uploaded asset ${assetId} is missing; re-upload it`);
  // contain (default): keep the screenshot whole, the renderer frames it. cover: legacy fill-the-frame crop for photos.
  const cover=job.uploadFit==='cover';
  if(cover)await sharp(original).resize(1080,1920,{fit:'cover',position:'attention'}).png().toFile(target);
  else await sharp(original).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toFile(target);
  plan.scenes[i].image_fit=cover?'cover':'contain';
  plan.scenes[i].visual_source='uploaded';plan.scenes[i].uploaded_asset_id=assetId;plan.scenes[i].image_real=true;
 }else if(changed===null||changed.includes(i)||!(await exists(target))){
  const paid=real && (process.env.RENDER_STYLE==='cinematic' || (process.env.GRAPHICS_IMAGE_SCENES||'2,4').split(',').map(Number).includes(i));
  await makeImage(plan.scenes[i],i,target,paid);
  plan.scenes[i].visual_source='generated';
  // Renderer uses this to show real pictures full-bleed and keep placeholder art out of frame.
  plan.scenes[i].image_real=!!paid;
 }
 plan.scenes[i].imageUrl=webUrl(job.id,file)}}
async function prepareMotion(job,plan,real){
  job.motion={enabled:real&&process.env.MOTION_ENABLED==='true',clips:[],warnings:[]};
  if(!job.motion.enabled)return;
  // Hard cap protects against unexpected provider charges.
  const max=Math.max(0,Math.min(2,Number(process.env.MOTION_MAX_CLIPS??2)));
  const requested=(process.env.MOTION_SCENE_INDICES||'1,3').split(',').map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<plan.scenes.length);
  const selected=[...new Set(requested)].slice(0,max);
  for(const index of selected){
    try{
      const image=path.join(job.dir,`scene-${index}.png`);
      const clip=path.join(job.dir,`motion-${index}.mp4`);
      const result=await generateMotion(plan.scenes[index],image,clip,job.dir,index);
      plan.scenes[index].videoUrl=webUrl(job.id,`motion-${index}.mp4`);
      plan.scenes[index].videoDuration=result.duration;
      job.motion.clips.push({scene:index,model:result.model,duration:result.duration,jobId:result.jobId});
    }catch(e){
      const message=`Scene ${index+1}: ${e.message}`;
      job.motion.warnings.push(message);
      if(process.env.MOTION_ALLOW_STILL_FALLBACK==='false')throw new Error(message);
    }
    await save(job);
  }
}
async function prepareAudio(job,plan,real){const text=plan.scenes.map(s=>s.narration).join(' ');const mp3=path.join(job.dir,'narration.mp3');const wav=path.join(job.dir,'narration.wav');if(real){try{const result=await makeAudio(text,mp3,true);job.audioProvider=result.provider;job.audioWarning=result.warning||null;return mp3}catch(e){throw new Error(`Narration failed: ${e.message}. For a free narration test, set DEMO_MODE=true.`)}}await synthesizeFallback(text,wav);await run('ffmpeg',['-loglevel','error','-y','-i',wav,'-codec:a','libmp3lame','-q:a','4',mp3]);return mp3;}
async function renderRemotion(job,plan){const captionsPath=path.join(job.dir,'word-captions.json');const captions=await fs.readFile(captionsPath,'utf8').then(JSON.parse).catch(()=>[]);const props={title:plan.title,scenes:plan.scenes,audioUrl:webUrl(job.id,'narration.mp3'),wordCaptions:captions,renderStyle:process.env.RENDER_STYLE||'motion_graphics',renderTheme:job.renderTheme||process.env.RENDER_THEME||'default',creativePreset:job.creativePreset||'showcase',creativeIntensity:job.creativeIntensity??70,creativeTransition:job.creativeTransition||'slide',creativePlan:job.creativePlan||null};const propsFile=path.join(job.dir,'props.json');await fs.writeFile(propsFile,JSON.stringify(props));const entry=path.join(root,'packages/render/src/index.jsx');await run(path.join(root,'node_modules/.bin/remotion'),['render',entry,'ReelVideo',path.join(job.dir,'reel.mp4'),`--props=${propsFile}`,'--codec=h264','--concurrency=2','--log=error'],{env:{...process.env,REMOTION_CHROME_EXECUTABLE:process.env.REMOTION_CHROME_EXECUTABLE||'/usr/bin/chromium'}});}
// HyperFrames (HTML + GSAP) renderer. Builds a self-contained project from cached assets, lints it, renders to MP4.
// RENDERER=hyperframes (default) | remotion. No AI provider is called here.
export const activeRenderer=()=>(process.env.RENDERER||'hyperframes').toLowerCase()==='remotion'?'remotion':'hyperframes';
async function renderHyperframes(job,plan){
 const wordCaptions=await fs.readFile(path.join(job.dir,'word-captions.json'),'utf8').then(JSON.parse).catch(()=>[]);
 const projectDir=path.join(job.dir,'hf-project');
 const built=await buildProject({jobDir:job.dir,projectDir,plan,creativePlan:job.creativePlan,creativePreset:job.creativePreset||'showcase',creativeIntensity:job.creativeIntensity??70,creativeTransition:job.creativeTransition||'slide',wordCaptions,title:plan.title});
 // Scene lengths come from the narration audio; keep them on the job so the UI/quality review can show them.
 job.timing=built.timing;
 // check exits non-zero on lint errors, so a broken composition fails loudly instead of rendering garbage.
 if(process.env.HYPERFRAMES_CHECK!=='false'){
  const out=await checkProject(root,projectDir);
  try{const j=JSON.parse(out.slice(out.indexOf('{'),out.lastIndexOf('}')+1));const all=['lint','layout','contrast','craft','motion'].flatMap(k=>j[k]?.findings||[]);job.hfCheck={ok:j.ok!==false,warnings:all.filter(f=>f.severity==='warning').length,infos:all.filter(f=>f.severity==='info').length}}catch{job.hfCheck={ok:true}}
 }
 await renderProject({root,projectDir,output:path.join(job.dir,'reel.mp4')});
}
// One entry point for "make reel.mp4 from cached assets". Returns the name of the renderer that produced it.
async function renderVideo(job,plan){
 if(activeRenderer()==='hyperframes'){await renderHyperframes(job,plan);return 'HyperFrames'}
 if(process.env.USE_REMOTION==='false'){await renderFallback(job,plan);return 'FFmpeg fallback'}
 await renderRemotion(job,plan);return 'Remotion';
}
async function renderFallback(job,plan){const clips=[];for(let i=0;i<plan.scenes.length;i++){const file=path.join(job.dir,`clip-${i}.mp4`);await run('ffmpeg',['-loglevel','error','-y','-loop','1','-framerate','30','-i',path.join(job.dir,`scene-${i}.png`),'-t',String(plan.scenes[i].duration),'-vf','scale=720:1280:flags=lanczos,format=yuv420p','-r','30','-c:v','libx264','-preset','ultrafast','-crf','26',file]);clips.push(file)}const list=path.join(job.dir,'clips.txt');await fs.writeFile(list,clips.map(f=>`file '${f.replaceAll("'","'\\''")}'`).join('\n'));const silent=path.join(job.dir,'silent.mp4');await run('ffmpeg',['-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-c','copy',silent]);await run('ffmpeg',['-loglevel','error','-y','-i',silent,'-i',path.join(job.dir,'narration.mp3'),'-c:v','copy','-c:a','aac','-af','apad','-t','30','-movflags','+faststart',path.join(job.dir,'reel.mp4')]);}
async function tryAlignSubtitles(job){
 const script=path.join(root,'services','align_subtitles.py');
 if(process.env.ENABLE_WHISPER!=='true'){job.subtitleMode='scene-timed';return}
 try{await run(process.env.PYTHON_BIN||'python3',[script,path.join(job.dir,'narration.mp3'),path.join(job.dir,'word-captions.json'),path.join(job.dir,'subtitles.srt')]);job.subtitleMode='word-aligned';}
 catch(e){job.subtitleWarning=`Whisper unavailable; scene-timed captions retained: ${e.message}`;job.subtitleMode='scene-timed'}
}
export async function save(job){job.updatedAt=new Date().toISOString();await fs.writeFile(path.join(job.dir,'job.json'),JSON.stringify({...job,dir:undefined},null,2));}
export async function createJob(topic,imageSource="generated",assetIds=[],creativeOptions={}){await fs.mkdir(store,{recursive:true});const id=`reel-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const dir=path.join(store,id);await fs.mkdir(dir);const job={id,dir,topic,imageSource,assetIds,status:'queued',phase:'Queued',progress:0,createdAt:new Date().toISOString(),versions:[],error:null,videoUrl:null,renderVersions:[],dirty:{images:[],audio:false},cacheMode:'reuse',renderTheme:process.env.RENDER_THEME||'default',creativePreset:'showcase',creativeIntensity:70,creativeTransition:'slide',creativeMode:creativeOptions.creativeMode||'auto',visualVariety:creativeOptions.visualVariety??85,uploadFit:creativeOptions.uploadFit||'contain',creativitySeed:creativeOptions.creativitySeed??randomSeed(),creativePlan:null,creativeHistory:[]};await save(job);return job;}
export async function executeJob(job){const real=process.env.DEMO_MODE==='false';const update=async(phase,progress,extra={})=>{Object.assign(job,{status:'working',phase,progress,...extra});await save(job)};try{
 await update('Generating idea, script and storyboard',12);let plan=await createPlan(job.topic,real);await update('Evaluating initial storyboard',24);let evaluation=await evaluate(plan,real,0);job.versions.push({number:1,score:evaluation.score,feedback:evaluation.feedback});let revision=0;const limit=Math.max(0,Math.min(3,Number(process.env.MAX_REVISIONS??3)));const threshold=Number(process.env.QUALITY_THRESHOLD||85);let changed=null;
 while(evaluation.score<threshold&&revision<limit){revision++;await update(`Optimizing weak scenes (revision ${revision}/${limit})`,24+revision*6);const candidate=await improve(plan,evaluation,real);if(!candidate.changed.length)break;plan=candidate.plan;changed=candidate.changed;evaluation=await evaluate(plan,real,revision);job.versions.push({number:revision+1,score:evaluation.score,feedback:evaluation.feedback,changed});}
 {const t=await tightenNarration(plan,real);plan=t.plan;job.narration={words:t.after,wordsBefore:t.before,tightened:t.rewritten,...(t.error?{warning:t.error}:{})};}
 job.creativePlan=buildCreativePlan({scenes:plan.scenes,seed:job.creativitySeed??randomSeed(),mode:job.creativeMode||'auto',variety:job.visualVariety??85,energy:job.creativeIntensity??80});job.creativeHistory=[job.creativePlan];job.renderTheme='propshort';job.plan=plan;job.evaluation=evaluation;await fs.writeFile(path.join(job.dir,'storyboard.json'),JSON.stringify(plan,null,2));await update(job.imageSource==='uploaded'?'Preparing uploaded images':'Generating six images',53);await prepareImages(job,plan,null,real);await update('Generating selected AI-motion clips',60);await prepareMotion(job,plan,real);await fs.writeFile(path.join(job.dir,'storyboard.json'),JSON.stringify(plan,null,2));await update('Synthesizing narration',68);await prepareAudio(job,plan,real);await tryAlignSubtitles(job);await update('Rendering 9:16 video',82);
 let renderer='Remotion';if(activeRenderer()==='hyperframes'){try{renderer=await renderVideo(job,plan)}catch(e){throw new Error(`HyperFrames render failed: ${e.message}`)}}else{if(process.env.RENDER_STYLE==='motion_graphics' && process.env.USE_REMOTION==='false')throw new Error('Motion graphics require USE_REMOTION=true. FFmpeg fallback cannot render animated counters or cards.');if(process.env.USE_REMOTION!=='false'){try{await renderRemotion(job,plan)}catch(e){if((process.env.RENDER_STYLE||'motion_graphics')==='motion_graphics')throw new Error(`Motion-graphics Remotion render failed: ${e.message}`);job.renderWarning=`Remotion unavailable; used FFmpeg fallback: ${e.message}`;renderer='FFmpeg fallback';await renderFallback(job,plan)}}else{renderer='FFmpeg fallback';await renderFallback(job,plan)}}
 await update('Validating MP4',96);await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1',path.join(job.dir,'reel.mp4')]);job.status='completed';job.phase='Complete';job.progress=100;job.renderer=renderer;job.videoUrl=`/media/${job.id}/reel.mp4`;job.storyboardUrl=`/media/${job.id}/storyboard.json`;await initializeCache(job);await archiveRender(job);await save(job);
 }catch(err){job.status='failed';job.phase='Failed';job.error=err.message;await save(job)}return job;}

const digest=(value)=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const planFile=(job)=>path.join(job.dir,'storyboard.json');
const manifestFile=(job)=>path.join(job.dir,'asset-manifest.json');
// Cache signatures track actual content changes, not provider/model/render settings.
// Switching render style or API provider must not force paid regeneration during testing.
const imageSignature=(job,scene,i)=>digest({prompt:job.imageSource==='uploaded'?null:scene.image_prompt,imageSource:job.imageSource,assetId:job.imageSource==='uploaded'?job.assetIds[i%job.assetIds.length]:null});
const audioSignature=(plan)=>digest({text:plan.scenes.map(x=>x.narration).join(' ')});
const getManifest=async(job)=>{try{return JSON.parse(await fs.readFile(manifestFile(job),'utf8'))}catch{return {images:{},audio:null}}};
const writeManifest=async(job,manifest)=>fs.writeFile(manifestFile(job),JSON.stringify(manifest,null,2));
async function loadPlan(job){try{return JSON.parse(await fs.readFile(planFile(job),'utf8'))}catch{if(job.plan)return structuredClone(job.plan);throw new Error('Storyboard file missing')}}
export async function getAssetState(job){
 const plan=await loadPlan(job),manifest=await getManifest(job);
 const staleImages=[];
 for(let i=0;i<plan.scenes.length;i++){
  if(!(await exists(path.join(job.dir,`scene-${i}.png`)))|| (manifest.images[i]&&manifest.images[i]!==imageSignature(job,plan.scenes[i],i)))staleImages.push(i);
 }
 const audioMissing=!(await exists(path.join(job.dir,'narration.mp3')));
 const audioStale=audioMissing||Boolean(manifest.audio&&manifest.audio!==audioSignature(plan));
 return {staleImages,audioStale,audioMissing,renderVersions:job.renderVersions||[],mode:job.cacheMode||'reuse'};
}
export async function archiveRender(job){
 const source=path.join(job.dir,'reel.mp4');if(!(await exists(source)))throw new Error('Rendered MP4 missing');
 const count=(job.renderVersions||[]).length+1, filename=`version-${count}.mp4`;
 await fs.mkdir(path.join(job.dir,'renders'),{recursive:true});
 await fs.copyFile(source,path.join(job.dir,'renders',filename));
 job.renderVersions=[...(job.renderVersions||[]),{number:count,createdAt:new Date().toISOString(),url:`/media/${job.id}/renders/${filename}`,renderStyle:process.env.RENDER_STYLE||'motion_graphics',renderTheme:job.renderTheme||process.env.RENDER_THEME||'default',creativePreset:job.creativePreset||'showcase',creativeIntensity:job.creativeIntensity??70,creativeTransition:job.creativeTransition||'slide',creativePlan:job.creativePlan||null}];
}
export async function initializeCache(job){
 const plan=await loadPlan(job),manifest={images:{},audio:audioSignature(plan),updatedAt:new Date().toISOString()};
 for(let i=0;i<plan.scenes.length;i++)manifest.images[i]=imageSignature(job,plan.scenes[i],i);
 await writeManifest(job,manifest);
}
export async function updateStoryboard(job,raw){
 if(job.status==='working'||job.status==='queued')throw new Error('Project is busy');
 const old=await loadPlan(job);
 const updated=validatePlan(raw,job.topic);
 // Preserve original generated media references. They are updated only when corresponding media is regenerated.
 for(let i=0;i<updated.scenes.length;i++){
  updated.scenes[i].imageUrl=old.scenes[i].imageUrl||webUrl(job.id,`scene-${i}.png`);
  if(old.scenes[i].videoUrl&&old.scenes[i].motion_prompt===updated.scenes[i].motion_prompt&&old.scenes[i].image_prompt===updated.scenes[i].image_prompt)updated.scenes[i].videoUrl=old.scenes[i].videoUrl;
  if(old.scenes[i].videoDuration)updated.scenes[i].videoDuration=old.scenes[i].videoDuration;
  if(old.scenes[i].visual_source)updated.scenes[i].visual_source=old.scenes[i].visual_source;
  if(typeof old.scenes[i].image_real==='boolean')updated.scenes[i].image_real=old.scenes[i].image_real;
  if(old.scenes[i].uploaded_asset_id)updated.scenes[i].uploaded_asset_id=old.scenes[i].uploaded_asset_id;
 }
 // Backfill signatures for pre-upgrade projects based on their previous storyboard.
 const manifest=await getManifest(job);
 for(let i=0;i<old.scenes.length;i++)if(!manifest.images[i]&&await exists(path.join(job.dir,`scene-${i}.png`)))manifest.images[i]=imageSignature(job,old.scenes[i],i);
 if(!manifest.audio&&await exists(path.join(job.dir,'narration.mp3')))manifest.audio=audioSignature(old);
 await writeManifest(job,manifest);
 await fs.writeFile(planFile(job),JSON.stringify(updated,null,2));job.plan=updated;job.cachedStoryboardUpdatedAt=new Date().toISOString();
 await save(job);return getAssetState(job);
}
export async function regenerateAssets(job,{kind,sceneIndex,allowPaid=false}={}){
 if(!['image','audio','stale','motion'].includes(kind))throw new Error('Unknown regeneration operation');
 if(job.status==='working'||job.status==='queued')throw new Error('Project is busy');
 if(process.env.DEMO_MODE==='false'&&!allowPaid)throw new Error('Paid API calls require explicit confirmation');
 const real=process.env.DEMO_MODE==='false',plan=await loadPlan(job),manifest=await getManifest(job);
 if(kind==='image'||kind==='motion'){
  if(!Number.isInteger(sceneIndex)||sceneIndex<0||sceneIndex>=plan.scenes.length)throw new Error('Choose a valid scene index');
 }
 job.status='working';job.phase=`Regenerating ${kind}`;job.progress=35;job.error=null;await save(job);
 try{
  const state=await getAssetState(job);
  const imageIndices=kind==='image'?[sceneIndex]:kind==='stale'?state.staleImages:[];
  for(const i of imageIndices){
   if(job.imageSource==='uploaded'){
    await prepareImages(job,plan,[i],real); // Uses assigned uploads; no image API.
   } else {
    const paid=real&& (process.env.RENDER_STYLE==='cinematic'||(process.env.GRAPHICS_IMAGE_SCENES||'2,4').split(',').map(Number).includes(i));
    await makeImage(plan.scenes[i],i,path.join(job.dir,`scene-${i}.png`),paid);
    plan.scenes[i].image_real=!!paid;
   }
   manifest.images[i]=imageSignature(job,plan.scenes[i],i);
   delete plan.scenes[i].videoUrl;delete plan.scenes[i].videoDuration; // Avoid stale image-to-video previews
   await fs.rm(path.join(job.dir,`motion-${i}.mp4`),{force:true});
  }
  if(kind==='audio'||(kind==='stale'&&state.audioStale)){
   await prepareAudio(job,plan,real);manifest.audio=audioSignature(plan);
   await fs.rm(path.join(job.dir,'word-captions.json'),{force:true});
   await tryAlignSubtitles(job);
  }
  if(kind==='motion'){
   if(process.env.MOTION_ENABLED!=='true')throw new Error('Enable MOTION_ENABLED=true to generate motion clips');
   const image=path.join(job.dir,`scene-${sceneIndex}.png`);
   const clip=path.join(job.dir,`motion-${sceneIndex}.mp4`);
   const result=await generateMotion(plan.scenes[sceneIndex],image,clip,job.dir,sceneIndex);
   plan.scenes[sceneIndex].videoUrl=webUrl(job.id,`motion-${sceneIndex}.mp4`);
   plan.scenes[sceneIndex].videoDuration=result.duration;
  }
  await fs.writeFile(planFile(job),JSON.stringify(plan,null,2));job.plan=plan;
  await writeManifest(job,manifest);job.status='completed';job.phase='Assets ready — render to view changes';job.progress=100;
  await save(job);
 }catch(err){job.status='failed';job.phase='Regeneration failed';job.error=err.message;await save(job)}return job;
}
export async function rerenderJob(job){
 if(job.status==='working'||job.status==='queued')throw new Error('Project is busy');
 const state=await getAssetState(job);
 if(state.staleImages.length||state.audioStale)throw new Error(`Assets stale. Regenerate ${state.staleImages.length?'scene images '+state.staleImages.map(i=>i+1).join(', '):''}${state.audioStale?' and narration':''} first.`);
 const plan=await loadPlan(job);job.status='working';job.phase='Rendering saved assets (no AI requests)';job.progress=70;job.error=null;await save(job);
 try{
  if(activeRenderer()==='remotion'&&process.env.USE_REMOTION==='false'&&(process.env.RENDER_STYLE||'motion_graphics')==='motion_graphics')throw new Error('Motion graphics require Remotion');
  job.renderer=await renderVideo(job,plan);
  await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1',path.join(job.dir,'reel.mp4')]);
  await archiveRender(job);job.status='completed';job.phase='Rendered from cache';job.progress=100;job.videoUrl=`/media/${job.id}/reel.mp4`;
 }catch(err){job.status='failed';job.phase='Render failed';job.error=err.message}
 await save(job);return job;
}

export async function loadJob(id){if(!/^reel-[a-zA-Z0-9-]+$/.test(id))return null;const file=path.join(store,id,'job.json');try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return null}}
// A job only runs inside the process that started it. If the API restarts (node --watch does this on every file
// change) the job is gone but its job.json still says "working", which blocks every new job with a 409. On startup
// nothing can be running yet, so any job still marked working/queued is orphaned: mark it failed so it can be re-run.
export async function recoverInterruptedJobs(){
 let n=0;
 for(const j of await listJobs()){
  if(!['working','queued'].includes(j.status))continue;
  const job={...j,dir:path.join(store,j.id)};
  Object.assign(job,{status:'failed',phase:'Interrupted',error:'The API restarted while this job was running (for example a dev-server reload). Start it again; cached images are kept.'});
  await save(job);n++;
 }
 return n;
}
export async function listJobs(){await fs.mkdir(store,{recursive:true});const names=(await fs.readdir(store)).filter(x=>x.startsWith('reel-'));const jobs=await Promise.all(names.map(loadJob));return jobs.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50)}
