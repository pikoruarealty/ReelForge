import React from 'react';
import {Img,OffthreadVideo,Easing} from 'remotion';

const B={orange:'#E65323',ink:'#181818',cream:'#F8F5F0',peach:'#F6DACA',white:'#FFFFFF'};
export const CREATIVE_LAYOUTS=[
 'kinetic_hook','word_wall','bold_statement','split_headline',
 'phone_focus','floating_phone','phone_zoom','app_spotlight',
 'news_stack','news_grid','headline_ticker','editorial_card',
 'stat_highlight','news_compare','city_pills','swipe_gallery',
 'spotlight_reveal','brand_endcard'
];
const clamp=n=>Math.min(1,Math.max(0,n));
const progress=(f,at,span=18)=>Easing.out(Easing.cubic)(clamp((f-at)/Math.max(1,span)));
const clean=(t,n=115)=>String(t??'').replace(/\s+/g,' ').trim().slice(0,n);
const headline=s=>clean(s?.graphic?.headline||s?.subtitle||s?.narration,84);
const body=s=>clean(s?.graphic?.subheading||s?.subtitle||s?.narration,115);
const backdrop=(dark)=>dark?B.white:B.ink;
function Title({text,f,at=2,size=95,dark=false,align='left',width=930}){
 const t=progress(f,at,17);return <div style={{fontSize:size,fontWeight:950,letterSpacing:-3.5,lineHeight:1.06,textAlign:align,width,color:backdrop(dark),opacity:t,transform:`translateY(${(1-t)*75}px) scale(${.92+.08*t})`,overflowWrap:'break-word'}}>{clean(text,105)}</div>;
}
function Kicker({children,dark=false}){return <div style={{fontSize:28,color:dark?B.peach:B.orange,fontWeight:900,letterSpacing:3,textTransform:'uppercase',marginBottom:30}}>{children}</div>}
function Mark({f,width=390}){return <div style={{width,height:13,background:B.orange,marginTop:24,borderRadius:12,transformOrigin:'left',transform:`scaleX(${progress(f,8,25)})`}}/>}
function Media({scene,f,at=7,width=560,height=1030,rotation=-4,scale=1,move=0,mode='phone'}){
 const t=progress(f,at,22);const continuous=Math.sin(f/36)*5;const zoom=1+Math.min(.18,Math.max(0,(f-at)/150))*0.9;
 const image=scene?.imageUrl?<Img src={scene.imageUrl} style={{width:'100%',height:'100%',objectFit:'contain',background:B.white,transform:`scale(${zoom})`}}/>:null;
 const video=scene?.videoUrl?<OffthreadVideo muted src={scene.videoUrl} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:null;
 return <div style={{width,height,position:'relative',flexShrink:0,background:B.white,border:mode==='phone'?'13px solid #242424':'5px solid #EFE5DC',borderRadius:mode==='phone'?52:24,overflow:'hidden',boxShadow:'0 34px 85px #0004',opacity:t,transform:`translate(${(1-t)*(move||200)}px,${(1-t)*150+continuous}px) rotate(${rotation+(1-t)*10}deg) scale(${scale*(.83+.17*t)})`}}>
  {video||image||<div style={{padding:40,color:B.ink,fontSize:42}}>PropShort · Your news, your city</div>}
  {mode==='phone'&&<div style={{position:'absolute',width:120,height:15,borderRadius:20,background:'#242424',top:6,left:'50%',transform:'translateX(-50%)'}}/>}
 </div>
}
const callout={fontSize:33,fontWeight:900,background:B.orange,color:B.white,borderRadius:14,padding:'15px 21px',boxShadow:'0 12px 20px #0002'};
function Counter({scene,f}){const c=scene?.graphic?.counter;if(!c||!Number.isFinite(Number(c.to))||Number(c.to)<0)return null;
 const from=Number(c.from)||0,to=Math.min(10000000,Number(c.to));const n=Math.round(from+(to-from)*progress(f,8,48));
 return <div style={{fontSize:145,fontWeight:950,letterSpacing:-8,color:B.orange,lineHeight:1.04}}>{clean(c.prefix,8)}{n.toLocaleString('en-IN')}{clean(c.suffix,25)}</div>
}
function NewsTile({scene,f,at=3,width=450,height=550,tilt=0}){return <div style={{width,height,position:'relative',borderRadius:32,background:B.white,border:'4px solid #EBDDD4',boxShadow:'0 22px 48px #0002',overflow:'hidden',transform:`rotate(${tilt}deg) translateY(${(1-progress(f,at,20))*180}px)`,opacity:progress(f,at,22)}}><div style={{height:'77%',overflow:'hidden'}}>{scene?.imageUrl?<Img src={scene.imageUrl} style={{height:'100%',width:'100%',objectFit:'contain'}}/>:<div style={{height:'100%',background:B.cream}}/>}</div><div style={{color:B.ink,padding:18,fontWeight:850,fontSize:24}}>{headline(scene)}</div></div>}
function ScreenPair({scenes,scene,f,layout}){const a=scenes?.[0]||scene,b=scenes?.[1]||scene,c=scenes?.[2]||scene;
 if(layout==='news_stack')return <div style={{position:'absolute',top:610,left:75,display:'flex',alignItems:'center',gap:8}}><div style={{transform:'translate(220px,55px) rotate(-14deg)'}}><NewsTile scene={a} f={f} width={490} height={750}/></div><div style={{transform:'translate(-70px,10px) rotate(7deg)'}}><NewsTile scene={b} f={f} at={15} width={490} height={750}/></div></div>;
 if(layout==='news_grid')return <div style={{position:'absolute',top:660,left:68,display:'grid',gridTemplateColumns:'1fr 1fr',gap:23}}>{[a,b,c,scene].map((s,i)=><NewsTile key={i} scene={s} f={f} at={i*7} width={455} height={420} tilt={i%2?2:-2}/>)}</div>;
 if(layout==='swipe_gallery')return <div style={{position:'absolute',top:680,left:-110,display:'flex',gap:25,transform:`translateX(${-Math.max(0,f-10)*2.3}px)`}}>{[a,b,c].map((s,i)=><NewsTile key={i} scene={s} f={f} at={i*9} width={410} height={730} tilt={i%2?5:-5}/>)}</div>;
 return <div style={{position:'absolute',top:650,left:85,display:'flex',gap:20}}><NewsTile scene={a} f={f} width={430} height={790}/><NewsTile scene={b} f={f} at={12} width={430} height={790}/></div>;
}
export function CreativeLayout({layout,scene={},scenes=[],frame:f=0,frames=150,config={},title=''}){
 const content=headline(scene)||title;const dark=['kinetic_hook','word_wall','brand_endcard','spotlight_reveal'].includes(layout);
 const mediaAt=(align='right',width=520,height=940,rotation=-6)=>({position:'absolute',top:align==='center'?635:500,left:align==='left'?-140:align==='center'?275:570});
 switch(layout){
 case 'kinetic_hook':{
  const words=content.split(' ').slice(0,8);
  return <><div style={{position:'absolute',top:340,left:70,right:60}}><Kicker dark>What is happening in your city?</Kicker>{words.map((word,i)=><span key={i} style={{display:'inline-block',marginRight:20,fontSize:110,fontWeight:950,letterSpacing:-4,color:i%3===0?B.orange:B.white,opacity:progress(f,i*5,12),transform:`translateY(${(1-progress(f,i*5,12))*100}px)`}}>{word}</span>)}<Mark f={f}/></div><div style={{position:'absolute',top:1160,right:-130,opacity:.68}}><Media scene={scene} f={f} width={450} height={690} rotation={14}/></div></>;
 }
 case 'word_wall':{
  const words=content.toUpperCase().split(' ').slice(0,12);
  return <><div style={{position:'absolute',top:330,left:55,right:55,display:'flex',flexWrap:'wrap',gap:20}}>{words.map((w,i)=><div key={i} style={{fontWeight:950,fontSize:i%3===0?115:83,background:i%3===0?B.orange:'transparent',color:B.white,padding:'5px 10px',opacity:progress(f,i*4,13),transform:`scale(${.7+.3*progress(f,i*4,13)})`}}>{w}</div>)}</div><div style={{position:'absolute',top:1340,left:70}}><Kicker dark>PROPSHORT / REAL ESTATE NEWS</Kicker></div></>;
 }
 case 'bold_statement':return <><div style={{position:'absolute',top:310,left:75}}><Kicker>THE HEADLINE</Kicker><Title f={f} text={content} size={118}/><Mark f={f}/></div><div style={{position:'absolute',top:890,left:280}}><Media scene={scene} f={f} width={540} height={800} rotation={3}/></div></>;
 case 'split_headline':return <><div style={{position:'absolute',top:260,left:67,width:460}}><Kicker>FAST UPDATES</Kicker><Title f={f} text={content} size={86} width={470}/><Mark f={f}/></div><div style={{position:'absolute',top:340,right:-90}}><Media scene={scene} f={f} width={570} height={1160} rotation={8} move={300}/></div></>;
 case 'phone_focus':return <><div style={{position:'absolute',top:280,left:70}}><Kicker>NEWS ON YOUR SCREEN</Kicker><Title text={content} f={f} size={74} width={915}/></div><div style={{position:'absolute',top:650,left:260}}><Media scene={scene} f={f} width={550} height={1050} rotation={0}/></div></>;
 case 'floating_phone':return <><div style={{position:'absolute',top:265,left:70}}><Kicker>YOUR PROPERTY NEWS</Kicker><Title text={content} f={f} size={77} width={830}/></div><div style={{position:'absolute',top:700,left:230,transform:`translateY(${Math.sin(f/34)*23}px)`}}><Media scene={scene} f={f} width={575} height={1000} rotation={-12}/></div></>;
 case 'phone_zoom':return <><div style={{position:'absolute',top:275,left:70}}><Kicker>OPEN PROPSHORT</Kicker><Title text={content} f={f} size={80}/></div><div style={{position:'absolute',top:755,left:140,transform:`scale(${.8+.25*progress(f,10,90)})`}}><Media scene={scene} f={f} width={730} height={1120} rotation={2}/></div></>;
 case 'app_spotlight':return <><div style={{position:'absolute',top:300,left:70}}><Kicker>PROPSHORT APP</Kicker><Title f={f} text={content} size={76}/></div><div style={{position:'absolute',top:760,left:180}}><div style={{position:'absolute',width:720,height:720,borderRadius:'50%',background:B.orange,opacity:.24,filter:'blur(85px)',transform:`scale(${.8+.2*progress(f,0,50)})`}}/><Media scene={scene} f={f} width={660} height={1050} rotation={-2}/></div></>;
 case 'news_stack':case 'news_grid':case 'swipe_gallery':return <><div style={{position:'absolute',top:260,left:68,right:50}}><Kicker>STORIES THAT MATTER</Kicker><Title f={f} text={content} size={75}/><Mark f={f}/></div><ScreenPair layout={layout} scene={scene} scenes={scenes} f={f}/></>;
 case 'headline_ticker':return <><div style={{position:'absolute',top:280,left:60}}><Kicker>BREAKING DOWN THE NEWS</Kicker><Title f={f} text={content} size={80}/></div>{[0,1,2,3].map((i)=><div key={i} style={{position:'absolute',left:-130+(i%2?-(f*3):(f*3))%330,top:780+i*180,background:i%2?B.ink:B.orange,color:B.white,padding:'26px 90px',fontSize:54,fontWeight:900,width:1300,whiteSpace:'nowrap',transform:`rotate(${i%2?-2:2}deg)`}}>{clean([content,body(scene),'PROPSHORT NEWS','YOUR CITY · YOUR UPDATE'][i],75)}</div>)}</>;
 case 'editorial_card':return <><div style={{position:'absolute',top:270,left:65}}><Kicker>IN FOCUS</Kicker><Title f={f} text={content} size={78}/></div><div style={{position:'absolute',top:700,left:125}}><NewsTile scene={scene} f={f} width={820} height={820}/></div></>;
 case 'stat_highlight':return <><div style={{position:'absolute',top:275,left:70}}><Kicker>THE NUMBER BEHIND THE STORY</Kicker>{scene.graphic?.counter?<Counter scene={scene} f={f}/>:<Title f={f} text={content} size={94}/>}<Title f={f} at={24} text={body(scene)} size={52}/></div><div style={{position:'absolute',top:820,left:340}}><Media scene={scene} f={f} width={600} height={890} rotation={-8}/></div></>;
 case 'news_compare':return <><div style={{position:'absolute',top:275,left:75}}><Kicker>MULTIPLE STORIES · ONE FEED</Kicker><Title f={f} text={content} size={74}/></div><ScreenPair scene={scene} scenes={scenes} f={f} layout="compare"/></>;
 case 'city_pills':return <><div style={{position:'absolute',top:280,left:70}}><Kicker>CITY-WISE COVERAGE</Kicker><Title f={f} text={content} size={78}/></div><div style={{position:'absolute',top:795,left:60,width:960,display:'flex',flexWrap:'wrap',gap:18}}>{['DELHI','MUMBAI','AHMEDABAD','BENGALURU','PUNE','CHANDIGARH'].map((v,i)=><div key={v} style={{background:i%2?B.white:B.orange,color:i%2?B.ink:B.white,border:'3px solid #E65323',padding:'20px 32px',borderRadius:90,fontSize:47,fontWeight:950,opacity:progress(f,5+i*7,13),transform:`translateY(${(1-progress(f,5+i*7,13))*55}px)`}}>{v}</div>)}</div><div style={{position:'absolute',top:1230,right:50}}><Media scene={scene} f={f} width={390} height={590} rotation={8}/></div></>;
 case 'spotlight_reveal':return <><div style={{position:'absolute',top:290,left:75}}><Kicker dark>IN YOUR POCKET</Kicker><Title dark f={f} text={content} size={88}/></div><div style={{position:'absolute',top:800,left:180}}><div style={{position:'absolute',top:40,left:0,width:740,height:740,borderRadius:'50%',background:B.orange,filter:'blur(100px)',opacity:.45}}/><Media scene={scene} f={f} width={660} height={950} rotation={-10}/></div></>;
 case 'brand_endcard':return <><div style={{position:'absolute',top:335,left:75,right:75}}><Title text="PropShort." f={f} size={154} dark/><div style={{color:B.white,fontSize:74,fontWeight:850,lineHeight:1.15,marginTop:45}}>Real estate,<br/>filtered for you.</div><div style={{marginTop:65,display:'inline-block',background:B.white,color:B.orange,padding:'28px 38px',fontSize:44,fontWeight:950,borderRadius:24,opacity:progress(f,24,19),transform:`translateY(${(1-progress(f,24,19))*45}px)`}}>EXPLORE PROPSHORT ↗</div><div style={{color:B.white,fontSize:33,marginTop:25}}>propshort.com</div></div><div style={{position:'absolute',top:1170,right:-60}}><Media scene={scenes[0]||scene} f={f} width={410} height={670} rotation={8}/></div></>;
 default:return <Title f={f} text={content}/>;
 }
}
