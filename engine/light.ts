import * as THREE from 'three';

// Свет кадра. Мир рисуется материалами без освещения (тени и объём «запечены» в картинки),
// поэтому настроение задаётся двумя приёмами:
// - цветокоррекция каждого пикселя прямо в шейдерах (через CustomToneMapping Three.js — без лишнего прохода);
// - мягкое затемнение углов — один прозрачный слой поверх сцены.

/** Цветокоррекция. Все цвета и числа — в привычном пространстве sRGB, как в редакторе картинок. */
export interface ColorGrade {
  /** Общая яркость: 1 — как есть. */
  readonly exposure: number;
  /** Баланс белого — множители каналов: красный больше, синий меньше — теплее. */
  readonly balance: readonly [number, number, number];
  /**
   * Зелень к жёлтому: насколько зелёный канал выше двух других — такая доля прибавляется к красному
   * и убирается из синего. Мятная трава становится солнечной, а кожа, дерево и белый не меняются.
   */
  readonly greens: { readonly red: number; readonly blue: number };
  /** Насыщенность: 1 — как есть, больше — сочнее. */
  readonly saturation: number;
  /** Сила S-кривой контраста: 0 — как есть, 1 — полная. */
  readonly contrast: number;
  /** Оттенок теней и светов: сдвиг от серого #808080 (серый — без изменений) и его сила. */
  readonly shadows: { readonly tint: string; readonly amount: number };
  readonly highlights: { readonly tint: string; readonly amount: number };
}

/** Затемнение углов: с какого расстояния от центра (0 — центр, 1 — угол) начинается, цвет и насколько тёмное в углу. */
export interface VignetteOptions {
  readonly color: string;
  readonly from: number;
  readonly strength: number;
}

/** Цвет из «#rrggbb» как есть, без перевода в линейное пространство: шейдеры ниже работают в sRGB. */
function srgb(hex: string): [number, number, number] {
  const color = new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
  return [color.r, color.g, color.b];
}

const glslNumber = (value: number) => (Number.isInteger(value) ? `${value}.0` : String(value));
const glslVec3 = ([r, g, b]: readonly number[]) => `vec3(${glslNumber(r)}, ${glslNumber(g)}, ${glslNumber(b)})`;

/** Яркость по весам Rec. 601 — те же в шейдере и в gradeColor. */
const LUMA = [0.299, 0.587, 0.114] as const;

/** Функция цветокоррекции на GLSL: получает линейный цвет, возвращает линейный. */
export function gradeGlsl(grade: ColorGrade): string {
  const shadowShift = srgb(grade.shadows.tint).map((c) => c - 0.5);
  const highlightShift = srgb(grade.highlights.tint).map((c) => c - 0.5);
  return /* glsl */ `
    vec3 CustomToneMapping( vec3 color ) {
      vec3 c = pow( max( color, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
      c *= ${glslNumber(grade.exposure)} * ${glslVec3(grade.balance)};
      float green = max( c.g - max( c.r, c.b ), 0.0 );
      c += green * vec3( ${glslNumber(grade.greens.red)}, 0.0, ${glslNumber(-grade.greens.blue)} );
      float l = dot( c, ${glslVec3(LUMA)} );
      c = mix( vec3( l ), c, ${glslNumber(grade.saturation)} );
      float dark = ( 1.0 - clamp( l, 0.0, 1.0 ) ) * ( 1.0 - clamp( l, 0.0, 1.0 ) );
      c += ${glslVec3(shadowShift)} * dark * ${glslNumber(grade.shadows.amount)};
      c += ${glslVec3(highlightShift)} * smoothstep( 0.45, 1.0, l ) * ${glslNumber(grade.highlights.amount)};
      c = clamp( c, 0.0, 1.0 );
      c = mix( c, c * c * ( 3.0 - 2.0 * c ), ${glslNumber(grade.contrast)} );
      return pow( c, vec3( 2.2 ) );
    }
  `;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Та же цветокоррекция для цвета, заданного в коде («#rrggbb» → «#rrggbb»). Нужна для неба и тумана:
 * Three.js подмешивает туман и заливает фон уже после цветокоррекции, и без неё они остались бы холодными.
 */
export function gradeColor(grade: ColorGrade, hex: string): string {
  const shadowShift = srgb(grade.shadows.tint).map((c) => c - 0.5);
  const highlightShift = srgb(grade.highlights.tint).map((c) => c - 0.5);
  let c = srgb(hex).map((v, i) => v * grade.exposure * grade.balance[i]);
  const green = Math.max(c[1] - Math.max(c[0], c[2]), 0);
  c = [c[0] + green * grade.greens.red, c[1], c[2] - green * grade.greens.blue];
  const l = c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
  const dark = (1 - Math.min(Math.max(l, 0), 1)) ** 2;
  const light = smoothstep(0.45, 1, l);
  c = c.map((v, i) => l + (v - l) * grade.saturation + shadowShift[i] * dark * grade.shadows.amount + highlightShift[i] * light * grade.highlights.amount);
  c = c.map((v) => {
    const x = Math.min(Math.max(v, 0), 1);
    return x + (x * x * (3 - 2 * x) - x) * grade.contrast;
  });
  return `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Включает цветокоррекцию для всех материалов, которые рисуются на экран. Вызывать до первой отрисовки.
 * Свои ShaderMaterial должны подключать `#include <tonemapping_fragment>` перед `<colorspace_fragment>`.
 */
export function applyColorGrade(renderer: THREE.WebGLRenderer, grade: ColorGrade): void {
  const stub = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (!TONEMAPPING_CHUNK.includes(stub)) throw new Error('Шейдеры Three.js изменились: нет заглушки CustomToneMapping');
  // заменяем в исходном куске: повторный вызов не наслаивает коррекцию
  THREE.ShaderChunk.tonemapping_pars_fragment = TONEMAPPING_CHUNK.replace(stub, gradeGlsl(grade));
  renderer.toneMapping = THREE.CustomToneMapping;
}

const TONEMAPPING_CHUNK = THREE.ShaderChunk.tonemapping_pars_fragment;

const vignetteVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const vignetteFragment = /* glsl */ `
  uniform vec3 vignetteColor;
  uniform float vignetteFrom;
  uniform float vignetteStrength;
  varying vec2 vUv;
  void main() {
    float corner = length((vUv - 0.5) * 2.0) / sqrt(2.0);
    gl_FragColor = vec4(vignetteColor, smoothstep(vignetteFrom, 1.0, corner) * vignetteStrength);
  }
`;

/** Затемнение углов: прозрачный слой во весь кадр, рисуется последним. Добавить в сцену. */
export function createVignette(options: VignetteOptions): THREE.Mesh {
  // один треугольник, который накрывает весь экран
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: vignetteVertex,
    fragmentShader: vignetteFragment,
    uniforms: {
      vignetteColor: { value: new THREE.Vector3(...srgb(options.color)) },
      vignetteFrom: { value: options.from },
      vignetteStrength: { value: options.strength },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = Number.MAX_SAFE_INTEGER;
  return mesh;
}
