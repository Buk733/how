import * as THREE from 'three';

// Свет кадра. Мир рисуется материалами без освещения (тени и объём «запечены» в картинки),
// поэтому настроение задаётся двумя приёмами:
// - цветокоррекция каждого пикселя прямо в шейдерах (через CustomToneMapping Three.js — без лишнего прохода);
// - экранный засвет: тёплое солнце с края кадра, его лучи и мягкое затемнение углов — один прозрачный слой поверх сцены.

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

/** Экранный засвет: солнце за краем кадра, его лучи и затемнение углов. */
export interface ScreenLightOptions {
  /** Где солнце: доли кадра от левого нижнего угла, может быть за краем. Радиус — в долях высоты кадра. */
  readonly sun: { readonly x: number; readonly y: number; readonly radius: number; readonly color: string; readonly strength: number };
  /** Лучи от солнца: сила, докуда достают (в долях высоты кадра) и как быстро колышутся (0 — замерли). */
  readonly rays: { readonly strength: number; readonly length: number; readonly sway: number };
  /** Затемнение углов: с какого расстояния от центра (0 — центр, 1 — угол) начинается и насколько тёмное в углу. */
  readonly vignette: { readonly color: string; readonly from: number; readonly strength: number };
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

const overlayVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Выход — с заранее умноженной прозрачностью: засвет солнца прибавляется к кадру, затемнение — накрывает его.
const overlayFragment = /* glsl */ `
  uniform float aspect;
  uniform vec2 sunPosition;
  uniform float sunRadius;
  uniform vec3 sunColor;
  uniform float sunStrength;
  uniform float rayStrength;
  uniform float rayLength;
  uniform float time;
  uniform vec3 vignetteColor;
  uniform float vignetteFrom;
  uniform float vignetteStrength;
  varying vec2 vUv;
  void main() {
    vec2 toSun = (vUv - sunPosition) * vec2(aspect, 1.0);
    float sun = 1.0 - clamp(length(toSun) / sunRadius, 0.0, 1.0);
    // лучи — полосы по углу от солнца: два синуса разной частоты дают неровные, медленно плывущие полосы
    float angle = atan(toSun.y, toSun.x);
    float rays = smoothstep(0.35, 1.0, (0.5 + 0.5 * sin(angle * 23.0 + time * 0.7)) * (0.5 + 0.5 * sin(angle * 37.0 - time * 0.45)) * 1.6);
    float reach = 1.0 - clamp(length(toSun) / rayLength, 0.0, 1.0);
    vec3 glow = sunColor * (sun * sun * sunStrength + rays * reach * reach * rayStrength);
    float corner = length((vUv - 0.5) * 2.0) / sqrt(2.0);
    float shade = smoothstep(vignetteFrom, 1.0, corner) * vignetteStrength;
    gl_FragColor = vec4(glow * (1.0 - shade) + vignetteColor * shade, shade);
  }
`;

/** Экранный засвет: прозрачный слой во весь кадр, рисуется последним. Добавить `mesh` в сцену. */
export class ScreenLight {
  readonly mesh: THREE.Mesh;
  private readonly aspect: THREE.IUniform<number> = { value: 1 };
  private readonly time: THREE.IUniform<number> = { value: 0 };
  private readonly sway: number;

  constructor(options: ScreenLightOptions) {
    // один треугольник, который накрывает весь экран
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.sway = options.rays.sway;
    const material = new THREE.ShaderMaterial({
      vertexShader: overlayVertex,
      fragmentShader: overlayFragment,
      uniforms: {
        aspect: this.aspect,
        sunPosition: { value: new THREE.Vector2(options.sun.x, options.sun.y) },
        sunRadius: { value: options.sun.radius },
        sunColor: { value: new THREE.Vector3(...srgb(options.sun.color)) },
        sunStrength: { value: options.sun.strength },
        rayStrength: { value: options.rays.strength },
        rayLength: { value: options.rays.length },
        time: this.time,
        vignetteColor: { value: new THREE.Vector3(...srgb(options.vignette.color)) },
        vignetteFrom: { value: options.vignette.from },
        vignetteStrength: { value: options.vignette.strength },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = Number.MAX_SAFE_INTEGER;
  }

  /** Отношение ширины кадра к высоте — чтобы пятно солнца было круглым. */
  setAspect(aspect: number): void {
    this.aspect.value = aspect;
  }

  /** Лучи понемногу колышутся. */
  update(dt: number): void {
    // время по кругу: синусам всё равно, а точность float в шейдере не падает
    this.time.value = (this.time.value + dt * this.sway) % 1000;
  }
}
