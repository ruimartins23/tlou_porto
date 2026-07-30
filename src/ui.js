// CINZA — DOM HUD: vitals, supplies, dialogue, notebook, area cards, marker.
import * as THREE from 'three';
import { tr, Lang, UI_TEXT } from './lang.js';
import { RECIPES, COMPONENTS } from './player.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.dialogueActive = false;
    this.dialogueQueue = [];
    this.dialogueIndex = 0;
    this.onDialogueEnd = null;
    this.choiceMode = false;
    this.dialogueChoices = null;
    this.journalEntries = [];
    this.toastTimer = null;
    this.cardTimer = null;
    this._proj = new THREE.Vector3();
  }

  showHud() { $('hud').classList.add('visible'); }

  setObjective(text) {
    this.lastObjective = text;
    $('objective-text').textContent = tr(text);
    $('pause-obj').textContent = tr(text);
    this.audio?.play('objective');
  }

  // re-render language-dependent live text after a language switch
  refreshObjective() {
    if (this.lastObjective) {
      $('objective-text').textContent = tr(this.lastObjective);
      $('pause-obj').textContent = tr(this.lastObjective);
    }
  }

  prompt(text, key = 'E') {
    const el = $('prompt');
    if (text) {
      el.querySelector('b').textContent = key;
      $('prompt-text').textContent = tr(text);
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  // crosshair feedback: white pip on a hit, amber on a kill, red + big on a headshot
  hitMarker(headshot, killed) {
    const c = $('crosshair');
    c.style.transition = 'none';
    c.style.transform = `translate(-50%,-50%) scale(${headshot ? 3.0 : 2.1})`;
    c.style.background = headshot ? '#ff5240' : (killed ? '#ffcf7a' : 'rgba(245,242,232,0.95)');
    c.style.boxShadow = headshot ? '0 0 6px #ff5240' : '0 0 4px rgba(0,0,0,0.6)';
    this._flashing = true;
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => {
      this._flashing = false;
      c.style.transition = 'transform 0.15s, background 0.15s';
      this.applyCrossBase();
    }, 70);
  }

  // idle crosshair look — amber + enlarged when a melee strike would land
  applyCrossBase() {
    const c = $('crosshair');
    if (this._meleeReady) {
      c.style.transform = 'translate(-50%,-50%) scale(1.7)';
      c.style.background = 'rgba(255,150,60,0.95)';
      c.style.boxShadow = '0 0 6px rgba(255,140,50,0.9)';
    } else {
      c.style.transform = 'translate(-50%,-50%) scale(1)';
      c.style.background = 'rgba(230,221,200,0.5)';
      c.style.boxShadow = '0 0 4px rgba(0,0,0,0.7)';
    }
  }

  setMeleeReady(on) {
    if (this._meleeReady === on) return;
    this._meleeReady = on;
    if (!this._flashing) { $('crosshair').style.transition = 'transform 0.1s, background 0.1s'; this.applyCrossBase(); }
  }

  setCrouched(on) {
    if (this._crouched === on) return;
    this._crouched = on;
    $('crouch-ind').style.opacity = on ? 1 : 0;
  }

  setListening(on) {
    if (this._listening === on) return;
    this._listening = on;
    $('listen-ind').style.opacity = on ? 1 : 0;
  }

  toast(text, ms = 4200) {
    const el = $('toast');
    el.textContent = tr(text);
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  }

  // TLOU-style location card (place name + subtitle)
  areaCard(place, sub) {
    $('areacard-pt').textContent = tr(place);
    $('areacard-sub').textContent = tr(sub);
    const el = $('areacard');
    el.style.opacity = 1;
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => { el.style.opacity = 0; }, 3600);
  }

  setHealth(hp, max) {
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    $('healthbar').firstElementChild.style.width = `${pct}%`;
    $('lowhp').style.opacity = hp <= 30 ? 1 : 0;
  }

  setStamina(v, max, locked) {
    const bar = $('stambar');
    if (!bar) return;
    const pct = Math.max(0, Math.min(100, (v / max) * 100));
    bar.firstElementChild.style.width = `${pct}%`;
    bar.classList.toggle('spent', locked);          // amber while you catch your breath
    bar.style.opacity = pct >= 99 && !locked ? 0 : 1; // hide when full, surface when draining
  }

  setSupplies(bandages, bricks, molotovs = 0) {
    $('cnt-bandage').textContent = bandages;
    $('cnt-brick').textContent = bricks;
    const mol = $('cnt-molotov');
    if (mol) {
      mol.textContent = molotovs;
      $('molotov-item').style.display = molotovs > 0 ? '' : 'none';  // only appears once you have one
    }
  }

  setShivs(n) {
    const el = $('cnt-shiv');
    if (!el) return;
    el.textContent = n;
    $('shiv-item').style.display = n > 0 ? '' : 'none';
  }

  setWeapon(weapons) {
    const w = weapons.activeWeapon;
    if (!w) {
      $('weapon-name').textContent = tr(UI_TEXT.unarmed);
      $('weapon-ammo').textContent = '';
      $('weapon-reload').style.display = 'none';
      return;
    }
    $('weapon-name').textContent = tr(UI_TEXT[`wpn_${weapons.active}`] || w.name);
    $('weapon-ammo').textContent = w.kind === 'melee' ? '' : weapons.ammoLabel();
    $('weapon-reload').style.display = weapons.canReload() ? 'inline' : 'none';
  }

  setDetection(v) {
    const wrap = $('detect');
    wrap.style.display = v > 0.03 ? 'block' : 'none';
    wrap.firstElementChild.style.width = `${Math.round(v * 100)}%`;
  }

  flashDamage() {
    const el = $('damage-flash');
    el.style.opacity = 1;
    setTimeout(() => { el.style.opacity = 0; }, 320);
  }

  fade(dark) {
    $('fade').classList.toggle('dark', dark);
  }

  // ---- dialogue -------------------------------------------------------------
  startDialogue(lines, { choices = null, onEnd = null } = {}) {
    this.dialogueQueue = lines;
    this.dialogueIndex = 0;
    this.dialogueChoices = choices;
    this.onDialogueEnd = onEnd;
    this.dialogueActive = true;
    this.choiceMode = false;
    $('dialogue').style.display = 'block';
    this.renderDialogueLine();
  }

  renderDialogueLine() {
    const line = this.dialogueQueue[this.dialogueIndex];
    $('dialogue-speaker').textContent = tr(line.speaker);
    $('dialogue-text').textContent = tr(line.text);
    $('dialogue-choices').style.display = 'none';
    $('dialogue-next').style.display = 'block';
    this.audio?.play('dialogue');
  }

  advanceDialogue() {
    if (!this.dialogueActive || this.choiceMode) return;
    if (this.dialogueIndex < this.dialogueQueue.length - 1) {
      this.dialogueIndex++;
      this.renderDialogueLine();
    } else if (this.dialogueChoices) {
      this.showChoices();
    } else {
      this.endDialogue();
    }
  }

  showChoices() {
    this.choiceMode = true;
    const wrap = $('dialogue-choices');
    wrap.innerHTML = '';
    $('dialogue-next').style.display = 'none';
    this.dialogueChoices.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'choice';
      div.innerHTML = `<span class="num">${i + 1}.</span>${tr(c.label)}`;
      div.addEventListener('click', () => this.pickChoice(i));
      wrap.appendChild(div);
    });
    wrap.style.display = 'block';
  }

  pickChoice(i) {
    if (!this.choiceMode || !this.dialogueChoices || !this.dialogueChoices[i]) return;
    const choice = this.dialogueChoices[i];
    this.dialogueChoices = null;
    this.choiceMode = false;
    this.endDialogue();
    if (choice.onPick) choice.onPick();
  }

  endDialogue() {
    this.dialogueActive = false;
    $('dialogue').style.display = 'none';
    if (this.onDialogueEnd) {
      const cb = this.onDialogueEnd;
      this.onDialogueEnd = null;
      cb();
    }
  }

  // ---- notebook -------------------------------------------------------------
  addJournal(title, text) {
    this.journalEntries.push({ title, text });
    this.renderJournal();
    this.toast({ en: `Notebook updated — ${tr(title)}  [J]`, pt: `Caderno atualizado — ${tr(title)}  [J]` });
    this.audio?.play('pickup');
  }

  renderJournal() {
    $('journal-entries').innerHTML = this.journalEntries
      .map((e) => `<div class="journal-entry"><h3>${tr(e.title)}</h3><p>${tr(e.text)}</p></div>`)
      .join('') || `<div class="journal-empty">${tr(UI_TEXT.notebookEmpty)}</div>`;
  }

  toggleJournal(force) {
    const el = $('journal');
    const show = force !== undefined ? force : el.style.display !== 'block';
    el.style.display = show ? 'block' : 'none';
    return show;
  }

  // ---- crafting menu --------------------------------------------------------
  renderCraft(player) {
    $('craft-mats').innerHTML = COMPONENTS.map((k) => {
      const n = player.components[k] || 0;
      return `<span class="mat ${n === 0 ? 'zero' : ''}">${tr(UI_TEXT['comp_' + k])}<b>${n}</b></span>`;
    }).join('');

    $('craft-recipes').innerHTML = RECIPES.map((r, i) => {
      const able = player.canCraft(r.id);
      const cost = Object.entries(r.need).map(([k, v]) => {
        const short = (player.components[k] || 0) < v ? 'short' : '';
        return `<span class="${short}">${tr(UI_TEXT['comp_' + k])} ×${v}</span>`;
      }).join(' + ');
      return `<div class="recipe ${able ? 'able' : 'unable'}">
        <span class="key">${i + 1}</span>
        <span class="info"><div class="rname">${tr(UI_TEXT['item_' + r.id])}</div><div class="rcost">${cost}</div></span>
        <span class="rhave">${tr(UI_TEXT.craftCarry)} ×${player[r.out] || 0}</span>
      </div>`;
    }).join('');
  }

  toggleCraft(player, force) {
    const el = $('craft');
    const show = force !== undefined ? force : el.style.display !== 'block';
    el.style.display = show ? 'block' : 'none';
    if (show) this.renderCraft(player);
    return show;
  }

  // ---- 3D objective marker --------------------------------------------------
  updateMarker(camera, worldPos, playerPos) {
    const el = $('marker');
    if (!worldPos) { el.style.display = 'none'; return; }
    this._proj.set(worldPos.x, worldPos.y + 1.7, worldPos.z);
    this._proj.project(camera);
    const behind = this._proj.z > 1;
    if (behind || Math.abs(this._proj.x) > 1.05) {
      const x = Math.max(-0.92, Math.min(0.92, this._proj.x * (behind ? -1 : 1)));
      el.style.left = `${(x * 0.5 + 0.5) * 100}%`;
      el.style.top = '50%';
    } else {
      el.style.left = `${(this._proj.x * 0.5 + 0.5) * 100}%`;
      el.style.top = `${(-this._proj.y * 0.5 + 0.5) * 100}%`;
    }
    el.style.display = 'block';
    const d = Math.round(Math.hypot(worldPos.x - playerPos.x, worldPos.z - playerPos.z));
    el.querySelector('.dist').textContent = `${d}m`;
  }
}
