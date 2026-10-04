// Костёр у медведя: языки пламени листаются по кругу с неровным ритмом, в такт мерцает тёплый отсвет
// на земле и в воздухе, вверх летят искры и тянется лёгкий дымок. Картинка — campfire() в tools/art/scenery.mjs.
import * as THREE from 'three';
import type { PointXZ } from '@engine/math';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';
import { PuffPool, PuffSource, type PuffLook } from './puffs';
import { glowTexture } from './stove';

export interface CampfireSheets {
  readonly campfire: SpriteSheet;
  readonly puff: SpriteSheet;
}

/** Сколько держится кадр пламени, секунды: неровно — огонь не тикает, как часы. */
const FRAME_STEP: readonly [number, number] = [0.07, 0.12];
const SMOKE: PuffLook = { color: '#9aa0b0', opacity: 0.25, size: [0.35, 1.4] };
/** Искры: сколько одновременно, сколько в секунду, сколько живут, как быстро взлетают, как их сносит, размер. */
const SPARKS = { count: 12, rate: 4, life: [0.7, 1.4], rise: [0.9, 1.6], drift: 0.35, size: 0.075 } as const;
const SPARK_HOT = new THREE.Color('#ffe08a');
const SPARK_COOL = new THREE.Color('#e0502a');

interface Spark {
  readonly sprite: THREE.Sprite;
  readonly material: THREE.SpriteMaterial;
  readonly velocity: THREE.Vector3;
  age: number;
  life: number;
  phase: number;
}

export class Campfire {
  private readonly flames: BillboardSprite;
  private readonly frames: number;
  private frame = 0;
  private frameTimer = 0;
  private readonly groundGlow: THREE.MeshBasicMaterial;
  private readonly airGlow: THREE.SpriteMaterial;
  private readonly sparks: Spark[] = [];
  private sparkTimer = 0;
  private readonly origin: THREE.Vector3;
  private readonly puffs: PuffPool;
  private readonly smoke: PuffSource;

  constructor(scene: THREE.Scene, sheets: CampfireSheets, spot: PointXZ) {
    this.origin = new THREE.Vector3(spot.x, 0, spot.z);
    this.flames = new BillboardSprite(sheets.campfire);
    this.flames.object.position.copy(this.origin);
    scene.add(this.flames.object);
    this.frames = sheets.campfire.columns;
    this.frame = Math.floor(Math.random() * this.frames);

    // отсвет на земле — как у печи
    this.groundGlow = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3).rotateX(-Math.PI / 2), this.groundGlow);
    ground.position.set(spot.x, 0.03, spot.z + 0.2);
    scene.add(ground);
    // свечение вокруг пламени: чуть позади огня, чтобы само пламя оставалось чётким
    this.airGlow = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
    const air = new THREE.Sprite(this.airGlow);
    air.position.set(spot.x, 0.75, spot.z - 0.1);
    air.scale.set(2.2, 2.2, 1);
    scene.add(air);

    for (let i = 0; i < SPARKS.count; i++) {
      const material = new THREE.SpriteMaterial({ color: SPARK_HOT, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(SPARKS.size, SPARKS.size, 1);
      sprite.visible = false;
      scene.add(sprite);
      this.sparks.push({ sprite, material, velocity: new THREE.Vector3(), age: 0, life: 0, phase: 0 });
    }

    this.puffs = new PuffPool(scene, sheets.puff, 10);
    this.smoke = new PuffSource(this.puffs, new THREE.Vector3(spot.x, 1.45, spot.z), { rate: 1.2, life: 3, velocity: [0.15, 1, 0], spread: 0.35, look: SMOKE });
  }

  update(dt: number): void {
    this.frameTimer -= dt;
    if (this.frameTimer <= 0) {
      this.frameTimer = FRAME_STEP[0] + Math.random() * (FRAME_STEP[1] - FRAME_STEP[0]);
      this.frame = (this.frame + 1) % this.frames;
      this.flames.setFrame(this.frame);
      // свет подмигивает в такт пламени
      const flicker = Math.random();
      this.groundGlow.opacity = 0.34 + flicker * 0.16;
      this.airGlow.opacity = 0.15 + flicker * 0.1;
    }

    this.sparkTimer -= dt;
    while (this.sparkTimer <= 0) {
      this.sparkTimer += (0.5 + Math.random()) / SPARKS.rate;
      this.emitSpark();
    }
    for (const spark of this.sparks) {
      if (!spark.sprite.visible) continue;
      spark.age += dt;
      const t = spark.age / spark.life;
      if (t >= 1) {
        spark.sprite.visible = false;
        continue;
      }
      // взлетает, замедляясь, и петляет в потоке тёплого воздуха; остывая — краснеет и гаснет
      spark.velocity.y *= Math.pow(0.6, dt);
      spark.sprite.position.addScaledVector(spark.velocity, dt);
      spark.sprite.position.x += Math.sin(spark.age * 7 + spark.phase) * SPARKS.drift * dt;
      spark.material.color.copy(SPARK_HOT).lerp(SPARK_COOL, t);
      spark.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }

    this.smoke.update(dt);
    this.puffs.update(dt);
  }

  private emitSpark(): void {
    const spark = this.sparks.find((s) => !s.sprite.visible);
    if (!spark) return;
    const [minLife, maxLife] = SPARKS.life;
    const [minRise, maxRise] = SPARKS.rise;
    spark.age = 0;
    spark.life = minLife + Math.random() * (maxLife - minLife);
    spark.phase = Math.random() * Math.PI * 2;
    spark.velocity.set((Math.random() - 0.5) * 0.4, minRise + Math.random() * (maxRise - minRise), 0);
    spark.sprite.position.set(this.origin.x + (Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.4, this.origin.z + 0.05);
    spark.material.color.copy(SPARK_HOT);
    spark.material.opacity = 1;
    spark.sprite.visible = true;
  }
}
