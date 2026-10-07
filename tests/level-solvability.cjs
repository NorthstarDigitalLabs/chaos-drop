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
const noop = () => {};
const gradient = () => ({ addColorStop: noop });
const context = new Proxy({ createLinearGradient: gradient, createRadialGradient: gradient }, {
  get: (target, key) => target[key] ?? noop,
  set: (target, key, value) => (target[key] = value, true)
});
elements.board.getContext = () => context;

const raf = [];
const sandbox = {
  document: { getElementById: (id) => elements[id], createElement: () => new Element() },
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
  { name: 'Final Frenzy', line: [200.6, 233.9, 170.1, 268.1] }
];

assert.equal(game.levels.length, witnesses.length, 'all five prototype puzzles are covered');
for (let index = 0; index < witnesses.length; index++) {
  assert.equal(game.levels[index].name, witnesses[index].name, `puzzle ${index + 1} witness matches the level`);
  const [x1, y1, x2, y2] = witnesses[index].line;
  const length = Math.hypot(x2 - x1, y2 - y1);
  assert.ok(length >= 24 && length <= 108, `${witnesses[index].name}: bumper obeys the draw limit`);
  assert.ok(y1 >= 74 && y1 <= 500, `${witnesses[index].name}: bumper starts inside the touch area`);

  for (const fps of [30, 60]) {
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

console.log('All five puzzles have verified player-drawn winning routes at 30 and 60 FPS.');
