(() => {
  'use strict';

  const W = 360;
  const H = 560;
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const ui = {
    title: document.getElementById('level-title'),
    chapter: document.getElementById('chapter-label'),
    best: document.getElementById('best-score'),
    attempts: document.getElementById('attempts'),
    dots: document.getElementById('level-dots'),
    hint: document.getElementById('instruction-text'),
    drop: document.getElementById('drop-button'),
    reset: document.getElementById('reset-button'),
    toast: document.getElementById('toast'),
    result: document.getElementById('result'),
    resultIcon: document.getElementById('result-icon'),
    resultTitle: document.getElementById('result-title'),
    resultCopy: document.getElementById('result-copy'),
    resultButton: document.getElementById('result-button')
  };

  const levels = [
    { name:'First Bounce', target:180, stars:[[90,165],[268,276],[180,414]], rails:[[55,220,153,260],[207,300,305,255]], bumpers:[[110,354,220,331]] },
    { name:'Split Decision', target:280, stars:[[100,152],[180,284],[284,395]], rails:[[44,205,142,250],[218,235,316,190],[54,362,147,323]], bumpers:[[212,407,302,443]] },
    { name:'The Switchback', target:78, stars:[[270,145],[98,286],[263,420]], rails:[[220,180,318,220],[54,268,151,225],[207,339,307,300]], bumpers:[[82,405,175,438]], hazards:[[164,295,78,22]] },
    { name:'Hot Potato', target:282, stars:[[95,150],[275,260],[114,385]], rails:[[45,225,136,180],[224,210,317,256],[50,330,142,375]], bumpers:[[205,339,303,310],[166,445,252,414]], hazards:[[155,245,52,20]] },
    { name:'Final Frenzy', target:180, stars:[[90,144],[280,246],[78,365]], rails:[[48,204,139,241],[221,240,312,197],[53,323,144,286],[216,362,310,401]], bumpers:[[125,414,232,438]], hazards:[[151,272,57,22],[170,343,74,20]] }
  ];
  const savedBest = Number(localStorage.getItem('chaosDropBest') || 0);
  let best = Number.isFinite(savedBest) ? savedBest : 0;
  let levelIndex = Math.min(Number(localStorage.getItem('chaosDropLevel') || 0), levels.length - 1);
  let attemptsLeft = 3;
  let state = 'ready';
  let ball = { x:180, y:42, vx:0, vy:0, r:11 };
  let drawnBumper = null;
  let dragStart = null;
  let dragNow = null;
  let collected = new Set();
  let score = 0;
  let elapsed = 0;
  let lastFrame = 0;
  let toastTimer = 0;
  let particles = [];
  let trail = [];

  function level() { return levels[levelIndex]; }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('orientationchange', resize);

  function boardPoint(event) {
    const r = canvas.getBoundingClientRect();
    return { x:(event.clientX-r.left) * W / r.width, y:(event.clientY-r.top) * H / r.height };
  }
  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1300);
  }
  function renderUi() {
    ui.title.textContent = level().name;
    ui.chapter.textContent = `PUZZLE ${String(levelIndex+1).padStart(2,'0')} / ${String(levels.length).padStart(2,'0')}`;
    ui.best.textContent = best;
    ui.attempts.replaceChildren();
    for (let i=0;i<3;i++) {
      const p=document.createElement('i'); p.className=`attempt ${i>=attemptsLeft?'used':''}`; ui.attempts.append(p);
    }
    ui.dots.replaceChildren();
    for (let i=0;i<levels.length;i++) {
      const d=document.createElement('i'); d.className=`level-dot ${i===levelIndex?'active':''}`; ui.dots.append(d);
    }
    ui.drop.disabled = state === 'running' || state === 'won' || state === 'lost';
    ui.drop.innerHTML = state === 'running' ? 'IN MOTION <span>◌</span>' : 'DROP IT <span>↓</span>';
    ui.hint.textContent = state === 'running' ? 'Watch the chain reaction!' : state === 'ready' ? 'Draw one bumper, then drop the ball.' : 'Reset to try a new bumper.';
  }
  function newTry() {
    state='ready'; ball={x:180,y:42,vx:0,vy:0,r:11}; drawnBumper=null; dragStart=null; dragNow=null;
    collected=new Set(); elapsed=0; trail=[]; particles=[]; ui.result.classList.add('hidden'); renderUi();
  }
  function resetLevel() { attemptsLeft=3; score=0; newTry(); showToast('Fresh board. Find a new route!'); }
  function finish(won) {
    state = won ? 'won' : (attemptsLeft <= 0 ? 'lost' : 'ready');
    if (won) {
      const points=100 + collected.size*50 + attemptsLeft*25;
      score += points;
      best=Math.max(best,score);
      localStorage.setItem('chaosDropBest',String(best));
      localStorage.setItem('chaosDropLevel',String(Math.min(levelIndex+1,levels.length-1)));
      ui.resultIcon.textContent='✦'; ui.resultTitle.textContent='Beautiful chaos!';
      ui.resultCopy.textContent=`Puzzle cleared · ${collected.size}/3 sparks · +${points} points`;
      ui.resultButton.innerHTML=levelIndex===levels.length-1?'PLAY AGAIN <span>↻</span>':'NEXT PUZZLE <span>→</span>';
      ui.result.classList.remove('hidden');
    } else if (attemptsLeft <= 0) {
      ui.resultIcon.textContent='↻'; ui.resultTitle.textContent='So close!';
      ui.resultCopy.textContent='The orb missed the cup. Reset the puzzle and try another bumper.';
      ui.resultButton.innerHTML='TRY AGAIN <span>↻</span>';
      ui.result.classList.remove('hidden');
    } else {
      showToast('Oops! Draw a new bumper and try again.');
    }
    renderUi();
  }

  function onPointerDown(e) {
    if (state!=='ready') return;
    const p=boardPoint(e);
    if (p.y<74 || p.y>500) return;
    dragStart=p; dragNow=p; canvas.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) { if (dragStart) dragNow=boardPoint(e); }
  function onPointerUp(e) {
    if (!dragStart) return;
    const p=boardPoint(e); const dx=p.x-dragStart.x; const dy=p.y-dragStart.y;
    const len=Math.hypot(dx,dy);
    if (len<24) showToast('Drag to draw a bumper');
    else {
      const cap=Math.min(len,108); const m=cap/len;
      drawnBumper={x1:dragStart.x,y1:dragStart.y,x2:dragStart.x+dx*m,y2:dragStart.y+dy*m};
      showToast('Bumper placed! Now drop it.');
    }
    dragStart=null; dragNow=null;
  }
  canvas.addEventListener('pointerdown',onPointerDown);
  canvas.addEventListener('pointermove',onPointerMove);
  canvas.addEventListener('pointerup',onPointerUp);
  canvas.addEventListener('pointercancel',onPointerUp);

  ui.drop.addEventListener('click',()=>{
    if (state!=='ready') return;
    if (!drawnBumper) { showToast('Draw your bumper first!'); return; }
    attemptsLeft--; state='running'; ball={x:180,y:42,vx:0,vy:5,r:11}; elapsed=0; trail=[]; renderUi();
  });
  ui.reset.addEventListener('click',()=>{ if (state!=='running') resetLevel(); else showToast('Let the orb finish this run first.'); });
  ui.resultButton.addEventListener('click',()=>{
    if (state==='won') {
      if (levelIndex===levels.length-1) { levelIndex=0; score=0; }
      else levelIndex++;
      localStorage.setItem('chaosDropLevel',String(levelIndex)); attemptsLeft=3; newTry();
    } else if (state==='lost') resetLevel();
  });

  function collideSegment(s, restitution=.72) {
    const dx=s[2]-s[0], dy=s[3]-s[1];
    const l2=dx*dx+dy*dy || 1;
    const t=Math.max(0,Math.min(1,((ball.x-s[0])*dx+(ball.y-s[1])*dy)/l2));
    const px=s[0]+t*dx, py=s[1]+t*dy;
    let nx=ball.x-px, ny=ball.y-py; const dist=Math.hypot(nx,ny);
    if (dist>=ball.r || dist===0) return;
    nx/=dist; ny/=dist;
    ball.x=px+nx*(ball.r+.2); ball.y=py+ny*(ball.r+.2);
    const vn=ball.vx*nx+ball.vy*ny;
    if (vn<0) { ball.vx-=(1+restitution)*vn*nx; ball.vy-=(1+restitution)*vn*ny; ball.vx*=.985; ball.vy*=.985; }
    spawnParticles(px,py,'#baff63',4);
  }
  function physics(dt) {
    const l=level(); elapsed+=dt;
    ball.vy=Math.min(ball.vy+470*dt,680);
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
    if (ball.x<24+ball.r) { ball.x=24+ball.r; ball.vx=Math.abs(ball.vx)*.72; }
    if (ball.x>336-ball.r) { ball.x=336-ball.r; ball.vx=-Math.abs(ball.vx)*.72; }
    const segments=l.rails.map(a=>a.slice());
    if (drawnBumper) segments.push([drawnBumper.x1,drawnBumper.y1,drawnBumper.x2,drawnBumper.y2]);
    segments.forEach(s=>collideSegment(s));
    l.hazards?.forEach(([x,y,w,h])=>{
      if (ball.x+ball.r>x && ball.x-ball.r<x+w && ball.y+ball.r>y && ball.y-ball.r<y+h) {
        state='impact'; spawnParticles(ball.x,ball.y,'#ff6a65',20); finish(false);
      }
    });
    l.stars.forEach(([x,y],i)=>{
      if (!collected.has(i) && Math.hypot(ball.x-x,ball.y-y)<ball.r+14) {
        collected.add(i); score+=10; spawnParticles(x,y,'#ffe270',12); showToast('Spark collected! +10');
      }
    });
    if (state!=='running') return;
    if (ball.y+ball.r>491 && ball.y<542 && Math.abs(ball.x-l.target)<42) { finish(true); return; }
    if (ball.y>H+25 || elapsed>11) { spawnParticles(ball.x,Math.min(ball.y,H-15),'#ff7773',12); finish(false); }
    trail.push({x:ball.x,y:ball.y}); if (trail.length>10) trail.shift();
  }
  function spawnParticles(x,y,color,n) {
    for (let i=0;i<n;i++) { const a=Math.random()*Math.PI*2, s=40+Math.random()*150; particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.4,color}); }
  }
  function drawSegment(s,color='#93a6bd',width=7) {
    ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(s[0],s[1]); ctx.lineTo(s[2],s[3]); ctx.stroke();
    ctx.strokeStyle='#ffffff2b'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(s[0],s[1]-1); ctx.lineTo(s[2],s[3]-1); ctx.stroke();
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    const grad=ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#19263b'); grad.addColorStop(1,'#111a2a'); ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    for(let i=0;i<26;i++){const x=(i*73+18)%W,y=(i*113+27)%H;ctx.fillStyle='#b5caff'+(i%3?'18':'2e');ctx.beginPath();ctx.arc(x,y,i%4===0?1.5:1,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#ffffff0d'; ctx.lineWidth=1; for(let y=100;y<480;y+=65){ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(335,y);ctx.stroke();}
    ctx.fillStyle='#9cacbf';ctx.fillRect(22,58,4,431);ctx.fillRect(334,58,4,431);
    ctx.fillStyle='#ffffff10';ctx.beginPath();ctx.roundRect(148,13,64,40,12);ctx.fill();
    ctx.fillStyle='#c8ff79';ctx.beginPath();ctx.arc(180,42,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(176,38,3,0,Math.PI*2);ctx.fill();
    level().rails.forEach(s=>drawSegment(s));
    level().hazards?.forEach(([x,y,w,h])=>{
      const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#fb5f5a');g.addColorStop(1,'#ff9c51');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill();
      ctx.fillStyle='#fff6'; for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(x+11+k*16,y+h/2,2,0,Math.PI*2);ctx.fill();}
    });
    level().stars.forEach(([x,y],i)=>{
      if(collected.has(i))return;const pulse=1+Math.sin(performance.now()/170+i)*.12;
      ctx.save();ctx.translate(x,y);ctx.scale(pulse,pulse);ctx.shadowColor='#ffd96d';ctx.shadowBlur=17;ctx.fillStyle='#ffe179';ctx.beginPath();
      for(let p=0;p<10;p++){const a=-Math.PI/2+p*Math.PI/5,r=p%2?5:11;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.restore();
    });
    if(drawnBumper)drawSegment([drawnBumper.x1,drawnBumper.y1,drawnBumper.x2,drawnBumper.y2],'#baff63',9);
    if(dragStart&&dragNow){ctx.setLineDash([6,5]);drawSegment([dragStart.x,dragStart.y,dragNow.x,dragNow.y],'#baff6399',7);ctx.setLineDash([]);}
    const tx=level().target;ctx.fillStyle='#25374a';ctx.beginPath();ctx.roundRect(tx-48,487,96,57,14);ctx.fill();
    ctx.strokeStyle='#baff63';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(tx-39,492);ctx.lineTo(tx+39,492);ctx.stroke();
    ctx.fillStyle='#baff6322';ctx.fillRect(tx-40,494,80,43);ctx.fillStyle='#d6fca6';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillText('GOAL',tx,520);
    trail.forEach((p,i)=>{ctx.fillStyle=`rgba(190,255,108,${(i/trail.length)*.28})`;ctx.beginPath();ctx.arc(p.x,p.y,3+i*.45,0,Math.PI*2);ctx.fill();});
    if(state==='running'||state==='impact'){
      const shine=ctx.createRadialGradient(ball.x-4,ball.y-5,1,ball.x,ball.y,ball.r+6);shine.addColorStop(0,'#fff');shine.addColorStop(.25,'#e3ffa9');shine.addColorStop(1,'#91dc38');
      ctx.shadowColor='#baff63';ctx.shadowBlur=17;ctx.fillStyle=shine;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.life-=1/60;p.x+=p.vx/60;p.y+=p.vy/60;p.vy+=100/60;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
  }
  function frame(t) {
    if(!lastFrame)lastFrame=t;const dt=Math.min((t-lastFrame)/1000,.035);lastFrame=t;
    if(state==='running')physics(dt);draw();requestAnimationFrame(frame);
  }
  resize();renderUi();requestAnimationFrame(frame);
})();
