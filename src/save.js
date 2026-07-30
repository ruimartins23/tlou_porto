// CINZA — checkpoint save. A run is roughly three quarters of an hour; losing it to a
// closed tab is not acceptable, so the game writes a save every time it sets a checkpoint
// and offers Continue on the title screen.
const KEY = 'cinza.save';
const VERSION = 1;

export function hasSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    return d && d.v === VERSION && typeof d.stage === 'number';
  } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function saveGame({ story, player, weapons, ui }) {
  try {
    const props = {};
    for (const id in story.props) if (story.props[id].taken) props[id] = 1;
    const data = {
      v: VERSION,
      savedAt: Date.now(),
      stage: story.stage,
      checkpoint: {
        x: story.checkpoint.pos.x, y: story.checkpoint.pos.y, z: story.checkpoint.pos.z,
        yaw: story.checkpoint.yaw, stage: story.checkpoint.stage,
      },
      flags: { ...story.flags },
      props,
      story: {
        hasNotebook: story.hasNotebook, notesFound: story.notesFound, mercy: story.mercy ?? null,
        timesDied: story.timesDied, infectedKilled: story.infectedKilled, corvosKilled: story.corvosKilled,
      },
      player: {
        health: player.health, bandages: player.bandages, bricks: player.bricks,
        molotovs: player.molotovs, shivs: player.shivs, components: { ...player.components },
      },
      weapons: {
        owned: { ...weapons.owned }, active: weapons.active,
        ammoInMag: { ...weapons.ammoInMag }, ammoReserve: { ...weapons.ammoReserve },
      },
      journal: (ui.journalEntries || []).map((e) => ({ title: e.title, text: e.text })),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

// Restore into a freshly-built game. Returns true if a save was applied.
export function loadGame({ story, player, weapons, ui, follower, enemies, onStage }) {
  let d;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    d = JSON.parse(raw);
    if (!d || d.v !== VERSION) return false;
  } catch (e) { return false; }

  // props already collected disappear from the world
  for (const id in d.props || {}) {
    const p = story.props[id];
    if (p && !p.taken) { p.taken = true; story.scene.remove(p.mesh, p.glow); }
  }
  Object.assign(story.flags, d.flags || {});
  story.hasNotebook = d.story.hasNotebook;
  story.notesFound = d.story.notesFound || 0;
  story.mercy = d.story.mercy ?? null;
  story.timesDied = d.story.timesDied || 0;
  story.infectedKilled = d.story.infectedKilled || 0;
  story.corvosKilled = d.story.corvosKilled || 0;

  Object.assign(player, {
    health: d.player.health, bandages: d.player.bandages, bricks: d.player.bricks,
    molotovs: d.player.molotovs, shivs: d.player.shivs,
  });
  player.components = { rag: 0, alcohol: 0, blade: 0, scrap: 0, ...(d.player.components || {}) };

  Object.assign(weapons.owned, d.weapons.owned || {});
  Object.assign(weapons.ammoInMag, d.weapons.ammoInMag || {});
  Object.assign(weapons.ammoReserve, d.weapons.ammoReserve || {});
  if (d.weapons.active && weapons.owned[d.weapons.active]) {
    weapons.active = d.weapons.active;
    for (const k in weapons.models) weapons.models[k].visible = (k === weapons.active);
  }

  ui.journalEntries = (d.journal || []).slice();
  ui.renderJournal();

  const cp = d.checkpoint;
  story.checkpoint = { pos: new player.position.constructor(cp.x, cp.y, cp.z), yaw: cp.yaw, stage: cp.stage };
  story.setStage(d.stage);
  onStage?.(d.stage);
  player.teleport(cp.x, cp.y, cp.z, cp.yaw);
  follower.setActive(d.stage >= 1, new player.position.constructor(cp.x + 1, cp.y, cp.z + 1));
  for (const e of enemies) e.reset();
  return true;
}
