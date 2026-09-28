import type * as THREE from 'three';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';

const FRAME_TIME = 0.06;
const FRAMES = 3;

/** Взмах веника: три кадра рядом с тем, кто бьёт. Второй ряд листа — те же кадры зеркально (удар влево). */
export class SwingEffect {
  private readonly sprite: BillboardSprite;
  private time = -1;
  private row = 0;

  constructor(sheet: SpriteSheet, parent: THREE.Object3D) {
    this.sprite = new BillboardSprite(sheet);
    this.sprite.object.visible = false;
    parent.add(this.sprite.object);
  }

  /** Удар в сторону (dirX, dirZ); left — рисовать взмах справа налево. */
  play(dirX: number, dirZ: number, left: boolean): void {
    const length = Math.hypot(dirX, dirZ) || 1;
    this.sprite.object.position.set((dirX / length) * 0.45, 0.1, (dirZ / length) * 0.45);
    this.row = left ? 1 : 0;
    this.time = 0;
    this.show(0);
  }

  update(dt: number): void {
    if (this.time < 0) return;
    this.time += dt;
    const frame = Math.floor(this.time / FRAME_TIME);
    // последний кадр держится чуть дольше, чтобы удар читался
    if (frame > FRAMES) {
      this.sprite.object.visible = false;
      this.time = -1;
      return;
    }
    this.show(Math.min(frame, FRAMES - 1));
  }

  private show(frame: number): void {
    this.sprite.object.visible = true;
    this.sprite.setFrame(frame, this.row);
  }
}
