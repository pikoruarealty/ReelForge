import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {ReelVideo} from './video.jsx';
const Root=()=> <Composition id="ReelVideo" component={ReelVideo} durationInFrames={900} fps={30} width={1080} height={1920} defaultProps={{scenes:[],title:'AI Reel',audioUrl:null,wordCaptions:[]}} calculateMetadata={({props})=>({durationInFrames:Math.max(30,Math.round((props.scenes||[]).reduce((a,s)=>a+(s.duration||5),0)*30))})}/>;
registerRoot(Root);
