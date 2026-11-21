import React from 'react';
import {PropShortScene} from './propshort.jsx';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';

// Graphics-first video template. All animations derive from Remotion's current frame;
// there are no browser timers, CSS animation loops or random values.
const C = {bg:'#070A14',surface:'#151B30',white:'#F7F9FF',muted:'#B4BDD5',cyan:'#47E5D1',lime:'#C6FA72',purple:'#B59AFF',orange:'#FFA969'};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const range=(f,start,end)=>clamp((f-start)/Math.max(1,end-start));
const ease=(x)=>Easing.out(Easing.cubic)(clamp(x));
const clean=(value)=>String(value||'').replace(/\s+/g,' ').trim();
const words=(s)=>clean(s).split(' ').filter(Boolean);
const headline=(s,n=68)=>clean(s).slice(0,n);
const extractNumber=(...strings)=>{
  for(const s of strings){const m=clean(s).match(/\b(\d{1,3})\b/);if(m)return Math.max(1,Math.min(100,Number(m[1])))}
  return 3;
};
const panel={background:'linear-gradient(150deg,rgba(35,43,71,.95),rgba(13,18,36,.98))',border:'2px solid rgba(255,255,255,.14)',borderRadius:38,boxShadow:'0 28px 90px rgba(0,0,0,.34)'};

export const ReelVideo=({scenes=[],title='REELFORGE',audioUrl,wordCaptions=[],renderStyle='motion_graphics',renderTheme='default',creativePreset='showcase',creativeIntensity=70,creativeTransition='slide',creativePlan=null})=>{
  const {fps}=useVideoConfig();let offset=0;
  return <AbsoluteFill style={{backgroundColor:C.bg,fontFamily:'Inter,Arial,sans-serif',color:C.white,overflow:'hidden'}}>
    {(scenes||[]).map((scene,index)=>{
      const start=offset;const frames=Math.max(1,Math.round((Number(scene.duration)||5)*fps));offset+=frames;
      return <Sequence key={index} from={start} durationInFrames={frames}>
        {renderTheme==='propshort'
          ? <PropShortScene scene={scene} scenes={scenes} index={index} frames={frames} start={start} fps={fps} title={title} wordCaptions={wordCaptions} creativePreset={creativePreset} creativeIntensity={creativeIntensity} creativeTransition={creativeTransition} creativePlan={creativePlan}/>
          : renderStyle==='motion_graphics'
          ? <GraphicScene scene={scene} index={index} frames={frames} start={start} fps={fps} title={title} wordCaptions={wordCaptions}/>
          : <PhotoScene scene={scene} index={index} frames={frames} start={start} fps={fps} wordCaptions={wordCaptions}/>}
      </Sequence>;
    })}
    {audioUrl?<Audio src={audioUrl}/>:null}
  </AbsoluteFill>;
};

function Background({frame,index,scene,showImage=true}){
  const drift=Math.sin(frame/34)*42;
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 82% 10%,#29214B 0%,#0A0D1C 52%,#070A14 100%)'}}>
    <div style={{position:'absolute',width:680,height:680,borderRadius:'50%',top:-210,left:620,background:index%2?C.cyan:C.purple,opacity:.105,filter:'blur(110px)',transform:`translate(${drift}px,${drift*.4}px)`}}/>
    <div style={{position:'absolute',width:530,height:530,borderRadius:'50%',bottom:130,left:-280,background:C.purple,opacity:.12,filter:'blur(110px)'}}/>
    {showImage && scene.imageUrl && <div style={{position:'absolute',top:330,right:-110,width:660,height:950,overflow:'hidden',borderRadius:60,transform:`rotate(-8deg) translateY(${Math.sin(frame/44)*14}px)`,opacity:.32,maskImage:'linear-gradient(90deg,transparent,#000 36%,#000 80%,transparent)'}}><Img src={scene.imageUrl} style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>}
    <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)',backgroundSize:'108px 108px',opacity:.33}}/>
  </AbsoluteFill>;
}
function Brand({index}){return <div style={{position:'absolute',top:112,left:74,right:74,display:'flex',justifyContent:'space-between',alignItems:'center',fontWeight:800,fontSize:23,letterSpacing:3,color:C.muted}}><span>QUICK TAKE</span><span style={{color:C.cyan}}>0{index+1} / 06</span></div>}
function Kicker({children,frame,color=C.cyan}){return <div style={{fontSize:31,letterSpacing:4,fontWeight:900,textTransform:'uppercase',color,transform:`translateY(${(1-ease(range(frame,4,19)))*28}px)`,opacity:range(frame,3,15),marginBottom:30}}>{children}</div>}
function Reveal({children,frame,delay=8,size=102,color=C.white,maxWidth=940}){const t=ease(range(frame,delay,delay+19));return <div style={{fontSize:size,lineHeight:1.05,fontWeight:950,letterSpacing:-3.7,color,maxWidth,opacity:t,transform:`translateY(${(1-t)*75}px) scale(${.94+.06*t})`}}>{children}</div>}
function Counter({frame,from=0,to=3,delay=12,duration=35,size=260,suffix=''}){
  const t=ease(range(frame,delay,delay+duration));const value=Math.round(from+(to-from)*t);
  return <span style={{fontVariantNumeric:'tabular-nums',fontWeight:950,fontSize:size,lineHeight:1,letterSpacing:-12,color:C.lime,textShadow:'0 10px 62px rgba(198,250,114,.18)'}}>{value}{suffix}</span>;
}
function FooterCaption({scene,frame,start,fps,wordCaptions=[]}){
  const time=(start+frame)/fps;
  const active=wordCaptions.find(w=>time>=Number(w.start)&&time<Number(w.end));
  const text=active?clean(active.text):headline(scene.subtitle||scene.narration,85);
  const jump=active?Math.sin(Math.min(1,range(frame%12,0,6))*Math.PI)*7:0;
  return <div style={{position:'absolute',left:70,right:70,bottom:218,display:'flex',justifyContent:'center'}}>
    <div style={{background:'rgba(6,9,19,.90)',border:'1px solid rgba(255,255,255,.19)',borderRadius:24,padding:'20px 34px',maxWidth:930,textAlign:'center',boxShadow:'0 12px 48px #0007',fontWeight:850,fontSize:42,lineHeight:1.18,transform:`translateY(${-jump}px)`}}>{text}</div>
  </div>;
}
function Progress({frame,frames,index}){
  const t=clamp(frame/frames);
  return <div style={{position:'absolute',bottom:125,left:75,right:75,display:'flex',gap:12}}>{Array.from({length:6},(_,i)=><div key={i} style={{height:9,flex:1,borderRadius:12,background:'rgba(255,255,255,.16)',overflow:'hidden'}}><div style={{height:'100%',width:`${(i<index?1:i===index?t:0)*100}%`,background:i===index?C.cyan:C.purple}}/></div>)}</div>
}
function FloatingImage({scene,frame,top=370,right=65,width=390,height=510}){
  if(!scene.imageUrl)return null;
  const t=ease(range(frame,12,33));return <div style={{position:'absolute',top,right,width,height,border:'8px solid rgba(255,255,255,.2)',borderRadius:36,overflow:'hidden',boxShadow:'0 22px 75px #0009',opacity:t,transform:`translateX(${(1-t)*110}px) rotate(${(1-t)*7+4}deg)`}}>
    {scene.videoUrl?<OffthreadVideo src={scene.videoUrl} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Img src={scene.imageUrl} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${1.06+range(frame,0,180)*.06})`}}/>}
  </div>
}
function Hook({scene,frame,title}){
  const h=headline(scene.subtitle||title,62);return <>
    <Kicker frame={frame}>Something you should know</Kicker>
    <Reveal frame={frame} size={113}>{h}</Reveal>
    <div style={{marginTop:72,width:470,height:16,background:C.cyan,borderRadius:20,transformOrigin:'left center',transform:`scaleX(${ease(range(frame,17,38))})`}}/>
    <div style={{marginTop:62,fontSize:37,color:C.muted,fontWeight:650}}>IN 30 SECONDS</div>
    <div style={{position:'absolute',right:30,top:740,fontWeight:950,fontSize:340,color:'rgba(181,154,255,.13)',transform:`rotate(-14deg) scale(${.86+ease(range(frame,1,45))*.14})`}}>!</div>
  </>;
}
function CountScene({scene,frame,title}){const number=extractNumber(scene.subtitle,title,scene.narration);return <>
  <Kicker frame={frame}>The breakdown</Kicker>
  <div style={{display:'flex',alignItems:'center',gap:26,marginTop:55}}><Counter frame={frame} to={number}/><div style={{fontSize:68,lineHeight:1.05,fontWeight:900,maxWidth:560}}>KEY<br/><span style={{color:C.cyan}}>TAKEAWAYS</span></div></div>
  <div style={{marginTop:115,fontSize:37,color:C.muted,maxWidth:850}}>A faster way to understand the essentials.</div>
  <div style={{marginTop:85,display:'flex',gap:18}}>{Array.from({length:Math.min(number,6)},(_,i)=><div key={i} style={{width:92,height:14,borderRadius:12,background:i<=Math.floor(range(frame,20,70)*(number-1))?C.lime:'#414860',transform:`scaleY(${.6+ease(range(frame,18+i*6,32+i*6))*.4})`}}/>)}</div>
 </>}
function StepsScene({scene,frame}){const chunks=words(scene.subtitle||scene.narration);const labels=[chunks.slice(0,3).join(' ')||'DISCOVER',chunks.slice(3,6).join(' ')||'COMPARE',chunks.slice(6,9).join(' ')||'ACT'];return <>
  <Kicker frame={frame}>Step by step</Kicker><Reveal frame={frame} size={92}>HERE'S<br/><span style={{color:C.cyan}}>THE PLAN.</span></Reveal>
  <div style={{marginTop:72,display:'flex',flexDirection:'column',gap:19,width:900}}>{labels.map((s,i)=>{const t=ease(range(frame,15+i*10,33+i*10));return <div key={i} style={{...panel,padding:'33px 42px',display:'flex',gap:34,alignItems:'center',transform:`translateX(${(1-t)*420}px)`,opacity:t}}><span style={{color:C.lime,fontSize:65,fontWeight:950,fontVariantNumeric:'tabular-nums'}}>0{i+1}</span><span style={{fontSize:48,fontWeight:900,textTransform:'uppercase'}}>{headline(s,24)}</span></div>})}</div>
 </>}
function CompareScene({scene,frame}){const t=ease(range(frame,12,46));return <>
  <Kicker frame={frame}>Before and after</Kicker><Reveal frame={frame} size={84}>THE DIFFERENCE<br/><span style={{color:C.lime}}>IS CLEAR.</span></Reveal>
  <div style={{display:'flex',gap:20,marginTop:90,width:930}}>
    <div style={{...panel,flex:1,padding:'45px 30px',transform:`translateX(${(1-t)*-200}px)`,opacity:t}}><div style={{fontSize:28,color:C.muted,fontWeight:850}}>BEFORE</div><div style={{fontSize:95,marginTop:80,color:'#F58B9A'}}>✕</div><div style={{fontSize:41,fontWeight:900,marginTop:45}}>THE OLD<br/>WAY</div></div>
    <div style={{...panel,flex:1,padding:'45px 30px',borderColor:'rgba(198,250,114,.6)',transform:`translateX(${(1-t)*200}px)`,opacity:t}}><div style={{fontSize:28,color:C.lime,fontWeight:850}}>AFTER</div><div style={{fontSize:95,marginTop:80,color:C.lime}}>✓</div><div style={{fontSize:41,fontWeight:900,marginTop:45}}>THE SMART<br/>WAY</div></div>
  </div>
 </>}
function ProgressScene({scene,frame}){const value=Math.round(100*ease(range(frame,10,100)));return <>
  <Kicker frame={frame}>Make progress</Kicker><Reveal frame={frame} size={90}>{headline(scene.subtitle||'LEVEL UP',36)}</Reveal>
  <div style={{...panel,marginTop:90,width:900,padding:'65px 55px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'end'}}><div style={{fontSize:39,fontWeight:900}}>YOUR PROGRESS</div><div style={{color:C.lime,fontSize:82,fontWeight:950,fontVariantNumeric:'tabular-nums'}}>{value}%</div></div><div style={{height:35,background:'#292E43',borderRadius:40,overflow:'hidden',marginTop:45}}><div style={{height:'100%',width:`${value}%`,background:'linear-gradient(90deg,#47E5D1,#C6FA72)',borderRadius:40}}/></div><div style={{fontSize:30,color:C.muted,marginTop:36}}>Small improvements compound.</div></div>
 </>}
function CTAScene({scene,frame,title}){const t=ease(range(frame,13,38));return <>
  <Kicker frame={frame}>Your next move</Kicker><Reveal frame={frame} size={111}>{headline(scene.subtitle||'SAVE THIS REEL',57)}</Reveal>
  <div style={{marginTop:105,padding:'35px 70px',background:C.lime,borderRadius:35,width:'fit-content',color:'#101624',fontWeight:950,fontSize:60,transform:`scale(${.82+.18*t})`,opacity:t,boxShadow:'0 15px 75px rgba(198,250,114,.25)'}}>SAVE + FOLLOW ↗</div>
  <div style={{marginTop:90,fontWeight:700,fontSize:38,color:C.muted}}>Keep learning. Keep improving.</div>
  <div style={{position:'absolute',top:835,left:630,width:310,height:310,borderRadius:'50%',border:`18px solid ${C.purple}`,opacity:.3,transform:`scale(${.8+ease(range(frame,1,70))*.3})`}}/>
 </>}
function GraphicScene({scene,index,frames,start,fps,title,wordCaptions}){
 const frame=useCurrentFrame();const opening=ease(range(frame,0,12));const ending=1-ease(range(frame,frames-10,frames));const visible=opening*ending;
 return <AbsoluteFill style={{opacity:visible}}>
  <Background frame={frame} index={index} scene={scene} showImage={index===2||index===4}/>
  <Brand index={index}/>
  <AbsoluteFill style={{padding:'300px 74px 0',alignItems:'flex-start'}}>
   {index===0?<Hook frame={frame} scene={scene} title={title}/>:index===1?<CountScene scene={scene} frame={frame} title={title}/>:index===2?<StepsScene frame={frame} scene={scene}/>:index===3?<CompareScene scene={scene} frame={frame}/>:index===4?<ProgressScene scene={scene} frame={frame}/>:<CTAScene frame={frame} scene={scene} title={title}/>}
  </AbsoluteFill>
  <FooterCaption scene={scene} frame={frame} start={start} fps={fps} wordCaptions={wordCaptions}/>
  <Progress frame={frame} frames={frames} index={index}/>
 </AbsoluteFill>;
}
function PhotoScene({scene,index,frames,start,fps,wordCaptions}){
 const frame=useCurrentFrame();const zoom=1.02+range(frame,0,frames)*.08;return <AbsoluteFill>
  {scene.imageUrl?<Img src={scene.imageUrl} style={{height:'100%',width:'100%',objectFit:'cover',transform:`scale(${zoom})`}}/>:null}
  {scene.videoUrl?<OffthreadVideo src={scene.videoUrl} muted style={{height:'100%',width:'100%',objectFit:'cover'}}/>:null}
  <AbsoluteFill style={{background:'linear-gradient(180deg,rgba(0,0,0,.15),transparent 40%,rgba(0,0,0,.76))'}}/>
  <FooterCaption scene={scene} frame={frame} start={start} fps={fps} wordCaptions={wordCaptions}/><Progress frame={frame} frames={frames} index={index}/>
 </AbsoluteFill>;
}
