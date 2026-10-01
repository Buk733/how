/** Пасхалка: интересная штука в мире, которую можно найти и потрогать. */
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
export const SECRETS: readonly SecretDef[] = [
  { id: 'stone', name: 'Камень на распутье', action: 'Прочитать надпись', hint: 'у входа на лесную поляну' },
  { id: 'hut', name: 'Избушка на курьих ножках', action: 'Избушка, повернись!', hint: 'на лесной поляне' },
  { id: 'bear', name: 'Медведь с балалайкой', action: 'Попросить сыграть', hint: 'у костра на поляне' },
  { id: 'well', name: 'Колодец желаний', action: 'Загадать желание', hint: 'в огороде' },
  { id: 'toilet', name: 'Домик в огороде', action: 'Постучать', hint: 'в огороде, за грядками' },
  { id: 'fisher', name: 'Рыбак на мостках', action: 'Спросить, как клюёт', hint: 'у пруда' },
  { id: 'car', name: 'Старая «копейка»', action: 'Посигналить', hint: 'в кустах у пруда' },
];

export const SECRET_IDS: ReadonlySet<string> = new Set(SECRETS.map((s) => s.id));
