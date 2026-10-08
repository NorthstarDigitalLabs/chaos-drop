const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
  constructor(id='') { this.id=id; this.children=[]; this.listeners={}; this.textContent=''; this.innerHTML=''; this.disabled=false; this.classes=new Set(); this.attributes={}; this.classList={add:(x)=>this.classes.add(x),remove:(x)=>this.classes.delete(x),contains:(x)=>this.classes.has(x),toggle:(x,on)=>{if(on)this.classes.add(x);else this.classes.delete(x);return on}}; }
  set className(value) { this.classes=new Set(String(value).split(/\s+/).filter(Boolean)); }
  addEventListener(name,fn) { this.listeners[name]=fn; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children=[]; }
  setAttribute(name,value) { this.attributes[name]=value; }
  setPointerCapture() {}
  getBoundingClientRect() { return {left:0,top:0,width:360,height:560}; }
  click() { this.listeners.click?.({}); }
  dispatch(name,event) { this.listeners[name]?.(event); }
}

const ids=['home-screen','level-select-screen','game-screen','play-button','home-levels-button','levels-home-button','sound-toggle','home-progress','select-progress','green-level-grid','cyan-level-grid','game-home-button','game-levels-button','board','level-title','chapter-label','best-score','attempts','level-dots','instruction-text','drop-button','reset-button','toast','result','result-icon','result-title','result-copy','result-button','result-secondary-button'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const savedProgress=new Map();
const audioEvents=[];
const canvas=elements.board;
const noop=()=>{};
class MockAudioContext {
  constructor() { this.currentTime=0;this.state='running';this.destination={}; }
  createOscillator() { return {frequency:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:noop,start:()=>audioEvents.push('tone'),stop:noop}; }
  createGain() { return {gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:noop}; }
  resume() { return Promise.resolve(); }
}
function gradient() { return {addColorStop:noop}; }
const ctx2d=new Proxy({createLinearGradient:gradient,createRadialGradient:gradient,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fill:noop,fillRect:noop,clearRect:noop,arc:noop,closePath:noop,save:noop,restore:noop,translate:noop,scale:noop,fillText:noop,roundRect:noop,setLineDash:noop}, {get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
canvas.getContext=()=>ctx2d;
canvas.width=360; canvas.height=560;
const raf=[];
const sandbox={
  document:{documentElement:{style:{setProperty:noop}},getElementById:id=>elements[id],createElement:()=>new Element()},
  window:{devicePixelRatio:1,addEventListener:noop,AudioContext:MockAudioContext},
  ResizeObserver:class{observe(){ }},
  localStorage:{getItem:key=>savedProgress.get(key)??null,setItem:(key,value)=>savedProgress.set(key,String(value))},
  requestAnimationFrame:fn=>raf.push(fn),
  performance:{now:()=>1000},
  setTimeout:()=>1,clearTimeout:noop,console,Math,Number,String,Set,JSON
};
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js','utf8'),sandbox,{filename:'game.js'});
assert.equal(raf.length,0,'title screen does not run a continuous animation loop');
assert.equal(elements['home-screen'].classList.contains('hidden'),false,'title screen is the launch screen');
assert.equal(elements['game-screen'].classList.contains('hidden'),true,'gameplay waits behind the start screen');
elements['home-levels-button'].click();
assert.equal(elements['green-level-grid'].children.length,10,'level select groups the green world');
assert.equal(elements['cyan-level-grid'].children.length,10,'level select groups the cyan world');
assert.equal(elements['green-level-grid'].children[0].disabled,false,'level one is available initially');
assert.equal(elements['green-level-grid'].children[1].disabled,true,'later levels stay locked until a win');
elements['levels-home-button'].click();
audioEvents.length=0;
elements['sound-toggle'].click();
assert.equal(elements['sound-toggle'].textContent,'♪ SOUND OFF','sound toggle turns audio off');
assert.equal(savedProgress.get('chaosDropSound'),'off','sound preference is saved locally');
assert.equal(audioEvents.length,0,'muted UI creates no sound effects');
elements['sound-toggle'].click();
assert.equal(elements['sound-toggle'].textContent,'♪ SOUND ON','sound toggle turns audio back on');
assert.ok(audioEvents.length>0,'original synthesized UI sound plays when enabled');
elements['play-button'].click();
assert.equal(elements['game-screen'].classList.contains('hidden'),false,'start button opens gameplay');
assert.equal(elements['level-dots'].children.length,20,'twenty puzzles are available');
const startFrame=raf.shift();assert.equal(typeof startFrame,'function','game schedules rendering only after play begins');startFrame(16);
elements['drop-button'].click();
assert.match(elements.toast.textContent,/Draw your bumper first/,'drop requires a bumper');
canvas.dispatch('pointerdown',{clientX:70,clientY:120,pointerId:1});
canvas.dispatch('pointermove',{clientX:170,clientY:200,pointerId:1});
canvas.dispatch('pointerup',{clientX:170,clientY:200,pointerId:1});
elements['drop-button'].click();
assert.match(elements['drop-button'].innerHTML,/IN MOTION/,'drawing a bumper enables a drop');
assert.equal(elements['drop-button'].disabled,true,'drop cannot be repeated while the ball is moving');
elements['reset-button'].click();
assert.equal(elements.attempts.children.filter(x=>x.classList.contains('used')).length,0,'Restart Level immediately restores all three attempts');
assert.match(elements.toast.textContent,/Fresh board/,'restart gives immediate feedback');
canvas.dispatch('pointerdown',{clientX:48,clientY:110,pointerId:2});
canvas.dispatch('pointerup',{clientX:92,clientY:118,pointerId:2});
elements['drop-button'].click();
for(let i=0;i<100;i++) { const next=raf.shift(); if(next) next(14000+i*35); }
assert.equal(elements['result'].classList.contains('hidden'),false,'a ball that reaches the cup wins the puzzle');
assert.match(elements['result-title'].textContent,/Beautiful chaos/,'win feedback is shown');
assert.ok(Number(elements['best-score'].textContent)>0,'a successful puzzle updates the score');
elements['result-button'].click();
assert.match(elements['chapter-label'].textContent,/PUZZLE 02 \/ 20/,'next puzzle advances progression');
assert.equal(savedProgress.get('chaosDropLevel'),'1','current puzzle is saved locally');
assert.equal(savedProgress.get('chaosDropUnlocked'),'2','winning unlocks the next puzzle');
assert.deepEqual(JSON.parse(savedProgress.get('chaosDropCompleted')),[0],'completed level is saved for the level-select screen');
elements['game-levels-button'].click();
assert.equal(elements['green-level-grid'].children[1].disabled,false,'newly won puzzle is selectable');
assert.equal(elements['green-level-grid'].children[0].classList.contains('completed'),true,'completed level is clearly marked');
elements['green-level-grid'].children[1].click();
assert.equal(elements['level-title'].textContent,'Split Decision','selecting an unlocked puzzle loads it');
assert.equal(savedProgress.get('chaosDropLevel'),'1','manual level selection is saved locally');
assert.equal(sandbox.window.chaosDropHandleBack(),true,'Android Back from gameplay opens level select');
assert.equal(sandbox.window.chaosDropHandleBack(),true,'Android Back from level select opens the title screen');
assert.equal(sandbox.window.chaosDropHandleBack(),false,'Android Back on title screen exits normally');
console.log('Chaos Drop beta smoke test passed: title and level-select flow, unlock/completion states, saved progress, sound toggle and synthesized UI cue, restart, next-level, and Android Back navigation.');
