// CINZA — people, infected, and companion AI.
import * as THREE from 'three';

export function makePerson({ shirt = 0x5a6a8a, pants = 0x3a3a40, skin = 0xc9a184, hat = null, scale = 1 } = {}) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.82, 8);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, mat(pants));
    leg.position.set(s * 0.11, 0.41, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.62, 10), mat(shirt));
  torso.position.y = 1.13;
  torso.castShadow = true;
  g.add(torso);
  const armGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.58, 6);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, mat(shirt));
    arm.position.set(s * 0.3, 1.12, 0);
    arm.rotation.z = s * 0.12;
    arm.castShadow = true;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), mat(skin));
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  if (hat !== null) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 10), mat(hat));
    brim.position.y = 1.72;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 10), mat(hat));
    crown.position.y = 1.78;
    g.add(crown);
  }
  g.scale.setScalar(scale);
  g.userData.arms = g.children.filter((c) => c.geometry === armGeo || (c.geometry && c.geometry.parameters && c.geometry.parameters.radiusTop === 0.055));
  return g;
}

function makeInfected(type) {
  const grey = 0x8a8d84;
  const g = makePerson({
    shirt: type === 'eco' ? 0x4a4640 : 0x54584e,
    pants: 0x3a3832,
    skin: grey,
  });
  const fungal = new THREE.MeshStandardMaterial({ color: 0xd0c090, roughness: 0.65, emissive: 0x201a08, emissiveIntensity: 0.5 });
  if (type === 'eco') {
    // head consumed by plated growth — blind
    const head = g.children.find((c) => c.position.y === 1.62);
    if (head) head.visible = false;
    for (let i = 0; i < 6; i++) {
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.11 + Math.random() * 0.08, 7, 5), fungal);
      plate.position.set((Math.random() - 0.5) * 0.22, 1.55 + Math.random() * 0.22, (Math.random() - 0.5) * 0.22);
      plate.scale.set(1, 0.7 + Math.random() * 0.5, 0.8);
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
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 7, 5), fungal);
      blob.position.set(0.12 + Math.random() * 0.1, 1.55 + Math.random() * 0.14, (Math.random() - 0.5) * 0.12);
      blob.castShadow = true;
      g.add(blob);
    }
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 5), fungal);
    shoulder.position.set(-0.26, 1.38, 0.05);
    shoulder.scale.y = 0.7;
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

const CONFIG = {
  errante: {
    speed: 0.9, chaseSpeed: 4.6, hp: 100, damage: 20, attackRange: 1.5, attackCooldown: 1.3,
    sightRange: 17, fovCos: Math.cos(THREE.MathUtils.degToRad(62)), hearRun: 13, hearWalk: 4.5,
    growl: 'errante',
  },
  eco: {
    speed: 0.7, chaseSpeed: 5.4, hp: 130, damage: 38, attackRange: 1.5, attackCooldown: 1.5,
    sightRange: 0, fovCos: 2, hearRun: 17, hearWalk: 6.5,
    growl: 'eco',
  },
  corvo: {
    speed: 1.6, chaseSpeed: 4.9, hp: 70, damage: 15, attackRange: 1.6, attackCooldown: 1.1,
    sightRange: 22, fovCos: Math.cos(THREE.MathUtils.degToRad(55)), hearRun: 12, hearWalk: 5,
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
    this.ray = new THREE.Raycaster();
  }

  setActive(on) {
    this.active = on;
    this.group.visible = on;
  }

  reset() {
    if (this.dead) return; // the dead stay dead across checkpoints
    this.group.position.copy(this.home);
    this.group.rotation.set(0, 0, 0);
    this.state = 'patrol';
    this.wpIndex = this.waypoints.length > 1 ? 1 : 0;
    this.suspicion = 0;
    this.noiseTarget = null;
    this.hp = this.cfg.hp;
    this.stunT = 0;
  }

  // point noise burst (brick impact, loud events)
  hearNoise(pos, radius = 18) {
    if (!this.active || this.dead || this.stunT > 0) return;
    if (this.group.position.distanceTo(pos) < radius) {
      this.noiseTarget = pos.clone();
      if (this.state !== 'chase') {
        this.state = 'investigate';
        this.investigateT = 0;
        this.suspicion = Math.max(this.suspicion, 0.6);
      }
    }
  }

  // continuous player noise (footsteps) — called every frame from main
  perceiveSteps(playerPos, running, moving, dt) {
    if (!this.active || this.dead || this.stunT > 0 || !moving) return;
    const d = this.group.position.distanceTo(playerPos);
    const range = running ? this.cfg.hearRun : this.cfg.hearWalk;
    if (d < range) {
      const closeness = 1 - d / range;
      this.suspicion = Math.min(1, this.suspicion + (0.5 + closeness * 1.6) * dt);
      if (this.suspicion > 0.55) {
        this.noiseTarget = playerPos.clone();
        if (this.suspicion >= 1) {
          this.state = 'chase';
          this.lastSeenT = 0;
        } else if (this.state === 'patrol' || this.state === 'wait') {
          this.state = 'investigate';
          this.investigateT = 0;
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

  takeHit(dmg, fromDir, { stun = 0.4 } = {}) {
    if (this.dead) return;
    this.hp -= dmg;
    this.stunT = Math.max(this.stunT, stun);
    this.group.position.addScaledVector(fromDir, 0.45);
    this.audio?.play('hitFlesh');
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.deathT = 0;
      this.audio?.play(this.type === 'corvo' ? 'manDown' : 'infectedDown');
    } else {
      // getting hit reveals the player
      this.state = 'chase';
      this.suspicion = 1;
      this.lastSeenT = 0;
    }
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
    if (this.state === 'chase' || this.suspicion > 0.6) return false;
    const p = this.group.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    if (Math.hypot(dx, dz) > 2.4 || Math.abs(playerPos.y - p.y) > 2) return false;
    const fwd = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const toPlayer = new THREE.Vector3(dx, 0, dz).normalize();
    return fwd.dot(toPlayer) < 0.4; // player is not in front of the enemy
  }

  update(dt, t, playerPos, playerMoving, playerRunning, onAttack) {
    if (!this.active) return;
    const p = this.group.position;

    if (this.dead) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.6);
      this.group.rotation.x = -k * Math.PI / 2 * 0.94;
      if (this.deathT < 0.7) p.y -= dt * 0.6;
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.group.rotation.z = Math.sin(t * 30) * 0.06 * Math.min(1, this.stunT);
      return;
    }
    this.group.rotation.z = 0;
    this.attackT -= dt;
    this.lastSeenT += dt;

    // perception: sight
    const seen = this.canSee(playerPos);
    if (seen > 0) {
      this.suspicion = Math.min(1, this.suspicion + (0.7 + seen * 1.8) * dt * (playerMoving ? 1.3 : 0.85));
      if (this.suspicion >= 1) {
        this.state = 'chase';
        this.lastSeenT = 0;
        this.noiseTarget = playerPos.clone();
      } else if (this.suspicion > 0.45 && (this.state === 'patrol' || this.state === 'wait')) {
        this.state = 'investigate';
        this.noiseTarget = playerPos.clone();
        this.investigateT = 0;
      }
    } else if (this.state !== 'chase') {
      this.suspicion = Math.max(0, this.suspicion - dt * 0.3);
    }

    // ambient growls
    this.growlT -= dt;
    if (this.growlT <= 0) {
      this.growlT = 4 + Math.random() * 9;
      if (p.distanceTo(playerPos) < 26) this.audio?.play(this.cfg.growl);
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
      this.investigateT += dt;
      const arrived = this.noiseTarget ? this.moveToward(this.noiseTarget, this.cfg.speed * 2.2, dt) : true;
      if (arrived || this.investigateT > 8) {
        this.suspicion = Math.max(0, this.suspicion - dt * 0.5);
        this.group.rotation.y += dt * 0.9;
        if (this.suspicion <= 0.05) this.state = 'patrol';
      }
    } else if (this.state === 'chase') {
      // horizontal distance — the player's eye height must not inflate melee range
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      // eco chases last-heard position; sighted types track directly
      const canTrack = this.cfg.sightRange > 0 ? (seen > 0 || this.lastSeenT < 4) : false;
      if (canTrack || d < 2.6) this.noiseTarget = playerPos.clone();
      const target = this.noiseTarget || playerPos;
      const arrived = this.moveToward(target, this.cfg.chaseSpeed, dt);
      if (d < this.cfg.attackRange && this.attackT <= 0) {
        this.attackT = this.cfg.attackCooldown;
        this.audio?.play('attackSnarl');
        onAttack(this.cfg.damage, this);
      }
      if (arrived && d > 3.5 && this.lastSeenT > 4) {
        // lost the trail
        this.suspicion = 0.4;
        this.state = 'investigate';
        this.investigateT = 0;
      }
      if (this.lastSeenT > 11 && d > 14) {
        this.suspicion = 0;
        this.state = 'patrol';
      }
    }

    // gait
    const walking = this.state === 'patrol' || this.state === 'investigate' || this.state === 'chase';
    if (walking) {
      const rate = this.state === 'chase' ? 9 : 3.4;
      this.group.rotation.z = Math.sin(t * rate) * (this.type === 'corvo' ? 0.02 : 0.07);
      this.group.position.y += 0; // ground snap already applied in moveToward
    }
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
