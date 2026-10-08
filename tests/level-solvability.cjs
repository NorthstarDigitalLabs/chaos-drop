const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
    this.classes = new Set();
    this.attributes = {};
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
      toggle: (name,on) => { if(on)this.classes.add(name);else this.classes.delete(name);return on; }
    };
  }
  set className(value) { this.classes=new Set(String(value).split(/\s+/).filter(Boolean)); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute(name,value) { this.attributes[name]=value; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 560 }; }
  click() { this.listeners.click?.({}); }
  dispatch(name, event) { this.listeners[name]?.(event); }
}

const ids = [
  'home-screen','level-select-screen','game-screen','play-button','home-levels-button','levels-home-button','sound-toggle','home-progress','select-progress','green-level-grid','cyan-level-grid','game-home-button','game-levels-button',
  'board', 'level-title', 'chapter-label', 'best-score', 'attempts', 'level-dots',
  'instruction-text', 'drop-button', 'reset-button', 'toast', 'result', 'result-icon',
  'result-title', 'result-copy', 'result-button','result-secondary-button'
];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
const savedProgress = new Map([['chaosDropLevel','9'],['chaosDropUnlocked','10']]);
const cssVariables = {};
const documentElement = { style: { setProperty: (name, value) => { cssVariables[name] = value; } } };
const noop = () => {};
const gradient = () => ({ addColorStop: noop });
const drawLog = [];
const context = new Proxy({
  createLinearGradient: gradient,
  createRadialGradient: gradient,
  roundRect: (...args) => drawLog.push({ op: 'roundRect', args }),
  fillRect: (...args) => drawLog.push({ op: 'fillRect', args, shadowBlur: context.shadowBlur }),
  stroke: () => drawLog.push({ op: 'stroke', strokeStyle: context.strokeStyle, shadowBlur: context.shadowBlur, lineWidth: context.lineWidth }),
  fillText: (text, ...args) => drawLog.push({ op: 'fillText', text, args })
}, {
  get: (target, key) => target[key] ?? noop,
  set: (target, key, value) => (target[key] = value, true)
});
elements.board.getContext = () => context;

const raf = [];
const sandbox = {
  document: { documentElement, getElementById: (id) => elements[id], createElement: () => new Element() },
  window: { devicePixelRatio: 1, addEventListener: noop },
  ResizeObserver: class { observe() {} },
  localStorage: { getItem: (key) => savedProgress.get(key) ?? null, setItem: (key,value) => savedProgress.set(key,String(value)) },
  requestAnimationFrame: (callback) => raf.push(callback),
  performance: { now: () => 0 },
  setTimeout: () => 1,
  clearTimeout: noop,
  console,
  Math,
  Number,
  String,
  Set,
  JSON
};

let source = fs.readFileSync('app/src/main/assets/game.js', 'utf8');
const bootMarker = '  resize();renderUi();updateSoundToggle();\n  setScreen(\'home\');\n})();';
assert.ok(source.includes(bootMarker), 'game boot marker exists for physics harness');
source = source.replace(bootMarker, `
  globalThis.__chaosDropTest = {
    levels,
    worldThemes,
    worldThemeForLevel,
    draw,
    showWonTarget() { state = 'won'; draw(); },
    playLine(index,line,fps=60) {
      levelIndex=index;screen='game';resetLevel();
      const [x1,y1,x2,y2]=line;
      onPointerDown({clientX:x1,clientY:y1,pointerId:7});
      onPointerUp({clientX:x2,clientY:y2,pointerId:7});
      ui.drop.listeners.click({});
      for(let frame=0;frame<fps*12&&state==='running';frame++)physics(1/fps);
      return state;
    },
    gatePosition(index,time) { levelIndex=index; const previous=elapsed; elapsed=time; const segment=movingGateSegment(level().gates[0]); elapsed=previous; return segment; },
    springImpulse(index) {
      const s=levels[index].springPads[0],dx=s[2]-s[0],dy=s[3]-s[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
      const px=(s[0]+s[2])/2,py=(s[1]+s[3])/2;ball={x:px+nx*8,y:py+ny*8,vx:-nx*100,vy:-ny*100,r:11};
      const hit=collideSegment(s,1.08);return {hit,rebound:ball.vx*nx+ball.vy*ny};
    },
    breakableHit(index) {
      levelIndex=index;elapsed=0;brokenSegments=new Set();state='running';
      const s=levels[index].breakables[0],dx=s[2]-s[0],dy=s[3]-s[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
      const px=(s[0]+s[2])/2,py=(s[1]+s[3])/2;ball={x:px-nx*10,y:py-ny*10,vx:nx*100,vy:ny*100,r:11};
      physics(.016);return brokenSegments.has(0);
    },
    failLastAttempt(index) {
      levelIndex=index;screen='game';attemptsLeft=0;state='running';elapsed=0;
      const [x,y,w,h]=levels[index].hazards[0];ball={x:x+w/2,y:y+h/2,vx:0,vy:0,r:11};
      physics(.016);return state;
    },
    getState() { return { levelIndex, state, highestUnlockedLevel, score, theme:theme().name, title:level().name }; },
    clickNext() { ui.resultButton.listeners?.click?.({}); },
    selectLevel(index) { levelIndex = index;screen='game';resetLevel(); },
    step(dt) { if (state === 'running') physics(dt); return state; }
  };
${bootMarker}`);
vm.runInNewContext(source, sandbox, { filename: 'game.js' });

const game = sandbox.__chaosDropTest;
const witnesses = [
  { name: 'First Bounce', line: [78.4, 287.2, 84.7, 359.8] },
  { name: 'Split Decision', line: [252.2, 112.8, 184.7, 115.0] },
  { name: 'The Switchback', line: [233.4, 172.1, 181.5, 258.3] },
  { name: 'Hot Potato', line: [165.6, 176.6, 186.7, 222.7] },
  { name: 'Final Frenzy', line: [231.99, 170.67, 132.16, 174.06] },
  { name: 'Green Switchback', line: [179.98, 199.57, 114.13, 123.41] },
  { name: 'Orbit Lane', line: [154.93, 197.25, 196.36, 136.36] },
  { name: 'Spring Street', line: [209.58, 104.72, 165.84, 94.36] },
  { name: 'Pinch Point', line: [136.92, 322.55, 187.84, 248.56] },
  { name: 'Emerald Finale', line: [219.41, 255.38, 127.69, 206.61] },
  { name: 'Blue Horizon', line: [149.39, 179.73, 186.34, 168.09] },
  { name: 'Cyan Coil', line: [185.42, 269.87, 200, 346.2] },
  { name: 'Moving Current', line: [192.65, 126.13, 153.71, 79.34] },
  { name: 'Neon Split', line: [152.27, 187.94, 242.6, 208.02] },
  { name: 'Glass Breaker', line: [219.8, 286.89, 237.44, 199.01] },
  { name: 'Blue Launch', line: [203.36, 191.79, 148.72, 133.54] },
  { name: 'Crossfade', line: [206.67, 97.21, 168.05, 76] },
  { name: 'Cascade', line: [206.86, 173.86, 146, 149.21] },
  { name: 'Last Light', line: [143.71, 128.15, 207.76, 155.36] },
  { name: 'Cyan Finale', line: [178.42, 232.54, 170.62, 172.5] }
];

assert.equal(game.levels.length, witnesses.length, 'all 20 puzzles are covered');
const worldBoundaries = [
  [1, 'NEON GREEN'], [5, 'NEON GREEN'], [10, 'NEON GREEN'], [11, 'NEON CYAN'], [20, 'NEON CYAN']
];
for (const [levelNumber, expectedWorld] of worldBoundaries) {
  assert.equal(game.worldThemeForLevel(levelNumber).name, expectedWorld, `level ${levelNumber} inherits its ten-level world palette`);
}
for (const palette of game.worldThemes) {
  assert.notEqual(palette.ball, palette.accent, `${palette.name} uses a contrasting ball color`);
  assert.ok(palette.ballGlow && palette.accentGlow, `${palette.name} defines reusable neon glow colors`);
  const rgb = (hex) => hex.slice(1).match(/../g).map((part) => Number.parseInt(part, 16));
  const distance = Math.hypot(...rgb(palette.ball).map((value, i) => value - rgb(palette.accent)[i]));
  assert.ok(distance > 180, `${palette.name} ball and world colors remain visually distinct`);
}
assert.equal(game.getState().levelIndex,9,'saved Level 10 progress resumes at Level 10');
assert.equal(game.playLine(9,witnesses[9].line,60),'won','Level 10 has a legitimate finishing route');
assert.match(elements['result-button'].innerHTML,/ENTER NEON CYAN/,'Level 10 completion previews the new world');
elements['result-button'].click();
assert.match(elements['chapter-label'].textContent,/WORLD 02 · PUZZLE 11 \/ 20/,'Level 10 completion advances into Level 11');
assert.equal(cssVariables['--world-accent'],game.worldThemes[1].accent,'Level 11 changes to the cyan world palette');
assert.match(elements.toast.textContent,/NEON CYAN world unlocked/,'world transition is announced to the player');
assert.equal(savedProgress.get('chaosDropUnlocked'),'11','Level 10 win saves Level 11 as unlocked');
assert.equal(savedProgress.get('chaosDropLevel'),'10','Level 11 is saved as the current puzzle');
const gateAtStart=game.gatePosition(12,0),gateLater=game.gatePosition(12,.6);
assert.notDeepEqual(gateAtStart,gateLater,'moving obstacle changes position with elapsed time');
for(const index of [7,11]){
  const impulse=game.springImpulse(index);
  assert.equal(impulse.hit,true,`${game.levels[index].name} spring pad registers a collision`);
  assert.ok(impulse.rebound>100,`${game.levels[index].name} spring pad launches the ball with added bounce`);
}
for(const index of [14,17,19]) assert.ok(game.levels[index].breakables.length,'breakable objects appear in later puzzles');
assert.equal(game.breakableHit(14),true,'Glass Breaker removes a struck breakable rail');
assert.equal(game.failLastAttempt(2),'lost','a final hazard impact enters the quick retry state');
assert.match(elements['result-title'].textContent,/So close/,'failure provides clear immediate feedback');
assert.match(elements['result-button'].innerHTML,/RETRY LEVEL/,'failure offers a one-tap restart');
elements['result-button'].click();
assert.equal(game.getState().state,'ready','retry restarts the puzzle immediately');
const stylesheet = fs.readFileSync('app/src/main/assets/style.css', 'utf8');
assert.match(stylesheet, /\.primary-button[^{]*\{[^}]*var\(--world-accent\)/, 'interactive controls inherit the active world palette');

for (let index = 0; index < witnesses.length; index++) {
  assert.equal(game.levels[index].name, witnesses[index].name, `puzzle ${index + 1} witness matches the level`);
  const [x1, y1, x2, y2] = witnesses[index].line;
  const length = Math.hypot(x2 - x1, y2 - y1);
  assert.ok(length >= 24 && length <= 108, `${witnesses[index].name}: bumper obeys the draw limit`);
  assert.ok(y1 >= 74 && y1 <= 500, `${witnesses[index].name}: bumper starts inside the touch area`);

  const frameRates = index === 4 ? [30, 45, 60, 90] : index < 5 ? [30, 60] : [60];
  for (const fps of frameRates) {
    const state=game.playLine(index,witnesses[index].line,fps);
    assert.equal(elements['level-title'].textContent,witnesses[index].name,`${witnesses[index].name}: level loads in the UI`);
    assert.equal(state, 'won', `${witnesses[index].name}: a valid drawn bumper wins at ${fps} FPS`);
  }
}

const finalLine=witnesses[4].line;
for (const [dx,dy] of [[0,0],[-4,0],[4,0],[0,-4],[0,4]]) {
  for (const fps of [30,60]) {
    game.selectLevel(4);
    elements.board.dispatch('pointerdown',{clientX:finalLine[0]+dx,clientY:finalLine[1]+dy,pointerId:2});
    elements.board.dispatch('pointerup',{clientX:finalLine[2]+dx,clientY:finalLine[3]+dy,pointerId:2});
    elements['drop-button'].click();
    let state='running';
    for (let frame=0;frame<fps*12&&state==='running';frame++) state=game.step(1/fps);
    assert.equal(state,'won',`Final Frenzy remains winnable after ${dx || dy}px bumper placement offset at ${fps} FPS`);
  }
}

assert.equal(cssVariables['--world-accent'], game.worldThemes[0].accent, 'active UI palette is applied through CSS variables');
game.selectLevel(0);
drawLog.length = 0;
game.draw();
const normalTarget = drawLog.slice();
assert.ok(normalTarget.some((call) => call.op === 'fillText' && call.text === 'WINNER'), 'destination box says WINNER before play');
assert.ok(!normalTarget.some((call) => call.op === 'fillText' && call.text === 'GOAL'), 'old GOAL label is removed');
const targetGeometry = (calls) => calls.filter((call) => (call.op === 'roundRect' && call.args[1] === 487) || (call.op === 'fillRect' && call.args[1] === 494)).map((call) => [call.op, ...call.args]);
const normalGeometry = targetGeometry(normalTarget);
assert.deepEqual(normalGeometry, [['roundRect', 132, 487, 96, 57, 14], ['fillRect', 140, 494, 80, 43]], 'target box dimensions and position remain unchanged');
drawLog.length = 0;
game.showWonTarget();
const wonTarget = drawLog.slice();
const targetStroke = (calls) => calls.find((call) => call.op === 'stroke' && call.strokeStyle === game.worldThemes[0].accent);
assert.ok(targetStroke(wonTarget).shadowBlur > targetStroke(normalTarget).shadowBlur, 'WINNER outline glows more intensely after a win');
assert.ok(wonTarget.some((call) => call.op === 'fillRect' && call.args[1] === 494 && call.shadowBlur > 0), 'WINNER light glows more intensely after a win');
assert.deepEqual(targetGeometry(wonTarget), normalGeometry, 'win glow does not change target size or position');
assert.equal(game.playLine(9,witnesses[9].line,60),'won','Level 10 remains winnable before a progression reload');
elements['result-button'].click();
assert.equal(savedProgress.get('chaosDropLevel'),'10','Level 11 remains the saved current level after the transition');
const reloadElements=Object.fromEntries(ids.map((id)=>[id,new Element()]));
const reloadVariables={};
const reloadContext=new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{get:(target,key)=>target[key]??noop,set:(target,key,value)=>(target[key]=value,true)});
reloadElements.board.getContext=()=>reloadContext;
const reloadRaf=[];
const reloadSandbox={
  document:{documentElement:{style:{setProperty:(key,value)=>reloadVariables[key]=value}},getElementById:(id)=>reloadElements[id],createElement:()=>new Element()},
  window:{devicePixelRatio:1,addEventListener:noop},ResizeObserver:class{observe(){}},
  localStorage:{getItem:(key)=>savedProgress.get(key)??null,setItem:(key,value)=>savedProgress.set(key,String(value))},
  requestAnimationFrame:(callback)=>reloadRaf.push(callback),performance:{now:()=>0},setTimeout:()=>1,clearTimeout:noop,console,Math,Number,String,Set,JSON
};
vm.runInNewContext(source,reloadSandbox,{filename:'game-reload.js'});
assert.match(reloadElements['chapter-label'].textContent,/WORLD 02 · PUZZLE 11 \/ 20/,'reopening the game restores the saved current level');
assert.equal(reloadElements['level-title'].textContent,'Blue Horizon','reopening restores the correct puzzle');
assert.equal(reloadVariables['--world-accent'],game.worldThemes[1].accent,'reopened progress restores the cyan palette');
reloadElements['home-levels-button'].click();
assert.equal(reloadElements['green-level-grid'].children.length,10,'reopened level selector contains the green world');
assert.equal(reloadElements['cyan-level-grid'].children.length,10,'reopened level selector contains the cyan world');
assert.equal(reloadElements['cyan-level-grid'].children[0].disabled,false,'reopened progress keeps Level 11 unlocked');
console.log('All 20 beta puzzles have verified player-drawn winning routes; menu and progression state, Level 10→11 theme transition, local save data, moving gates, spring launches, breakable rails, and WINNER glow are verified.');
