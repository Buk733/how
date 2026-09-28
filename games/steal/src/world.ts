import * as THREE from 'three';
import type { Box, Circle } from '@engine/math';
import { Rng } from '@engine/rng';
import { createShadowBatch } from '@engine/shadow';
import { BillboardSprite, createStaticSprite, type SpriteSheet } from '@engine/sprite';
import { CARPET, ECONOMY, PIXELS_PER_UNIT } from './config';

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

/** Неподвижная часть мира и её важные точки. */
export interface World {
  /** Где сидят персонажи на полке (поверх скамьи). */
  readonly seats: readonly THREE.Vector3[];
  /** Центры плит сбора монет. */
  readonly plates: readonly THREE.Vector3[];
  /** Точка перед входом в баню: через неё купленные персонажи идут к полку. */
  readonly entrance: THREE.Vector3;
  readonly signAnchor: THREE.Vector3;
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  /** Куда игрок может ходить. */
  readonly bounds: Box;
  /** Анимация декора (пар над печью). */
  update(dt: number): void;
}

/** Баня игрока: сруб без передней стены, чтобы камера видела всё внутри. */
const BANYA = { minX: -8.5, maxX: 8.5, minZ: -7.5, maxZ: 1, wallHeight: 2.4, wall: 0.5 } as const;
const BENCH = { halfWidth: 6.6, minZ: -6.9, maxZ: -5.5, height: 0.6 } as const;
const SLOT_SPACING = 1.6;
const PLATE_Z = -4.2;
const STOVE = { x: 7.4, z: -6.4, width: 1.4, depth: 1.6, height: 1.5 } as const;

export function buildWorld(scene: THREE.Scene, textures: WorldTextures, decor: DecorSheets): World {
  const unit = (texture: THREE.Texture) => (texture.image as { width: number }).width / PIXELS_PER_UNIT;

  // --- земля ---
  const groundSize = { x: 90, z: 60 };
  const grass = tiled(textures.grass, groundSize.x / unit(textures.grass), groundSize.z / unit(textures.grass));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize.x, groundSize.z).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: grass }),
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

  // --- баня ---
  const floorSize = { x: BANYA.maxX - BANYA.minX - BANYA.wall, z: BANYA.maxZ - BANYA.minZ - BANYA.wall / 2 };
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize.x, floorSize.z).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: tiled(textures.planks, floorSize.x / unit(textures.planks), floorSize.z / unit(textures.planks)),
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  floor.position.set(0, 0.015, (BANYA.minZ + BANYA.wall / 2 + BANYA.maxZ) / 2);
  scene.add(floor);

  const boxes: Box[] = [];
  const addBlock = (texture: THREE.Texture, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
    const repeatU = Math.max(sx, sz) / unit(texture);
    const map = tiled(texture, repeatU, sy / unit(texture));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ map }));
    mesh.position.set(cx, cy, cz);
    scene.add(mesh);
    boxes.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
    return mesh;
  };

  const wallLength = BANYA.maxZ - BANYA.minZ;
  const wallZ = (BANYA.minZ + BANYA.maxZ) / 2;
  addBlock(textures.logs, 0, BANYA.wallHeight / 2, BANYA.minZ, BANYA.maxX - BANYA.minX + BANYA.wall, BANYA.wallHeight, BANYA.wall);
  addBlock(textures.logs, BANYA.minX, BANYA.wallHeight / 2, wallZ, BANYA.wall, BANYA.wallHeight, wallLength);
  addBlock(textures.logs, BANYA.maxX, BANYA.wallHeight / 2, wallZ, BANYA.wall, BANYA.wallHeight, wallLength);
  // конёк над задней стеной
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(BANYA.maxX - BANYA.minX + 1.4, 0.25, 1.3),
    new THREE.MeshLambertMaterial({ color: '#5a3a38' }),
  );
  ridge.position.set(0, BANYA.wallHeight + 0.12, BANYA.minZ + 0.2);
  scene.add(ridge);

  // полок
  addBlock(textures.planks, 0, BENCH.height / 2, (BENCH.minZ + BENCH.maxZ) / 2, BENCH.halfWidth * 2, BENCH.height, BENCH.maxZ - BENCH.minZ);
  // печь
  addBlock(textures.stone, STOVE.x, STOVE.height / 2, STOVE.z, STOVE.width, STOVE.height, STOVE.depth);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ color: '#ef7d57' }));
  fire.position.set(STOVE.x, 0.45, STOVE.z + STOVE.depth / 2 + 0.01);
  scene.add(fire);

  // места на полке и плиты
  const seats: THREE.Vector3[] = [];
  const plates: THREE.Vector3[] = [];
  for (let i = 0; i < ECONOMY.totalSlots; i++) {
    const x = (i - (ECONOMY.totalSlots - 1) / 2) * SLOT_SPACING;
    seats.push(new THREE.Vector3(x, BENCH.height, (BENCH.minZ + BENCH.maxZ) / 2));
    plates.push(new THREE.Vector3(x, 0.03, PLATE_Z));
  }

  // --- декор ---
  const circles: Circle[] = [];
  const shadows: { x: number; z: number; diameter: number }[] = [];
  const place = (sheet: SpriteSheet, x: number, z: number, radius: number, shadow: number) => {
    const sprite = createStaticSprite(sheet);
    sprite.position.set(x, 0, z);
    scene.add(sprite);
    if (radius > 0) circles.push({ x, z, radius });
    shadows.push({ x, z, diameter: shadow });
  };
  place(decor.bucket, BANYA.minX + 1.1, -6.3, 0.4, 0.8);
  place(decor.bucket, BANYA.minX + 1.3, -5.2, 0.4, 0.8);

  const rng = new Rng(7);
  // лес позади
  for (let x = -30; x <= 30; x += 2.6) {
    for (const row of [0, 1]) {
      const z = -11 - row * 2.6 + rng.range(-0.6, 0.6);
      const kind = rng.chance(0.55) ? decor.pine : decor.tree;
      place(kind, x + rng.range(-0.8, 0.8) + row * 1.3, z, 0.5, 1.6);
    }
  }
  // деревья по бокам
  for (let z = -8; z <= 9; z += 2.8) {
    for (const side of [-1, 1]) place(rng.chance(0.5) ? decor.pine : decor.tree, side * (29 + rng.range(-0.8, 0.8)), z, 0.5, 1.6);
  }
  // кусты вдоль дорожки
  for (let x = -24; x <= 24; x += 4) {
    if (Math.abs(x) < 3) continue;
    place(decor.bush, x + rng.range(-1, 1), CARPET.z + CARPET.width / 2 + 1.2 + rng.range(0, 1.5), 0, 0.9);
  }
  scene.add(createShadowBatch(shadows));

  const steam = new SteamEmitter(scene, decor.steam, new THREE.Vector3(STOVE.x, STOVE.height, STOVE.z));

  return {
    seats,
    plates,
    entrance: new THREE.Vector3(0, 0, BANYA.maxZ + 0.5),
    signAnchor: new THREE.Vector3(0, BANYA.wallHeight + 0.6, BANYA.minZ),
    boxes,
    circles,
    bounds: { minX: -27, maxX: 27, minZ: -9.2, maxZ: 11 },
    update: (dt) => steam.update(dt),
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
    for (let i = 0; i < 5; i++) {
      const sprite = new BillboardSprite(sheet);
      scene.add(sprite.object);
      this.puffs.push({ sprite, age: (i / 5) * SteamEmitter.LIFETIME });
    }
  }

  update(dt: number): void {
    for (const puff of this.puffs) {
      puff.age = (puff.age + dt) % SteamEmitter.LIFETIME;
      const t = puff.age / SteamEmitter.LIFETIME;
      puff.sprite.setFrame(Math.min(2, Math.floor(t * 3)));
      puff.sprite.object.visible = t < 0.92;
      puff.sprite.object.position.set(
        this.origin.x + Math.sin(t * 6 + puff.age) * 0.25,
        this.origin.y + t * 2.2,
        this.origin.z,
      );
    }
  }
}
