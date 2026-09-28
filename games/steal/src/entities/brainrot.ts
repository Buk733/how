import * as THREE from 'three';
import type { Label } from '@engine/labels';
import type { SpriteSheet } from '@engine/sprite';
import { CARPET } from '../config';
import type { CharacterDef } from '../data/characters';
import { Actor } from './actor';

/**
 * walking — идёт по дорожке, его можно купить;
 * toBase — куплен и идёт к своему месту на полке;
 * seated — сидит на полке и приносит монеты.
 */
export type BrainrotState = 'walking' | 'toBase' | 'seated';

const TO_BASE_SPEED = 3.6;

/** Мемный персонаж. */
export class Brainrot extends Actor {
  readonly def: CharacterDef;
  state: BrainrotState = 'walking';
  /** Номер места на полке (−1 — пока нигде). */
  slot = -1;
  /** Дошёл до конца дорожки — пора убрать со сцены. */
  gone = false;
  /** Подпись над головой (для тех, кто на дорожке). */
  label: Label | null = null;
  private readonly path: THREE.Vector3[] = [];
  private time = Math.random() * 10;

  constructor(def: CharacterDef, sheet: SpriteSheet) {
    super(sheet, 1.1);
    this.def = def;
  }

  /** Отправляет купленного персонажа по точкам маршрута к его месту. */
  sendTo(slot: number, path: readonly THREE.Vector3[]): void {
    this.slot = slot;
    this.state = 'toBase';
    this.path.length = 0;
    this.path.push(...path.map((p) => p.clone()));
  }

  /** Сразу сажает на место (например, при загрузке сохранения). */
  seatAt(slot: number, seat: THREE.Vector3): void {
    this.slot = slot;
    this.state = 'seated';
    this.position.copy(seat);
  }

  update(dt: number): void {
    this.time += dt;
    let moving = false;
    if (this.state === 'walking') {
      this.position.x += CARPET.walkSpeed * dt;
      moving = true;
      if (this.position.x > CARPET.endX) this.gone = true;
    } else if (this.state === 'toBase') {
      moving = this.followPath(dt);
      if (!moving) this.state = 'seated';
    }

    this.sprite.setFrame(Math.floor(this.time * (moving ? 5 : 2.2)) % 2);
    if (moving) {
      // вприпрыжку
      const hop = Math.abs(Math.sin(this.time * 8));
      this.sprite.object.position.y = hop * 0.22;
      this.sprite.setSquash(hop < 0.2 ? 0.08 : -0.03);
    } else {
      this.sprite.object.position.y = 0;
      this.sprite.setSquash(Math.sin(this.time * 2.5) * 0.025);
    }
  }

  /** Двигается по маршруту. Возвращает false, когда дошёл. */
  private followPath(dt: number): boolean {
    let step = TO_BASE_SPEED * dt;
    while (step > 0 && this.path.length > 0) {
      const target = this.path[0];
      const distance = this.position.distanceTo(target);
      if (distance <= step) {
        this.position.copy(target);
        this.path.shift();
        step -= distance;
      } else {
        this.position.lerp(target, step / distance);
        step = 0;
      }
    }
    return this.path.length > 0;
  }
}
