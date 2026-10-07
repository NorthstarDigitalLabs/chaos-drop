const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
  constructor(id='') { this.id=id; this.children=[]; this.listeners={}; this.textContent=''; this.innerHTML=''; this.disabled=false; this.classes=new Set(); this.classList={add:(x)=>this.classes.add(x),remove:(x)=>this.classes.delete(x),contains:(x)=>this.classes.has(x)}; }
  addEventListener(name,fn) { this.listeners[name]=fn; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children=[]; }
  setPointerCapture() {}
  getBoundingClientRect() { return {left:0,top:0,width:360,height:560}; }
  click() { this.listeners.click?.({}); }
  dispatch(name,event) { this.listeners[name]?.(event); }
}

const ids=['board','level-title','chapter-label','best-score','attempts','level-dots','level-picker-button','level-picker','level-grid','level-picker-close','instruction-text','drop-button','reset-button','toast','result','result-icon','result-title','result-copy','result-button'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const savedProgress=new Map();
const canvas=elements.board;
const noop=()=>{};
function gradient() { return {addColorStop:noop}; }
const ctx2d=new Proxy({createLinearGradient:gradient,createRadialGradient:gradient,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fill:noop,fillRect:noop,clearRect:noop,arc:noop,closePath:noop,save:noop,restore:noop,translate:noop,scale:noop,fillText:noop,roundRect:noop,setLineDash:noop}, {get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
canvas.getContext=()=>ctx2d;
canvas.width=360; canvas.height=560;
const raf=[];
const sandbox={
  document:{documentElement:{style:{setProperty:noop}},getElementById:id=>elements[id],createElement:()=>new Element()},
  window:{devicePixelRatio:1,addEventListener:noop},
  ResizeObserver:class{observe(){ }},
  localStorage:{getItem:key=>savedProgress.get(key)??null,setItem:(key,value)=>savedProgress.set(key,String(value))},
  requestAnimationFrame:fn=>raf.push(fn),
  performance:{now:()=>1000},
  setTimeout:()=>1,clearTimeout:noop,console,Math,Number,String,Set,JSON
};
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js','utf8'),sandbox,{filename:'game.js'});
const frame=raf.shift(); assert.equal(typeof frame,'function'); frame(16);
assert.equal(elements['level-dots'].children.length,20,'twenty puzzles are available');
elements['level-picker-button'].click();
assert.equal(elements['level-grid'].children.length,20,'selector lists all twenty levels');
assert.equal(elements['level-grid'].children[0].disabled,false,'level one is available at start');
assert.equal(elements['level-grid'].children[1].disabled,true,'later levels stay locked until a win');
elements['level-picker-close'].click();
elements['drop-button'].click();
assert.match(elements.toast.textContent,/Draw your bumper first/,'drop requires a bumper');
canvas.dispatch('pointerdown',{clientX:70,clientY:120,pointerId:1});
canvas.dispatch('pointermove',{clientX:170,clientY:200,pointerId:1});
canvas.dispatch('pointerup',{clientX:170,clientY:200,pointerId:1});
elements['drop-button'].click();
assert.match(elements['drop-button'].innerHTML,/IN MOTION/,'drawing a bumper enables a drop');
assert.equal(elements['drop-button'].disabled,true,'drop cannot be repeated while the ball is moving');
elements['reset-button'].click();
assert.match(elements.toast.textContent,/finish this run/,'reset does not interrupt active physics');
for(let i=0;i<380;i++) { const next=raf.shift(); if(next) next(32+i*35); }
assert.equal(elements.attempts.children.length,3,'attempt display remains consistent after a failed run');
elements['reset-button'].click();
assert.equal(elements.attempts.children.filter(x=>x.classList.contains('used')).length,0,'reset restores all three attempts');
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
elements['level-picker-button'].click();
assert.equal(elements['level-grid'].children[1].disabled,false,'newly won puzzle is selectable');
elements['level-grid'].children[1].click();
assert.equal(elements['level-title'].textContent,'Split Decision','selecting an unlocked puzzle loads it');
assert.equal(savedProgress.get('chaosDropLevel'),'1','manual level selection is saved locally');
console.log('Chaos Drop game smoke test passed.');
