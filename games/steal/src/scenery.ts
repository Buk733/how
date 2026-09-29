import * as THREE from 'three';
import type { BatchItem } from '@engine/batch';
import type { Circle, PointXZ } from '@engine/math';
import { Rng } from '@engine/rng';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';
import { CARPET, NEIGHBORS, PIXELS_PER_UNIT } from './config';
import {
  BUS_STOP,
  GARDEN_BEDS,
  GARDEN_PATH_X,
  GLADE,
  GROUND,
  inPond,
  isOpen,
  OPEN_AREAS,
  PIER,
  PIER_PATH_X,
  POND,
  SCARECROW,
  SOUTH,
  SPOTS,
  TRAIL,
  WINDMILL,
  WINDMILL_CLEARING,
  YARD,
} from './layout';

export interface SceneryTextures {
  readonly path: THREE.Texture;
  readonly water: THREE.Texture;
  readonly soil: THREE.Texture;
  readonly planks: THREE.Texture;
}

export interface ScenerySheets {
  /** Кадры: зелёное, оранжевое, жёлтое, тёмное. */
  readonly tree: SpriteSheet;
  /** Кадры: обычная, тёмная. */
  readonly pine: SpriteSheet;
  /** Кадры: летняя, осенняя. */
  readonly birch: SpriteSheet;
  readonly bush: SpriteSheet;
  readonly stump: SpriteSheet;
  readonly log: SpriteSheet;
  readonly rock: SpriteSheet;
  readonly mushroom: SpriteSheet;
  readonly flower: SpriteSheet;
  readonly grassTuft: SpriteSheet;
  /** Кадры: папоротник, камыш. */
  readonly fern: SpriteSheet;
  readonly fence: SpriteSheet;
  readonly busStop: SpriteSheet;
  readonly crops: SpriteSheet;
  readonly windmill: SpriteSheet;
  readonly scarecrow: SpriteSheet;
  readonly duck: SpriteSheet;
  readonly bird: SpriteSheet;
  readonly butterfly: SpriteSheet;
  readonly tractor: SpriteSheet;
}

/** Как добавлять неподвижный декор: в общую пачку мира, с тенью и препятствием. */
export interface SceneryBuilder {
  add(sheet: SpriteSheet, item: BatchItem, shadow?: number, radius?: number): void;
  readonly circles: Circle[];
}

/** Живой декор: мельница, пугало, утки, птицы, бабочки, трактор, вода. */
export interface Scenery {
  update(dt: number, focus: THREE.Vector3): void;
}

type Animate = (dt: number, focus: THREE.Vector3) => void;

/** Где стоят бани (там и у входов не растут цветы). */
const BANYA_XS = [0, ...NEIGHBORS.map((n) => n.x)];

/** Расстояние от точки до ближайшего открытого места. */
function depthInForest(p: PointXZ): number {
  let best = Infinity;
  for (const b of OPEN_AREAS) {
    const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
    const dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  // южный луг тоже открытое место
  if (p.z > YARD.maxZ) best = Math.min(best, Math.max(0, p.z - SOUTH.forestFromZ));
  return best;
}

/**
 * Всё, что вокруг бань: густой лес во все стороны, лесная поляна, огород с пугалом,
 * пруд с мостками и утками, мельница на опушке, забор, дорога с остановкой и трактором.
 */
export function buildScenery(scene: THREE.Scene, sheets: ScenerySheets, textures: SceneryTextures, builder: SceneryBuilder): Scenery {
  const rng = new Rng(2026);
  const animated: Animate[] = [];
  const { add } = builder;
  const unit = (texture: THREE.Texture) => (texture.image as { width: number }).width / PIXELS_PER_UNIT;
  let stripIndex = 0;

  /** Полоса на земле (тропинка, дорога, грядка) от from до to шириной width. */
  const strip = (texture: THREE.Texture, from: PointXZ, to: PointXZ, width: number) => {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const map = texture.clone();
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.repeat.set(length / unit(texture), 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, width).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map, alphaTest: 0.5 }));
    // у каждой полосы своя высота — на перекрёстках они не мерцают
    mesh.position.set((from.x + to.x) / 2, 0.005 + stripIndex++ * 0.0004, (from.z + to.z) / 2);
    mesh.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
    scene.add(mesh);
  };

  // ---------------------------------------------------------------- лес
  const inForest = (p: PointXZ) =>
    p.x > GROUND.minX + 0.5 &&
    p.x < GROUND.maxX - 0.5 &&
    p.z > GROUND.minZ + 0.5 &&
    p.z < GROUND.maxZ - 0.5 &&
    !isOpen(p, 0.7) &&
    !(p.z > YARD.maxZ - 0.5 && p.z < SOUTH.forestFromZ) &&
    Math.hypot(p.x - WINDMILL.x, p.z - WINDMILL.z) > WINDMILL_CLEARING;

  /**
   * Какое дерево: на опушке — берёзы и осенние, в глубине — тёмные ели.
   * Тени — только у опушки: в чаще их всё равно не видно за стволами, а треугольников много.
   */
  const plantTree = (p: PointXZ, deep: boolean, scale: number, shaded = true) => {
    const roll = rng.next();
    const shadow = shaded ? 1.5 * scale : 0;
    if (deep) {
      if (roll < 0.3) add(sheets.pine, { ...p, scale }, shadow);
      else if (roll < 0.55) add(sheets.pine, { ...p, column: 1, scale }, shadow);
      else if (roll < 0.75) add(sheets.tree, { ...p, column: 3, scale }, shadow);
      else if (roll < 0.87) add(sheets.tree, { ...p, scale }, shadow);
      else if (roll < 0.93) add(sheets.birch, { ...p, scale }, shadow * 0.8);
      else add(sheets.tree, { ...p, column: rng.chance(0.5) ? 1 : 2, scale }, shadow);
    } else if (roll < 0.22) add(sheets.tree, { ...p, scale }, shadow);
    else if (roll < 0.38) add(sheets.birch, { ...p, scale }, shadow * 0.8);
    else if (roll < 0.46) add(sheets.birch, { ...p, column: 1, scale }, shadow * 0.8);
    else if (roll < 0.56) add(sheets.tree, { ...p, column: 1, scale }, shadow);
    else if (roll < 0.66) add(sheets.tree, { ...p, column: 2, scale }, shadow);
    else if (roll < 0.9) add(sheets.pine, { ...p, scale }, shadow);
    else add(sheets.tree, { ...p, column: 3, scale }, shadow);
  };

  /** Подлесок перед деревом: кусты, папоротник, пни, брёвна, камни, грибы. */
  const plantUndergrowth = (p: PointXZ) => {
    const q = { x: p.x + rng.range(-0.8, 0.8), z: p.z + rng.range(0.5, 0.95) };
    if (!inForest(q)) return;
    const roll = rng.next();
    if (roll < 0.3) add(sheets.bush, { ...q, column: rng.int(0, 3) }, 0.9);
    else if (roll < 0.52) add(sheets.fern, q, 0.7);
    else if (roll < 0.64) add(sheets.stump, { ...q, column: rng.chance(0.15) ? 1 : 0 }, 0.8);
    else if (roll < 0.72) add(sheets.log, q, 1.2);
    else if (roll < 0.84) add(sheets.rock, { ...q, column: rng.int(0, 3) }, 0.8);
    else add(sheets.mushroom, { ...q, column: rng.int(0, 3) }, 0.3);
  };

  const step = 1.7;
  for (let z = GROUND.minZ + 0.8; z < GROUND.maxZ; z += step) {
    for (let x = GROUND.minX + 0.8; x < GROUND.maxX; x += step) {
      const p = { x: x + rng.range(-0.65, 0.65), z: z + rng.range(-0.65, 0.65) };
      if (!inForest(p)) continue;
      const depth = depthInForest(p);
      plantTree(p, depth > 3.5, rng.range(0.95, 1.2) + Math.min(0.15, depth * 0.02), depth < 7);
      if (rng.chance(depth < 6 ? 0.35 : 0.15)) plantUndergrowth(p);
    }
  }

  // ---------------------------------------------------------------- цветы и трава на открытых местах
  const nearBanya = (p: PointXZ) => BANYA_XS.some((cx) => Math.abs(p.x - cx) < 9.6 && p.z > -8.2 && p.z < 4.3);
  const onCarpet = (p: PointXZ) => Math.abs(p.z - CARPET.z) < CARPET.width / 2 + 0.5 && Math.abs(p.x) < CARPET.endX + 3;
  const onTrail = (p: PointXZ) => Math.abs(p.x - (TRAIL.minX + TRAIL.maxX) / 2) < 1.5 && p.z < 4.3 && p.z > TRAIL.minZ;
  const inBed = (p: PointXZ) => GARDEN_BEDS.some((b) => p.x > b.minX - 0.5 && p.x < b.maxX + 0.5 && p.z > b.minZ - 0.5 && p.z < b.maxZ + 0.5);
  const nearSpot = (p: PointXZ) => Object.values(SPOTS).some((s) => Math.hypot(p.x - s.x, p.z - s.z) < 1.6);
  const onRoad = (p: PointXZ) => Math.abs(p.z - SOUTH.roadZ) < SOUTH.roadWidth / 2 + 0.4 || Math.abs(p.z - SOUTH.fenceZ) < 0.5;
  const meadow = (p: PointXZ) => {
    const south = p.z > YARD.maxZ - 0.3 && p.z < SOUTH.forestFromZ - 0.5 && Math.abs(p.x) < GROUND.maxX - 2;
    if (!south && !isOpen(p, -0.4)) return false;
    return !nearBanya(p) && !onCarpet(p) && !onTrail(p) && !inBed(p) && !nearSpot(p) && !onRoad(p) && !inPond(p, 1.25);
  };
  const scatterArea = (minX: number, maxX: number, minZ: number, maxZ: number, clumps: number) => {
    for (let i = 0; i < clumps; i++) {
      const center = { x: rng.range(minX, maxX), z: rng.range(minZ, maxZ) };
      const kind = rng.next();
      const flower = rng.int(0, 5);
      const size = rng.int(2, 6);
      for (let k = 0; k < size; k++) {
        const p = { x: center.x + rng.range(-0.9, 0.9), z: center.z + rng.range(-0.7, 0.7) };
        if (!meadow(p)) continue;
        if (kind < 0.52) add(sheets.flower, { ...p, column: flower });
        else if (kind < 0.975) add(sheets.grassTuft, { ...p, column: rng.int(0, 3) });
        else add(sheets.rock, { ...p, column: 0, scale: 0.8 }, 0.5);
      }
    }
  };
  scatterArea(YARD.minX, YARD.maxX, YARD.minZ, YARD.maxZ, 150);
  scatterArea(GLADE.minX, GLADE.maxX, GLADE.minZ, GLADE.maxZ, 40);
  scatterArea(GROUND.minX + 2, GROUND.maxX - 2, YARD.maxZ, SOUTH.forestFromZ, 170);

  // ---------------------------------------------------------------- тропинки
  const trailX = (TRAIL.minX + TRAIL.maxX) / 2;
  strip(textures.path, { x: trailX, z: CARPET.z - CARPET.width / 2 }, { x: trailX, z: TRAIL.minZ - 0.6 }, 2.2);
  strip(textures.path, { x: trailX, z: TRAIL.minZ - 0.3 }, { x: SPOTS.hut.x + 1.2, z: SPOTS.hut.z + 1 }, 1.8);
  for (const cx of BANYA_XS) strip(textures.path, { x: cx, z: 1.2 }, { x: cx, z: CARPET.z - CARPET.width / 2 }, 3);
  const pierZ = (PIER.minZ + PIER.maxZ) / 2;
  strip(textures.path, { x: PIER_PATH_X, z: CARPET.z - CARPET.width / 2 }, { x: PIER_PATH_X, z: pierZ - 0.5 }, 1.8);
  strip(textures.path, { x: PIER_PATH_X - 0.5, z: pierZ }, { x: PIER.minX + 0.3, z: pierZ }, 1.6);
  strip(textures.path, { x: GARDEN_PATH_X, z: CARPET.z - CARPET.width / 2 }, { x: GARDEN_PATH_X, z: GARDEN_BEDS[2].maxZ + 0.4 }, 1.8);
  strip(textures.path, { x: GROUND.minX, z: SOUTH.roadZ }, { x: GROUND.maxX, z: SOUTH.roadZ }, SOUTH.roadWidth);

  // ---------------------------------------------------------------- огород
  GARDEN_BEDS.forEach((bed, row) => {
    const z = (bed.minZ + bed.maxZ) / 2;
    strip(textures.soil, { x: bed.minX, z }, { x: bed.maxX, z }, bed.maxZ - bed.minZ);
    for (let x = bed.minX + 0.6; x <= bed.maxX - 0.4; x += 1.2) add(sheets.crops, { x: x + rng.range(-0.1, 0.1), z: z + 0.1, column: row }, 0.6);
  });
  const scarecrow = new BillboardSprite(sheets.scarecrow);
  scarecrow.object.position.set(SCARECROW.x, 0, SCARECROW.z);
  scene.add(scarecrow.object);
  let scarecrowTime = 0;
  animated.push((dt) => {
    scarecrowTime += dt;
    scarecrow.setFrame(Math.floor(scarecrowTime / 1.3) % 2);
  });

  // ---------------------------------------------------------------- пруд
  const shore = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#b8966a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  shore.scale.set(POND.rx + 0.55, 1, POND.rz + 0.5);
  shore.position.set(POND.x, 0.004, POND.z);
  const waterMap = repeated(textures.water, POND.rx, POND.rz);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: waterMap, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  water.scale.set(POND.rx, 1, POND.rz);
  water.position.set(POND.x, 0.012, POND.z);
  scene.add(shore, water);
  animated.push((dt) => {
    waterMap.offset.x = (waterMap.offset.x + dt * 0.04) % 1;
    waterMap.offset.y = Math.sin(performance.now() / 2500) * 0.05;
  });
  // мостки из досок и сваи
  const pierLength = PIER.maxX - PIER.minX;
  const pierWidth = PIER.maxZ - PIER.minZ;
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(pierLength, 0.06, pierWidth),
    new THREE.MeshLambertMaterial({ map: repeated(textures.planks, pierWidth / 2, pierLength / 2) }),
  );
  pier.position.set((PIER.minX + PIER.maxX) / 2, 0.03, (PIER.minZ + PIER.maxZ) / 2);
  scene.add(pier);
  for (const x of [PIER.maxX - 0.15, PIER.minX + pierLength * 0.55]) {
    for (const z of [PIER.minZ + 0.1, PIER.maxZ - 0.1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 0.16), new THREE.MeshLambertMaterial({ color: '#5a3a38' }));
      post.position.set(x, 0.12, z);
      scene.add(post);
    }
  }
  // камыш по берегу (кроме стороны мостков)
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + rng.range(-0.12, 0.12);
    if (Math.abs(Math.cos(angle) + 1) < 0.35) continue;
    const x = POND.x + Math.cos(angle) * POND.rx * 1.03;
    const z = POND.z + Math.sin(angle) * POND.rz * 1.03;
    add(sheets.fern, { x, z, column: 1, scale: rng.range(0.9, 1.3) });
  }
  // утки плавают кругами
  for (let i = 0; i < 3; i++) {
    const duck = new BillboardSprite(sheets.duck);
    scene.add(duck.object);
    const speed = rng.range(0.18, 0.3) * (i % 2 ? -1 : 1);
    let phase = (i / 3) * Math.PI * 2;
    let time = rng.range(0, 2);
    const cx = POND.x + 1.1;
    animated.push((dt) => {
      phase += speed * dt;
      time += dt;
      duck.object.position.set(cx + Math.cos(phase) * 2.2, 0.02, POND.z + Math.sin(phase) * 1.5);
      // куда плывёт — туда и смотрит
      const heading = -Math.sin(phase) * speed;
      duck.setFrame(Math.floor(time * 1.6) % 2, heading >= 0 ? 0 : 1);
    });
  }

  // ---------------------------------------------------------------- поляна
  const gladeTrees: PointXZ[] = [
    { x: GLADE.minX + 0.8, z: GLADE.minZ + 0.7 },
    { x: GLADE.minX + 2.4, z: GLADE.minZ + 0.5 },
    { x: GLADE.minX + 0.7, z: GLADE.maxZ - 1.8 },
    { x: GLADE.minX + 0.9, z: (GLADE.minZ + GLADE.maxZ) / 2 },
    { x: GLADE.maxX - 0.8, z: GLADE.minZ + 0.7 },
    { x: GLADE.maxX - 2.6, z: GLADE.minZ + 0.4 },
    { x: GLADE.maxX - 0.7, z: GLADE.maxZ - 2.2 },
  ];
  for (const p of gladeTrees) {
    plantTree(p, false, rng.range(1, 1.15));
    builder.circles.push({ ...p, radius: 0.45 });
  }
  // ведьмин круг из мухоморов
  const ring = { x: -20.3, z: -18.4 };
  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * Math.PI * 2;
    add(sheets.mushroom, { x: ring.x + Math.cos(angle) * 1.4, z: ring.z + Math.sin(angle) * 1, column: i % 4 === 0 ? 1 : 0 }, 0.3);
  }
  // брёвна у костра
  add(sheets.log, { x: SPOTS.campfire.x + 1.5, z: SPOTS.campfire.z + 0.3 }, 1.2);
  builder.circles.push({ x: SPOTS.campfire.x + 1.5, z: SPOTS.campfire.z + 0.3, radius: 0.5 });
  add(sheets.stump, { x: SPOTS.campfire.x, z: SPOTS.campfire.z - 1.3 }, 0.8);

  // ---------------------------------------------------------------- мельница на опушке
  const windmill = new BillboardSprite(sheets.windmill);
  windmill.object.position.set(WINDMILL.x, 0, WINDMILL.z);
  scene.add(windmill.object);
  add(sheets.bush, { x: WINDMILL.x - 2.2, z: WINDMILL.z + 1.2, column: 2 }, 0.9);
  add(sheets.bush, { x: WINDMILL.x + 2, z: WINDMILL.z + 1.5, column: 1 }, 0.9);
  let windmillTime = 0;
  animated.push((dt) => {
    windmillTime += dt;
    windmill.setFrame(Math.floor(windmillTime * 5) % 4);
  });

  // ---------------------------------------------------------------- южный край: забор, дорога, остановка
  for (let x = GROUND.minX + 1; x <= GROUND.maxX - 1; x += 2) add(sheets.fence, { x, z: SOUTH.fenceZ });
  add(sheets.busStop, BUS_STOP, 2);
  const tractor = new BillboardSprite(sheets.tractor);
  tractor.object.visible = false;
  scene.add(tractor.object);
  let tractorWait = rng.range(5, 15);
  let tractorX = GROUND.minX - 2;
  animated.push((dt) => {
    if (tractorWait > 0) {
      tractorWait -= dt;
      tractor.object.visible = false;
      return;
    }
    tractorX += dt * 3.2;
    tractor.object.visible = true;
    tractor.object.position.set(tractorX, 0, SOUTH.roadZ + 0.3);
    tractor.setFrame(Math.abs(Math.floor(tractorX * 2)) % 2);
    if (tractorX > GROUND.maxX + 2) {
      tractorX = GROUND.minX - 2;
      tractorWait = rng.range(25, 60);
    }
  });

  // ---------------------------------------------------------------- птицы и бабочки
  animated.push(createBirds(scene, sheets.bird, rng));
  const butterflyHomes: PointXZ[] = [
    { x: -48, z: 1.5 },
    { x: -19, z: -19.5 },
    { x: -6, z: -23.5 },
    { x: 31, z: 9.2 },
    { x: -31, z: 9.6 },
    { x: 5, z: 10 },
    { x: 46.5, z: 1.8 },
    { x: -2, z: 13.5 },
  ];
  butterflyHomes.forEach((home, i) => animated.push(createButterfly(scene, sheets.butterfly, home, i % 3, rng)));

  return {
    update: (dt, focus) => {
      for (const animate of animated) animate(dt, focus);
    },
  };
}

function repeated(texture: THREE.Texture, u: number, v: number): THREE.Texture {
  const copy = texture.clone();
  copy.repeat.set(u, v);
  return copy;
}

/** Стайки птиц время от времени пролетают над игроком. */
function createBirds(scene: THREE.Scene, sheet: SpriteSheet, rng: Rng): Animate {
  const birds = Array.from({ length: 8 }, () => {
    const sprite = new BillboardSprite(sheet);
    sprite.object.visible = false;
    scene.add(sprite.object);
    return { sprite, active: false, velocity: 0, time: 0 };
  });
  let timer = rng.range(3, 7);
  return (dt, focus) => {
    timer -= dt;
    if (timer <= 0) {
      timer = rng.range(8, 18);
      const direction = rng.chance(0.5) ? 1 : -1;
      const z = focus.z - rng.range(3, 12);
      const y = rng.range(4.5, 7);
      const speed = rng.range(5.5, 7.5);
      const flock = rng.int(1, 5);
      let placed = 0;
      for (const bird of birds) {
        if (bird.active || placed >= flock) continue;
        bird.active = true;
        bird.velocity = speed * direction;
        bird.time = rng.range(0, 1);
        // клином: каждая следующая чуть позади и в стороне
        bird.sprite.object.position.set(focus.x - direction * (30 + placed * 1.2), y + placed * 0.35, z + (placed % 2 ? 0.8 : -0.8) * placed);
        bird.sprite.object.visible = true;
        placed++;
      }
    }
    for (const bird of birds) {
      if (!bird.active) continue;
      bird.time += dt;
      const position = bird.sprite.object.position;
      position.x += bird.velocity * dt;
      position.y += Math.sin(bird.time * 3) * 0.3 * dt;
      bird.sprite.setFrame(Math.floor(bird.time * 7) % 2);
      if (Math.abs(position.x - focus.x) > 36) {
        bird.active = false;
        bird.sprite.object.visible = false;
      }
    }
  };
}

/** Бабочка порхает над цветами возле своего места. */
function createButterfly(scene: THREE.Scene, sheet: SpriteSheet, home: PointXZ, row: number, rng: Rng): Animate {
  const sprite = new BillboardSprite(sheet);
  scene.add(sprite.object);
  const position = sprite.object.position.set(home.x, 0.8, home.z);
  const target = new THREE.Vector3(home.x, 0, home.z);
  let time = rng.range(0, 10);
  return (dt) => {
    time += dt;
    if (Math.hypot(target.x - position.x, target.z - position.z) < 0.2) {
      target.set(home.x + rng.range(-2.5, 2.5), 0, home.z + rng.range(-1.8, 1.8));
    }
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz) || 1;
    const speed = 1.1 * dt;
    position.x += (dx / distance) * speed + Math.sin(time * 5) * 0.4 * dt;
    position.z += (dz / distance) * speed;
    position.y = 0.7 + Math.sin(time * 2.3) * 0.35 + Math.abs(Math.sin(time * 9)) * 0.1;
    sprite.setFrame(Math.floor(time * 11) % 2, row);
  };
}
