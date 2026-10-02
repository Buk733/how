// Банное хозяйство: печь-каменка (грани модели), камни, труба, огонь в дверце, мягкие клубы пара и дыма,
// мелочи на стене бани. Грани — по 16 пикселей на единицу мира, как ворота порталов.
import { C, sheet, rng } from './lib.mjs';

const BRICK = { light: '#d98a6c', base: '#c0654f', dark: '#99463d', deep: '#7a3433', mortar: '#d8c2a2', mortarShade: '#b59f84' };
const IRON = { light: '#6b6478', base: '#4a4456', dark: '#2b2733', deep: '#1a1c2c', rivet: '#94b0c2' };

function single(w, h, draw) {
  const s = sheet(w, h, 1);
  draw(s.frame(0));
  return s.img;
}

/**
 * Кирпичная кладка: кирпичи 8×4 (с швом), ряды вразбежку. Верхний край кирпича светлее, нижний темнее,
 * тон кирпичей чуть гуляет — кладка не выглядит плиткой.
 */
function bricks(fr, x0, y0, w, h, seed) {
  const rand = rng(seed);
  const tones = [BRICK.base, BRICK.base, BRICK.light, BRICK.dark];
  for (let row = 0; row * 4 < h; row++) {
    const offset = row % 2 ? 4 : 0;
    for (let col = -1; col * 8 < w + 8; col++) {
      const bx = col * 8 + offset;
      const tone = tones[Math.floor(rand() * tones.length)];
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 8; x++) {
          const px = bx + x;
          const py = row * 4 + y;
          if (px < 0 || px >= w || py >= h) continue;
          let c = tone;
          if (y === 3 || x === 7) c = y === 3 && x === 0 ? BRICK.mortarShade : BRICK.mortar;
          else if (y === 0 && x < 6) c = tone === BRICK.dark ? BRICK.base : BRICK.light;
          else if (y === 2 && x > 1) c = tone === BRICK.light ? BRICK.base : BRICK.dark;
          fr.set(x0 + px, y0 + py, c);
        }
    }
  }
}

/** Бок печи 24×16: кирпичная кладка, снизу тёмный цоколь. */
export function stoveBrick() {
  return single(24, 16, (fr) => {
    bricks(fr, 0, 0, 24, 15, 31);
    fr.rect(0, 15, 24, 1, BRICK.deep);
  });
}

/**
 * Перед печи 24×16, 3 кадра: кирпич, чугунная дверца со стеклом, за стеклом пляшет огонь,
 * под дверцей — поддувало. Кадры отличаются только огнём: игра листает их, и огонь живёт.
 */
export function stoveDoor() {
  const frames = 3;
  const s = sheet(24, 16, frames);
  for (let i = 0; i < frames; i++) {
    const fr = s.frame(i);
    bricks(fr, 0, 0, 24, 15, 31);
    fr.rect(0, 15, 24, 1, BRICK.deep);
    // рама дверцы с заклёпками
    fr.rect(6, 2, 12, 10, IRON.dark);
    fr.rect(6, 2, 12, 1, IRON.light);
    fr.rect(6, 2, 1, 10, IRON.base);
    fr.rect(17, 2, 1, 10, IRON.deep);
    fr.rect(6, 11, 12, 1, IRON.deep);
    for (const [x, y] of [[7, 3], [16, 3], [7, 10], [16, 10]]) fr.set(x, y, IRON.rivet);
    // ручка справа
    fr.rect(18, 6, 2, 1, IRON.light);
    fr.rect(19, 5, 1, 3, IRON.base);
    // окошко с огнём
    fire(fr, 9, 4, 6, 6, 70 + i * 13);
    // поддувало: тёмная щель с угольками
    fr.rect(8, 12, 8, 2, IRON.dark);
    fr.rect(9, 13, 6, 1, IRON.deep);
    fr.set(10 + (i % 3), 13, C.orange);
    fr.set(13 - (i % 2), 13, '#b13e53');
  }
  return s.img;
}

/** Огонь в окошке w×h: у углей светлее, к верху — оранжевый и красный, над языками — тёмная топка. */
function fire(fr, x0, y0, w, h, seed) {
  const rand = rng(seed);
  const tones = ['#fff0a8', C.yellow, C.orange, '#b13e53'];
  for (let x = 0; x < w; x++) {
    const height = 2 + Math.floor(rand() * (h - 1));
    for (let y = 0; y < h; y++) {
      const fromBottom = h - 1 - y;
      let c = '#3b1d2e';
      if (fromBottom < height) c = tones[Math.min(tones.length - 1, Math.floor((fromBottom / height) * tones.length))];
      fr.set(x0 + x, y0 + y, c);
    }
  }
  // угли внизу
  for (let x = 0; x < w; x += 2) fr.set(x0 + x + (seed % 2), y0 + h - 1, '#fff0a8');
}

/** Верх печи 26×26: чугунная кромка, внутри — уложенные камни (их видно сверху вокруг горки). */
export function stoveTop() {
  return single(26, 26, (fr) => {
    fr.rect(0, 0, 26, 26, IRON.base);
    fr.rect(0, 0, 26, 1, IRON.light);
    fr.rect(0, 0, 1, 26, IRON.light);
    fr.rect(0, 25, 26, 1, IRON.deep);
    fr.rect(25, 0, 1, 26, IRON.deep);
    fr.rect(2, 2, 22, 22, C.ink);
    const rand = rng(19);
    const tones = [
      ['#d3e0ea', '#94b0c2', '#566c86'],
      ['#c2d2e0', '#7f97ad', '#465a72'],
      ['#e6ddd2', '#a89c92', '#6e6560'],
    ];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        const cx = 4.4 + x * 4.3 + (y % 2 ? 1.2 : -0.4) + rand() * 0.6;
        const cy = 4.4 + y * 4.3 + rand() * 0.6;
        if (cx > 22.5) continue;
        const [light, base, shade] = tones[Math.floor(rand() * tones.length)];
        fr.ellipse(cx, cy, 2.1, 1.9, (nx, ny) => (nx + ny < -0.6 ? light : nx + ny > 0.6 ? shade : base));
      }
  });
}

/** Круглый камень с тёмной каёмкой: блик слева сверху, тень справа снизу; раскалённый — с алым отсветом. */
function pebble(fr, cx, cy, rx, ry, tone, hot = false) {
  fr.ellipse(cx, cy, rx + 0.8, ry + 0.8, C.ink);
  const [light, base, shade] = hot ? ['#f0a070', '#a8564f', '#6e3036'] : tone;
  fr.ellipse(cx, cy, rx, ry, (nx, ny) => {
    if (nx + ny < -0.7 && nx * nx + ny * ny > 0.15) return light;
    if (nx + ny > 0.6) return shade;
    return base;
  });
  if (hot) fr.set(Math.round(cx + rx * 0.2), Math.round(cy + ry * 0.3), C.orange);
}

/**
 * Каменка 26×16: горка обкатанных камней на печи, пара нижних раскалена.
 * Билборд: стоит на чугунной плите и всегда смотрит в камеру.
 */
export function stoveStones() {
  const s = sheet(26, 16, 1);
  const fr = s.frame(0);
  const grey = ['#d3e0ea', '#94b0c2', '#566c86'];
  const blue = ['#c2d2e0', '#7f97ad', '#465a72'];
  const warm = ['#e6ddd2', '#a89c92', '#6e6560'];
  // от дальних (верхних) к ближним: ближние перекрывают дальние
  const stones = [
    [13, 4, 3, 2.4, grey],
    [9, 6, 3, 2.3, warm],
    [17, 6, 3.2, 2.4, blue],
    [5, 9, 2.8, 2.2, blue],
    [13, 8, 3.4, 2.6, warm],
    [21, 9, 2.8, 2.2, grey],
    [9, 11, 3.2, 2.3, grey],
    [17, 11, 3.2, 2.4, blue, true],
    [3, 13, 2.4, 1.7, warm],
    [13, 13, 3.2, 1.8, grey, true],
    [22, 13, 2.6, 1.7, warm],
  ];
  for (const [cx, cy, rx, ry, tone, hot] of stones) pebble(fr, cx, cy, rx, ry, tone, hot);
  return s.img;
}

/** Труба 6×21: чёрный металл с бликом и стыками колен. */
export function stovePipe() {
  return single(6, 21, (fr) => {
    const columns = [IRON.base, IRON.light, IRON.base, IRON.base, IRON.dark, IRON.deep];
    columns.forEach((c, x) => fr.rect(x, 0, 1, 21, c));
    for (const y of [0, 7, 14]) {
      fr.rect(0, y, 6, 1, IRON.light);
      fr.rect(0, y + 1, 6, 1, IRON.deep);
    }
  });
}

/** Кирпичная труба на крыше 12×16. */
export function chimneyBrick() {
  return single(12, 16, (fr) => {
    bricks(fr, 0, 0, 12, 16, 57);
    // оголовок: выступающий ряд сверху
    fr.rect(0, 0, 12, 1, BRICK.light);
    fr.rect(0, 3, 12, 1, BRICK.deep);
  });
}

/** Верх кирпичной трубы 12×12: закопчённое отверстие в кирпичной кромке. */
export function chimneyTop() {
  return single(12, 12, (fr) => {
    fr.rect(0, 0, 12, 12, BRICK.base);
    fr.rect(0, 0, 12, 1, BRICK.light);
    fr.rect(0, 0, 1, 12, BRICK.light);
    fr.rect(3, 3, 6, 6, IRON.deep);
    fr.rect(4, 4, 4, 4, '#0e0f18');
    fr.rect(3, 3, 6, 1, IRON.dark);
  });
}

/**
 * Мягкий клуб пара или дыма 16×16, 4 кадра — разные формы. Сам клуб белый с голубоватой тенью:
 * игра красит его цветом материала (пар — белый, дым — серый) и плавно растворяет.
 */
export function puff() {
  const shapes = [
    [[8, 9, 5.5], [5, 7, 3.8], [11, 6, 3.6], [8, 5, 3.2]],
    [[7, 9, 5.2], [11, 9, 4.2], [8, 5, 3.8], [4, 8, 3]],
    [[8, 8, 6], [5, 5, 3], [12, 6, 3.2]],
    [[6, 8, 4.4], [10, 8, 4.6], [8, 5, 4], [8, 11, 4]],
  ];
  const s = sheet(16, 16, shapes.length);
  shapes.forEach((circles, i) => {
    const fr = s.frame(i);
    // сначала тень всего силуэта, сверху — освещённая часть, сдвинутая к свету
    for (const [cx, cy, r] of circles) fr.ellipse(cx, cy, r, r, '#c9d4e3');
    for (const [cx, cy, r] of circles) fr.ellipse(cx - 0.6, cy - 0.8, r - 0.9, r - 0.9, '#eef2f7');
    for (const [cx, cy, r] of circles) fr.ellipse(cx - 1.4, cy - 1.6, r - 2.4, r - 2.4, '#ffffff');
  });
  return s.img;
}

/**
 * Мелочи на стене бани 16×16, 4 кадра: пара веников, войлочная шапка, полотенце, градусник.
 * Висят на внутренней стороне задней стены.
 */
export function wallDecor() {
  const s = sheet(16, 16, 4);
  // веники: связки берёзовых веток с листьями, перевязанные у ручки
  const brooms = s.frame(0);
  const leaves = rng(77);
  for (const x of [1, 9]) {
    brooms.rect(x + 2, 0, 2, 1, C.barkDark);
    brooms.rect(x + 2, 1, 2, 4, C.barkLight);
    brooms.rect(x + 2, 3, 2, 1, C.red);
    brooms.ellipse(x + 3, 10.5, 3.2, 5.2, (nx, ny) => {
      const roll = leaves();
      if (roll < 0.18) return C.teal;
      if (roll < 0.42 || nx + ny < -0.8) return C.lime;
      return C.green;
    });
  }
  brooms.outline();
  // войлочная банная шапка с отворотом
  const hat = s.frame(1);
  hat.ellipse(8, 9, 6, 5, (nx, ny) => (nx + ny < -0.6 ? '#f2e3c8' : ny > 0.5 ? '#c4a882' : '#e2cfaa'));
  hat.rect(2, 11, 12, 3, '#c4a882');
  hat.rect(2, 11, 12, 1, '#f2e3c8');
  hat.rect(7, 3, 2, 2, C.red);
  hat.outline();
  // полотенце на крючке: полоски
  const towel = s.frame(2);
  towel.rect(7, 0, 2, 2, IRON.base);
  towel.rect(3, 2, 10, 13, C.white);
  for (const y of [5, 11]) towel.rect(3, y, 10, 1, C.red);
  towel.rect(12, 2, 1, 13, C.silver);
  towel.rect(3, 14, 10, 1, C.silver);
  towel.outline();
  // деревянный градусник: дощечка со шкалой и красным столбиком
  const thermo = s.frame(3);
  thermo.rect(5, 1, 6, 14, '#e0b98a');
  thermo.rect(5, 1, 6, 1, '#f0d2a8');
  thermo.rect(7, 3, 2, 10, C.white);
  thermo.rect(7, 7, 2, 6, C.red);
  thermo.ellipse(8, 13, 1.6, 1.6, C.red);
  for (const y of [4, 6, 8, 10]) thermo.set(10, y, C.barkDark);
  thermo.outline();
  return s.img;
}

/** Деревянная кадка с ковшом 16×16 — стоит у печи. */
export function tub() {
  return single(16, 16, (fr) => {
    for (let y = 6; y <= 15; y++) {
      const half = 6 - (y - 6) * 0.12;
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 8;
        if (Math.abs(dx) > half) continue;
        const stave = Math.floor((dx + 8) / 2.2) % 2;
        fr.set(x, y, y === 8 || y === 13 ? IRON.base : dx > half - 1.5 ? C.bark : stave ? C.barkLight : '#c28d5f');
      }
    }
    fr.ellipse(8, 6.5, 6, 1.8, (nx, ny) => (ny < -0.2 ? C.sky : C.cyan));
    // ковш на длинной ручке
    fr.line(9, 6, 14, 0, C.barkLight);
    fr.line(10, 6, 15, 0, C.bark);
    fr.ellipse(8, 6, 2, 1.2, C.barkLight);
    fr.outline();
  });
}

/** Кровля из дранки 32×21 — плитка вдоль конька: ряды дощечек вразбежку, снизу у каждого ряда тень. */
export function roofShingles() {
  return single(32, 21, (fr) => {
    const rand = rng(91);
    const tones = ['#9b6b4f', '#8a5a44', '#a87a58', '#93664a'];
    for (let row = 0; row < 4; row++) {
      const y0 = row * 5 + 1;
      let x = row % 2 ? -3 : 0;
      while (x < 32) {
        const w = 4 + Math.floor(rand() * 3);
        const tone = tones[Math.floor(rand() * tones.length)];
        for (let xx = x; xx < x + w; xx++) {
          const px = (xx + 32) % 32;
          fr.rect(px, y0, 1, 4, tone);
          fr.set(px, y0, xx === x ? '#5a3a38' : '#c28d5f');
          fr.set(px, y0 + 4, '#5a3a38');
        }
        fr.rect((x + 32) % 32, y0, 1, 5, '#5a3a38');
        x += w;
      }
    }
    fr.rect(0, 0, 32, 1, '#6e4638');
  });
}

/** Резной наличник под коньком 16×6 — плитка: доска с полукружиями и дырочками, низ прорезной. */
export function roofTrim() {
  return single(16, 6, (fr) => {
    fr.rect(0, 0, 16, 1, '#5a3a38');
    fr.rect(0, 1, 16, 2, '#e8c890');
    fr.rect(0, 1, 16, 1, '#f4dcaa');
    for (const cx of [4, 12]) {
      fr.ellipse(cx, 3, 3.5, 3, (nx, ny) => (ny > 0.55 ? '#a8784f' : '#e8c890'));
      fr.set(cx, 3, '#5a3a38');
    }
  });
}
