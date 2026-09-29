import * as THREE from 'three';
import type { Label } from '@engine/labels';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';
import { CARPET } from '../config';
import type { CharacterDef } from '../data/characters';
import { Actor } from './actor';

/** Блёстки «Голды»: вспыхивают по очереди в случайных местах вокруг персонажа. */
class Sparkle {
  private readonly sprite: BillboardSprite;
  private time = Math.random();

  constructor(sheet: SpriteSheet, parent: THREE.Object3D) {
    this.sprite = new BillboardSprite(sheet);
    this.sprite.object.visible = false;
    parent.add(this.sprite.object);
    this.jump();
  }

  update(dt: number): void {
    const CYCLE = 0.9;
    const FLASH = 0.45;
    const before = this.time;
    this.time = (this.time + dt) % CYCLE;
    if (this.time < before) this.jump();
    const visible = this.time < FLASH;
    this.sprite.object.visible = visible;
    if (visible) this.sprite.setFrame([0, 1, 2, 1, 0][Math.min(4, Math.floor((this.time / FLASH) * 5))]);
  }

  dispose(): void {
    this.sprite.dispose();
  }

  /** Следующая вспышка — в новом месте вокруг персонажа. */
  private jump(): void {
    this.sprite.object.position.set((Math.random() - 0.5) * 1.1, 0.3 + Math.random() * 1.3, 0.05);
  }
}

/**
 * walking — идёт по дорожке, его можно купить;
 * toSeat — идёт к своему месту на полке (куплен, украден или возвращается);
 * seated — сидит на полке и приносит монеты;
 * carried — его несут над головой (игрок или сосед-вор).
 */
export type BrainrotState = 'walking' | 'toSeat' | 'seated' | 'carried';

const TO_SEAT_SPEED = 3.6;

/** Мемный персонаж (обычный или «Голда»). */
export class Brainrot extends Actor {
  readonly def: CharacterDef;
  readonly gold: boolean;
  state: BrainrotState = 'walking';
  /** Номер места на полке (−1 — пока нигде). */
  slot = -1;
  /** Дошёл до конца дорожки — пора убрать со сцены. */
  gone = false;
  /** Подпись над головой. */
  label: Label | null = null;
  private readonly path: THREE.Vector3[] = [];
  private readonly sparkle: Sparkle | null;
  private time = Math.random() * 10;

  /** sparkleSheet — только для «Голды»: блёстки вокруг персонажа. */
  constructor(def: CharacterDef, sheet: SpriteSheet, gold = false, sparkleSheet: SpriteSheet | null = null) {
    super(sheet, 1.1);
    this.def = def;
    this.gold = gold;
    this.sparkle = gold && sparkleSheet ? new Sparkle(sparkleSheet, this.root) : null;
  }

  override dispose(): void {
    super.dispose();
    this.sparkle?.dispose();
  }

  /** Отправляет персонажа по точкам маршрута к его месту на полке. */
  sendTo(slot: number, path: readonly THREE.Vector3[]): void {
    this.slot = slot;
    this.state = 'toSeat';
    this.shadow.visible = true;
    this.path.length = 0;
    this.path.push(...path.map((p) => p.clone()));
  }

  /** Сразу сажает на место (например, при загрузке сохранения). */
  seatAt(slot: number, seat: THREE.Vector3): void {
    this.slot = slot;
    this.state = 'seated';
    this.shadow.visible = true;
    this.position.copy(seat);
  }

  /** Персонажа подняли и несут: позицию каждый кадр задаёт тот, кто несёт. */
  pickUp(): void {
    this.state = 'carried';
    this.slot = -1;
    this.shadow.visible = false;
    this.path.length = 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.sparkle?.update(dt);
    let moving = false;
    if (this.state === 'walking') {
      this.position.x += CARPET.walkSpeed * dt;
      moving = true;
      if (this.position.x > CARPET.endX) this.gone = true;
    } else if (this.state === 'toSeat') {
      moving = this.followPath(dt);
      if (!moving) this.state = 'seated';
    }

    if (this.state === 'carried') {
      // болтается над головой
      this.sprite.setFrame(Math.floor(this.time * 8) % 2);
      this.sprite.object.position.y = Math.abs(Math.sin(this.time * 10)) * 0.12;
      this.sprite.setSquash(Math.sin(this.time * 10) * 0.05);
      return;
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
    let step = TO_SEAT_SPEED * dt;
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
