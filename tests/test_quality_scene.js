// A chapter boundary must not teleport the same scene to a different camera.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function renderer(width, height) {
  let path = [];
  let strokes = [];
  let nextFrame;
  let time = 0;
  const noop = () => {};
  const gradient = () => ({addColorStop: noop});
  const context = new Proxy({
    globalAlpha: 1,
    beginPath: () => { path = []; },
    moveTo: (x, y) => path.push([x, y]),
    lineTo: (x, y) => path.push([x, y]),
    stroke() { strokes.push({color: this.strokeStyle, points: path.slice()}); },
    createLinearGradient: gradient, createRadialGradient: gradient,
    measureText: text => ({width: text.length * 6})
  }, {get: (object, key) => key in object ? object[key] : noop});
  const sandbox = {
    window: {matchMedia: () => ({matches: true, addEventListener: noop, removeEventListener: noop}),
      addEventListener: noop, removeEventListener: noop},
    document: {hidden: false, addEventListener: noop, removeEventListener: noop},
    performance: {now: () => time}, devicePixelRatio: 1,
    requestAnimationFrame: callback => { nextFrame = callback; return 1; },
    cancelAnimationFrame: noop
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('WEBGIS_READY/home-scene.js', 'utf8'), sandbox);
  const canvas = {
    getContext: () => context, getBoundingClientRect: () => ({width, height}),
    parentElement: {querySelector: () => ({textContent: ''})}
  };
  const scene = sandbox.createHomeScene(canvas, {qualityOnly: true});
  scene.start();
  return value => {
    scene.setProgress(value);
    strokes = [];
    time += 50;
    nextFrame(time);
    const grid = strokes.find(stroke => stroke.color === '#8dcaac12');
    assert(grid?.points.length === 2, 'Expected the projected scene floor');
    return grid.points;
  };
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  const draw = renderer(width, height);
  for (const progress of [.499, .501]) {
    const before = draw(progress - .001);
    const after = draw(progress + .001);
    const displacement = Math.max(...before.map(([x, y], index) =>
      Math.hypot(after[index][0] - x, after[index][1] - y)));
    assert(displacement < 2, `${width}: camera jumped ${displacement.toFixed(1)} px near chapter boundary`);
  }
  // Reverse scrolling follows the same geometry, without a chapter reset.
  const forward = draw(.3);
  draw(.8);
  assert.deepEqual(draw(.3), forward);
}
console.log('PASS quality scene: continuous camera at first chapter boundary and reversible scrolling');
