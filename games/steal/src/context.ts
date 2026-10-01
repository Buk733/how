import type * as THREE from 'three';
import type { AudioManager } from '@engine/audio';
import type { LabelLayer } from '@engine/labels';
import type { Rng } from '@engine/rng';
import type { CharacterDef } from './data/characters';
import type { Effects } from './effects';
import type { Brainrot } from './entities/brainrot';
import type { Player } from './entities/player';
import type { SaveData } from './save';
import type { ActionView, Hud } from './ui/hud';
import type { World } from './world';

/** Что можно сделать кнопкой действия прямо сейчас. */
export interface Action {
  readonly view: ActionView;
  run(): void;
}

/** События, которые двигают обучение вперёд. */
export type TutorialEvent = 'bought' | 'collected' | 'stolen';

/** Общие сервисы игры, которыми пользуются дорожка, баня и соседи. */
export interface GameContext {
  readonly scene: THREE.Scene;
  readonly labels: LabelLayer;
  readonly audio: AudioManager;
  readonly hud: Hud;
  readonly save: SaveData;
  readonly world: World;
  readonly player: Player;
  readonly rng: Rng;
  /** Блёстки, пыль, пар, летящие монеты и тряска камеры. */
  readonly fx: Effects;
  /** Секунды игры с запуска (без пауз). */
  readonly time: number;
  /** Создаёт персонажа на сцене; gold — «Голда»-версия. */
  createBrainrot(def: CharacterDef, gold?: boolean): Brainrot;
  /** Убирает персонажа со сцены (и его подпись). Ссылки на него чистит тот, кто их хранит. */
  removeBrainrot(brainrot: Brainrot): void;
  /** Мемная фраза персонажа. */
  playVoice(def: CharacterDef): void;
  /** Персонаж попал к игроку: отметить в альбоме (новая карточка — надпись над at). */
  collect(def: CharacterDef, gold: boolean, at: THREE.Vector3): void;
  markDirty(urgent?: boolean): void;
  tutorialEvent(event: TutorialEvent): void;
}
