// CINZA — player settings: input feel, brightness, volume, and a quality preset.
// Persisted in localStorage so a returning player keeps their setup.
const KEY = 'cinza.settings';

export const Settings = {
  sensitivity: 1.0,   // multiplier on look speed
  brightness: 1.0,    // multiplier on tone-mapping exposure
  volume: 1.0,        // multiplier on the audio master gain
  quality: 'high',    // high | medium | low
};

const BASE_EXPOSURE = 1.18;
const BASE_VOLUME = 0.68;

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(Settings, JSON.parse(raw));
  } catch (e) { /* private mode / corrupt value — keep defaults */ }
  return Settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(Settings)); } catch (e) { /* ignore */ }
}

// Quality presets trade resolution and post-processing for frame time, so the game
// stays playable on integrated graphics without punishing a fast machine.
const PRESETS = {
  high:   { pixelCap: 2,   shadow: 2048, bloom: true,  smaa: true,  shadows: true },
  medium: { pixelCap: 1.5, shadow: 1024, bloom: true,  smaa: false, shadows: true },
  low:    { pixelCap: 1,   shadow: 512,  bloom: false, smaa: false, shadows: false },
};

export function applySettings({ renderer, composer, audio, world, bloomPass, smaaPass }) {
  // brightness
  if (renderer) renderer.toneMappingExposure = BASE_EXPOSURE * Settings.brightness;
  // volume
  if (audio && audio.master) audio.master.gain.value = BASE_VOLUME * Settings.volume;
  audio && (audio.volumeScale = Settings.volume);

  const p = PRESETS[Settings.quality] || PRESETS.high;
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = p.shadows;
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  }
  if (bloomPass) bloomPass.enabled = p.bloom;
  if (smaaPass) smaaPass.enabled = p.smaa;

  // resize the sun's shadow map only when the preset actually changes it
  const sun = world && world.sun;
  if (sun && sun.shadow.mapSize.width !== p.shadow) {
    sun.shadow.mapSize.set(p.shadow, p.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
}
