import * as THREE from 'three';

/** Описание листа спрайтов: картинка, разбитая на одинаковые кадры. */
export interface SpriteSheetDef {
  /** URL картинки (PNG). */
  readonly url: string;
  /** Размер одного кадра в пикселях. */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Сколько пикселей картинки приходится на 1 единицу мира. */
  readonly pixelsPerUnit: number;
}

/** Загруженный лист спрайтов. */
export interface SpriteSheet extends SpriteSheetDef {
  readonly texture: THREE.Texture;
  readonly columns: number;
  readonly rows: number;
}

/**
 * Глубина «стоячей фигуры» для вершинного шейдера билборда. Картинка повёрнута к камере, а камера
 * смотрит сверху, поэтому в 3D билборд наклонён назад: его верх уходит за точку опоры — в скамейку,
 * печь или стену за спиной персонажа, и они «съедают» голову и туловище. Картинка остаётся прежней,
 * а в буфер глубины пишется глубина вертикальной карточки, стоящей в точке опоры: персонаж перед
 * препятствием виден целиком, за ним — прячется, при любом повороте камеры.
 * offsetY — высота угла над точкой опоры по экрану (в единицах камеры), mvPosition — сам угол.
 */
export function uprightDepthGlsl(offsetY: string): string {
  return /* glsl */ `
    {
      vec3 worldUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      // точка вертикальной карточки, которая видна на том же месте экрана: выше и ближе к камере
      float lift = (${offsetY}) / max(worldUp.y, 0.2);
      vec4 upright = projectionMatrix * vec4(mvPosition.xy, mvPosition.z + worldUp.z * lift, 1.0);
      gl_Position.z = upright.z / upright.w * gl_Position.w;
    }
  `;
}

/** Материал спрайта с глубиной стоячей фигуры (uprightDepthGlsl). */
function standUpright(material: THREE.SpriteMaterial): THREE.SpriteMaterial {
  material.onBeforeCompile = (shader) => {
    const anchor = 'gl_Position = projectionMatrix * mvPosition;';
    if (!shader.vertexShader.includes(anchor)) throw new Error('Шейдер спрайта Three.js изменился: нет строки с gl_Position');
    shader.vertexShader = shader.vertexShader.replace(anchor, `${anchor}\n${uprightDepthGlsl('rotatedPosition.y')}`);
  };
  material.customProgramCacheKey = () => 'upright-depth';
  return material;
}

/**
 * «Вырезанный» материал: пиксель либо виден полностью, либо прозрачен.
 * Так спрайты правильно перекрывают друг друга без сортировки.
 */
function cutoutMaterial(map: THREE.Texture): THREE.SpriteMaterial {
  return standUpright(new THREE.SpriteMaterial({ map, alphaTest: 0.5, transparent: false }));
}

/** Копия текстуры листа со своим смещением кадра. Сама картинка при этом общая. */
function frameTexture(sheet: SpriteSheet): THREE.Texture {
  const texture = sheet.texture.clone();
  texture.repeat.set(1 / sheet.columns, 1 / sheet.rows);
  return texture;
}

function setTextureFrame(texture: THREE.Texture, sheet: SpriteSheet, column: number, row: number): void {
  texture.offset.set(column / sheet.columns, 1 - (row + 1) / sheet.rows);
}

function configureSprite(sprite: THREE.Sprite, sheet: SpriteSheet): THREE.Sprite {
  sprite.center.set(0.5, 0); // точка привязки — середина нижнего края: спрайт «стоит» на земле
  sprite.scale.set(sheet.frameWidth / sheet.pixelsPerUnit, sheet.frameHeight / sheet.pixelsPerUnit, 1);
  return sprite;
}

/**
 * Анимируемый спрайт-«билборд»: плоская картинка в 3D-мире, всегда повёрнутая к камере.
 * Позиция объекта — точка, где спрайт касается земли.
 */
export class BillboardSprite {
  readonly object: THREE.Sprite;
  readonly sheet: SpriteSheet;
  private readonly texture: THREE.Texture;
  private readonly baseScale: THREE.Vector2;
  private silhouette: THREE.Sprite | null = null;

  constructor(sheet: SpriteSheet) {
    this.sheet = sheet;
    this.texture = frameTexture(sheet);
    this.object = configureSprite(new THREE.Sprite(cutoutMaterial(this.texture)), sheet);
    this.baseScale = new THREE.Vector2(this.object.scale.x, this.object.scale.y);
    this.setFrame(0, 0);
  }

  /** Показывает кадр: column — номер кадра в ряду, row — ряд (например, направление взгляда). */
  setFrame(column: number, row = 0): void {
    setTextureFrame(this.texture, this.sheet, column, row);
  }

  /** «Сплющивание» для живости: squash > 0 — ниже и шире, < 0 — выше и уже. Ноги остаются на земле. */
  setSquash(squash: number): void {
    this.object.scale.set(this.baseScale.x * (1 + squash), this.baseScale.y * (1 - squash), 1);
  }

  /**
   * Полупрозрачный силуэт, который виден, когда спрайт закрыт другими объектами
   * (например, игрок зашёл за стену).
   */
  enableSilhouette(color: THREE.ColorRepresentation = '#1a1c2c', opacity = 0.45): void {
    if (this.silhouette) return;
    // та же глубина, что у самого спрайта: иначе силуэт ляжет поверх собственной картинки
    const material = standUpright(new THREE.SpriteMaterial({
      map: this.texture,
      color,
      opacity,
      alphaTest: 0.5,
      transparent: true,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
      fog: false,
    }));
    // Дочерний спрайт наследует масштаб родителя, поэтому свой масштаб — единичный.
    this.silhouette = new THREE.Sprite(material);
    this.silhouette.center.set(0.5, 0);
    this.silhouette.renderOrder = 1;
    this.object.add(this.silhouette);
  }

  dispose(): void {
    this.texture.dispose();
    this.object.material.dispose();
    this.silhouette?.material.dispose();
  }
}

const staticMaterials = new WeakMap<SpriteSheet, Map<number, THREE.SpriteMaterial>>();

/** Неподвижный спрайт с одним кадром. Спрайты с одинаковым кадром делят один материал. */
export function createStaticSprite(sheet: SpriteSheet, column = 0, row = 0): THREE.Sprite {
  let materials = staticMaterials.get(sheet);
  if (!materials) {
    materials = new Map();
    staticMaterials.set(sheet, materials);
  }
  const key = row * sheet.columns + column;
  let material = materials.get(key);
  if (!material) {
    const texture = frameTexture(sheet);
    setTextureFrame(texture, sheet, column, row);
    material = cutoutMaterial(texture);
    materials.set(key, material);
  }
  return configureSprite(new THREE.Sprite(material), sheet);
}
