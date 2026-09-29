/** Пасхалка: интересная штука в мире, которую можно найти и потрогать. */
export interface SecretDef {
  /** Латиница: по нему находка хранится в сохранении. Не менять после релиза! */
  readonly id: string;
  /** Как называется в объявлении о находке. */
  readonly name: string;
  /** Надпись на кнопке действия рядом с пасхалкой. */
  readonly action: string;
}

/** Все пасхалки по порядку. Где они стоят и что делают — в scenery.ts. */
export const SECRETS: readonly SecretDef[] = [
  { id: 'stone', name: 'Камень на распутье', action: 'Прочитать надпись' },
  { id: 'hut', name: 'Избушка на курьих ножках', action: 'Избушка, повернись!' },
  { id: 'bear', name: 'Медведь с балалайкой', action: 'Попросить сыграть' },
  { id: 'well', name: 'Колодец желаний', action: 'Загадать желание' },
  { id: 'toilet', name: 'Домик в огороде', action: 'Постучать' },
  { id: 'fisher', name: 'Рыбак на мостках', action: 'Спросить, как клюёт' },
  { id: 'car', name: 'Старая «копейка»', action: 'Посигналить' },
];

export const SECRET_IDS: ReadonlySet<string> = new Set(SECRETS.map((s) => s.id));
