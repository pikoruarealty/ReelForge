import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {createJob,executeJob,listJobs,recoverInterruptedJobs,loadJob,root,store,getAssetState,updateStoryboard,regenerateAssets,rerenderJob} from './pipeline.js';
import {buildCreativePlan,randomSeed} from './creative-director.js';
import {reviewInstagram} from './quality.js';

dotenv.config({path:path.join(root,'.env')});
const app=express();app.disable('x-powered-by');app.use(cors({origin:['http://127.0.0.1:5173','http://localhost:5173']}));app.use(express.json({limit:'64kb'}));
const port=Number(process.env.PORT||8787);
app.get('/api/health',(_,res)=>res.json({ok:true,mode:process.env.DEMO_MODE==='false'?'live':'demo',models:{idea:process.env.CLAUDE_IDEA_MODEL||'claude-haiku-4-5',script:process.env.CLAUDE_SCRIPT_MODEL||'claude-sonnet-4-5',image:process.env.OPENROUTER_IMAGE_MODEL||'google/gemini-3.1-flash-image',tts:process.env.ELEVENLABS_MODEL||'eleven_flash_v2_5'},text_provider:process.env.OPENROUTER_API_KEY?'openrouter':'anthropic',image_provider:'openrouter',render_style:process.env.RENDER_STYLE||'motion_graphics',render_theme:process.env.RENDER_THEME||'default',motion:{enabled:process.env.MOTION_ENABLED==='true',model:process.env.MOTION_MODEL||'bytedance/seedance-2.0-mini',max_clips:Number(process.env.MOTION_MAX_CLIPS||2)},keys:{openrouter:!!process.env.OPENROUTER_API_KEY,anthropic:!!process.env.ANTHROPIC_API_KEY,google:!!process.env.GOOGLE_API_KEY,elevenlabs:!!process.env.ELEVENLABS_API_KEY}}));
// Upload images to be used instead of generated images. Only verified local files are accepted.
app.post('/api/assets',express.raw({type:['image/png','image/jpeg','image/webp'],limit:'20mb'}),async(req,res)=>{
 try{
  if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Provide a PNG, JPEG or WebP image'});
  const metadata=await sharp(req.body,{limitInputPixels:40000000}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format))return res.status(415).json({error:'Unsupported image format'});
  const id=crypto.randomUUID();const folder=path.join(store,'uploads');await fs.mkdir(folder,{recursive:true});
  const name=`${id}.png`;// Keep the whole image: screenshots must never be cropped at upload. Fit-to-9:16 cropping, if wanted, happens per job (uploadFit=cover).
  const normalized=await sharp(req.body).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();const outMeta=await sharp(normalized).metadata();
  await fs.writeFile(path.join(folder,name),normalized,{flag:'wx'});
  const asset={id,name,originalName:String(req.query.name||'uploaded-image').slice(0,120),width:outMeta.width,height:outMeta.height,url:`/media/uploads/${name}`};
  await fs.writeFile(path.join(folder,`${id}.json`),JSON.stringify(asset));res.status(201).json(asset);
 }catch(e){res.status(400).json({error:`Invalid image: ${e.message}`});}
});
app.get('/api/assets',async(_,res)=>{const folder=path.join(store,'uploads');const names=(await fs.readdir(folder).catch(()=>[])).filter(n=>n.endsWith('.json'));const assets=await Promise.all(names.map(async n=>JSON.parse(await fs.readFile(path.join(folder,n),'utf8'))));res.json(assets)});
app.get('/api/jobs',async(_,res)=>res.json(await listJobs()));
app.get('/api/jobs/:id',async(req,res)=>{const job=await loadJob(req.params.id);job?res.json(job):res.status(404).json({error:'Job not found'})});
app.post('/api/jobs',async(req,res)=>{const parsed=z.object({topic:z.string().trim().min(4).max(5000),imageSource:z.enum(['generated','uploaded']).default('generated'),assetIds:z.array(z.string().uuid()).max(12).default([]),creativeMode:z.enum(['auto','kinetic','showcase','news','cinematic']).default('auto'),creativitySeed:z.number().int().min(0).max(4294967295).optional(),visualVariety:z.number().int().min(0).max(100).default(85),uploadFit:z.enum(['contain','cover']).default('contain'),language:z.enum(['en','hi','hi_voice']).default('en')}).refine(d=>d.imageSource!=='uploaded'||d.assetIds.length>0,{message:'Upload images before choosing uploaded mode'}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Topic must be 4–5000 characters'});const active=(await listJobs()).find(j=>['working','queued'].includes(j.status));if(active)return res.status(409).json({error:'A generation job is already running. Wait until it completes.'});try{const job=await createJob(parsed.data.topic,parsed.data.imageSource,parsed.data.assetIds,{creativeMode:parsed.data.creativeMode,creativitySeed:parsed.data.creativitySeed,visualVariety:parsed.data.visualVariety,uploadFit:parsed.data.uploadFit,language:parsed.data.language});res.status(202).json({id:job.id,status:job.status});setImmediate(()=>executeJob(job));}catch(e){res.status(500).json({error:e.message})}});
// Local single-owner development controls. Never expose these endpoints publicly without authentication.
app.get('/api/jobs/:id/quality',async(req,res)=>{const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});try{res.json(await reviewInstagram(job))}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/jobs/:id/cache',async(req,res)=>{const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});try{res.json(await getAssetState({...job,dir:path.join(store,job.id)}))}catch(e){res.status(400).json({error:e.message})}});
app.put('/api/jobs/:id/storyboard',async(req,res)=>{
 const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});
 if((await listJobs()).some(j=>['working','queued'].includes(j.status)))return res.status(409).json({error:'Another job is active'});
 const obj=z.object({storyboard:z.object({title:z.string().optional(),idea:z.string().optional(),hook:z.string().optional(),scenes:z.array(z.object({narration:z.string(),subtitle:z.string(),image_prompt:z.string(),motion_prompt:z.string().optional(),shot_type:z.string().optional()}).passthrough()).length(6)})}).safeParse(req.body);
 if(!obj.success)return res.status(400).json({error:'Invalid storyboard; exactly six scenes are required'});
 try{const state=await updateStoryboard({...job,dir:path.join(store,job.id)},obj.data.storyboard);res.json({ok:true,state})}catch(e){res.status(400).json({error:e.message})}
});

app.put('/api/jobs/:id/theme',async(req,res)=>{
 const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});
 const parsed=z.object({theme:z.enum(['default','propshort'])}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Choose default or propshort'});
 if((await listJobs()).some(j=>['working','queued'].includes(j.status)))return res.status(409).json({error:'A job is currently running'});
 job.renderTheme=parsed.data.theme;
 await fs.writeFile(path.join(store,job.id,'job.json'),JSON.stringify(job,null,2));
 res.json({ok:true,theme:job.renderTheme,paidApiCalls:false});
});

app.put('/api/jobs/:id/creativity',async(req,res)=>{
 const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});
 if((await listJobs()).some(j=>['working','queued'].includes(j.status)))return res.status(409).json({error:'A job is currently running'});
 const parsed=z.object({preset:z.enum(['editorial','energetic','cinematic','showcase']),intensity:z.number().int().min(0).max(100),transition:z.enum(['slide','zoom','wipe','pop'])}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Invalid creativity settings'});
 Object.assign(job,{creativePreset:parsed.data.preset,creativeIntensity:parsed.data.intensity,creativeTransition:parsed.data.transition});
 await fs.writeFile(path.join(store,job.id,'job.json'),JSON.stringify(job,null,2));
 res.json({ok:true,creativity:parsed.data,paidApiCalls:false});
});
// Zero-provider-cost animation remix: saves a new scene-composition plan, no image/voice/script generation.
app.post('/api/jobs/:id/remix',async(req,res)=>{
 const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});
 if((await listJobs()).some(j=>['working','queued'].includes(j.status)))return res.status(409).json({error:'Another job is active'});
 const parsed=z.object({mode:z.enum(['auto','kinetic','showcase','news','cinematic']).default('auto'),energy:z.number().int().min(0).max(100).default(80),variety:z.number().int().min(0).max(100).default(90),seed:z.number().int().min(0).max(4294967295).optional(),render:z.boolean().default(true)}).safeParse(req.body||{});
 if(!parsed.success)return res.status(400).json({error:'Invalid creative direction'});
 try{
  const dir=path.join(store,job.id);const state=await getAssetState({...job,dir});
  if(parsed.data.render&&(state.audioStale||state.staleImages.length))return res.status(409).json({error:'Cached assets need refreshing before rendering',state});
  const file=path.join(dir,'storyboard.json');const plan=JSON.parse(await fs.readFile(file,'utf8'));
  const seed=parsed.data.seed??randomSeed();
  const creativePlan=buildCreativePlan({scenes:plan.scenes,seed,mode:parsed.data.mode,energy:parsed.data.energy,variety:parsed.data.variety,previous:job.creativeHistory||[]});
  job.creativeHistory=[...(job.creativeHistory||[]),creativePlan].slice(-20);job.creativePlan=creativePlan;
  job.renderTheme='propshort';job.creativeIntensity=parsed.data.energy;
  // Plan lives on job metadata, not storyboard, so caching signatures and script stay untouched.
  await fs.writeFile(path.join(dir,'job.json'),JSON.stringify(job,null,2));
  if(parsed.data.render){res.status(202).json({ok:true,paidApiCalls:false,creativePlan});setImmediate(()=>rerenderJob({...job,dir}));}
  else res.json({ok:true,paidApiCalls:false,creativePlan});
 }catch(e){res.status(400).json({error:e.message})}
});
app.post('/api/jobs/:id/render-again',async(req,res)=>{
 const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});
 if((await listJobs()).some(j=>['working','queued'].includes(j.status)))return res.status(409).json({error:'Another job is active'});
 const full={...job,dir:path.join(store,job.id)};
 const state=await getAssetState(full);
 if(state.audioStale||state.staleImages.length)return res.status(409).json({error:'Some cached assets are stale. Refresh changed assets before rendering.',state});
 res.status(202).json({id:job.id,operation:'render-again',paidApiCalls:false});setImmediate(()=>rerenderJob(full));
});
app.post('/api/jobs/:id/regenerate',async(req,res)=>{
 const job=await loadJob(req.params.id);if(!job)return res.status(404).json({error:'Project not found'});
 if((await listJobs()).some(j=>['working','queued'].includes(j.status)))return res.status(409).json({error:'Another job is active'});
 const args=z.object({kind:z.enum(['image','audio','stale','motion']),sceneIndex:z.number().int().min(0).max(5).optional(),allowPaid:z.boolean().default(false)}).safeParse(req.body);
 if(!args.success)return res.status(400).json({error:'Invalid regeneration request'});
 if(process.env.DEMO_MODE==='false'&&!args.data.allowPaid)return res.status(400).json({error:'Confirm billable API regeneration with allowPaid=true'});
 res.status(202).json({id:job.id,operation:args.data.kind});setImmediate(()=>regenerateAssets({...job,dir:path.join(store,job.id)},args.data));
});
app.use('/media',express.static(store,{dotfiles:'deny',setHeaders:(res,file)=>{if(file.endsWith('.json'))res.setHeader('Cache-Control','no-store')}}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Internal server error'})});
const recovered=await recoverInterruptedJobs().catch(e=>{console.error('Job recovery failed:',e.message);return 0});
if(recovered)console.log(`Marked ${recovered} interrupted job(s) as failed so new jobs can start.`);
const server=app.listen(port,'127.0.0.1',()=>console.log(`ReelForge API on http://127.0.0.1:${port} (${process.env.DEMO_MODE==='false'?'LIVE':'DEMO'})`));
server.on('error',(e)=>{
 if(e.code==='EADDRINUSE'){
  console.error(`
ReelForge API cannot start: port ${port} is already in use.
Another ReelForge dev server (or another program) is running. Either use that one, or stop it first:
  PowerShell:  Get-NetTCPConnection -LocalPort ${port} | Select OwningProcess   then   Stop-Process -Id <that id>
  or set a different PORT in .env (and update the proxy in apps/web/vite.config.js).
`);
  process.exit(1);
 }
 throw e;
});
