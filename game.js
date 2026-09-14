(() => {
"use strict";

/* SANDER UNITED ARENA
   Mapa: assets/map-estacao-paulista.png
   Sprites: assets/sander-sprites.png e assets/nemesis-sprites.png
   O mapa enviado pelo criador é usado como imagem completa.
   A navegação tenta identificar automaticamente os caminhos amarelos
   da imagem; se o PNG não estiver disponível, usa uma camada de colisão
   de segurança.
*/

const $=id=>document.getElementById(id), canvas=$("game"),ctx=canvas.getContext("2d"),mini=$("minimap"),mctx=mini.getContext("2d");
let MAP={w:1536,h:952}, CFG={speed:230,nSpeed:175,time:180,maxEnergy:1000,tp:30,atkRange:92,specialRange:230};
let W=innerWidth,H=innerHeight,dpr=1,game=false,paused=false,muted=false,elapsed=0,last=0,choice="normal",msgT=0;
let camera={x:0,y:0},keys=new Set(),audio=null,mapOK=false,sanderOK=false,nemesisOK=false,mapCanvas=null,mapData=null,roadMini=null;
const VIEW_ZOOM=1.28;
const imgs={map:new Image(),sander:new Image(),nemesis:new Image()};
imgs.map.onload=()=>{MAP.w=imgs.map.naturalWidth||1536;MAP.h=imgs.map.naturalHeight||952;mapOK=true;buildMapMask();drawMini()}; imgs.sander.onload=()=>sanderOK=true; imgs.nemesis.onload=()=>nemesisOK=true;
imgs.map.src="assets/map-estacao-paulista.png";imgs.sander.src="assets/sander-sprites.png";imgs.nemesis.src="assets/nemesis-sprites.png";

const sand={x:130,y:145,r:21,hp:100,energy:0,level:1,f:{x:1,y:0},inv:0,atk:0,special:0,tp:0};
const nem={x:1125,y:185,r:27,hp:1100,maxHp:1100,energy:0,level:1,f:{x:-1,y:0},atk:0,special:0,target:null,state:"collect"};
let energy=[],parts=[],texts=[];

const diff={
 easy:{hp:900,damage:.72,speed:.86,brain:.78},
 normal:{hp:1100,damage:1,speed:1,brain:1},
 hard:{hp:1350,damage:1.28,speed:1.12,brain:1.35}
};

/* Fallback collision geometry. When mapa.png is present, path-color
   collision is preferred so the green bosque/arbustos remain blocked. */
const fallbackBlocks=[
{x:0,y:0,w:1536,h:18},{x:0,y:846,w:1536,h:18},{x:0,y:0,w:18,h:864},{x:1518,y:0,w:18,h:864},
{x:60,y:55,w:300,h:125},{x:425,y:25,w:190,h:170},{x:785,y:25,w:360,h:120},{x:1170,y:40,w:310,h:125},
{x:75,y:260,w:285,h:130},{x:420,y:265,w:215,h:135},{x:770,y:255,w:180,h:120},{x:1150,y:235,w:300,h:145},
{x:70,y:415,w:290,h:135},{x:445,y:430,w:235,h:130},{x:790,y:445,w:250,h:125},{x:1090,y:435,w:350,h:145},
{x:55,y:610,w:315,h:125},{x:430,y:615,w:280,h:120},{x:750,y:635,w:330,h:120},{x:1110,y:620,w:340,h:135}
];

function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(W*dpr));canvas.height=Math.max(1,Math.floor(H*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);drawMini();updateOrientationLock()}
function isMobile(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||Math.min(innerWidth,innerHeight)<700}
function isPortrait(){return innerHeight>innerWidth}
function updateOrientationLock(){const lock=$("orientation-lock");if(!lock)return;lock.style.display=(isMobile()&&isPortrait())?"flex":"none"}
async function requestLandscape(){
  try{if(document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();}catch{}
  try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock("landscape")}catch{}
  updateOrientationLock(); resize();
}
$("rotateBtn").onclick=()=>requestLandscape();

addEventListener("orientationchange",()=>setTimeout(updateOrientationLock,120));
addEventListener("resize",()=>setTimeout(updateOrientationLock,60));
addEventListener("resize",resize);resize();

function buildMapMask(){
  mapCanvas=document.createElement("canvas");mapCanvas.width=MAP.w;mapCanvas.height=MAP.h;
  const c=mapCanvas.getContext("2d",{willReadFrequently:true});c.drawImage(imgs.map,0,0,MAP.w,MAP.h);
  try{mapData=c.getImageData(0,0,MAP.w,MAP.h).data;buildRoadMini()}catch{mapData=null}
}

/* Caminho: tons areia/amarelo. Árvores/arbustos são verdes e portanto
   bloqueados. O teste usa vários pontos em torno do personagem. */
function pathPixel(x,y){
  if(!mapData)return true;
  x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=MAP.w||y>=MAP.h)return false;
  const i=(y*MAP.w+x)*4,r=mapData[i],g=mapData[i+1],b=mapData[i+2];
  return r>145 && g>105 && r>g*0.92 && g>b*1.12 && b<190;
}
function blockedFallback(x,y,r){
  if(x-r<20||x+r>1516||y-r<20||y+r>844)return true;
  return fallbackBlocks.some(o=>circleRect(x,y,r,o.x,o.y,o.w,o.h));
}
function circleRect(x,y,r,rx,ry,rw,rh){const cx=Math.max(rx,Math.min(x,rx+rw)),cy=Math.max(ry,Math.min(y,ry+rh));return Math.hypot(x-cx,y-cy)<r}

function walkable(x,y,r){
  if(x-r<18||x+r>1518||y-r<18||y+r>846)return false;
  if(!mapOK||!mapData)return !blockedFallback(x,y,r);
  // sample a small ring + center; all must be road-like.
  const pts=[[0,0],[r*.7,0],[-r*.7,0],[0,r*.7],[0,-r*.7],[r*.5,r*.5],[-r*.5,r*.5]];
  let good=0;for(const p of pts)if(pathPixel(x+p[0],y+p[1]))good++;
  return good>=5;
}
function move(o,dx,dy){
  o.vx=dx;o.vy=dy;
  let nx=o.x+dx,ny=o.y;
  if(walkable(nx,ny,o.r))o.x=nx;
  nx=o.x;ny=o.y+dy;
  if(walkable(nx,ny,o.r))o.y=ny;
}

function seed(){
  const pts=[[125,150],[355,165],[575,205],[820,145],[1200,155],[1400,260],[245,330],[510,370],[720,340],[1020,390],[1280,430],[145,505],[385,555],[610,600],[870,560],[1140,595],[1380,700],[245,720],[520,735],[800,750],[1080,735],[1270,780]];
  energy=pts.map((p,i)=>({x:p[0],y:p[1],r:11,active:true,wait:0,p:i}));
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function norm(x,y){const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l}}

function show(id,on){$(id).classList.toggle("hidden",!on)}
function message(t,s=1.6){$("message").textContent=t;$("message").classList.add("show");msgT=s}
function beep(f=440,d=.06){if(muted)return;try{audio ||= new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type="sine";o.frequency.value=f;g.gain.value=.035;o.connect(g);g.connect(audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.stop(audio.currentTime+d)}catch{}}

$("startBtn").onclick=async()=>{await requestLandscape();show("intro",false);show("difficulty",true);beep(440,.08)};
document.querySelectorAll("[data-difficulty]").forEach(b=>b.onclick=()=>{choice=b.dataset.difficulty;start()});
$("pauseBtn").onclick=togglePause;$("resumeBtn").onclick=togglePause;
$("soundBtn").onclick=()=>{muted=!muted;$("soundBtn").textContent=muted?"🔇":"🔊";if(!muted)beep(520,.05)};
$("restartBtn").onclick=()=>{show("result",false);show("difficulty",true)};

async function start(){
 await requestLandscape();
 const d=diff[choice];sand.x=130;sand.y=145;sand.hp=100;sand.energy=0;sand.level=1;sand.atk=sand.special=sand.tp=0;
 nem.x=1125;nem.y=185;nem.maxHp=d.hp;nem.hp=d.hp;nem.energy=0;nem.level=1;nem.atk=nem.special=0;nem.target=null;nem.state="collect";
 elapsed=0;energy=[];parts=[];texts=[];seed();camera.x=clamp(sand.x,W/(2*VIEW_ZOOM),MAP.w-W/(2*VIEW_ZOOM));camera.y=clamp(sand.y,H/(2*VIEW_ZOOM),MAP.h-H/(2*VIEW_ZOOM));paused=false;game=true;show("difficulty",false);show("hud",true);show("touch",true);
 last=performance.now();message("Recolha energia. Némesis também está evoluindo!",2.5);requestAnimationFrame(loop);
}
function finish(win){
 if(!game)return;game=false;show("hud",false);show("touch",false);show("result",true);
 $("resultIcon").textContent=win?"🏆":"💥";$("resultTitle").textContent=win?"VITÓRIA!":"NÉMESIS VENCEU";
 $("resultText").textContent=win?`Némesis foi derrotado. Sander terminou com ${Math.round(sand.hp)}% de vida.`:"A energia de Sander chegou a zero.";
 beep(win?880:110,.22);
}
function togglePause(){if(!game)return;paused=!paused;show("pause",paused);if(!paused){last=performance.now();requestAnimationFrame(loop)}}

addEventListener("keydown",e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys.add(k);if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","z","x","c"," "].includes(k))e.preventDefault();if(k==="Escape")togglePause()});
addEventListener("keyup",e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys.delete(k)});
document.querySelectorAll("#touch button").forEach(b=>{
 const k=b.dataset.key,down=e=>{e.preventDefault();keys.add(k);if(k==="z")attack();if(k==="x")special();if(k==="c")teleport()},up=e=>{e.preventDefault();keys.delete(k)};
 b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("pointerleave",up);
});

let latch={z:false,x:false,c:false};
function actions(){for(const k of ["z","x","c"]){if(keys.has(k)&&!latch[k])({z:attack,x:special,c:teleport}[k])();latch[k]=keys.has(k)}}
function input(){let x=0,y=0;if(keys.has("ArrowLeft"))x--;if(keys.has("ArrowRight"))x++;if(keys.has("ArrowUp"))y--;if(keys.has("ArrowDown"))y++;return x||y?norm(x,y):{x:0,y:0}}

function collect(o,player){
 for(const e of energy)if(e.active&&Math.hypot(o.x-e.x,o.y-e.y)<o.r+e.r+5){
  e.active=false;e.wait=4.5;o.energy=clamp(o.energy+100,0,CFG.maxEnergy);
  const old=o.level;o.level=1+Math.floor(o.energy/250);burst(e.x,e.y,player?"#4ecbff":"#ffbd45",10);text(e.x,e.y,"+100 ⚡");beep(player?740:320,.06);
  if(o.level>old)message(`${player?"SANDER":"NÉMESIS"} EVOLUIU! NÍVEL ${o.level}`,1.2);
 }
}
function updateEnergy(dt){for(const e of energy){if(!e.active&&((e.wait-=dt)<=0))e.active=true}}

function updatePlayer(dt){
 sand.atk=Math.max(0,sand.atk-dt);sand.special=Math.max(0,sand.special-dt);sand.tp=Math.max(0,sand.tp-dt);sand.inv=Math.max(0,sand.inv-dt);
 const v=input();if(v.x||v.y){sand.f=v;move(sand,v.x*CFG.speed*(1+(sand.level-1)*.035)*dt,v.y*CFG.speed*(1+(sand.level-1)*.035)*dt)}collect(sand,true);
}

function nearest(o){let best=null,bd=1e9;for(const e of energy)if(e.active){const d=dist(o,e);if(d<bd){bd=d;best=e}}return best}

/* IA: primeiro procura energia; quando tem vantagem ou está perto,
   troca para perseguição. O movimento é limitado à mesma camada de caminhos. */
function updateEnemy(dt){
 const d=diff[choice];nem.atk=Math.max(0,nem.atk-dt);nem.special=Math.max(0,nem.special-dt);
 const dp=dist(nem,sand);
 if(dp<330*d.brain||sand.energy>nem.energy+180){nem.state="hunt";nem.target=sand}else{nem.state="collect";if(!nem.target||!nem.target.active)nem.target=nearest(nem)}
 const t=nem.target||sand,v=norm(t.x-nem.x,t.y-nem.y);nem.f=v;
 const sp=CFG.nSpeed*d.speed*(1+Math.min(5,nem.level-1)*.025),ox=nem.x,oy=nem.y;
 move(nem,v.x*sp*dt,v.y*sp*dt);
 if(nem.x===ox&&nem.y===oy){
  for(const a of [{x:-v.y,y:v.x},{x:v.y,y:-v.x},{x:1,y:0},{x:0,y:1}]){const n=norm(a.x,a.y);move(nem,n.x*sp*dt,n.y*sp*dt);if(nem.x!==ox||nem.y!==oy)break}
 }
 collect(nem,false);
 if(dp<CFG.atkRange+7&&nem.atk<=0){nem.atk=1.1/d.brain;hurtPlayer((7+nem.level*2)*d.damage)}
 if(dp<CFG.specialRange&&nem.special<=0&&nem.energy>=150){nem.special=5/d.brain;nem.energy-=150;hurtPlayer((12+nem.level*3)*d.damage)}
}
function hurtPlayer(dmg){if(sand.inv>0)return;sand.hp=Math.max(0,sand.hp-dmg);sand.inv=.35;burst(sand.x,sand.y,"#ff5263",9);text(sand.x,sand.y,`-${Math.round(dmg)}`);beep(120,.06);if(sand.hp<=0)finish(false)}

function attack(){if(!game||paused||sand.atk>0)return;sand.atk=.38;if(dist(sand,nem)<=CFG.atkRange){const p=12+sand.level*4;nem.hp=Math.max(0,nem.hp-p);burst(nem.x,nem.y,"#69bfff",9);text(nem.x,nem.y,`-${p}`);beep(180,.06);if(nem.hp<=0)finish(true)}else message("Némesis está fora do alcance.",.7)}
function special(){if(!game||paused||sand.special>0)return;sand.special=4;const d=dist(sand,nem);if(d<=CFG.specialRange){const p=28+sand.level*8;nem.hp=Math.max(0,nem.hp-p);burst(nem.x,nem.y,"#9b82ff",22);text(nem.x,nem.y,`-${p} ESPECIAL`);beep(110,.14);if(nem.hp<=0)finish(true)}else{const n=norm(nem.x-sand.x,nem.y-sand.y);burst(sand.x+n.x*70,sand.y+n.y*70,"#8fd8ff",14);message("Especial lançado!",.7);beep(520,.08)}}
function teleport(){
 if(!game||paused||sand.tp>0)return;let tx=sand.x,ty=sand.y;
 for(let i=1;i<=8;i++){const nx=sand.x+sand.f.x*260*i/8,ny=sand.y+sand.f.y*260*i/8;if(walkable(nx,ny,sand.r)){tx=nx;ty=ny}}
 if(tx===sand.x&&ty===sand.y){message("Teleporte bloqueado.",.8);return}
 sand.x=tx;sand.y=ty;sand.tp=CFG.tp;burst(tx,ty,"#5effd2",28);beep(880,.13);message("TELEPORTE EXECUTADO!",.9)
}

function update(dt){
 elapsed+=dt;if(elapsed>=CFG.time){finish(false);return}updateEnergy(dt);updatePlayer(dt);updateEnemy(dt);
 for(const p of parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=40*dt}parts=parts.filter(p=>p.life>0);
 for(const t of texts){t.life-=dt;t.y-=25*dt}texts=texts.filter(t=>t.life>0);
 const viewW=W/VIEW_ZOOM, viewH=H/VIEW_ZOOM;
 const targetCamX=clamp(sand.x,viewW/2,MAP.w-viewW/2);
 const targetCamY=clamp(sand.y,viewH/2,MAP.h-viewH/2);
 camera.x += (targetCamX-camera.x)*Math.min(1,dt*8);
 camera.y += (targetCamY-camera.y)*Math.min(1,dt*8);
 $("sanderHp").style.width=sand.hp+"%";$("sanderEnergy").style.width=(sand.energy/10)+"%";$("nemesisHp").style.width=(nem.hp/nem.maxHp*100)+"%";
 $("timer").textContent=timeLeft();$("teleportStatus").textContent=sand.tp<=0?"TELEPORTE: PRONTO":`TELEPORTE: ${Math.ceil(sand.tp)}s`;
 $("distanceInfo").textContent=`NÉMESIS: ${Math.round(dist(sand,nem))}m`;$("energyInfo").textContent=`ENERGIA: ${Math.round(sand.energy)} | NÍVEL ${sand.level}`;
 const nd=$("nemesis-direction"); if(nd){const sx=(nem.x-camera.x)*VIEW_ZOOM+W/2,sy=(nem.y-camera.y)*VIEW_ZOOM+H/2,inside=sx>=0&&sy>=0&&sx<=W&&sy<=H; if(inside){nd.textContent="NÉMESIS VISÍVEL";nd.style.opacity=".65";}else{const dx=nem.x-camera.x,dy=nem.y-camera.y;nd.textContent=`NÉMESIS ${Math.round(dist(sand,nem))}m • ${Math.abs(dx)>Math.abs(dy)?(dx>0?"→ DIREITA":"← ESQUERDA"):(dy>0?"↓ ABAIXO":"↑ ACIMA")}`;nd.style.opacity="1";}}
 if(msgT>0){msgT-=dt;if(msgT<=0)$("message").classList.remove("show")}
}
function timeLeft(){let s=Math.ceil(CFG.time-elapsed),m=Math.floor(s/60),r=s%60;return`${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`}

function world(){
 if(mapOK)ctx.drawImage(imgs.map,0,0,MAP.w,MAP.h);
 else{
  ctx.fillStyle="#18582a";ctx.fillRect(0,0,MAP.w,MAP.h);ctx.fillStyle="#e7c27e";
  for(const y of [145,350,535,720])ctx.fillRect(0,y,MAP.w,65);
  for(const x of [120,370,680,1010,1280])ctx.fillRect(x,0,70,MAP.h);
  ctx.fillStyle="#0a441b";for(const o of fallbackBlocks)ctx.fillRect(o.x,o.y,o.w,o.h);
  ctx.fillStyle="#fff";ctx.font="900 30px system-ui";ctx.fillText("ESTAÇÃO PAULISTA",590,105)
 }
}
function drawEnergy(){for(const e of energy)if(e.active){const b=Math.sin(elapsed*3+e.p)*3;ctx.save();ctx.translate(e.x,e.y+b);ctx.shadowBlur=18;ctx.shadowColor="#ffd52b";ctx.fillStyle="#fff5a4";ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffb300";ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore()}}
function character(o,player){
 ctx.save();ctx.translate(o.x,o.y);
 if(player&&sanderOK||!player&&nemesisOK){
  const im=player?imgs.sander:imgs.nemesis;
  const cols=4,rows=4,fw=im.width/cols,fh=im.height/rows;
  const moving=Math.hypot(o.vx||0,o.vy||0)>0.1;
  const actionRow=player?0:0;
  let col=moving?Math.floor(elapsed*8)%4:0;
  // The sheets are pose sheets: keep the character readable while moving.
  const row=actionRow;
  const size=player?Math.max(92,o.r*4.0):Math.max(104,o.r*4.3);
  ctx.drawImage(im,col*fw,row*fh,fw,fh,-size/2,-size/2,size,size);
 }else if(player){
  ctx.fillStyle="#167fe4";ctx.beginPath();ctx.arc(0,-2,o.r,0,Math.PI*2);ctx.fill();
 }else{
  ctx.fillStyle="#f3f3ec";ctx.beginPath();ctx.ellipse(0,0,o.r*.9,o.r*1.1,0,0,Math.PI*2);ctx.fill();
 }
 if(o.level>1){ctx.strokeStyle=player?"#4ecbffaa":"#ffb545aa";ctx.lineWidth=3;ctx.shadowBlur=15;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();ctx.arc(0,0,o.r+7+Math.sin(elapsed*4)*2,0,Math.PI*2);ctx.stroke()}
 const hp=player?o.hp/100:o.hp/o.maxHp;ctx.shadowBlur=0;ctx.fillStyle="#000a";ctx.fillRect(-25,-o.r-14,50,5);ctx.fillStyle=player?"#45e77f":"#ff5361";ctx.fillRect(-25,-o.r-14,50*clamp(hp,0,1),5);ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,W,H);
 ctx.save();
 ctx.translate(W/2,H/2);
 ctx.scale(VIEW_ZOOM,VIEW_ZOOM);
 ctx.translate(-camera.x,-camera.y);
 world();drawEnergy();character(sand,true);character(nem,false);
 for(const p of parts){ctx.globalAlpha=Math.max(0,p.life/.9);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3/VIEW_ZOOM,0,Math.PI*2);ctx.fill()}
 ctx.globalAlpha=1;
 for(const t of texts){ctx.globalAlpha=t.life;ctx.font=`900 ${14/VIEW_ZOOM}px system-ui`;ctx.textAlign="center";ctx.fillStyle="#fff";ctx.strokeStyle="#000b";ctx.lineWidth=4/VIEW_ZOOM;ctx.strokeText(t.s,t.x,t.y);ctx.fillText(t.s,t.x,t.y)}
 ctx.restore();drawMini();
}
function buildRoadMini(){
 const mw=420,mh=Math.round(mw*MAP.h/MAP.w);
 roadMini=document.createElement("canvas");roadMini.width=mw;roadMini.height=mh;
 const rc=roadMini.getContext("2d");
 const sx=MAP.w/mw, sy=MAP.h/mh;
 rc.clearRect(0,0,mw,mh);
 for(let y=0;y<mh;y++){
   for(let x=0;x<mw;x++){
     const wx=(x+.5)*sx, wy=(y+.5)*sy;
     let ok=pathPixel(wx,wy);
     if(!ok){ for(const q of [[-2,0],[2,0],[0,-2],[0,2]]) if(pathPixel(wx+q[0]*sx,wy+q[1]*sy)){ok=true;break} }
     if(ok){rc.fillStyle="#e8c879";rc.fillRect(x,y,1.5,1.5)}
   }
 }
}
function drawMini(){
 const r=mini.getBoundingClientRect();
 const mw=Math.max(210,Math.floor(r.width||300));
 const mh=Math.max(120,Math.floor(mw*MAP.h/MAP.w));
 mini.width=Math.floor(mw*dpr);mini.height=Math.floor(mh*dpr);
 mctx.setTransform(dpr,0,0,dpr,0,0);mctx.clearRect(0,0,mw,mh);
 mctx.fillStyle="#07131dd9";mctx.fillRect(0,0,mw,mh);
 if(roadMini)mctx.drawImage(roadMini,0,0,mw,mh);
 // subtle station/start/end landmarks, without rendering the forest
 mctx.fillStyle="#ffffff66";mctx.beginPath();mctx.arc(700/MAP.w*mw,72/MAP.h*mh,2.5,0,Math.PI*2);mctx.fill();
 for(const e of energy)if(e.active){mctx.fillStyle="#ffd52b99";mctx.beginPath();mctx.arc(e.x/MAP.w*mw,e.y/MAP.h*mh,1.8,0,Math.PI*2);mctx.fill()}
 const viewW=Math.min(MAP.w,W/VIEW_ZOOM),viewH=Math.min(MAP.h,H/VIEW_ZOOM);
 mctx.strokeStyle="#ffffff55";mctx.lineWidth=1;mctx.strokeRect((camera.x-viewW/2)/MAP.w*mw,(camera.y-viewH/2)/MAP.h*mh,viewW/MAP.w*mw,viewH/MAP.h*mh);
 $("sander-marker").style.left=sand.x/MAP.w*100+"%";$("sander-marker").style.top=sand.y/MAP.h*100+"%";
 $("nemesis-marker").style.left=nem.x/MAP.w*100+"%";$("nemesis-marker").style.top=nem.y/MAP.h*100+"%";
}
function burst(x,y,color,n=10){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=Math.random()*90+30;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.5,color})}}
function text(x,y,s){texts.push({x,y,s,life:1})}
function loop(now){if(!game||paused)return;const dt=Math.min((now-last)/1000,.035);last=now;actions();update(dt);draw();requestAnimationFrame(loop)}
drawMini();
})();