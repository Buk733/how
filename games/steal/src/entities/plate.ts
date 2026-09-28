import * as THREE from 'three';
import type { Label } from '@engine/labels';
import type { SpriteSheet } from '@engine/sprite';

/** locked — место закрыто, empty — пусто, ready — есть монеты, latch — кнопка щеколды. */
export type PlateState = 'locked' | 'empty' | 'ready' | 'latch';
const FRAME: Record<PlateState, number> = { locked: 0, empty: 1, ready: 2, latch: 3 };

/** Плита перед местом на полке: встал на неё — собрал монеты. */
export class Plate {
  readonly mesh: THREE.Mesh;
  readonly label: Label;
  private readonly texture: THREE.Texture;
  private readonly sheet: SpriteSheet;
  private state: PlateState | null = null;
  private labelText = '';

  constructor(sheet: SpriteSheet, position: THREE.Vector3, label: Label) {
    this.sheet = sheet;
    this.texture = sheet.texture.clone();
    this.texture.repeat.set(1 / sheet.columns, 1);
    const size = sheet.frameWidth / sheet.pixelsPerUnit;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.texture, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    this.mesh.position.copy(position);
    this.label = label;
    this.label.anchor.copy(position).add(new THREE.Vector3(0, 0.1, 0.55));
  }

  setState(state: PlateState): void {
    if (state === this.state) return;
    this.state = state;
    this.texture.offset.set(FRAME[state] / this.sheet.columns, 0);
  }

  /** Меняет текст подписи, только если он изменился (не трогаем DOM каждый кадр). */
  setText(text: string): void {
    if (text === this.labelText) return;
    this.labelText = text;
    this.label.element.textContent = text;
    this.label.visible = text !== '';
  }
}
