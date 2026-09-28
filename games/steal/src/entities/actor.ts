import * as THREE from 'three';
import { createBlobShadow } from '@engine/shadow';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';

/** Всё, что ходит по миру: спрайт-билборд и круглая тень под ним. */
export class Actor {
  readonly root = new THREE.Group();
  readonly sprite: BillboardSprite;

  constructor(sheet: SpriteSheet, shadowSize: number) {
    this.sprite = new BillboardSprite(sheet);
    this.root.add(this.sprite.object, createBlobShadow(shadowSize));
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  dispose(): void {
    this.sprite.dispose();
  }
}
