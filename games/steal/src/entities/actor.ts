import * as THREE from 'three';
import { clampToBox, pushOutOfBoxes, pushOutOfCircles, type Box, type Circle } from '@engine/math';
import { createBlobShadow } from '@engine/shadow';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';

export interface Obstacles {
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  readonly bounds: Box;
}

/** Самый длинный шаг за раз: длинный шаг разбивается, чтобы не проскочить сквозь тонкую стену. */
const MAX_STEP = 0.2;

/** Двигает круг радиуса radius на (dx, dz), упирая его в стены, деревья и края мира. */
export function moveWithCollisions(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  obstacles: Obstacles,
): { x: number; z: number } {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
  let p = { x, z };
  for (let i = 0; i < steps; i++) {
    p = pushOutOfBoxes(p.x + dx / steps, p.z + dz / steps, radius, obstacles.boxes);
    p = pushOutOfCircles(p.x, p.z, radius, obstacles.circles);
    p = clampToBox(p.x, p.z, obstacles.bounds);
  }
  return p;
}

/** Как быстро гаснет отбрасывание от удара: чем больше, тем короче полёт. */
const KNOCK_DECAY = 12;

/** Всё, что ходит по миру: спрайт-билборд и круглая тень под ним. */
export class Actor {
  readonly root = new THREE.Group();
  readonly sprite: BillboardSprite;
  protected readonly shadow: THREE.Mesh;
  private knockX = 0;
  private knockZ = 0;

  constructor(sheet: SpriteSheet, shadowSize: number) {
    this.sprite = new BillboardSprite(sheet);
    this.shadow = createBlobShadow(shadowSize);
    this.root.add(this.sprite.object, this.shadow);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** Отбрасывает в сторону (dirX, dirZ) примерно на distance единиц — от удара веником. */
  knock(dirX: number, dirZ: number, distance: number): void {
    const length = Math.hypot(dirX, dirZ);
    if (length < 1e-6) return;
    // при экспоненциальном затухании путь равен скорость / KNOCK_DECAY
    this.knockX = (dirX / length) * distance * KNOCK_DECAY;
    this.knockZ = (dirZ / length) * distance * KNOCK_DECAY;
  }

  /** Двигает по инерции после удара. Вызывать каждый кадр. */
  protected updateKnock(dt: number, radius: number, obstacles: Obstacles): void {
    if (this.knockX === 0 && this.knockZ === 0) return;
    const p = moveWithCollisions(this.position.x, this.position.z, this.knockX * dt, this.knockZ * dt, radius, obstacles);
    this.position.x = p.x;
    this.position.z = p.z;
    const decay = Math.exp(-KNOCK_DECAY * dt);
    this.knockX *= decay;
    this.knockZ *= decay;
    if (Math.hypot(this.knockX, this.knockZ) < 0.1) this.knockX = this.knockZ = 0;
  }

  dispose(): void {
    this.sprite.dispose();
  }
}
