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
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name)
    };
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 560 }; }
  click() { this.listeners.click?.({}); }
  dispatch(name, event) { this.listeners[name]?.(event); }
}

const ids = [
  'board', 'level-title', 'chapter-label', 'best-score', 'attempts', 'level-dots',
  'instruction-text', 'drop-button', 'reset-button', 'toast', 'result', 'result-icon',
  'result-title', 'result-copy', 'result-button'
];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
const cssVariables = {};
const documentElement = { style: { setProperty: (name, value) => { cssVariables[name] = value; } } };
const noop = () => {};
const gradient = () => ({ addColorStop: noop });
const context = new Proxy({ createLinearGradient: gradient, createRadialGradient: gradient }, {
  get: (target, key) => target[key] ?? noop,
  set: (target, key, value) => (target[key] = value, true)
});
elements.board.getContext = () => context;

const raf = [];
const sandbox = {
  document: { documentElement, getElementById: (id) => elements[id], createElement: () => new Element() },
  window: { devicePixelRatio: 1, addEventListener: noop },
  ResizeObserver: class { observe() {} },
  localStorage: { getItem: () => null, setItem: noop },
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
const bootMarker = '  resize();renderUi();requestAnimationFrame(frame);\n})();';
assert.ok(source.includes(bootMarker), 'game boot marker exists for physics harness');
source = source.replace(bootMarker, `
  globalThis.__chaosDropTest = {
    levels,
    worldThemes,
    worldThemeForLevel,
    selectLevel(index) { levelIndex = index; resetLevel(); },
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
  { name: 'Final Frenzy', line: [231.99, 170.67, 132.16, 174.06] }
];

assert.equal(game.levels.length, witnesses.length, 'all five prototype puzzles are covered');
const worldBoundaries = [
  [1, 'NEON GREEN'], [10, 'NEON GREEN'], [11, 'NEON CYAN'], [20, 'NEON CYAN'],
  [21, 'NEON PURPLE'], [30, 'NEON PURPLE'], [31, 'NEON MAGENTA'], [40, 'NEON MAGENTA'],
  [41, 'NEON ORANGE'], [50, 'NEON ORANGE']
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
const stylesheet = fs.readFileSync('app/src/main/assets/style.css', 'utf8');
assert.match(stylesheet, /\.primary-button[^{]*\{[^}]*var\(--world-accent\)/, 'interactive controls inherit the active world palette');

for (let index = 0; index < witnesses.length; index++) {
  assert.equal(game.levels[index].name, witnesses[index].name, `puzzle ${index + 1} witness matches the level`);
  const [x1, y1, x2, y2] = witnesses[index].line;
  const length = Math.hypot(x2 - x1, y2 - y1);
  assert.ok(length >= 24 && length <= 108, `${witnesses[index].name}: bumper obeys the draw limit`);
  assert.ok(y1 >= 74 && y1 <= 500, `${witnesses[index].name}: bumper starts inside the touch area`);

  const frameRates = index === 4 ? [30, 45, 60, 90] : [30, 60];
  for (const fps of frameRates) {
    game.selectLevel(index);
    elements.board.dispatch('pointerdown', { clientX: x1, clientY: y1, pointerId: 1 });
    elements.board.dispatch('pointerup', { clientX: x2, clientY: y2, pointerId: 1 });
    elements['drop-button'].click();
    assert.equal(game.step(1 / fps), 'running', `${witnesses[index].name}: drop starts at ${fps} FPS`);

    let state = 'running';
    for (let frame = 0; frame < fps * 12 && state === 'running'; frame++) {
      state = game.step(1 / fps);
    }
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
console.log('All five puzzles have verified player-drawn winning routes; Final Frenzy passes at 30, 45, 60, and 90 FPS.');
