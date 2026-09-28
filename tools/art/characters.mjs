// Персонажи игры. Каждый — лист 32×32 из двух кадров: «вдох» и «выдох» (или движение танца).
import { C, sheet } from './lib.mjs';

const SIZE = 32;

/** Лист из двух кадров: draw(frame, index) рисует кадр, потом добавляется обводка. */
function twoFrames(draw) {
  const s = sheet(SIZE, SIZE, 2);
  for (let i = 0; i < 2; i++) {
    const f = s.frame(i);
    draw(f, i);
    f.outline();
  }
  return s.img;
}

// ---------- Котость: круглый трёхцветный кот ----------
function kotostFur(nx, ny) {
  const within = (cx, cy, rx2, ry2) => ((nx - cx) ** 2) / rx2 + ((ny - cy) ** 2) / ry2 < 1;
  if (within(0, -0.9, 0.03, 0.02)) return 'ginger';
  if (Math.abs(nx) < 0.13 && ny < -0.2) return 'white';
  if (within(-0.42, -0.45, 0.16, 0.12) || within(0.42, -0.45, 0.16, 0.12)) return 'black';
  if (within(0, -0.05, 0.2, 0.09)) return 'white';
  if (within(0, 0.18, 0.1, 0.02)) return 'ginger';
  if (within(0.7, 0.35, 0.12, 0.1)) return 'black';
  if (within(0.55, 0.05, 0.16, 0.14)) return 'ginger';
  if (within(-0.95, 0.05, 0.22, 0.2)) return 'black';
  if (within(-0.55, 0.5, 0.12, 0.2)) return 'ginger';
  return 'white';
}

export function kotost() {
  const fur = {
    white: (lit) => (lit < -0.62 ? '#c3c7d6' : C.white),
    ginger: (lit) => (lit < -0.5 ? '#b45f2c' : lit > 0.55 ? '#f6b26b' : '#e8893c'),
    black: (lit) => (lit > 0.5 ? C.blackLight : C.black),
  };
  return twoFrames((f, i) => {
    const cx = 16;
    const rx = 13.5 + i * 0.5;
    const ry = 12.5 - i * 0.5;
    const cy = 31 - ry;
    f.ellipse(cx, cy, rx, ry, (nx, ny) => fur[kotostFur(nx, ny)](-(nx * 0.55 + ny * 0.75)));
    const top = Math.round(cy - ry);
    // прижатые ушки
    for (const side of [-1, 1]) {
      const ex = cx + side * 7 - (side < 0 ? 1 : 0);
      f.grid(ex - 1, top - 1, ['.k.', 'kkk', 'khk'], { k: C.black, h: C.blackLight });
    }
    // огромные глаза
    const ey = Math.round(cy - ry * 0.42);
    for (const side of [-1, 1]) {
      const ex = cx + side * 5.5;
      f.ellipse(ex, ey + 0.5, 3.6, 3.6, (nx, ny) => (nx * nx + ny * ny < 0.52 ? '#0f0d14' : '#d8d59a'));
      const sx = Math.floor(ex);
      f.rect(sx, ey - 2, 2, 2, '#ffffff');
      f.set(sx - 1, ey + 1, '#ffffff');
    }
    // нос и рот
    f.rect(15, ey + 3, 2, 1, '#e27584');
    f.rect(15, ey + 4, 2, 1, '#9c4452');
    f.rect(15, ey + 5, 2, 1, '#c3c7d6');
    f.set(14, ey + 6, '#c3c7d6');
    f.set(17, ey + 6, '#c3c7d6');
    // лапки
    for (const x of [11, 12, 19, 20]) f.set(x, 30, C.white);
    for (const x of [10, 13, 18, 21]) f.set(x, 30, '#c3c7d6');
  });
}

// ---------- Танцуй Пантера: чёрная пантера на задних лапах, танцует ----------
export function panther() {
  const fur = C.black;
  const hi = C.blackLight;
  return twoFrames((f, i) => {
    const bob = i === 1 ? 1 : 0;
    // хвост
    f.line(19, 26, 23, 27, fur);
    f.line(19, 25, 23, 26, fur);
    f.line(23, 27, 26, 23, fur);
    f.line(24, 27, 27, 23, fur);
    f.line(26, 23, 26, 19, fur);
    f.line(27, 23, 27, 19, hi);
    // ноги
    f.rect(12, 24, 3, 5, fur);
    f.rect(17, 24, 3, 5, fur);
    f.rect(11, 29, 4, 2, fur);
    f.rect(17, 29, 4, 2, fur);
    f.rect(12, 24, 1, 5, hi);
    // туловище
    f.ellipse(16, 20 + bob, 4.8, 5.2, (nx) => (nx < -0.45 ? hi : fur));
    // руки: левая вверх, правая на бедре
    f.line(12, 17 + bob, 8, 10 + bob, fur);
    f.line(13, 17 + bob, 9, 10 + bob, fur);
    f.rect(7, 8 + bob, 3, 3, fur);
    f.line(20, 17 + bob, 23, 20 + bob, fur);
    f.line(20, 18 + bob, 23, 21 + bob, fur);
    f.line(23, 20 + bob, 21, 23 + bob, fur);
    // голова
    const hy = 9.5 + bob;
    f.grid(10, 2 + bob, ['kk........kk', 'kkk......kkk', 'kpk......kpk'], { k: fur, p: '#7a4a6a' }, false);
    f.ellipse(16, hy, 6.8, 5.8, (nx, ny) => (nx < -0.5 && ny < 0 ? hi : fur));
    // глаза
    for (const ex of [12, 17]) {
      f.grid(ex, 8 + bob, ['yyy', 'yky', '.y.'], { y: '#e7e36b', k: C.ink });
    }
    // морда
    f.ellipse(16, 12.8 + bob, 3.2, 2, '#433b50');
    f.rect(15, 12 + bob, 2, 1, C.plum);
    f.set(14, 13 + bob, C.ink);
    f.set(15, 14 + bob, C.ink);
    f.set(16, 14 + bob, C.ink);
    f.set(17, 13 + bob, C.ink);
    if (i === 1) f.mirror();
  });
}

// ---------- Аниме-лицо: общий трафарет для тянки и рыцаря ----------
function animeHead(f, { hair, hairShade, iris, bob = 0, mouth = 'smile' }) {
  const y = bob;
  // волосы (сзади)
  f.ellipse(16, 9 + y, 8, 7.5, (nx, ny) => (nx > 0.55 || ny > 0.5 ? hairShade : hair));
  // лицо
  f.ellipse(16, 12 + y, 5.6, 4.6, (nx, ny) => (nx > 0.6 && ny > 0 ? C.skinShade : C.skin));
  // чёлка
  f.grid(10, 5 + y, [
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhhdhhhhdhhh',
    'hh.h.hh.h.hh',
  ], { h: hair, d: hairShade });
  // глаза
  for (const ex of [12, 18]) {
    f.grid(ex, 10 + y, ['kk', 'wi', 'ii'], { k: C.ink, w: C.white, i: iris });
  }
  // румянец и рот
  f.set(11, 13 + y, '#f29aa3');
  f.set(20, 13 + y, '#f29aa3');
  if (mouth === 'open') {
    f.rect(15, 14 + y, 2, 1, C.red);
  } else {
    f.set(15, 14 + y, C.red);
    f.set(16, 14 + y, C.red);
  }
}

// ---------- Тянка в фартуке ----------
export function animeCook() {
  return twoFrames((f, i) => {
    const hair = C.pink;
    const hairShade = C.pinkDark;
    // хвостики
    f.ellipse(7, 15, 2.6, 5.5, (nx) => (nx > 0.3 ? hairShade : hair));
    f.ellipse(25, 15, 2.6, 5.5, (nx) => (nx > 0.3 ? hairShade : hair));
    // ноги
    f.rect(13, 26, 2, 3, C.skin);
    f.rect(17, 26, 2, 3, C.skin);
    f.rect(13, 28, 2, 2, C.white);
    f.rect(17, 28, 2, 2, C.white);
    f.rect(12, 30, 3, 1, C.red);
    f.rect(17, 30, 3, 1, C.red);
    // платье
    for (let y = 17; y <= 26; y++) {
      const n = Math.round(3.5 + (y - 17) * 0.45);
      f.rect(16 - n, y, n * 2, 1, y > 23 ? '#3b8fd9' : C.sky);
    }
    // фартук
    f.rect(13, 18, 6, 8, C.white);
    f.rect(12, 24, 8, 2, C.white);
    f.set(13, 17, C.white);
    f.set(18, 17, C.white);
    f.rect(15, 21, 2, 1, '#c3c7d6');
    f.rect(12, 26, 8, 1, '#c3c7d6');
    // левая рука
    f.rect(10, 18, 2, 3, C.sky);
    f.rect(10, 21, 2, 2, C.skin);
    // правая рука с половником
    const hy = i === 0 ? 21 : 17;
    f.rect(20, 18, 2, 2, C.sky);
    f.rect(21, hy, 2, 2, C.skin);
    f.line(23, hy - 7, 23, hy + 1, C.silver);
    f.ellipse(23.5, hy + 2.5, 2, 1.5, C.silver);
    animeHead(f, { hair, hairShade, iris: C.blue });
    // бантик
    f.grid(20, 1, ['r.r', 'rrr', 'r.r'], { r: C.red });
  });
}

// ---------- Аниме-рыцарь (свой персонаж, не копия чужого) ----------
export function animeKnight() {
  return twoFrames((f, i) => {
    const hair = '#f7b5d6';
    const hairShade = '#d77fb0';
    // плащ
    f.rect(9, 17, 14, 11, '#6d3fa0');
    f.rect(9, 17, 2, 11, '#51307a');
    // коса
    f.ellipse(23.5, 18, 2, 3, hair);
    f.ellipse(24.5, 23, 1.8, 2.5, hairShade);
    // ноги
    f.rect(13, 25, 2, 4, C.white);
    f.rect(17, 25, 2, 4, C.white);
    f.rect(12, 29, 3, 2, C.shadow);
    f.rect(17, 29, 3, 2, C.shadow);
    // туника с золотой отделкой
    f.rect(12, 17, 8, 9, C.white);
    f.rect(12, 17, 8, 1, C.gold);
    f.rect(15, 18, 2, 7, C.gold);
    f.rect(12, 25, 8, 1, C.gold);
    f.rect(18, 18, 2, 7, '#dfe3ee');
    // руки
    f.rect(10, 18, 2, 4, C.white);
    f.rect(10, 22, 2, 2, C.skin);
    const hy = i === 0 ? 20 : 16;
    f.rect(20, 18, 2, 2, C.white);
    f.rect(21, hy, 2, 2, C.skin);
    animeHead(f, { hair, hairShade, iris: '#8e5bd6', mouth: 'open' });
    // меч — поверх волос
    f.line(23, hy - 9, 23, hy - 1, '#dfe3ee');
    f.line(24, hy - 9, 24, hy - 1, C.silver);
    f.rect(21, hy - 1, 5, 1, C.gold);
    // белая ленточка
    f.grid(9, 5, ['w.', 'ww', 'w.'], { w: C.white });
  });
}

// ---------- Водолаз «Нюхай быстрее»: старый медный шлем и цветок ----------
export function diver() {
  return twoFrames((f, i) => {
    const suit = '#7d8fa6';
    const suitShade = C.slate;
    // ботинки
    f.rect(10, 28, 5, 3, C.shadow);
    f.rect(17, 28, 5, 3, C.shadow);
    // ноги
    f.rect(11, 24, 4, 4, suit);
    f.rect(17, 24, 4, 4, suitShade);
    // костюм
    f.ellipse(16, 21, 6.5, 5, (nx) => (nx > 0.4 ? suitShade : suit));
    // руки
    f.rect(8, 18, 3, 6, suit);
    f.rect(8, 24, 3, 2, '#b45f2c');
    const hy = i === 0 ? 22 : 15;
    f.rect(21, 18, 3, i === 0 ? 5 : 2, suitShade);
    f.rect(22, hy, 3, 2, '#b45f2c');
    // медный шлем
    f.ellipse(16, 10, 7.5, 7.5, (nx, ny) => {
      const lit = -(nx * 0.6 + ny * 0.8);
      return lit > 0.55 ? C.yellow : lit < -0.45 ? '#b45f2c' : C.orange;
    });
    // воротник шлема
    f.rect(10, 16, 12, 2, '#b45f2c');
    // иллюминатор с болтами
    f.ellipse(16, 10.5, 4.2, 4.2, '#b45f2c');
    f.ellipse(16, 10.5, 3.2, 3.2, (nx, ny) => (nx < -0.2 && ny < -0.2 ? C.cyan : '#4fa3b8'));
    f.set(14, 9, C.white);
    for (const [x, y] of [[16, 5], [11, 10], [21, 10], [16, 15]]) f.set(x, y, C.ink);
    // глаза внутри шлема
    f.set(15, 10, C.ink);
    f.set(17, 10, C.ink);
    // цветок — поверх всего: в первом кадре в руке, во втором поднесён к иллюминатору
    const [fx, fy] = i === 0 ? [25, 16] : [21, 9];
    f.line(fx, fy + 2, fx - 1, fy + 5, C.green);
    f.grid(fx - 1, fy - 1, ['.w.', 'wyw', '.w.'], { w: C.white, y: C.yellow });
  });
}

// ---------- Баба Чай: бабуля в платке с чашкой чая ----------
export function babaChai() {
  return twoFrames((f, i) => {
    // ноги-валенки
    f.rect(12, 28, 3, 3, C.shadow);
    f.rect(17, 28, 3, 3, C.shadow);
    // платье
    f.ellipse(16, 23, 7, 6.5, (nx, ny) => (nx > 0.5 ? C.navy : C.blue));
    for (const [x, y] of [[12, 20], [18, 22], [14, 25], [20, 26], [11, 24], [17, 19]]) f.set(x, y, C.white);
    // руки и чашка
    const cy = i === 0 ? 19 : 17;
    f.rect(12, cy + 1, 3, 2, C.skin);
    f.rect(17, cy + 1, 3, 2, C.skin);
    f.rect(13, cy - 1, 6, 3, C.white);
    f.rect(13, cy - 1, 6, 1, C.red);
    f.rect(12, cy + 2, 8, 1, '#c3c7d6');
    f.set(19, cy, C.white);
    // пар
    const steam = i === 0 ? [[14, cy - 3], [15, cy - 4], [16, cy - 3], [17, cy - 5]] : [[15, cy - 3], [16, cy - 4], [15, cy - 5], [17, cy - 3]];
    for (const [x, y] of steam) f.set(x, y, '#dfe3ee');
    // платок
    f.ellipse(16, 9.5, 8, 7.5, (nx, ny) => (nx > 0.55 || ny > 0.6 ? '#8f2f45' : C.red));
    for (const [x, y] of [[11, 6], [15, 4], [19, 6], [21, 10], [10, 11], [13, 3], [18, 3]]) f.set(x, y, C.white);
    // лицо
    f.ellipse(16, 11, 5, 4.5, (nx, ny) => (nx > 0.6 && ny > 0 ? C.skinShade : C.skin));
    // узел платка под подбородком
    f.grid(14, 15, ['rrrr', '.rr.', 'r..r'], { r: C.red });
    // очки
    f.grid(11, 9, ['ssss..ssss', 's..ssss..s', 'ssss..ssss'], { s: C.silver });
    f.set(13, 10, C.ink);
    f.set(18, 10, C.ink);
    // щёки и улыбка
    f.set(11, 13, '#f29aa3');
    f.set(20, 13, '#f29aa3');
    f.rect(15, 13, 2, 1, C.red);
  });
}

// ---------- Хамам: мастер турецкой бани с пенным облаком ----------
export function hamam() {
  return twoFrames((f, i) => {
    // пенное облако слева
    const foam = i === 0
      ? [[6, 13, 4], [4, 18, 3.5], [8, 20, 3], [3, 11, 2.5]]
      : [[6, 12, 4.5], [3, 17, 4], [8, 21, 3], [2, 10, 2.5], [9, 8, 2]];
    for (const [x, y, r] of foam) f.ellipse(x, y, r, r, (nx, ny) => (nx > 0.4 && ny > 0.3 ? '#c3d3e6' : C.white));
    // ноги
    f.rect(12, 26, 3, 3, C.skin);
    f.rect(17, 26, 3, 3, C.skinShade);
    f.rect(11, 29, 4, 2, '#8a5a44');
    f.rect(17, 29, 4, 2, '#8a5a44');
    // пештемаль (полосатое полотенце)
    for (let y = 21; y <= 26; y++) f.rect(10, y, 12, 1, y % 2 ? C.red : C.white);
    // живот и грудь
    f.ellipse(16, 18, 6, 5, (nx, ny) => (nx > 0.5 ? C.skinShade : C.skin));
    f.set(14, 19, C.skinShade);
    // руки: левая держит мешок для пены
    f.rect(9, 15, 2, 5, C.skin);
    f.rect(8, 19, 3, 3, '#dfe3ee');
    f.rect(21, 15, 2, 6, C.skinShade);
    f.rect(21, 20, 2, 1, C.gold);
    // голова
    f.ellipse(16, 9.5, 5, 5, (nx, ny) => (nx > 0.55 && ny > -0.2 ? C.skinShade : C.skin));
    // феска
    f.rect(12, 2, 8, 4, C.red);
    f.rect(12, 5, 8, 1, '#8f2f45');
    f.line(19, 2, 22, 5, C.ink);
    f.rect(22, 5, 1, 2, C.gold);
    // глаза, брови, усы
    f.set(13, 9, C.ink);
    f.set(18, 9, C.ink);
    f.rect(12, 8, 2, 1, C.ink);
    f.rect(18, 8, 2, 1, C.ink);
    f.grid(11, 11, ['.kkk..kkk.', 'kkkkkkkkkk', 'kk......kk'], { k: C.ink });
    f.set(15, 10, C.skinShade);
    f.set(16, 10, C.skinShade);
  });
}

// ---------- Игрок: мальчик в красном капюшоне, 4 направления × 4 кадра ходьбы, 16×16 ----------
export function hero(colors = {}) {
  const s = sheet(16, 16, 4, 4);
  const pal = { r: C.red, R: C.plum, o: C.orange, s: C.yellow, k: C.ink, b: C.blue, B: C.navy, y: C.yellow, d: C.shadow, ...colors };
  const front = ['................', '.....rrrrrr.....', '....rorrrrrr....', '...rorrrrrrrr...', '...rrrrrrrrrr...', '...rrssssssrr...', '...rrskssksrr...', '...rrossssorr...', '...RrrssssrrR...', '....RrbbbbrR....', '...RrbbbbbbrR...', '...srbbyybbrs...', '....RBbbbbBR....'];
  const back = ['................', '.....rrrrrr.....', '....rorrrrrr....', '...rorrrrrrrr...', '...rrrrrrrrrr...', '...rrrrrrrrrr...', '...rrrrrrrrrr...', '...rrrrrrrrrr...', '...RrrrrrrrrR...', '....RRrrrrRR....', '...RrrrrrrrrR...', '...srrrrrrrrs...', '....RRRRRRRR....'];
  // Профиль: лицо вровень с передним краем капюшона, чтобы не торчало из силуэта.
  const side = ['................', '......rrrrrr....', '.....rorrrrrr...', '....rorrrrrrrr..', '....rrrrrrrrrr..', '....ssssssrrrr..', '....skssssrrrr..', '....sosssrrrrr..', '.....sssRrrrR...', '.....RbbbrrrR...', '.....bbbbrrrR...', '.....bsbbrrrR...', '.....BBBBRRR....'];
  const legsFB = { stand: ['.....dd..dd.....', '.....dd..dd.....'], liftL: ['.....dd..dd.....', '.........dd.....'], liftR: ['.....dd..dd.....', '.....dd.........'] };
  const legsSide = { stand: ['......dd........', '.....ddd........'], strideA: ['.....dd.dd......', '....dd...dd.....'], strideB: ['.....dd.dd......', '....dd....d.....'] };
  const rows = [
    { upper: front, legs: [legsFB.stand, legsFB.liftL, legsFB.stand, legsFB.liftR], flip: false },
    { upper: side, legs: [legsSide.stand, legsSide.strideA, legsSide.stand, legsSide.strideB], flip: false },
    { upper: side, legs: [legsSide.stand, legsSide.strideA, legsSide.stand, legsSide.strideB], flip: true },
    { upper: back, legs: [legsFB.stand, legsFB.liftR, legsFB.stand, legsFB.liftL], flip: false },
  ];
  rows.forEach((r, row) =>
    r.legs.forEach((legs, col) => {
      const f = s.frame(col, row);
      f.grid(0, 13, legs, pal, r.flip);
      f.grid(0, col % 2, r.upper, pal, r.flip);
      f.outline();
    }),
  );
  return s.img;
}

// ---------- Коч Братан: парень из казахской бани — войлочная шапка, полотенце, веник ----------
export function kochBratan() {
  return twoFrames((f, i) => {
    const skin = '#e2b48a';
    const skinShade = '#bf8d63';
    // ноги и шлёпанцы
    f.rect(12, 26, 3, 3, skin);
    f.rect(17, 26, 3, 3, skinShade);
    f.rect(11, 29, 4, 2, C.red);
    f.rect(17, 29, 4, 2, C.red);
    // полотенце на поясе
    f.rect(10, 21, 12, 6, C.white);
    f.rect(10, 23, 12, 1, C.sky);
    f.rect(19, 21, 3, 6, '#dfe3ee');
    // торс
    f.ellipse(16, 17.5, 5.5, 4.5, (nx) => (nx > 0.5 ? skinShade : skin));
    // руки; в правой — веник
    f.rect(9, 15, 2, 6, skin);
    const hy = i === 0 ? 20 : 13;
    f.rect(21, 15, 2, i === 0 ? 6 : 3, skinShade);
    f.rect(22, hy - 1, 2, 2, skinShade);
    f.line(23, hy - 1, 23, hy - 6, C.bark);
    f.ellipse(23.5, hy - 8, 2.5, 3, (nx, ny) => (nx + ny > 0.4 ? C.teal : C.green));
    // голова
    f.ellipse(16, 9.5, 5, 4.8, (nx, ny) => (nx > 0.55 && ny > -0.2 ? skinShade : skin));
    // войлочная банная шапка
    f.ellipse(16, 5, 6.5, 3.5, (nx, ny) => (ny > 0.35 ? '#c4a97a' : '#e8d3a8'));
    f.rect(9, 6, 14, 2, '#c4a97a');
    f.rect(9, 6, 14, 1, '#e8d3a8');
    // лицо: глаза-щёлочки, брови, улыбка
    f.rect(12, 9, 2, 1, C.ink);
    f.rect(18, 9, 2, 1, C.ink);
    f.rect(12, 8, 2, 1, C.black);
    f.rect(18, 8, 2, 1, C.black);
    f.grid(13, 12, ['k....k', '.kkkk.'], { k: C.ink });
    f.set(11, 11, '#e9938c');
    f.set(20, 11, '#e9938c');
  });
}

// ---------- Тёмный Друн: лысый, чёрная кожа, меховой воротник, огромная сумка ----------
export function darkDrun() {
  return twoFrames((f, i) => {
    const leather = '#2f2b38';
    const leatherHi = '#4d4760';
    const fur = C.black;
    // ботинки и штаны
    f.rect(11, 28, 4, 3, C.ink);
    f.rect(17, 28, 4, 3, C.ink);
    f.rect(12, 22, 3, 6, leather);
    f.rect(17, 22, 3, 6, leather);
    f.rect(12, 22, 1, 6, leatherHi);
    // куртка
    f.rect(10, 15, 12, 8, leather);
    f.rect(10, 15, 2, 8, leatherHi);
    f.rect(15, 16, 1, 6, C.silver);
    f.set(13, 19, C.silver);
    f.set(19, 19, C.silver);
    // руки
    f.rect(8, 15, 2, 7, leather);
    f.rect(22, 15, 2, 6, leather);
    // сумка в левой руке: качается
    const bx = i === 0 ? 3 : 4;
    const by = i === 0 ? 20 : 21;
    f.line(8, 21, bx + 3, by, C.shadow);
    f.ellipse(bx + 3.5, by + 4, 4, 3.8, (nx, ny) => (nx < -0.3 && ny < -0.2 ? leatherHi : C.black));
    for (const [x, y] of [[bx + 2, by + 3], [bx + 4, by + 4], [bx + 3, by + 6], [bx + 5, by + 2], [bx + 1, by + 5]]) f.set(x, y, C.silver);
    // меховой воротник
    f.ellipse(16, 14.5, 8, 3.2, (nx, ny) => ((Math.round(nx * 9) + Math.round(ny * 3)) % 2 ? fur : C.blackLight));
    // лысая голова
    f.ellipse(16, 8.5, 5, 5.2, (nx, ny) => {
      if (nx < -0.3 && ny < -0.45) return '#ffe2c8';
      return nx > 0.55 && ny > -0.2 ? C.skinShade : C.skin;
    });
    f.set(10, 9, C.skin);
    f.set(21, 9, C.skinShade);
    // суровое лицо
    f.rect(12, 8, 3, 1, C.ink);
    f.rect(17, 8, 3, 1, C.ink);
    f.set(13, 9, C.ink);
    f.set(18, 9, C.ink);
    f.rect(14, 12, 4, 1, '#a45a52');
  });
}

// ---------- Толстый Меллстрой (фото 2): круглый, стрижка «ёжик», чёрная футболка ----------
export function fatMellstroy() {
  return twoFrames((f, i) => {
    const skin = '#f2c7a5';
    const skinShade = '#d6a283';
    const shirt = '#26232e';
    const shirtHi = '#3f3a4d';
    const w = i === 0 ? 0 : 0.6;
    // ноги
    f.rect(11, 27, 4, 3, '#3b5dc9');
    f.rect(17, 27, 4, 3, '#29366f');
    f.rect(10, 30, 5, 1, C.ink);
    f.rect(17, 30, 5, 1, C.ink);
    // руки
    f.ellipse(6.5, 21, 2, 3.5, skin);
    f.ellipse(25.5, 21, 2, 3.5, skinShade);
    // огромный живот в чёрной футболке
    f.ellipse(16, 21.5, 9.5 + w, 7.5, (nx, ny) => (nx < -0.45 && ny < 0.2 ? shirtHi : shirt));
    f.rect(12, 20, 1, 1, '#566c86');
    // круглая голова с двойным подбородком
    const hy = i === 0 ? 9 : 9.5;
    f.ellipse(16, hy + 4.2, 6.2, 2.2, skinShade);
    f.ellipse(16, hy, 7.2 + w * 0.4, 6.8, (nx, ny) => (nx > 0.55 && ny > -0.2 ? skinShade : skin));
    // «ёжик»
    f.ellipse(16, hy - 4.6, 6.4, 2.6, (nx, ny) => (ny > 0.35 ? '#5a3a38' : '#3b2a26'));
    // лицо: маленькие светлые глаза, пухлые губы
    const ey = Math.round(hy);
    f.rect(12, ey, 2, 1, '#9ab7d3');
    f.rect(18, ey, 2, 1, '#9ab7d3');
    f.set(13, ey, C.ink);
    f.set(18, ey, C.ink);
    f.rect(12, ey - 1, 2, 1, '#8a5a44');
    f.rect(18, ey - 1, 2, 1, '#8a5a44');
    f.set(16, ey + 1, skinShade);
    f.set(16, ey + 2, skinShade);
    f.rect(14, ey + 4, 4, 1, '#d97c86');
    f.rect(15, ey + 5, 2, 1, '#b95a66');
  });
}

// ---------- Индеец Меллстрой (фото 4): белое худи и головной убор из перьев ----------
export function indianMellstroy() {
  return twoFrames((f, i) => {
    const hoodie = '#e7f2ee';
    const hoodieShade = '#b9d6cc';
    // ноги
    f.rect(12, 27, 3, 3, C.navy);
    f.rect(17, 27, 3, 3, C.navy);
    f.rect(11, 30, 4, 1, C.ink);
    f.rect(17, 30, 4, 1, C.ink);
    // худи
    f.ellipse(16, 22, 7.5, 6, (nx) => (nx > 0.45 ? hoodieShade : hoodie));
    f.rect(8, 19, 2, 7, hoodie);
    f.rect(22, 19, 2, 7, hoodieShade);
    f.line(15, 17, 15, 22, '#94b0c2');
    f.line(17, 17, 17, 22, '#94b0c2');
    // голова
    f.ellipse(16, 13, 4.8, 4.6, (nx, ny) => (nx > 0.55 && ny > -0.2 ? C.skinShade : C.skin));
    f.set(12, 14, '#f29aa3');
    f.set(19, 14, '#f29aa3');
    f.set(14, 13, C.ink);
    f.set(18, 13, C.ink);
    f.rect(15, 16, 2, 1, '#b95a66');
    // перья веером
    const sway = i === 0 ? 0 : 0.05;
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI * (1.05 + (k / 12) * 0.9) + sway;
      for (let r = 3; r <= 10; r++) {
        const x = 16 + Math.cos(a) * r;
        const y = 10 + Math.sin(a) * r * 0.85;
        f.set(x, y, r >= 9 ? C.ink : r >= 7 ? '#8a5a44' : C.white);
      }
    }
    // налобная повязка с бусинами и черепком
    f.rect(10, 9, 12, 2, '#b13e53');
    for (const x of [11, 14, 18, 21]) f.set(x, 9, C.cyan);
    f.rect(15, 9, 2, 2, C.white);
    f.set(15, 10, C.ink);
  });
}

// ---------- Школьник второй смены (фото 5): глаза навыкате, нос, улыбка, рубашка «Dodge Cabana» ----------
export function schoolboy() {
  return twoFrames((f, i) => {
    const skin = '#f0c4a4';
    const skinShade = '#d49c7c';
    // ноги
    f.rect(12, 26, 3, 4, C.shadow);
    f.rect(17, 26, 3, 4, C.shadow);
    f.rect(11, 30, 4, 1, C.ink);
    f.rect(17, 30, 4, 1, C.ink);
    // чёрная рубашка с тропическим принтом
    f.rect(10, 17, 12, 10, C.black);
    for (const [x, y, c] of [[12, 19, C.orange], [13, 20, C.green], [18, 21, C.orange], [19, 22, C.lime], [11, 24, C.green], [16, 25, C.orange], [20, 18, C.white], [14, 23, C.white]]) f.set(x, y, c);
    // левая рука вниз, правая — «класс» с золотыми часами
    f.rect(8, 18, 2, 6, C.black);
    f.rect(8, 24, 2, 2, skin);
    const hy = i === 0 ? 14 : 13;
    f.rect(22, 18, 2, 3, C.black);
    f.rect(22, hy + 2, 2, 3, skin);
    f.rect(22, hy + 4, 2, 1, C.gold);
    f.rect(22, hy, 3, 2, skin);
    f.set(24, hy - 1, skin);
    // голова, уши
    f.ellipse(16, 9.5, 5.5, 6, (nx, ny) => (nx > 0.55 && ny > -0.2 ? skinShade : skin));
    f.set(10, 9, skinShade);
    f.set(21, 9, skinShade);
    f.ellipse(16, 4.2, 5, 1.8, '#3b2a26');
    // глаза навыкате
    for (const ex of [13, 18]) {
      f.rect(ex, 7, 2, 2, C.white);
      f.set(ex + (i === 0 ? 0 : 1), 8, C.ink);
    }
    // длинный нос
    f.rect(15, 9, 2, 2, skinShade);
    f.rect(17, 10, 2, 1, skinShade);
    // улыбка с дырками в зубах
    f.rect(12, 13, 8, 2, C.ink);
    for (const x of [13, 14, 16, 18]) f.set(x, 13, C.white);
  });
}

// ---------- Взмах веника: 3 кадра 24×24; верхний ряд — удар вправо, нижний — то же зеркально ----------
export function broomSwing() {
  const s = sheet(24, 24, 3, 2);
  const angles = [-2.4, -1.3, 0.3];
  for (let row = 0; row < 2; row++) {
    angles.forEach((angle, i) => {
      const f = s.frame(i, row);
      // след взмаха
      if (i > 0) {
        for (let k = 0; k < 10; k++) {
          const a = angle - 1.1 + k * 0.1;
          f.set(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, C.white);
        }
      }
      // ручка
      f.line(12, 12, 12 + Math.cos(angle) * 5, 12 + Math.sin(angle) * 5, C.bark);
      // листья
      f.ellipse(12 + Math.cos(angle) * 8, 12 + Math.sin(angle) * 8, 3, 3, (nx, ny) => (nx + ny > 0.3 ? C.teal : C.green));
      f.outline();
      if (row === 1) f.mirror();
    });
  }
  return s.img;
}
