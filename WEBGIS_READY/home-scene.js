'use strict';

function createHomeScene(canvas, {qualityOnly = false} = {}) {
  const ctx = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cue = canvas.parentElement.querySelector('.home-scene-cue strong');
  const cameras = qualityOnly ? [
    {eye: [10, 7, 14], focus: [2, 1.6, .3]},
    {eye: [8, 5, 9], focus: [4.4, 1.1, 2.1]},
    {eye: [8, 5.5, 10], focus: [5.4, 1, 2.5]},
    {eye: [7.3, 4.2, 7.6], focus: [5, .9, 2.5]},
    {eye: [9, 6, 11], focus: [4.3, 1.1, 2.1]},
    {eye: [9, 5, 10], focus: [5.6, 1.1, 2.6]}
  ] : [
    {eye: [22, 17, 32], focus: [-1, 1, -1]},
    {eye: [10, 10, 20], focus: [-2, 2, 1]},
    {eye: [9, 8, 15], focus: [1, 2, .4]},
    {eye: [22, 28, 40], focus: [0, 1, 4]},
    {eye: [8, 5, 9], focus: [3.5, 1.5, 1.2]}
  ];
  const road = [[-23, .06, 11], [-13, .06, 7], [-4, .06, 9], [5, .06, 7], [14, .06, 5], [24, .06, 9]];
  const gutter = [[-1.7, 3.55, -2.8], [-1.7, 3.55, 2.8], [-1.1, 3.45, 3.1]];
  const firstFlush = [[-1.1, 3.45, 3.1], [-1.1, .35, 3.1]];
  const deliveryPath = road.slice(0, 4);
  const deliverySite = [5, .1, 7];
  const houses = [
    [-5, 0, 6, 5, 3.5], [-13, -13, 4.5, 4, 2.5], [6, -14, 5, 4, 2.9],
    [16, -5, 4, 4, 2.6], [-16, 5, 4, 3.5, 2.3], [12, 14, 4.5, 4, 2.5], [-3, -25, 4, 4, 2.5]
  ];
  const trees = [[-10, 8], [-18, -5], [12, -19], [20, 13], [-20, 14], [7, -24], [19, -15], [-8, -18]];
  const rainDrops = Array.from({length: 1700}, (_, index) => {
    const random = offset => {
      const value = Math.sin(index * 127.1 + offset * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const x = -44 + random(1) * 88;
    const z = -55 + random(2) * 78;
    let surface = 0;
    for (const [hx, hz, w, d, h] of houses) {
      if (Math.abs(x - hx) <= w / 2 + .3 && Math.abs(z - hz) <= d / 2 + .3) {
        surface = Math.max(surface, h + (1 - Math.abs(x - hx) / (w / 2 + .3)) * w * .36);
      }
    }
    const tankDistance = Math.hypot(x - 2, z - .2);
    if (tankDistance < 1.6) surface = Math.max(surface, tankDistance < 1.16 ? 3.76 : 3.45);
    trees.forEach(([tx, tz], treeIndex) => {
      const distance = Math.hypot(x - tx, z - tz);
      if (distance < 1) surface = Math.max(surface, 1.2 + (1 - distance) * (2 + treeIndex % 3 * .45));
    });
    return {x, z, surface, height: 22 + random(3) * 16, speed: .42 + random(4) * .3, phase: random(5), length: .7 + random(6) * 1.1};
  });
  let active = false;
  let frame;
  let width = 0;
  let height = 0;
  let target = 0;
  let progress = 0;
  let lastTime = 0;
  let clock = 0;
  let chapter = 0;
  let chapterTime = 0;
  let state;
  let camera;
  let faces = [];

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => {const t = clamp(value); return t * t * (3 - 2 * t);};
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

  function blend(a, b, fraction) {
    const first = parseInt(a.slice(1), 16);
    const second = parseInt(b.slice(1), 16);
    const channels = [16, 8, 0].map(shift => Math.round(lerp(first >> shift & 255, second >> shift & 255, fraction)));
    return '#' + channels.map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function sample(values) {
    const index = Math.min(values.length - 2, Math.floor(progress));
    return lerp(values[index], values[index + 1], smooth(progress - index));
  }

  function getState() {
    if (qualityOnly) {
      const observations = ['lid', 'odor', 'color', 'particles', 'purpose', 'record'];
      const cues = ['Periksa sumber air dan tandon', 'Amati bau yang tidak biasa',
        'Bandingkan tampilan warna air', 'Amati partikel dan endapan',
        'Tentukan penggunaan air', 'Tinjau temuan sebelum rekomendasi'];
      return {
        radius: 1.6, tankHeight: 3.3, waterFraction: .72,
        rain: 0, storage: 0, delivery: 0, quality: 1, dryness: 0,
        incoming: 0, diverting: false, firstFlushLevel: 0,
        qualityTime: chapter === 0 ? 1.7 : chapter === 5 ? 20 + (motion.matches ? 3 : chapterTime % 4) : 8,
        observation: observations[chapter], cue: cues[chapter]
      };
    }
    const elapsed = motion.matches ? 12 : chapterTime;
    const storageTime = elapsed % 20;
    let large = 0;
    if (storageTime >= 8 && storageTime < 10) large = smooth((storageTime - 8) / 2);
    else if (storageTime >= 10 && storageTime < 18) large = 1;
    else if (storageTime >= 18) large = 1 - smooth((storageTime - 18) / 2);
    const useTime = storageTime % 10;
    const storageRadius = lerp(1.05, 1.9, large);
    const storageHeight = lerp(2.6, 3.3, large);
    const usedVolume = clamp((useTime - 1.6) / 6.4) * 2.4;
    const storageLevel = Math.max(.09, .85 - usedVolume / (storageRadius ** 2 * storageHeight)) * clamp(useTime / 1.6);
    const harvestLevel = lerp(.1, .96, clamp((elapsed - 4) / 10));
    const deliveryTime = elapsed % 18;
    const returning = deliveryTime >= 12;
    const vehicleFraction = returning ? 1 - smooth((deliveryTime - 12) / 6) : smooth(deliveryTime / 4);
    const qualityTime = elapsed % 24;
    let observation = 'lid';
    if (qualityTime >= 20) observation = 'record';
    else if (qualityTime >= 16) observation = 'odor';
    else if (qualityTime >= 11) observation = 'particles';
    else if (qualityTime >= 6) observation = 'color';
    else if (qualityTime >= 3.5) observation = 'sample';
    const titles = {
      lid: 'Periksa tutup tandon', sample: 'Ambil sampel melalui keran',
      color: 'Amati perubahan warna', particles: 'Amati partikel dalam air',
      odor: 'Catat pengamatan bau', record: 'Catat temuan untuk diperiksa'
    };
    const cues = [
      'Cuaca kering · persediaan menipis',
      elapsed < 4 ? 'Aliran awal masuk ke pengalih' : 'Air berikutnya mengisi tandon',
      `${large > .5 ? 'Tandon lebih besar' : 'Tandon lebih kecil'} · ${useTime < 1.6 ? 'pengisian' : storageLevel * storageHeight < 1.05 ? 'aliran mulai berhenti' : 'pemakaian rumah'}`,
      deliveryTime < 4 ? 'Mobil tangki menuju titik penyaluran'
        : deliveryTime < 9 ? 'Air disalurkan ke tandon'
        : deliveryTime < 12 ? 'Penyaluran selesai · cakupan ke rumah'
        : 'Mobil tangki meninggalkan titik penyaluran',
      titles[observation]
    ];
    return {
      radius: sample([1.6, 1.6, storageRadius, 1.6, 1.6]),
      tankHeight: sample([3.3, 3.3, storageHeight, 3.3, 3.3]),
      waterFraction: sample([.09, harvestLevel, storageLevel, .28 + .5 * clamp((deliveryTime - 4) / 5), .82]),
      rain: Math.exp(-Math.pow((progress - 1) / .4, 2)),
      storage: Math.exp(-Math.pow((progress - 2) / .38, 2)),
      delivery: Math.exp(-Math.pow((progress - 3) / .4, 2)),
      quality: smooth((progress - 3.25) / .65),
      dryness: 1 - smooth(progress / .8),
      incoming: sample([0, elapsed < 4 ? 0 : 1, useTime < 1.6 ? 1 : 0, 0, 0]),
      diverting: chapter === 1 && elapsed < 4,
      firstFlushLevel: chapter === 0 ? 0 : chapter === 1 ? clamp(elapsed / 4) : 1,
      useTime, vehicleFraction, returning, deliveryTime, qualityTime, observation,
      cue: cues[chapter]
    };
  }

  function setCamera() {
    const index = Math.min(cameras.length - 2, Math.floor(progress));
    const fraction = progress - index;
    const ease = fraction * fraction * (3 - 2 * fraction);
    let eye = cameras[index].eye.map((value, axis) => lerp(value, cameras[index + 1].eye[axis], ease));
    let focus = cameras[index].focus.map((value, axis) => lerp(value, cameras[index + 1].focus[axis], ease));
    const lidView = state.quality * (1 - smooth((state.qualityTime - 2.5) / 2));
    eye = eye.map((value, axis) => lerp(value, [6.8, 6.5, 8.3][axis], lidView));
    focus = focus.map((value, axis) => lerp(value, [2, 2.8, .2][axis], lidView));
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

  function cylinder(x, y, z, radius, h, color, opacity = 1, capTop = true) {
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
    if (capTop) face(rim.reverse(), tint(color, 1.35), opacity);
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
    ctx.globalAlpha *= opacity;
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
    ctx.font = '500 13px "Source Sans 3", sans-serif';
    if (dx > 0 && point.x + dx + 7 + ctx.measureText(text).width > width - 24) dx = -Math.abs(dx);
    ctx.strokeStyle = '#bce7d16b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + dx * .7, point.y + dy);
    ctx.lineTo(point.x + dx, point.y + dy);
    ctx.stroke();
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
    sky.addColorStop(.36, blend('#5f5b42', '#285e51', 1 - state.dryness));
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
    if (qualityOnly) return;
    const parcels = [[-23, -24, 11, 9], [-16, -10, 12, 10], [3, -25, 12, 8], [7, -10, 15, 9], [-22, 12, 13, 8], [3, 10, 12, 10]];
    parcels.forEach(([x, z, w, d], index) => polygon([[x, .01, z], [x + w, .01, z], [x + w, .01, z + d], [x, .01, z + d]], blend(index % 2 ? '#a28b5b' : '#baa26c', index % 2 ? '#76ac78' : '#c4bc75', 1 - state.dryness) + '24', '#bce7d11c'));
    line(road, '#90aa8e22', width < 761 ? 10 : 20);
    line(road, '#233e34', width < 761 ? 7 : 14);
    line([[0, .04, 9], [0, .04, -19]], '#90aa8e18', width < 761 ? 8 : 14);
    line([[0, .04, 9], [0, .04, -19]], '#233e34', width < 761 ? 5 : 9);
  }

  function addRain() {
    if (state.rain < .02) return;
    const count = width < 761 ? 720 : Math.min(rainDrops.length, Math.round(width * 1.15));
    for (let index = 0; index < count; index++) {
      const drop = rainDrops[index];
      const phase = (clock * drop.speed + drop.phase) % 1;
      const depth = dot(subtract([drop.x, drop.surface, drop.z], camera.eye), camera.forward);
      const opacity = state.rain * (.3 + .5 * clamp(1 - depth / 85));
      if (phase < .84) {
        const y = drop.surface + (1 - phase / .84) * drop.height;
        const points = [[drop.x, y, drop.z], [drop.x, Math.max(drop.surface, y - drop.length), drop.z]];
        const center = [drop.x, y - drop.length / 2, drop.z];
        faces.push({points, depth: dot(subtract(center, camera.eye), camera.forward), color: '#c8e7e0', opacity, rain: true});
      } else {
        const splash = (phase - .84) / .16;
        const spread = .07 + splash * .25;
        const lift = .03 + Math.sin(splash * Math.PI) * .18;
        for (let jet = 0; jet < 3; jet++) {
          const angle = jet / 3 * Math.PI * 2 + drop.phase * 6;
          const x = drop.x + Math.cos(angle) * spread;
          const z = drop.z + Math.sin(angle) * spread;
          const points = [[x, drop.surface + lift, z], [x, drop.surface + lift + .05, z]];
          faces.push({points, depth, color: '#bcebdd', opacity: opacity * (1 - splash), rain: true});
        }
      }
    }
  }

  function addVehicle(vehiclePosition, angle, opacity) {
    const firstFace = faces.length;
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

    for (let index = firstFace; index < faces.length; index++) faces[index].opacity *= opacity;
    return vehiclePoint;
  }

  function addInfrastructure() {
    const radius = state.radius;
    const h = state.tankHeight;
    const waterHeight = Math.max(.04, h * state.waterFraction);
    box(2, -.05, .2, radius * 2 + .7, .2, radius * 2 + .7, '#3d6656');
    cylinder(2, .15, .2, radius, h, '#377e79', .42, false);
    cylinder(2, .18, .2, radius * .92, waterHeight, '#5dc9c0', .68);
    cylinder(2, h + .15, .2, radius * .64, .18, '#669d8a', .75, false);
    const lift = state.observation === 'lid' ? Math.sin(Math.min(1, state.qualityTime / 3.5) * Math.PI) * .8 * state.quality : 0;
    cylinder(2, h + .33 + lift, .2, radius * .72, .13, '#88b8a1');
    if (!qualityOnly) {
      cylinder(-1.1, .3, 3.1, .23, 2.75, '#7a9e83', .45, false);
      cylinder(-1.1, .31, 3.1, .17, Math.max(.03, 2.6 * state.firstFlushLevel), '#bfa669', .7);
      cylinder(-1.1, .32 + 2.6 * state.firstFlushLevel, 3.1, .12, .15, '#d5e4c2');
    }

    if (state.delivery > .02) {
      cylinder(6.8, .12, 8.5, 1.05, 1.8, '#6d9e91', .38, false);
      const received = .12 + .7 * clamp((state.deliveryTime - 4) / 5);
      cylinder(6.8, .14, 8.5, .96, Math.max(.03, received * 1.8), '#79ccd1', .65 * state.delivery);
    }
    if (state.storage > .02) {
      cylinder(5, .02, 2.5, .67, .7, '#bead79', .55 * state.storage, false);
      cylinder(5, .04, 2.5, .6, .4, '#7fcfd4', .65 * state.storage);
    }
    if (qualityOnly && state.observation === 'purpose') {
      cylinder(5, 0, 2.5, .95, .75, '#659e74', .8, false);
      cylinder(5, .04, 2.5, .85, .44, '#8cdbdf', .7);
      box(6.1, .6, 2.5, 1.25, .12, .23, '#659e74');
    } else if (state.quality > .02 && state.observation !== 'lid') {
      cylinder(5, 0, 2.5, .68, 1.4, '#c7f3eb', .2 * state.quality, false);
      const color = state.observation === 'color' ? '#c9a45d' : state.observation === 'particles' ? '#8b9f96' : '#8cdbdf';
      const fraction = state.observation === 'sample' ? clamp((state.qualityTime - 3.5) / 2.5) : 1;
      cylinder(5, .03, 2.5, .62, Math.max(.03, fraction * .94), color, .65 * state.quality);
      if (qualityOnly && state.observation === 'color') {
        for (const [x, color] of [[3.3, '#8cdbdf'], [6.7, '#95754e']]) {
          cylinder(x, 0, 2.5, .68, 1.4, '#c7f3eb', .2, false);
          cylinder(x, .03, 2.5, .62, .94, color, .65);
        }
      }
    }
    if (state.quality > .02 && state.observation === 'record') {
      box(6.4, .15, 2.8, 1.35, 1.8, .08, '#ccdbbf');
      box(6.4, 1.84, 2.8, .5, .16, .15, '#b7a265');
    }
  }

  function drawCapture() {
    const inlet = [[-1.1, 3.45, 3.1], [.1, 3.2, 3.1], [.1, state.tankHeight - .25, .2], [2 - state.radius, state.tankHeight - .25, .2]];
    line(gutter, '#a3c4b4', width < 761 ? 3 : 5);
    line(firstFlush, '#a3c4b4', width < 761 ? 2.5 : 4);
    line(inlet, '#a3c4b4', width < 761 ? 3 : 5);
    ctx.save();
    ctx.globalAlpha = Math.max(state.rain, state.incoming);
    line(gutter, '#7edbdf', width < 761 ? 1.5 : 2.5, 6);
    for (let index = 0; index < 7; index++) glowPoint(along(gutter, (index / 7 + clock * .1) % 1), width < 761 ? 1 : 1.6, '#d1ffff');
    ctx.restore();
    if (state.diverting) {
      line(firstFlush, '#cbb779', width < 761 ? 1.5 : 2.5, 4);
      for (let index = 0; index < 6; index++) glowPoint(along(firstFlush, (index / 6 + clock * .12) % 1), 1.3, '#e2d4a3');
      label('Aliran awal dialihkan', [-1.1, 1.4, 3.1], -30, 18);
    }
    ctx.save();
    ctx.globalAlpha = state.incoming;
    line(inlet, '#7edbdf', width < 761 ? 1.5 : 2.5, 7);
    for (let index = 0; index < 6; index++) glowPoint(along(inlet, (index / 6 + clock * .08) % 1), width < 761 ? 1 : 1.7, '#d1ffff');
    ctx.restore();
    const rim = Array.from({length: 49}, (_, index) => [2 + Math.cos(index / 48 * Math.PI * 2) * state.radius, state.tankHeight + .15, .2 + Math.sin(index / 48 * Math.PI * 2) * state.radius]);
    line(rim, '#9bdac2a0', 1);
    if (state.rain < .02) return;
    ctx.save();
    ctx.globalAlpha = state.rain * .7;
    for (let index = 0; index < 14; index++) {
      const phase = (clock * .17 + index * .13) % 1;
      const x = -5 + phase * 3.25;
      const z = -2.4 + (index * 1.37 % 4.8);
      const y = 3.5 + (1 - (x + 5) / 3.3) * 2.16;
      line([[x, y + .04, z], [x + .14, y - .05, z]], '#a8e7e5', 1, 3);
    }
    ctx.restore();
    if (state.waterFraction > .92) {
      const overflow = [[2 + state.radius, state.tankHeight - .1, .2], [2 + state.radius + .4, state.tankHeight - .1, .2], [2 + state.radius + .4, .15, .2]];
      line(overflow, '#78aaa1', 3);
      for (let index = 0; index < 6; index++) glowPoint(along(overflow, (index / 6 + clock * .1) % 1), 1.1, '#b1e5e0');
    }
  }

  function drawHouseholdUse() {
    if (state.storage < .02 || state.useTime < 1.6) return;
    const outlet = [[2 + state.radius, .85, .2], [4, .85, .2], [4, 1.05, 2.5], [5, 1.05, 2.5], [5, .45, 2.5]];
    ctx.save();
    ctx.globalAlpha = state.storage;
    line(outlet.slice(0, 4), '#87b09c', width < 761 ? 2.5 : 4);
    if (state.waterFraction * state.tankHeight >= 1.05) {
      line(outlet.slice(3), '#91e4e2', 1.7, 5);
      for (let index = 0; index < 7; index++) glowPoint(along(outlet, (index / 7 + clock * .1) % 1), 1.3, '#c8ffef');
    }
    ctx.restore();
    label('Pemakaian rumah', [5, .7, 2.5], 25, -25);
  }

  function drawDelivery(vehiclePoint) {
    if (!vehiclePoint) return;
    const t = state.deliveryTime;
    ctx.save();
    ctx.globalAlpha = state.delivery;
    for (let index = 0; index < 10; index++) glowPoint(along(deliveryPath, (index / 10 + clock * .025) % 1), 1.5, '#dccb8b', .6);
    glowPoint(deliverySite, 3, '#e9d593');
    if (t >= 4 && t < 12) {
      const hose = [vehiclePoint(0, .8, .7), [6, .5, 8], [6, 1.4, 8.5], [5.85, 1.4, 8.5]];
      line(hose, '#83afa2', width < 761 ? 2.5 : 4);
      if (t < 9) {
        for (let index = 0; index < 8; index++) glowPoint(along(hose, (index / 8 + clock * .1) % 1), 1.4, '#bcefe8');
      }
    }
    // Reveal the coverage only after the receiving tank finishes filling at 9 s.
    // Keep it visible during departure, then fade before the next delivery cycle.
    if (t > 9) {
      const coverage = smooth((t - 9) / 2);
      const coverageOpacity = state.delivery * (1 - smooth((t - 17) / 1));
      const coverageRadius = 21;
      ring(5, 7, coverageRadius * coverage, .4 * coverage * coverageOpacity);
      ctx.globalAlpha = coverage * coverageOpacity;
      line([[-8.2, .1, -2.7], [-1.8, .1, -2.7], [-1.8, .1, 2.7], [-8.2, .1, 2.7], [-8.2, .1, -2.7]], '#dfd09a', 1.8, 8);
      label('Rumah dalam cakupan', [-5, 5.8, 0], -30, -32);
    }
    ctx.restore();
    label('Titik penyaluran', [6.8, 1.9, 8.5], 28, -35);
  }

  function drawObservation() {
    if (state.quality < .02) return;
    const q = state.qualityTime;
    if (state.observation === 'lid') {
      label('Periksa tutup tandon', [2, state.tankHeight + .45, .2], 26, -35);
      return;
    }
    const outlet = [[2 + state.radius, 1.9, .2], [4, 1.9, .2], [4, 1.9, 2.5], [5, 1.9, 2.5]];
    ctx.save();
    ctx.globalAlpha = state.quality;
    line(outlet, '#8bb9a5', width < 761 ? 2.5 : 4);
    if (state.observation === 'purpose') {
      line([[5, 1.9, 2.5], [5, .5, 2.5]], '#a6eff2', 2.4, 6);
      for (let index = 0; index < 7; index++) {
        glowPoint([5, .5 + (index / 7 + clock * .3) % 1 * 1.4, 2.5], 1.3, '#d7fffa');
      }
      ctx.restore();
      return;
    }
    if (state.observation === 'sample') {
      const level = clamp((q - 3.5) / 2.5) * .94;
      line([[5, 1.9, 2.5], [5, level, 2.5]], '#a6eff2', 1.8, 6);
      for (let index = 0; index < 5; index++) glowPoint([5, level + (index / 5 + clock * .4) % 1 * (1.9 - level), 2.5], 1.1, '#d7fffa');
    }
    const rim = Array.from({length: 49}, (_, index) => [5 + Math.cos(index / 48 * Math.PI * 2) * .68, 1.4, 2.5 + Math.sin(index / 48 * Math.PI * 2) * .68]);
    line(rim, '#c9f4ef', 1.1);
    if (state.observation === 'particles') {
      for (let index = 0; index < 25; index++) {
        const a = index * 2.4;
        const radius = .15 + (index * .14 % .4);
        glowPoint([5 + Math.cos(a) * radius, .14 + (index * .173 % .7) + Math.sin(clock + index) * .025, 2.5 + Math.sin(a) * radius], width < 761 ? 1.1 : 1.8, '#927854', .9);
      }
    }
    if (state.observation === 'odor') drawOdorMark();
    if (state.observation === 'record') {
      const count = Math.min(3, 1 + Math.floor((q - 20) / 1.2));
      for (let index = 0; index < 3; index++) {
        const y = 1.5 - index * .45;
        line([[5.98, y, 2.85], [6.16, y, 2.85], [6.16, y - .18, 2.85], [5.98, y - .18, 2.85], [5.98, y, 2.85]], '#577468', 1);
        if (index < count) line([[6.3, y - .08, 2.86], [6.85, y - .08, 2.86]], '#a48a4e', 2.5);
      }
    }
    ctx.restore();
  }

  function drawOdorMark() {
    const cup = project([5, 1.4, 2.5]);
    if (!cup) return;
    const x = cup.x + (width < 761 ? 25 : 42);
    const y = cup.y - 30;
    ctx.save();
    ctx.strokeStyle = '#e3cd95';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 9, y - 20);
    ctx.lineTo(x + 9, y - 9);
    ctx.quadraticCurveTo(x + 5, y - 4, x + 1, y + 2);
    ctx.quadraticCurveTo(x + 1, y + 6, x + 9, y + 5);
    ctx.lineTo(x + 14, y + 11);
    ctx.stroke();
    for (let index = 0; index < 2; index++) {
      const offset = Math.sin(clock * 1.5 + index) * 2;
      ctx.beginPath();
      ctx.moveTo(x - 12 - index * 6, y + 10);
      ctx.bezierCurveTo(x - 20 - index * 6, y + offset, x - index * 6, y - 8, x - 10 - index * 6, y - 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    state = getState();
    setCamera();
    terrain();
    if (cue.textContent !== state.cue) cue.textContent = state.cue;
    if (!qualityOnly) houses.forEach(([x, z, w, d]) => polygon([[x - w / 2, .02, z - d / 2], [x + w / 2 + 2, .02, z - d / 2 - 2],
      [x + w / 2 + 2, .02, z + d / 2], [x - w / 2, .02, z + d / 2 + 1]], '#061e2438', null));
    faces = [];
    if (!qualityOnly) {
      houses.forEach(([x, z, w, d, h], index) => house(x, z, w, d, h, index));
      trees.forEach(([x, z], index) => tree(x, z, index));
    }
    addInfrastructure();
    let vehiclePoint;
    if (state.delivery > .02) {
      const position = along(deliveryPath, state.vehicleFraction);
      const before = along(deliveryPath, clamp(state.vehicleFraction - .005));
      const after = along(deliveryPath, clamp(state.vehicleFraction + .005));
      const angle = Math.atan2(after[2] - before[2], after[0] - before[0]) + (state.returning ? Math.PI : 0);
      vehiclePoint = addVehicle(position, angle, state.delivery);
    }
    addRain();
    faces.sort((a, b) => b.depth - a.depth);
    faces.forEach(item => {
      ctx.globalAlpha = item.opacity;
      if (item.rain) line(item.points, item.color, width < 761 ? .9 : 1.1);
      else polygon(item.points, item.color);
    });
    ctx.globalAlpha = 1;
    if (!qualityOnly) drawCapture();
    drawHouseholdUse();
    drawDelivery(vehiclePoint);
    drawObservation();
    if (!qualityOnly) {
      if (chapter === 0) label('Persediaan menipis', [2, 3.6, .2], 36, -30);
      if (chapter === 1) label('Air mengikuti kemiringan atap', [-3, 4.4, 0], -40, -28);
      if (chapter === 2) label('Kapasitas dan pemakaian rumah', [2, state.tankHeight + .3, .2], 36, -30);
    }
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
    // The first display-frame timestamp can precede initialization in that same frame.
    const elapsed = Math.max(0, Math.min((now - lastTime) / 1000 || 0, .05));
    lastTime = now;
    const nextChapter = Math.round(target);
    if (nextChapter !== chapter) {
      chapter = nextChapter;
      chapterTime = 0;
    }
    if (!motion.matches) {
      clock += elapsed;
      chapterTime += elapsed;
    }
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
      target = Math.max(0, Math.min(cameras.length - 1, value));
      requestFrame();
    },
    start() {
      if (active) return;
      active = true;
      progress = 0;
      target = 0;
      chapter = 0;
      chapterTime = 0;
      clock = 0;
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
