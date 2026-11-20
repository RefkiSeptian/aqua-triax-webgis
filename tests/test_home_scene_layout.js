// Check the rendered scene's world layout, including shoulders and roof overhangs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync('WEBGIS_READY/home-scene.js', 'utf8'), sandbox);
const layout = sandbox.createHomeSceneLayout();
const planar = point => [point[0], point[2]];
const pairs = points => points.slice(1).map((end, index) => [points[index], end]);

function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  if (dx === 0 && dz === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

function rectangleDistance(a, b, [x, z, w, d]) {
  const inside = p => Math.abs(p[0] - x) <= w / 2 && Math.abs(p[1] - z) <= d / 2;
  if (inside(a) || inside(b)) return 0;
  const corners = [[x-w/2, z-d/2], [x+w/2, z-d/2], [x+w/2, z+d/2], [x-w/2, z+d/2]];
  return Math.min(...pairs([...corners, corners[0]]).map(([c, d]) => segmentDistance(a, b, c, d)));
}

for (const [roadIndex, route] of layout.roads.entries()) {
  const roadSegments = pairs(route.points.map(planar));
  const clearance = route.width / 2 + .275 + .25; // Shoulder plus yard setback.
  for (const [houseIndex, [x, z, w, d]] of layout.houses.entries()) {
    assert(roadSegments.every(([a, b]) => rectangleDistance(a, b, [x, z, w + .6, d + .6]) > clearance),
      `House ${houseIndex} overlaps road ${roadIndex} or its setback`);
  }
  for (const [treeIndex, tree] of layout.trees.entries()) {
    assert(roadSegments.every(([a, b]) => pointSegment(tree, a, b) > clearance + 1),
      `Tree ${treeIndex} canopy overlaps road ${roadIndex}`);
  }
  assert(roadSegments.every(([a, b]) => rectangleDistance(a, b, [2, .2, 4.5, 4.5]) > clearance),
    `Largest household tank platform overlaps road ${roadIndex}`);
  assert(roadSegments.every(([a, b]) => pointSegment(planar(layout.receivingTank), a, b) > clearance + 1.05),
    `Distribution tank overlaps road ${roadIndex}`);
  const pipes = [...layout.gutters, layout.firstFlush,
    ...[[2.6, 1.05], [3.3, 1.9], [3.3, 1.6]].map(args => layout.inletRoute(...args))];
  for (const pipe of pipes) {
    assert(pairs(pipe.map(planar)).every(([c, d]) => roadSegments.every(([a, b]) => segmentDistance(a, b, c, d) > clearance)),
      `Permanent roof pipe crosses road ${roadIndex}`);
  }
}
const mainSegments = pairs(layout.roads[0].points.map(planar));
assert(mainSegments.some(([a, b]) => pointSegment(planar(layout.roads[1].points[0]), a, b) < 1e-8), 'Branch must join the main road');
for (const stop of layout.deliveryPath) {
  assert(mainSegments.some(([a, b]) => pointSegment(planar(stop), a, b) < 1e-8), 'Truck must stay on the road');
}
console.log('PASS home scene layout: buildings, trees, tanks and permanent pipes clear of roads; connected junction and delivery route');
