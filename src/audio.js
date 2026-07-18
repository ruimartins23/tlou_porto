// CINZA — all audio synthesized with WebAudio, no asset files.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.droneNodes = null;
    this.heartbeatOn = false;
    this.heartT = 0;
    this.crowT = 8;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
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
    osc.connect(g).connect(this.master);
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
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
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

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'step':
        this.noiseBurst(0.09, 0.055 + Math.random() * 0.03, 280 + Math.random() * 140);
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
        this.noiseBurst(0.14, 0.06, 2400, 0, 'bandpass');
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
        this.noiseBurst(0.09, 0.16, 500);
        this.blip(110, 0.1, 0.08, 'triangle', 0.01);
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
        // wet groan
        const f = 90 + Math.random() * 50;
        this.blip(f, 0.7, 0.045, 'sawtooth', 0, f * 0.6);
        this.noiseBurst(0.5, 0.02, 400, 0.05);
        break;
      }
      case 'eco': {
        // signature echolocation clicks
        const k = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < k; i++) {
          this.noiseBurst(0.03, 0.09, 2600 + Math.random() * 800, i * (0.07 + Math.random() * 0.03), 'bandpass');
        }
        this.blip(160, 0.4, 0.03, 'sawtooth', k * 0.08, 90);
        break;
      }
      case 'corvo':
        this.blip(240, 0.12, 0.02, 'square', 0, 200); // whistle-ish signal between scavengers
        this.blip(320, 0.14, 0.018, 'square', 0.2, 260);
        break;
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
