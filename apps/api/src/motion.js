import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://openrouter.ai';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const headers = () => ({ Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title':'ReelForge AI Studio' });
const readJson = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenRouter video HTTP ${response.status}: ${JSON.stringify(data).slice(0,550)}`);
  return data;
};
const normalize = url => {
  const full = new URL(url, BASE);
  if (full.protocol !== 'https:' || full.hostname !== 'openrouter.ai') throw new Error('Unexpected polling URL');
  return full.toString();
};

export async function findMotionModel(name) {
  const response = await fetch(`${BASE}/api/v1/videos/models`, {headers:headers()});
  const data = await readJson(response);
  const entry = (Array.isArray(data) ? data : data.data || []).find(m => m.id===name || m.model===name);
  if (!entry) throw new Error(`Motion model ${name} is not in your current OpenRouter video catalog`);
  const first = entry.supported_frame_images || entry.supportedFrameImages || [];
  if (Array.isArray(first) && first.length && !first.includes('first_frame')) throw new Error(`${name} does not support first-frame image-to-video`);
  return entry;
}
function chooseDuration(entry,preferred) {
  const options = entry.supported_durations || entry.supportedDurations || [];
  if (Array.isArray(options) && options.length) {
    const numbers=options.map(Number).filter(x=>Number.isInteger(x)&&x>0);
    if(numbers.length) return numbers.find(x=>x>=preferred) ?? Math.max(...numbers);
  }
  return preferred;
}
function chooseResolution(entry,preferred) {
  const options=entry.supported_resolutions || entry.supportedResolutions || [];
  return Array.isArray(options)&&options.length&&!options.includes(preferred)?(options.includes('480p')?'480p':options[0]):preferred;
}

export async function generateMotion(scene,imagePath,clipPath,jobDir,sceneIndex) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required for motion');
  const model = process.env.MOTION_MODEL || 'bytedance/seedance-2.0-mini';
  const entry = await findMotionModel(model);
  const duration = chooseDuration(entry, Math.max(4,Math.ceil(Number(scene.duration)||5)));
  const resolution = chooseResolution(entry,process.env.MOTION_RESOLUTION||'480p');
  const recordPath = path.join(jobDir,`motion-${sceneIndex}.json`);
  const existing = await fs.readFile(recordPath,'utf8').then(JSON.parse).catch(()=>null);
  const imageUrl = process.env.MOTION_PUBLIC_MEDIA_BASE_URL
    ? `${process.env.MOTION_PUBLIC_MEDIA_BASE_URL.replace(/\/$/,'')}/${path.basename(jobDir)}/${path.basename(imagePath)}`
    : `data:image/png;base64,${(await fs.readFile(imagePath)).toString('base64')}`;
  // Some providers require a publicly reachable HTTPS image. If data URL is rejected,
  // configure MOTION_PUBLIC_MEDIA_BASE_URL with a public, directly downloadable HTTPS image host.
  if(imageUrl.startsWith('http:')) throw new Error('Public media base URL must be HTTPS');
  let job = existing?.id ? existing : null;
  if (!job) {
    const payload = {
      model, prompt: String(scene.motion_prompt||'').slice(0,800) ||
        'Slow cinematic camera push-in, natural subject motion, consistent lighting, no on-screen text',
      aspect_ratio:'9:16', duration, resolution, generate_audio:false,
      frame_images:[{type:'image_url',image_url:{url:imageUrl},frame_type:'first_frame'}],
    };
    const response=await fetch(`${BASE}/api/v1/videos`, {method:'POST',headers:headers(),body:JSON.stringify(payload)});
    job=await readJson(response);
    if (!job.id) throw new Error('OpenRouter did not return a motion job ID');
    await fs.writeFile(recordPath,JSON.stringify({id:job.id,model,duration,resolution,status:job.status},null,2));
  }
  const poll = normalize(`/api/v1/videos/${encodeURIComponent(job.id)}`);
  const deadline=Date.now()+Math.max(60,Number(process.env.MOTION_POLL_TIMEOUT_SECONDS||1200))*1000;
  while (job.status!=='completed') {
    if(['failed','cancelled','expired'].includes(job.status)) throw new Error(`Motion ${job.id} ${job.status}: ${JSON.stringify(job.error||'').slice(0,350)}`);
    if(Date.now() >= deadline) throw new Error(`Motion ${job.id} timed out. Saved ID for later resumption; do not resubmit blindly.`);
    await sleep(30000);
    job=await readJson(await fetch(poll,{headers:headers()}));
    await fs.writeFile(recordPath,JSON.stringify({id:job.id,model,duration,resolution,status:job.status,usage:job.usage},null,2));
  }
  const download = `${BASE}/api/v1/videos/${encodeURIComponent(job.id)}/content`;
  const output=await fetch(download,{headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`}});
  if(!output.ok) throw new Error(`Motion download HTTP ${output.status}: ${(await output.text()).slice(0,250)}`);
  const bytes=Buffer.from(await output.arrayBuffer());
  if(bytes.length<10000) throw new Error('Motion clip seems unexpectedly small');
  await fs.writeFile(clipPath,bytes);
  return {clipPath,model,jobId:job.id,duration,resolution,usage:job.usage};
}
