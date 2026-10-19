const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const ts=(()=>{try{return require('typescript');}catch{return require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');}})();
function load(name,imports={}){const source=fs.readFileSync(path.join(__dirname,'../cocos/assets/scripts/'+name+'.ts'),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;const context={exports:{},require:n=>imports[n]};vm.runInNewContext(compiled,context);return context.exports;}
const r=load('RunnerRules');const {jumpStep,hazardHit,pattern,CHARACTERS,ROW_GAP,runSpeed,worldAt,comboMultiplier}=r;
let assertions=0;function check(test,label){assert.ok(test,label);assertions++;}
for(let world=0;world<r.WORLDS.length;world++)for(let i=0;i<1000;i++){
 const p=pattern(i,world);check(p.lanes.every(l=>[-1,0,1].includes(l)),'valid lanes');
 check(p.action==='run'?!p.lanes.includes(p.safe):p.lanes.length===3,'open route or explicitly signalled action');
 check(p.action!=='slide'||p.kind==='gate','slide cue matches hazard');
}
// Full routes at the highest speed, including slowest lane change and highest jump.
// The controller reads upcoming rows; it never teleports, grants invincibility or changes obstacles.
let runs=0;
for(const ch of CHARACTERS)for(const fps of [20,30,60,120])for(const endless of [false,true])for(const start of r.WORLDS.map((_,i)=>i*r.WORLD_LENGTH)){
 const dt=1/fps;let d=start,x=0,y=0,vy=0,slide=0,first=start/20,idx=first;
 const end=endless?start+r.FINISH_DISTANCE*2:r.FINISH_DISTANCE;let jumpCount=0,slideCount=0;
 for(let t=0;t<400&&d<end;t+=dt){
  const obstacleD=start+24+(idx-first)*ROW_GAP,z=d-obstacleD,w=worldAt(obstacleD,endless),p=pattern(idx,w),speed=runSpeed(d,endless);
  x+=(p.safe*2.4-x)*Math.min(1,dt*ch.turn);
  if(p.action==='jump'&&z>=-speed*.42&&z<-.78&&y===0){vy=ch.jump;y=.001;jumpCount++;}
  if(p.action==='slide'&&z>=-speed*.32&&z<-.78&&slide===0&&y<.05){slide=.85;slideCount++;}
  [y,vy]=jumpStep(y,vy,dt);slide=Math.max(0,slide-dt);d+=speed*dt;
  for(const lane of p.lanes)check(!hazardHit(p.kind,x,y,lane,d-obstacleD,slide>0),`${ch.id} ${fps}fps ${endless?'endless':'campaign'} d=${d} row=${idx} ${p.kind}`);
  if(d-obstacleD>.85)idx++;
 }
 check(d>=end,'course reachable');check(jumpCount>0,'mandatory jumps tested');check(slideCount>0,'mandatory slides tested');runs++;
}
// Pipe clearance across all playable characters and frame rates.
for(const ch of CHARACTERS)for(const fps of [20,30,60,120]){
 let y=.001,vy=ch.jump,z=-24*.42,peak=0;
 for(let t=0;t<2;t+=1/fps){[y,vy]=jumpStep(y,vy,1/fps);z+=24/fps;peak=Math.max(peak,y);check(!hazardHit('pipe',0,y,0,z,false),'pipe clearance');}
 check(y===0&&vy===0,'stable landing');check(peak>2.35,'jump height');
}
check(hazardHit('gate',0,0,0,0,false),'standing hits beam');check(!hazardHit('gate',0,0,0,0,true),'slide clears beam');check(hazardHit('gate',0,2,0,0,false),'cannot jump over beam');check(!hazardHit('gate',2.4,0,0,0,false),'adjacent lane unaffected');
check(hazardHit('fire',0,0,0,0,false),'fire hit');check(!hazardHit('fire',0,1.1,0,0,false),'jump clears fire');
check(runSpeed(100000,true)===24&&runSpeed(100000,false)===22,'speed caps');check(worldAt(r.FINISH_DISTANCE,true)===0&&worldAt(r.FINISH_DISTANCE,false)===r.WORLDS.length-1,'world cycling');
check(comboMultiplier(9)===1&&comboMultiplier(10)===2&&comboMultiplier(20)===3&&comboMultiplier(100)===3,'combo tiers');
// Exercise real game methods with engine rendering stubbed, not a duplicated scoring model.
const storage=new Map();
const {MarioRunner}=load('MarioRunner',{'./RunnerRules':r,'./BrowserKeyboard':{},cc:{_decorator:{ccclass:()=>C=>C,property:()=>()=>{}},Component:class{},Material:class{},Vec3:class {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}},sys:{localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}}}});
const game=new MarioRunner();game.sound=()=>{};game.refreshUI=()=>{};game.state='running';game.model={active:true};
game.hearts=1;for(let i=0;i<30;i++)game.collectCoin();check(game.hearts===2,'Mario 30-coin heal');check(game.coinScore===620,'tiered coin scoring');
game.selected=1;game.hearts=1;for(let i=0;i<30;i++)game.collectCoin();check(game.hearts===1,'heal is Mario only');
game.y=0;game.duck();check(game.slide===.85,'slide action');game.jump();check(game.slide===0&&game.vy===11.8,'jump cancels slide and uses Luigi height');
game.y=1;game.slide=0;game.duck();check(game.slide===0,'cannot duck in air');
game.startWorld=2;game.distance=1200;game.hearts=2;const score=game.score;game.finish(true);check(game.state==='won'&&game.score===score+400,'clear awards life bonus and victory');
check(storage.get(game.recordKey())===String(game.score),'best saved per mode/start');
game.endless=true;game.loadBest();check(game.best===0,'separate challenge records');
const stubNode=()=>({active:true,position:{x:0,y:0,z:0},setPosition(){},setScale(){},setRotationFromEuler(){},lookAt(){},destroy(){}});
function liveGame(){const g=new MarioRunner();g.state='running';g.currentWorld=0;g.nextRow=-1000;g.distance=100;g.avatar=stubNode();g.shadow=stubNode();g.sound=()=>{};g.burst=()=>{};g.skidDust=()=>{};g.refreshUI=()=>{};return g;}
const shielded=liveGame();shielded.shield=1;shielded.items=[{node:stubNode(),kind:'pipe',lane:0,z:-.5,y:0,hit:false}];shielded.update(.016);
check(shielded.hearts===3&&shielded.shield===0&&shielded.hits===0,'shield absorbs a real collision');
const hurt=liveGame();hurt.chain=20;hurt.items=[{node:stubNode(),kind:'pipe',lane:0,z:-.5,y:0,hit:false}];hurt.update(.016);
check(hurt.hearts===2&&hurt.hits===1&&hurt.chain===0,'collision costs health and resets chain');
const sliding=liveGame();sliding.slide=.5;sliding.items=[{node:stubNode(),kind:'gate',lane:0,z:-.5,y:0,hit:false}];sliding.update(.016);
check(sliding.hearts===3,'actual update respects slide collision');
const expired=liveGame();expired.chain=25;expired.chainTime=.01;expired.update(.02);check(expired.chain===0,'combo expires');
const mission=liveGame();mission.coins=60;mission.dodges=8;mission.hearts=1;mission.update(.016);mission.update(.016);check(mission.coinScore===500&&mission.hearts===2,'mission paid exactly once');
const restart=liveGame();restart.selected=3;restart.startWorld=2;restart.gameCamera={};restart.cameraNode=stubNode();restart.applyWorld=()=>{};restart.spawnRow=()=>{};restart.shield=1;restart.slide=.4;restart.chain=20;restart.coinScore=1234;restart.hits=3;restart.jumpBuffer=.1;restart.begin();
check(restart.distance===800&&restart.hearts===4&&restart.shield===0&&restart.slide===0&&restart.chain===0&&restart.coinScore===0&&restart.hits===0&&restart.jumpBuffer===0,'restart resets run but preserves hero and starting world');
let taps=0;game.jump=()=>taps++;
const touch={getLocation:()=>({x:100,y:100})};
game.onTouchEnd(touch);check(taps===0,'HUD mouseup cannot become a tap');
game.onTouchStart(touch);game.onTouchEnd(touch);check(taps===1,'canvas gesture still works');
game.onTouchStart(touch);game.onTouchCancel();game.onTouchEnd(touch);check(taps===1,'cancelled gesture ignored');


// Entry/exit blending must settle independently of frame rate without altering scale.
for(const fps of [20,30,60,120]){let mix=0;for(let i=0;i<fps*.2;i++)mix=r.slideBlend(mix,true,1/fps);check(mix>.99,'slide enters rapidly');const pose=r.slidePose(mix);check(pose.body<-60&&pose.leftLeg<-75&&pose.rightLeg<-60,'articulated seated pose');for(let i=0;i<fps*.4;i++)mix=r.slideBlend(mix,false,1/fps);check(mix===0,'standing pose restored');}
for(const world of [3,4,5]){const rows=Array.from({length:20},(_,i)=>r.pattern(i,world));check(rows.some(p=>p.action==='jump')&&rows.some(p=>p.action==='slide'),'new chapters include both actions');check(rows.filter(p=>p.bonus).length===2,'recovery rows preserved');}

console.log(`PASS: ${assertions} assertions; ${runs} full routes; six worlds, four heroes, four frame rates, both modes, scoring and slide transitions.`);
// Transform actual shipped vertices through the animated hierarchy. This catches
// hat/boot intersections that collider-only route tests cannot detect.
function matmul(a,b){return a.map(row=>b[0].map((_,j)=>row.reduce((n,v,k)=>n+v*b[k][j],0)));}
function transform(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){const [x,y,z,w]=q;const r=[[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]];return [...r.map((row,i)=>[...row.map((v,j)=>v*s[j]),t[i]]),[0,0,0,1]];}
function poseBounds(gltf,dir,pivots){
 const buffers=gltf.buffers.map(b=>fs.readFileSync(path.join(dir,b.uri)));let low=Infinity,high=-Infinity;
 function visit(index,parent){const n=gltf.nodes[index],p=pivots[n.name];let t=n.translation,q=n.rotation;
  if(p){t=[p.position.x,p.position.y,p.position.z];const x=p.rotation[0]*Math.PI/360,z=p.rotation[2]*Math.PI/360;q=[Math.sin(x)*Math.cos(z),Math.sin(x)*Math.sin(z),Math.cos(x)*Math.sin(z),Math.cos(x)*Math.cos(z)];}
  const m=matmul(parent,transform(t,q,n.scale));
  if(n.mesh!==undefined)for(const prim of gltf.meshes[n.mesh].primitives){const a=gltf.accessors[prim.attributes.POSITION],v=gltf.bufferViews[a.bufferView],buffer=buffers[v.buffer],start=(a.byteOffset||0)+(v.byteOffset||0);
   for(let k=0;k<a.count;k++){let y=m[1][3];for(let j=0;j<3;j++)y+=m[1][j]*buffer.readFloatLE(start+k*(v.byteStride||12)+j*4);low=Math.min(low,y);high=Math.max(high,y);}
  }
  for(const child of n.children||[])visit(child,m);
 }
 for(const root of gltf.scenes[gltf.scene||0].nodes)visit(root,transform(undefined,undefined,[.64,.64,.64]));return {low,high};
}
// Run the actual animation method against rest pivots from each shipped glTF.
for(const ch of CHARACTERS){
 const file=ch.id==='Mario'?'mario/Mario.gltf':`characters/${ch.id}.gltf`;
 const gltf=JSON.parse(fs.readFileSync(path.join(__dirname,'../cocos/assets/resources/',file),'utf8'));
 const g=new MarioRunner();g.state='running';g.slide=.85;
 for(const n of gltf.nodes.filter(n=>['Body','Head','Arm_L','Arm_R','Leg_L','Leg_R'].includes(n.name))){
  const [x,y,z]=n.translation;g.rest[n.name]={x,y,z};g.pivots[n.name]={position:{x,y,z},scale:{x:1,y:1,z:1},rotation:null,setPosition(x,y,z){this.position={x,y,z};},setRotationFromEuler(...v){this.rotation=v;}};
 }
 for(let i=0;i<20;i++)g.animateCharacter(.016,true,false);
 check(g.pivots.Body.position.y<g.rest.Body.y*.51,'hip lowered without scaling');check(g.pivots.Leg_L.rotation[0]<-80,'front leg extends');
 const bounds=poseBounds(gltf,path.dirname(path.join(__dirname,'../cocos/assets/resources/',file)),g.pivots);check(bounds.low>=-.001,`${ch.id} feet above ground: ${bounds.low}`);check(bounds.high<1.41,`${ch.id} fits beneath beam: ${bounds.high}`);
 const frozen=JSON.stringify(g.pivots);g.state='paused';g.animateCharacter(.05,false,false);check(JSON.stringify(g.pivots)===frozen,'pause preserves full articulated pose');
 g.state='running';g.slide=0;for(let i=0;i<40;i++)g.animateCharacter(.016,true,false);
 for(const [name,pivot]of Object.entries(g.pivots)){check(pivot.position.y===g.rest[name].y,'all pivot heights restored');check(pivot.scale.y===1,'no mesh squash');}
}
// Web Audio scheduling and mute behaviour; nodes release their connections after playback.
let audioNodes=0,ended=[];const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
const audioNode=()=>{audioNodes++;return {frequency:param(),Q:param(),gain:param(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){ended.push(this);}};};
const soundGame=new MarioRunner();soundGame.audio={sampleRate:48000,currentTime:0,destination:{},createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:audioNode,createBiquadFilter:audioNode,createGain:audioNode,createOscillator:audioNode};
for(const kind of ['slide','dodge','level','win'])soundGame.sound(kind);
check(ended.length===14,'all four new sound events schedule playback');for(const n of ended){n.onended();check(n.disconnected,'audio source cleaned up');}
const count=audioNodes;soundGame.muted=true;soundGame.sound('slide');soundGame.sound('win');check(audioNodes===count,'muted mode creates no sound nodes');
console.log(`PASS: ${assertions} total assertions including actual four-character poses and audio lifecycle.`);
