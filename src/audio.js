// CINZA — all audio synthesized with WebAudio, no asset files.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.droneNodes = null;
    this.heartbeatOn = false;
    this.heartT = 0;
    this.crowT = 8;
    this.listener = null;     // camera, set by main — for positional audio
    this.maxAudible = 60;
    this._dest = null;        // temp routing target for the current play() call
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.68;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 6;
    }
    return buf;
  }

  startAmbience() {
    // river hush
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 360;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.28;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain).connect(filt.frequency);
    src.connect(filt).connect(gain).connect(this.master);
    src.start();
    lfo.start();

    // desolate wind — stronger than v1, it carries the mood
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(3);
    wind.loop = true;
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 700;
    wf.Q.value = 0.5;
    const wg = this.ctx.createGain();
    wg.gain.value = 0.09;
    const wlfo = this.ctx.createOscillator();
    wlfo.frequency.value = 0.06;
    const wlfoG = this.ctx.createGain();
    wlfoG.gain.value = 300;
    wlfo.connect(wlfoG).connect(wf.frequency);
    wind.connect(wf).connect(wg).connect(this.master);
    wind.start();
    wlfo.start();
  }

  blip(freq, dur, gainV, type = 'sine', when = 0, freqEnd = null) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainV, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this._dest || this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noiseBurst(dur, gainV, filterFreq, when = 0, type = 'lowpass') {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.1);
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainV, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this._dest || this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  // build a stereo-panned, distance-attenuated routing node for a world position
  spatialDest(pos) {
    if (!pos || !this.listener || !this.ctx.createStereoPanner) return null;
    const cp = this.listener.position;
    const dx = pos.x - cp.x, dy = pos.y - cp.y, dz = pos.z - cp.z;
    const dist = Math.hypot(dx, dy, dz) || 0.001;
    if (dist > this.maxAudible) return 'silent';
    const gn = this.ctx.createGain();
    gn.gain.value = Math.pow(1 - dist / this.maxAudible, 1.5);
    const e = this.listener.matrixWorld.elements; // camera right vector = column 0
    const pan = Math.max(-1, Math.min(1, (dx * e[0] + dy * e[1] + dz * e[2]) / dist));
    const sp = this.ctx.createStereoPanner();
    sp.pan.value = pan;
    sp.connect(gn).connect(this.master);
    return sp;
  }

  crowCry() {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const start = i * (0.3 + Math.random() * 0.15);
      this.blip(420 + Math.random() * 80, 0.16, 0.022, 'sawtooth', start, 300);
    }
  }

  tick(dt) {
    if (!this.ctx) return;
    this.crowT -= dt;
    if (this.crowT <= 0) {
      this.crowT = 9 + Math.random() * 16;
      this.crowCry();
    }
    if (this.heartbeatOn) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.85;
        this.blip(58, 0.14, 0.16, 'sine');
        this.blip(52, 0.12, 0.12, 'sine', 0.18);
      }
    }
  }

  setHeartbeat(on) { this.heartbeatOn = on; }

  play(name, pos = null) {
    if (!this.ctx) return;
    if (pos) {
      const dest = this.spatialDest(pos);
      if (dest === 'silent') return;   // too far to hear
      this._dest = dest;
    }
    try {
      this._playInner(name);
    } finally {
      this._dest = null;
    }
  }

  _playInner(name) {
    switch (name) {
      case 'step':
        this.noiseBurst(0.09, 0.05 + Math.random() * 0.03, 280 + Math.random() * 140);
        this.blip(70 + Math.random() * 20, 0.05, 0.02, 'sine');
        break;
      case 'stepRun':
        // heavier, louder — a real footfall you (and the infected) can hear
        this.noiseBurst(0.12, 0.11 + Math.random() * 0.04, 340 + Math.random() * 160);
        this.blip(58 + Math.random() * 22, 0.09, 0.06, 'sine', 0, 42);
        break;
      case 'land':
        this.noiseBurst(0.16, 0.16, 240);
        this.blip(52, 0.12, 0.1, 'sine', 0, 34);
        break;
      case 'stepInfected':
        // wet, dragging shuffle
        this.noiseBurst(0.14, 0.05, 500, 0, 'bandpass');
        this.blip(60, 0.08, 0.03, 'sawtooth', 0, 40);
        break;
      case 'stepBoot':
        // scavenger's hard boot on stone
        this.noiseBurst(0.07, 0.06, 900, 0, 'bandpass');
        this.blip(90, 0.05, 0.035, 'square', 0, 60);
        break;
      case 'pickup':
        this.blip(620, 0.16, 0.05);
        this.blip(930, 0.2, 0.04, 'sine', 0.08);
        break;
      case 'objective':
        this.blip(392, 0.3, 0.045);
        this.blip(494, 0.34, 0.045, 'sine', 0.14);
        this.blip(587, 0.5, 0.045, 'sine', 0.28);
        break;
      case 'dialogue':
        this.blip(420, 0.07, 0.028, 'triangle');
        break;
      case 'click':
        this.blip(1400, 0.03, 0.04, 'square');
        break;
      case 'throw':
        this.noiseBurst(0.15, 0.05, 1900);
        break;
      case 'brickLand':
        this.noiseBurst(0.12, 0.14, 800);
        this.blip(140, 0.09, 0.07, 'triangle', 0.01);
        break;
      case 'brickHit':
        this.noiseBurst(0.1, 0.12, 600);
        this.blip(90, 0.12, 0.09, 'triangle');
        break;
      case 'swing':
        // a real whoosh — air moving past the plank
        this.noiseBurst(0.16, 0.14, 1700, 0, 'bandpass');
        this.blip(320, 0.12, 0.05, 'sine', 0, 120);
        break;
      case 'revolverFire':
        // sharp crack + low thump + tail
        this.noiseBurst(0.04, 0.5, 5000, 0, 'highpass');
        this.noiseBurst(0.12, 0.4, 1200);
        this.blip(90, 0.14, 0.28, 'sawtooth', 0, 45);
        this.noiseBurst(0.55, 0.06, 600, 0.05); // reverb tail off the buildings
        break;
      case 'shotgunFire':
        this.noiseBurst(0.06, 0.6, 3500);
        this.noiseBurst(0.2, 0.5, 700);
        this.blip(70, 0.2, 0.32, 'sawtooth', 0, 38);
        this.noiseBurst(0.8, 0.08, 500, 0.06);
        break;
      case 'dryFire':
        this.blip(1800, 0.02, 0.06, 'square');
        this.noiseBurst(0.03, 0.05, 3000, 0.01, 'highpass');
        break;
      case 'reloadStart':
        this.blip(900, 0.03, 0.05, 'square');
        this.noiseBurst(0.05, 0.06, 1500, 0.1, 'bandpass');
        break;
      case 'reloadDone':
        this.noiseBurst(0.05, 0.08, 1200, 0, 'bandpass');
        this.blip(1200, 0.04, 0.07, 'square', 0.05); // cylinder snap / breech close
        break;
      case 'weaponSwitch':
        this.noiseBurst(0.04, 0.04, 2000, 0, 'bandpass');
        break;
      case 'hitFlesh':
        this.noiseBurst(0.1, 0.22, 520);
        this.blip(120, 0.12, 0.12, 'triangle', 0.01, 70);
        break;
      case 'meleeHit':
        // plank meeting body: a heavy wet thwack with a woody crack on top
        this.noiseBurst(0.12, 0.34, 430);
        this.blip(95, 0.16, 0.2, 'triangle', 0, 55);
        this.noiseBurst(0.05, 0.22, 2600, 0, 'bandpass'); // the wood
        break;
      case 'meleeConnect':
        // crisp confirm tick that cuts through — the "you hit it" cue
        this.blip(1500, 0.03, 0.12, 'square', 0, 900);
        this.blip(760, 0.05, 0.08, 'square', 0.02);
        break;
      case 'stepCrouch':
        this.noiseBurst(0.07, 0.02, 220);
        break;
      case 'focusIn':
        // a held breath — the world narrowing to a heartbeat
        this.blip(140, 0.6, 0.06, 'sine', 0, 70);
        this.noiseBurst(0.5, 0.035, 260, 0, 'lowpass');
        break;
      case 'molotov':
        // glass shatter → whoosh of ignition → a crackling tail
        this.noiseBurst(0.06, 0.34, 4200, 0, 'highpass');
        this.blip(2400, 0.04, 0.09, 'square', 0, 800);
        this.noiseBurst(0.55, 0.3, 850, 0.03);
        this.noiseBurst(1.3, 0.12, 1500, 0.12, 'bandpass');
        break;
      case 'craft':
        // parts coming together — a scrape of cloth/metal, then a soft settling click
        this.noiseBurst(0.16, 0.05, 1300, 0, 'bandpass');
        this.blip(520, 0.07, 0.05, 'triangle', 0.07, 360);
        break;
      case 'takedown':
        // muffled struggle + wet crunch, quiet so it stays stealthy
        this.noiseBurst(0.18, 0.09, 380);
        this.blip(85, 0.14, 0.06, 'triangle', 0.04);
        this.noiseBurst(0.1, 0.06, 900, 0.1, 'bandpass');
        break;
      case 'hurt':
        this.blip(180, 0.18, 0.1, 'sawtooth', 0, 120);
        this.noiseBurst(0.12, 0.08, 900, 0.02);
        break;
      case 'bandage':
        this.noiseBurst(0.35, 0.05, 1400, 0, 'bandpass');
        this.blip(520, 0.25, 0.04, 'sine', 0.3);
        break;
      case 'splash':
        this.noiseBurst(0.5, 0.2, 700);
        break;
      case 'errante': {
        // wet, guttural groan — layered, rasping, much more present
        const f = 82 + Math.random() * 44;
        this.blip(f, 0.85, 0.16, 'sawtooth', 0, f * 0.55);
        this.blip(f * 1.5, 0.6, 0.07, 'sawtooth', 0.05, f * 0.9);
        this.noiseBurst(0.7, 0.11, 520, 0.02);       // breath rasp
        this.noiseBurst(0.25, 0.06, 1600, 0.4, 'bandpass'); // wet gurgle tail
        break;
      }
      case 'eco': {
        // signature echolocation clicks — sharp, loud, unmistakable
        const k = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < k; i++) {
          this.noiseBurst(0.025, 0.2, 3000 + Math.random() * 900, i * (0.06 + Math.random() * 0.03), 'bandpass');
        }
        this.blip(150, 0.5, 0.08, 'sawtooth', k * 0.07, 78); // rattling exhale
        this.noiseBurst(0.4, 0.05, 700, k * 0.07);
        break;
      }
      case 'corvo': {
        // scavengers muttering / calling to each other
        const words = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < words; i++) {
          const base = 130 + Math.random() * 70;
          this.blip(base, 0.14, 0.09, 'sawtooth', i * 0.22, base * 1.3);
          this.blip(base * 2.2, 0.1, 0.03, 'square', i * 0.22 + 0.02);
        }
        break;
      }
      case 'chaseRoar': {
        // infected has locked on — a rising shriek, loud and awful
        this.blip(120, 0.6, 0.22, 'sawtooth', 0, 620);
        this.blip(200, 0.55, 0.14, 'sawtooth', 0.03, 900);
        this.noiseBurst(0.5, 0.16, 1800, 0.05);
        this.noiseBurst(0.35, 0.1, 3200, 0.1, 'highpass');
        break;
      }
      case 'corvoAlert': {
        // human shout — "ALI! APANHA-A!"
        this.blip(180, 0.22, 0.16, 'sawtooth', 0, 260);
        this.blip(150, 0.26, 0.14, 'sawtooth', 0.26, 210);
        this.blip(240, 0.2, 0.1, 'square', 0.5, 300);
        break;
      }
      case 'corvoShot': {
        // a Corvo's old rifle — flatter, drier crack than yours, with a slap-back
        this.noiseBurst(0.035, 0.4, 4200, 0, 'highpass');
        this.noiseBurst(0.1, 0.32, 1000);
        this.blip(100, 0.1, 0.2, 'sawtooth', 0, 52);
        this.noiseBurst(0.4, 0.05, 550, 0.06);
        break;
      }
      case 'attackSnarl':
        this.blip(140, 0.3, 0.09, 'sawtooth', 0, 70);
        this.noiseBurst(0.25, 0.09, 1100, 0.02);
        break;
      case 'infectedDown':
        this.blip(120, 0.5, 0.07, 'sawtooth', 0, 45);
        this.noiseBurst(0.3, 0.1, 500, 0.15);
        break;
      case 'manDown':
        this.blip(200, 0.25, 0.06, 'sawtooth', 0, 90);
        this.noiseBurst(0.3, 0.1, 450, 0.1);
        break;
      case 'death':
        this.blip(160, 1.6, 0.1, 'sawtooth', 0, 40);
        this.noiseBurst(1.2, 0.1, 300, 0.2);
        break;
      case 'success':
        this.blip(392, 0.35, 0.05);
        this.blip(494, 0.35, 0.05, 'sine', 0.2);
        this.blip(587, 0.4, 0.05, 'sine', 0.4);
        this.blip(784, 0.9, 0.05, 'sine', 0.6);
        break;
    }
  }

  setDrone(on) {
    if (!this.ctx) return;
    if (on && !this.droneNodes) {
      const o1 = this.ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 48;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = 48.6;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 160;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2.5);
      o1.connect(filt);
      o2.connect(filt);
      filt.connect(g).connect(this.master);
      o1.start();
      o2.start();
      this.droneNodes = { o1, o2, g };
    } else if (!on && this.droneNodes) {
      const { o1, o2, g } = this.droneNodes;
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
      setTimeout(() => { try { o1.stop(); o2.stop(); } catch (e) { /* stopped */ } }, 1800);
      this.droneNodes = null;
    }
  }
}
