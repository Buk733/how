import { Animator, type AnimationClip } from '@engine/animation';
import { cameraRelative, Facing, facingFromCamera } from '@engine/direction';
import type { MoveVector } from '@engine/input';
import type { SpriteSheet } from '@engine/sprite';
import { PLAYER } from '../config';
import { Actor, moveWithCollisions, type Obstacles } from './actor';

const IDLE: AnimationClip = { frames: [0], fps: 1 };
const WALK: AnimationClip = { frames: [0, 1, 2, 3], fps: 10 };

/** Герой игрока: бегает по миру, упирается в стены и деревья. */
export class Player extends Actor {
  private readonly animator = new Animator(IDLE);
  private facingX = 0;
  private facingZ = 1;
  private facingValue: Facing = Facing.Front;
  private stunned = 0;

  constructor(sheet: SpriteSheet) {
    super(sheet, 0.8);
    this.sprite.enableSilhouette(); // виден, даже когда зашёл за стену бани
  }

  /** «Нокаут»: несколько секунд игрок не может двигаться. */
  stun(seconds: number): void {
    this.stunned = Math.max(this.stunned, seconds);
  }

  get isStunned(): boolean {
    return this.stunned > 0;
  }

  /** Куда смотрит герой: направление в мире и сторона спрайта. */
  get facing(): { readonly x: number; readonly z: number; readonly side: Facing } {
    return { x: this.facingX, z: this.facingZ, side: this.facingValue };
  }

  update(dt: number, move: MoveVector, cameraYaw: number, obstacles: Obstacles, speedFactor = 1): void {
    this.updateKnock(dt, PLAYER.radius, obstacles);
    if (this.stunned > 0) {
      this.stunned = Math.max(0, this.stunned - dt);
      this.sprite.object.visible = this.stunned === 0 || Math.floor(this.stunned * 12) % 2 === 0;
      this.animator.play(IDLE);
      this.sprite.setFrame(this.animator.frame, this.facingValue);
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
    this.facingValue = facingFromCamera(this.facingX, this.facingZ, cameraYaw, this.facingValue);
    this.sprite.setFrame(this.animator.frame, this.facingValue);
  }
}
