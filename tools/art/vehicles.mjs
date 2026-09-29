// Текстуры для объёмных моделей: старая «копейка», трактор, мемный портал с воротами.
// 16 px = 1 единица мира. Текстура покрывает грань целиком: без прозрачных полей и чёрной обводки
// (кроме круглых — колёс и портала). Боковые грани: слева — зад, справа — перёд.
// Верхние грани: x идёт от зада к переду, верхние строки — дальний борт, нижние — ближний.
// Свет, как и везде, сверху слева.
import { C, sheet, rng } from './lib.mjs';

// ---------------------------------------------------------------- общие цвета и помощники

const CHROME = { light: '#e8eef4', mid: '#c3d3e6', dark: '#94b0c2' };
/** Стёкла машины темнее краски: камера смотрит сверху, светлое стекло сливается с кузовом. */
const CAR_GLASS = { sparkle: '#c3d3e6', light: C.silver, base: C.slate, dark: C.shadow };
/** Стёкла кабины трактора светлые: за ними виден тракторист. */
const CAB_GLASS = { sparkle: '#e8f6ff', light: '#e8f6ff', base: '#b7e0f5', dark: '#7fb6d6' };
/** Стекло фар. */
const LAMP = { light: '#e8f6ff', base: '#b7e0f5' };
const RUST = { light: '#b8573c', dark: '#8a4a30' };
const RUBBER = { light: C.blackLight, base: C.black, dark: C.ink };
const TAILLIGHT = { light: '#ff8a7a', red: '#e0404a', dark: '#9a2230' };

/** Краски машины: ряд 0 — старая выцветшая голубая, ряд 1 — чистая вишнёвая. */
const CAR_PAINTS = [
  { light: '#aed3e6', mid: '#9ac4db', paint: '#86b4cf', shade: '#5f8aa8', deep: '#46708e', old: true },
  { light: '#d05a64', mid: '#bb4450', paint: '#a8323e', shade: '#7d2230', deep: '#58182a', old: false },
];

/** Лист машины: по ряду на каждую краску, в ряду columns кадров; draw(fr, краска, колонка, rand). */
function carSheet(w, h, columns, draw) {
  const s = sheet(w, h, columns, CAR_PAINTS.length);
  CAR_PAINTS.forEach((p, row) => {
    for (let col = 0; col < columns; col++) draw(s.frame(col, row), p, col, rng(17 + row * 31 + col * 7));
  });
  return s.img;
}

/** Одиночная текстура: draw(fr) рисует в единственном кадре. */
function single(w, h, draw) {
  const s = sheet(w, h, 1);
  draw(s.frame(0));
  return s.img;
}

/** Заливает строки: colors[i] — цвет строки y + i. */
function stripes(fr, x, y, w, colors) {
  colors.forEach((c, i) => fr.rect(x, y + i, w, 1, c));
}

/** Прямоугольник со срезанными углами — мягкий блик. */
function roundRect(fr, x, y, w, h, color) {
  fr.rect(x + 1, y, w - 2, h, color);
  fr.rect(x, y + 1, w, h - 2, color);
}

/** Перекрашивает пиксели цвета from в прямоугольнике — рисунок «под» стеклом или «поверх» краски. */
function tint(fr, x, y, w, h, from, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (fr.get(xx, yy) === from) fr.set(xx, yy, color);
}

/** Хромированная полоса в 1 px с бликами. */
function chromeLine(fr, x, y, w) {
  for (let i = 0; i < w; i++) fr.set(x + i, y, i % 9 === 2 || i % 9 === 3 ? CHROME.light : CHROME.mid);
}

/** Бампер в два ряда: светлый верх, тёмный низ. */
function bumper(fr, x, y, w) {
  chromeLine(fr, x, y, w);
  fr.rect(x, y + 1, w, 1, CHROME.dark);
}

/**
 * Стекло цветов pal в прямоугольнике (inside уточняет форму): у нижнего края темнее,
 * блики — диагонали «/» на расстояниях streaks от левого верхнего угла, у верхнего края искрятся.
 */
function glass(fr, pal, x0, y0, w, h, streaks, inside = () => true) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!inside(x, y)) continue;
      let c = y === y0 + h - 1 ? pal.dark : pal.base;
      if (y < y0 + h - 1 && streaks.includes(x - x0 + y - y0)) c = y === y0 ? pal.sparkle : pal.light;
      fr.set(x, y, c);
    }
}

/** Проём окна машины произвольной формы: край — хромированная рамка, внутри — тёмное стекло. */
function framedWindow(fr, x0, y0, w, h, inside, streaks) {
  const inner = (x, y) => inside(x, y) && inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1);
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!inside(x, y) || inner(x, y)) continue;
      fr.set(x, y, y === y0 + h - 1 ? CHROME.light : y === y0 ? CHROME.mid : CHROME.dark);
    }
  glass(fr, CAR_GLASS, x0 + 1, y0 + 1, w - 2, h - 2, streaks, inner);
}

/** Ржавчина: неровное пятно — тёмная сердцевина, рыжий край, крошки вокруг. Ложится только на colors. */
function rust(fr, cx, cy, rx, ry, rand, colors) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!colors.includes(fr.get(x, y))) continue;
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (rand() - 0.5) * 0.8;
      if (d < 0.35) fr.set(x, y, RUST.dark);
      else if (d < 1) fr.set(x, y, RUST.light);
      else if (d < 2 && rand() < 0.18) fr.set(x, y, RUST.light);
    }
}

/** Выгоревшие пятна: неровные вытянутые островки цвета color поверх цвета base. */
function fadePatches(fr, x0, y0, w, h, count, rand, base, color) {
  for (let i = 0; i < count; i++) {
    const cx = x0 + rand() * w;
    const cy = y0 + rand() * h;
    const r = 0.8 + rand() * 1.4;
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r * 2); x <= cx + r * 2; x++) {
        const d = ((x + 0.5 - cx) / (r * 2)) ** 2 + ((y + 0.5 - cy) / r) ** 2;
        if (d < 1 - rand() * 0.5 && fr.get(x, y) === base) fr.set(x, y, color);
      }
  }
}

/** Лаковый блик: полоса «/» шириной width со светлой линией внутри, только поверх цвета base. */
function glossBand(fr, p, x0, y0, w, h, offset, width, base = p.paint) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const d = x - x0 + y - y0 - offset;
      if (d < 0 || d >= width || fr.get(x, y) !== base) continue;
      fr.set(x, y, d === 1 ? p.light : p.mid);
    }
}

// ---------------------------------------------------------------- машина: кузов

/** Колёсная арка с центром на нижнем краю: светлый изгиб крыла, кромка, тёмная ниша. */
function wheelArch(fr, cx, p) {
  fr.ellipse(cx, 10, 7.5, 7.5, (nx, ny) => (ny < -0.35 ? p.mid : null));
  fr.ellipse(cx, 10, 6.5, 6.5, p.shade);
  fr.ellipse(cx, 10, 5.5, 5.5, (nx, ny) => (ny < -0.72 ? RUBBER.dark : RUBBER.base));
}

/** Щель двери: тёмная линия и светлая кромка следующей панели. */
function doorSeam(fr, x, p) {
  fr.set(x, 0, p.shade);
  fr.rect(x, 1, 1, 8, p.deep);
  tint(fr, x + 1, 4, 1, 4, p.paint, p.mid);
}

/** Дверная ручка: хромированная планка и тень под ней. */
function doorHandle(fr, x, y, p) {
  fr.grid(x, y, ['lmd', 'sss'], { l: CHROME.light, m: CHROME.mid, d: CHROME.dark, s: p.shade });
}

/** Борт кузова 64×10 (лист 64×20): двери, молдинг, арки колёс, бамперы, фонарь и фара на углах. */
export function carBodySide() {
  return carSheet(64, 10, 1, (fr, p, _col, rand) => {
    stripes(fr, 0, 0, 64, [p.light, p.mid, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint, p.shade, p.deep]);
    for (const cx of [12, 52]) wheelArch(fr, cx, p);
    chromeLine(fr, 3, 3, 58);
    for (const x of [24, 40]) {
      doorSeam(fr, x, p);
      doorHandle(fr, x + 2, 1, p);
    }
    // лючок бензобака на заднем крыле
    fr.grid(5, 1, ['lm', 'md'], { l: CHROME.light, m: CHROME.mid, d: CHROME.dark });
    // бамперы, задний фонарь, фара и поворотник заходят на борт
    bumper(fr, 0, 7, 2);
    bumper(fr, 62, 7, 2);
    fr.grid(0, 2, ['ddd', 'Lrd', 'rrd', 'ddd'], { d: CHROME.dark, L: TAILLIGHT.light, r: TAILLIGHT.red });
    fr.grid(61, 2, ['dwg', 'dgg', 'dgs'], { d: CHROME.dark, w: C.white, g: LAMP.light, s: LAMP.base });
    fr.rect(62, 6, 2, 1, C.orange);
    if (p.old) {
      // ржавчина у арок, у низа дверей и на пороге
      const body = [p.light, p.mid, p.paint, p.shade, p.deep];
      const spots = [[5, 9.3, 2, 1.3], [19.2, 8.6, 1.4, 1.6], [45.8, 9.2, 1.2, 1.2], [58.8, 8.6, 1.8, 1.6]];
      spots.push([24.5, 8.5, 1.3, 1], [40.5, 8.8, 1.1, 0.9], [31, 9.4, 2, 0.8]);
      for (const [x, y, rx, ry] of spots) rust(fr, x, y, rx, ry, rand, body);
      fadePatches(fr, 3, 1, 58, 1.5, 7, rand, p.mid, p.light);
      fadePatches(fr, 3, 4, 58, 3, 5, rand, p.paint, p.mid);
      // молдинг кое-где отвалился
      fr.rect(33, 3, 2, 1, p.shade);
      fr.set(49, 3, p.shade);
    } else {
      for (const x of [7, 29, 47]) fr.rect(x, 1, 3, 1, p.light);
      fr.set(8, 1, C.white);
    }
  });
}

/** Кузов сверху 64×26 (лист 64×52): слева багажник с замком, справа капот с ребром, между ними — под кабиной. */
export function carBodyTop() {
  return carSheet(64, 26, 1, (fr, p, _col, rand) => {
    fr.rect(0, 0, 64, 26, p.shade);
    fr.rect(1, 1, 62, 24, p.paint);
    fr.rect(1, 1, 62, 1, p.light);
    // капот: дальняя половина к свету светлее, ребро посередине, щели по контуру
    fr.rect(45, 4, 18, 8, p.mid);
    fr.rect(45, 12, 18, 1, p.light);
    fr.rect(45, 13, 18, 1, p.shade);
    fr.rect(44, 3, 1, 20, p.deep);
    fr.rect(44, 3, 19, 1, p.deep);
    fr.rect(44, 22, 19, 1, p.deep);
    // багажник со светлой кромкой и замком
    fr.rect(14, 3, 1, 20, p.deep);
    fr.rect(1, 3, 13, 1, p.deep);
    fr.rect(1, 22, 13, 1, p.deep);
    fr.rect(1, 4, 13, 1, p.mid);
    fr.grid(2, 12, ['lm', 'dk'], { l: CHROME.light, m: CHROME.mid, d: CHROME.dark, k: C.ink });
    if (p.old) {
      fadePatches(fr, 46, 5, 16, 6, 5, rand, p.mid, p.light);
      fadePatches(fr, 46, 14, 16, 7, 4, rand, p.paint, p.mid);
      fadePatches(fr, 2, 6, 11, 14, 4, rand, p.paint, p.mid);
      const body = [p.light, p.mid, p.paint, p.shade, p.deep];
      const spots = [[2, 2.5, 1.6, 1.2], [62, 21.5, 1.3, 1.6], [61.5, 4.5, 1, 1], [16, 24, 1.8, 1], [8, 22.6, 1.2, 0.9]];
      for (const [x, y, rx, ry] of spots) rust(fr, x, y, rx, ry, rand, body);
    } else {
      glossBand(fr, p, 45, 4, 18, 18, 4, 3, p.mid);
      glossBand(fr, p, 45, 4, 18, 18, 17, 3);
      glossBand(fr, p, 1, 4, 13, 18, 9, 3);
    }
  });
}

/** Круглая фара 5×5 в хромированном ободке: светлое стекло с бликом. */
function roundHeadlight(fr, x, y) {
  fr.grid(x, y, ['.mmm.', 'mwlld', 'mllsd', 'mlssd', '.ddd.'], {
    m: CHROME.mid,
    d: CHROME.dark,
    l: LAMP.light,
    w: C.white,
    s: LAMP.base,
  });
}

/** Номерной знак: белая табличка с парой тёмных точек вместо букв. */
function plate(fr, x, y, w) {
  stripes(fr, x, y, w, [C.white, C.white, '#c3c7d6']);
  fr.rect(x + Math.floor(w / 2) - 1, y + 1, 2, 1, C.shadow);
}

/** Торцы кузова 26×10 (лист 52×20): колонка 0 — перёд, колонка 1 — зад. */
export function carBodyEnd() {
  return carSheet(26, 10, 2, (fr, p, col, rand) => {
    stripes(fr, 0, 0, 26, [p.light, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint, p.shade, p.deep]);
    if (col === 0) carFront(fr, p);
    else carBack(fr, p);
    if (p.old) {
      const body = [p.paint, p.shade, p.deep];
      for (const [x, y, rx, ry] of [[2, 6.5, 1.4, 1], [24, 6.5, 1.2, 1], [7, 9, 1.5, 0.8], [19, 9.2, 1.2, 0.8]])
        rust(fr, x, y, rx, ry, rand, body);
    }
  });
}

/** Перёд: тёмная решётка с хромированными планками, круглые фары, поворотники, бампер, номер. */
function carFront(fr, p) {
  fr.rect(1, 1, 24, 5, RUBBER.base);
  chromeLine(fr, 7, 2, 12);
  chromeLine(fr, 7, 4, 12);
  fr.rect(6, 1, 1, 5, CHROME.mid);
  fr.rect(19, 1, 1, 5, CHROME.dark);
  roundHeadlight(fr, 1, 1);
  roundHeadlight(fr, 20, 1);
  fr.rect(1, 6, 3, 1, C.orange);
  fr.rect(22, 6, 3, 1, C.orange);
  bumper(fr, 0, 7, 26);
  fr.rect(9, 7, 1, 2, RUBBER.base);
  fr.rect(16, 7, 1, 2, RUBBER.base);
  plate(fr, 10, 6, 6);
}

/** Зад: крышка багажника, фонари (красный, поворотник, задний ход), номер с подсветкой, бампер. */
function carBack(fr, p) {
  fr.rect(1, 1, 24, 1, p.deep);
  for (const [x, flip] of [[1, false], [18, true]]) {
    fr.rect(x, 2, 7, 4, CHROME.dark);
    fr.grid(x + 1, 3, ['LRRAW', 'rrrAW'], { L: TAILLIGHT.light, R: TAILLIGHT.red, r: TAILLIGHT.dark, A: C.orange, W: C.white }, flip);
  }
  fr.rect(12, 2, 2, 1, CHROME.mid);
  plate(fr, 9, 3, 8);
  bumper(fr, 0, 7, 26);
}

// ---------------------------------------------------------------- машина: кабина

/** Кабина сбоку 34×9 (лист 34×18): два окна в хромированных рамках, стойки в цвет кузова. */
export function carCabinSide() {
  return carSheet(34, 9, 1, (fr, p, _col, rand) => {
    stripes(fr, 0, 0, 34, [p.light, p.mid, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint]);
    // заднее окно скошено по стойке C, переднее — по стойке A
    const rear = (x, y) => y >= 1 && y <= 7 && x <= 15 && x >= 2 + Math.ceil((7 - y) * 0.6);
    const front = (x, y) => y >= 1 && y <= 7 && x >= 18 && x <= 31 - Math.ceil((7 - y) * 0.6);
    framedWindow(fr, 0, 1, 16, 7, rear, [4, 5, 9]);
    framedWindow(fr, 18, 1, 16, 7, front, [3, 4, 8]);
    // подголовники сидений за стёклами: заднего — у стойки C, переднего — у стойки B
    for (const x of [7, 20]) {
      tint(fr, x, 4, 2, 2, CAR_GLASS.base, CAR_GLASS.dark);
      tint(fr, x + 1, 3, 1, 1, CAR_GLASS.base, CAR_GLASS.dark);
    }
    if (p.old) fadePatches(fr, 0, 0.5, 34, 1, 3, rand, p.light, p.mid);
  });
}

/** Крыша 34×23 (лист 34×46): водостоки по краям, дальняя половина к свету светлее. */
export function carCabinTop() {
  return carSheet(34, 23, 1, (fr, p, _col, rand) => {
    fr.rect(0, 0, 34, 23, p.shade);
    fr.rect(1, 1, 32, 21, p.paint);
    stripes(fr, 1, 1, 32, [p.light, p.shade, p.mid]);
    fr.rect(1, 20, 32, 1, p.shade);
    roundRect(fr, 2, 4, 30, 7, p.mid);
    if (p.old) {
      roundRect(fr, 4, 5, 14, 3, p.light);
      fadePatches(fr, 3, 11, 28, 7, 6, rand, p.paint, p.mid);
      fadePatches(fr, 3, 5, 28, 5, 4, rand, p.mid, p.light);
      const body = [p.light, p.mid, p.paint, p.shade];
      for (const [x, y, rx, ry] of [[31.5, 2.5, 1.4, 1.2], [31.5, 20, 1.2, 1.3], [2, 20.5, 1.3, 1]]) rust(fr, x, y, rx, ry, rand, body);
    } else {
      glossBand(fr, p, 2, 4, 30, 16, 8, 3, p.mid);
      glossBand(fr, p, 2, 4, 30, 16, 16, 4);
      glossBand(fr, p, 2, 4, 30, 16, 22, 2);
    }
  });
}

/** Торцы кабины 23×9 (лист 46×18): колонка 0 — лобовое стекло, колонка 1 — заднее. */
export function carCabinEnd() {
  return carSheet(23, 9, 2, (fr, p, col, rand) => {
    stripes(fr, 0, 0, 23, [p.light, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint, p.paint, p.shade]);
    const opening = (x, y) => x >= 2 && x <= 20 && y >= 1 && y <= 7;
    framedWindow(fr, 2, 1, 19, 7, opening, col === 0 ? [2, 3, 8, 13, 14] : [4, 5, 11]);
    // за стеклом: подголовники, спереди ещё и зеркало заднего вида
    for (const x of [5, 15]) tint(fr, x, 4, 3, 2, CAR_GLASS.base, CAR_GLASS.dark);
    if (col === 0) fr.rect(10, 2, 3, 1, CAR_GLASS.dark);
    if (p.old) rust(fr, col === 0 ? 20.5 : 2, 8.4, 1.4, 0.8, rand, [p.paint, p.shade]);
  });
}

// ---------------------------------------------------------------- колёса машины

/** Протектор 32×4, стыкуется по горизонтали: тёмная резина с поперечными канавками. */
export function tire() {
  return single(32, 4, (fr) => {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 32; x++) {
        const shoulder = y === 0 || y === 3;
        let c = RUBBER.base;
        if (shoulder && x % 4 === 2) c = RUBBER.dark;
        if (!shoulder && x % 4 === 0) c = RUBBER.dark;
        if (y === 0 && x % 4 === 1) c = RUBBER.light;
        fr.set(x, y, c);
      }
  });
}

/** Колесо машины сбоку 16×16: резина, стальной обод, выпуклый хромированный колпак. Вне круга прозрачно. */
export function hubCar() {
  return single(16, 16, (fr) => {
    fr.ellipse(8, 8, 8, 8, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      const lit = nx + ny;
      if (r > 0.66) return r > 0.92 ? RUBBER.dark : lit < -0.7 ? RUBBER.light : RUBBER.base;
      if (r > 0.55) return lit < -0.5 ? CHROME.mid : CHROME.dark;
      if (r < 0.16) return C.shadow;
      return lit < -0.3 ? CHROME.light : lit > 0.35 ? CHROME.dark : CHROME.mid;
    });
  });
}

// ---------------------------------------------------------------- трактор

const TRACTOR = { light: '#e0685c', paint: '#c8453a', shade: '#a4332c', deep: '#7a2622' };
const DRIVER = { cap: '#44698c', head: '#8fb3cc', body: '#6a98ba' };
/** Белая краска: полоса на капоте и крыша кабины. */
const WHITE = { base: C.white, shade: '#c3c7d6', edge: C.silver };
/** Жёлтый диск колеса трактора. */
const RIM = { base: C.yellow, shade: C.goldDark, bolt: '#8a5a2a' };

/** Капот сбоку 36×10: красный, белая полоса, три прорези у переднего края и круглая эмблема. */
export function tractorHoodSide() {
  return single(36, 10, (fr) => {
    const t = TRACTOR;
    stripes(fr, 0, 0, 36, [t.light, t.paint, t.paint, t.paint, WHITE.base, WHITE.shade, t.paint, t.paint, t.shade, t.deep]);
    fr.rect(0, 1, 1, 8, t.shade);
    fr.rect(35, 1, 1, 8, t.shade);
    for (const x of [25, 28, 31]) {
      fr.rect(x, 6, 2, 2, RUBBER.base);
      fr.rect(x, 6, 2, 1, RUBBER.dark);
      fr.rect(x, 8, 2, 1, t.light);
    }
    fr.grid(19, 3, ['.mm.', 'mlyd', 'myyd', '.dd.'], { m: CHROME.mid, d: CHROME.dark, l: C.white, y: C.yellow });
  });
}

/** Капот сверху 36×13: шов посередине, светлая полоса, передний край темнее. */
export function tractorHoodTop() {
  return single(36, 13, (fr) => {
    const t = TRACTOR;
    stripes(fr, 0, 0, 36, [t.shade, t.light, t.light, t.paint, t.paint, t.paint, t.deep, t.light, t.paint, t.paint, t.paint, t.paint, t.shade]);
    fr.rect(0, 0, 1, 13, t.shade);
    fr.rect(34, 0, 1, 13, t.shade);
    fr.rect(35, 0, 1, 13, t.deep);
    fr.grid(3, 9, ['lm', 'md'], { l: CHROME.light, m: CHROME.mid, d: CHROME.dark });
  });
}

/** Решётка трактора 13×10: тёмная, с хромированными планками, круглые фары в верхних углах. */
export function tractorGrille() {
  return single(13, 10, (fr) => {
    const t = TRACTOR;
    stripes(fr, 0, 0, 13, [t.light, t.paint, t.paint, t.paint, t.paint, t.paint, t.paint, t.paint, t.paint, t.deep]);
    fr.rect(12, 1, 1, 8, t.shade);
    fr.rect(2, 5, 9, 4, RUBBER.base);
    chromeLine(fr, 3, 6, 7);
    chromeLine(fr, 3, 8, 7);
    const lamp = { m: CHROME.mid, d: CHROME.dark, l: LAMP.light, s: LAMP.base, w: C.white };
    for (const x of [1, 8]) fr.grid(x, 1, ['.mm.', 'mwld', 'mlsd', '.dd.'], lamp);
  });
}

/** Рисование «за стеклом»: пиксели ложатся только на стекло, рамка и панель не задеваются. */
function behindGlass(fr) {
  const behind = Object.create(fr);
  behind.set = (x, y, color) => {
    if (Object.values(CAB_GLASS).includes(fr.get(Math.round(x), Math.round(y)))) fr.set(x, y, color);
  };
  return behind;
}

/** Силуэт тракториста: кепка с козырьком, голова, плечи. Сбоку смотрит вправо (вперёд). */
const DRIVER_SIDE = [
  '....cccc...',
  '...ccccccc.',
  '....hhhh...',
  '....hhhhh..',
  '....hhhh...',
  '.....hh....',
  '..bbbbbbb..',
  '.bbbbbbbbbb',
  '.bbbbbbbbbb',
  '.bbbbbbbbb.',
];
const DRIVER_FRONT = [
  '..ccccc..',
  '.ccccccc.',
  '..hhhhh..',
  '..hhhhh..',
  '..hhhhh..',
  '...hhh...',
  '.bbbbbbb.',
  'bbbbbbbbb',
  'bbbbbbbbb',
  'bbbbbbbbb',
];

/** Тракторист за стеклом кабины: рисуется только по стеклу. */
function driver(fr, x, y, rows) {
  behindGlass(fr).grid(x, y, rows, { c: DRIVER.cap, h: DRIVER.head, b: DRIVER.body });
}

/** Кабина: чёрная рамка окна (сверху и слева светлее) и красная панель снизу. */
function tractorCab(fr, w) {
  const t = TRACTOR;
  fr.rect(0, 0, w, 14, RUBBER.base);
  fr.rect(0, 0, w, 1, RUBBER.light);
  fr.rect(0, 0, 1, 14, RUBBER.light);
  stripes(fr, 0, 14, w, [t.light, t.paint, t.paint, t.paint, t.shade, t.deep]);
}

/** Блики поверх всего, что за стеклом: диагонали streaks. */
function reflections(fr, x0, y0, w, h, streaks) {
  glass(fr, CAB_GLASS, x0, y0, w, h - 1, streaks, (x, y) => streaks.includes(x - x0 + y - y0));
}

/** Кабина трактора сбоку 21×20: большое окно в чёрной рамке, водитель, красная панель с ручкой. */
export function tractorCabinSide() {
  return single(21, 20, (fr) => {
    tractorCab(fr, 21);
    glass(fr, CAB_GLASS, 2, 2, 17, 11, []);
    driver(fr, 5, 3, DRIVER_SIDE);
    // руль перед водителем
    behindGlass(fr).line(15, 9, 17, 7, RUBBER.base);
    reflections(fr, 2, 2, 17, 11, [3, 4, 18, 19]);
    fr.rect(3, 15, 1, 4, TRACTOR.shade);
    fr.grid(15, 16, ['lmd'], { l: CHROME.light, m: CHROME.mid, d: CHROME.dark });
  });
}

/** Кабина трактора спереди 19×20: лобовое стекло с дворником в чёрной рамке, красная панель. */
export function tractorCabinFront() {
  return single(19, 20, (fr) => {
    tractorCab(fr, 19);
    glass(fr, CAB_GLASS, 2, 2, 15, 11, []);
    driver(fr, 5, 3, DRIVER_FRONT);
    reflections(fr, 2, 2, 15, 11, [2, 3, 16, 17]);
    fr.line(3, 12, 8, 9, RUBBER.base);
  });
}

/** Крыша кабины 21×19: белая, с тёмной кромкой, рёбрами жёсткости и оранжевой мигалкой посередине. */
export function tractorRoof() {
  return single(21, 19, (fr) => {
    fr.rect(0, 0, 21, 19, WHITE.edge);
    fr.rect(1, 1, 19, 17, WHITE.base);
    fr.rect(1, 17, 19, 1, WHITE.shade);
    fr.rect(19, 1, 1, 17, WHITE.shade);
    for (const y of [4, 14]) fr.rect(2, y, 16, 1, WHITE.shade);
    // мигалка на тёмном основании, тень вправо-вниз
    fr.rect(9, 8, 4, 4, WHITE.shade);
    fr.grid(8, 7, ['.kk.', 'kyok', 'kook', '.kk.'], { k: RUBBER.light, y: C.yellow, o: C.orange });
  });
}

/** Протектор трактора 32×8, стыкуется по горизонтали: крупные грунтозацепы ёлочкой. */
export function tractorTire() {
  return single(32, 8, (fr) => {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 32; x++) {
        const k = Math.abs(y - 3.5) - 0.5;
        const u = (((x + k * 2) % 8) + 8) % 8;
        let c = RUBBER.dark;
        if (u < 4) c = u < 2 ? RUBBER.light : RUBBER.base;
        fr.set(x, y, c);
      }
  });
}

/** Колесо трактора сбоку 24×24: толстая шина с зацепами, жёлтый диск с болтами. Вне круга прозрачно. */
export function hubTractor() {
  return single(24, 24, (fr) => {
    fr.ellipse(12, 12, 12, 12, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      const lit = nx + ny;
      if (r > 0.92) return Math.cos(Math.atan2(ny, nx) * 12) > 0 ? RUBBER.base : null;
      if (r > 0.58) return lit < -0.8 ? RUBBER.light : r < 0.64 ? RUBBER.dark : RUBBER.base;
      if (r < 0.2) return r < 0.1 && lit < 0 ? RUBBER.light : RUBBER.base;
      if (r < 0.27 || r > 0.52) return RIM.shade;
      return lit > 0.5 ? RIM.shade : RIM.base;
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      fr.set(Math.floor(12 + Math.cos(a) * 4.6), Math.floor(12 + Math.sin(a) * 4.6), RIM.bolt);
    }
  });
}

// ---------------------------------------------------------------- портал у концов ковровой дорожки

const MAGIC = { plum: '#5d275d', purple: '#8e5bd6', lilac: '#c7a1f0', cyan: '#73eff7', white: C.white };
const STONE = { light: '#b7c9d6', base: C.silver, alt: '#8aa3b6', dark: C.slate, mortar: C.shadow };

/** Руны 3×3 для кольца площадки. */
const RUNES = [
  ['x.x', '.x.', 'x.x'],
  ['xxx', '.x.', '.x.'],
  ['.x.', 'xxx', '.x.'],
  ['x..', 'xxx', '..x'],
  ['xx.', '.x.', '.xx'],
  ['x.x', 'xxx', 'x.x'],
  ['.xx', 'x..', '.xx'],
  ['xxx', 'x.x', 'x..'],
];

/** Номер камня кольца под пикселем площадки: -1 — шов, -2 — не кольцо. */
function padStone(x, y, blocks) {
  const dx = x + 0.5 - 32;
  const dy = y + 0.5 - 32;
  const r = Math.hypot(dx, dy);
  if (r > 32 || r < 26) return -2;
  if (r < 27) return -1;
  const t = ((Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1) * blocks;
  if ((t % 1) * ((2 * Math.PI * r) / blocks) < 1) return -1;
  return Math.floor(t);
}

/** Каменная площадка портала 64×64 сверху: кольцо камней, светящиеся руны, тёмный центр. Вне круга прозрачно. */
export function portalPad() {
  return single(64, 64, (fr) => {
    const rand = rng(64);
    const blocks = 24;
    const tones = Array.from({ length: blocks }, () => (rand() < 0.5 ? STONE.base : STONE.alt));
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const id = padStone(x, y, blocks);
        if (id === -2) continue;
        if (id === -1) {
          fr.set(x, y, STONE.mortar);
          continue;
        }
        // скос камня: к свету светлее, от света темнее
        const lit = padStone(x - 1, y, blocks) !== id || padStone(x, y - 1, blocks) !== id;
        const dark = padStone(x + 1, y, blocks) !== id || padStone(x, y + 1, blocks) !== id;
        fr.set(x, y, lit ? STONE.light : dark ? STONE.dark : tones[id]);
      }
    // трещины на нескольких камнях
    for (const [x, y, dx, dy] of [[9, 20, 2, 1], [50, 12, -1, 2], [44, 55, 2, -1], [5, 40, 1, 2]]) fr.line(x, y, x + dx, y + dy, STONE.dark);
    // полоса рун между двумя светящимися кругами и тёмный центр
    fr.ellipse(32, 32, 26, 26, (nx, ny) => (Math.hypot(nx, ny) > 0.955 ? MAGIC.plum : STONE.mortar));
    fr.ellipse(32, 32, 20.5, 20.5, (nx, ny) => (Math.hypot(nx, ny) > 0.95 ? MAGIC.purple : C.navy));
    fr.ellipse(32, 32, 17, 17, (nx, ny) => (Math.hypot(nx, ny) > 0.94 ? '#232d5c' : C.navy));
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.26;
      const x = Math.round(32 + Math.cos(a) * 23.2 - 1.5);
      const y = Math.round(32 + Math.sin(a) * 23.2 - 1.5);
      const rune = RUNES[i % RUNES.length];
      // ореол вокруг знака, потом сам знак
      rune.forEach((row, ry) => [...row].forEach((ch, rx) => {
        if (ch !== 'x') return;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
          if (fr.get(x + rx + ox, y + ry + oy) === STONE.mortar) fr.set(x + rx + ox, y + ry + oy, MAGIC.purple);
      }));
      fr.grid(x, y, rune, { x: MAGIC.lilac });
      if (i % 3 === 0) fr.set(x + 1, y + 1, MAGIC.white);
    }
  });
}

/** Воронка портала 48×48: ровный круг, три закрученных рукава, яркая середина. Вне круга прозрачно. */
export function portalSwirl() {
  return single(48, 48, (fr) => {
    const ramp = [MAGIC.plum, MAGIC.purple, MAGIC.lilac, MAGIC.cyan, MAGIC.white];
    fr.ellipse(24, 24, 24, 24, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r > 0.94) return MAGIC.plum;
      if (r < 0.08) return MAGIC.white;
      const arm = Math.sin(Math.atan2(ny, nx) * 3 + Math.log(r) * 4.5);
      const v = (1 - r) * 3.2 + arm * 1.4 + 0.9;
      return ramp[Math.max(0, Math.min(4, Math.floor(v)))];
    });
  });
}

const LACQUER = { light: '#d05a70', base: C.red, shade: '#8f2f45', grain: '#a33a4f' };
const GOLD = { light: '#fff0a8', base: C.gold, dark: C.goldDark };

/** Золотой поясок на столбе: блик слева, тень справа и снизу, над и под ним тёмные канавки. */
function goldBand(fr, y) {
  fr.rect(0, y - 1, 8, 1, LACQUER.shade);
  fr.rect(0, y + 3, 8, 1, LACQUER.shade);
  stripes(fr, 0, y, 8, [GOLD.base, GOLD.base, GOLD.dark]);
  fr.rect(1, y, 1, 2, GOLD.light);
  fr.rect(6, y, 2, 2, GOLD.dark);
}

/** Столб ворот 8×48: красный лак с продольными волокнами и три золотых пояска. */
export function gatePost() {
  return single(8, 48, (fr) => {
    const rand = rng(48);
    // округлый столб: светлая полоса слева, тень справа
    const columns = [LACQUER.base, LACQUER.light, LACQUER.light, LACQUER.base, LACQUER.base, LACQUER.base, LACQUER.shade, LACQUER.shade];
    columns.forEach((c, x) => fr.rect(x, 0, 1, 48, c));
    // волокна дерева под лаком
    for (let i = 0; i < 16; i++) {
      const x = 3 + Math.floor(rand() * 3);
      fr.rect(x, Math.floor(rand() * 46), 1, 3 + Math.floor(rand() * 4), LACQUER.grain);
    }
    for (const y of [0, 27, 42]) goldBand(fr, y);
  });
}

/** Перекладина ворот 48×8: красный лак, золотые концы и тонкая золотая линия посередине. */
export function gateBeam() {
  return single(48, 8, (fr) => {
    const rand = rng(8);
    stripes(fr, 0, 0, 48, [LACQUER.light, LACQUER.base, LACQUER.base, GOLD.base, GOLD.dark, LACQUER.base, LACQUER.shade, LACQUER.shade]);
    for (let i = 0; i < 8; i++) fr.rect(5 + Math.floor(rand() * 34), [1, 2, 5][i % 3], 3 + Math.floor(rand() * 4), 1, LACQUER.grain);
    for (const x of [0, 44]) {
      fr.rect(x, 0, 4, 8, GOLD.base);
      fr.rect(x, 0, 4, 1, GOLD.light);
      fr.rect(x, 6, 4, 2, GOLD.dark);
      fr.rect(x === 0 ? 4 : 43, 0, 1, 8, LACQUER.shade);
    }
  });
}

/** Вывеска 32×10: светлые доски в тёмной рамке, пустая — надпись добавится поверх. */
export function gateSign() {
  return single(32, 10, (fr) => {
    const rand = rng(32);
    stripes(fr, 0, 0, 32, [C.bark, '#d6a576', '#c79466', '#c79466', C.barkLight, '#d6a576', '#c79466', '#c79466', C.barkLight, C.bark]);
    fr.rect(0, 0, 1, 10, C.bark);
    fr.rect(31, 0, 1, 10, C.bark);
    // волокна и гвозди по краям досок
    for (let i = 0; i < 8; i++) fr.rect(2 + Math.floor(rand() * 26), [2, 3, 6, 7][i % 4], 2 + Math.floor(rand() * 3), 1, '#b98758');
    for (const [x, y] of [[2, 2], [29, 2], [2, 6], [29, 6]]) fr.set(x, y, C.barkDark);
  });
}
