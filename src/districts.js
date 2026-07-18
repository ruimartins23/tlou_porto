// CINZA — districts: ruined Ribeira, largo shops, São Bento station, the Sé,
// Gaia cellars, backdrop hills and landmarks.
import * as THREE from 'three';
import { ruinFacadeTexture, empenaTexture, rand } from './textures.js';

let sharedEmpenaTex = null;
function empenaMaterial(baseColor) {
  if (!sharedEmpenaTex) sharedEmpenaTex = empenaTexture();
  return new THREE.MeshStandardMaterial({
    map: sharedEmpenaTex,
    color: new THREE.Color(baseColor).multiplyScalar(0.62).lerp(new THREE.Color(0xaaa294), 0.55),
    roughness: 0.98,
  });
}

// Ribeira's real palette — ochre, terracotta, river-blue, gold, sage, cream, salmon —
// kept vivid so the row still reads as Porto through the ashen grade.
const RUIN_COLORS = ['#c79a3f', '#b0472e', '#3f6d94', '#d6bd5c', '#6d8a4a', '#cabfa2', '#c26b4e', '#a87d3f', '#8a5a86'];

function signTexture(text, fg = '#c8bd9e', bg = '#241f18', ruined = true) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = fg;
  ctx.font = 'bold 24px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  if (ruined) {
    ctx.fillStyle = 'rgba(30,25,18,0.55)';
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 64, 6 + Math.random() * 30, 3 + Math.random() * 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A ruined Ribeira/Porto townhouse with baked facade, roof damage, ivy.
function ruinHouse(world, x, width, floors, colorIdx, {
  z = 12, faceDir = 1, depth = 11, groundY = 0, azulejo = false, gutted = false,
} = {}) {
  const height = gutted ? floors * 3.1 * 0.45 : floors * 3.1;
  const facadeMat = new THREE.MeshStandardMaterial({
    map: ruinFacadeTexture(RUIN_COLORS[colorIdx % RUIN_COLORS.length], gutted ? 1 : floors, Math.max(2, Math.round(width / 2.6)), azulejo),
    roughness: azulejo ? 0.5 : 0.95,
  });
  const sideCol = empenaMaterial(RUIN_COLORS[colorIdx % RUIN_COLORS.length]);
  const mats = faceDir > 0
    ? [sideCol, sideCol, sideCol, sideCol, facadeMat, sideCol]
    : [sideCol, sideCol, sideCol, sideCol, sideCol, facadeMat];
  const zc = z - faceDir * depth / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats);
  body.position.set(x, groundY + height / 2, zc);
  body.castShadow = true;
  body.receiveShadow = true;
  world.scene.add(body);
  world.solid(x - width / 2, x + width / 2, groundY, groundY + height, zc - depth / 2, zc + depth / 2);
  world.occluders.push(body);

  if (gutted) {
    // burned-out shell: jagged top + rubble spilling forward
    const jag = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 1.6, depth * 0.8), sideCol);
    jag.position.set(x + width * 0.1, groundY + height + 0.5, zc);
    jag.rotation.z = (rand() - 0.5) * 0.3;
    jag.castShadow = true;
    world.scene.add(jag);
    world.rubblePile(x, z + faceDir * 1.6, groundY, Math.min(2.4, width * 0.4), 1.1, 8);
  } else {
    // roof: sloped slabs — sometimes one is collapsed leaving a dark hole
    const slope = 0.5;
    for (const s of [-1, 1]) {
      if (rand() < 0.22) {
        const hole = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.15, depth / 2), world.mats.dark);
        hole.position.set(x, groundY + height + 0.1, zc + s * depth / 4);
        world.scene.add(hole);
        continue;
      }
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.25, depth / 2 + 0.7), world.mats.roof);
      slab.position.set(x, groundY + height + Math.sin(slope) * depth / 4, zc + s * depth / 4);
      slab.rotation.x = -s * slope;
      slab.castShadow = true;
      world.scene.add(slab);
    }
  }
  // ivy climbing the facade
  if (rand() < 0.6) {
    const ix = x + (rand() - 0.5) * width * 0.6;
    const ih = 2 + rand() * (height - 2);
    world.ivyPatch(ix, groundY + ih / 2 + 0.4, z + faceDir * 0.01, 1.6 + rand() * 2, ih, faceDir > 0 ? 0 : Math.PI);
  }
  return body;
}

function ruinRow(world, xStart, xEnd, opts, gapRanges = []) {
  let x = xStart;
  let i = Math.floor(rand() * 8);
  while (x < xEnd) {
    // tall + narrow: real Ribeira frontages are ~4–6.5m wide, 4–6 storeys
    const w = 4 + rand() * 2.6;
    const inGap = gapRanges.some(([g1, g2]) => x + w > g1 && x < g2);
    if (inGap) {
      const g = gapRanges.find(([g1, g2]) => x + w > g1 && x < g2);
      x = g[1] + rand();
      continue;
    }
    if (x + w > xEnd) break;
    ruinHouse(world, x + w / 2, w, 4 + Math.floor(rand() * 3), i, {
      ...opts,
      azulejo: rand() < 0.34,
      gutted: rand() < 0.13,
    });
    x += w + 0.12;
    i++;
  }
}

// ------------------------------------------------------------------ Ribeira (L0)
function buildRibeira(world) {
  const M = world.mats;

  // front row facing the river; gaps: praça (x 0..28) and the shelter ruin (x -58..-46)
  ruinRow(world, -110, 96, { z: 12, faceDir: 1, depth: 11 }, [[0, 28], [-58, -46]]);
  // back row above (visual depth behind front row, sitting on the hillside toe)
  ruinRow(world, -110, 96, { z: -19, faceDir: 1, depth: 10, groundY: 0 }, [[6, 16]]);

  // ---- the shelter: gutted ground floor open to the quay, Rui's hideout
  const sx1 = -58, sx2 = -46;
  const wallMat = M.plaster;
  world.box(0.5, 3.4, 8, wallMat, sx1 + 0.25, 1.7, 8, { occlude: true });
  world.box(0.5, 3.4, 8, wallMat, sx2 - 0.25, 1.7, 8, { occlude: true });
  world.box(sx2 - sx1, 3.4, 0.6, wallMat, (sx1 + sx2) / 2, 1.7, 4.3, { occlude: true });
  const ceil = world.box(sx2 - sx1, 0.5, 8.4, M.woodDark, (sx1 + sx2) / 2, 3.65, 8.2, { solid: false });
  ceil.receiveShadow = true;
  // ruined upper storeys above the shelter
  ruinHouse(world, (sx1 + sx2) / 2, sx2 - sx1, 2, 1, { z: 12.4, faceDir: 1, depth: 8.2, groundY: 3.9 });
  // furnishings
  world.box(2.0, 0.35, 1.1, M.woodDark, -55.5, 0.18, 6.2);       // mattress base
  const mattress = world.box(1.9, 0.22, 1.0, new THREE.MeshStandardMaterial({ color: 0x6a6152, roughness: 1 }), -55.5, 0.46, 6.2, { solid: false });
  mattress.castShadow = false;
  world.box(1.2, 1.4, 0.5, M.wood, -47.5, 0.7, 6);               // shelf
  world.box(0.9, 0.9, 0.9, M.wood, -50, 0.45, 5.2);              // crate
  world.box(0.9, 0.5, 1.4, M.wood, -52.5, 0.25, 10.5);           // bench
  // oil lamp glow
  const lamp = new THREE.PointLight(0xffa050, 14, 15, 1.8);
  lamp.position.set(-53.5, 2.4, 7.4);
  world.scene.add(lamp);
  world.animated.push({ update: (t) => { lamp.intensity = 8 + Math.sin(t * 9.1) * 1.1 + Math.sin(t * 15.7) * 0.7; } });
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: world.emberTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85,
  }));
  flame.scale.set(1.1, 1.1, 1);
  flame.position.set(-52, 2.2, 7);
  world.scene.add(flame);

  // ---- Praça da Ribeira
  // o Cubo (dry fountain)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 16), M.graniteBig);
  basin.position.set(14, 0.35, -4);
  basin.castShadow = true; basin.receiveShadow = true;
  world.scene.add(basin);
  world.solid(11.2, 16.8, 0, 1.0, -6.8, -1.2);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), M.graniteBig);
  cube.position.set(14, 2.1, -4);
  cube.rotation.set(Math.PI / 4, Math.PI / 4, 0);
  cube.castShadow = true;
  world.scene.add(cube);
  world.grassTufts(11, 17, -7, -1, 0, 22);
  // flank houses of the praça
  ruinHouse(world, -3, 6.5, 4, 2, { z: 8, faceDir: 1, depth: 8 });
  ruinHouse(world, 31.5, 7, 4, 5, { z: 8, faceDir: 1, depth: 8, azulejo: true });
  // dead café — broken sign nod to the old days
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: signTexture('CAFÉ DO CAIS') }));
  sign.position.set(31.5, 4.4, 12.06);
  sign.rotation.z = -0.12;
  world.scene.add(sign);

  // quay clutter
  world.carWreck(-20, 20, 0, 0.4);
  world.carWreck(45, 17, 0, -1.2);
  world.rubblePile(70, 20, 0, 3.2, 2.2, 16);
  world.barricade(88, 20, 0, 9, 0.2); // east quay collapse barrier
  world.rubblePile(90, 16, 0, 4, 2.8, 18);
  world.rubblePile(-86, 22, 0, 3, 1.8, 12);
  world.barricade(-90, 18, 0, 8, -0.3);
  world.grassTufts(-100, 90, 12, 29, 0, 260);
  for (let lx = -90; lx <= 90; lx += 24) {
    world.lamp(lx, 26, 0, { broken: rand() < 0.5, light: rand() < 0.35 });
  }
  // derelict rabelo boats
  buildBoats(world);

  world.locations.shelter = new THREE.Vector3(-52, 0, 8);
  world.locations.praca = new THREE.Vector3(14, 0, 0);
  world.locations.saoJoaoFoot = new THREE.Vector3(11, 0, -20);
}

function buildBoats(world) {
  const M = world.mats;
  for (const [bx, bz, rot, sunk] of [[-30, 36, 0.15, 0], [24, 34, -0.1, 0.3], [70, 38, 0.3, 0]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 2.6), M.woodDark);
    hull.castShadow = true;
    boat.add(hull);
    for (const s of [-1, 1]) {
      const bow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 2.2), M.woodDark);
      bow.position.set(s * 5, 0.45, 0);
      bow.rotation.z = s * 0.5;
      boat.add(bow);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6.5, 6), M.wood);
    mast.position.set(0, 3.6, 0);
    mast.rotation.z = sunk ? 0.4 : 0.05;
    boat.add(mast);
    boat.position.set(bx, -2 + 0.5 - sunk, bz);
    boat.rotation.set(sunk * 0.6, rot, sunk * 0.3);
    world.scene.add(boat);
    world.animated.push({
      update: (t) => {
        boat.position.y = -2 + 0.5 - sunk + Math.sin(t * 0.6 + bx) * 0.08;
      },
    });
  }
}

// ------------------------------------------------------------------ Largo (L1)
function buildLargo(world) {
  const M = world.mats;
  // shop rows around the largo
  ruinRow(world, -28, 40, { z: -56.5, faceDir: 1, depth: 9, groundY: 12 }, [[6, 16]]);   // south row (above retaining wall, behind São João mouth)
  ruinRow(world, -28, 40, { z: -89.5, faceDir: -1, depth: 9, groundY: 12 }, [[22, 32]]); // north row with Flores gap
  // São João flanking buildings marching up the slope
  for (let i = 0; i < 4; i++) {
    const gy = 1.5 + i * 3;
    ruinHouse(world, 2, 7, 3, i + 2, { z: -24 - i * 9, faceDir: 1, depth: 8, groundY: gy - 1.5 });
    ruinHouse(world, 20, 7, 3, i + 5, { z: -24 - i * 9, faceDir: 1, depth: 8, groundY: gy - 1.5 });
  }
  // Flores flanking buildings
  for (let i = 0; i < 3; i++) {
    const gy = 13 + i * 3.4;
    ruinHouse(world, 18, 7, 3, i + 1, { z: -94 - i * 9, faceDir: 1, depth: 7, groundY: gy - 1 });
    ruinHouse(world, 36, 7, 3, i + 4, { z: -94 - i * 9, faceDir: 1, depth: 7, groundY: gy - 1 });
  }
  // largo dressing
  world.carWreck(-8, -72, 12, 2.2);
  world.rubblePile(30, -62, 12, 2.6, 1.6, 12);
  world.barricade(-16, -64, 12, 6, 0.9);
  world.grassTufts(-26, 38, -88, -58, 12, 140);
  world.lamp(-2, -70, 12, { broken: true });
  world.lamp(24, -84, 12, { light: true });
  // old pharmacy sign (supply spot flavor)
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: signTexture('FARMÁCIA ★', '#8fae8f') }));
  ph.position.set(-12, 15.2, -56.44);
  world.scene.add(ph);

  world.locations.largo = new THREE.Vector3(5, 12, -72);
  world.locations.pharmacy = new THREE.Vector3(-12, 12, -58.5);
}

// ------------------------------------------------------------------ São Bento (L2)
function buildSaoBento(world) {
  const M = world.mats;
  const X1 = 50, X2 = 90, Z1 = -148, Z2 = -112, FY = 22, H = 12;
  const wall = M.graniteBig;

  // west wall (plaza-facing) with the grand entrance z -134..-126
  world.box(1, H, (-126) - Z1 - 8, wall, X1 + 0.5, FY + H / 2, (Z1 + (-134)) / 2, { occlude: true });
  world.box(1, H, Z2 - (-126), wall, X1 + 0.5, FY + H / 2, ((-126) + Z2) / 2, { occlude: true });
  world.box(1, H - 5, 8, wall, X1 + 0.5, FY + 5 + (H - 5) / 2, -130, { solid: false, occlude: true }); // entrance header
  // north / east walls with interior murals
  const muralN = new THREE.Mesh(new THREE.PlaneGeometry(X2 - X1, H), M.mural);
  muralN.position.set((X1 + X2) / 2, FY + H / 2, Z1 + 1.05);
  world.scene.add(muralN);
  world.box(X2 - X1, H, 1, wall, (X1 + X2) / 2, FY + H / 2, Z1 + 0.5, { occlude: true });
  const muralE = new THREE.Mesh(new THREE.PlaneGeometry(Z2 - Z1, H), M.mural);
  muralE.rotation.y = -Math.PI / 2;
  muralE.position.set(X2 - 1.05, FY + H / 2, (Z1 + Z2) / 2);
  world.scene.add(muralE);
  world.box(1, H, Z2 - Z1, wall, X2 - 0.5, FY + H / 2, (Z1 + Z2) / 2, { occlude: true });
  // south wall with exit to the alley x 60..70
  world.box(60 - X1, H, 1, wall, (X1 + 60) / 2, FY + H / 2, Z2 - 0.5, { occlude: true });
  world.box(X2 - 70, H, 1, wall, (70 + X2) / 2, FY + H / 2, Z2 - 0.5, { occlude: true });
  world.box(10, H - 4.2, 1, wall, 65, FY + 4.2 + (H - 4.2) / 2, Z2 - 0.5, { solid: false, occlude: true });
  // ceiling + roof
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X2 - X1, Z2 - Z1),
    new THREE.MeshStandardMaterial({ color: 0x1c1a17, side: THREE.DoubleSide, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((X1 + X2) / 2, FY + H, (Z1 + Z2) / 2);
  world.scene.add(ceil);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(X2 - X1 + 2, 0.4, (Z2 - Z1) / 2 + 1.5), M.roof);
    slab.position.set((X1 + X2) / 2, FY + H + 2.2, (Z1 + Z2) / 2 + s * (Z2 - Z1) / 4);
    slab.rotation.x = -s * 0.3;
    slab.castShadow = true;
    world.scene.add(slab);
  }
  // clock gable + sign over the entrance
  world.box(6, 4, 1, wall, X1 + 0.5, FY + H + 1.6, -130, { solid: false });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.6 }));
  clock.rotation.y = -Math.PI / 2;
  clock.position.set(X1 - 0.02, FY + H + 1.6, -130);
  world.scene.add(clock);
  const sbSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), new THREE.MeshBasicMaterial({ map: signTexture('SÃO BENTO', '#d8cfae', '#332e26', false) }));
  sbSign.rotation.y = -Math.PI / 2;
  sbSign.position.set(X1 - 0.02, FY + 6.4, -130);
  world.scene.add(sbSign);

  // interior floor finish
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X2 - X1 - 2, Z2 - Z1 - 2), M.stoneFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((X1 + X2) / 2, FY + 0.02, (Z1 + Z2) / 2);
  floor.receiveShadow = true;
  world.scene.add(floor);
  world.walkables.push(floor);

  // interior dressing: benches, ticket booth, luggage, rubble
  for (const bz of [-142, -136, -124, -118]) {
    world.box(4.4, 0.5, 0.7, M.woodDark, 66, FY + 0.5, bz, { occlude: false });
    world.box(4.4, 0.9, 0.15, M.woodDark, 66, FY + 1.1, bz - 0.35, { solid: false });
  }
  world.box(6, 3.2, 2.4, M.woodDark, 84, FY + 1.6, -142, { occlude: true }); // ticket booth
  world.box(2.2, 1.1, 1.4, M.wood, 57, FY + 0.55, -140);                     // luggage carts
  world.box(1.6, 0.8, 1.1, M.wood, 74, FY + 0.4, -132);
  world.rubblePile(56, -120, FY, 2.4, 1.5, 12);
  world.rubblePile(80, -126, FY, 2.8, 1.7, 12);

  // spore nest growths: pale fungal shelves + faint teal glow
  const fungal = new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.7, emissive: 0x2a2410, emissiveIntensity: 0.4 });
  for (const [fx, fz, fs] of [[62, -146, 1.6], [76, -145, 2.2], [88.5, -134, 1.8], [70, -113.5, 1.4], [52, -128, 1.5]]) {
    for (let b = 0; b < 5; b++) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.3 + rand() * fs * 0.35, 8, 6), fungal);
      blob.position.set(fx + (rand() - 0.5) * fs, FY + 0.2 + rand() * 2.4, fz + (rand() - 0.5) * 1.2);
      blob.scale.y = 0.55;
      blob.castShadow = true;
      world.scene.add(blob);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: world.glowTex, color: 0x9ab87a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.28,
    }));
    glow.scale.set(3.4, 3.4, 1);
    glow.position.set(fx, FY + 1.4, fz);
    world.scene.add(glow);
  }

  // light shafts through the broken roof + dim interior lights
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffe6b8, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const [sx, sz, r] of [[64, -128, 2.2], [80, -138, 1.6]]) {
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(r, H + 1, 12, 1, true), shaftMat);
    shaft.position.set(sx, FY + (H + 1) / 2, sz);
    world.scene.add(shaft);
    const pool = new THREE.PointLight(0xffe0a8, 14, 16, 2);
    pool.position.set(sx, FY + 3, sz);
    world.scene.add(pool);
  }

  world.locations.stationDoor = new THREE.Vector3(48, 22, -130);
  world.locations.stationHall = new THREE.Vector3(68, 22, -130);
  world.locations.stationExit = new THREE.Vector3(65, 22, -114);

  // plaza dressing
  world.carWreck(20, -134, 22, 0.9);
  world.carWreck(4, -122, 22, -0.5);
  world.rubblePile(-10, -140, 22, 3, 2, 14);
  world.grassTufts(-18, 46, -150, -110, 22, 130);
  world.lamp(30, -140, 22, { light: true });
  world.lamp(-6, -128, 22, { broken: true });
  // plaza west row
  ruinRow(world, -20, 46, { z: -151.5, faceDir: 1, depth: 8, groundY: 22 });
  world.locations.plaza = new THREE.Vector3(24, 22, -132);
}

// ------------------------------------------------------------------ Sé (L3)
function buildSe(world) {
  const M = world.mats;
  const add = (m) => { world.scene.add(m); return m; };
  const lead = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.55, metalness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x8a7434, roughness: 0.5, metalness: 0.5 });

  // battlement merlons ringing a rectangle top (the Sé's fortress crown)
  const crenellate = (cx, cz, hx, hz, y, step = 1.5, mh = 1.1) => {
    const mk = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, mh, d), M.granite);
      m.position.set(x, y + mh / 2, z); m.castShadow = true; add(m);
    };
    for (let x = cx - hx; x <= cx + hx + 0.01; x += step) { mk(step * 0.62, 0.7, x, cz - hz); mk(step * 0.62, 0.7, x, cz + hz); }
    for (let z = cz - hz; z <= cz + hz + 0.01; z += step) { mk(0.7, step * 0.62, cx - hx, z); mk(0.7, step * 0.62, cx + hx, z); }
  };

  // Baroque cupola atop a bell tower: octagonal drum, lead dome, lantern, finial cross
  const cupola = (x, y, z) => {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.7, 3, 8), M.granite);
    drum.position.set(x, y + 1.5, z); drum.castShadow = true; add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), lead);
    dome.position.set(x, y + 3, z); dome.castShadow = true; add(dome);
    const lant = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 2.2, 8), M.granite);
    lant.position.set(x, y + 5.6, z); add(lant);
    const ldome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lead);
    ldome.position.set(x, y + 6.7, z); add(ldome);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), gold);
    ball.position.set(x, y + 7.5, z); add(ball);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), lead);
    rod.position.set(x, y + 8.4, z); add(rod);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.12), lead);
    arm.position.set(x, y + 8.5, z); add(arm);
  };

  // Romanesque wheel/rose window on the west front (faces -x)
  const roseWindow = (xf, y, z, R = 2.7) => {
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R - 0.15, 28), new THREE.MeshStandardMaterial({
      color: 0x24304a, roughness: 0.3, emissive: 0x0e1526, emissiveIntensity: 0.6,
    }));
    glass.rotation.y = -Math.PI / 2; glass.position.set(xf + 0.02, y, z); add(glass);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 8, 28), M.granite);
    ring.rotation.y = Math.PI / 2; ring.position.set(xf + 0.06, y, z); ring.castShadow = true; add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), M.granite);
    hub.rotation.z = Math.PI / 2; hub.position.set(xf + 0.08, y, z); add(hub);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, R - 0.4, 0.18), M.granite);
      spoke.position.set(xf + 0.06, y + Math.cos(a) * (R / 2), z + Math.sin(a) * (R / 2));
      spoke.rotation.x = -a; add(spoke);
    }
  };

  // ---- the cathedral, fortress-like granite, facing west (-x)
  const WF = 82;          // west facade plane
  world.box(24, 20, 34, M.graniteBig, 102, 28 + 10, -60, { occlude: true });   // nave (taller)
  crenellate(102, -60, 11.5, 16.5, 28 + 20);                                    // nave battlements
  // steep roof ridge over the nave
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 34), M.roof);
  ridge.position.set(102, 28 + 21.5, -60); add(ridge);

  world.box(9, 20, 15, M.graniteBig, 86.5, 28 + 10, -60, { occlude: true });    // west front block
  crenellate(86.5, -60, 4, 7, 28 + 20);
  roseWindow(WF, 28 + 12.5, -60);

  for (const tz of [-73, -47]) {                                                 // twin bell towers
    world.box(9.5, 30, 9.5, M.graniteBig, 85.5, 28 + 15, tz, { occlude: true });
    // belfry openings (dark tall arches near the top, on the west face)
    for (const oz of [-1.8, 1.8]) {
      const bell = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), M.dark);
      bell.rotation.y = -Math.PI / 2; bell.position.set(80.7, 28 + 24, tz + oz); add(bell);
    }
    crenellate(85.5, tz, 4.4, 4.4, 28 + 30);
    cupola(85.5, 28 + 30.5, tz);
  }

  // Nasoni-style portico over the west portal: two columns + arch entablature
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6), M.dark);
  portal.rotation.y = -Math.PI / 2; portal.position.set(WF + 0.03, 28 + 3, -60); add(portal);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.4, 6, 12, Math.PI), M.granite);
  arch.rotation.y = Math.PI / 2; arch.position.set(WF + 0.05, 28 + 6, -60); add(arch);
  for (const cz of [-62.4, -57.6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 6.2, 10), M.granite);
    col.position.set(WF - 1.4, 28 + 3.1, cz); col.castShadow = true; add(col);
    world.solid(WF - 1.9, WF - 0.9, 28, 28 + 6.2, cz - 0.5, cz + 0.5);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.3), M.granite);
    cap.position.set(WF - 1.4, 28 + 6.4, cz); add(cap);
  }
  const entab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 6.6), M.granite);
  entab.position.set(WF - 1.4, 28 + 6.9, -60); entab.castShadow = true; add(entab);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 8), M.granite);
  steps.position.set(WF - 2.6, 28 + 0.3, -60); add(steps);

  // pelourinho — the Manueline twisted column on the terrace
  const twist = new THREE.CylinderGeometry(0.26, 0.34, 5.4, 8, 6);
  const tp = twist.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const yy = tp.getY(i), ang = yy * 0.9;
    const cx = tp.getX(i), cz = tp.getZ(i);
    tp.setX(i, cx * Math.cos(ang) - cz * Math.sin(ang));
    tp.setZ(i, cx * Math.sin(ang) + cz * Math.cos(ang));
  }
  twist.computeVertexNormals();
  const pel = new THREE.Mesh(twist, M.granite);
  pel.position.set(66, 28 + 2.7, -44); pel.castShadow = true; add(pel);
  world.solid(65.5, 66.5, 28, 33.5, -44.5, -43.5);
  const pelCap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 8), M.granite);
  pelCap.position.set(66, 28 + 5.9, -44); add(pelCap);

  // terrace dressing: scavenger camp remains
  world.barricade(60, -60, 28, 7, 1.2);
  world.barricade(74, -36, 28, 6, -0.4);
  world.carWreck(62, -74, 28, 1.9);
  world.rubblePile(92, -34, 28, 2.6, 1.6, 10);
  world.grassTufts(56, 94, -84, -30, 28, 120);
  // campfire (lit — the Corvos were just here)
  const fire = new THREE.PointLight(0xff8038, 16, 14, 1.8);
  fire.position.set(70, 29.1, -56);
  world.scene.add(fire);
  world.animated.push({ update: (t) => { fire.intensity = 14 + Math.sin(t * 11) * 2.5 + Math.sin(t * 23) * 1.5; } });
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: world.emberTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
  }));
  fireGlow.scale.set(2, 2, 1);
  fireGlow.position.set(70, 28.7, -56);
  world.scene.add(fireGlow);
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), M.woodDark);
    log.position.set(70 + (rand() - 0.5), 28.15, -56 + (rand() - 0.5));
    log.rotation.set(Math.PI / 2, 0, rand() * Math.PI);
    world.scene.add(log);
  }
  world.solid(69, 71, 28, 28.6, -57, -55);

  // muralha fernandina: crenellated wall along the terrace's south rim, east of the stairs
  for (let wx = 108; wx <= 116; wx += 2.1) {
    world.box(1.8, 1.8, 0.9, M.granite, wx, 29.6, -28.2, { solid: false });
  }

  world.locations.seTerrace = new THREE.Vector3(75, 28, -56);
  world.locations.campfire = new THREE.Vector3(70, 28, -56);
  world.locations.codecalTop = new THREE.Vector3(102, 28, -32);
}

// ------------------------------------------------------------------ Gaia
function buildGaia(world) {
  const M = world.mats;
  const X1 = 40, X2 = 85, Z1 = 122, Z2 = 146, H = 8;
  const wall = M.plaster;
  // cellar lodge with door on the north wall x 58..62
  world.box(58 - X1, H, 0.8, wall, (X1 + 58) / 2, H / 2, Z1, { occlude: true });
  world.box(X2 - 62, H, 0.8, wall, (62 + X2) / 2, H / 2, Z1, { occlude: true });
  world.box(4, H - 3.2, 0.8, wall, 60, 3.2 + (H - 3.2) / 2, Z1, { solid: false, occlude: true });
  world.box(0.8, H, Z2 - Z1, wall, X1, H / 2, (Z1 + Z2) / 2, { occlude: true });
  world.box(0.8, H, Z2 - Z1, wall, X2, H / 2, (Z1 + Z2) / 2, { occlude: true });
  world.box(X2 - X1, H, 0.8, wall, (X1 + X2) / 2, H / 2, Z2, { occlude: true });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X2 - X1, Z2 - Z1),
    new THREE.MeshStandardMaterial({ color: 0x18150f, side: THREE.DoubleSide, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((X1 + X2) / 2, H, (Z1 + Z2) / 2);
  world.scene.add(ceil);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(X2 - X1 + 1.5, 0.35, (Z2 - Z1) / 2 + 1.2), M.roof);
    slab.position.set((X1 + X2) / 2, H + 1.6, (Z1 + Z2) / 2 + s * (Z2 - Z1) / 4);
    slab.rotation.x = -s * 0.28;
    slab.castShadow = true;
    world.scene.add(slab);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.7), new THREE.MeshBasicMaterial({ map: signTexture('CAVES  DO  DOURO', '#d8c9a0', '#4a2018', false) }));
  sign.position.set(70, 5.9, Z1 - 0.06);
  sign.rotation.y = Math.PI;
  world.scene.add(sign);

  // wooden doors ajar
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.1, 0.12), M.woodDark);
  door.position.set(58.6, 1.55, 122.5);
  door.rotation.y = 0.6;
  door.castShadow = true;
  world.scene.add(door);

  // interior: barrel racks, candlelight, the doctors' camp at the back
  const rackMat = M.woodDark;
  for (const rz of [128, 134, 140]) {
    for (const rx of [46, 54, 70, 78]) {
      if (rz === 134 && (rx === 54 || rx === 70)) continue; // center aisle
      world.box(6, 0.5, 2.2, rackMat, rx, 0.25, rz, { occlude: true });
      for (let b = 0; b < 3; b++) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 10), M.wood);
        barrel.position.set(rx - 1.8 + b * 1.8, 1.05, rz);
        barrel.rotation.z = Math.PI / 2;
        barrel.castShadow = true;
        world.scene.add(barrel);
      }
      world.solid(rx - 3, rx + 3, 0, 1.8, rz - 1.1, rz + 1.1);
      if (rand() < 0.6) {
        const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 10), M.wood);
        barrel2.position.set(rx - 0.9 + rand() * 1.8, 2.1, rz);
        barrel2.rotation.z = Math.PI / 2;
        barrel2.castShadow = true;
        world.scene.add(barrel2);
      }
    }
  }
  // doctors' corner: table, cots, medical crates
  world.box(3, 0.9, 1.4, M.wood, 62, 0.45, 143);
  world.box(2, 0.3, 0.9, M.woodDark, 68, 0.15, 142.5);
  world.box(2, 0.3, 0.9, M.woodDark, 71, 0.15, 143.5);
  world.box(1, 1, 1, M.wood, 58, 0.5, 143.5);
  // candles + lanterns
  for (const [cx, cz] of [[62, 141.5], [58, 132], [74, 137], [66, 126]]) {
    const pl = new THREE.PointLight(0xffa050, 8, 11, 2);
    pl.position.set(cx, 2, cz);
    world.scene.add(pl);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({
      map: world.emberTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7,
    }));
    fl.scale.set(0.8, 0.8, 1);
    fl.position.set(cx, 2, cz);
    world.scene.add(fl);
    world.animated.push({ update: (t) => { pl.intensity = 7.5 + Math.sin(t * 12 + cx) * 1.1; } });
  }

  // Gaia bank dressing
  world.rubblePile(20, 110, 0, 3, 2, 14);
  world.carWreck(96, 112, 0, 0.2);
  world.grassTufts(-40, 130, 102, 146, 0, 200);
  world.lamp(100, 106, 0, { broken: true });
  world.lamp(50, 110, 0, { light: true });
  ruinRow(world, -56, 36, { z: 122.5, faceDir: -1, depth: 9, groundY: 0 });
  ruinRow(world, 90, 136, { z: 122.5, faceDir: -1, depth: 9, groundY: 0 });

  world.locations.gaiaRamp = new THREE.Vector3(116, 0, 118);
  world.locations.cavesDoor = new THREE.Vector3(60, 0, 120);
  world.locations.amelia = new THREE.Vector3(63, 0, 141);
}

// ------------------------------------------------------------------ backdrop
function buildBackdrop(world) {
  const M = world.mats;
  // north hillside city rising behind everything
  const hill = new THREE.Mesh(new THREE.PlaneGeometry(520, 160, 1, 1), M.hillside);
  hill.rotation.x = -Math.PI / 2 + 0.3;
  hill.position.set(0, 42, -225);
  world.scene.add(hill);
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({ roughness: 0.98 }), 220);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let k = 0; k < 220; k++) {
    const hx = -230 + rand() * 460;
    const hz = -158 - rand() * 120;
    const ground = (-hz - 158) * 0.30 + 22;
    const hh = 5 + rand() * 9;
    dummy.position.set(hx, ground + hh / 2, hz);
    dummy.scale.set(4 + rand() * 6, hh, 5 + rand() * 5);
    dummy.rotation.y = (rand() - 0.5) * 0.4;
    dummy.updateMatrix();
    inst.setMatrixAt(k, dummy.matrix);
    col.set(RUIN_COLORS[Math.floor(rand() * RUIN_COLORS.length)]).multiplyScalar(0.45 + rand() * 0.35);
    inst.setColorAt(k, col);
  }
  inst.instanceMatrix.needsUpdate = true;
  world.scene.add(inst);

  // Torre dos Clérigos on the west skyline
  const tx = -95, tz = -195;
  const base = (195 - 158) * 0.30 + 22;
  for (let s = 0; s < 5; s++) {
    const w = 7 - s * 0.9;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 11, w), M.graniteBig);
    seg.position.set(tx, base + 5.5 + s * 11, tz);
    world.scene.add(seg);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.8, w + 1.2), M.graniteBig);
    cornice.position.set(tx, base + 11 + s * 11, tz);
    world.scene.add(cornice);
  }
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.1, 6, 8), M.graniteBig);
  lantern.position.set(tx, base + 58, tz);
  world.scene.add(lantern);

  // Serra do Pilar monastery on its bluff above the bridge's south end (Gaia)
  const bluff = new THREE.Mesh(new THREE.BoxGeometry(46, 30, 44), M.hillside);
  bluff.position.set(160, 13, 118);
  world.scene.add(bluff);
  const rot = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 12, 20), M.graniteBig);
  rot.position.set(158, 34, 112);
  world.scene.add(rot);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a4f38, roughness: 0.8 }));
  dome.position.set(158, 40, 112);
  world.scene.add(dome);

  // Gaia hillside behind the caves
  const gHill = new THREE.Mesh(new THREE.PlaneGeometry(520, 120, 1, 1), M.hillside);
  gHill.rotation.x = -Math.PI / 2 - 0.24;
  gHill.position.set(0, 12, 210);
  world.scene.add(gHill);
  const gInst = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({ roughness: 0.98 }), 120);
  for (let k = 0; k < 120; k++) {
    const hx = -200 + rand() * 400;
    const hz = 154 + rand() * 90;
    const ground = (hz - 154) * 0.24;
    const hh = 4 + rand() * 8;
    dummy.position.set(hx, ground + hh / 2, hz);
    dummy.scale.set(4 + rand() * 6, hh, 5 + rand() * 4);
    dummy.rotation.y = (rand() - 0.5) * 0.4;
    dummy.updateMatrix();
    gInst.setMatrixAt(k, dummy.matrix);
    col.set(RUIN_COLORS[Math.floor(rand() * RUIN_COLORS.length)]).multiplyScalar(0.4 + rand() * 0.3);
    gInst.setColorAt(k, col);
  }
  gInst.instanceMatrix.needsUpdate = true;
  world.scene.add(gInst);

  // crows circling the towers
  const crows = [];
  const bodyGeo = new THREE.ConeGeometry(0.1, 0.55, 5);
  const wingGeo = new THREE.BoxGeometry(0.95, 0.03, 0.2);
  const crowMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  for (let g = 0; g < 8; g++) {
    const crow = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, crowMat);
    body.rotation.x = Math.PI / 2;
    crow.add(body);
    const wings = new THREE.Mesh(wingGeo, crowMat);
    crow.add(wings);
    world.scene.add(crow);
    crows.push({
      crow, wings,
      cx: -40 + rand() * 160, cz: -80 + rand() * 140,
      r: 10 + rand() * 20, h: 30 + rand() * 22,
      speed: 0.2 + rand() * 0.25, phase: rand() * Math.PI * 2,
    });
  }
  world.animated.push({
    update: (t) => {
      for (const b of crows) {
        const a = t * b.speed + b.phase;
        b.crow.position.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.phase) * 2, b.cz + Math.sin(a) * b.r);
        b.crow.rotation.y = -a - Math.PI / 2;
        b.wings.rotation.z = Math.sin(t * 6 + b.phase) * 0.5;
      }
    },
  });
}

export function buildDistricts(world) {
  buildRibeira(world);
  buildLargo(world);
  buildSaoBento(world);
  buildSe(world);
  buildGaia(world);
  buildBackdrop(world);
}
