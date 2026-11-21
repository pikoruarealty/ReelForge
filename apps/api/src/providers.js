import fs from 'node:fs/promises';
import sharp from 'sharp';

const requireKey=(key)=>{if(!process.env[key])throw new Error(`${key} is missing. Set DEMO_MODE=true or add it to .env`);return process.env[key]};
const bounded=(s,n=1000)=>String(s||'').slice(0,n);
// OpenRouter uses OpenAI-compatible chat completions, not Anthropic Messages headers.
// Auto-select OpenRouter when OPENROUTER_API_KEY exists; use ANTHROPIC_API_KEY otherwise.
const anthropicText=async(model,system,user,maxTokens=1800)=>{
 const useOpenRouter=Boolean(process.env.OPENROUTER_API_KEY);
 if(useOpenRouter){
  const id = model.startsWith('anthropic/') ? model : ({
   'claude-haiku-4-5':'anthropic/claude-haiku-4.5',
   'claude-sonnet-4-5':'anthropic/claude-sonnet-4.5'
  }[model] || model);
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
   method:'POST',
   headers:{'content-type':'application/json','Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,'X-OpenRouter-Title':'ReelForge AI Studio'},
   body:JSON.stringify({model:id,max_tokens:maxTokens,messages:[{role:'system',content:system},{role:'user',content:user}]})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(data).slice(0,400)}`);
  const value=data.choices?.[0]?.message?.content;
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  throw new Error('OpenRouter response did not contain text');
 }
 const key=requireKey('ANTHROPIC_API_KEY');
 const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxTokens,system,messages:[{role:'user',content:user}]})});
 const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(`Claude ${res.status}: ${JSON.stringify(data).slice(0,320)}`);
 return (data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
};
function parseJson(text){const clean=text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();try{return JSON.parse(clean)}catch{} const match=clean.match(/\{[\s\S]*\}/);if(!match)throw new Error('Model did not return JSON');return JSON.parse(match[0]);}
const defaultScene=(i,topic)=>({duration:[3,4,5,6,6,6][i],narration:[`Here's something worth knowing about ${topic}.`,`Why does ${topic} matter right now?`,`The first practical insight could change your workflow.`,`Try a small experiment before scaling up.`,`Measure what works and improve one detail.`,`Follow for more practical ideas about ${topic}.`][i],subtitle:[`LET'S TALK ${topic.toUpperCase()}`,`WHY IT MATTERS`,`START SMALL`,`TRY IT TODAY`,`MEASURE RESULTS`,`SAVE THIS IDEA`][i],image_prompt:`Professional editorial illustration of ${topic}, scene ${i+1}, cinematic light, vertical 9:16 composition, no text`});
export const demoPlan=(topic)=>({title:`${topic}: 3 Quick Insights`,idea:`A practical 30-second introduction to ${topic}`,hook:`Here's what you need to know about ${topic}`,scenes:Array.from({length:6},(_,i)=>defaultScene(i,topic))});
const model=(key,fallback)=>process.env[key]||fallback;
export async function createPlan(topic,real){if(!real)return demoPlan(topic);
 const idea=await anthropicText(model('CLAUDE_IDEA_MODEL','claude-haiku-4-5'),'You are a factual short-form video strategist. Never invent sources. Be original.',`Suggest one strong practical idea and a concise hook for a 30-second Instagram/Facebook/YouTube Reel on: ${bounded(topic,3500)}. Return plain text.`,500);
 const draft=await anthropicText(model('CLAUDE_SCRIPT_MODEL','claude-sonnet-4-5'),'You write original short-form storyboards. Return ONLY valid JSON; no markdown.',`Create a strong 30-second vertical Reel plan based on topic ${bounded(topic,3500)} and strategy ${idea}. Return JSON {title,idea,hook,scenes:[{duration,narration,subtitle,image_prompt,shot_type,motion_prompt}]}, EXACTLY six scenes with durations [3,4,5,6,6,6] seconds respectively. Use a specific 3-second hook, varied wide/close/detail/demo shots, original realistic visuals, strong narrative progression and concise narration timed to each scene. image_prompt excludes any written text. motion_prompt describes one continuous realistic physical action and camera move, no cuts, no morphing, no generated text. Keep facts defensible and do not invent sources.`,2800);
 const plan=parseJson(draft);return validatePlan(plan,topic);
}

function validateGraphic(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const g={};
 if(typeof raw.headline==='string')g.headline=bounded(raw.headline,105);
 if(typeof raw.subheading==='string')g.subheading=bounded(raw.subheading,110);
 if(['#181818','#F8F5F0','#FFFFFF','#F6DACA','#E65323'].includes(raw.background))g.background=raw.background;
 if(typeof raw.layout==='string' && ['kinetic_hook','word_wall','bold_statement','split_headline','phone_focus','floating_phone','phone_zoom','app_spotlight','news_stack','news_grid','headline_ticker','editorial_card','stat_highlight','news_compare','city_pills','swipe_gallery','spotlight_reveal','brand_endcard'].includes(raw.layout))g.layout=raw.layout;
 if(['editorial','energetic','cinematic','showcase'].includes(raw.motion_preset))g.motion_preset=raw.motion_preset;
 if(Number.isInteger(raw.motion_intensity)&&raw.motion_intensity>=0&&raw.motion_intensity<=100)g.motion_intensity=raw.motion_intensity;
 if(['slide','zoom','wipe','pop'].includes(raw.transition))g.transition=raw.transition;
 const c=raw.counter;
 if(c&&typeof c==='object'&&Number.isFinite(Number(c.to))&&Number(c.to)>0&&Number(c.to)<=10000000){
  g.counter={from:0,to:Number(c.to),prefix:bounded(c.prefix,12),suffix:bounded(c.suffix,24)};
 }
 return g;
}

export function validatePlan(plan,topic){if(!plan||!Array.isArray(plan.scenes)||plan.scenes.length!==6)throw new Error('Storyboard must have 6 scenes');return {title:bounded(plan.title,160)||topic,idea:bounded(plan.idea,400),hook:bounded(plan.hook,240),scenes:plan.scenes.map((s,i)=>({duration:[3,4,5,6,6,6][i],shot_type:bounded(s.shot_type,60)||'cinematic',motion_prompt:bounded(s.motion_prompt,450)||'Subtle realistic physical motion, natural facial and hand movement, slow controlled camera movement, steady lighting, preserve subject identity, no text',narration:bounded(s.narration,220)||defaultScene(i,topic).narration,subtitle:bounded(s.subtitle,95)||`SCENE ${i+1}`,image_prompt:bounded(s.image_prompt,900)||defaultScene(i,topic).image_prompt,graphic:validateGraphic(s.graphic)}))};}
export async function evaluate(plan,real,revision){if(!real)return {score:revision?89:78,weak_scenes:revision?[]:[0,1],feedback:revision?'Hook clarity and pacing improved.':'Make the hook more specific, sharpen first two visuals.',mode:'demo'};
 const result=await anthropicText(model('CLAUDE_EVALUATOR_MODEL','claude-haiku-4-5'),'You are a critical creative quality reviewer. This is NOT a virality predictor. Return JSON only.',`Evaluate this Reel storyboard for hook, clarity, pacing, originality and plausibility. Return {score:integer 0..100,weak_scenes:array of indices 0..5,feedback:string}. Data: ${JSON.stringify(plan).slice(0,10000)}`,900);
 const o=parseJson(result);return {score:Math.max(0,Math.min(100,Number(o.score)||0)),weak_scenes:Array.isArray(o.weak_scenes)?o.weak_scenes.filter(x=>Number.isInteger(x)&&x>=0&&x<6):[],feedback:bounded(o.feedback,800),mode:'storyboard-only'};
}
export async function improve(plan,evaluation,real){const next=structuredClone(plan);
 if(!real){next.hook=`Stop scrolling — ${plan.hook}`;next.scenes[0].subtitle='WAIT — THIS CHANGES EVERYTHING';next.scenes[0].image_prompt+=' dramatic close-up, energetic visual hook';next.scenes[1].subtitle='HERE IS WHY';return {plan:next,changed:[0,1]};}
 const result=await anthropicText(model('CLAUDE_OPTIMIZER_MODEL','claude-sonnet-4-5'),'Improve only weak scenes. Keep a factual, original story. Return only JSON.',`Given plan ${JSON.stringify(plan)} and evaluation ${JSON.stringify(evaluation)}, return {changes:[{index:0..5,narration,subtitle,image_prompt,motion_prompt}]}. Change up to 2 weak scenes only, maintain scene count and existing durations, do not change shot types unless needed.`,1900);
 const obj=parseJson(result);const changed=[];for(const c of (obj.changes||[]).slice(0,2)){if(!Number.isInteger(c.index)||c.index<0||c.index>5)continue;next.scenes[c.index]={...next.scenes[c.index],motion_prompt:bounded(c.motion_prompt,450)||next.scenes[c.index].motion_prompt,narration:bounded(c.narration,220)||next.scenes[c.index].narration,subtitle:bounded(c.subtitle,95)||next.scenes[c.index].subtitle,image_prompt:bounded(c.image_prompt,900)||next.scenes[c.index].image_prompt};changed.push(c.index)}return {plan:next,changed};}
const makeSvg=(prompt,i)=>{const palettes=[['#180f41','#723cbd'],['#082d39','#136c8b'],['#321339','#b64f88'],['#1f253c','#6980c4'],['#133e36','#49a488'],['#3f2419','#cf9058']];const [a,b]=palettes[i%palettes.length];const safe=prompt.replace(/[<>&"']/g,' ').slice(0,72);return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="r"><stop stop-color="#fff" stop-opacity=".36"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><circle cx="770" cy="650" r="600" fill="url(#r)"/><circle cx="200" cy="1200" r="390" stroke="white" stroke-opacity=".3" stroke-width="8" fill="none"/><path d="M0 1080 Q500 620 1080 1320 L1080 1920 L0 1920Z" fill="#fff" opacity=".075"/><g font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle"><text x="540" y="720" font-size="76" opacity=".45">SCENE ${i+1}</text><text x="540" y="850" font-size="46">AI GENERATED DEMO ART</text></g></svg>`};
export async function makeImage(scene, i, outputPath, real) {
  if (!real) {
    await sharp(Buffer.from(makeSvg(scene.image_prompt, i))).png().toFile(outputPath);
    return;
  }

  const key = requireKey('OPENROUTER_API_KEY');
  const models = [...new Set([
    model('OPENROUTER_IMAGE_MODEL', 'google/gemini-3.1-flash-image'),
    model('OPENROUTER_IMAGE_FALLBACK', 'google/gemini-3.1-flash-image-preview'),
  ])];
  const prompt = `Generate one cinematic, high-quality vertical 9:16 scene image for a social-media Reel. No text, captions, logos, or watermarks. ${scene.image_prompt}`;
  const errors = [];

  for (const imageModel of models) {
    try {
      // OpenRouter's dedicated Image API returns data[0].b64_json.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180000);
      let res;
      try {
        res = await fetch('https://openrouter.ai/api/v1/images', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'X-OpenRouter-Title': 'ReelForge AI Studio',
          },
          body: JSON.stringify({
            model: imageModel,
            prompt,
            aspect_ratio: '9:16',
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = JSON.stringify(data).slice(0, 450);
        // Do not silently retry another paid model when credits are exhausted.
        if ([401, 402, 403, 429].includes(res.status)) {
          throw Object.assign(new Error(`OpenRouter image ${res.status}: ${detail}`), {fatal: true});
        }
        throw new Error(`OpenRouter image ${res.status}: ${detail}`);
      }
      const image = data.data?.[0];
      const encoded = image?.b64_json || image?.url;
      if (!encoded || typeof encoded !== 'string') {
        throw new Error('OpenRouter response did not contain data[0].b64_json');
      }
      let bytes;
      if (encoded.startsWith('data:')) {
        bytes = Buffer.from(encoded.split(',')[1], 'base64');
      } else if (/^https?:\/\//.test(encoded)) {
        throw new Error('Expected base64 image; got a URL instead');
      } else {
        bytes = Buffer.from(encoded, 'base64');
      }
      if (!bytes.length) throw new Error('OpenRouter returned an empty image');
      await sharp(bytes).resize(1080, 1920, {fit: 'cover'}).png().toFile(outputPath);
      return;
    } catch (err) {
      if (err.fatal) throw err;
      errors.push(`${imageModel}: ${err.message}`);
    }
  }
  throw new Error(`OpenRouter image generation failed: ${errors.join(' | ').slice(0, 1000)}`);
}

export async function makeAudio(text,outputPath,real){if(!real)return {provider:'espeak/local fallback',generated:false};
 const errors=[];
 if(process.env.ELEVENLABS_API_KEY&&process.env.ELEVENLABS_VOICE_ID){try{
 const res=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID)}`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify({text,model_id:model('ELEVENLABS_MODEL','eleven_flash_v2_5'),output_format:'mp3_44100_128'})});if(!res.ok)throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0,240)}`);await fs.writeFile(outputPath,Buffer.from(await res.arrayBuffer()));return {provider:'elevenlabs',generated:true};
 }catch(e){errors.push(e.message)}}
 // Kokoro self-hosted through a compatible /v1/audio/speech HTTP endpoint, e.g. Kokoro-FastAPI.
 try{const base=(process.env.KOKORO_API_BASE||'http://localhost:8880/v1').replace(/\/$/,'');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120000);try{
 const res=await fetch(`${base}/audio/speech`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'kokoro',input:text,voice:process.env.KOKORO_VOICE||'af_heart',response_format:'mp3'}),signal:controller.signal});if(!res.ok)throw new Error(`Kokoro ${res.status}: ${(await res.text()).slice(0,200)}`);await fs.writeFile(outputPath,Buffer.from(await res.arrayBuffer()));return {provider:'kokoro',generated:true};
 }finally{clearTimeout(timer)}}catch(e){errors.push(e.message)}
 throw new Error(`No narration provider available. Add ElevenLabs credentials or start a Kokoro-compatible server. Details: ${errors.join(' | ').slice(0,350)}`);
}

