import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const probe=(file)=>new Promise((resolve,reject)=>{
 const child=spawn('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]);let out='',err='';
 child.stdout.on('data',d=>out+=d.toString());child.stderr.on('data',d=>err+=d.toString());
 child.on('error',reject);child.on('close',code=>code===0?resolve(JSON.parse(out)):reject(new Error(err||'ffprobe failed')));
});
export async function reviewInstagram(job){
 const warnings=[],checks=[];const dir=path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),'storage',job.id);
 const fail=(name,detail,critical=false)=>{checks.push({name,passed:false,detail,critical});warnings.push(detail)};
 const pass=(name,detail)=>checks.push({name,passed:true,detail});
 const plan=JSON.parse(await fs.readFile(path.join(dir,'storyboard.json'),'utf8'));
 if(!Array.isArray(plan.scenes)||plan.scenes.length<3)fail('Scene structure','Not enough scene variations',true);else pass('Scene structure',`${plan.scenes.length} scenes`);
 const layouts=job.creativePlan?.layouts||[];
 if(layouts.some((x,i)=>i>0&&x===layouts[i-1]))fail('Scene variety','Adjacent layouts repeat');else pass('Scene variety','No repeated adjacent creative layouts');
 if(plan.scenes.some(s=>!String(s.subtitle||'').trim()))fail('Caption presence','At least one scene lacks a caption');else pass('Caption presence','Every scene has a subtitle');
 if(plan.scenes.some(s=>String(s.subtitle||'').length>70))fail('Caption length','Some subtitles may be too long for mobile');else pass('Caption length','Scene subtitles fit within a conservative length limit');
 if((job.renderTheme||'default')!=='propshort')fail('Brand theme','PropShort theme is not selected');else pass('Brand theme','PropShort palette selected');
 if(job.timing?.slots?.length)pass('Narration sync',`Scene lengths follow the voiceover (${job.timing.source} word timing): ${job.timing.slots.map(x=>x.duration.toFixed(1)+'s').join(', ')}`);
 const mp4=path.join(dir,'reel.mp4');
 try{const info=await probe(mp4);const video=info.streams?.find(x=>x.codec_type==='video'),audio=info.streams?.find(x=>x.codec_type==='audio');
  if(video?.width===1080&&video?.height===1920)pass('Instagram frame','1080 × 1920 vertical');else fail('Instagram frame',`Video resolution ${video?.width||'?'}×${video?.height||'?'}, expected 1080×1920`,true);
  if(video?.codec_name==='h264')pass('Video codec','H.264');else fail('Video codec','Not H.264',true);
  if(audio?.codec_name==='aac')pass('Audio codec','AAC');else fail('Audio codec','Audio missing or not AAC',true);
  const length=Number(info.format?.duration||0);if(length>=15&&length<=90)pass('Duration',`${length.toFixed(1)} seconds`);else fail('Duration',`Unexpected ${length.toFixed(1)}-second runtime`,true);
 }catch(e){fail('MP4 inspection',`Unable to inspect rendered MP4: ${e.message}`,true)}
 return {status:checks.some(x=>!x.passed&&x.critical)?'needs-fix':warnings.length?'review':'checks-passed',checks,warnings,manualReview:['Watch full Reel at phone size','Verify news facts and figures against original source','Confirm screenshots and logos are genuine','Check narration/caption synchronization','Check copyright/music rights','Confirm PropShort CTA and official URL']};
}
