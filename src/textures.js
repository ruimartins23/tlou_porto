// Procedural canvas textures — no external assets needed.
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 16; // sharp at grazing angles — matters most for the streets
  return tex;
}

// Grass/weed tuft — blades on a transparent ground, for cross-billboard instances.
export function grassBladeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  const blades = 11;
  for (let i = 0; i < blades; i++) {
    const bx = 8 + Math.random() * 48;
    const h = 26 + Math.random() * 34;
    const lean = (Math.random() - 0.5) * 20;
    const w = 1.6 + Math.random() * 2.2;
    // color: dry-green through straw, desaturated for a ruined city
    const g = 90 + Math.random() * 70;
    const r = g * (0.7 + Math.random() * 0.35);
    const b = g * 0.45;
    const grd = ctx.createLinearGradient(bx, 64, bx + lean, 64 - h);
    grd.addColorStop(0, `rgba(${r*0.6|0},${g*0.6|0},${b*0.6|0},0.95)`);
    grd.addColorStop(1, `rgba(${r|0},${g|0},${b|0},0.9)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, 64);
    ctx.quadraticCurveTo(bx - w / 4 + lean / 2, 64 - h / 2, bx + lean, 64 - h);
    ctx.quadraticCurveTo(bx + w / 4 + lean / 2, 64 - h / 2, bx + w / 2, 64);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Deterministic pseudo-random so the world looks the same every run.
let seed = 1234;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export function resetSeed(s = 1234) { seed = s; }

function noiseOverlay(ctx, w, h, alpha, count = 900) {
  for (let i = 0; i < count; i++) {
    const g = Math.floor(rand() * 255);
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

// --- Azulejo: blue-on-white Portuguese tile pattern -------------------------
export function azulejoTexture(repeatX = 2, repeatY = 2) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(0, 0, 256, 256);
  const tile = 64;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const x = tx * tile, y = ty * tile;
      // tile face slightly varied
      ctx.fillStyle = `rgba(240,238,228,${0.5 + rand() * 0.5})`;
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      // blue motif: rosette of petals
      const cx = x + tile / 2, cy = y + tile / 2;
      ctx.strokeStyle = '#2b4a8b';
      ctx.fillStyle = '#39599e';
      ctx.lineWidth = 2;
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 9, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#24407e';
      ctx.fill();
      // corner accents
      ctx.fillStyle = '#39599e';
      for (const [ox, oy] of [[8, 8], [tile - 8, 8], [8, tile - 8], [tile - 8, tile - 8]]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // grout lines
      ctx.strokeStyle = 'rgba(120,120,110,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
    }
  }
  noiseOverlay(ctx, 256, 256, 0.04, 500);
  return toTexture(c, repeatX, repeatY);
}

// --- Plaster facade with windows baked in -----------------------------------
// Ribeira houses: colored plaster, rows of windows with stone frames + iron balconies.
export function facadeTexture(baseColor, floors, cols, azulejo = false) {
  const w = 256, h = 128 * floors;
  const [c, ctx] = makeCanvas(w, h);
  // plaster base with subtle vertical streaking
  ctx.fillStyle = azulejo ? '#dfe4e2' : baseColor;
  ctx.fillRect(0, 0, w, h);
  if (azulejo) {
    // small blue tile grid as the facade skin
    const t = 16;
    for (let ty = 0; ty < h / t; ty++) {
      for (let tx = 0; tx < w / t; tx++) {
        const shade = rand();
        ctx.fillStyle = shade < 0.5 ? '#3a5a9c' : (shade < 0.8 ? '#4b6cae' : '#dfe4e2');
        ctx.fillRect(tx * t + 1, ty * t + 1, t - 2, t - 2);
        if (shade >= 0.8) { // white tile with blue dot motif
          ctx.fillStyle = '#3a5a9c';
          ctx.beginPath();
          ctx.arc(tx * t + t / 2, ty * t + t / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.fillStyle = 'rgba(120,120,110,0.15)';
    ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.05})`;
    const sx = rand() * w;
    ctx.fillRect(sx, 0, 2 + rand() * 8, h);
  }
  noiseOverlay(ctx, w, h, 0.05, 1400);
  // grime at bottom
  const grad = ctx.createLinearGradient(0, h - 40, 0, h);
  grad.addColorStop(0, 'rgba(40,35,30,0)');
  grad.addColorStop(1, 'rgba(40,35,30,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - 40, w, 40);

  const floorH = h / floors;
  const colW = w / cols;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const wx = col * colW + colW * 0.24;
      const wy = f * floorH + floorH * 0.18;
      const ww = colW * 0.52;
      const wh = floorH * 0.62;
      // granite frame
      ctx.fillStyle = '#b9b2a4';
      ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
      // window: dark glass with warm light sometimes
      const lit = rand() < 0.3;
      const g2 = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      if (lit) {
        g2.addColorStop(0, '#e8b25f');
        g2.addColorStop(1, '#9c6a2e');
      } else {
        g2.addColorStop(0, '#2a3138');
        g2.addColorStop(1, '#151a20');
      }
      ctx.fillStyle = g2;
      ctx.fillRect(wx, wy, ww, wh);
      // glazing bars
      ctx.strokeStyle = lit ? 'rgba(60,40,15,0.8)' : 'rgba(200,200,200,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      // iron balcony on upper floors
      if (f < floors - 1) {
        ctx.strokeStyle = '#1d1d20';
        ctx.lineWidth = 2;
        const by = wy + wh + 4;
        ctx.strokeRect(wx - 4, by, ww + 8, 7);
        ctx.beginPath();
        for (let b = 0; b <= 6; b++) {
          const bx = wx - 4 + (b / 6) * (ww + 8);
          ctx.moveTo(bx, by); ctx.lineTo(bx, by + 7);
        }
        ctx.stroke();
      }
    }
  }
  const tex = toTexture(c, 1, 1);
  return tex;
}

// --- Cobblestones -----------------------------------------------------------
export function cobbleTexture(repeatX = 8, repeatY = 8) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#4c4a48';
  ctx.fillRect(0, 0, 256, 256);
  const size = 24;
  for (let y = 0; y < 256 / size + 1; y++) {
    for (let x = 0; x < 256 / size + 1; x++) {
      const ox = (y % 2) * (size / 2);
      const g = 92 + Math.floor(rand() * 48);
      const warm = Math.floor(rand() * 12);
      ctx.fillStyle = `rgb(${g + warm},${g},${g - warm / 2})`;
      const px = x * size + ox + 1.5, py = y * size + 1.5;
      const r = 5;
      ctx.beginPath();
      ctx.roundRect(px, py, size - 4, size - 4, r);
      ctx.fill();
      // top-left highlight for depth
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(px, py, size - 4, (size - 4) / 2, r);
      ctx.fill();
    }
  }
  noiseOverlay(ctx, 256, 256, 0.06, 1200);
  return toTexture(c, repeatX, repeatY);
}

// --- Granite blocks (bridge, quay wall, monuments) --------------------------
export function graniteTexture(repeatX = 4, repeatY = 2) {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#8b8578';
  ctx.fillRect(0, 0, 256, 128);
  const bw = 64, bh = 32;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 5; x++) {
      const ox = (y % 2) * (bw / 2);
      const g = 125 + Math.floor(rand() * 35);
      ctx.fillStyle = `rgb(${g},${g - 4},${g - 14})`;
      ctx.fillRect(x * bw - ox + 2, y * bh + 2, bw - 4, bh - 4);
      noiseOverlay(ctx, 256, 128, 0.02, 60);
    }
  }
  ctx.strokeStyle = 'rgba(50,46,40,0.5)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= 4; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * bh); ctx.lineTo(256, y * bh); ctx.stroke();
  }
  return toTexture(c, repeatX, repeatY);
}

// --- Terracotta roof tiles --------------------------------------------------
export function roofTexture(repeatX = 4, repeatY = 4) {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#8f4a2e';
  ctx.fillRect(0, 0, 128, 128);
  const rw = 16;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const r = 150 + Math.floor(rand() * 50);
      ctx.fillStyle = `rgb(${r},${Math.floor(r * 0.48)},${Math.floor(r * 0.3)})`;
      ctx.beginPath();
      ctx.roundRect(x * rw + 1, y * rw + 1, rw - 2, rw - 2, [0, 0, 7, 7]);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x * rw + 1, y * rw + rw - 4, rw - 2, 3);
    }
  }
  noiseOverlay(ctx, 128, 128, 0.05, 400);
  return toTexture(c, repeatX, repeatY);
}

// --- Weathered wood (boats, crates, doors) ----------------------------------
export function woodTexture(base = '#6e4f30', repeatX = 2, repeatY = 2) {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 7; i++) {
    const py = i * 18.3;
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`;
    ctx.fillRect(0, py, 128, 2);
    // grain streaks
    for (let s = 0; s < 8; s++) {
      ctx.strokeStyle = `rgba(${30 + rand() * 40},${20 + rand() * 25},10,${0.15 + rand() * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sy = py + 3 + rand() * 13;
      ctx.moveTo(0, sy);
      ctx.bezierCurveTo(40, sy + rand() * 4 - 2, 90, sy + rand() * 4 - 2, 128, sy);
      ctx.stroke();
    }
  }
  noiseOverlay(ctx, 128, 128, 0.05, 400);
  return toTexture(c, repeatX, repeatY);
}

// ============================ CINZA additions ================================
// Post-outbreak surface set: ruin facades, moss, murals, interior floors.

function mossPatches(ctx, w, h, count, alpha = 0.5) {
  for (let i = 0; i < count; i++) {
    const mx = rand() * w, my = rand() * h;
    const r = 4 + rand() * 18;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    const green = `rgba(${40 + rand() * 30},${65 + rand() * 35},${30 + rand() * 15},`;
    g.addColorStop(0, green + (alpha * (0.5 + rand() * 0.5)) + ')');
    g.addColorStop(1, green + '0)');
    ctx.fillStyle = g;
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);
  }
}

function grimeStreaks(ctx, w, h, count = 30) {
  for (let i = 0; i < count; i++) {
    const sx = rand() * w, sy = rand() * h * 0.5;
    const len = 20 + rand() * (h - sy);
    const grad = ctx.createLinearGradient(0, sy, 0, sy + len);
    grad.addColorStop(0, `rgba(25,22,18,${0.12 + rand() * 0.22})`);
    grad.addColorStop(1, 'rgba(25,22,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, 2 + rand() * 6, len);
  }
}

// Ruined Ribeira facade: faded plaster, boarded/broken windows, moss + grime.
export function ruinFacadeTexture(baseColor, floors, cols, azulejo = false) {
  const w = 256, h = 128 * floors;
  const [c, ctx] = makeCanvas(w, h);
  // faded plaster — Ribeira houses keep their colour even in ruin
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120,115,105,0.18)'; // light age wash (keep the colour)
  ctx.fillRect(0, 0, w, h);
  // faint horizontal plaster-coursing so big walls aren't flat
  for (let i = 0; i < floors * 2; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.03})`;
    ctx.fillRect(0, (i / (floors * 2)) * h + rand() * 6, w, 1.5);
  }
  if (azulejo) {
    const t = 16;
    for (let ty = 0; ty < h / t; ty++) {
      for (let tx = 0; tx < w / t; tx++) {
        const shade = rand();
        if (shade < 0.12) continue; // missing tiles show plaster
        ctx.fillStyle = shade < 0.55 ? '#46607f' : (shade < 0.82 ? '#56718f' : '#c8ccc4');
        ctx.fillRect(tx * t + 1, ty * t + 1, t - 2, t - 2);
      }
    }
    ctx.fillStyle = 'rgba(90,88,80,0.25)';
    ctx.fillRect(0, 0, w, h);
  }
  // cracks
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(30,28,24,${0.25 + rand() * 0.3})`;
    ctx.lineWidth = 1 + rand();
    ctx.beginPath();
    let cx = rand() * w, cy = rand() * h * 0.4;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (rand() - 0.5) * 30;
      cy += 15 + rand() * 25;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  noiseOverlay(ctx, w, h, 0.06, 1600);

  const floorH = h / floors;
  const colW = w / cols;
  // a painted-shutter colour per house (Porto windows are framed in white/green/blue)
  const shutter = ['#3a4a3a', '#2e3f57', '#6a5030', '#7a2f28', '#8a8478'][Math.floor(rand() * 5)];
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      // tall narrow windows, Porto proportion
      const ww = colW * 0.42;
      const wh = floorH * 0.66;
      const wx = col * colW + (colW - ww) / 2;
      const wy = f * floorH + floorH * 0.16;
      // granite surround
      ctx.fillStyle = '#a49c8e';
      ctx.fillRect(wx - 5, wy - 6, ww + 10, wh + 11);
      ctx.fillStyle = '#8a8276';
      ctx.fillRect(wx - 5, wy - 6, ww + 10, 4);            // lintel shadow
      ctx.fillRect(wx - 6, wy + wh + 2, ww + 12, 4);        // sill
      const state = rand();
      if (state < 0.34) {
        // boarded up
        ctx.fillStyle = '#191d22';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = '#4d3b26';
        for (let b = 0; b < 3; b++) {
          ctx.save();
          ctx.translate(wx + ww / 2, wy + (b + 0.5) * wh / 3);
          ctx.rotate((rand() - 0.5) * 0.25);
          ctx.fillRect(-ww / 2 - 3, -4, ww + 6, 7);
          ctx.restore();
        }
      } else if (state < 0.76) {
        // dark glass with painted shutters framing it, and glazing bars
        ctx.fillStyle = '#12171d';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = shutter;                            // open shutters at the sides
        ctx.fillRect(wx - 4, wy, 4, wh);
        ctx.fillRect(wx + ww, wy, 4, wh);
        ctx.strokeStyle = 'rgba(210,214,214,0.5)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1);
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.moveTo(wx, wy + wh * 0.5); ctx.lineTo(wx + ww, wy + wh * 0.5);
        ctx.stroke();
        // a few cracked panes
        if (rand() < 0.5) {
          ctx.strokeStyle = 'rgba(200,205,210,0.4)';
          ctx.lineWidth = 0.8;
          for (let s = 0; s < 3; s++) {
            ctx.beginPath();
            const gx = wx + rand() * ww, gy = wy + rand() * wh;
            ctx.moveTo(gx, gy); ctx.lineTo(gx + (rand() - 0.5) * 14, gy + (rand() - 0.5) * 14);
            ctx.stroke();
          }
        }
      } else {
        // hollow black — burned out
        ctx.fillStyle = '#0a0c0f';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = 'rgba(15,12,10,0.8)';
        ctx.fillRect(wx - 6, wy - 12, ww + 12, 10);
      }
      // wrought-iron balcony (guarda-corpo): every window on upper floors gets a
      // little French balcony with vertical balusters — the signature Ribeira detail
      if (f > 0 && rand() < 0.72) {
        const by = wy + wh + 3;
        const bx0 = wx - 6, bx1 = wx + ww + 6, bh = 11;
        ctx.strokeStyle = f % 2 ? '#20242a' : '#2a2620';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(bx0, by, bx1 - bx0, bh);            // top & bottom rail box
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let bar = bx0 + 2; bar <= bx1 - 2; bar += 3) { // balusters
          ctx.moveTo(bar, by); ctx.lineTo(bar, by + bh);
        }
        ctx.moveTo(bx0, by + bh * 0.5); ctx.lineTo(bx1, by + bh * 0.5); // mid rail
        ctx.stroke();
      }
    }
  }
  grimeStreaks(ctx, w, h, 24);
  mossPatches(ctx, w, h, 26, 0.4);
  // heavy moss at street level
  mossPatches(ctx, w, h, 20, 0.55);
  const grad = ctx.createLinearGradient(0, h - 34, 0, h);
  grad.addColorStop(0, 'rgba(35,45,28,0)');
  grad.addColorStop(1, 'rgba(35,45,28,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - 34, w, 34);
  return toTexture(c, 1, 1);
}

// Bare gable-end wall (empena): weathered plaster, cracks, grime — no windows.
// Rendered near-white so materials can tint it per house.
export function empenaTexture() {
  const [c, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = '#cfc9bc';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(${90 + rand() * 60},${85 + rand() * 55},${75 + rand() * 50},${0.08 + rand() * 0.14})`;
    ctx.fillRect(rand() * 128, rand() * 256, 8 + rand() * 40, 8 + rand() * 60);
  }
  // exposed granite patches where plaster fell
  for (let i = 0; i < 7; i++) {
    const px = rand() * 110, py = rand() * 230;
    ctx.fillStyle = '#8d867a';
    ctx.beginPath();
    ctx.ellipse(px + 10, py + 12, 8 + rand() * 14, 6 + rand() * 10, rand(), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,55,48,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // cracks
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(50,46,40,${0.3 + rand() * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let cx = rand() * 128, cy = rand() * 100;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (rand() - 0.5) * 22;
      cy += 12 + rand() * 24;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  grimeStreaks(ctx, 128, 256, 18);
  mossPatches(ctx, 128, 256, 16, 0.4);
  const grad = ctx.createLinearGradient(0, 220, 0, 256);
  grad.addColorStop(0, 'rgba(35,45,28,0)');
  grad.addColorStop(1, 'rgba(35,45,28,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 220, 128, 36);
  noiseOverlay(ctx, 128, 256, 0.06, 900);
  return toTexture(c, 1, 1);
}

// Overgrown cobblestone: v1 cobbles + moss growing in the joints.
export function mossyCobbleTexture(repeatX = 8, repeatY = 8) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#3f3d3a';
  ctx.fillRect(0, 0, 256, 256);
  const size = 24;
  for (let y = 0; y < 256 / size + 1; y++) {
    for (let x = 0; x < 256 / size + 1; x++) {
      const ox = (y % 2) * (size / 2);
      const g = 78 + Math.floor(rand() * 40);
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 6})`;
      ctx.beginPath();
      ctx.roundRect(x * size + ox + 1.5, y * size + 1.5, size - 4, size - 4, 5);
      ctx.fill();
    }
  }
  mossPatches(ctx, 256, 256, 60, 0.5);
  noiseOverlay(ctx, 256, 256, 0.07, 1400);
  return toTexture(c, repeatX, repeatY);
}

// Bump map matching cobble layout (grayscale height).
export function cobbleBumpTexture(repeatX = 8, repeatY = 8) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, 256, 256);
  const size = 24;
  for (let y = 0; y < 256 / size + 1; y++) {
    for (let x = 0; x < 256 / size + 1; x++) {
      const ox = (y % 2) * (size / 2);
      const px = x * size + ox + 1.5, py = y * size + 1.5;
      const g = ctx.createRadialGradient(px + size / 2 - 2, py + size / 2 - 2, 2, px + size / 2 - 2, py + size / 2 - 2, size / 2);
      g.addColorStop(0, '#e8e8e8');
      g.addColorStop(1, '#222');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(px, py, size - 4, size - 4, 5);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// São Bento hall: monumental blue azulejo mural wall (abstracted scenes).
export function azulejoMuralTexture() {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#dcd8c8';
  ctx.fillRect(0, 0, 512, 256);
  // tile grid
  ctx.strokeStyle = 'rgba(130,130,120,0.35)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 512; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  for (let y = 0; y <= 256; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  // painterly blue "scene": rolling hills, figures, horses — abstract strokes
  ctx.strokeStyle = '#31518e';
  ctx.fillStyle = '#31518e';
  ctx.lineWidth = 3;
  // hills
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 190 + i * 12);
    for (let x = 0; x <= 512; x += 32) {
      ctx.quadraticCurveTo(x + 16, 170 + i * 12 + rand() * 20, x + 32, 190 + i * 12);
    }
    ctx.stroke();
  }
  // figure clusters
  for (let i = 0; i < 9; i++) {
    const fx = 30 + rand() * 450, fy = 120 + rand() * 60;
    ctx.beginPath(); ctx.arc(fx, fy - 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(fx - 4, fy - 8, 8, 20);
    if (rand() < 0.5) { // banner / spear
      ctx.fillRect(fx + 5, fy - 30, 2, 34);
      ctx.fillRect(fx + 7, fy - 30, 12, 8);
    }
  }
  // sky flourishes
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const sx = rand() * 512, sy = 20 + rand() * 70;
    ctx.arc(sx, sy, 8 + rand() * 14, rand() * Math.PI, rand() * Math.PI + 2);
    ctx.stroke();
  }
  // ornate border
  ctx.fillStyle = '#24407e';
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillRect(0, 246, 512, 10);
  for (let x = 8; x < 512; x += 24) {
    ctx.beginPath(); ctx.arc(x, 10, 5, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(x, 246, 5, Math.PI, 0); ctx.fill();
  }
  // age: grime + a few missing tiles
  grimeStreaks(ctx, 512, 256, 20);
  for (let i = 0; i < 14; i++) {
    const tx = Math.floor(rand() * 32) * 16, ty = Math.floor(rand() * 16) * 16;
    ctx.fillStyle = '#8d8578';
    ctx.fillRect(tx, ty, 16, 16);
  }
  mossPatches(ctx, 512, 256, 10, 0.3);
  return toTexture(c, 1, 1);
}

// Interior stone floor (São Bento / caves)
export function stoneFloorTexture(repeatX = 6, repeatY = 6) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#6a655c';
  ctx.fillRect(0, 0, 256, 256);
  const s = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const g = 95 + Math.floor(rand() * 28);
      ctx.fillStyle = `rgb(${g},${g - 3},${g - 10})`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  }
  ctx.strokeStyle = 'rgba(40,36,30,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(256, i * s); ctx.stroke();
  }
  noiseOverlay(ctx, 256, 256, 0.06, 1200);
  grimeStreaks(ctx, 256, 256, 12);
  return toTexture(c, repeatX, repeatY);
}

// Ivy sheet: transparent leafy patch for draping over walls.
export function ivyTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 240; i++) {
    const x = 64 + (rand() - 0.5) * 118;
    const y = 64 + (rand() - 0.5) * 118;
    const d = Math.hypot(x - 64, y - 64);
    if (d > 62) continue;
    const green = 45 + rand() * 45;
    ctx.fillStyle = `rgba(${green * 0.55},${green},${green * 0.4},${0.75 + rand() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + rand() * 4, 2 + rand() * 3, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Warehouse corrugated metal --------------------------------------------
export function metalTexture(repeatX = 6, repeatY = 2) {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#5a6068';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(x, 0, 3, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 5, 0, 3, 128);
  }
  // rust streaks
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(${120 + rand() * 60},${55 + rand() * 25},20,${0.1 + rand() * 0.22})`;
    const sx = rand() * 128;
    ctx.fillRect(sx, rand() * 60, 2 + rand() * 4, 24 + rand() * 70);
  }
  noiseOverlay(ctx, 128, 128, 0.06, 500);
  return toTexture(c, repeatX, repeatY);
}
