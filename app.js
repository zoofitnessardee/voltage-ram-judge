let PoseLandmarker, FilesetResolver, DrawingUtils;
// Load optional AI dependency only after the user starts the camera.

const $=id=>document.getElementById(id);let pose,stream,active=false,session=false,reps=0,noReps=0,startMs=0,elapsed=0,lastVideoTime=-1,phase='ready',squatSeen=false,lockedSince=0,lowSince=0,lastCount=0,lastFault=0,events=[],raf=0,baselineGap=null,baselineHeight=null,lastFramePose=null,flashSquatUntil=0,flashPressUntil=0,prevDeep=false,prevOverhead=false;
const video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d');
function say(s){$('status').textContent=s}function log(kind,detail){events.push({time:new Date().toISOString(),seconds:Math.round(elapsed/1000),kind,detail});$('log').innerHTML=events.slice(-15).reverse().map(e=>`<div>${e.seconds}s · ${e.kind} · ${e.detail}</div>`).join('')}
function beep(ok){if(!$('sound').checked)return;try{const C=window.AudioContext||window.webkitAudioContext;const ac=new C(),o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=ok?880:320;g.gain.value=.06;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.12);o.onended=()=>ac.close()}catch{}}
function count(){reps++;$('reps').textContent=reps;log('valid','depth + overhead lockout');beep(true);if(reps>=Number($('target').value)){ say('Target complete!'); const finishTime = $('timer').textContent; const finishTarget = Number($('target').value);  const finish = document.createElement('div'); finish.id = 'voltageFinish'; finish.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#07110b;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box;font-family:Arial,sans-serif';  finish.innerHTML = `   <div style="font-size:64px">⚡</div>   <div style="color:#c5ef38;font-size:clamp(32px,8vw,70px);font-weight:900">     ${finishTarget} REPS COMPLETE!   </div>   <div style="font-size:clamp(20px,5vw,32px);margin-top:16px">     VOLTAGE FINISHER   </div>   <div style="font-size:clamp(28px,7vw,48px);font-weight:bold;margin-top:24px">     FINAL TIME: ${finishTime}   </div> `;  document.getElementById('voltageFinish')?.remove(); document.body.appendChild(finish);  setTimeout(() => {   finish.remove(); reset(); }, 10000);;stopSession()}else say('GOOD REP — '+reps)}
function fault(reason){noReps++;$('noReps').textContent=noReps;log('suspected no-rep',reason);beep(false);say('CHECK REP — '+reason)}
function stopSession(){session=false;$('sessionBtn').textContent='Start session';log('session','stopped')}
function reset(){flashSquatUntil=0;flashPressUntil=0;prevDeep=false;prevOverhead=false;baselineGap=null;baselineHeight=null;reps=0;noReps=0;elapsed=0;startMs=0;phase='ready';squatSeen=false;lastCount=0;lastFault=0;events=[];$('reps').textContent='0';$('noReps').textContent='0';$('timer').textContent='00:00';$('log').textContent='No events yet.';say('Ready to start')}
function angle(a,b,c){const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],den=Math.hypot(...u)*Math.hypot(...v);return den?Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/den)))*180/Math.PI:0}
function visible(p,ids){return ids.every(i=>p[i]&&p[i].visibility>.55)}
function judge(p,now){
 const front=$('viewMode').value==='front';
 const l=[11,13,15,23,25,27],r=[12,14,16,24,26,28];
 const lOK=visible(p,l),rOK=visible(p,r);
 if(front && !(lOK&&rOK)){$('tracking').textContent='Front view: show both arms, hips, knees and ankles';lowSince=0;lockedSince=0;return}
 const ids=lOK?l:rOK?r:null;
 if(!ids){$('tracking').textContent='Full body not visible';lowSince=0;lockedSince=0;return}
 const [sh,el,wr,hip,knee,ank]=ids.map(i=>p[i]);
 const kneeAngle=angle(hip,knee,ank),elbowAngle=angle(sh,el,wr);
 let deep=false,standing=false,overhead=false,detail='';
 if(front){
   const a=i=>p[i],avg=(i,j)=>(a(i).y+a(j).y)/2;
   const hipY=avg(23,24),kneeY=avg(25,26),ankleY=avg(27,28);
   const leftKnee=angle(a(23),a(25),a(27)),rightKnee=angle(a(24),a(26),a(28));
   const kneeAvg=(leftKnee+rightKnee)/2;
   const height=Math.max(.08,ankleY-avg(11,12));
   const gap=(kneeY-hipY)/height;
   // Front view is only a heuristic: 2D camera landmarks cannot establish true depth.
   // Learn a standing reference while knees are straight and hips are above knees.
   if(kneeAvg>158&&gap>.08){baselineGap=baselineGap===null?gap:baselineGap*.93+gap*.07;baselineHeight=height}
   const threshold=$('depth').value==='below'?.025:.055;
   deep=(baselineGap!==null && gap<=threshold && kneeAvg<150) || kneeAvg<105;
   standing=kneeAvg>145;
   const armOK=(s,e,w)=>a(w).y<a(s).y-.04&&angle(a(s),a(e),a(w))>115;
   overhead=armOK(11,13,15)&&armOK(12,14,16);
   detail=`FRONT · knees ${Math.round(kneeAvg)}° · ${baselineGap===null?'stand tall to calibrate':deep?'DEPTH ESTIMATE OK':'depth pending'} · ${overhead?'BOTH ARMS UP':'lockout pending'}`;
 }else{
   const parallel=hip.y>=knee.y-.025,below=hip.y>=knee.y+.015;
   deep=$('depth').value==='below'?below:parallel;
   standing=kneeAngle>145;
   overhead=wr.y<sh.y-.10&&el.y<sh.y-.025&&elbowAngle>150;
   deep=deep&&kneeAngle<125;
   detail=`SIDE · knee ${Math.round(kneeAngle)}° · ${deep?'DEPTH OK':'depth pending'} · ${overhead?'LOCKOUT OK':'lockout pending'}`;
 }
 $('tracking').textContent=detail;
 // Checkpoint lights are diagnostic estimates, NOT official approval.
 if(session){
   if(deep&&!prevDeep)flashSquatUntil=now+650;
   if(overhead&&!prevOverhead)flashPressUntil=now+650;
 }
 prevDeep=deep;prevOverhead=overhead;
 if(!session)return;
 const upright=standing&&overhead;
 if(phase==='ready'){
   if(deep){if(!lowSince)lowSince=now;if(now-lowSince>100){phase='low';say('DEPTH DETECTED — drive overhead')}}else lowSince=0;
 }else if(phase==='low'){
   if(upright){if(!lockedSince)lockedSince=now;if(now-lockedSince>80&&now-lastCount>800){count();lastCount=now;phase='top';lockedSince=0}}
   else{lockedSince=0}
 }else if(phase==='top'){
   if(!standing){phase='ready';lowSince=0;lockedSince=0}
 }
}

function render(now){if(!stream)return;raf=requestAnimationFrame(render);
 const sq=now<flashSquatUntil,pr=now<flashPressUntil;
 $('squatFlash').classList.toggle('active',sq);$('squatLabel').classList.toggle('active',sq);
 $('pressFlash').classList.toggle('active',pr);$('pressLabel').classList.toggle('active',pr);if(session){elapsed=Date.now()-startMs;const sec=Math.floor(elapsed/1000);$('timer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}if(video.readyState<2||video.currentTime===lastVideoTime)return;lastVideoTime=video.currentTime;// Draw landmarks aligned with the contained video (no crop in portrait).
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const scale=Math.min(w/video.videoWidth,h/video.videoHeight);
 const dw=video.videoWidth*scale,dh=video.videoHeight*scale;
 ctx.translate((w-dw)/2,(h-dh)/2);ctx.scale(dw,dh);try{const result=pose.detectForVideo(video,now);if(!result.landmarks?.length){$('tracking').textContent='No athlete detected';return}const p=result.landmarks[0];// DrawingUtils expects a pixel-space canvas; restore then draw in a video-sized transform.
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate((w-dw)/2,(h-dh)/2);ctx.scale(scale,scale);
 const pixelP=p.map(pt=>({...pt,x:pt.x*video.videoWidth,y:pt.y*video.videoHeight}));
 // MediaPipe drawing utility uses normalized points, so use our own pixel-space connectors.
 const connections=PoseLandmarker.POSE_CONNECTIONS;
 ctx.strokeStyle='#4ade80';ctx.lineWidth=3/scale;ctx.beginPath();
 for(const edge of connections){const a=p[edge.start],b=p[edge.end];if(a&&b){ctx.moveTo(a.x*video.videoWidth,a.y*video.videoHeight);ctx.lineTo(b.x*video.videoWidth,b.y*video.videoHeight)}}ctx.stroke();
 ctx.fillStyle='#fbbf24';for(const pt of p){if(pt.visibility>.5){ctx.beginPath();ctx.arc(pt.x*video.videoWidth,pt.y*video.videoHeight,3/scale,0,Math.PI*2);ctx.fill()}}
 judge(p,now)}catch(err){say('Tracking error: '+err.message)}}
async function camera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;cancelAnimationFrame(raf);$('cameraBtn').textContent='Start camera';$('cameraState').textContent='Camera off';$('sessionBtn').disabled=true;stopSession();return}try{say('Loading pose model (internet needed on first use)…');if(!pose){if(!PoseLandmarker){const vision=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');({PoseLandmarker,FilesetResolver,DrawingUtils}=vision)}const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');pose=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6})}stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24}}});video.srcObject=stream;await video.play();$('cameraBtn').textContent='Stop camera';$('cameraState').textContent='Camera on';$('sessionBtn').disabled=false;say('Camera ready — '+($('viewMode').value==='front'?'face the camera and stand tall to calibrate':'stand side-on to the camera'));render(performance.now())}catch(e){say('Camera/model error: '+e.message+' (HTTPS and camera permission required)')}}
$('cameraBtn').onclick=camera;$('sessionBtn').onclick=()=>{if(!session){reset();session=true;startMs=Date.now();$('sessionBtn').textContent='Stop session';log('session','started');say('Stand tall, squat to depth, then lock out overhead')}else stopSession()};$('resetBtn').onclick=()=>{stopSession();reset()};$('plusBtn').onclick=()=>{reps++;$('reps').textContent=reps;log('coach override','+1 valid')};$('minusBtn').onclick=()=>{reps=Math.max(0,reps-1);$('reps').textContent=reps;log('coach override','undo valid')};$('noBtn').onclick=()=>fault('coach override');$('target').onchange=()=>{$('targetDisplay').textContent=Math.max(1,Number($('target').value)||60)};$('exportBtn').onclick=()=>{const lines=[['timestamp','elapsed_seconds','event','detail'],...events.map(e=>[e.time,e.seconds,e.kind,e.detail])];const csv=lines.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='ram-judge-session.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

$('viewMode').onchange=()=>{phase='ready';baselineGap=null;lowSince=0;lockedSince=0;say($('viewMode').value==='front'?'Front view: face camera, stand tall to calibrate. Depth is an estimate.':'Side view: position full body side-on.');};

/* VOLTAGE CAMERA START BUTTON */
const voltageStartButton = document.getElementById('sessionBtn');
const voltageCameraStage = document.querySelector('.stage');

if (voltageStartButton && voltageCameraStage) {
  voltageCameraStage.appendChild(voltageStartButton);

  voltageStartButton.style.cssText = `
    position:absolute;
    bottom:240px;
    left:50%;
    transform:translateX(-50%);
    z-index:100;
    width:min(80%,320px);
    padding:18px;
    font-size:20px;
    font-weight:900;
    border-radius:14px;
    background:#c5ef38;
    color:#101510;
    cursor:pointer;
    box-shadow:0 6px 24px rgba(0,0,0,.5);
  `;

  const voltageUpdateStartButton = () => {
    voltageStartButton.style.display = session ? 'none' : 'block';
  };

  voltageStartButton.addEventListener('click', () => {
    voltageUpdateStartButton();
  });

  const voltageOriginalResetForButton = reset;
reset = function() {
  voltageOriginalResetForButton();
  voltageUpdateStartButton();
};

  voltageUpdateStartButton();
}
