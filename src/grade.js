// CINZA — cinematic color grade (operates in display/sRGB space, after tone-mapping).
// Contrast + saturation shaping, teal-shadow / warm-highlight split-tone,
// vignette, and a faint animated film grain. Tuned for a somber, overgrown-ruin mood.
import * as THREE from 'three';

export const CinemaGrade = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.32 },
    uContrast: { value: 1.10 },
    uSaturation: { value: 0.94 },
    uGrain: { value: 0.045 },
    uLift: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uGrain;
    uniform float uLift;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      // lift shadows slightly so pure black never crushes to a void
      col = col + uLift;

      // contrast around mid-grey
      col = (col - 0.5) * uContrast + 0.5;

      // saturation
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, uSaturation);

      // split-tone: cool teal in shadows, warm amber in highlights
      vec3 shadowTint = vec3(0.86, 0.98, 1.06);
      vec3 highTint   = vec3(1.06, 1.0, 0.88);
      float t = smoothstep(0.15, 0.85, luma);
      col *= mix(shadowTint, highTint, t);

      // vignette
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.85, 0.28, dot(d, d) * 2.2);
      col *= mix(1.0 - uVignette, 1.0, vig);

      // animated film grain, stronger in the dark
      float g = hash(vUv * uResolution + fract(uTime) * 431.0) - 0.5;
      col += g * uGrain * (1.2 - luma);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
