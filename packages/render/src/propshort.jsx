import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {CreativeLayout,CREATIVE_LAYOUTS} from './creative-layouts.jsx';

// Brand-specific, graphics-first advertisement template.
// Numeric counters are ONLY rendered when a scene's graphic.counter is explicitly supplied.
const P={orange:'#E65323',coral:'#F17643',ink:'#181818',cream:'#F8F5F0',peach:'#F6DACA',white:'#FFFFFF',muted:'#756E69'};
const lim=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const progress=(f,a,b)=>lim((f-a)/Math.max(1,b-a));
const ease=(f,a,b)=>Easing.out(Easing.cubic)(progress(f,a,b));
const phrase=(x,n=120)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const colorFor=(scene,index)=>{
 const approved=['#181818','#F8F5F0','#FFFFFF','#F6DACA','#E65323'];
 return approved.includes(scene?.graphic?.background)?scene.graphic.background:[P.ink,P.cream,P.white,P.cream,P.peach,P.orange][index%6];
};
const enter=(f,delay=5)=>ease(f,delay,delay+17);
const motionPresets={
 editorial:{speed:.85,travel:.72,tilt:.7,zoom:.75,accent:'lines'},
 energetic:{speed:1.4,travel:1.55,tilt:1.15,zoom:1.65,accent:'burst'},
 cinematic:{speed:.72,travel:1.05,tilt:1,zoom:1.45,accent:'cinematic'},
 showcase:{speed:1.05,travel:1.15,tilt:.8,zoom:1.15,accent:'ui'}
};
const validPreset=(value)=>motionPresets[value]?value:'showcase';
const configOf=(style,intensity=70)=>{
 const base=motionPresets[validPreset(style)];const factor=.45+Math.max(0,Math.min(100,Number(intensity)||0))/100;
 return {...base,speed:base.speed*(.8+.2*factor),travel:base.travel*factor,tilt:base.tilt*factor,zoom:base.zoom*factor};
};
// Timed reveals are deterministic and tied to Remotion frames, never browser CSS animation.
function MotionStage({f,frames,style='showcase',intensity=70,transition='slide',children}){
 const cfg=configOf(style,intensity);const p=ease(f,0,Math.max(6,Math.round(15/cfg.speed)));
 const out=1-ease(f,Math.max(1,frames-11),frames);
 const x=transition==='slide'?(1-p)*75*cfg.travel:0;
 const scale=transition==='zoom'?.84+.16*p:transition==='pop'?.92+.08*p:1;
 const y=transition==='wipe'?0:(1-p)*38*cfg.travel;
 const clip=transition==='wipe'?`inset(0 ${(1-p)*100}% 0 0)`:'none';
 return <AbsoluteFill style={{opacity:p*out,transform:`translate(${x}px,${y}px) scale(${scale})`,clipPath:clip}}>{children}</AbsoluteFill>;
}
function SceneDecoration({f,index,style='showcase',intensity=70,dark=false}){
 const cfg=configOf(style,intensity),t=ease(f,3,55),orange=dark?'#FFFFFF':'#E65323';
 if(cfg.accent==='lines')return <><div style={{position:'absolute',top:215,right:75,width:240,height:10,background:orange,transformOrigin:'right',transform:`scaleX(${t})`,opacity:.8}}/><div style={{position:'absolute',top:246,right:75,width:160,height:5,background:orange,opacity:.35,transformOrigin:'right',transform:`scaleX(${t})`}}/></>;
 if(cfg.accent==='burst')return <>{Array.from({length:9},(_,i)=>{const theta=(i/9)*Math.PI*2;const rad=(130+120*t)*cfg.travel;return <div key={i} style={{position:'absolute',right:150+Math.cos(theta)*rad,top:300+Math.sin(theta)*rad,width:18,height:78,background:orange,opacity:.1,transform:`rotate(${theta*180/Math.PI}deg) scaleY(${t})`,borderRadius:12}}/>})}</>;
 if(cfg.accent==='cinematic')return <><div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(0,0,0,.10),transparent 35%,rgba(0,0,0,.07))',pointerEvents:'none'}}/><div style={{position:'absolute',right:-190,top:350,width:620,height:620,border:`7px solid ${orange}`,borderRadius:'50%',opacity:.12,transform:`scale(${.6+.7*t})`}}/></>;
 return <><div style={{position:'absolute',right:55,top:202,width:240,height:74,borderRadius:45,border:`4px solid ${orange}`,opacity:.12,transform:`translateX(${(1-t)*220}px)`}}/><div style={{position:'absolute',right:80,top:222,width:125,height:32,background:orange,opacity:.14,borderRadius:25,transform:`scaleX(${t})`}}/></>;
}

function TextReveal({children,f,delay=6,size=86,color=P.ink,width=900,style={},config={travel:1,speed:1}}){const t=ease(f,delay,delay+Math.max(8,Math.round(17/config.speed)));return <div style={{fontSize:size,fontWeight:900,lineHeight:1.055,letterSpacing:-2.5,maxWidth:width,color,opacity:t,transform:`translateY(${(1-t)*62*config.travel}px) scale(${0.97+0.03*t})`,...style}}>{children}</div>}
function OrangeUnderline({f,width=440,delay=15}){return <div style={{height:12,width,background:P.orange,borderRadius:12,marginTop:34,transformOrigin:'left',transform:`scaleX(${ease(f,delay,delay+27)})`}}/>}
function Brand({light=false}){return <div style={{position:'absolute',top:104,left:72,display:'flex',gap:14,alignItems:'center',zIndex:20}}><div style={{background:P.orange,color:P.white,fontSize:23,fontWeight:950,borderRadius:10,padding:'8px 11px',letterSpacing:-1}}>PS</div><div style={{fontSize:33,fontWeight:950,letterSpacing:-1.2,color:light?P.white:P.ink}}>PropShort</div></div>}
function Caption({scene,f,frameStart,fps,wordCaptions,dark}){
 const t=(frameStart+f)/fps;const aligned=wordCaptions.find(w=>t>=Number(w.start)&&t<Number(w.end));
 const subtitle=phrase(aligned?.text||scene.subtitle||scene.narration,92);if(!subtitle)return null;
 return <div style={{position:'absolute',bottom:168,left:60,right:60,display:'flex',justifyContent:'center',zIndex:30}}><div style={{padding:'17px 27px',borderRadius:17,maxWidth:960,background:dark?'rgba(255,255,255,.93)':'rgba(24,24,24,.92)',color:dark?P.ink:P.white,fontWeight:800,fontSize:37,textAlign:'center',lineHeight:1.18,boxShadow:'0 12px 24px #0002'}}>{subtitle}</div></div>;
}
function Screen({scene,f,width=540,height=1050,tilt=-4,delay=7,zoom='zoom_in',small=false,config={speed:1,travel:1,tilt:1,zoom:1}}){
 const t=ease(f,delay,delay+Math.max(7,Math.round(17/config.speed)));const frameDuration=170;const p=lim(f/frameDuration);const z=zoom==='zoom_out'?1+.14*config.zoom*(1-p):1+.14*config.zoom*p;
 const media=scene?.videoUrl?<OffthreadVideo muted src={scene.videoUrl} style={{height:'100%',width:'100%',objectFit:'contain'}}/>:scene?.imageUrl?<Img src={scene.imageUrl} style={{height:'100%',width:'100%',objectFit:'contain',background:P.white,transform:`scale(${z})`}}/>:<div style={{height:'100%',background:P.cream,display:'grid',placeItems:'center',color:P.muted,fontSize:31,textAlign:'center',padding:35}}>Upload your real PropShort screenshot</div>;
 return <div style={{width,height,position:'relative',background:'#141414',borderRadius:small?33:57,padding:small?9:15,boxShadow:'0 30px 75px #0005',border:'3px solid #3b3b3b',opacity:t,transform:`translateY(${(1-t)*120*config.travel + Math.sin(f/21)*3*config.travel}px) rotate(${tilt*config.tilt+(1-t)*8*config.tilt}deg) scale(${.86+.14*t})`,overflow:'hidden'}}><div style={{height:'100%',width:'100%',overflow:'hidden',borderRadius:small?24:39,background:P.white}}>{media}</div><div style={{position:'absolute',top:11,left:'39%',width:'22%',height:12,borderRadius:20,background:'#161616'}}/></div>;
}
function Count({counter,f,config}){
 if(!counter||!Number.isFinite(Number(counter.to))||Number(counter.to)<=0)return null;
 const from=Number(counter.from??0);const to=Math.min(10000000,Number(counter.to));
 const value=Math.round(from+(to-from)*ease(f,8,8+Math.round(42/config.speed)));const prefix=phrase(counter.prefix,15);const suffix=phrase(counter.suffix,26);
 return <div style={{fontSize:142,fontWeight:950,lineHeight:1,letterSpacing:-7,color:P.orange,fontVariantNumeric:'tabular-nums',marginTop:24}}>{prefix}{value.toLocaleString('en-IN')}{suffix}</div>;
}
function HookScene({scene,f,title,config}){return <><div style={{position:'absolute',top:310,left:72,width:940}}><TextReveal config={config} f={f} delay={3} color={P.white} size={106}>{phrase(scene.graphic?.headline||scene.subtitle||title,74)}</TextReveal><OrangeUnderline f={f} width={480}/><TextReveal config={config} f={f} delay={22} size={44} color={P.peach} style={{marginTop:45,fontWeight:650}}>REAL ESTATE NEWS, MADE SIMPLE.</TextReveal></div><div style={{position:'absolute',top:930,right:-80}}><Screen config={config} scene={scene} f={f} width={460} height={720} delay={15} tilt={8}/></div><div style={{position:'absolute',top:1070,left:-140,width:660,height:660,borderRadius:'50%',border:'42px solid #E65323',opacity:.65,transform:`scale(${.8+.35*ease(f,5,50)})`}}/></>}
function NewsCounterScene({scene,f,index,config}){const counter=scene.graphic?.counter;return <><div style={{position:'absolute',top:280,left:65,width:465}}><div style={{fontSize:31,fontWeight:900,letterSpacing:2,color:P.orange}}>REAL ESTATE UPDATE</div>{counter?<Count counter={counter} f={f} config={config}/>:<TextReveal config={config} f={f} size={67} delay={8}>{phrase(scene.graphic?.headline||scene.subtitle,65)}</TextReveal>}<TextReveal config={config} f={f} size={43} delay={28} color={P.ink} style={{marginTop:32,fontWeight:650}}>{phrase(scene.graphic?.subheading||scene.subtitle,82)}</TextReveal><OrangeUnderline f={f} width={290}/></div><div style={{position:'absolute',top:270,right:-50}}><Screen config={config} scene={scene} f={f} tilt={5} width={575} height={1160} zoom="zoom_in"/></div></>}
function ArticleScene({scene,f,config}){return <><div style={{position:'absolute',top:280,left:65,width:510}}><div style={{fontSize:28,color:P.orange,fontWeight:950,letterSpacing:2}}>KNOW THE DETAILS</div><TextReveal config={config} f={f} size={73} delay={7}>{phrase(scene.graphic?.headline||scene.subtitle,84)}</TextReveal><OrangeUnderline f={f} width={320}/><TextReveal config={config} f={f} size={34} delay={30} color={P.muted} style={{marginTop:42,fontWeight:650}}>Clear news. Relevant context.</TextReveal></div><div style={{position:'absolute',top:300,right:-90}}><Screen config={config} scene={scene} f={f} width={560} height={1090} tilt={-6} zoom="zoom_out" delay={13}/></div></>}
function SwipeScene({scene,scenes,f,config}){
 const cards=[scenes[0],scenes[1],scenes[2]].filter(Boolean);
 return <><div style={{position:'absolute',top:275,left:68,right:68}}><TextReveal config={config} f={f} size={91}>{phrase(scene.graphic?.headline||'ONE FEED. MORE PERSPECTIVES.',70)}</TextReveal><OrangeUnderline f={f} width={500}/></div><div style={{position:'absolute',top:785,left:32,right:32,height:780,display:'flex',gap:22,alignItems:'flex-start',justifyContent:'center'}}>{cards.map((item,i)=><Screen config={config} key={i} scene={item} f={Math.max(0,f-i*Math.max(5,Math.round(13/config.speed)))} width={320} height={685} small tilt={(i-1)*7} delay={7+i*9}/>)}</div></>;
}
function ClosingScene({scene,f,scenes,config}){const t=enter(f,8);return <><div style={{position:'absolute',top:290,left:75,right:75}}><TextReveal config={config} f={f} delay={4} size={125} color={P.white}>PropShort.</TextReveal><TextReveal config={config} f={f} delay={18} size={73} color={P.white} style={{marginTop:25}}>Real estate,<br/>filtered for you.</TextReveal><div style={{background:P.white,color:P.orange,padding:'28px 40px',borderRadius:22,fontSize:48,fontWeight:900,width:'fit-content',marginTop:64,opacity:t,transform:`translateY(${(1-t)*40}px)`}}>EXPLORE PROPSHORT ↗</div><div style={{fontWeight:650,fontSize:37,color:P.white,marginTop:26}}>propshort.com</div></div><div style={{position:'absolute',top:1030,right:-80}}><Screen config={config} scene={scenes[0]||scene} f={f} width={425} height={700} tilt={8} delay={12}/></div><div style={{position:'absolute',left:-220,bottom:145,width:570,height:570,borderRadius:'50%',border:'42px solid rgba(255,255,255,.18)',transform:`scale(${.6+.5*t})`}}/></>}
export function PropShortScene({scene={},scenes=[],index=0,frames=150,start=0,fps=30,wordCaptions=[],title='',creativePreset='showcase',creativeIntensity=70,creativeTransition='slide',creativePlan=null}){
 const f=useCurrentFrame();const layout=scene?.graphic?.layout||creativePlan?.layouts?.[index];const bg=['kinetic_hook','word_wall','spotlight_reveal'].includes(layout)?P.ink:layout==='brand_endcard'?P.orange:['bold_statement','split_headline'].includes(layout)?P.cream:colorFor(scene,index);const dark=[P.ink,P.orange].includes(bg);const scenePreset=scene?.graphic?.motion_preset||creativePreset;const sceneIntensity=scene?.graphic?.motion_intensity??creativeIntensity;const sceneTransition=scene?.graphic?.transition||creativePlan?.transitions?.[index]||creativeTransition;const config=configOf(scenePreset,sceneIntensity);
 return <AbsoluteFill style={{fontFamily:'Arial, Helvetica, sans-serif',background:bg,color:dark?P.white:P.ink,overflow:'hidden'}}>
 <SceneDecoration f={f} index={index} style={scenePreset} intensity={sceneIntensity} dark={dark}/>
 <MotionStage f={f} frames={frames} style={scenePreset} intensity={sceneIntensity} transition={sceneTransition}>
  {layout&&CREATIVE_LAYOUTS.includes(layout)?<CreativeLayout layout={layout} scene={scene} scenes={scenes} index={index} frame={f} frames={frames} config={config} title={title}/>:index===0?<HookScene scene={scene} f={f} title={title} config={config}/>:index===1?<NewsCounterScene scene={scene} f={f} index={index} config={config}/>:index===2||index===3?<ArticleScene scene={scene} f={f} config={config}/>:index===4?<SwipeScene scene={scene} scenes={scenes} f={f} config={config}/>:<ClosingScene scene={scene} scenes={scenes} f={f} config={config}/>}
 </MotionStage>
  <Brand light={dark}/>
  <Caption scene={scene} f={f} frameStart={start} fps={fps} wordCaptions={wordCaptions} dark={dark}/>
  <div style={{position:'absolute',height:8,bottom:72,left:70,right:70,background:dark?'#ffffff44':'#18181824',borderRadius:20,overflow:'hidden'}}><div style={{height:'100%',width:`${100*lim(f/frames)}%`,background:dark?P.white:P.orange}}/></div>
 </AbsoluteFill>;
}
