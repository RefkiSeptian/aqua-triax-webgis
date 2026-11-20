'use strict';

function createHomeScene(canvas) {
  const ctx = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cameras = [
    {eye: [22, 17, 32], focus: [-1, 1, -1]},
    {eye: [10, 10, 20], focus: [-2, 2, 1]},
    {eye: [19, 23, 35], focus: [1, 1, 0]},
    {eye: [8.5, 6, 11], focus: [3.1, 1.8, 1.6]}
  ];
  const road = [[-23, .06, 11], [-13, .06, 7], [-4, .06, 9], [5, .06, 7], [14, .06, 5], [24, .06, 9]];
  const gutter = [[-8, 3.65, 2.65], [-2, 3.65, 2.65], [-.2, 3.5, 2.65], [-.2, 3.4, .2], [.5, 3.4, .2]];
  const tap = [[3.5, 2.7, .2], [4, 2.7, .2], [4, 2.7, 2.5], [5, 2.7, 2.5]];
  const houses = [
    [-5, 0, 6, 5, 3.5], [-13, -13, 4.5, 4, 2.5], [6, -14, 5, 4, 2.9],
    [16, -5, 4, 4, 2.6], [-16, 5, 4, 3.5, 2.3], [12, 14, 4.5, 4, 2.5], [-3, -25, 4, 4, 2.5]
  ];
  const trees = [[-10, 8], [-18, -5], [12, -19], [20, 13], [-20, 14], [7, -24], [19, -15], [-8, -18]];
  let active = false;
  let frame;
  let width = 0;
  let height = 0;
  let target = 0;
  let progress = 0;
  let lastTime = 0;
  let clock = 0;
  let camera;
  let faces = [];

  const lerp = (a, b, t) => a + (b - a) * t;
  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const normalize = vector => {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  function tint(hex, light) {
    const number = parseInt(hex.slice(1), 16);
    const channels = [number >> 16, number >> 8 & 255, number & 255];
    return `rgb(${channels.map(value => Math.max(0, Math.min(255, Math.round(value * light)))).join(',')})`;
  }

  function setCamera() {
    const index = Math.min(2, Math.floor(progress));
    const fraction = progress - index;
    const ease = fraction * fraction * (3 - 2 * fraction);
    const eye = cameras[index].eye.map((value, axis) => lerp(value, cameras[index + 1].eye[axis], ease));
    const focus = cameras[index].focus.map((value, axis) => lerp(value, cameras[index + 1].focus[axis], ease));
    const forward = normalize(subtract(focus, eye));
    const right = normalize(cross(forward, [0, 1, 0]));
    const mobile = width < 761;
    camera = {
      eye, forward, right, up: cross(right, forward),
      focal: mobile ? width * 1.05 : height * 1.05,
      x: width * (mobile ? .53 : .72), y: height * (mobile ? .29 : .62)
    };
  }

  function project(point) {
    const relative = subtract(point, camera.eye);
    const depth = dot(relative, camera.forward);
    if (depth < .5) return null;
    const scale = camera.focal / depth;
    return {x: camera.x + dot(relative, camera.right) * scale, y: camera.y - dot(relative, camera.up) * scale, depth, scale};
  }

  function polygon(points, fill, stroke = '#bce7d12b') {
    const projected = points.map(project);
    if (projected.some(point => !point)) return;
    ctx.beginPath();
    projected.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = .7;
      ctx.stroke();
    }
  }

  function line(points, color, thickness = 1, glow = 0) {
    const projected = points.map(project);
    if (projected.some(point => !point)) return;
    ctx.save();
    ctx.beginPath();
    projected.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.restore();
  }

  function face(points, color, opacity = 1) {
    const center = [0, 1, 2].map(axis => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
    const normal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
    if (opacity === 1 && dot(normal, subtract(camera.eye, center)) <= 0) return;
    faces.push({points, color, opacity, depth: dot(subtract(center, camera.eye), camera.forward)});
  }

  function box(x, y, z, w, h, d, color, angle = 0) {
    const point = (dx, dy, dz) => [x + dx * Math.cos(angle) - dz * Math.sin(angle), y + dy, z + dx * Math.sin(angle) + dz * Math.cos(angle)];
    const a = point(-w / 2, 0, -d / 2);
    const b = point(w / 2, 0, -d / 2);
    const c = point(w / 2, 0, d / 2);
    const e = point(-w / 2, 0, d / 2);
    const top = p => [p[0], p[1] + h, p[2]];
    face([top(a), top(b), b, a], tint(color, .7));
    face([top(b), top(c), c, b], tint(color, .84));
    face([top(c), top(e), e, c], color);
    face([top(e), top(a), a, e], tint(color, 1.15));
    face([top(e), top(c), top(b), top(a)], tint(color, 1.3));
  }

  function cylinder(x, y, z, radius, h, color, opacity = 1) {
    const rim = [];
    for (let index = 0; index < 24; index++) {
      const a = index / 24 * Math.PI * 2;
      const b = (index + 1) / 24 * Math.PI * 2;
      const bottomA = [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
      const bottomB = [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius];
      const topA = [bottomA[0], y + h, bottomA[2]];
      const topB = [bottomB[0], y + h, bottomB[2]];
      rim.push(topA);
      face([topA, topB, bottomB, bottomA], tint(color, .78 + Math.cos(a - .8) * .24), opacity);
    }
    face(rim.reverse(), tint(color, 1.35), opacity);
  }

  function house(x, z, w, d, h, index) {
    box(x, 0, z, w, h, d, index === 0 ? '#52766b' : '#36574d');
    const leftFront = [x - w / 2 - .3, h, z + d / 2 + .3];
    const rightFront = [x + w / 2 + .3, h, z + d / 2 + .3];
    const leftBack = [leftFront[0], h, z - d / 2 - .3];
    const rightBack = [rightFront[0], h, leftBack[2]];
    const peakFront = [x, h + w * .36, leftFront[2]];
    const peakBack = [x, peakFront[1], leftBack[2]];
    face([leftFront, rightFront, peakFront], '#937b55');
    face([peakBack, rightBack, leftBack], '#726348');
    face([leftFront, peakFront, peakBack, leftBack], index === 0 ? '#d3b679' : '#a28c63');
    face([peakFront, rightFront, rightBack, peakBack], index === 0 ? '#ad8d54' : '#7b6848');
    for (let side = -1; side <= 1; side += 2) {
      face([[x + side * w * .25 - .35, 1.25, z + d / 2 + .01], [x + side * w * .25 + .35, 1.25, z + d / 2 + .01],
        [x + side * w * .25 + .35, 2.05, z + d / 2 + .01], [x + side * w * .25 - .35, 2.05, z + d / 2 + .01]], '#98cbb1');
    }
  }

  function tree(x, z, index) {
    box(x, 0, z, .22, 1.7, .22, '#5c6e51');
    const h = 2.1 + (index % 3) * .45;
    for (let side = 0; side < 6; side++) {
      const a = side / 6 * Math.PI * 2;
      const b = (side + 1) / 6 * Math.PI * 2;
      face([[x, h + 1.1, z], [x + Math.cos(b), 1.2, z + Math.sin(b)], [x + Math.cos(a), 1.2, z + Math.sin(a)]], tint('#417a5d', .8 + side * .08));
    }
  }

  function along(points, fraction) {
    const lengths = points.slice(1).map((point, index) => Math.hypot(...subtract(point, points[index])));
    let distance = fraction * lengths.reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < lengths.length; index++) {
      if (distance <= lengths[index] || index === lengths.length - 1) {
        const t = distance / lengths[index];
        return points[index].map((value, axis) => lerp(value, points[index + 1][axis], t));
      }
      distance -= lengths[index];
    }
  }

  function glowPoint(point, radius, color, opacity = 1) {
    const screen = project(point);
    if (!screen) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.shadowBlur = radius * 5;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function ring(x, z, radius, opacity) {
    const points = Array.from({length: 65}, (_, index) => {
      const angle = index / 64 * Math.PI * 2;
      return [x + Math.cos(angle) * radius, .09, z + Math.sin(angle) * radius];
    });
    ctx.globalAlpha = opacity;
    line(points, '#99e6d0', 1, 5);
    ctx.globalAlpha = 1;
  }

  function label(text, position, dx, dy) {
    if (width < 761) return;
    const point = project(position);
    if (!point || point.x < width * .48 || point.x > width - 90) return;
    ctx.save();
    ctx.strokeStyle = '#bce7d16b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + dx * .7, point.y + dy);
    ctx.lineTo(point.x + dx, point.y + dy);
    ctx.stroke();
    ctx.font = '500 13px "Source Sans 3", sans-serif';
    ctx.textAlign = dx < 0 ? 'right' : 'left';
    ctx.fillStyle = '#d6eee1';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#102e2c';
    ctx.fillText(text, point.x + dx + (dx < 0 ? -7 : 7), point.y + dy + 4);
    ctx.restore();
  }

  function terrain() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#071f20');
    sky.addColorStop(.36, '#285e51');
    sky.addColorStop(.58, '#143f36');
    sky.addColorStop(1, '#081f20');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const halo = ctx.createRadialGradient(width * .78, height * .3, 0, width * .78, height * .3, width * .6);
    halo.addColorStop(0, '#c2dca527');
    halo.addColorStop(.4, '#78b99e12');
    halo.addColorStop(1, '#78b99e00');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    for (let z = -65; z <= 20; z += 4) line([[-60, 0, z], [60, 0, z]], '#8dcaac12', .7);
    for (let x = -60; x <= 60; x += 4) line([[x, 0, -65], [x, 0, 20]], '#8dcaac12', .7);
    const parcels = [[-23, -24, 11, 9], [-16, -10, 12, 10], [3, -25, 12, 8], [7, -10, 15, 9], [-22, 12, 13, 8], [3, 10, 12, 10]];
    parcels.forEach(([x, z, w, d], index) => polygon([[x, .01, z], [x + w, .01, z], [x + w, .01, z + d], [x, .01, z + d]], index % 2 ? '#76ac7820' : '#c4bc7520', '#bce7d11c'));
    line(road, '#90aa8e22', width < 761 ? 10 : 20);
    line(road, '#233e34', width < 761 ? 7 : 14);
    line([[0, .04, 9], [0, .04, -19]], '#90aa8e18', width < 761 ? 8 : 14);
    line([[0, .04, 9], [0, .04, -19]], '#233e34', width < 761 ? 5 : 9);
  }

  function draw() {
    setCamera();
    terrain();
    houses.forEach(([x, z, w, d]) => polygon([[x - w / 2, .02, z - d / 2], [x + w / 2 + 2, .02, z - d / 2 - 2],
      [x + w / 2 + 2, .02, z + d / 2], [x - w / 2, .02, z + d / 2 + 1]], '#061e2438', null));
    faces = [];
    houses.forEach(([x, z, w, d, h], index) => house(x, z, w, d, h, index));
    trees.forEach(([x, z], index) => tree(x, z, index));
    box(2, -.05, .2, 4.3, .2, 4.3, '#3d6656');
    cylinder(2, .15, .2, 1.6, 3.8, '#377e79', .7);
    cylinder(2, .18, .2, 1.48, 2.6 + Math.sin(clock * .7) * .04, '#5dc9c0', .58);
    cylinder(2, 3.95, .2, .95, .14, '#88b8a1');

    const delivery = Math.exp(-Math.pow((progress - 2) / .6, 2));
    const vehiclePosition = along(road, (clock * .018 + .5) % 1);
    const nextPosition = along(road, Math.min(.999, (clock * .018 + .5) % 1 + .005));
    const angle = Math.atan2(nextPosition[2] - vehiclePosition[2], nextPosition[0] - vehiclePosition[0]);
    const [vx, , vz] = vehiclePosition;
    box(vx, .3, vz, 2.5, .35, 1.4, '#618d81', angle);
    box(vx + Math.cos(angle) * 1.7, .3, vz + Math.sin(angle) * 1.7, 1, 1.5, 1.3, '#c5aa67', angle);
    const vehiclePoint = (x, y, z) => [vx + x * Math.cos(angle) - z * Math.sin(angle), y, vz + x * Math.sin(angle) + z * Math.cos(angle)];
    for (let index = 0; index < 16; index++) {
      const a = index / 16 * Math.PI * 2;
      const b = (index + 1) / 16 * Math.PI * 2;
      face([vehiclePoint(-1.2, 1.05 + Math.cos(a) * .6, Math.sin(a) * .6), vehiclePoint(1.2, 1.05 + Math.cos(a) * .6, Math.sin(a) * .6),
        vehiclePoint(1.2, 1.05 + Math.cos(b) * .6, Math.sin(b) * .6), vehiclePoint(-1.2, 1.05 + Math.cos(b) * .6, Math.sin(b) * .6)].reverse(), tint('#9fd6c5', .8 + Math.cos(a) * .2));
    }
    for (const x of [-1.2, 1.2]) {
      const cap = Array.from({length: 16}, (_, index) => {
        const a = index / 16 * Math.PI * 2;
        return vehiclePoint(x, 1.05 + Math.cos(a) * .6, Math.sin(a) * .6);
      });
      face(x > 0 ? cap : cap.reverse(), '#9dc6b7');
    }
    for (const x of [-.85, 1.7]) {
      for (const z of [-.75, .75]) {
        const wheel = Array.from({length: 16}, (_, index) => {
          const a = index / 16 * Math.PI * 2;
          return vehiclePoint(x + Math.cos(a) * .3, .32 + Math.sin(a) * .3, z);
        });
        face(z > 0 ? wheel : wheel.reverse(), '#0b2425');
      }
    }

    const quality = Math.max(0, Math.min(1, (progress - 2.25) / .65));
    if (quality > 0) {
      cylinder(5, 0, 2.5, .8, 2.1, '#c7f3eb', .2 * quality);
      cylinder(5, .03, 2.5, .73, 1.4, '#8cdbdf', .65 * quality);
    }
    faces.sort((a, b) => b.depth - a.depth);
    faces.forEach(item => {
      ctx.globalAlpha = item.opacity;
      polygon(item.points, item.color);
    });
    ctx.globalAlpha = 1;

    line(gutter, '#a3c4b4', width < 761 ? 4 : 7);
    line(gutter, '#56c4c7', width < 761 ? 1.5 : 2.5, 9);
    for (let index = 0; index < 8; index++) glowPoint(along(gutter, (index / 8 + clock * .08) % 1), width < 761 ? 1.2 : 1.8, '#c9ffff');
    ring(2, .2, 2.3, .35);

    const rain = Math.exp(-Math.pow((progress - 1) / .5, 2));
    if (rain > .05) {
      ctx.globalAlpha = rain * .7;
      for (let index = 0; index < 30; index++) {
        const x = -7.5 + (index * .737 % 5);
        const z = -1.8 + (index * 1.37 % 3.5);
        const phase = (clock * .28 + index * .17) % 1;
        const roofHeight = 3.5 + (1 - Math.abs(x + 5) / 3.3) * 2.16;
        const y = roofHeight + (1 - phase) * 5;
        line([[x, y, z], [x, Math.max(roofHeight, y - .65), z]], '#a1dfdd', 1);
        if (phase > .94) glowPoint([x, roofHeight + .02, z], 1.2, '#bcf4e4', rain * (1 - phase) / .06);
      }
      ctx.globalAlpha = 1;
    }
    for (let index = 0; index < 9; index++) glowPoint(along(road, (index / 9 + clock * .035) % 1), width < 761 ? 1.3 : 2, '#e4c777', .22 + delivery * .78);
    ring(14, 5, 3 + (clock * .4 % 2), delivery * .45);
    ring(14, 5, 6, delivery * .25);
    glowPoint([14, .1, 5], 3, '#e7d18b', .35 + delivery * .65);

    if (quality > 0) {
      ctx.globalAlpha = quality;
      line(tap, '#8bb9a5', width < 761 ? 3 : 5);
      line([[5, 2.7, 2.5], [5, 1.4, 2.5]], '#a6eff2', width < 761 ? 1.6 : 2.5, 8);
      for (let index = 0; index < 6; index++) glowPoint([5, 1.4 + (index / 6 + clock * .7) % 1 * 1.3, 2.5], 1.2, '#e4ffff');
      const rim = Array.from({length: 49}, (_, index) => [5 + Math.cos(index / 48 * Math.PI * 2) * .8, 2.1, 2.5 + Math.sin(index / 48 * Math.PI * 2) * .8]);
      line(rim, '#c9f4ef', 1.1);
      ring(5, 2.5, 1.4 + (clock * .3 % .5), .3 * quality);
      ctx.globalAlpha = 1;
    }
    if (progress < 1.6) {
      label('Atap penangkap hujan', [-5, 5.8, 0], -40, -28);
      label('Tandon air', [2, 4, .2], 36, -30);
    } else if (progress < 2.6) label('Jangkauan penyaluran', [14, .2, 5], 32, -38);
    else label('Kenali kondisi air', [5, 2.1, 2.5], 30, -40);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function animate(now) {
    frame = undefined;
    if (!active || document.hidden) return;
    const elapsed = Math.min((now - lastTime) / 1000 || 0, .05);
    lastTime = now;
    if (!motion.matches) clock += elapsed;
    progress = motion.matches ? target : lerp(progress, target, 1 - Math.exp(-elapsed * 7));
    if (Math.abs(progress - target) < .001) progress = target;
    draw();
    if (!motion.matches) frame = requestAnimationFrame(animate);
  }

  function requestFrame() {
    if (active && frame === undefined && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function onResize() {
    resize();
    requestFrame();
  }

  function onVisibility() {
    cancelAnimationFrame(frame);
    frame = undefined;
    lastTime = performance.now();
    requestFrame();
  }

  return {
    setProgress(value) {
      target = Math.max(0, Math.min(3, value));
      requestFrame();
    },
    start() {
      if (active) return;
      active = true;
      progress = 0;
      target = 0;
      resize();
      lastTime = performance.now();
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
      motion.addEventListener('change', onVisibility);
      requestFrame();
    },
    stop() {
      active = false;
      cancelAnimationFrame(frame);
      frame = undefined;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', onVisibility);
    }
  };
}
