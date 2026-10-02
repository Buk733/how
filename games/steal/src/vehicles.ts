// Машины из объёмных коробок с пиксельными картинками на гранях (tools/art/vehicles.mjs):
// старая «копейка» у пруда и трактор с легковушкой на дороге. Колёса крутятся, трактор дымит.
import * as THREE from 'three';
import { BoxModel, type Vec3 } from '@engine/boxes';
import type { Rng } from '@engine/rng';
import { createBlobShadow } from '@engine/shadow';
import type { SpriteSheet } from '@engine/sprite';
import { PIXELS_PER_UNIT } from './config';
import { GROUND, roadZ } from './layout';
import { PuffPool, type PuffLook } from './puffs';

/** Картинки граней машин: textures/<имя>.png. */
export const VEHICLE_TEXTURES = [
  'car-body-side',
  'car-body-top',
  'car-body-end',
  'car-cabin-side',
  'car-cabin-top',
  'car-cabin-end',
  'tire',
  'hub-car',
  'tractor-hood-side',
  'tractor-hood-top',
  'tractor-grille',
  'tractor-cabin-side',
  'tractor-cabin-front',
  'tractor-roof',
  'tractor-tire',
  'hub-tractor',
] as const;
export type VehicleTextures = Record<(typeof VEHICLE_TEXTURES)[number], THREE.Texture>;

/** Цвет машины — строка листов её картинок. */
export const CAR_PAINT = { oldBlue: 0, cherry: 1 } as const;

/** Пиксели картинки → единицы мира. */
const px = (pixels: number) => pixels / PIXELS_PER_UNIT;

/** «Копейка»: смотрит вперёд по +x, центр — посередине между колёсами. */
const CAR = {
  length: px(64),
  width: px(26),
  bodyHeight: px(10),
  cabinLength: px(34),
  cabinWidth: px(23),
  cabinHeight: px(9),
  /** Кабина ближе к багажнику: капот длиннее. */
  cabinX: -0.06,
  /** Насколько крыша короче кабины сзади и спереди. */
  cabinSlant: [0.3, 0.45] as const,
  wheelRadius: 0.36,
  wheelWidth: 0.26,
  wheelX: 1.25,
  wheelZ: 0.72,
} as const;

/** Трактор: кабина над большими задними колёсами, капот над маленькими передними. */
const TRACTOR = {
  hoodLength: px(36),
  hoodWidth: px(13),
  hoodHeight: px(10),
  hoodBottom: 0.55,
  cabinLength: px(21),
  cabinWidth: px(19),
  cabinHeight: px(20),
  /** Кабина над задними колёсами — иначе сверху её закрывают колёса и крылья. */
  cabinBottom: 1.02,
  rear: { radius: 0.75, width: 0.5, x: -0.66, z: 0.86 },
  front: { radius: 0.42, width: 0.3, x: 1.62, z: 0.6 },
  /** Где верх выхлопной трубы. */
  exhaust: [1.35, 1.95, -0.22] as Vec3,
} as const;

// Свет «запечён» в цвет вершин модели (BoxModel): картинки выглядят как нарисованы, бока темнее.
const painted = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, vertexColors: true });
const plain = (color: string) => new THREE.MeshBasicMaterial({ color, vertexColors: true });

/** Картинка колеса: сбоку шина, на торцах диск (снаружи круга прозрачно). Колёса — в тени кузова. */
function wheelMaterials(tire: THREE.Texture, hub: THREE.Texture, tireRepeat: number): THREE.Material[] {
  const tread = tire.clone();
  tread.wrapS = THREE.RepeatWrapping;
  tread.repeat.set(tireRepeat, 1);
  return [new THREE.MeshBasicMaterial({ map: tread, color: '#b8b8b8' }), new THREE.MeshBasicMaterial({ map: hub, alphaTest: 0.5, color: '#dcdcdc' })];
}

/** Колесо — цилиндр поперёк машины (ось по z); оба торца в одной группе материала 1. */
function wheelGeometry(radius: number, width: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, width, 16).rotateX(Math.PI / 2);
  const [side, top, bottom] = geometry.groups;
  geometry.clearGroups();
  geometry.addGroup(side.start, side.count, 0);
  geometry.addGroup(top.start, top.count + bottom.count, 1);
  return geometry;
}

/** Колёса одного размера одной отрисовкой: все крутятся вместе. */
class Wheels {
  readonly mesh: THREE.InstancedMesh;
  private readonly spots: readonly Vec3[];
  private readonly radius: number;
  private readonly matrix = new THREE.Matrix4();

  constructor(radius: number, width: number, materials: THREE.Material[], spots: readonly Vec3[]) {
    this.radius = radius;
    this.spots = spots;
    this.mesh = new THREE.InstancedMesh(wheelGeometry(radius, width), materials, spots.length);
    this.roll(0);
    this.mesh.computeBoundingSphere();
  }

  /** Повернуть колёса так, будто машина проехала distance вперёд. */
  roll(distance: number): void {
    const angle = -distance / this.radius;
    this.spots.forEach(([x, y, z], i) => this.mesh.setMatrixAt(i, this.matrix.makeRotationZ(angle).setPosition(x, y, z)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Пятно света фар на земле: пиксельный конус, к концу редеет. */
let beamTexture: THREE.DataTexture | null = null;
function headlightBeam(): THREE.DataTexture {
  if (beamTexture) return beamTexture;
  const [w, h] = [32, 24];
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const across = Math.abs((j + 0.5) / h - 0.5);
      // шахматный узор редеет к дальнему концу
      const dither = ((i * 7 + j * 13) % 16) / 16;
      if (across < 0.2 + 0.28 * t && dither < 1 - t * 0.85) data.set([255, 255, 255, 255], (j * w + i) * 4);
    }
  beamTexture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  beamTexture.magFilter = THREE.NearestFilter;
  beamTexture.minFilter = THREE.NearestFilter;
  beamTexture.needsUpdate = true;
  return beamTexture;
}

/** Легковушка: кузов с кабиной, хром, колёса, фары, тень. */
export class Car {
  readonly root = new THREE.Group();
  /** Кузов отдельно от колёс — чтобы машина могла подпрыгнуть на рессорах. */
  private readonly body = new THREE.Group();
  private readonly wheels: Wheels;
  private readonly lights = new THREE.Group();

  constructor(textures: VehicleTextures, paint: number) {
    const t = textures;
    const materials = [
      painted(t['car-body-side']),
      painted(t['car-body-top']),
      painted(t['car-body-end']),
      painted(t['car-cabin-side']),
      painted(t['car-cabin-top']),
      painted(t['car-cabin-end']),
      plain('#c3d3e6'),
    ];
    const [SIDE, TOP, END, CABIN_SIDE, CABIN_TOP, CABIN_END, CHROME] = [0, 1, 2, 3, 4, 5, 6];
    const bodyBottom = CAR.wheelRadius;
    const bodyTop = bodyBottom + CAR.bodyHeight;
    const chrome = { near: [CHROME], far: [CHROME], front: [CHROME], back: [CHROME], top: [CHROME] } as const;
    const geometry = new BoxModel([
      [1, 2],
      [1, 2],
      [2, 2],
      [1, 2],
      [1, 2],
      [2, 2],
    ])
      .box([CAR.length, CAR.bodyHeight, CAR.width], [0, bodyBottom + CAR.bodyHeight / 2, 0], {
        near: [SIDE, 0, paint],
        far: [SIDE, 0, paint],
        top: [TOP, 0, paint],
        front: [END, 0, paint],
        back: [END, 1, paint],
      })
      // лобовое и заднее стёкла наклонные — их видно сверху
      .box(
        [CAR.cabinLength, CAR.cabinHeight, CAR.cabinWidth],
        [CAR.cabinX, bodyTop + CAR.cabinHeight / 2, 0],
        {
          near: [CABIN_SIDE, 0, paint],
          far: [CABIN_SIDE, 0, paint],
          top: [CABIN_TOP, 0, paint],
          front: [CABIN_END, 0, paint],
          back: [CABIN_END, 1, paint],
        },
        { slant: CAR.cabinSlant },
      )
      // бамперы чуть торчат за кузов, зеркала — у лобового стекла
      .box([0.12, 0.13, CAR.width + 0.08], [CAR.length / 2 + 0.05, bodyBottom + 0.1, 0], chrome)
      .box([0.12, 0.13, CAR.width + 0.08], [-CAR.length / 2 - 0.05, bodyBottom + 0.1, 0], chrome)
      .box([0.1, 0.1, 0.14], [CAR.cabinX + CAR.cabinLength / 2 - 0.05, bodyTop + 0.08, CAR.width / 2 + 0.06], chrome)
      .box([0.1, 0.1, 0.14], [CAR.cabinX + CAR.cabinLength / 2 - 0.05, bodyTop + 0.08, -CAR.width / 2 - 0.06], chrome)
      .build();
    this.body.add(new THREE.Mesh(geometry, materials));

    const { wheelRadius: r, wheelX: wx, wheelZ: wz } = CAR;
    this.wheels = new Wheels(r, CAR.wheelWidth, wheelMaterials(t.tire, t['hub-car'], 1), [
      [wx, r, wz],
      [-wx, r, wz],
      [wx, r, -wz],
      [-wx, r, -wz],
    ]);

    // фары: светятся по команде, на земле перед машиной — пятно света
    const glow = new THREE.MeshBasicMaterial({ color: '#fffbe0' });
    for (const z of [0.52, -0.52]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.17, 0.24), glow);
      lamp.position.set(CAR.length / 2 + 0.02, bodyBottom + 0.36, z);
      this.lights.add(lamp);
    }
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: headlightBeam(), color: '#fff3b0', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(CAR.length / 2 + 1.6, 0.03, 0);
    this.lights.add(beam);
    this.lights.visible = false;
    this.body.add(this.lights);

    const shadow = createBlobShadow(1);
    shadow.scale.set(CAR.length + 0.5, 1, CAR.width + 0.5);
    this.root.add(shadow, this.body, this.wheels.mesh);
  }

  setLights(on: boolean): void {
    this.lights.visible = on;
  }

  /** Кузов приподнят на lift (рессоры качаются). */
  setLift(lift: number): void {
    this.body.position.y = lift;
  }

  roll(distance: number): void {
    this.wheels.roll(distance);
  }
}

/** Трактор: красный капот, кабина с трактористом, огромные задние колёса, выхлопная труба. */
export class Tractor {
  readonly root = new THREE.Group();
  private readonly rearWheels: Wheels;
  private readonly frontWheels: Wheels;

  constructor(textures: VehicleTextures) {
    const t = textures;
    const materials = [
      painted(t['tractor-hood-side']),
      painted(t['tractor-hood-top']),
      painted(t['tractor-grille']),
      painted(t['tractor-cabin-side']),
      painted(t['tractor-cabin-front']),
      painted(t['tractor-roof']),
      plain('#c8453a'),
      plain('#2b2733'),
      plain('#dfe3ea'),
    ];
    const [HOOD, HOOD_TOP, GRILLE, CABIN, WINDSHIELD, ROOF, RED, DARK, WHITE] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const T = TRACTOR;
    const all = (m: number) => ({ near: [m], far: [m], front: [m], back: [m], top: [m] }) as const;
    const cabinX = -T.cabinLength / 2;
    const cabinTop = T.cabinBottom + T.cabinHeight;
    const hoodTop = T.hoodBottom + T.hoodHeight;
    const [ex, ey, ez] = T.exhaust;
    const geometry = new BoxModel()
      // рама под капотом и кабиной, под кабиной — коробка передач, спереди противовес
      .box([3.1, 0.24, 0.62], [0.55, 0.42, 0], all(DARK))
      .box([T.cabinLength - 0.1, T.cabinBottom - 0.54, 0.8], [cabinX, (T.cabinBottom + 0.54) / 2, 0], all(DARK))
      .box([0.2, 0.34, 0.9], [T.hoodLength + 0.1, 0.6, 0], all(DARK))
      .box(
        [T.hoodLength, T.hoodHeight, T.hoodWidth],
        [T.hoodLength / 2, T.hoodBottom + T.hoodHeight / 2, 0],
        { near: [HOOD], far: [HOOD], top: [HOOD_TOP], front: [GRILLE] },
        { slant: [0, 0.12] },
      )
      .box([T.cabinLength, T.cabinHeight, T.cabinWidth], [cabinX, T.cabinBottom + T.cabinHeight / 2, 0], {
        near: [CABIN],
        far: [CABIN],
        front: [WINDSHIELD],
        back: [WINDSHIELD],
      })
      // крыша чуть шире кабины, белая
      .box([T.cabinLength + 0.16, 0.1, T.cabinWidth + 0.14], [cabinX, cabinTop + 0.05, 0], { ...all(WHITE), top: [ROOF] })
      // крылья над задними колёсами
      .box([1.5, 0.08, T.rear.width + 0.04], [T.rear.x, T.rear.radius * 2 + 0.05, T.rear.z], all(RED))
      .box([1.5, 0.08, T.rear.width + 0.04], [T.rear.x, T.rear.radius * 2 + 0.05, -T.rear.z], all(RED))
      // выхлопная труба с колпачком
      .box([0.1, ey - hoodTop, 0.1], [ex, (ey + hoodTop) / 2, ez], all(DARK))
      .box([0.16, 0.06, 0.16], [ex, ey, ez], all(DARK))
      .build();
    this.root.add(new THREE.Mesh(geometry, materials));

    const rear = T.rear;
    this.rearWheels = new Wheels(rear.radius, rear.width, wheelMaterials(t['tractor-tire'], t['hub-tractor'], 2), [
      [rear.x, rear.radius, rear.z],
      [rear.x, rear.radius, -rear.z],
    ]);
    const front = T.front;
    this.frontWheels = new Wheels(front.radius, front.width, wheelMaterials(t['tractor-tire'], t['hub-tractor'], 1), [
      [front.x, front.radius, front.z],
      [front.x, front.radius, -front.z],
    ]);
    const shadow = createBlobShadow(1);
    shadow.scale.set(4, 1, 2.3);
    shadow.position.x = 0.4;
    this.root.add(shadow, this.rearWheels.mesh, this.frontWheels.mesh);
  }

  /** Верх выхлопной трубы в мире. */
  exhaust(target: THREE.Vector3): THREE.Vector3 {
    return this.root.localToWorld(target.set(...TRACTOR.exhaust));
  }

  roll(distance: number): void {
    this.rearWheels.roll(distance);
    this.frontWheels.roll(distance);
  }
}

/** Одна машина на дороге: ездит туда-обратно по своей полосе, между поездками ждёт. */
interface Traveller {
  readonly root: THREE.Object3D;
  readonly roll: (distance: number) => void;
  /** Куда едет: +1 — на восток, −1 — на запад. */
  readonly direction: 1 | -1;
  /** Сдвиг полосы от середины дороги (+ — ближе к камере). */
  readonly lane: number;
  readonly speed: number;
  /** Сколько ждать между поездками, секунды. */
  readonly pause: readonly [number, number];
  x: number;
  wait: number;
  travelled: number;
}

/** Сизый выхлоп трактора. */
const EXHAUST: PuffLook = { color: '#7d8494', opacity: 0.6, size: [0.3, 1] };

/** Клубы дыма из трубы трактора: остаются там, где вылетели, растут, поднимаются и тают. */
class Exhaust {
  private readonly pool: PuffPool;
  private timer = 0;
  private readonly spot = new THREE.Vector3();
  private readonly rise = new THREE.Vector3(0, 1.1, 0);

  constructor(scene: THREE.Scene, sheet: SpriteSheet) {
    this.pool = new PuffPool(scene, sheet, 8);
  }

  update(dt: number, tractor: Tractor | null): void {
    if (tractor) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.28;
        this.pool.emit(tractor.exhaust(this.spot), this.rise, 1.5, EXHAUST);
      }
    }
    this.pool.update(dt);
  }
}

/**
 * Движение на просёлке: трактор тарахтит на восток по ближней полосе, вишнёвая легковушка
 * проносится на запад по дальней. По одной машине на полосу — не наезжают друг на друга.
 */
export function createTraffic(scene: THREE.Scene, textures: VehicleTextures, puff: SpriteSheet, rng: Rng): (dt: number) => void {
  const tractor = new Tractor(textures);
  const car = new Car(textures, CAR_PAINT.cherry);
  const travellers: Traveller[] = [
    { root: tractor.root, roll: (d) => tractor.roll(d), direction: 1, lane: 0.35, speed: 3, pause: [25, 55], x: 0, wait: rng.range(6, 16), travelled: 0 },
    { root: car.root, roll: (d) => car.roll(d), direction: -1, lane: -0.45, speed: 6.5, pause: [14, 35], x: 0, wait: rng.range(3, 10), travelled: 0 },
  ];
  const [startX, endX] = [GROUND.minX - 5, GROUND.maxX + 5];
  for (const t of travellers) {
    t.root.visible = false;
    t.x = t.direction > 0 ? startX : endX;
    scene.add(t.root);
  }
  const exhaust = new Exhaust(scene, puff);
  return (dt) => {
    for (const t of travellers) {
      if (t.wait > 0) {
        t.wait -= dt;
        t.root.visible = false;
        continue;
      }
      t.x += t.direction * t.speed * dt;
      t.travelled += t.speed * dt;
      t.roll(t.travelled);
      // дорога виляет — машина поворачивает вслед за ней
      const slope = roadZ(t.x + 0.5) - roadZ(t.x - 0.5);
      t.root.position.set(t.x, 0, roadZ(t.x) + t.lane);
      t.root.rotation.y = t.direction > 0 ? -Math.atan(slope) : Math.PI - Math.atan(slope);
      t.root.visible = true;
      if (t.direction > 0 ? t.x > endX : t.x < startX) {
        t.x = t.direction > 0 ? startX : endX;
        t.wait = rng.range(...t.pause);
      }
    }
    exhaust.update(dt, tractor.root.visible ? tractor : null);
  };
}
