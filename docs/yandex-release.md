# Выпуск игры №1 на Яндекс Играх — инструкция для следующего агента

Код игры к выпуску готов: SDK подключён, покупки, рейтинг, реклама и сохранения работают через `engine/platform`, интерфейс переведён на 7 языков. Осталось то, что делается руками в Консоли разработчика и проверяется в черновике. Здесь — по шагам, что сделать и что проверить.

Документация Яндекса из облачного окружения агентов закрыта (`yandex.ru/dev/games` не открывается). Вызовы SDK сверены с открытой реализацией для Defold (`indiesoftby/defold-yagames`) и проверены с поддельным SDK. Поэтому всё ниже, что зависит от интерфейса Консоли, **сверять с подсказками самой Консоли**: названия разделов могли поменяться.

## 1. Собрать архив

```bash
npm ci
npm test
npm run package
```

`npm run package` собирает игру и пишет `games/steal/release/steal.zip`. Заодно он проверяет правила площадки:

- `index.html` лежит в корне архива;
- архив меньше 100 МБ (сейчас ~1,6 МБ);
- имена файлов — латиницей, без пробелов;
- нет внешних ссылок: в сборке остались только строки из Three.js, которые не являются запросами.

Если проверка не прошла, архив не пишется, а в консоль выводится причина.

SDK игра грузит сама с `/sdk.js` — так требует площадка. Свой `<script>` с SDK в `index.html` добавлять не нужно: если SDK не загрузился за 5 с, игра работает локально (`engine/platform/platform.ts`, `initPlatform`).

## 2. Консоль разработчика

Адрес Консоли: games.yandex.ru/console. Владелец проекта входит сам; агент может подсказывать и проверять.

### 2.1. Черновик и карточка игры

1. Создать приложение (если его ещё нет) и загрузить `steal.zip` в черновик.
2. Платформы: компьютеры и мобильные. Ориентация — любая: интерфейс подстраивается и под портрет, и под альбом.
3. Языки игры: **русский, английский, турецкий, испанский, португальский, немецкий, французский**. Игра сама берёт язык из SDK (`environment.i18n.lang`, правило 2.14). Для `be`, `kk`, `uk`, `uz` показывает русский, для остальных незнакомых — английский (правило 2.10). Правило — в `pickLanguage` (`games/steal/src/i18n/index.ts`).
4. Карточка заполняется для каждого языка: название, описание, «как играть». Тексты — в разделе 5 ниже.
5. Картинки: иконка, обложка, скриншоты на каждом языке. Размеры — по подсказкам Консоли. Скриншоты можно снять в браузере: `npm run dev`, язык переключается кнопкой 🌐 (она есть только при разработке и в демо). Можно и скриптом Playwright с параметром `?lang=en`. Кнопки 🌐 на площадке нет: там язык задаёт SDK.
6. Категории: «Симуляторы» / «Кликеры» / «Для всей семьи» — что предложит Консоль. Возраст — 6+ или 12+: есть шлепки веником, крови и пугающих сцен нет.

### 2.2. Реклама

1. Включить монетизацию рекламой (раздел «Монетизация» / «Реклама»).
2. По желанию включить стики-баннер. Игра сама прячет его у купивших «Без рекламы» (`setBannerVisible`). Никаких своих рекламных блоков в игре нет — только SDK (правило 4.1).
3. Где игра показывает рекламу:
   - полноэкранная — через пару секунд после перерождения: это логическая пауза между «жизнями» (`Game.rebirth` → `REBIRTH.adDelay`); у купивших «Без рекламы» её нет;
   - за награду — только по кнопке, на которой видно, что это реклама и что за неё дают:
     - «📺 Реклама → ×2» в окне «С возвращением!»;
     - «📺 Реклама → ещё спин» на колесе;
     - «📺 Реклама → страховка» в парилке.
     
     Награда выдаётся только после `onRewarded`. Игра продолжается и без рекламы (правила 4.5–4.5.2);
   - во время любой рекламы игра и звук на паузе (`Game.applyPause`), площадке уходит `GameplayAPI.stop()`.

### 2.3. Покупки за Яны

1. Подключить внутриигровые покупки. Скорее всего, потребуется заполнить данные получателя платежей — это делает владелец.
2. Создать три товара. Их **идентификаторы должны совпадать точно**: по ним игра выдаёт покупку (`games/steal/src/data/shop.ts`).

| id | Что даёт | Тип в игре | Цена в демо |
|---|---|---|---|
| `income_x2` | 💎 Доход ×2 навсегда, и после перерождения тоже | постоянный: не «используется», восстанавливается при каждом запуске | 199 Ян |
| `no_ads` | 🚫 Без рекламы: нет полноэкранной рекламы и баннера, ролики за награду — по желанию | постоянный | 149 Ян |
| `coin_chest` | 💰 Сундук монет: 30 минут дохода сразу, не меньше 10 000 | расходуемый: после выдачи игра вызывает `consumePurchase` | 49 Ян |

   - Цены выбирает владелец. Игра показывает цену и значок валюты из каталога площадки (`getCatalog`, правило 1.13.2).
   - Названия и описания в Консоли нужны на каждом языке. Игра показывает свои, из словарей (`shop.products`), но для витрины Яндекса они тоже нужны.
   - За Яны — только фиксированное содержимое: кейсы, колесо и парилка — только за монеты. Это проверяет тест `shop.test.ts`.
3. Как устроена выдача, чтобы ничего не пропало и не выдалось дважды:
   - выдать → сохранить с `flush` → только потом `consumePurchase` для расходуемых;
   - при запуске игра обрабатывает необработанные покупки (`getPurchases`, правило 1.13.1);
   - токены выданных покупок хранятся в сохранении.

### 2.4. Таблица рекордов

1. Создать таблицу с техническим именем **`income`** (`LEADERBOARD.name` в `config.ts`): числовая, сортировка по убыванию, без дробной части.
2. Название таблицы на языках:
   - ru «Лучший доход в секунду»;
   - en «Best income per second»;
   - tr «En iyi saniyelik gelir»;
   - es «Mejores ingresos por segundo»;
   - pt «Melhor renda por segundo»;
   - de «Bestes Einkommen pro Sekunde»;
   - fr «Meilleur revenu par seconde».
3. Результат отправляют только вошедшие игроки: когда он вырос хотя бы на 5%, не чаще раза в 15 с (`records.ts`). Вход — кнопкой «Войти через Яндекс» в окне рейтинга.

### 2.5. Что ещё есть в Консоли и пока не нужно

- Удалённая конфигурация (флаги) не используется.
- Серверное время не используется: таймеры наград считаются по часам устройства. Это открытый вопрос в `docs/game-1-steal.md`.

## 3. Проверка в черновике

Пройти на компьютере и на телефоне. Каждый пункт — это требование площадки или риск, который не проверить без настоящего SDK.

1. **Загрузка.** Игра открывается без ошибок в консоли браузера. Пропадает надпись «Загрузка…». `LoadingAPI.ready()` уходит, когда уже можно играть (правило 1.19.2).
2. **Язык.** Поменять язык в панели черновика или в настройках аккаунта: ru → en → tr → es → pt → de → fr. Интерфейс, имена персонажей, реплики и вывески — на этом языке. Для `kk` — русский, для `ja` — английский.
3. **Сохранение гостя.**
   - Поиграть без входа, обновить страницу — прогресс на месте.
   - Свернуть вкладку — звук пропадает (правило 1.3).
4. **Реклама.**
   - Переродиться: окно перерождения, накопить 15 млн; для проверки можно подложить сохранение. Через пару секунд — полноэкранная реклама, игра и звук на паузе.
   - Реклама за награду: колесо и окно «С возвращением!». Для последнего — зайти через 2+ минуты после закрытия игры, если на счету есть монеты.
5. **Покупки.**
   - Купить «Сундук монет»: монеты пришли один раз. Обновить страницу — второй раз не пришли.
   - Купить «Без рекламы» и «Доход ×2». Обновить страницу и зайти с другого устройства под тем же аккаунтом: покупки на месте, баннера нет, доход удвоен.
   - Прервать оплату (закрыть окно) — ничего не выдаётся, игра продолжается.
6. **Вход и рейтинг.**
   - Войти из окна рейтинга. Своя строка появляется в таблице (может понадобиться подождать или вырасти на 5%).
   - Войти на втором устройстве, где прогресса больше: игра перезагружается и продолжает с прогресса аккаунта.
7. **GameplayAPI.** В панели черновика видно, что `start`/`stop` приходят только при открытии и закрытии окон, рекламы и паузы, без дублей.
8. **Методы SDK, которые менялись между версиями.** Если что-то из этого не работает в черновике — смотреть сюда в первую очередь (`engine/platform/yandex.ts`):
   - `player.isAuthorized()` (запасной вариант — `getMode() !== 'lite'`);
   - `ysdk.payments` или `ysdk.getPayments()`;
   - `ysdk.leaderboards` или `ysdk.getLeaderboards()`;
   - `getPriceCurrencyImage('svg')` у товаров каталога.

## 4. Модерация: что проверяют и где это в игре

| Правило | Где сделано |
|---|---|
| 1.3 звук при сворачивании вкладки | `Game.onVisibilityChange` → `AudioManager` |
| 1.4, 1.13 покупки только через SDK, необработанные при запуске, цена и значок из каталога | `engine/platform/yandex.ts`, `Game.restorePurchases`, `ShopMenus` |
| 1.9, 1.2.2 сохранение сразу после действий, гостевой режим | `Game.markDirty(true)` → `saveNow`, `YandexPlatform.saveData` |
| 1.19 `LoadingAPI.ready`, GameplayAPI по документации | `main.ts`, `Game.syncGameplay` |
| 2.10, 2.14 язык из SDK | `main.ts` (`chooseLanguage`), `i18n/index.ts` (`pickLanguage`) |
| 4.1–4.7 реклама | `Game.showFullscreenAd`, `showRewardedAd`, кнопки «📺» в окнах |
| 8.3.6 образ героя без пошлости | `data/heroes.ts`, `tools/art/characters.mjs` |
| кейсы, колесо, парилка — только за монеты, шансы видны, без казино-лексики | `data/cases.ts`, `wheel.ts`, тесты `shop.test.ts` и `i18n.test.ts` (проверка слов во всех языках) |
| 1.21, 1.22 архив | `npm run package` |

После отказа модерации отправить снова можно не раньше чем через сутки (не проверено). Причину отказа записать в `docs/game-1-steal.md`, «Открытые вопросы».

## 5. Тексты карточки

Название и описания можно поправить. Слова «Укради», «Брейнрот» и «Steal a Brainrot» часто ищут — их лучше оставить.

**Русский**
- Название: Укради Брейнрота: Баня
- Коротко: Покупай мемных персонажей, сажай их в свою баню и кради у соседей!
- Описание: Мемные персонажи идут по красной дорожке — покупай их и сажай на полок в своей бане: каждый приносит монеты. Соседи Жорик и Тимур тоже держат бани с персонажами — проберись к ним и укради самых ценных, пока хозяин спит! Но берегись: соседи тоже придут красть. Закрывай баню на щеколду, отбивайся веником, открывай кейсы, крути колесо удачи, превращай персонажей в парилке и собери весь альбом, включая золотые версии.
- Как играть: Ходи стрелками, WASD или джойстиком. E или большая кнопка — купить, украсть, собрать монеты. F или кнопка с веником — шлёпнуть соседа или собаку. Окна — кнопками слева или клавишами U, K, L, P, N, C, T, M, R.

**English**
- Title: Steal a Brainrot: Sauna
- Short: Buy meme characters, seat them in your sauna and steal from the neighbors!
- Description: Meme characters walk down the red carpet — buy them and seat them on the bench in your sauna: each one earns coins. Your neighbors Zhorik and Timur run saunas too — sneak in and steal their best characters while the owner is asleep! But watch out: the neighbors will come to steal from you as well. Lock your sauna, fight back with a broom, open cases, spin the lucky wheel, transform characters in the steam room and complete the album, golden versions included.
- How to play: Move with arrow keys, WASD or the joystick. E or the big button — buy, steal, collect coins. F or the broom button — swat a neighbor or a dog. Open windows with the buttons on the left or keys U, K, L, P, N, C, T, M, R.

**Türkçe**
- Ad: Brainrot Çal: Sauna
- Kısa: Mizah karakterleri satın al, saunana oturt ve komşulardan çal!
- Açıklama: Mizah karakterleri kırmızı halıdan geçiyor — onları satın al ve saunandaki banka oturt: her biri para kazandırır. Komşuların Zhorik ve Timur'un da karakterlerle dolu saunaları var — içeri süzül ve ev sahibi uyurken en değerlilerini çal! Ama dikkat: komşular da senden çalmaya gelecek. Saunanı kilitle, süpürgeyle karşılık ver, kasaları aç, şans çarkını çevir, buhar odasında karakterleri dönüştür ve altın sürümler dahil albümü tamamla.
- Nasıl oynanır: Ok tuşları, WASD veya joystick ile yürü. E veya büyük düğme — satın al, çal, para topla. F veya süpürge düğmesi — komşuya ya da köpeğe vur. Pencereleri soldaki düğmelerle veya U, K, L, P, N, C, T, M, R tuşlarıyla aç.

**Español**
- Título: Roba un Brainrot: Sauna
- Breve: ¡Compra personajes de memes, siéntalos en tu sauna y roba a los vecinos!
- Descripción: Los personajes de memes desfilan por la alfombra roja: cómpralos y siéntalos en el banco de tu sauna; cada uno da monedas. Tus vecinos Zhorik y Timur también tienen saunas llenas de personajes: ¡cuélate y roba los mejores mientras el dueño duerme! Pero cuidado: los vecinos también vendrán a robarte. Cierra tu sauna con cerrojo, defiéndete con la escoba, abre cajas, gira la rueda de la suerte, transforma personajes en la sala de vapor y completa el álbum, versiones doradas incluidas.
- Cómo jugar: Muévete con las flechas, WASD o el joystick. E o el botón grande: comprar, robar, recoger monedas. F o el botón de la escoba: golpear a un vecino o a un perro. Abre las ventanas con los botones de la izquierda o las teclas U, K, L, P, N, C, T, M, R.

**Português**
- Título: Roube um Brainrot: Sauna
- Curto: Compre personagens de memes, coloque-os na sua sauna e roube dos vizinhos!
- Descrição: Personagens de memes desfilam pelo tapete vermelho — compre e coloque no banco da sua sauna: cada um rende moedas. Seus vizinhos Zhorik e Timur também têm saunas cheias de personagens — entre de fininho e roube os melhores enquanto o dono dorme! Mas cuidado: os vizinhos também vão vir roubar você. Tranque a sauna, revide com a vassoura, abra caixas, gire a roda da sorte, transforme personagens na sala de vapor e complete o álbum, incluindo as versões douradas.
- Como jogar: Ande com as setas, WASD ou o joystick. E ou o botão grande — comprar, roubar, pegar moedas. F ou o botão da vassoura — bater em um vizinho ou cachorro. Abra as janelas pelos botões à esquerda ou pelas teclas U, K, L, P, N, C, T, M, R.

**Deutsch**
- Titel: Klau den Brainrot: Sauna
- Kurz: Kauf Meme-Figuren, setz sie in deine Sauna und klau bei den Nachbarn!
- Beschreibung: Meme-Figuren laufen über den roten Teppich — kauf sie und setz sie auf die Bank in deiner Sauna: Jede bringt Münzen. Deine Nachbarn Zhorik und Timur haben auch Saunen voller Figuren — schleich dich rein und klau die wertvollsten, während der Besitzer schläft! Aber Vorsicht: Die Nachbarn kommen auch zu dir klauen. Verriegle deine Sauna, wehr dich mit dem Besen, öffne Kisten, dreh am Glücksrad, verwandle Figuren im Dampfbad und vervollständige das Album samt goldenen Versionen.
- So wird gespielt: Laufen mit Pfeiltasten, WASD oder Joystick. E oder der große Knopf — kaufen, klauen, Münzen sammeln. F oder der Besen-Knopf — einen Nachbarn oder Hund hauen. Fenster öffnest du mit den Knöpfen links oder den Tasten U, K, L, P, N, C, T, M, R.

**Français**
- Titre : Vole un Brainrot : Sauna
- Court : Achète des personnages de mèmes, installe-les dans ton sauna et vole tes voisins !
- Description : Des personnages de mèmes défilent sur le tapis rouge : achète-les et installe-les sur le banc de ton sauna, chacun rapporte des pièces. Tes voisins Zhorik et Timour ont eux aussi des saunas pleins de personnages : faufile-toi chez eux et vole les plus précieux pendant que le propriétaire dort ! Mais attention : les voisins viendront aussi te voler. Verrouille ton sauna, riposte avec ton balai, ouvre des caisses, fais tourner la roue de la chance, transforme des personnages dans le bain de vapeur et complète l’album, versions dorées comprises.
- Comment jouer : Déplace-toi avec les flèches, WASD ou le joystick. E ou le grand bouton : acheter, voler, ramasser les pièces. F ou le bouton balai : taper un voisin ou un chien. Ouvre les fenêtres avec les boutons à gauche ou les touches U, K, L, P, N, C, T, M, R.

## 6. После выпуска

- Записать в `CLAUDE.md` и `README.md`: игра выпущена, ссылка на неё в каталоге.
- Собрать отзывы о темпе — по ним подвинуть профили модели прохождения (`pacing.ts`) и доводку первой минуты.
- Новый язык: словарь `games/steal/src/i18n/<код>.ts` по образцу `en.ts`, строка в `DICTIONARIES` (`i18n/index.ts`), язык и карточка — в Консоли. Тест `i18n.test.ts` проверит ключи, пустые строки, оставшуюся кириллицу и казино-лексику.
