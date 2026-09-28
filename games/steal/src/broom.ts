import { Facing } from '@engine/direction';
import type { SpriteSheet } from '@engine/sprite';
import type { GameContext } from './context';
import { SwingEffect } from './entities/swing';
import { broomCooldown } from './upgrades';

/** Веник игрока: перезарядка и взмах. Кого задело — решает Neighborhood.hitAround. */
export class Broom {
  private readonly ctx: GameContext;
  private readonly effect: SwingEffect;
  private cooldownLeft = 0;

  constructor(ctx: GameContext, sheet: SpriteSheet) {
    this.ctx = ctx;
    this.effect = new SwingEffect(sheet, ctx.player.root);
  }

  get ready(): boolean {
    return this.cooldownLeft <= 0;
  }

  /** Сколько осталось до перезарядки: 1 — только что ударил, 0 — готов. */
  get recharge(): number {
    return this.cooldownLeft / broomCooldown(this.ctx.save.upgrades);
  }

  update(dt: number): void {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    this.effect.update(dt);
  }

  /** Взмах в ту сторону, куда смотрит герой. */
  swing(): void {
    const facing = this.ctx.player.facing;
    this.cooldownLeft = broomCooldown(this.ctx.save.upgrades);
    this.effect.play(facing.x, facing.z, facing.side === Facing.Left);
    this.ctx.audio.blip('swing');
  }
}
