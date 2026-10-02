// Печь-каменка в бане: кирпичный корпус на каменном цоколе, чугунная дверца, за стеклом пляшет огонь,
// на чугунной плите — горка камней, над ней поднимается пар. Труба уходит под крышу, из кирпичной трубы
// на крыше идёт дым. На полу перед дверцей — тёплый отсвет. Картинки граней — tools/art/banya.mjs.
import * as THREE from 'three';
import { BoxModel, type BoxFaces } from '@engine/boxes';
import type { BatchItem } from '@engine/batch';
import type { SpriteSheet } from '@engine/sprite';
import { PuffPool, PuffSource, type PuffLook } from './puffs';

/** Картинки печи: textures/<имя>.png. */
export const STOVE_TEXTURES = ['stove-brick', 'stove-door', 'stove-top', 'stove-pipe', 'chimney-brick', 'chimney-top'] as const;
export type StoveTextures = Record<(typeof STOVE_TEXTURES)[number], THREE.Texture>;

export interface StoveSheets {
  readonly puff: SpriteSheet;
  readonly stoveStones: SpriteSheet;
}

/** Размеры печи (16 пикселей картинки на единицу): цоколь, корпус, плита, труба, кирпичная труба на крыше. */
export const STOVE = {
  plinth: { size: 1.7, height: 0.18 },
  body: { size: 1.5, height: 1 },
  rim: { size: 1.62, height: 0.1 },
  pipe: { size: 0.36, back: 0.55 },
  chimney: { size: 0.75, height: 1, cap: 0.9, capHeight: 0.16 },
} as const;
/** Высота чугунной плиты — на ней лежат камни. */
const RIM_TOP = STOVE.plinth.height + STOVE.body.height + STOVE.rim.height;
/** Сколько кадров огня в картинке дверцы и как часто он меняется, секунды. */
const FIRE_FRAMES = 3;
const FIRE_STEP: readonly [number, number] = [0.09, 0.2];

const STEAM: PuffLook = { color: '#ffffff', opacity: 0.6, size: [0.4, 1.4] };
const SMOKE: PuffLook = { color: '#a3abbf', opacity: 0.45, size: [0.4, 1.8] };

/** Где стоит печь одной бани. */
export interface StovePlace {
  readonly x: number;
  readonly z: number;
  /** Высота конька крыши — на нём стоит кирпичная труба. */
  readonly roofY: number;
  /** Где по глубине конёк. */
  readonly roofZ: number;
}

export interface Stoves {
  /** Препятствия: печи, в них упираются. */
  readonly boxes: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[];
  update(dt: number): void;
}

/**
 * Печи всех бань — одна модель на все (несколько отрисовок на всю деревню), камни — в общую пачку
 * билбордов через add, пар и дым — общий пул мягких клубов.
 */
export function buildStoves(
  scene: THREE.Scene,
  textures: StoveTextures,
  sheets: StoveSheets,
  places: readonly StovePlace[],
  add: (sheet: SpriteSheet, item: BatchItem) => void,
): Stoves {
  const t = textures;
  // материалы по номерам граней; свет «запечён» в цвет вершин (BoxModel)
  const materials = [
    t['stove-brick'],
    t['stove-door'],
    t['stove-top'],
    t['stove-pipe'],
    t['chimney-brick'],
    t['chimney-top'],
  ].map((map) => new THREE.MeshBasicMaterial({ map, vertexColors: true }));
  const [BRICK, DOOR, TOP, PIPE, CHIMNEY, CHIMNEY_TOP] = [0, 1, 2, 3, 4, 5];
  const [PLINTH, IRON, CAP] = [6, 7, 8];
  materials.push(...['#7d8a99', '#3a3644', '#a8564f'].map((color) => new THREE.MeshBasicMaterial({ color, vertexColors: true })));

  const model = new BoxModel([[1, 1], [FIRE_FRAMES, 1]]);
  const all = (face: number): BoxFaces => ({ near: [face], far: [face], front: [face], back: [face], top: [face] });
  const boxes: Stoves['boxes'][number][] = [];
  const pool = new PuffPool(scene, sheets.puff, 48);
  const sources: PuffSource[] = [];
  const glows: THREE.Mesh[] = [];
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  for (const { x, z, roofY, roofZ } of places) {
    const { plinth, body, rim, pipe, chimney } = STOVE;
    model.box([plinth.size, plinth.height, plinth.size], [x, plinth.height / 2, z], all(PLINTH));
    model.box([body.size, body.height, body.size], [x, plinth.height + body.height / 2, z], {
      near: [DOOR],
      far: [BRICK],
      front: [BRICK],
      back: [BRICK],
    });
    model.box([rim.size, rim.height, rim.size], [x, RIM_TOP - rim.height / 2, z], { near: [IRON], far: [IRON], front: [IRON], back: [IRON], top: [TOP] });
    // труба от плиты уходит под конёк
    const pipeHeight = roofY - RIM_TOP;
    model.box([pipe.size, pipeHeight, pipe.size], [x, RIM_TOP + pipeHeight / 2, z - pipe.back], { near: [PIPE], far: [PIPE], front: [PIPE], back: [PIPE] });
    // кирпичная труба на коньке с выступающим оголовком
    model.box([chimney.size, chimney.height, chimney.size], [x, roofY + chimney.height / 2, roofZ], { near: [CHIMNEY], far: [CHIMNEY], front: [CHIMNEY], back: [CHIMNEY] });
    const capY = roofY + chimney.height + chimney.capHeight / 2;
    model.box([chimney.cap, chimney.capHeight, chimney.cap], [x, capY, roofZ], { near: [CAP], far: [CAP], front: [CAP], back: [CAP], top: [CHIMNEY_TOP] });

    add(sheets.stoveStones, { x, z: z + 0.15, y: RIM_TOP - 0.04 });
    boxes.push({ minX: x - plinth.size / 2, maxX: x + plinth.size / 2, minZ: z - plinth.size / 2, maxZ: z + plinth.size / 2 });

    // тёплый отсвет огня на полу перед дверцей
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6).rotateX(-Math.PI / 2), glowMaterial);
    glow.position.set(x, 0.03, z + body.size / 2 + 1);
    scene.add(glow);
    glows.push(glow);

    // пар над камнями тянется к полку (влево), дым из трубы сносит ветром
    sources.push(new PuffSource(pool, new THREE.Vector3(x, RIM_TOP + 0.55, z + 0.15), { rate: 2.2, life: 2.6, velocity: [-0.35, 1.2, 0], spread: 0.8, look: STEAM }));
    sources.push(new PuffSource(pool, new THREE.Vector3(x, capY + 0.15, roofZ), { rate: 1.5, life: 4.6, velocity: [0.6, 1.5, 0], spread: 0.25, look: SMOKE }));
  }

  scene.add(new THREE.Mesh(model.build(), materials));

  // огонь: листаем кадры дверцы (одна картинка на все печи) и в такт подмигиваем отсветом
  const door = t['stove-door'];
  let fireTimer = 0;
  return {
    boxes,
    update: (dt) => {
      fireTimer -= dt;
      if (fireTimer <= 0) {
        fireTimer = FIRE_STEP[0] + Math.random() * (FIRE_STEP[1] - FIRE_STEP[0]);
        door.offset.x = Math.floor(Math.random() * FIRE_FRAMES) / FIRE_FRAMES;
        glowMaterial.opacity = 0.32 + Math.random() * 0.14;
      }
      for (const source of sources) source.update(dt);
      pool.update(dt);
    },
  };
}

/** Мягкое пятно света: тёплый центр, к краям сходит на нет. */
function glowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 170, 90, 1)');
    gradient.addColorStop(0.45, 'rgba(255, 120, 60, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
