import { Animator, type AnimationClip } from '@engine/animation';
import { cameraRelative, Facing, facingFromCamera } from '@engine/direction';
import type { MoveVector } from '@engine/input';
import { clampToBox, pushOutOfBoxes, pushOutOfCircles, type Box, type Circle } from '@engine/math';
import type { SpriteSheet } from '@engine/sprite';
import { PLAYER } from '../config';
import { Actor } from './actor';

const IDLE: AnimationClip = { frames: [0], fps: 1 };
const WALK: AnimationClip = { frames: [0, 1, 2, 3], fps: 10 };

export interface Obstacles {
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  readonly bounds: Box;
}

/** Двигает круг радиуса radius на (dx, dz), упирая его в стены, деревья и края мира. */
export function moveWithCollisions(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  obstacles: Obstacles,
): { x: number; z: number } {
  let p = pushOutOfBoxes(x + dx, z + dz, radius, obstacles.boxes);
  p = pushOutOfCircles(p.x, p.z, radius, obstacles.circles);
  return clampToBox(p.x, p.z, obstacles.bounds);
}

/** Герой игрока: бегает по миру, упирается в стены и деревья. */
export class Player extends Actor {
  private readonly animator = new Animator(IDLE);
  private facingX = 0;
  private facingZ = 1;
  private facing: Facing = Facing.Front;
  private stunned = 0;

  constructor(sheet: SpriteSheet) {
    super(sheet, 0.8);
    this.sprite.enableSilhouette(); // виден, даже когда зашёл за стену бани
  }

  /** «Нокаут»: несколько секунд игрок не может двигаться. */
  stun(seconds: number): void {
    this.stunned = seconds;
  }

  get isStunned(): boolean {
    return this.stunned > 0;
  }

  update(dt: number, move: MoveVector, cameraYaw: number, obstacles: Obstacles, speedFactor = 1): void {
    if (this.stunned > 0) {
      this.stunned = Math.max(0, this.stunned - dt);
      this.sprite.object.visible = this.stunned === 0 || Math.floor(this.stunned * 12) % 2 === 0;
      this.animator.play(IDLE);
      this.sprite.setFrame(this.animator.frame, this.facing);
      return;
    }
    this.sprite.object.visible = true;
    const dir = cameraRelative(move.x, move.y, cameraYaw);
    const strength = Math.hypot(dir.x, dir.z);
    if (strength > 0.05) {
      const speed = PLAYER.speed * speedFactor * dt;
      const p = moveWithCollisions(this.position.x, this.position.z, dir.x * speed, dir.z * speed, PLAYER.radius, obstacles);
      this.position.x = p.x;
      this.position.z = p.z;
      this.facingX = dir.x / strength;
      this.facingZ = dir.z / strength;
      this.animator.play(WALK);
      this.animator.update(dt * Math.max(strength, 0.5));
    } else {
      this.animator.play(IDLE);
    }
    this.facing = facingFromCamera(this.facingX, this.facingZ, cameraYaw, this.facing);
    this.sprite.setFrame(this.animator.frame, this.facing);
  }
}
