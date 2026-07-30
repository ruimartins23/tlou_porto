// CINZA — people, infected, and companion AI.
import * as THREE from 'three';

// Shared body materials/geometries. Every duplicate material makes Three.js re-upload the
// whole light array for that draw, so bodies of the same colour reuse one material.
const BODY_MATS = new Map();
const bodyMat = (c) => {
  let m = BODY_MATS.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }); BODY_MATS.set(c, m); }
  return m;
};
const GEO = {};
const geo = (key, make) => (GEO[key] || (GEO[key] = make()));

export function makePerson({ shirt = 0x5a6a8a, pants = 0x3a3a40, skin = 0xc9a184, hat = null, scale = 1 } = {}) {
  const g = new THREE.Group();
  const mat = bodyMat;
  const legGeo = geo('leg', () => new THREE.CylinderGeometry(0.09, 0.11, 0.82, 8));
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, mat(pants));
    leg.position.set(s * 0.11, 0.41, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  const torso = new THREE.Mesh(geo('torso', () => new THREE.CylinderGeometry(0.21, 0.26, 0.62, 10)), mat(shirt));
  torso.position.y = 1.13;
  torso.castShadow = true;
  g.add(torso);
  const armGeo = geo('arm', () => new THREE.CylinderGeometry(0.055, 0.07, 0.58, 6));
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, mat(shirt));
    arm.position.set(s * 0.3, 1.12, 0);
    arm.rotation.z = s * 0.12;
    arm.castShadow = true;
    g.add(arm);
  }
  const head = new THREE.Mesh(geo('head', () => new THREE.SphereGeometry(0.155, 12, 10)), mat(skin));
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  if (hat !== null) {
    const brim = new THREE.Mesh(geo('brim', () => new THREE.CylinderGeometry(0.19, 0.19, 0.03, 10)), mat(hat));
    brim.position.y = 1.72;
    g.add(brim);
    const crown = new THREE.Mesh(geo('crown', () => new THREE.CylinderGeometry(0.13, 0.15, 0.12, 10)), mat(hat));
    crown.position.y = 1.78;
    g.add(crown);
  }
  g.scale.setScalar(scale);
  g.userData.arms = g.children.filter((c) => c.geometry === armGeo || (c.geometry && c.geometry.parameters && c.geometry.parameters.radiusTop === 0.055));
  return g;
}

const FUNGAL_MAT = new THREE.MeshStandardMaterial({ color: 0xd0c090, roughness: 0.65, emissive: 0x201a08, emissiveIntensity: 0.5 });

function makeInfected(type) {
  const grey = 0x8a8d84;
  const g = makePerson({
    shirt: type === 'eco' ? 0x4a4640 : 0x54584e,
    pants: 0x3a3832,
    skin: grey,
  });
  const fungal = FUNGAL_MAT;
  if (type === 'eco') {
    // head consumed by plated growth — blind
    const head = g.children.find((c) => c.position.y === 1.62);
    if (head) head.visible = false;
    for (let i = 0; i < 6; i++) {
      const plate = new THREE.Mesh(geo('blob', () => new THREE.SphereGeometry(1, 7, 5)), fungal);
      const ps = 0.11 + Math.random() * 0.08;
      plate.position.set((Math.random() - 0.5) * 0.22, 1.55 + Math.random() * 0.22, (Math.random() - 0.5) * 0.22);
      plate.scale.set(ps, ps * (0.7 + Math.random() * 0.5), ps * 0.8);
      plate.castShadow = true;
      g.add(plate);
    }
    // arms reach forward
    for (const arm of g.children.filter((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.radiusTop === 0.055)) {
      arm.rotation.x = -1.15;
      arm.position.z = 0.22;
      arm.position.y = 1.2;
    }
  } else {
    // errante: growths breaking through shoulder and half the face
    for (let i = 0; i < 3; i++) {
      const blob = new THREE.Mesh(geo('blob', () => new THREE.SphereGeometry(1, 7, 5)), fungal);
      blob.scale.setScalar(0.07 + Math.random() * 0.06);
      blob.position.set(0.12 + Math.random() * 0.1, 1.55 + Math.random() * 0.14, (Math.random() - 0.5) * 0.12);
      blob.castShadow = true;
      g.add(blob);
    }
    const shoulder = new THREE.Mesh(geo('blob', () => new THREE.SphereGeometry(1, 7, 5)), fungal);
    shoulder.position.set(-0.26, 1.38, 0.05);
    shoulder.scale.set(0.13, 0.13 * 0.7, 0.13);
    g.add(shoulder);
  }
  return g;
}

// Static NPC that faces the player when close.
export class NPC {
  constructor(scene, opts, x, y, z, faceYaw = 0) {
    this.group = makePerson(opts);
    this.group.position.set(x, y, z);
    this.group.rotation.y = faceYaw;
    this.baseYaw = faceYaw;
    this.baseY = y;
    this.phase = Math.random() * Math.PI * 2;
    scene.add(this.group);
  }
  update(t, playerPos) {
    this.group.position.y = this.baseY + Math.sin(t * 1.1 + this.phase) * 0.015;
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    if (Math.hypot(dx, dz) < 7) {
      const targetYaw = Math.atan2(dx, dz);
      let dy = targetYaw - this.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.group.rotation.y += dy * 0.06;
    }
  }
}

// Player runs at 7.0. Chasers are just under that — you *can* escape a clean sprint,
// but sprinting is loud and wakes everything, so fleeing rarely ends well (TLOU balance).
const CONFIG = {
  errante: {   // runner: fast, sees you, swarms
    speed: 1.0, chaseSpeed: 6.2, hp: 90, damage: 26, attackRange: 1.6, attackCooldown: 1.0,
    sightRange: 21, fovCos: Math.cos(THREE.MathUtils.degToRad(62)), hearRun: 17, hearWalk: 3.3, hearCrouch: 1.2,
    growl: 'errante',
  },
  eco: {       // clicker: blind but lethal — two hits and you're gone; sound is everything
    speed: 0.8, chaseSpeed: 6.6, hp: 160, damage: 72, attackRange: 1.6, attackCooldown: 1.3,
    sightRange: 0, fovCos: 2, hearRun: 26, hearWalk: 7, hearCrouch: 2.6,
    growl: 'eco',
  },
  corvo: {     // scavenger: coordinated, hits hard, flanks
    speed: 1.7, chaseSpeed: 5.9, hp: 70, damage: 22, attackRange: 1.7, attackCooldown: 0.95,
    sightRange: 27, fovCos: Math.cos(THREE.MathUtils.degToRad(56)), hearRun: 15, hearWalk: 3.3, hearCrouch: 1.2,
    growl: 'corvo',
  },
};

export class Enemy {
  constructor(scene, world, type, waypoints, audio, overrides = null) {
    this.world = world;
    this.audio = audio;
    this.type = type;
    this.cfg = overrides ? { ...CONFIG[type], ...overrides } : CONFIG[type];
    this.group = type === 'corvo'
      ? makePerson({ shirt: 0x33302c, pants: 0x26241f, skin: 0xb08a6a, hat: 0x1c1a18 })
      : makeInfected(type);
    this.waypoints = waypoints.map((w) => new THREE.Vector3(w[0], w[1], w[2]));
    this.home = this.waypoints[0].clone();
    this.group.position.copy(this.home);
    scene.add(this.group);

    this.hp = this.cfg.hp;
    this.state = 'patrol';   // patrol | wait | investigate | chase | dead
    this.wpIndex = this.waypoints.length > 1 ? 1 : 0;
    this.waitT = 0;
    this.suspicion = 0;
    this.noiseTarget = null;
    this.lastSeenT = -99;
    this.attackT = 0;
    this.stunT = 0;
    this.investigateT = 0;
    this.growlT = 2 + Math.random() * 6;
    this.active = true;
    this.dead = false;
    this.deathT = 0;
    this.looted = false;   // bodies can be searched once
    this.ray = new THREE.Raycaster();

    // cover-combat state (Corvos)
    this.myCover = null;
    this.coverT = 0;
    this.coverHold = 3 + Math.random() * 3;
    this.shootT = 1 + Math.random();
    this.crouch = 0;        // 0 stand .. 1 crouched
    this.peekT = 0;
    this.onGunNoise = null; // set by main — a Corvo shot wakes the infected too
    if (type === 'corvo') {
      this.cfg = { ...this.cfg, shootRange: 32, shootDamage: 11, shootCooldown: 1.7 };
      // muzzle flash for this Corvo's gun
      this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({
        map: world.emberTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
      }));
      this.muzzle.scale.set(0.5, 0.5, 1);
      this.muzzle.position.set(0.28, 1.15, 0.35);
      this.group.add(this.muzzle);
      this.muzzleLight = new THREE.PointLight(0xffb060, 0, 8, 2);
      this.muzzleLight.position.set(0.28, 1.15, 0.4);
      this.muzzleLight.visible = false;   // a dark light still costs uniforms — hide it
      this.group.add(this.muzzleLight);
    }
  }

  setActive(on) {
    this.active = on;
    this.group.visible = on;
    if (!on && this.ghost) this.ghost.visible = false;
  }

  // ---- listen mode: a through-wall silhouette that reads the enemy's alert state ----
  buildGhost() {
    if (this.ghost) return;
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0xdfe8ff, transparent: true, opacity: 0.4,
      depthTest: false, depthWrite: false, fog: false,
    });
    this.ghost = this.group.clone(true);
    const junk = [];
    this.ghost.traverse((o) => {
      if (o.isMesh) { o.material = this.ghostMat; o.renderOrder = 998; o.castShadow = o.receiveShadow = false; }
      else if (o.isLight || o.isSprite) junk.push(o);
    });
    junk.forEach((o) => o.parent && o.parent.remove(o));  // no cloned lights/flashes
    this.ghost.visible = false;
    this.world.scene.add(this.ghost);
  }

  setGhost(on, color = 0xdfe8ff, pulse = 1) {
    if (!on || this.dead) { if (this.ghost) this.ghost.visible = false; return; }
    this.buildGhost();
    this.ghost.visible = true;
    this.ghost.position.copy(this.group.position);
    this.ghost.rotation.copy(this.group.rotation);
    this.ghost.scale.copy(this.group.scale);
    this.ghostMat.color.setHex(color);
    this.ghostMat.opacity = 0.28 + 0.18 * pulse;
  }

  reset() {
    if (this.dead) return; // the dead stay dead across checkpoints
    this.releaseCover();
    this.group.position.copy(this.home);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.y = 1;
    this.crouch = 0;
    this.crouchWanted = false;
    this.state = 'patrol';
    this.wpIndex = this.waypoints.length > 1 ? 1 : 0;
    this.suspicion = 0;
    this.noiseTarget = null;
    this.hp = this.cfg.hp;
    this.stunT = 0;
  }

  // begin (or refresh) a search of a spot — walk there, then sweep a couple of nearby points
  startInvestigate(pos) {
    this.noiseTarget = pos ? pos.clone() : this.group.position.clone();
    if (this.state !== 'chase') {
      this.state = 'investigate';
      this.investigateT = 0;
      this.searchHops = 0;
      this.searchLookT = 0;
    }
  }

  // point noise burst (brick impact, loud events)
  hearNoise(pos, radius = 18) {
    if (!this.active || this.dead || this.stunT > 0) return;
    if (this.group.position.distanceTo(pos) < radius) {
      if (this.state !== 'chase') {
        this.suspicion = Math.max(this.suspicion, 0.6);
        this.startInvestigate(pos);
      } else {
        this.noiseTarget = pos.clone();
      }
    }
  }

  // continuous player noise (footsteps) — called every frame from main
  perceiveSteps(playerPos, running, moving, crouching, dt) {
    if (!this.active || this.dead || this.stunT > 0 || !moving) return;
    const d = this.group.position.distanceTo(playerPos);
    const range = running ? this.cfg.hearRun
      : crouching ? (this.cfg.hearCrouch ?? 1.2)
      : this.cfg.hearWalk;
    if (d < range) {
      const closeness = 1 - d / range;
      this.suspicion = Math.min(1, this.suspicion + (0.5 + closeness * 1.6) * dt);
      if (this.suspicion > 0.55) {
        if (this.suspicion >= 1) {
          this.noiseTarget = playerPos.clone();
          this.state = 'chase';
          this.lastSeenT = 0;
        } else if (this.state === 'patrol' || this.state === 'wait') {
          this.startInvestigate(playerPos);
        }
      }
    }
  }

  canSee(playerPos) {
    if (this.cfg.sightRange <= 0) return 0;
    const eye = this.group.position.clone();
    eye.y += 1.6;
    const to = playerPos.clone().sub(eye);
    const dist = to.length();
    if (dist > this.cfg.sightRange) return 0;
    const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
    const fwd = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    if (flat.dot(fwd) < this.cfg.fovCos) return 0;
    this.ray.set(eye, to.normalize());
    this.ray.far = dist - 0.3;
    if (this.ray.intersectObjects(this.world.occluders, false).length > 0) return 0;
    return 1 - dist / this.cfg.sightRange;
  }

  moveToward(target, speed, dt) {
    const p = this.group.position;
    const d = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
    const dist = d.length();
    if (dist < 0.4) return true;
    d.normalize();
    p.x += d.x * Math.min(speed * dt, dist);
    p.z += d.z * Math.min(speed * dt, dist);
    // slide along solids
    const R = 0.34;
    for (const s of this.world.solids) {
      if (s.y1 > p.y + 1.5 || s.y2 < p.y + 0.3) continue;
      const cx = Math.max(s.x1, Math.min(p.x, s.x2));
      const cz = Math.max(s.z1, Math.min(p.z, s.z2));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R && d2 > 1e-8) {
        const dd = Math.sqrt(d2);
        p.x += dx * ((R - dd) / dd);
        p.z += dz * ((R - dd) / dd);
      }
    }
    // ground snap
    const g = this.world.groundAt(p.x, p.z, p.y + 1.7);
    if (g !== null && Math.abs(g - p.y) < 2.2) p.y += (g - p.y) * Math.min(1, dt * 12);
    // face movement
    const targetYaw = Math.atan2(d.x, d.z);
    let dy = targetYaw - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * 7);
    return false;
  }

  takeHit(dmg, fromDir, { stun = 0.4, melee = false, silent = false } = {}) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.stunT = Math.max(this.stunT, stun);
    this.group.position.addScaledVector(fromDir, melee ? 0.32 : (silent ? 0.12 : 0.45));
    this.flinchT = 0.18;          // visible recoil (read in update)
    this.releaseCover?.();
    if (!silent) this.audio?.play(melee ? 'meleeHit' : 'hitFlesh', this.group.position);
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.deathT = 0;
      this.audio?.play(this.type === 'corvo' ? 'manDown' : 'infectedDown', this.group.position);
      return true;
    } else {
      // getting hit reveals the player
      this.state = 'chase';
      this.suspicion = 1;
      this.lastSeenT = 0;
      this.noiseTarget = this.group.position.clone().addScaledVector(fromDir, -2);
    }
    return false;
  }

  // silent stealth takedown — no death shout, no noise
  silentKill() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deathT = 0;
    this.hp = 0;
    this.audio?.play('takedown');
  }

  // is the player positioned for a stealth takedown? (behind/beside an unaware enemy)
  takedownReady(playerPos) {
    if (!this.active || this.dead || this.stunT > 0) return false;
    if (this.state === 'chase' || this.suspicion > 0.85) return false; // forgiving: even a half-alert enemy can be taken
    const p = this.group.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    if (Math.hypot(dx, dz) > 2.9 || Math.abs(playerPos.y - p.y) > 2) return false;
    const fwd = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const toPlayer = new THREE.Vector3(dx, 0, dz).normalize();
    return fwd.dot(toPlayer) < 0.55; // player is behind/beside (not squarely in front)
  }

  update(dt, t, playerPos, playerMoving, playerRunning, onAttack) {
    if (!this.active) return;
    const p = this.group.position;
    const sx = p.x, sz = p.z; // frame start — for footstep cadence

    if (this.dead) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.6);
      this.group.rotation.x = -k * Math.PI / 2 * 0.94;
      if (this.deathT < 0.7) p.y -= dt * 0.6;
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.group.rotation.z = Math.sin(t * 34) * 0.07 * Math.min(1, this.stunT);
      if (this.flinchT > 0) { this.flinchT -= dt; this.group.rotation.x = -this.flinchT * 2.2; }
      else this.group.rotation.x = 0;
      return;
    }
    this.group.rotation.z = 0;
    this.group.rotation.x = 0;
    this.attackT -= dt;
    this.lastSeenT += dt;

    // perception: sight
    const seen = this.canSee(playerPos);
    if (seen > 0) {
      this.suspicion = Math.min(1, this.suspicion + (1.0 + seen * 2.4) * dt * (playerMoving ? 1.4 : 0.9));
      if (this.suspicion >= 1) {
        if (this.state !== 'chase') {  // just locked on — roar/shout and rally the others
          this.audio?.play(this.type === 'corvo' ? 'corvoAlert' : 'chaseRoar', p);
          this.onSpotted?.(playerPos.clone(), this.type);
        }
        this.state = 'chase';
        this.lastSeenT = 0;
        this.noiseTarget = playerPos.clone();
      } else if (this.suspicion > 0.45 && (this.state === 'patrol' || this.state === 'wait')) {
        this.startInvestigate(playerPos);
      }
    } else if (this.state !== 'chase') {
      this.suspicion = Math.max(0, this.suspicion - dt * 0.3);
    }

    // vocalizations — positional, frequent when close, relentless while chasing
    this.growlT -= dt;
    if (this.growlT <= 0) {
      const d = p.distanceTo(playerPos);
      const chasing = this.state === 'chase';
      this.growlT = chasing ? (0.9 + Math.random() * 1.3) : (2.5 + Math.random() * 5);
      if (d < 44) this.audio?.play(this.cfg.growl, p);
    }

    // state machine
    if (this.state === 'patrol') {
      if (this.waypoints.length > 1) {
        if (this.moveToward(this.waypoints[this.wpIndex], this.cfg.speed, dt)) {
          this.state = 'wait';
          this.waitT = 2 + Math.random() * 3;
        }
      } else {
        this.group.rotation.y += Math.sin(t * 0.4 + this.home.x) * 0.003;
      }
    } else if (this.state === 'wait') {
      this.waitT -= dt;
      this.group.rotation.y += Math.sin(t * 0.6) * 0.005;
      if (this.waitT <= 0) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        this.state = 'patrol';
      }
    } else if (this.state === 'investigate') {
      // walk to the last-known spot, then sweep a couple of nearby points before giving up
      this.investigateT += dt;
      const target = this.noiseTarget || p;
      const arrived = this.moveToward(target, this.cfg.speed * 2.0, dt);
      if (arrived) {
        this.searchLookT = (this.searchLookT || 0) + dt;
        this.group.rotation.y += dt * 1.5;   // scan the area
        if (this.searchLookT > 1.5) {
          this.searchLookT = 0;
          this.searchHops = (this.searchHops || 0) + 1;
          if (this.searchHops <= 2) {
            // step to a fresh nearby point — the search widens
            const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 3;
            this.noiseTarget = new THREE.Vector3(target.x + Math.cos(a) * r, target.y, target.z + Math.sin(a) * r);
          } else {
            this.suspicion = 0; this.state = 'patrol'; this.searchHops = 0;   // lost the trail
          }
        }
      }
      if (this.investigateT > 15) { this.suspicion = 0; this.state = 'patrol'; this.searchHops = 0; }
    } else if (this.state === 'chase') {
      // horizontal distance — the player's eye height must not inflate melee range
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (this.type === 'corvo') {
        this.corvoCombat(dt, t, playerPos, seen, onAttack, d);
      } else {
        // infected: relentless pursuit of the last-known position
        const canTrack = this.cfg.sightRange > 0 ? (seen > 0 || this.lastSeenT < 4) : false;
        if (canTrack || d < 2.6) this.noiseTarget = playerPos.clone();
        const arrived = this.moveToward(this.noiseTarget || playerPos, this.cfg.chaseSpeed, dt);
        if (d < this.cfg.attackRange && this.attackT <= 0) {
          this.attackT = this.cfg.attackCooldown;
          this.audio?.play('attackSnarl', this.group.position);
          onAttack(this.cfg.damage, this);
        }
        if (arrived && d > 3.5 && this.lastSeenT > 4) {
          this.suspicion = 0.4;
          this.state = 'investigate';
          this.investigateT = 0;
        }
      }
      if (this.lastSeenT > 11 && d > 14) {
        this.releaseCover();
        this.suspicion = 0;
        this.state = 'patrol';
        this.crouchWanted = false;
      }
    }

    // crouch pose (Corvos in cover) — compress the body toward the ground
    if (this.type === 'corvo') {
      const target = (this.state === 'chase' && this.crouchWanted && this.peekT <= 0) ? 1 : 0;
      this.crouch += (target - this.crouch) * Math.min(1, dt * 8);
      this.group.scale.y = 1 - this.crouch * 0.32;
      if (this.peekT > 0) this.peekT -= dt;
      // muzzle flash decay
      if (this.muzzle && this.muzzle.material.opacity > 0) {
        this.muzzle.material.opacity = Math.max(0, this.muzzle.material.opacity - dt * 10);
        this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 90);
        if (this.muzzleLight.intensity <= 0) this.muzzleLight.visible = false;
      }
    }

    // gait + positional footsteps (you hear them shuffle/march before you see them)
    const walking = this.state === 'patrol' || this.state === 'investigate' || this.state === 'chase';
    if (walking) {
      const rate = this.state === 'chase' ? 9 : 3.4;
      this.group.rotation.z = Math.sin(t * rate) * (this.type === 'corvo' ? 0.02 : 0.07);
      this.stepD = (this.stepD || 0) + Math.hypot(p.x - sx, p.z - sz);
      const stride = this.state === 'chase' ? 1.5 : 2.1;
      if (this.stepD > stride) {
        this.stepD = 0;
        if (Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 42) {
          this.audio?.play(this.type === 'corvo' ? 'stepBoot' : 'stepInfected', p);
        }
      }
    }
  }

  // ---- Corvo cover tactics: hold cover, peek to shoot, flank closer ----------
  corvoCombat(dt, t, playerPos, seen, onAttack, d) {
    const p = this.group.position;
    const los = this.hasLineTo(playerPos);
    if (seen > 0 || los) { this.noiseTarget = playerPos.clone(); this.lastSeenT = 0; }

    // player point-blank: abandon cover and swing
    if (d < 4.2) {
      this.releaseCover();
      this.crouchWanted = false;
      this.moveToward(playerPos, this.cfg.chaseSpeed, dt);
      this.faceToward(playerPos, dt, 8);
      if (d < this.cfg.attackRange && this.attackT <= 0) {
        this.attackT = this.cfg.attackCooldown;
        this.audio?.play('attackSnarl', p);
        onAttack(this.cfg.damage, this);
      }
      return;
    }

    // acquire / rotate cover
    this.coverT += dt;
    if (!this.myCover || this.coverT > this.coverHold) this.pickCover(playerPos);

    if (this.myCover) {
      const cp = this.myCover.pos;
      const distToCover = Math.hypot(p.x - cp.x, p.z - cp.z);
      if (distToCover > 1.1) {
        // advancing to cover — moving target, harder to hit, doesn't shoot
        this.crouchWanted = false;
        this.moveToward(cp, this.cfg.chaseSpeed, dt);
      } else {
        // holding cover: crouch, face the player, peek out to fire
        this.crouchWanted = true;
        this.faceToward(playerPos, dt, 5);
        this.shootT -= dt;
        if (los && this.shootT <= 0 && d < this.cfg.shootRange) {
          this.shootT = this.cfg.shootCooldown + Math.random() * 1.0;
          this.peekT = 0.55;  // pop up briefly
          this.corvoShoot(playerPos, d, onAttack);
        }
      }
    } else {
      // no cover free — advance in the open, fire on the move occasionally
      this.crouchWanted = false;
      this.moveToward(playerPos, this.cfg.speed * 1.4, dt);
      this.shootT -= dt;
      if (los && this.shootT <= 0 && d < this.cfg.shootRange) {
        this.shootT = this.cfg.shootCooldown + 0.6 + Math.random();
        this.corvoShoot(playerPos, d, onAttack);
      }
    }
  }

  corvoShoot(playerPos, d, onAttack) {
    this.audio?.play('corvoShot', this.group.position);
    if (this.muzzle) { this.muzzle.material.opacity = 1; this.muzzleLight.intensity = 26; this.muzzleLight.visible = true; }
    if (this.onGunNoise) this.onGunNoise(this.group.position.clone(), 30); // wakes infected
    // accuracy falls with range and if the player is moving; cover shots are aimed
    const hitChance = Math.max(0.12, 0.82 - d / this.cfg.shootRange * 0.6);
    if (Math.random() < hitChance) onAttack(this.cfg.shootDamage, this, true);
  }

  pickCover(playerPos) {
    const pts = this.world.coverPoints;
    if (!pts || !pts.length) { this.myCover = null; return; }
    const p = this.group.position;
    let best = null, bestScore = Infinity;
    for (const c of pts) {
      if (c.taken && c.taken !== this) continue;
      const dc = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      const dp = Math.hypot(playerPos.x - c.pos.x, playerPos.z - c.pos.z);
      if (dp < 5 || dp > this.cfg.shootRange) continue;      // usable firing distance
      // prefer near cover that is also a bit closer to the player than we are now
      const score = dc + Math.max(0, dp - 16) * 0.5;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    this.releaseCover();
    if (best) { best.taken = this; this.myCover = best; this.coverT = 0; this.coverHold = 3 + Math.random() * 3.5; }
  }

  releaseCover() {
    if (this.myCover && this.myCover.taken === this) this.myCover.taken = false;
    this.myCover = null;
  }

  faceToward(target, dt, rate = 6) {
    const dx = target.x - this.group.position.x, dz = target.z - this.group.position.z;
    const yaw = Math.atan2(dx, dz);
    let dy = yaw - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * rate);
  }

  // line of sight ignoring FoV (for shooting from cover)
  hasLineTo(playerPos) {
    const eye = this.group.position.clone(); eye.y += 1.4;
    const to = playerPos.clone(); to.y += 0.2; to.sub(eye);
    const dist = to.length();
    if (dist > this.cfg.shootRange + 4) return false;
    this.ray.set(eye, to.normalize());
    this.ray.far = dist - 0.4;
    return this.ray.intersectObjects(this.world.occluders, false).length === 0;
  }
}

// Beatriz — the companion. Follows, never triggers enemies, never blocks.
export class Follower {
  constructor(scene, world) {
    this.world = world;
    this.group = makePerson({ shirt: 0x6d4a58, pants: 0x33302e, skin: 0xd4b090, scale: 0.82 });
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
    this.tmp = new THREE.Vector3();
  }

  setActive(on, pos = null) {
    this.active = on;
    this.group.visible = on;
    if (on && pos) this.group.position.copy(pos);
  }

  teleportTo(pos) {
    this.group.position.copy(pos);
  }

  update(dt, t, playerPos, playerYaw, playerMoving) {
    if (!this.active) return;
    const p = this.group.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 15) {
      // catch up instantly if left far behind (never lose her)
      p.set(playerPos.x - Math.sin(playerYaw) * -2, playerPos.y - 1.68, playerPos.z - Math.cos(playerYaw) * -2);
    } else if (d > 2.3) {
      const speed = d > 6 ? 6.6 : 4.4;
      const nx = dx / d, nz = dz / d;
      p.x += nx * speed * dt;
      p.z += nz * speed * dt;
      const R = 0.3;
      for (const s of this.world.solids) {
        if (s.y1 > p.y + 1.4 || s.y2 < p.y + 0.3) continue;
        const cx = Math.max(s.x1, Math.min(p.x, s.x2));
        const cz = Math.max(s.z1, Math.min(p.z, s.z2));
        const ddx = p.x - cx, ddz = p.z - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < R * R && d2 > 1e-8) {
          const dd = Math.sqrt(d2);
          p.x += ddx * ((R - dd) / dd);
          p.z += ddz * ((R - dd) / dd);
        }
      }
      const targetYaw = Math.atan2(nx, nz);
      let dy = targetYaw - this.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.group.rotation.y += dy * Math.min(1, dt * 8);
      this.group.rotation.z = Math.sin(t * 7.5) * 0.05;
    } else {
      this.group.rotation.z = 0;
      // face where the player faces when idle close by
      const fx = playerPos.x - p.x, fz = playerPos.z - p.z;
      if (Math.hypot(fx, fz) > 0.8) {
        const targetYaw = Math.atan2(fx, fz);
        let dy = targetYaw - this.group.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.group.rotation.y += dy * Math.min(1, dt * 3);
      }
    }
    // ground snap
    const g = this.world.groundAt(p.x, p.z, p.y + 1.7);
    if (g !== null && Math.abs(g - p.y) < 3) p.y += (g - p.y) * Math.min(1, dt * 12);
  }
}
