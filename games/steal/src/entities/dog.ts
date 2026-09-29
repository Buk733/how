import type { PointXZ } from '@engine/math';
import type { SpriteSheet } from '@engine/sprite';
import { Actor, moveWithCollisions, type Obstacles } from './actor';

/** Кадры листа собаки. Ряд 0 — смотрит вправо, ряд 1 — то же зеркально (влево). */
export const DogFrame = { Sit: 0, RunA: 1, RunB: 2, Bark: 3, Sleep: 4, Scared: 5 } as const;
export type DogFrame = (typeof DogFrame)[keyof typeof DogFrame];

const DOG_RADIUS = 0.3;

/** Собака: только тело — бег, кадры и отлёт от удара. Решения принимает GuardDog. */
export class Dog extends Actor {
  private left = false;
  private runTime = 0;

  constructor(sheet: SpriteSheet) {
    super(sheet, 0.9);
    this.sprite.enableSilhouette();
  }

  /** Бежит к цели, скользя вдоль стен, и останавливается за stop до неё. true — добежал. */
  runTowards(target: PointXZ, speed: number, dt: number, obstacles: Obstacles, stop = 0): boolean {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    this.face(dx);
    if (distance <= stop + 1e-3) return true;
    const step = Math.min(distance - stop, speed * dt);
    const p = moveWithCollisions(this.position.x, this.position.z, (dx / distance) * step, (dz / distance) * step, DOG_RADIUS, obstacles);
    this.position.x = p.x;
    this.position.z = p.z;
    this.runTime += dt;
    return distance - step <= stop + 1e-3;
  }

  /** Повернуться к точке (по горизонтали экрана). */
  lookAt(target: PointXZ): void {
    this.face(target.x - this.position.x);
  }

  /** Показать кадр; бег — два кадра по очереди. */
  show(frame: DogFrame): void {
    const running = frame === DogFrame.RunA || frame === DogFrame.RunB;
    const column = running ? (Math.floor(this.runTime * 10) % 2 ? DogFrame.RunB : DogFrame.RunA) : frame;
    this.sprite.setFrame(column, this.left ? 1 : 0);
  }

  /** Отлёт от удара — вызывать каждый кадр. */
  animate(dt: number, obstacles: Obstacles): void {
    this.updateKnock(dt, DOG_RADIUS, obstacles);
  }

  private face(dx: number): void {
    if (Math.abs(dx) > 0.05) this.left = dx < 0;
  }
}
