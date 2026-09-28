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

/** Герой игрока: бегает по миру, упирается в стены и деревья. */
export class Player extends Actor {
  private readonly animator = new Animator(IDLE);
  private facingX = 0;
  private facingZ = 1;
  private facing: Facing = Facing.Front;

  constructor(sheet: SpriteSheet) {
    super(sheet, 0.8);
    this.sprite.enableSilhouette(); // виден, даже когда зашёл за стену бани
  }

  update(dt: number, move: MoveVector, cameraYaw: number, obstacles: Obstacles): void {
    const dir = cameraRelative(move.x, move.y, cameraYaw);
    const strength = Math.hypot(dir.x, dir.z);
    if (strength > 0.05) {
      let x = this.position.x + dir.x * PLAYER.speed * dt;
      let z = this.position.z + dir.z * PLAYER.speed * dt;
      ({ x, z } = pushOutOfBoxes(x, z, PLAYER.radius, obstacles.boxes));
      ({ x, z } = pushOutOfCircles(x, z, PLAYER.radius, obstacles.circles));
      ({ x, z } = clampToBox(x, z, obstacles.bounds));
      this.position.x = x;
      this.position.z = z;
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
