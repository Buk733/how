import * as THREE from 'three';
import { createBlobShadow } from '@engine/shadow';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';

/** Всё, что ходит по миру: спрайт-билборд и круглая тень под ним. */
export class Actor {
  readonly root = new THREE.Group();
  readonly sprite: BillboardSprite;
  protected readonly shadow: THREE.Mesh;

  constructor(sheet: SpriteSheet, shadowSize: number) {
    this.sprite = new BillboardSprite(sheet);
    this.shadow = createBlobShadow(shadowSize);
    this.root.add(this.sprite.object, this.shadow);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  dispose(): void {
    this.sprite.dispose();
  }
}
