import * as THREE from 'three';
import { createBillboardBatch, type BatchItem } from '@engine/batch';
import type { Box, Circle } from '@engine/math';
import { createShadowBatch } from '@engine/shadow';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';
import { CARPET, ECONOMY, NEIGHBORS, PIXELS_PER_UNIT } from './config';
import { FOREST_WALLS, GROUND, LANDMARK_BOXES, LANDMARK_CIRCLES, OPEN_AREAS, pondColliders, SOUTH, WALK_BOUNDS } from './layout';
import { buildScenery, type ScenerySheets, type SceneryTextures } from './scenery';

export interface WorldTextures extends SceneryTextures {
  readonly grass: THREE.Texture;
  readonly planks: THREE.Texture;
  readonly logs: THREE.Texture;
  readonly carpet: THREE.Texture;
  readonly stone: THREE.Texture;
}

export interface DecorSheets extends ScenerySheets {
  readonly bucket: SpriteSheet;
  readonly steam: SpriteSheet;
  readonly smoke: SpriteSheet;
  readonly kennel: SpriteSheet;
  readonly lantern: SpriteSheet;
  readonly woodpile: SpriteSheet;
  readonly arch: SpriteSheet;
  readonly portal: SpriteSheet;
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
  /** Красная «лазерная» преграда поперёк входа: видна, пока баня закрыта на щеколду. */
  readonly barrier: THREE.Mesh;
  /** Стенка на месте преграды — не пускает внутрь, пока баня закрыта. */
  readonly latchBox: Box;
  /** Где сидит собака соседа — перед будкой (у бани игрока будки нет). */
  readonly kennel: THREE.Vector3;
  /** Где висит колокольчик — у входа, со стороны бани игрока. */
  readonly bell: THREE.Vector3;
  /** Середина печи — оттуда валит пар. */
  readonly stove: THREE.Vector3;
}

/** Неподвижная часть мира и её важные точки. */
export interface World {
  readonly home: BanyaLayout;
  readonly neighbors: readonly BanyaLayout[];
  /** Кнопка щеколды у входа в баню игрока. */
  readonly lockButton: THREE.Vector3;
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  /** Куда можно ходить. */
  readonly bounds: Box;
  /** Анимация декора: пар и дым, порталы, фонари, вода, птицы, утки. focus — где игрок. */
  update(dt: number, focus: THREE.Vector3): void;
}

/** Баня — сруб без передней стены, чтобы камера видела всё внутри. Размеры относительно её центра. */
const BANYA = { halfWidth: 8.5, backZ: -7.5, frontZ: 1, wallHeight: 2.4, wall: 0.5 } as const;
const BENCH = { halfWidth: 6.6, minZ: -6.9, maxZ: -5.5, height: 0.6 } as const;
const SLOT_SPACING = 1.6;
const PLATE_Z = -4.2;
const STOVE = { dx: 7.4, z: -6.4, width: 1.4, depth: 1.6, height: 1.5 } as const;
/** Труба над печью, поленница у боковой стены, будка соседа. */
const CHIMNEY = { size: 0.7, height: 1.4 } as const;
const WOODPILE_Z = -5.2;
const KENNEL_DX = 10.6;

export function buildWorld(scene: THREE.Scene, textures: WorldTextures, decor: DecorSheets): World {
  const unit = (texture: THREE.Texture) => (texture.image as { width: number }).width / PIXELS_PER_UNIT;
  const boxes: Box[] = [...FOREST_WALLS, ...LANDMARK_BOXES];
  const circles: Circle[] = [...LANDMARK_CIRCLES, ...pondColliders()];
  const shadows: { x: number; z: number; diameter: number }[] = [];
  const statics = new Map<SpriteSheet, BatchItem[]>();
  const emitters: PuffEmitter[] = [];
  const barriers: THREE.Mesh[] = [];
  const flickers: { sprite: BillboardSprite; time: number }[] = [];

  /** Неподвижный спрайт: попадёт в общую пачку своего листа (одна отрисовка на весь лист). */
  const add = (sheet: SpriteSheet, item: BatchItem, shadow = 0, radius = 0) => {
    let items = statics.get(sheet);
    if (!items) statics.set(sheet, (items = []));
    items.push(item);
    if (radius > 0) circles.push({ x: item.x, z: item.z, radius });
    if (shadow > 0) shadows.push({ x: item.x, z: item.z, diameter: shadow });
  };
  const place = (sheet: SpriteSheet, x: number, z: number, radius: number, shadow: number, column = 0) => add(sheet, { x, z, column }, shadow, radius);

  scene.add(buildGround(textures.grass, unit(textures.grass)));

  // --- мемная дорожка: от портала до портала ---
  const carpetLength = CARPET.endX - CARPET.startX + 2;
  const carpetTexture = textures.carpet.clone();
  carpetTexture.wrapT = THREE.ClampToEdgeWrapping;
  carpetTexture.repeat.set(carpetLength / unit(textures.carpet), 1);
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(carpetLength, CARPET.width).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: carpetTexture, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  carpet.position.set((CARPET.startX + CARPET.endX) / 2, 0.01, CARPET.z);
  scene.add(carpet);
  // порталы: отсюда персонажи выходят, туда уходят
  const portals: BillboardSprite[] = [];
  for (const x of [CARPET.startX - 0.6, CARPET.endX + 0.6]) {
    const portal = new BillboardSprite(decor.portal);
    portal.object.position.set(x, 0, CARPET.z - 0.35);
    scene.add(portal.object);
    portals.push(portal);
    place(decor.arch, x, CARPET.z - 0.25, 0, 0);
    shadows.push({ x: x - 1.4, z: CARPET.z - 0.2, diameter: 0.7 }, { x: x + 1.3, z: CARPET.z - 0.2, diameter: 0.7 });
  }

  // --- бани ---
  const addBlock = (
    texture: THREE.Texture,
    center: [number, number, number],
    size: [number, number, number],
    tint = '#ffffff',
    solid = true,
  ) => {
    const [sx, sy, sz] = size;
    const map = tiled(texture, Math.max(sx, sz) / unit(texture), sy / unit(texture));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ map, color: tint }));
    mesh.position.set(...center);
    scene.add(mesh);
    if (solid) boxes.push({ minX: center[0] - sx / 2, maxX: center[0] + sx / 2, minZ: center[2] - sz / 2, maxZ: center[2] + sz / 2 });
  };

  const buildBanya = (cx: number, tint: string, homeSide: number): BanyaLayout => {
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

    // полок и печь, над печью — труба с дымом
    addBlock(textures.planks, [cx, BENCH.height / 2, (BENCH.minZ + BENCH.maxZ) / 2], [BENCH.halfWidth * 2, BENCH.height, BENCH.maxZ - BENCH.minZ], tint);
    addBlock(textures.stone, [cx + STOVE.dx, STOVE.height / 2, STOVE.z], [STOVE.width, STOVE.height, STOVE.depth]);
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ color: '#ef7d57' }));
    fire.position.set(cx + STOVE.dx, 0.45, STOVE.z + STOVE.depth / 2 + 0.01);
    scene.add(fire);
    const stove = new THREE.Vector3(cx + STOVE.dx, STOVE.height, STOVE.z);
    emitters.push(new PuffEmitter(scene, decor.steam, stove.clone(), { count: 4, lifetime: 2.4, rise: 2.2, sway: 0.25 }));
    const chimneyTop = h + 0.25 + CHIMNEY.height;
    addBlock(textures.stone, [cx + STOVE.dx, h + 0.25 + CHIMNEY.height / 2, BANYA.backZ], [CHIMNEY.size, CHIMNEY.height, CHIMNEY.size], '#ffffff', false);
    emitters.push(
      new PuffEmitter(scene, decor.smoke, new THREE.Vector3(cx + STOVE.dx, chimneyTop, BANYA.backZ), { count: 5, lifetime: 3.6, rise: 3.4, sway: 0.5, drift: 0.6 }),
    );

    // вёдра у стены
    place(decor.bucket, cx - BANYA.halfWidth + 1.1, -6.3, 0.4, 0.8);
    place(decor.bucket, cx - BANYA.halfWidth + 1.3, -5.2, 0.4, 0.8);
    // фонари у входа и поленница у наружной стены
    for (const side of [-1, 1]) {
      const lantern = new BillboardSprite(decor.lantern);
      lantern.object.position.set(cx + side * (BANYA.halfWidth + 0.55), 0, BANYA.frontZ + 0.35);
      scene.add(lantern.object);
      flickers.push({ sprite: lantern, time: Math.random() * 3 });
      circles.push({ x: lantern.object.position.x, z: lantern.object.position.z, radius: 0.2 });
    }
    const pileX = cx - homeSide * (BANYA.halfWidth + 0.95);
    place(decor.woodpile, pileX, WOODPILE_Z, 0, 1.4);
    boxes.push({ minX: pileX - 0.75, maxX: pileX + 0.75, minZ: WOODPILE_Z - 0.35, maxZ: WOODPILE_Z + 0.2 });

    const seats: THREE.Vector3[] = [];
    const plates: THREE.Vector3[] = [];
    for (let i = 0; i < ECONOMY.totalSlots; i++) {
      const x = cx + (i - (ECONOMY.totalSlots - 1) / 2) * SLOT_SPACING;
      seats.push(new THREE.Vector3(x, BENCH.height, (BENCH.minZ + BENCH.maxZ) / 2));
      plates.push(new THREE.Vector3(x, 0.03, PLATE_Z));
    }

    // щеколда: красный «лазер» поперёк открытой стороны
    const barrier = new THREE.Mesh(
      new THREE.PlaneGeometry(inner * 2, 1.4),
      new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    );
    barrier.position.set(cx, 0.7, BANYA.frontZ);
    barrier.visible = false;
    scene.add(barrier);
    barriers.push(barrier);

    return {
      centerX: cx,
      seats,
      plates,
      entrance: new THREE.Vector3(cx, 0, BANYA.frontZ + 1),
      interior: { minX: cx - inner, maxX: cx + inner, minZ: BANYA.backZ + BANYA.wall / 2, maxZ: BANYA.frontZ },
      signAnchor: new THREE.Vector3(cx, BANYA.wallHeight + 0.6, BANYA.backZ),
      barrier,
      latchBox: { minX: cx - inner, maxX: cx + inner, minZ: BANYA.frontZ - 0.2, maxZ: BANYA.frontZ + 0.2 },
      kennel: new THREE.Vector3(cx + homeSide * KENNEL_DX, 0, BANYA.frontZ + 0.1),
      bell: new THREE.Vector3(cx + homeSide * (inner - 0.3), 1.35, BANYA.frontZ - 0.15),
      stove,
    };
  };

  const home = buildBanya(0, '#ffffff', -1);
  const neighbors = NEIGHBORS.map((n) => {
    // будка и колокольчик — со стороны бани игрока
    const homeSide = n.x < 0 ? 1 : -1;
    const layout = buildBanya(n.x, '#d8c9bd', homeSide);
    place(decor.kennel, layout.kennel.x, layout.kennel.z - 0.85, 0.55, 1.3);
    return layout;
  });
  // кнопка щеколды — слева от входа в баню игрока
  const lockButton = new THREE.Vector3(-BANYA.halfWidth + 1.2, 0.03, BANYA.frontZ + 1.4);

  // --- лес, огород, пруд, поляна, дорога ---
  const scenery = buildScenery(scene, decor, textures, { add, circles });

  // низкие кусты вдоль дорожки — не закрывают обзор
  for (let x = CARPET.startX + 2; x <= CARPET.endX - 2; x += 4) {
    place(decor.bush, x + (x % 3), CARPET.z + CARPET.width / 2 + 1.2 + ((x * 7) % 10) / 10, 0, 0.9, Math.abs(x) % 3);
  }

  for (const [sheet, items] of statics) scene.add(createBillboardBatch(sheet, items));
  scene.add(createShadowBatch(shadows));

  let portalTime = 0;
  return {
    home,
    neighbors,
    lockButton,
    boxes,
    circles,
    bounds: WALK_BOUNDS,
    update: (dt, focus) => {
      for (const emitter of emitters) emitter.update(dt);
      const opacity = 0.28 + Math.sin(performance.now() / 150) * 0.08;
      for (const barrier of barriers) if (barrier.visible) (barrier.material as THREE.MeshBasicMaterial).opacity = opacity;
      portalTime += dt;
      for (const portal of portals) portal.setFrame(Math.floor(portalTime * 8) % 3);
      for (const f of flickers) {
        f.time += dt;
        f.sprite.setFrame(Math.sin(f.time * 9) + Math.sin(f.time * 23) > 1.2 ? 1 : 0);
      }
      scenery.update(dt, focus);
    },
  };
}

function tiled(texture: THREE.Texture, repeatU: number, repeatV: number): THREE.Texture {
  const copy = texture.clone();
  copy.repeat.set(repeatU, repeatV);
  return copy;
}

/** Расстояние от точки до ближайшего открытого места (0 — точка на открытом месте). */
function distanceToOpen(x: number, z: number): number {
  let best = Infinity;
  for (const b of OPEN_AREAS) {
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

/**
 * Земля: трава плиткой и мягкие пятна тени, раскрашенные по вершинам.
 * В чаще земля темнее, на лугах — пятнами светлее и темнее.
 */
function buildGround(grass: THREE.Texture, tile: number): THREE.Mesh {
  const width = GROUND.maxX - GROUND.minX;
  const depth = GROUND.maxZ - GROUND.minZ;
  const geometry = new THREE.PlaneGeometry(width, depth, width, depth).rotateX(-Math.PI / 2);
  geometry.translate((GROUND.minX + GROUND.maxX) / 2, 0, (GROUND.minZ + GROUND.maxZ) / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    // южный луг (между забором и лесом) — светлый, как двор
    const meadow = z > WALK_BOUNDS.maxZ && z < SOUTH.forestFromZ - 2;
    const forest = meadow ? 0 : Math.min(1, distanceToOpen(x, z) / 3.5);
    const blotch = Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.27 - x * 0.09) * 0.07 + Math.sin(x * 0.63 - z * 0.41) * 0.025;
    const shade = 1 - forest * 0.34 + blotch;
    // в чаще чуть холоднее, на лугу чуть теплее
    colors.set([shade * (1 - forest * 0.08), shade, shade * (1 + forest * 0.04)], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const map = tiled(grass, width / tile, depth / tile);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map, vertexColors: true }));
}

interface PuffOptions {
  readonly count: number;
  readonly lifetime: number;
  /** Насколько поднимается клуб за жизнь. */
  readonly rise: number;
  /** Насколько раскачивается в стороны. */
  readonly sway: number;
  /** Насколько сносит ветром вбок. */
  readonly drift?: number;
}

/** Клубы пара над печью или дыма из трубы: растут, поднимаются и появляются снова. */
class PuffEmitter {
  private readonly puffs: { sprite: BillboardSprite; age: number }[] = [];
  private readonly origin: THREE.Vector3;
  private readonly options: PuffOptions;

  constructor(scene: THREE.Scene, sheet: SpriteSheet, origin: THREE.Vector3, options: PuffOptions) {
    this.origin = origin;
    this.options = options;
    for (let i = 0; i < options.count; i++) {
      const sprite = new BillboardSprite(sheet);
      scene.add(sprite.object);
      this.puffs.push({ sprite, age: (i / options.count) * options.lifetime });
    }
  }

  update(dt: number): void {
    const { lifetime, rise, sway, drift = 0 } = this.options;
    for (const puff of this.puffs) {
      puff.age = (puff.age + dt) % lifetime;
      const t = puff.age / lifetime;
      puff.sprite.setFrame(Math.min(2, Math.floor(t * 3)));
      puff.sprite.object.visible = t < 0.92;
      puff.sprite.object.position.set(this.origin.x + Math.sin(t * 6 + puff.age) * sway + t * drift, this.origin.y + t * rise, this.origin.z);
    }
  }
}
