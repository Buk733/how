import { secretText } from '../i18n';

/** Пасхалка: интересная штука в мире, которую можно найти и потрогать. Тексты — на языке игры (i18n: secrets). */
export interface SecretDef {
  /** Латиница: по нему находка хранится в сохранении. Не менять после релиза! */
  readonly id: string;
  /** Как называется в объявлении о находке. */
  readonly name: string;
  /** Надпись на кнопке действия рядом с пасхалкой. */
  readonly action: string;
  /** Где искать — подсказка в альбоме, пока пасхалка не найдена. */
  readonly hint: string;
}

/** Все пасхалки по порядку. Где они стоят и что делают — в scenery.ts. */
export const SECRETS: readonly SecretDef[] = ['stone', 'hut', 'bear', 'well', 'toilet', 'fisher', 'car'].map((id) => ({
  id,
  get name() {
    return secretText(id).name;
  },
  get action() {
    return secretText(id).action;
  },
  get hint() {
    return secretText(id).hint;
  },
}));

export const SECRET_IDS: ReadonlySet<string> = new Set(SECRETS.map((s) => s.id));
