// CINZA — world core: terrain, sky, water, bridge, shared helpers.
//
// Vertical Porto, compressed but geographically honest (meters):
//   L0  y=0   Cais da Ribeira + Praça da Ribeira          z in [-20, 30]
//   —   ramp  Rua de São João (x 6..16)                   z -58 → -18, y 0 → 12
//   L1  y=12  Largo de São Domingos                       z in [-90, -56]
//   —   ramp  Rua das Flores (x 22..32)                   z -118 → -88, y 12 → 22
//   L2  y=22  Praça Almeida Garrett + São Bento station   z in [-152, -112]
//   —   ramp  alley (x 60..70)                            z -112 → -84, y 22 → 28
//   L3  y=28  Terreiro da Sé                              z in [-84, -28]
//   —   Escadas do Codeçal: two flights + landing down to the bridge (y 6)
//   Bridge deck y=6, x 108..124, z 12..104 over the Douro (water y=-2, z 30..100)
//   Gaia bank y=0, z in [100, 148]
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  mossyCobbleTexture, cobbleBumpTexture, graniteTexture, roofTexture,
  woodTexture, stoneFloorTexture, azulejoMuralTexture, ivyTexture,
  azulejoTexture, grassBladeTexture, metalTexture, rand, resetSeed
} from './textures.js';

export const WATER_Y = -2;

function glowSpriteTexture(rCol = 255, gCol = 200, bCol = 120) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, `rgba(${rCol},${gCol},${bCol},0.9)`);
  g.addColorStop(0.4, `rgba(${rCol},${gCol},${bCol},0.32)`);
  g.addColorStop(1, `rgba(${rCol},${gCol},${bCol},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    resetSeed(20260717);
    this.scene = scene;
    this.solids = [];
    this.walkables = [];
    this.occluders = [];
    this.animated = [];
    this.locations = {};
    // Perf: every extra visible point light costs CPU (light uniforms are re-uploaded
    // per material per frame). We register them all and keep only the nearest few live.
    this.cullableLights = [];
    this.maxLiveLights = 5;
    this._lightTmp = new THREE.Vector3();
    // shared geometry/material caches — cuts thousands of unique GPU objects
    this._geoCache = new Map();
    this._matCache = new Map();
    this.glowTex = glowSpriteTexture();
    this.emberTex = glowSpriteTexture(255, 150, 70);
    this.ivyTex = ivyTexture();
    this.downRay = new THREE.Raycaster();
    this.downRay.far = 80;

    const cobble = mossyCobbleTexture(26, 8);
    const cobbleBump = cobbleBumpTexture(26, 8);
    this.mats = {
      cobble: new THREE.MeshStandardMaterial({ map: cobble, bumpMap: cobbleBump, bumpScale: 3, roughness: 0.95 }),
      cobbleSmall: new THREE.MeshStandardMaterial({ map: mossyCobbleTexture(10, 10), bumpMap: cobbleBumpTexture(10, 10), bumpScale: 3, roughness: 0.95 }),
      cobbleStreet: new THREE.MeshStandardMaterial({ map: mossyCobbleTexture(1, 1), bumpMap: cobbleBumpTexture(1, 1), bumpScale: 3, roughness: 0.95 }),
      granite: new THREE.MeshStandardMaterial({ map: graniteTexture(), roughness: 0.9 }),
      graniteBig: new THREE.MeshStandardMaterial({ map: graniteTexture(8, 6), roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTexture('#5d452c'), roughness: 0.9 }),
      woodDark: new THREE.MeshStandardMaterial({ map: woodTexture('#3c2f1e'), roughness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.6, metalness: 0.7 }),
      rust: new THREE.MeshStandardMaterial({ color: 0x5e4030, roughness: 0.85, metalness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x181614, roughness: 0.95 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0x9a9284, roughness: 0.95 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x2e4224, roughness: 1 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x4d5c33, roughness: 1 }),
      stoneFloor: new THREE.MeshStandardMaterial({ map: stoneFloorTexture(), roughness: 0.9 }),
      mural: new THREE.MeshStandardMaterial({ map: azulejoMuralTexture(), roughness: 0.4 }),
      azulejo: new THREE.MeshStandardMaterial({ map: azulejoTexture(3, 3), roughness: 0.4 }),
      hillside: new THREE.MeshStandardMaterial({ color: 0x46423a, roughness: 1 }),
      rubbleRock: new THREE.MeshStandardMaterial({ map: graniteTexture(2, 2), roughness: 1 }),
      metal: new THREE.MeshStandardMaterial({ map: metalTexture(6, 2), roughness: 0.62, metalness: 0.55 }),
      metalWide: new THREE.MeshStandardMaterial({ map: metalTexture(14, 3), roughness: 0.62, metalness: 0.55 }),
    };

    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    this.buildBridge();
    this.buildAsh();
  }

  // ------------------------------------------------------------- helpers
  solid(x1, x2, y1, y2, z1, z2) {
    this.solids.push({ x1, x2, y1, y2, z1, z2 });
  }

  // One shared unit cube, scaled per instance — instead of a fresh BoxGeometry each time.
  unitBox() {
    if (!this._unitBox) this._unitBox = new THREE.BoxGeometry(1, 1, 1);
    return this._unitBox;
  }

  // Cached material factory: identical params return the very same material, so Three.js
  // uploads its light uniforms once per frame instead of once per copy.
  mat(key, make) {
    let m = this._matCache.get(key);
    if (!m) { m = make(); this._matCache.set(key, m); }
    return m;
  }

  // A point light that only goes live when the camera is near enough to see its pool.
  addCullableLight(light, priority = 0) {
    light.userData.cullRadius = (light.distance || 15) + 14;
    light.userData.priority = priority;
    this.cullableLights.push(light);
    return light;
  }

  removeCullableLight(light) {
    const i = this.cullableLights.indexOf(light);
    if (i >= 0) this.cullableLights.splice(i, 1);
  }

  // Keep only the nearest few lights visible — the rest contribute nothing on screen but
  // would still cost full per-material uniform uploads every frame.
  updateLights(camPos) {
    const list = this.cullableLights;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      l.getWorldPosition(this._lightTmp);
      const d = this._lightTmp.distanceTo(camPos);
      l.userData._d = d - l.userData.priority * 40;   // priority pulls a light forward
      l.visible = d < l.userData.cullRadius;
    }
    // of those in range, keep the closest maxLiveLights
    const live = list.filter((l) => l.visible);
    if (live.length > this.maxLiveLights) {
      live.sort((a, b) => a.userData._d - b.userData._d);
      for (let i = this.maxLiveLights; i < live.length; i++) live[i].visible = false;
    }
  }

  // Tight, player-following shadow frustum: sharper shadows AND the shadow pass frustum-culls
  // the whole distant city instead of redrawing it every frame.
  updateShadowCamera(focus) {
    const sun = this.sun;
    if (!sun) return;
    const R = 48;
    // slide the rig along the *original* sun direction so the angle is bit-for-bit unchanged
    sun.target.position.set(focus.x, focus.y - 1.2, focus.z);
    sun.position.copy(sun.target.position).addScaledVector(this.sunDir, -this.sunDist);
    const cam = sun.shadow.camera;
    if (cam.left !== -R) {
      cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
      cam.near = 1; cam.far = this.sunDist + 120;
      cam.updateProjectionMatrix();
    }
  }

  box(w, h, d, mat, x, y, z, { shadow = true, solid = true, occlude = false } = {}) {
    const m = new THREE.Mesh(this.unitBox(), mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    this.scene.add(m);
    if (solid) this.solid(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2);
    if (occlude) this.occluders.push(m);
    return m;
  }

  // Walkable quad, corner heights hA(x1,z1) hB(x2,z1) hC(x2,z2) hD(x1,z2).
  // CCW winding seen from above (ground raycasts ignore backfaces).
  rampQuad(x1, x2, z1, z2, hA, hB, hC, hD, mat, uvScale = 4) {
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([
      x1, hA, z1,  x2, hC, z2,  x2, hB, z1,
      x1, hA, z1,  x1, hD, z2,  x2, hC, z2,
    ]);
    const u = uvScale;
    const uvs = new Float32Array([0, 0, u, u, u, 0, 0, 0, 0, u, u, u]);
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    this.scene.add(m);
    this.walkables.push(m);
    return m;
  }

  floorPlane(x1, x2, z1, z2, y, mat, uv = null) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    m.receiveShadow = true;
    this.scene.add(m);
    this.walkables.push(m);
    return m;
  }

  // shared ground query for player, enemies, follower, projectiles
  groundAt(x, z, fromY) {
    this.downRay.set(new THREE.Vector3(x, fromY + 0.1, z), new THREE.Vector3(0, -1, 0));
    const hits = this.downRay.intersectObjects(this.walkables, false);
    return hits.length > 0 ? hits[0].point.y : null;
  }

  ivyPatch(x, y, z, w, h, rotY, depthOffset = 0.06) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: this.ivyTex, transparent: true, alphaTest: 0.4, roughness: 1, side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.translateZ(depthOffset);
    this.scene.add(m);
    return m;
  }

  lamp(x, z, groundY, { light = false, broken = false } = {}) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 4.6, 8), this.mats.iron);
    pole.position.set(x, groundY + 2.3, z);
    pole.rotation.z = broken ? 0.25 : 0;
    pole.castShadow = true;
    this.scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.42), this.mats.iron);
    head.position.set(x + (broken ? 0.62 : 0), groundY + (broken ? 4.42 : 4.75), z);
    if (broken) head.rotation.z = 0.25;
    this.scene.add(head);
    this.solid(x - 0.15, x + 0.15, groundY, groundY + 4.6, z - 0.15, z + 0.15);
    if (!broken && light) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc878 }));
      bulb.position.set(x, groundY + 4.68, z);
      this.scene.add(bulb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7,
      }));
      glow.scale.set(2.4, 2.4, 1);
      glow.position.set(x, groundY + 4.7, z);
      this.scene.add(glow);
      const pl = new THREE.PointLight(0xffb86b, 12, 15, 1.8);
      pl.position.set(x, groundY + 4.4, z);
      this.scene.add(pl);
      this.addCullableLight(pl);
      this.animated.push({ update: (t) => { if (pl.visible) pl.intensity = 11 + Math.sin(t * 13.7) * 1.2 + Math.sin(t * 7.3) * 0.8; } });
    }
  }

  // A grounded debris mound: every rock sits ON the floor (base layer) or nestled on
  // the rocks below (cap layer). Height comes from stacking, never from floating a rock
  // in mid-air — so no rock ever hovers over a gap.
  rubblePile(x, z, groundY, radius = 2.2, height = 1.4, count = 12) {
    const grp = new THREE.Group();
    const place = (rr, y, s) => {
      const a = rand() * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), this.mats.rubbleRock);
      rock.position.set(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr);
      rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      grp.add(rock);
    };
    // base layer — grounded rocks across the whole footprint (bigger toward the centre)
    for (let i = 0; i < count; i++) {
      const rr = Math.sqrt(rand()) * radius;                 // uniform over the disc
      const centrality = 1 - rr / radius;
      const s = 0.34 + (0.4 + centrality * 0.8) * rand() * radius * 0.4;
      place(rr, groundY + s * 0.5, s);                        // base half-buried in the floor
    }
    // cap layer — a few larger rocks near the centre, resting on the mound (supported, not floating)
    const caps = Math.max(2, Math.round(count / 4));
    for (let i = 0; i < caps; i++) {
      const rr = rand() * radius * 0.42;                      // stay over the dense centre
      const s = 0.5 + rand() * radius * 0.32;
      place(rr, groundY + Math.min(height, s * 0.75 + 0.25), s);
    }
    this.scene.add(grp);
    this.solid(x - radius, x + radius, groundY, groundY + height + 0.6, z - radius, z + radius);
    return grp;
  }

  carWreck(x, z, groundY, rotY = 0) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.0, 1.8), this.mats.rust);
    body.position.y = 0.75;
    body.castShadow = true;
    grp.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 1.7), this.mats.dark);
    cabin.position.set(-0.2, 1.6, 0);
    cabin.castShadow = true;
    grp.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 10);
    for (const [wx, wz] of [[-1.4, 0.9], [1.4, 0.9], [-1.4, -0.9], [1.4, -0.9]]) {
      const wheel = new THREE.Mesh(wheelGeo, this.mats.dark);
      wheel.position.set(wx, 0.36, wz);
      wheel.rotation.x = Math.PI / 2;
      grp.add(wheel);
    }
    grp.position.set(x, groundY, z);
    grp.rotation.y = rotY;
    this.scene.add(grp);
    const r = 2.2;
    this.solid(x - r, x + r, groundY, groundY + 2, z - r, z + r);
    this.occluders.push(body);
    return grp;
  }

  barricade(x, z, groundY, width, rotY = 0) {
    const grp = new THREE.Group();
    for (let i = 0; i < Math.ceil(width / 0.5); i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2 + rand() * 0.9, 0.08), this.mats.wood);
      plank.position.set(-width / 2 + i * 0.5, 1.1 + rand() * 0.3, (rand() - 0.5) * 0.15);
      plank.rotation.z = (rand() - 0.5) * 0.2;
      plank.castShadow = true;
      grp.add(plank);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.25, 0.1), this.mats.woodDark);
    cross.position.set(0, 1.5, 0.12);
    cross.rotation.z = 0.06;
    grp.add(cross);
    grp.position.set(x, groundY, z);
    grp.rotation.y = rotY;
    this.scene.add(grp);
    const hw = width / 2 + 0.2;
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    this.solid(x - hw * c - 0.3 * s, x + hw * c + 0.3 * s, groundY, groundY + 2.6, z - hw * s - 0.3 * c, z + hw * s + 0.3 * c);
    return grp;
  }

  // Weeds through the cobbles: cross-billboard tufts with an alpha grass texture.
  grassTufts(x1, x2, z1, z2, y, count) {
    if (!this._grassGeo) {
      // two crossed quads, pivot at the base (y from 0..1)
      const quad = (rot) => {
        const g = new THREE.PlaneGeometry(0.6, 0.55);
        g.translate(0, 0.275, 0);
        g.rotateY(rot);
        return g;
      };
      this._grassGeo = mergeGeometries([quad(0), quad(Math.PI / 2)]);
      this._grassMat = new THREE.MeshStandardMaterial({
        map: grassBladeTexture(), transparent: true, alphaTest: 0.35,
        side: THREE.DoubleSide, roughness: 1, depthWrite: true,
      });
    }
    const inst = new THREE.InstancedMesh(this._grassGeo, this._grassMat, count);
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      dummy.position.set(x1 + rand() * (x2 - x1), y, z1 + rand() * (z2 - z1));
      dummy.rotation.y = rand() * Math.PI;
      const s = 0.55 + rand() * 0.9;
      dummy.scale.set(s, 0.6 + rand() * 0.9, s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      // vary each tuft between mossy green and dry straw
      const dry = rand();
      col.setRGB(0.28 + dry * 0.28, 0.34 + dry * 0.14, 0.16 + dry * 0.06);
      inst.setColorAt(i, col);
    }
    inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    return inst;
  }

  // ------------------------------------------------------------- sky & light
  buildSky() {
    const geo = new THREE.SphereGeometry(1000, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.1, 1.0);
          vec3 zenith = vec3(0.32, 0.36, 0.42);
          vec3 mid    = vec3(0.62, 0.58, 0.52);
          vec3 horizon= vec3(0.92, 0.72, 0.48);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
          col = mix(col, zenith, smoothstep(0.12, 0.7, h));
          vec3 sunDir = normalize(vec3(-0.75, 0.28, 0.35));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.82, 0.55) * pow(s, 90.0) * 0.55;
          col += vec3(0.9, 0.6, 0.35) * pow(s, 10.0) * 0.10;
          // faint cloud bands
          float band = sin(vDir.y * 26.0 + vDir.x * 6.0) * 0.5 + 0.5;
          col = mix(col, col * 1.06, band * smoothstep(0.05, 0.4, h) * 0.35);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    this.scene.fog = new THREE.Fog(0x8d8478, 55, 460);
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9aa0a8, 0x4a4a3c, 1.5));
    const sun = new THREE.DirectionalLight(0xffdCA8, 2.1);
    sun.position.set(-130, 95, 55);
    sun.target.position.set(30, 10, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -190;
    sun.shadow.camera.right = 190;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.bias = -0.00045;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    // remember the art-directed sun angle: the shadow camera may follow the player, but the
    // light direction (and therefore the whole mood) must never change.
    this.sunDir = sun.target.position.clone().sub(sun.position).normalize();
    this.sunDist = 150;
    this.scene.add(new THREE.AmbientLight(0x565b64, 0.55));
  }

  // ------------------------------------------------------------- terrain
  buildTerrain() {
    const M = this.mats;

    // L0 — quay + praça
    this.floorPlane(-115, 100, -20, 30, 0, M.cobble);
    // quay stone edge along the water
    this.box(215, 1.6, 1.6, M.granite, -7, -0.8, 30.4, { solid: false });
    // mooring posts
    const postGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8);
    for (let x = -100; x <= 90; x += 12) {
      const p = new THREE.Mesh(postGeo, this.mats.dark);
      p.position.set(x, 0.45, 29.3);
      p.castShadow = true;
      this.scene.add(p);
      this.solid(x - 0.3, x + 0.3, 0, 0.9, 29, 29.6);
    }

    // Rua de São João — ramp up, stepped granite underfill below
    this.rampQuad(6, 16, -58, -18, 12, 12, 0, 0, M.cobbleStreet, 11);
    this.stepUnderfill(6, 16, -18, -58, 0, 12);

    // L1 — Largo de São Domingos (overlaps ramp top edge)
    this.floorPlane(-30, 40, -90, -56, 12, M.cobbleSmall);
    // retaining wall south of largo — split around the São João street mouth (x 6..16)
    this.box(35.6, 13, 1.2, M.graniteBig, -12.2, 5.5, -55.6, { solid: true, occlude: true });
    this.box(23.6, 13, 1.2, M.graniteBig, 28.2, 5.5, -55.6, { solid: true, occlude: true });
    // hillside mass between L0 and L1, split around the São João corridor (x 6..16)
    this.rampQuadVisual(-30, 5.5, -55, -21, 12, 12, 0, 0, M.hillside);
    this.rampQuadVisual(16.5, 40, -55, -21, 12, 12, 0, 0, M.hillside);

    // Rua das Flores — ramp to L2
    this.rampQuad(22, 32, -118, -88, 22, 22, 12, 12, M.cobbleStreet, 9);
    this.stepUnderfill(22, 32, -88, -118, 12, 22);
    // largo north edge walls beside the Flores street mouth
    this.solid(-30, 22, 10, 26, -92, -90);
    this.solid(32, 44, 10, 26, -92, -90);

    // L2 — Praça Almeida Garrett + station floor
    this.floorPlane(-20, 92, -152, -108, 22, M.cobbleSmall);
    // south retaining walls with the Flores mouth open at x 22..32
    this.box(42, 11, 1.2, M.graniteBig, 1, 16.5, -115.6, { solid: true, occlude: true });
    this.box(58, 11, 1.2, M.graniteBig, 63, 16.5, -117.0, { solid: true, occlude: true });
    // plaza east edge + dead strips behind the station (alley open at x 60..70)
    this.solid(92, 96, 18, 40, -156, -104);
    this.solid(44, 60, 21, 34, -112, -108);
    this.solid(70, 96, 21, 34, -112, -108);

    // L2b — Rua de Sá da Bandeira, running north off the praça to the market gate
    this.floorPlane(6, 16, -164, -152, 22, M.cobbleStreet, 3);
    this.solid(3.6, 6, 21, 38, -165, -152);    // street west flank
    this.solid(16, 18.4, 21, 38, -165, -152);  // street east flank

    // L2b — Mercado do Bolhão floor (the market quarter)
    this.floorPlane(-12, 38, -198, -164, 22, M.cobbleSmall);
    // outer market walls — south face split around the gate (x 6..16)
    this.box(18, 9, 1.2, M.graniteBig, -3, 26.5, -164.6, { solid: true, occlude: true });
    this.box(22, 9, 1.2, M.graniteBig, 27, 26.5, -164.6, { solid: true, occlude: true });
    this.box(50, 9, 1.2, M.graniteBig, 13, 26.5, -197.4, { solid: true, occlude: true });   // north
    this.box(1.2, 9, 12, M.graniteBig, -11.4, 26.5, -191.5, { solid: true, occlude: true }); // west, upper
    this.box(1.2, 9, 10, M.graniteBig, -11.4, 26.5, -169.5, { solid: true, occlude: true }); // west, lower
    this.box(1.2, 9, 34, M.graniteBig, 37.4, 26.5, -181, { solid: true, occlude: true });    // east
    // keep the player inside the quarter
    this.solid(-16, -11, 20, 40, -199, -164);
    this.solid(37, 42, 20, 40, -199, -164);
    this.solid(-16, 42, 20, 40, -201, -197);

    // alley to the Sé — climbs south from the station's flank
    this.rampQuad(60, 70, -112, -84, 22, 22, 28, 28, M.cobbleStreet, 8);
    this.stepUnderfill(60, 70, -112, -84, 22, 28);
    this.solid(56, 60, 21, 36, -112, -84);  // alley west wall
    this.solid(70, 74, 21, 36, -112, -84);  // alley east wall
    this.box(4, 14, 28, M.plaster, 58, 28.9, -98, { solid: false, shadow: true });  // alley west building mass
    this.box(4, 14, 28, M.plaster, 72, 28.9, -98, { solid: false, shadow: true });  // alley east building mass

    // L3 — Terreiro da Sé
    this.floorPlane(55, 118, -86, -28, 28, M.cobbleSmall);
    // north edge walls beside the alley mouth (x 60..70)
    this.solid(55, 60, 26, 44, -88, -86);
    this.solid(70, 118, 26, 44, -88, -86);

    // Escadas do Codeçal: flight 1 (south), landing, flight 2 (south to bridge)
    this.rampQuad(96, 108, -28, -6, 28, 28, 16, 16, M.granite, 6);
    this.floorPlane(96, 126, -6, 0, 16, M.granite);
    this.rampQuad(108, 126, 0, 12, 16, 16, 6, 6, M.granite, 6);
    // muralha masses under/around the stairs
    this.box(30, 26, 34, M.graniteBig, 111, 0.5, -14, { solid: false, shadow: false });
    this.box(18, 14, 12, M.graniteBig, 117, -1, 6, { solid: false, shadow: false });
    // Sé terrace south parapet, open at the stairs (x 96..108)
    this.box(41, 1.2, 1, M.granite, 75.5, 28.6, -28.1, { solid: false });
    this.solid(55, 96, 27.8, 29.4, -28.7, -27.6);
    this.box(10, 1.2, 1, M.granite, 113, 28.6, -28.1, { solid: false });
    this.solid(108, 118, 27.8, 29.4, -28.7, -27.6);
    // flight 1 side parapets
    this.solid(95.4, 96.4, 15, 31, -30, -6);
    this.solid(107.8, 108.8, 15, 31, -28, -6.5);
    this.box(1, 1.1, 22, M.granite, 95.9, 22.2, -17, { solid: false });
    this.box(1, 1.1, 21, M.granite, 108.3, 22.2, -17.5, { solid: false });
    // landing: wall along the north edge east of flight 1's exit, plus outer lips
    this.box(17.5, 1.1, 1, M.granite, 117.2, 16.55, -6.4, { solid: false });
    this.solid(108.5, 126, 16, 18.2, -6.9, -5.9);
    this.solid(125.6, 126.6, 14, 19.5, -6, 12);
    this.solid(95.4, 96.4, 14, 19, -6, 0);
    this.solid(96, 108.2, 14, 19, -0.5, 0.5); // south lip of landing west half
    // flight 2 side parapets + catch at the deck entry sliver (x 124..126)
    this.solid(107.4, 108.2, 5, 19, 0, 12);
    this.box(0.8, 1.1, 12, M.granite, 107.8, 12, 6, { solid: false });
    this.solid(124, 126.8, 5, 19, 10.5, 14);

    // Gaia bank
    this.floorPlane(-60, 140, 100, 150, 0, M.cobble);
    this.box(200, 1.6, 1.6, M.granite, 40, -0.8, 100.6, { solid: false });

    // praça north edge walls beside the São João street mouth (x 6..16)
    this.solid(-115, 6, -1, 26, -21, -19);
    this.solid(16, 100, -1, 26, -21, -19);

    // ---- SOLID HILLSIDE under every terrace so the city never floats.
    // Porto is one continuous rock hill; each terrace is the top of a retaining
    // mass. Fill the volume below each platform (leaving the street corridors open).
    const T = 0.12;
    // under L1 Largo (y12) — split around the Rua de São João corridor (x 6..16)
    this.hillMass(-31, 5.5, -91, -54, 12 - T);
    this.hillMass(16.5, 41, -91, -54, 12 - T);
    // slope faces flanking the São João street as it climbs (x 6..16)
    this.hillMass(4.5, 6.2, -55, -20, 12 - T);
    this.hillMass(15.8, 17.5, -55, -20, 12 - T);
    // under L2 Praça/São Bento (y22) — split around the Flores ramp (x22..32)
    // and the Sé alley (x60..70)
    this.hillMass(-21, 22, -153, -88, 22 - T);
    this.hillMass(32, 60, -153, -88, 22 - T);
    this.hillMass(70, 93, -153, -88, 22 - T);
    this.hillMass(22, 32, -153, -118, 22 - T);   // north of the Flores ramp top
    // under the Sá da Bandeira street + the Bolhão market quarter
    this.hillMass(3.6, 18.4, -165, -152, 22 - T);
    this.hillMass(-16, 42, -199, -164, 22 - T);
    this.hillMass(60, 70, -153, -112, 22 - T);   // north of the Sé-alley ramp foot
    // flanks of the Flores + alley street cuts
    this.hillMass(20.5, 22.3, -118, -88, 22 - T);
    this.hillMass(31.7, 33.5, -118, -88, 22 - T);
    this.hillMass(58, 60.2, -112, -84, 28 - T);
    this.hillMass(69.8, 72, -112, -84, 28 - T);
    // under L3 Terreiro da Sé (y28) — carries the cathedral
    this.hillMass(52, 119, -88, -27, 28 - T);

    // sea walls / play bounds (invisible)
    this.solid(-118, -114, -4, 40, -60, 40);   // west
    this.solid(98, 102, -4, 12, -20, 32);      // east end of quay (below codeçal massif)
    this.solid(-64, 140, -4, 30, 148, 152);    // south behind Gaia
    this.solid(-62, -58, -4, 30, 96, 152);     // west end Gaia
    this.solid(138, 142, -4, 30, 96, 152);     // east end Gaia
    // north behind São Bento plaza — split around the Sá da Bandeira street mouth (x 6..16)
    this.solid(-24, 6, 8, 40, -156, -152);
    this.solid(16, 96, 8, 40, -156, -152);
    this.solid(-34, -30, 8, 26, -94, -52);     // west of largo
    this.solid(40, 44, 8, 26, -94, -52);       // east of largo
    this.solid(-24, -20, 16, 36, -156, -104);  // west of plaza
    this.solid(114, 120, 24, 44, -90, -24);    // east of Sé terrace
    this.solid(51, 55, 24, 44, -88, -26);      // west edge of Sé terrace
  }

  // solid hillside block filling the volume under an elevated terrace
  hillMass(x1, x2, z1, z2, yTop, yBottom = -3) {
    const h = yTop - yBottom;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, h, z2 - z1), this.mats.hillside);
    m.position.set((x1 + x2) / 2, yBottom + h / 2, (z1 + z2) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    this.occluders.push(m);
    return m;
  }

  // stepped granite mass under a street ramp so its underside is never open air
  stepUnderfill(x1, x2, zLow, zHigh, yLow, yHigh) {
    const steps = 5;
    const dz = (zHigh - zLow) / steps;
    for (let i = 0; i < steps; i++) {
      const z0 = zLow + i * dz;
      const top = yLow + (yHigh - yLow) * (i / steps) - 0.09; // sunk below the ramp face — no z-fighting
      if (top <= 0.05) continue;
      const h = top + 2;
      this.box(x2 - x1, h, Math.abs(dz) + 0.2, this.mats.graniteBig,
        (x1 + x2) / 2, top - h / 2, z0 + dz / 2, { solid: false, shadow: false });
    }
  }

  // visual-only sloped quad (not walkable)
  rampQuadVisual(x1, x2, z1, z2, hA, hB, hC, hD, mat) {
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([
      x1, hA, z1,  x2, hC, z2,  x2, hB, z1,
      x1, hA, z1,  x1, hD, z2,  x2, hC, z2,
    ]);
    const uvs = new Float32Array([0, 0, 6, 6, 6, 0, 0, 0, 0, 6, 6, 6]);
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(1000, 74, 96, 20);
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        varying vec3 vPos;
        varying vec3 vNormal2;
        void main() {
          vec3 p = position;
          float w1 = sin(p.x * 0.10 + uTime * 0.8) * 0.15;
          float w2 = sin(p.y * 0.21 + uTime * 1.25) * 0.1;
          float w3 = sin((p.x + p.y) * 0.05 + uTime * 0.45) * 0.18;
          p.z += w1 + w2 + w3;
          vPos = p;
          float dx = cos(p.x * 0.10 + uTime * 0.8) * 0.015;
          float dy = cos(p.y * 0.21 + uTime * 1.25) * 0.021;
          vNormal2 = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vPos;
        varying vec3 vNormal2;
        void main() {
          vec3 deep = vec3(0.07, 0.09, 0.10);
          vec3 dusk = vec3(0.55, 0.42, 0.28);
          float f = clamp(0.5 + vNormal2.x * 1.5 + vNormal2.y * 0.6, 0.0, 1.0);
          float streak = smoothstep(140.0, 30.0, abs(vPos.x + 110.0)) * 0.45;
          vec3 col = mix(deep, dusk, f * 0.3 + streak * f);
          float sparkle = pow(max(sin(vPos.x * 2.0 + uTime * 1.7) * sin(vPos.y * 1.6 - uTime * 1.3), 0.0), 26.0);
          col += vec3(0.9, 0.7, 0.45) * sparkle * 0.35;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const water = new THREE.Mesh(geo, this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, WATER_Y, 66);
    this.scene.add(water);
    this.animated.push({ update: (t) => { this.waterMat.uniforms.uTime.value = t; } });
  }

  // ------------------------------------------------------------- Ponte Luís I
  buildBridge() {
    const iron = this.mats.iron;
    const X1 = 108, X2 = 124, ZA = 12, ZB = 104;
    const DECK_Y = 6;

    const deck = this.box(X2 - X1, 0.8, ZB - ZA, iron, (X1 + X2) / 2, DECK_Y - 0.4, (ZA + ZB) / 2, { solid: false });
    this.walkables.push(deck);
    this.occluders.push(deck);
    const deckTop = new THREE.Mesh(
      new THREE.PlaneGeometry(X2 - X1 - 1, ZB - ZA),
      new THREE.MeshStandardMaterial({ map: graniteTexture(4, 24), roughness: 0.9 })
    );
    deckTop.rotation.x = -Math.PI / 2;
    deckTop.position.set((X1 + X2) / 2, DECK_Y + 0.01, (ZA + ZB) / 2);
    deckTop.receiveShadow = true;
    this.scene.add(deckTop);

    // rails (full length both sides; entry is the open north edge, exit the south edge)
    for (const rx of [X1 + 0.3, X2 - 0.3]) {
      this.box(0.25, 1.15, ZB - ZA, iron, rx, DECK_Y + 0.55, (ZA + ZB) / 2);
      for (let z = ZA + 3; z < ZB; z += 6) {
        this.box(0.14, 1.1, 0.14, iron, rx, DECK_Y + 0.55, z, { solid: false, shadow: false });
      }
    }

    // girder shelters on the deck (cover for the herd crossing) — inboard enough
    // to leave a clean walking gap along both rails
    for (const [gx, gz] of [[X1 + 3, 34], [X2 - 3, 52], [X1 + 3, 70], [X2 - 3, 86]]) {
      const gird = this.box(1.6, 3.2, 1.6, iron, gx, DECK_Y + 1.6, gz, { occlude: true });
      gird.castShadow = true;
    }

    // ---- Ponte Luís I ironwork: a single crescent arch carrying two level decks,
    // built as merged box lattice (Eiffel-school truss) — one draw call for the lot.
    // All little members collected into `parts`, merged at the end.
    const parts = [];
    const addBox = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
      m.setPosition(x, y, z);
      g.applyMatrix4(m);
      parts.push(g);
    };
    // a strut connecting two points at a fixed x (in the z–y plane)
    const strut = (x, z0, y0, z1, y1, thick) => {
      const len = Math.hypot(z1 - z0, y1 - y0);
      addBox(thick, thick, len + thick * 0.5, x, (y0 + y1) / 2, (z0 + z1) / 2, -Math.atan2(y1 - y0, z1 - z0));
    };
    // a transverse member across x between the two ribs (in the x–y plane)
    const cross = (x0, x1, y0, y1, z, thick) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      addBox(len + thick * 0.5, thick, thick, (x0 + x1) / 2, (y0 + y1) / 2, z, 0, 0, Math.atan2(y1 - y0, x1 - x0));
    };

    // crescent arch profile: springs at deck level (y=6) by both banks, crown high;
    // depth of the rib swells toward the crown, tapering to the hinges.
    const AZC = (ZA + ZB) / 2, AH = (ZB - ZA) / 2;
    const par = (z) => Math.max(0, 1 - ((z - AZC) / AH) ** 2);
    const bY = (z) => DECK_Y + 26 * par(z);          // bottom chord
    const depth = (z) => 1.0 + 2.6 * par(z);          // rib depth (crescent)
    const tY = (z) => bY(z) + depth(z);               // top chord
    const UPPER_Y = 36.5;                             // upper (metro) deck level
    const RX = [X1 - 1.7, X2 + 1.7];                  // arch ribs, outboard of the roadway
    const N = 22;

    for (const rx of RX) {
      let pbz = ZA, pby = bY(ZA), pty = tY(ZA);
      for (let s = 1; s <= N; s++) {
        const z = ZA + (s / N) * (ZB - ZA);
        const by = bY(z), ty = tY(z);
        strut(rx, pbz, pby, z, by, 0.55);            // bottom chord
        strut(rx, pbz, pty, z, ty, 0.5);             // top chord
        addBox(0.4, ty - by, 0.4, rx, (by + ty) / 2, z); // vertical web post
        strut(rx, pbz, pby, z, ty, 0.28);            // lattice diagonal (zig)
        strut(rx, pbz, pty, z, by, 0.28);            // lattice diagonal (zag) → X pattern
        // hangers: lower deck (y=6) up to the arch where it rises above the deck
        if (by > DECK_Y + 1.2) addBox(0.32, by - DECK_Y, 0.32, rx > 116 ? X2 - 0.5 : X1 + 0.5, (DECK_Y + by) / 2, z);
        // spandrel columns: arch top chord up to the upper deck
        if (UPPER_Y - ty > 1.0) addBox(0.42, UPPER_Y - ty, 0.42, rx, (ty + UPPER_Y) / 2, z);
        pbz = z; pby = by; pty = ty;
      }
    }
    // transverse portal bracing across the arch crown (rib-to-rib X-braces)
    for (const z of [40, 50, 58, 66, 76]) {
      const y = tY(z) + 0.3;
      cross(RX[0], RX[1], y, y, z, 0.34);
      cross(RX[0], RX[1], y - 1.6, y + 1.6, z, 0.24);
      cross(RX[0], RX[1], y + 1.6, y - 1.6, z, 0.24);
    }
    // portal frames at both ends of the upper deck (the iconic gateways)
    for (const z of [ZA + 2, ZB - 2]) {
      addBox(0.6, UPPER_Y - DECK_Y, 0.6, RX[0], (DECK_Y + UPPER_Y) / 2, z);
      addBox(0.6, UPPER_Y - DECK_Y, 0.6, RX[1], (DECK_Y + UPPER_Y) / 2, z);
      cross(RX[0], RX[1], UPPER_Y, UPPER_Y, z, 0.5);
      cross(RX[0], RX[1], DECK_Y + 3, UPPER_Y - 1, z, 0.3);
      cross(RX[0], RX[1], UPPER_Y - 1, DECK_Y + 3, z, 0.3);
    }

    // upper deck (metro level) — straight, level, running bank to bank past the arch
    const UZ0 = -8, UZ1 = ZB + 18;
    for (const gx of [X1 - 0.7, X2 + 0.7]) {
      addBox(0.7, 2.0, UZ1 - UZ0, gx, UPPER_Y + 1.0, (UZ0 + UZ1) / 2);   // side girder
      addBox(0.25, 1.2, UZ1 - UZ0, gx, UPPER_Y + 2.6, (UZ0 + UZ1) / 2);  // railing
    }
    addBox(X2 - X1 + 1.4, 0.35, UZ1 - UZ0, (X1 + X2) / 2, UPPER_Y + 2.0, (UZ0 + UZ1) / 2); // deck slab
    // cross-bracing beneath the upper deck
    for (let z = UZ0 + 6; z < UZ1; z += 8) {
      cross(X1 - 0.7, X2 + 0.7, UPPER_Y + 0.3, UPPER_Y + 1.7, z, 0.2);
      cross(X1 - 0.7, X2 + 0.7, UPPER_Y + 1.7, UPPER_Y + 0.3, z, 0.2);
    }

    const ironwork = new THREE.Mesh(mergeGeometries(parts, false), iron);
    ironwork.castShadow = true;
    ironwork.receiveShadow = true;
    this.scene.add(ironwork);
    for (const g of parts) g.dispose();

    // monumental granite abutment towers at the four corners (outboard of the roadway)
    for (const [tx, tz] of [[X1 - 4.5, ZA + 1], [X2 + 4.5, ZA + 1], [X1 - 4.5, ZB - 1], [X2 + 4.5, ZB - 1]]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(5.5, 24, 7), this.mats.graniteBig);
      tower.position.set(tx, WATER_Y + 12, tz);
      tower.castShadow = true; tower.receiveShadow = true;
      this.scene.add(tower);
      // cornice cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.2, 7.8), this.mats.granite);
      cap.position.set(tx, WATER_Y + 24.4, tz);
      this.scene.add(cap);
    }

    // Gaia descent ramp from the deck south end
    this.rampQuad(X1, X2, 104, 120, 6, 6, 0, 0, this.mats.granite, 6);
    this.solid(X1 - 0.6, X1 + 0.2, 0, 8, 104, 120);
    this.solid(X2 - 0.2, X2 + 0.6, 0, 8, 104, 120);
    this.box(0.5, 1.1, 16, this.mats.granite, X1 + 0.1, 4, 112, { solid: false });
    this.box(0.5, 1.1, 16, this.mats.granite, X2 - 0.1, 4, 112, { solid: false });

    this.locations.bridgeNorth = new THREE.Vector3(116, 6, 16);
    this.locations.bridgeMid = new THREE.Vector3(116, 6, 58);
    this.locations.bridgeSouth = new THREE.Vector3(116, 6, 100);
  }

  // ------------------------------------------------------------- ash particles
  buildAsh() {
    const count = 700;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -120 + rand() * 260;
      pos[i * 3 + 1] = rand() * 45;
      pos[i * 3 + 2] = -160 + rand() * 310;
      speeds[i] = 0.3 + rand() * 0.8;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbdb4a4, size: 0.09, transparent: true, opacity: 0.55,
      sizeAttenuation: true, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.animated.push({
      update: (t, dt) => {
        const p = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          p[i * 3 + 1] -= speeds[i] * dt;
          p[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.35;
          if (p[i * 3 + 1] < -2) p[i * 3 + 1] = 40 + rand() * 8;
        }
        geo.attributes.position.needsUpdate = true;
      },
    });
  }

  update(t, dt) {
    for (const a of this.animated) a.update(t, dt);
  }
}
