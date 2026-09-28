import * as THREE from 'three';
import type { Box, Circle } from '@engine/math';
import { Rng } from '@engine/rng';
import { createShadowBatch } from '@engine/shadow';
import { BillboardSprite, createStaticSprite, type SpriteSheet } from '@engine/sprite';
import { CARPET, ECONOMY, NEIGHBORS, PIXELS_PER_UNIT, WORLD } from './config';

export interface WorldTextures {
  readonly grass: THREE.Texture;
  readonly planks: THREE.Texture;
  readonly logs: THREE.Texture;
  readonly carpet: THREE.Texture;
  readonly stone: THREE.Texture;
}

export interface DecorSheets {
  readonly tree: SpriteSheet;
  readonly pine: SpriteSheet;
  readonly bush: SpriteSheet;
  readonly bucket: SpriteSheet;
  readonly steam: SpriteSheet;
}

/** Одна баня: где сидят персонажи, где плиты, где вход. */
export interface BanyaLayout {
  readonly centerX: number;
  /** Где сидят персонажи на полке (поверх скамьи). */
  readonly seats: readonly THREE.Vector3[];
  /** Центры плит сбора монет. */
  readonly plates: readonly THREE.Vector3[];
  /** Точка перед входом (снаружи открытой стороны). */
  readonly entrance: THREE.Vector3;
  /** Пол внутри бани — чтобы понять, что игрок «дома». */
  readonly interior: Box;
  readonly signAnchor: THREE.Vector3;
}

/** Неподвижная часть мира и её важные точки. */
export interface World {
  readonly home: BanyaLayout;
  readonly neighbors: readonly BanyaLayout[];
  /** Кнопка щеколды у входа в баню игрока. */
  readonly lockButton: THREE.Vector3;
  /** Красная «лазерная» преграда поперёк входа, видна, пока баня закрыта. */
  readonly lockBarrier: THREE.Mesh;
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  /** Куда можно ходить. */
  readonly bounds: Box;
  /** Анимация декора (пар над печами). */
  update(dt: number): void;
}

/** Баня — сруб без передней стены, чтобы камера видела всё внутри. Размеры относительно её центра. */
const BANYA = { halfWidth: 8.5, backZ: -7.5, frontZ: 1, wallHeight: 2.4, wall: 0.5 } as const;
const BENCH = { halfWidth: 6.6, minZ: -6.9, maxZ: -5.5, height: 0.6 } as const;
const SLOT_SPACING = 1.6;
const PLATE_Z = -4.2;
const STOVE = { dx: 7.4, z: -6.4, width: 1.4, depth: 1.6, height: 1.5 } as const;

export function buildWorld(scene: THREE.Scene, textures: WorldTextures, decor: DecorSheets): World {
  const unit = (texture: THREE.Texture) => (texture.image as { width: number }).width / PIXELS_PER_UNIT;
  const boxes: Box[] = [];
  const circles: Circle[] = [];
  const shadows: { x: number; z: number; diameter: number }[] = [];
  const steam: SteamEmitter[] = [];

  // --- земля ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize.x, WORLD.groundSize.z).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: tiled(textures.grass, WORLD.groundSize.x / unit(textures.grass), WORLD.groundSize.z / unit(textures.grass)),
    }),
  );
  scene.add(ground);

  // --- мемная дорожка ---
  const carpetLength = CARPET.endX - CARPET.startX + 6;
  const carpetTexture = textures.carpet.clone();
  carpetTexture.wrapT = THREE.ClampToEdgeWrapping;
  carpetTexture.repeat.set(carpetLength / unit(textures.carpet), 1);
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(carpetLength, CARPET.width).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: carpetTexture, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  carpet.position.set((CARPET.startX + CARPET.endX) / 2, 0.01, CARPET.z);
  scene.add(carpet);

  // --- бани ---
  const addBlock = (
    texture: THREE.Texture,
    center: [number, number, number],
    size: [number, number, number],
    tint = '#ffffff',
  ) => {
    const [sx, sy, sz] = size;
    const map = tiled(texture, Math.max(sx, sz) / unit(texture), sy / unit(texture));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ map, color: tint }));
    mesh.position.set(...center);
    scene.add(mesh);
    boxes.push({ minX: center[0] - sx / 2, maxX: center[0] + sx / 2, minZ: center[2] - sz / 2, maxZ: center[2] + sz / 2 });
  };

  const buildBanya = (cx: number, tint: string): BanyaLayout => {
    const inner = BANYA.halfWidth - BANYA.wall / 2;
    const floorDepth = BANYA.frontZ - BANYA.backZ - BANYA.wall / 2;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(inner * 2, floorDepth).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: tiled(textures.planks, (inner * 2) / unit(textures.planks), floorDepth / unit(textures.planks)),
        color: tint,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    floor.position.set(cx, 0.015, (BANYA.backZ + BANYA.wall / 2 + BANYA.frontZ) / 2);
    scene.add(floor);

    const wallLength = BANYA.frontZ - BANYA.backZ;
    const wallZ = (BANYA.backZ + BANYA.frontZ) / 2;
    const h = BANYA.wallHeight;
    addBlock(textures.logs, [cx, h / 2, BANYA.backZ], [BANYA.halfWidth * 2 + BANYA.wall, h, BANYA.wall], tint);
    addBlock(textures.logs, [cx - BANYA.halfWidth, h / 2, wallZ], [BANYA.wall, h, wallLength], tint);
    addBlock(textures.logs, [cx + BANYA.halfWidth, h / 2, wallZ], [BANYA.wall, h, wallLength], tint);
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(BANYA.halfWidth * 2 + 1.4, 0.25, 1.3),
      new THREE.MeshLambertMaterial({ color: '#5a3a38' }),
    );
    ridge.position.set(cx, h + 0.12, BANYA.backZ + 0.2);
    scene.add(ridge);

    // полок и печь
    addBlock(textures.planks, [cx, BENCH.height / 2, (BENCH.minZ + BENCH.maxZ) / 2], [BENCH.halfWidth * 2, BENCH.height, BENCH.maxZ - BENCH.minZ], tint);
    addBlock(textures.stone, [cx + STOVE.dx, STOVE.height / 2, STOVE.z], [STOVE.width, STOVE.height, STOVE.depth]);
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ color: '#ef7d57' }));
    fire.position.set(cx + STOVE.dx, 0.45, STOVE.z + STOVE.depth / 2 + 0.01);
    scene.add(fire);
    steam.push(new SteamEmitter(scene, decor.steam, new THREE.Vector3(cx + STOVE.dx, STOVE.height, STOVE.z)));

    // вёдра у стены
    place(decor.bucket, cx - BANYA.halfWidth + 1.1, -6.3, 0.4, 0.8);
    place(decor.bucket, cx - BANYA.halfWidth + 1.3, -5.2, 0.4, 0.8);

    const seats: THREE.Vector3[] = [];
    const plates: THREE.Vector3[] = [];
    for (let i = 0; i < ECONOMY.totalSlots; i++) {
      const x = cx + (i - (ECONOMY.totalSlots - 1) / 2) * SLOT_SPACING;
      seats.push(new THREE.Vector3(x, BENCH.height, (BENCH.minZ + BENCH.maxZ) / 2));
      plates.push(new THREE.Vector3(x, 0.03, PLATE_Z));
    }
    return {
      centerX: cx,
      seats,
      plates,
      entrance: new THREE.Vector3(cx, 0, BANYA.frontZ + 1),
      interior: { minX: cx - inner, maxX: cx + inner, minZ: BANYA.backZ + BANYA.wall / 2, maxZ: BANYA.frontZ },
      signAnchor: new THREE.Vector3(cx, BANYA.wallHeight + 0.6, BANYA.backZ),
    };
  };

  const place = (sheet: SpriteSheet, x: number, z: number, radius: number, shadow: number) => {
    const sprite = createStaticSprite(sheet);
    sprite.position.set(x, 0, z);
    scene.add(sprite);
    if (radius > 0) circles.push({ x, z, radius });
    shadows.push({ x, z, diameter: shadow });
  };

  const home = buildBanya(0, '#ffffff');
  const neighbors = NEIGHBORS.map((n) => buildBanya(n.x, '#d8c9bd'));

  // щеколда: кнопка слева от входа и «лазер» поперёк открытой стороны
  const lockButton = new THREE.Vector3(-BANYA.halfWidth + 1.2, 0.03, BANYA.frontZ + 1.4);
  const lockBarrier = new THREE.Mesh(
    new THREE.PlaneGeometry(BANYA.halfWidth * 2 - BANYA.wall, 1.4),
    new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  );
  lockBarrier.position.set(0, 0.7, BANYA.frontZ);
  lockBarrier.visible = false;
  scene.add(lockBarrier);

  // --- лес вокруг ---
  const rng = new Rng(7);
  const b = WORLD.bounds;
  for (let x = b.minX - 10; x <= b.maxX + 10; x += 2.6) {
    for (let row = 0; row < 3; row++) {
      const z = b.minZ - 1.8 - row * 2.6 + rng.range(-0.6, 0.6);
      place(rng.chance(0.55) ? decor.pine : decor.tree, x + rng.range(-0.8, 0.8) + row * 1.3, z, 0.5, 1.6);
    }
  }
  for (let z = b.minZ; z <= b.maxZ + 2; z += 2.6) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const x = side * (b.maxX + 2 + row * 2.6 + rng.range(-0.6, 0.6));
        place(rng.chance(0.5) ? decor.pine : decor.tree, x, z + rng.range(-0.8, 0.8) + row * 1.3, 0.5, 1.6);
      }
    }
  }
  // низкие кусты вдоль дорожки и по южному краю — не закрывают обзор
  for (let x = CARPET.startX + 2; x <= CARPET.endX - 2; x += 4) {
    place(decor.bush, x + rng.range(-1, 1), CARPET.z + CARPET.width / 2 + 1.2 + rng.range(0, 1.2), 0, 0.9);
    place(decor.bush, x + rng.range(-1, 1), b.maxZ + 1.2 + rng.range(0, 1), 0, 0.9);
  }
  scene.add(createShadowBatch(shadows));

  return {
    home,
    neighbors,
    lockButton,
    lockBarrier,
    boxes,
    circles,
    bounds: WORLD.bounds,
    update: (dt) => {
      for (const s of steam) s.update(dt);
      if (lockBarrier.visible) (lockBarrier.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(performance.now() / 150) * 0.08;
    },
  };
}

function tiled(texture: THREE.Texture, repeatU: number, repeatV: number): THREE.Texture {
  const copy = texture.clone();
  copy.repeat.set(repeatU, repeatV);
  return copy;
}

/** Клубы пара над печью: растут, поднимаются и появляются снова. */
class SteamEmitter {
  private readonly puffs: { sprite: BillboardSprite; age: number }[] = [];
  private readonly origin: THREE.Vector3;
  private static readonly LIFETIME = 2.4;

  constructor(scene: THREE.Scene, sheet: SpriteSheet, origin: THREE.Vector3) {
    this.origin = origin;
    for (let i = 0; i < 4; i++) {
      const sprite = new BillboardSprite(sheet);
      scene.add(sprite.object);
      this.puffs.push({ sprite, age: (i / 4) * SteamEmitter.LIFETIME });
    }
  }

  update(dt: number): void {
    for (const puff of this.puffs) {
      puff.age = (puff.age + dt) % SteamEmitter.LIFETIME;
      const t = puff.age / SteamEmitter.LIFETIME;
      puff.sprite.setFrame(Math.min(2, Math.floor(t * 3)));
      puff.sprite.object.visible = t < 0.92;
      puff.sprite.object.position.set(this.origin.x + Math.sin(t * 6 + puff.age) * 0.25, this.origin.y + t * 2.2, this.origin.z);
    }
  }
}
