// Русский — основной язык игры и образец для остальных: у каждого словаря те же ключи (проверяет TypeScript).
// Тексты с числами и именами — функции: порядок слов, падежи и множественное число у каждого языка свои.
// Числа приходят уже записанными (formatNumber, formatDecimal), имена — из этого же словаря.
// Герой игрока может быть девушкой: фразы о самом игроке — без рода («теперь твой», а не «украл»).

/** Русское множественное число: 1 день, 2 дня, 5 дней. */
function plural(n: number, one: string, few: string, many: string): string {
  const tens = n % 100;
  const ones = n % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (ones === 1) return one;
  if (ones >= 2 && ones <= 4) return few;
  return many;
}

const q = (name: string) => `«${name}»`;

export const ru = {
  /** Название языка — в выборе языка. */
  languageName: 'Русский',
  /** Десятичный разделитель: 1,5. */
  decimal: ',',
  title: 'Укради Брейнрота: Баня',
  loading: 'Загрузка…',
  loadFailed: 'Не удалось запустить игру. Обновите страницу.',

  units: {
    /** С неразрывным пробелом — «с» не переносится на новую строку. */
    seconds: (value: string) => `${value}\u00a0с`,
    awayMinutes: (m: number) => `${m} мин`,
    awayHours: (h: number, m: number) => (m > 0 ? `${h} ч ${m} мин` : `${h} ч`),
    perSecond: (amount: string) => `+${amount}/с`,
  },

  hud: {
    menus: {
      upgrades: 'Прокачка',
      cases: 'Кейсы',
      wheel: 'Колесо',
      upgrader: 'Парилка',
      daily: 'Награды',
      album: 'Альбом',
      leaderboard: 'Рейтинг',
      shop: 'Магазин',
      rebirth: 'Перерождение',
    },
    hero: 'Герой',
    broom: 'Шлёпнуть веником',
    income: (amount: string) => `+${amount} в секунду`,
    noIncome: 'Купи персонажа на дорожке',
    boost: (time: string) => `⚡ ×2 доход · ${time}`,
    permanent: (parts: string) => `${parts} к доходу навсегда`,
    soundOn: 'Включить звук',
    soundOff: 'Выключить звук',
    musicOn: 'Включить музыку',
    musicOff: 'Выключить музыку',
    language: 'Язык',
    close: 'Закрыть',
  },

  tutorial: {
    buyMe: 'Купи меня!',
    collect: 'Встань сюда — собери монеты',
    carryHome: 'Неси в свою баню!',
    steal: 'Укради у соседа!',
    afterCollect: 'Отлично! Копи на персонажей подороже',
    afterSteal: 'Соседи тоже будут красть — закрывай баню и бей воров веником!',
  },

  broom: {
    handsFull: 'Руки заняты — сначала донеси добычу',
    recharging: 'веник перезаряжается…',
  },

  home: {
    sign: 'ТВОЯ БАНЯ',
    latch: '🔓 Щеколда',
    latchLeft: (seconds: number) => `🔒 ${seconds} с`,
    chatter: ['💦 Кайф!', 'Ух, парок!', 'С лёгким паром!'],
    closedTitle: 'Баня закрыта',
    closedLeft: (seconds: number) => `ещё ${seconds} с`,
    closeTitle: 'Закрыть баню',
    closeDetail: (seconds: number) => `на ${seconds} с — воры не войдут`,
    unlockTitle: 'Открыть место',
    latched: 'Баня закрыта на щеколду!',
    newSlot: 'Новое место на полке!',
  },

  carpet: {
    buy: (name: string) => `Купить ${q(name)}`,
    handsFull: 'руки заняты — отнеси добычу в баню',
    replaces: (price: string, name: string) => `💰 ${price} · заменит ${q(name)}`,
    need: (price: string) => `нужно 💰 ${price}`,
    noRoom: 'нет мест — открой новое',
    goldOnCarpet: (name: string) => `На дорожке «Голда»: ${name}!`,
    rareOnCarpet: (rarity: string, name: string) => `На дорожке ${rarity.toLowerCase()} ${q(name)}!`,
  },

  /** «Голда» — золотой вариант персонажа. */
  gold: {
    unit: (name: string) => `${name} · Голда`,
    rarity: (rarity: string) => `${rarity} · Голда`,
    chance: (chance: string) => `✨ Голда ${chance}`,
  },

  rarities: {
    common: 'Обычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
    mythic: 'Мифический',
    secret: 'Секретный',
  },

  characters: {
    panther: 'Танцуй Пантера',
    'anime-cook': 'Тянка в фартуке',
    'anime-knight': 'Аниме-рыцарь',
    kotost: 'Котость',
    diver: 'Нюхай Быстрее',
    'baba-chai': 'Баба Чай',
    'koch-bratan': 'Коч Братан',
    hamam: 'Хамам',
    'dark-drun': 'Тёмный Друн',
    schoolboy: 'Школьник второй смены',
    'fat-mellstroy': 'Толстый Меллстрой',
    'indian-mellstroy': 'Индеец Меллстрой',
  },

  /** Что говорят персонажи на полке: общие банные фразы и свои у мемных персонажей. */
  shelf: {
    common: ['С лёгким паром!', 'Поддай парку!', 'Кайф!', 'Жарко!', '💦', '😌', 'Ещё парку!', 'Хорошо сидим!'],
    own: {
      panther: ['Танцуй!', 'Танцуй, пантера!'],
      'anime-cook': ['Кушать подано!', 'Приятного аппетита!'],
      'anime-knight': ['За баню!', 'Я на страже!'],
      kotost: ['Мур-р…', 'Котость!'],
      diver: ['Нюхай быстрее!', 'Буль-буль'],
      'baba-chai': ['Чай будешь?', 'Баба, чай!'],
      'koch-bratan': ['Братан, парку!', 'Веником — хоп!'],
      hamam: ['Пены мало!', 'Хамам — кайф!'],
    },
  },

  heroes: {
    title: '👤 Герой',
    girl: { name: 'Аниме-девушка', description: 'Длинные волосы, красный бант, взгляд — огонь' },
    guy: { name: 'Качок', description: 'Квадратная челюсть и бицепсы размером с арбуз' },
    selected: '✓ Выбран',
    select: 'Выбрать',
    hint: 'Сменить героя можно в любой момент — бесплатно',
  },

  /**
   * Соседи: имя, вывеска над баней, имя в фразах «прогнал кого» (object) и «теперь у кого» (holder) —
   * в других языках это разные падежи; собака и прозвище.
   */
  neighbors: {
    zhorik: { name: 'Жорик', sign: 'БАНЯ ЖОРИКА', object: 'Жорика', holder: 'Жорика', dog: 'Шарик', trait: 'соня' },
    timur: { name: 'Тимур', sign: 'БАНЯ ТИМУРА', object: 'Тимура', holder: 'Тимура', dog: 'Бобик', trait: 'качок' },
    level: (level: number, trait: string) => `ур. ${level} · ${trait}`,
    lines: {
      notice: ['Эй! Ты чего тут?', 'А ну выйди из моей бани!', 'Это моя баня!', 'Кто тут шастает?'],
      alert: ['Вор!', 'Отдай!', 'Стой, ворюга!', 'Верни моё!'],
      wake: ['А? Что? Кто?!', 'Проспал! Вор!', 'Кто тут?!'],
      swing: ['Получай!', 'Кыш!', 'На!'],
      stunned: ['Ай!', 'Ой-ой!', 'Ауч!', 'За что?!'],
      caught: ['То-то же!', 'Моё!', 'Не трогай чужое!'],
      giveUp: ['Ну, погоди!', 'Я запомнил!', 'Я тебе ещё покажу!'],
      grab: ['Хи-хи!', 'Теперь моё!', 'Я быстренько!'],
      beaten: ['Ой, всё!', 'Ухожу, ухожу!'],
      locked: ['Закрыто?!', 'Эх, закрыто…'],
      stashed: ['Хе-хе, моё!', 'Отличный улов!'],
      levelUp: ['Я стал сильнее!', 'Кто теперь крутой?', 'Прокачался!'],
    },
    stun: (name: string, seconds: string) => `${name} — оглушить на ${seconds}`,
    shooDog: (dog: string) => `${dog} — прогнать в будку`,
    steal: (name: string) => `Украсть ${q(name)}`,
    noRoom: 'нет места в бане — открой новое',
    sleepingBell: (name: string) => `${name} спит, но звякнет колокольчик — беги!`,
    sleeping: (name: string) => `${name} спит — тихо!`,
    stunned: (name: string) => `${name} оглушён — хватай и беги!`,
    awake: (name: string) => `${name} заметит — беги домой!`,
    away: (name: string) => `${name} не дома — давай!`,
    levelUp: (name: string, level: number, news: string) => `${name} прокачался до ${level}-го уровня — ${news}!`,
    newsDog: 'завёл собаку у входа',
    newsBell: 'повесил колокольчик над полком',
    newsFaster: 'бегает быстрее и держит удар веником',
    spotted: (name: string) => `${name} заметил! Беги в свою баню!`,
    wakingUp: (name: string) => `${name} сейчас очнётся — беги в свою баню!`,
    bell: (name: string) => `Колокольчик! ${name} сейчас проснётся — беги!`,
    carryHome: 'Неси в свою баню!',
    shelfFull: 'Нет места на полке — открой новое место',
    stole: (name: string, income: string) => `${q(name)} теперь твой! +${income}/с`,
    hitYou: (name: string, loot: string) => `${name} огрел тебя веником! ${q(loot)} вернулся на место`,
    slap: 'Шлёп!',
    gotBack: (loot: string) => `${q(loot)} снова твой!`,
    chasedOff: (name: string, _object: string) => `${name} удирает!`,
    kicksOut: (name: string) => `${name} выгоняет тебя веником!`,
    dogBites: (dog: string) => `${dog} кусается! Шлёпни его веником — спрячется в будку`,
    ding: 'Дзынь!',
    robbed: (name: string, loot: string) => `${name} украл у тебя ${q(loot)}! Догони и шлёпни его!`,
    lost: (loot: string, holder: string) => `${q(loot)} теперь у ${holder} — укради обратно!`,
    seesYou: (name: string) => `${name} тебя заметил!`,
    seesYouHint: ' Шлёпни его веником — или беги',
    noticedLoss: (name: string) => `${name} проснулся и заметил пропажу! Беги!`,
    latchLeft: (seconds: number) => `🔒 ${seconds} с`,
  },

  dog: {
    whine: 'Скуль!',
    bark: 'Гав! Гав!',
    barkOnce: 'Гав!',
    bite: 'Цап!',
  },

  rivals: {
    level: (name: string, level: number) => `${name} — ур. ${level}`,
    note: (levels: string) => `Соседи качаются вместе с тобой: ${levels}. Их закалка съедает часть оглушения веником, а в погоне они быстрее.`,
  },

  upgrades: {
    title: '⚡ Прокачка',
    hint: 'Монеты тратятся сразу, прокачка остаётся навсегда',
    max: 'МАКС',
    names: { speed: 'Кроссовки', broom: 'Веник', latch: 'Щеколда', stove: 'Печь' },
    speedBase: 'обычная скорость',
    speed: (percent: string) => `скорость +${percent}`,
    broom: (stun: string, cooldown: string) => `оглушает на ${stun}, перезарядка ${cooldown}`,
    latch: (seconds: string) => `закрывает баню на ${seconds}`,
    stoveBase: 'доход без прибавки',
    stove: (percent: string) => `доход +${percent}`,
    float: (icon: string, level: number) => `${icon} ур. ${level}`,
  },

  cases: {
    title: '🎁 Кейсы',
    hint: 'Кейсы — только за монеты. Шансы всегда на виду.',
    names: { bath: 'Банный кейс', meme: 'Мемный кейс', gold: 'Золотой кейс', mellstroy: 'Кейс Меллстроя' },
    openFree: '🎁 Открыть бесплатно',
    openKey: (keys: number) => `🔑 Открыть ключом (${keys})`,
    freeIn: (time: string) => `Бесплатно через ${time}`,
    again: 'Открыть ещё',
    back: 'К кейсам',
    odds: 'Состав и шансы',
    firstNote: 'Первый кейс — точно редкий или лучше!',
    dropped: (name: string) => `Выпало: ${name}`,
    sold: (coins: string) => `Полок полный — продан за 💰 ${coins}`,
    seated: 'Идёт в баню и садится на полок',
    replaced: (name: string, coins: string) => `Сел вместо ${q(name)} (+💰 ${coins})`,
  },

  wheel: {
    title: '🎡 Колесо удачи',
    idle: 'Крути колесо — приз сразу твой',
    odds: 'Шансы',
    spinning: 'Крутится…',
    free: '🎡 Крутить бесплатно',
    freeIn: (time: string) => `Бесплатно через ${time}`,
    ad: (left: number) => `📺 Реклама → ещё спин (${left})`,
    adTomorrow: '📺 Спины за рекламу — завтра',
    labels: {
      coins: 'Монеты',
      bath: 'Банный кейс',
      boost: '×2 доход',
      moreCoins: 'Много монет',
      meme: 'Мемный кейс',
      character: 'Персонаж',
      coinPile: 'Гора монет',
      gold: 'Золотой кейс',
    },
    result: (text: string) => `Выпало: ${text}`,
    coins: (icon: string, coins: string) => `${icon} ${coins} монет!`,
    key: (caseName: string) => `🔑 Ключ: ${q(caseName)} бесплатно — открой в кейсах!`,
    boost: (minutes: number) => `⚡ ×2 доход на ${minutes} минут!`,
    character: (icon: string, name: string) => `${icon} ${q(name)} идёт к тебе в баню!`,
  },

  upgrader: {
    title: '♨️ Парилка',
    ok: 'получится',
    hot: 'перегрев',
    run: '♨️ Парить!',
    give: 'Кого отдать',
    get: 'Во что превратить',
    hint: 'Не повезло — персонаж испарится. Страховка за рекламу его сохранит.',
    emptyShelf: 'На полке пока никого нет',
    pickFirst: 'Сначала выбери, кого отдать',
    best: 'Это уже самый ценный персонаж!',
    insured: '🛡️ Страховка включена',
    insure: '📺 Реклама → страховка',
    chance: (chance: string) => `Шанс ${chance}`,
    pickBoth: 'Выбери обоих персонажей',
    success: (from: string, to: string) => `Получилось! ${q(from)} стал ${q(to)}`,
    saved: (from: string) => `Перегрев! Страховка спасла ${q(from)}`,
    lost: (from: string) => `Перегрев! ${q(from)} испарился`,
  },

  daily: {
    title: '📅 Награды за вход',
    claim: 'Забрать',
    hint: 'Заходи каждый день подряд — к седьмому дню награды всё лучше. Пропустишь день — серия начнётся заново.',
    streak: (days: number) => `Серия: ${days} ${plural(days, 'день', 'дня', 'дней')} подряд`,
    next: (time: string) => `Следующая награда через ${time}`,
    day: (day: number) => `День ${day}`,
    labels: ['Монеты', 'Банный кейс', 'Много монет', '×2 доход на 10 мин', 'Мемный кейс', 'Гора монет', 'Золотой кейс'],
    coins: (coins: string) => `💰 +${coins} монет`,
    key: (caseName: string) => `🔑 Ключ: ${q(caseName)} — открой в кейсах!`,
    banner: (day: number, text: string) => `📅 День ${day}: ${text}`,
  },

  welcome: {
    title: '👋 С возвращением!',
    lead: 'Пока тебя не было ',
    leadEnd: ', персонажи парились и напарили:',
    claim: 'Забрать',
    ad: (coins: string) => `📺 Реклама → ×2 (💰 ${coins})`,
    note: (rate: number, share: number) => `Без тебя персонажи приносят ${rate}% дохода, но не больше ${share}% твоих монет`,
    capped: ' — заходи почаще!',
  },

  album: {
    title: '📖 Альбом',
    hint: 'Альбом остаётся навсегда — даже после перерождения',
    summary: (found: number, gold: number, total: number, secrets: number, secretsTotal: number) =>
      `Персонажи ${found}/${total} · «Голда» ${gold}/${total} · Пасхалки ${secrets}/${secretsTotal}`,
    secrets: (found: number, total: number) => `🔍 Пасхалки ${found}/${total}`,
    goldGot: '★ Голда',
    goldMissing: '☆ Голда',
    newCard: (name: string) => `📖 Новая карточка: ${name}`,
  },

  rebirth: {
    title: '🔄 Перерождение',
    reset: 'Начнёшь заново',
    resetItems: ['монеты', 'персонажи на полке', 'места на полке', 'прокачка', 'уровень соседей'],
    keep: 'Останется навсегда',
    keepItems: ['альбом', 'пасхалки', 'ключи от кейсов', 'награды за вход', 'герой'],
    now: (multiplier: string, rebirths: number) => `Сейчас: доход ${multiplier} · перерождений: ${rebirths}`,
    never: 'Перерождений ещё не было',
    next: (multiplier: string) => `После перерождения: доход ${multiplier} навсегда`,
    confirm: 'Точно? Нажми ещё раз',
    action: (cost: string) => `🔄 Переродиться за 💰 ${cost}`,
    carrying: 'Сначала донеси добычу до бани',
    raid: 'Сначала разберись с вором',
    done: (multiplier: string) => `🔄 Перерождение! Доход ${multiplier} навсегда`,
  },

  secrets: {
    stone: { name: 'Камень на распутье', action: 'Прочитать надпись', hint: 'у входа на лесную поляну' },
    hut: { name: 'Избушка на курьих ножках', action: 'Избушка, повернись!', hint: 'на лесной поляне' },
    bear: { name: 'Медведь с балалайкой', action: 'Попросить сыграть', hint: 'у костра на поляне' },
    well: { name: 'Колодец желаний', action: 'Загадать желание', hint: 'в огороде' },
    toilet: { name: 'Домик в огороде', action: 'Постучать', hint: 'в огороде, за грядками' },
    fisher: { name: 'Рыбак на мостках', action: 'Спросить, как клюёт', hint: 'у пруда' },
    car: { name: 'Старая «копейка»', action: 'Посигналить', hint: 'в кустах у пруда' },
  },

  landmarks: {
    stone: 'Налево пойдёшь — избушку найдёшь. Направо — медведю подпоёшь. Назад пойдёшь — брейнрота украдёшь',
    hutCreak: 'Скрип-скрип!',
    hutWelcome: 'Заходи, гостем будешь!',
    bear: '♪ Эх, раз, ещё раз! ♪',
    well: ['Бульк! ✨', 'Желание загадано ✨', 'Сбудется! ✨'],
    toilet: ['Занято!', 'Занято! Кто там?!', 'Минуточку!'],
    fisherHush: 'Тсс! Рыбу распугаешь!',
    fisherBite: ['Клюёт! 🐟', 'Во какая! 🐟', 'Ёрш попался 🐟'],
    car: 'Би-бип!',
    signForest: '↑ Тропинка в лес',
    signGarden: '↑ Огород',
    signPond: '↑ Пруд',
    portal: 'Мемный портал',
    unknown: '🔍 пасхалка?',
    found: (count: number, total: number, name: string, reward: string) => `🔍 Пасхалка ${count}/${total}: ${name}! +${reward}`,
  },

  shop: {
    title: '🛒 Магазин',
    loading: 'Загружаем товары…',
    closed: 'Магазин пока закрыт — загляни позже',
    hint: 'Оплата Янами через Яндекс Игры. Покупки навсегда сохраняются в аккаунте Яндекса.',
    owned: '✓ Куплено',
    currency: 'Ян',
    chestNow: (coins: string) => `Сейчас это 💰 ${coins}`,
    products: {
      income_x2: { name: 'Доход ×2 навсегда', description: 'Все персонажи приносят вдвое больше — и после перерождения тоже' },
      no_ads: { name: 'Без рекламы', description: 'Никакой рекламы между делом. Ролики за награду остаются — по желанию' },
      coin_chest: { name: 'Сундук монет', description: 'Полчаса твоего дохода сразу' },
    },
    granted: (icon: string, coins: string) => `${icon} +${coins} монет!`,
    grantedItem: (icon: string, name: string) => `${icon} ${name}!`,
  },

  leaderboard: {
    title: '🏆 Рейтинг',
    loading: 'Загружаем рейтинг…',
    unavailable: 'Рейтинг сейчас недоступен — загляни позже',
    empty: 'Пока здесь никого — стань первым!',
    login: '🔑 Войти через Яндекс',
    why: 'Войди в аккаунт Яндекса — попадёшь в рейтинг, а прогресс и покупки будут на всех твоих устройствах.',
    sample: 'Это пример таблицы: на Яндекс Играх здесь будут настоящие игроки.',
    rule: 'Место в рейтинге — по лучшему доходу в секунду за всё время, даже после перерождения.',
    best: (income: string) => `Твой лучший доход: 💰 ${income} в секунду`,
    score: (income: string) => `💰 ${income}/с`,
    hiddenName: 'Игрок скрыл имя',
    you: 'Ты',
    accountProgress: '🔑 В аккаунте нашёлся прогресс побольше — загружаем его…',
    loggedIn: '🔑 Готово! Теперь ты в рейтинге',
  },

  /** Таблички демо-версии вместо рекламы, оплаты и входа (на площадке их нет). */
  demo: {
    fullscreenAd: '📺 Здесь будет полноэкранная реклама',
    rewardedAd: '📺 Здесь будет реклама за награду\nВ демо вместо ролика — эта табличка',
    login: '🔑 Здесь будет вход в аккаунт Яндекса',
    payment: '💳 Здесь будет оплата Янами\nВ демо покупка бесплатная',
  },
};

export type Messages = typeof ru;
