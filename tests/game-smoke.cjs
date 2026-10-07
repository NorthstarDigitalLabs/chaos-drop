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

const ids=['board','level-title','chapter-label','best-score','attempts','level-dots','instruction-text','drop-button','reset-button','toast','result','result-icon','result-title','result-copy','result-button'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
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
  localStorage:{getItem:()=>null,setItem:noop},
  requestAnimationFrame:fn=>raf.push(fn),
  performance:{now:()=>1000},
  setTimeout:()=>1,clearTimeout:noop,console,Math,Number,String,Set,JSON
};
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game.js','utf8'),sandbox,{filename:'game.js'});
const frame=raf.shift(); assert.equal(typeof frame,'function'); frame(16);
assert.equal(elements['level-dots'].children.length,5,'five puzzles are available');
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
assert.match(elements['chapter-label'].textContent,/02 \/ 05/,'next puzzle advances progression');
console.log('Chaos Drop game smoke test passed.');
