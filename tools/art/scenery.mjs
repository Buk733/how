// Декор мира v0.5: лес, поляны, пасхалки, животные, постройки.
import { C, sheet, rng } from './lib.mjs';

// ---------------------------------------------------------------- деревья

/** Листва по освещённости: светлая, средняя, тень. */
const LEAVES = {
  green: [C.lime, C.green, C.teal],
  orange: ['#ffd08a', '#ef9a4f', '#b8573c'],
  yellow: ['#fff0a8', '#ffcd75', '#c98a1a'],
  dark: ['#4fbf6c', '#2a8a57', '#1d5a55'],
};

/** Круглое дерево 32×40: 4 кадра — зелёное, осеннее оранжевое, осеннее жёлтое, тёмное. */
export function trees() {
  const s = sheet(32, 40, 4);
  ['green', 'orange', 'yellow', 'dark'].forEach((tone, i) => {
    const fr = s.frame(i);
    const rand = rng(7 + i * 13);
    const [light, mid, shade] = LEAVES[tone];
    for (let y = 22; y <= 38; y++)
      for (let x = 13; x <= 18; x++) fr.set(x, y, x === 13 ? C.barkLight : x >= 17 ? C.barkDark : C.bark);
    const blobs = [[16, 12, 10.5], [8.5, 18, 7], [23.5, 18, 7], [16, 21, 8.5], [11, 9, 6], [21, 9, 6]].map(([x, y, r]) => [
      x + (rand() - 0.5) * 2,
      y + (rand() - 0.5) * 2,
      r,
    ]);
    const inside = (x, y) => blobs.some(([bx, by, r]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= r * r);
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 32; x++) {
        if (!inside(x, y)) continue;
        let l = -(((x - 16) / 14) * 0.55 + ((y - 15) / 14) * 0.85) + (rand() - 0.5) * 0.35;
        if (!inside(x, y + 2)) l -= 0.35;
        fr.set(x, y, l > 0.42 ? light : l < -0.3 ? shade : mid);
      }
    fr.outline();
  });
  return s.img;
}

/** Ель 24×40: 2 кадра — обычная и тёмная (глубже в лесу). */
export function pines() {
  const s = sheet(24, 40, 2);
  const tones = [
    [C.green, C.teal, C.navy],
    ['#2a8a57', '#1d5a55', '#1e2a52'],
  ];
  tones.forEach(([light, mid, dark], i) => {
    const fr = s.frame(i);
    const rand = rng(11 + i);
    for (let y = 30; y <= 38; y++) for (let x = 10; x <= 13; x++) fr.set(x, y, x >= 12 ? C.barkDark : C.bark);
    for (const t of [{ top: 1, bottom: 13, half: 6 }, { top: 7, bottom: 22, half: 8.5 }, { top: 14, bottom: 31, half: 10.5 }])
      for (let y = t.top; y <= t.bottom; y++) {
        const half = 0.8 + ((y - t.top) / (t.bottom - t.top)) * t.half;
        for (let x = 0; x < 24; x++) {
          const dx = x + 0.5 - 12;
          if (Math.abs(dx) > half) continue;
          const n = (rand() - 0.5) * 0.4;
          let c = mid;
          if (dx / half + n < -0.35) c = light;
          if (dx / half + n > 0.45 || y >= t.bottom - 1) c = dark;
          fr.set(x, y, c);
        }
      }
    fr.outline();
  });
  return s.img;
}

/** Берёза 24×44: белый ствол с чёрными чёрточками, лёгкая крона. 2 кадра — летняя и осенняя. */
export function birches() {
  const s = sheet(24, 44, 2);
  [LEAVES.green, LEAVES.yellow].forEach(([light, mid, shade], i) => {
    const fr = s.frame(i);
    const rand = rng(31 + i);
    // ствол: белый, справа тень, чёрные полоски
    for (let y = 12; y <= 43; y++) {
      fr.set(11, y, C.white);
      fr.set(12, y, y > 20 ? '#c3c7d6' : C.white);
    }
    for (let y = 14; y <= 42; y += 3 + Math.floor(rand() * 3)) {
      const left = rand() < 0.5;
      fr.set(left ? 11 : 12, y, C.black);
      if (rand() < 0.5) fr.set(left ? 10 : 13, y, C.black);
    }
    // тонкие ветки
    fr.line(12, 22, 17, 17, C.blackLight);
    fr.line(11, 25, 6, 20, C.blackLight);
    // крона — несколько лёгких облачков, сквозь просветы виден ствол
    const blobs = [[12, 9, 7.5, 8.5], [6.5, 17, 5, 5.5], [17.5, 16, 5, 5.5], [12, 20, 5, 3.5], [8, 7, 4, 4], [16.5, 7, 4, 4]];
    for (let y = 0; y < 26; y++)
      for (let x = 0; x < 24; x++) {
        const hit = blobs.some(([bx, by, rx, ry]) => ((x + 0.5 - bx) / rx) ** 2 + ((y + 0.5 - by) / ry) ** 2 <= 1);
        if (!hit) continue;
        const l = -((x - 12) / 12) * 0.5 - ((y - 12) / 12) * 0.8 + (rand() - 0.5) * 0.5;
        fr.set(x, y, l > 0.35 ? light : l < -0.35 ? shade : mid);
      }
    fr.outline();
  });
  return s.img;
}

/** Куст 16×12: 3 кадра — с ягодами, простой, в цвету. */
export function bushes() {
  const s = sheet(16, 12, 3);
  for (let i = 0; i < 3; i++) {
    const fr = s.frame(i);
    const rand = rng(5 + i * 7);
    const blobs = [[5, 7.5, 3.8], [11, 7.5, 3.8], [8, 5.5, 4.2]];
    for (let y = 0; y <= 10; y++)
      for (let x = 0; x < 16; x++) {
        if (!blobs.some(([bx, by, r]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= r * r)) continue;
        const l = -((x - 8) / 8) * 0.5 - ((y - 6) / 6) * 0.9 + (rand() - 0.5) * 0.4;
        fr.set(x, y, l > 0.5 ? C.lime : l < -0.35 || y === 10 ? C.teal : C.green);
      }
    if (i === 0) for (const [x, y] of [[5, 6], [10, 5], [12, 8]]) fr.set(x, y, C.red);
    if (i === 2) for (const [x, y] of [[4, 5], [8, 3], [11, 6], [6, 8]]) fr.set(x, y, C.pink);
    fr.outline();
  }
  return s.img;
}

// ---------------------------------------------------------------- лесные мелочи

/** Пень 16×14: 2 кадра — просто пень и пень с топором. */
export function stumps() {
  const s = sheet(16, 14, 2);
  for (let i = 0; i < 2; i++) {
    const fr = s.frame(i);
    // корни
    fr.rect(2, 11, 3, 2, C.bark);
    fr.rect(11, 11, 3, 2, C.barkDark);
    // бока
    for (let y = 6; y <= 12; y++) for (let x = 4; x <= 11; x++) fr.set(x, y, x <= 5 ? C.barkLight : x >= 10 ? C.barkDark : C.bark);
    // срез с кольцами
    fr.ellipse(8, 6, 4.5, 2.2, (nx, ny) => {
      const r = Math.hypot(nx, ny);
      return r > 0.8 ? C.barkLight : r > 0.5 ? '#e0b98a' : r > 0.25 ? '#c79466' : '#e0b98a';
    });
    if (i === 1) {
      // топор: топорище наискось, лезвие воткнуто в срез
      fr.line(9, 1, 13, 5, C.barkLight);
      fr.line(10, 1, 14, 5, C.bark);
      fr.rect(6, 4, 4, 3, C.silver);
      fr.set(6, 4, C.white);
      fr.set(7, 4, C.white);
    }
    fr.outline();
  }
  return s.img;
}

/** Бревно 24×10, лежит поперёк. */
export function log() {
  const s = sheet(24, 10, 1);
  const fr = s.frame(0);
  for (let y = 2; y <= 8; y++)
    for (let x = 3; x <= 21; x++) fr.set(x, y, y <= 3 ? C.barkLight : y >= 7 ? C.barkDark : C.bark);
  for (let x = 6; x <= 19; x += 4) fr.set(x, 5, C.barkDark);
  fr.ellipse(3, 5, 2.2, 3.5, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? C.barkLight : '#e0b98a'));
  fr.set(3, 5, C.bark);
  // мох
  fr.rect(12, 2, 4, 1, C.green);
  fr.set(13, 1, C.lime);
  fr.outline();
  return s.img;
}

/** Камни 16×10: 3 кадра — маленький, большой, во мху. */
export function rocks() {
  const s = sheet(16, 10, 3);
  const shapes = [
    [8, 7, 4.5, 3],
    [8, 6, 7, 4],
    [8, 6, 6.5, 4],
  ];
  shapes.forEach(([cx, cy, rx, ry], i) => {
    const fr = s.frame(i);
    fr.ellipse(cx, cy, rx, ry, (nx, ny) => (nx + ny < -0.6 ? '#b7c9d6' : nx + ny > 0.5 ? C.slate : C.silver));
    if (i === 1) fr.line(6, 4, 9, 7, C.slate);
    if (i === 2) {
      for (let x = 3; x <= 12; x++) fr.set(x, 2 + (x % 3 === 0 ? 1 : 0), x % 2 ? C.green : C.lime);
      fr.set(5, 3, C.green);
      fr.set(10, 3, C.teal);
    }
    fr.outline();
  });
  return s.img;
}

/** Грибы 8×8: 3 кадра — мухомор, белый, кучка опят. */
export function mushrooms() {
  const s = sheet(8, 8, 3);
  const amanita = s.frame(0);
  amanita.rect(3, 4, 2, 3, C.white);
  amanita.ellipse(4, 3, 3.5, 2.2, (nx, ny) => (ny > 0.4 ? '#8f2f45' : C.red));
  amanita.set(2, 2, C.white);
  amanita.set(5, 1, C.white);
  amanita.set(4, 3, C.white);
  amanita.outline();
  const boletus = s.frame(1);
  boletus.rect(3, 4, 2, 3, '#e8dcc0');
  boletus.ellipse(4, 3, 3.5, 2.2, (nx) => (nx < -0.3 ? '#b07a55' : '#8a5a44'));
  boletus.outline();
  const honey = s.frame(2);
  for (const [x, h] of [[2, 3], [4, 4], [6, 2]]) {
    honey.rect(x, 7 - h, 1, h, '#f0dca8');
    honey.rect(x - 1, 6 - h, 3, 1, '#d99a4f');
  }
  honey.outline();
  return s.img;
}

/** Цветы 8×8: 5 кадров — ромашка, одуванчик, василёк, колокольчик, клевер. */
export function flowers() {
  const s = sheet(8, 8, 5);
  const kinds = [
    { petal: C.white, core: C.yellow },
    { petal: C.yellow, core: '#f7c531' },
    { petal: C.sky, core: C.blue },
    { petal: '#b98be8', core: '#7e57c2' },
    { petal: C.pink, core: C.pinkDark },
  ];
  kinds.forEach(({ petal, core }, i) => {
    const fr = s.frame(i);
    const heads = [[2, 3], [5, 2], [4, 5]];
    // стебли и листок
    for (const [x, y] of heads) fr.line(x, y + 1, x, 7, C.green);
    fr.set(3, 6, C.lime);
    for (const [x, y] of heads) {
      fr.set(x, y, core);
      fr.set(x - 1, y, petal);
      fr.set(x + 1, y, petal);
      fr.set(x, y - 1, petal);
    }
  });
  return s.img;
}

/** Высокая трава 10×7: 3 кадра разных оттенков. */
export function grassTufts() {
  const s = sheet(10, 7, 3);
  const tones = [
    [C.lime, C.green],
    [C.green, C.teal],
    ['#d7e37a', '#a7b85a'],
  ];
  tones.forEach(([light, dark], i) => {
    const fr = s.frame(i);
    const blades = [[1, 3], [3, 1], [5, 0], [7, 2], [9, 4], [4, 3]];
    for (const [x, top] of blades) fr.line(x, 6, x + (x < 5 ? -1 : 1) * (top < 2 ? 1 : 0), top, x % 2 ? light : dark);
  });
  return s.img;
}

/** Папоротник 16×10 и камыш 16×10 — два кадра. */
export function ferns() {
  const s = sheet(16, 10, 2);
  const fern = s.frame(0);
  for (const [x0, dir] of [[8, -1], [8, 1], [8, -0.4], [8, 0.4]]) {
    for (let t = 0; t <= 7; t++) {
      const x = x0 + dir * t;
      const y = 9 - t * (Math.abs(dir) < 1 ? 1.1 : 0.7);
      fern.set(x, y, t > 4 ? C.lime : C.green);
      if (t % 2 === 0) fern.set(x, y - 1, C.green);
    }
  }
  fern.outline();
  // камыш: тонкие листья без обводки и два бархатистых початка
  const reeds = s.frame(1);
  for (const [x, top, lean] of [[3, 4, -1], [5, 2, 0], [8, 3, 1], [10, 1, 0], [13, 4, 1], [6, 5, -1]]) {
    reeds.line(x, 9, x + lean, top, x % 2 ? C.green : C.teal);
  }
  for (const [x, y] of [[5, 1], [10, 0]]) {
    reeds.rect(x, y + 1, 2, 3, '#7a4a2a');
    reeds.set(x, y + 1, '#9a6a3a');
    reeds.set(x + 1, y + 4, C.barkDark);
    reeds.set(x, y, C.green);
  }
  return s.img;
}

// ---------------------------------------------------------------- пасхалки

/** Брёвна сруба: горизонтальные полосы по 4 px с тёмными стыками и торцами на углах. */
function logWall(fr, x0, y0, w, h, ends = true) {
  const band = ['#6e4638', '#a06a4c', '#b07a55', '#8a5a44'];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) fr.set(x, y, band[(y - y0) % 4]);
  if (!ends) return;
  for (let y = y0 + 1; y < y0 + h; y += 4) {
    for (const x of [x0 - 1, x0 + w]) {
      fr.set(x, y, '#e0b98a');
      fr.set(x, y + 1, '#c79466');
    }
  }
}

/**
 * Избушка на курьих ножках 40×52: 4 кадра — задом (стоит, шагнула) и передом (стоит, шагнула).
 * Передом видны окошко с наличником и дверь.
 */
export function hut() {
  const s = sheet(40, 52, 4);
  for (let i = 0; i < 4; i++) {
    const fr = s.frame(i);
    const front = i >= 2;
    const step = i % 2 === 1;
    const lift = step ? 1 : 0;
    // курьи ножки: пёрышки под избой, чешуйчатые голени, три пальца и шпора
    const legs = [
      { x: 13, bend: step ? -2 : 0, up: step ? 2 : 0 },
      { x: 26, bend: step ? 1 : 0, up: 0 },
    ];
    for (const leg of legs) {
      fr.ellipse(leg.x, 37 - lift, 4, 2.5, (nx) => (nx > 0.3 ? '#8a5a44' : '#b07a55'));
      for (let y = 39 - lift; y <= 48 - leg.up; y++) {
        const x = leg.x + (y > 43 ? leg.bend : 0);
        fr.set(x, y, '#e8a33d');
        fr.set(x + 1, y, y % 2 ? '#c98a1a' : '#b8732a');
      }
      const fy = 49 - leg.up;
      const fx = leg.x + leg.bend;
      fr.line(fx - 3, fy + 1, fx, fy, '#c98a1a');
      fr.line(fx + 1, fy, fx + 4, fy + 1, '#c98a1a');
      fr.line(fx, fy, fx + 1, fy + 2, '#c98a1a');
      fr.set(fx - 2, fy, '#b8732a');
    }
    // сруб
    const top = 16 - lift;
    logWall(fr, 6, top, 28, 20);
    // крыша: двускатная, тёмные доски, мох
    for (let y = 3 - lift; y <= top + 1; y++) {
      const t = (y - (3 - lift)) / (top + 1 - (3 - lift));
      const half = 3 + t * 16;
      for (let x = Math.round(20 - half); x <= Math.round(19 + half); x++) {
        const edge = x <= 20 - half + 1 || x >= 19 + half - 1 || y === top + 1;
        fr.set(x, y, edge ? '#4a3030' : (x + y) % 5 === 0 ? '#5a3a38' : '#7a5238');
      }
    }
    for (const [x, y] of [[12, 12], [13, 12], [24, 9], [25, 10], [27, 12], [17, 7]]) fr.set(x, y - lift, C.green);
    // труба
    fr.rect(27, 4 - lift, 3, 5, '#94b0c2');
    fr.rect(27, 4 - lift, 3, 1, '#566c86');
    if (front) {
      // окошко с резным наличником и ставнями
      fr.rect(10, top + 4, 9, 8, C.white);
      fr.rect(11, top + 5, 7, 6, '#41a6f6');
      fr.rect(14, top + 5, 1, 6, C.white);
      fr.rect(11, top + 8, 7, 1, C.white);
      fr.set(12, top + 6, '#b7e0f5');
      fr.rect(8, top + 4, 2, 8, C.sky);
      fr.rect(19, top + 4, 2, 8, C.sky);
      fr.set(14, top + 3, C.white);
      fr.set(13, top + 3, C.white);
      fr.set(15, top + 3, C.white);
      // дверь
      fr.rect(24, top + 5, 7, 15, '#5a3a38');
      fr.rect(25, top + 6, 5, 13, '#8a5a44');
      fr.set(29, top + 12, C.yellow);
    } else {
      // сзади: веник на гвоздике
      fr.line(24, top + 6, 24, top + 10, C.bark);
      fr.ellipse(24, top + 12, 2, 3, (nx, ny) => (nx + ny > 0.3 ? C.teal : C.green));
    }
    fr.outline();
  }
  return s.img;
}

/** Медведь в ушанке с балалайкой 28×28: 3 кадра — сидит, бренчит (вверх), бренчит (вниз). */
export function bear() {
  const s = sheet(28, 28, 3);
  const fur = '#8a5a44';
  const light = '#b07a55';
  const dark = '#5a3a38';
  for (let i = 0; i < 3; i++) {
    const fr = s.frame(i);
    const bob = i === 2 ? 1 : 0;
    // пень под медведем
    fr.rect(8, 24, 12, 4, C.barkDark);
    fr.rect(8, 24, 12, 1, '#c79466');
    // туловище и лапы
    fr.ellipse(14, 19 + bob, 8, 7, (nx) => (nx < -0.5 ? light : nx > 0.6 ? dark : fur));
    fr.ellipse(14, 20 + bob, 4.5, 4, '#d9b38c');
    fr.ellipse(8, 25, 3, 2, dark);
    fr.ellipse(20, 25, 3, 2, dark);
    // голова
    const hy = 8 + bob;
    fr.ellipse(14, hy + 1, 6.5, 5.5, (nx, ny) => (nx < -0.4 && ny < 0.2 ? light : fur));
    fr.ellipse(14, hy + 3, 3, 2, '#d9b38c');
    fr.set(14, hy + 2, C.ink);
    fr.set(13, hy + 2, C.ink);
    fr.set(11, hy, C.ink);
    fr.set(17, hy, C.ink);
    fr.set(13, hy + 4, dark);
    fr.set(15, hy + 4, dark);
    // ушанка: мех по краю, уши-клапаны
    fr.rect(7, hy - 5, 14, 3, C.slate);
    fr.rect(8, hy - 7, 12, 2, C.silver);
    fr.rect(7, hy - 3, 14, 1, '#b7c9d6');
    fr.rect(6, hy - 3, 2, 5, C.silver);
    fr.rect(20, hy - 3, 2, 5, C.silver);
    fr.set(14, hy - 6, C.red);
    // балалайка: треугольный корпус и гриф
    for (let y = 0; y < 7; y++) for (let x = 0; x <= y; x++) fr.set(15 + x, 16 + y + bob, x === y || y === 6 ? '#c98a4a' : '#e8a35a');
    fr.set(17, 20 + bob, C.ink);
    fr.line(15, 16 + bob, 9, 10 + bob, dark);
    fr.rect(8, 9 + bob, 2, 2, C.ink);
    // правая лапа бренчит
    const paw = i === 0 ? 20 : i === 1 ? 17 : 21;
    fr.ellipse(22, paw + bob, 2, 2, fur);
    fr.ellipse(9, 12 + bob, 2, 2, fur);
    fr.outline();
  }
  return s.img;
}

/** Костёр 16×16: 3 кадра пламени. */
export function campfire() {
  const s = sheet(16, 16, 3);
  const flames = [
    [[8, 4, 3.5, 6.5], [5, 8, 2, 3.5], [11, 7, 2, 4]],
    [[8, 5, 3, 6], [5, 7, 2, 4.5], [11, 8, 2, 3]],
    [[8, 4.5, 3.5, 6], [5, 9, 2, 3], [11, 6.5, 2, 4.5]],
  ];
  flames.forEach((tongues, i) => {
    const fr = s.frame(i);
    for (const [x, y] of [[2, 14], [5, 15], [10, 15], [13, 14]]) fr.rect(x, y, 2, 1, C.slate);
    fr.line(3, 13, 12, 11, C.bark);
    fr.line(3, 11, 12, 13, C.barkDark);
    for (const [cx, cy, rx, ry] of tongues) {
      fr.ellipse(cx, cy + ry / 2, rx, ry, (nx, ny) => (Math.hypot(nx, ny * 0.8) < 0.45 ? C.white : ny < -0.3 ? C.red : ny < 0.3 ? C.orange : C.yellow));
    }
    fr.outline(C.plum);
  });
  return s.img;
}

/** Ветряная мельница 48×64: 4 кадра — крылья повёрнуты на 0°, 22,5°, 45° и 67,5°. */
export function windmill() {
  const s = sheet(48, 64, 4);
  for (let i = 0; i < 4; i++) {
    const fr = s.frame(i);
    // башня: трапеция из досок
    for (let y = 26; y <= 63; y++) {
      const half = 6 + ((y - 26) / 37) * 4;
      for (let x = Math.round(24 - half); x <= Math.round(23 + half); x++) {
        const shade = x > 23 + half - 3 ? '#8a5a44' : x < 24 - half + 2 ? '#e0b98a' : '#c79466';
        fr.set(x, y, (x + Math.floor(y / 6)) % 4 === 0 ? '#b07a55' : shade);
      }
    }
    fr.rect(21, 54, 6, 10, '#5a3a38');
    fr.rect(22, 55, 4, 9, '#8a5a44');
    fr.rect(22, 38, 4, 4, '#41a6f6');
    // шапка
    for (let y = 17; y <= 27; y++) {
      const half = 3 + ((y - 17) / 10) * 5;
      for (let x = Math.round(24 - half); x <= Math.round(23 + half); x++) fr.set(x, y, x > 25 ? '#8f2f45' : C.red);
    }
    // крылья: решётчатые полотна вокруг оси
    const angle = (i * Math.PI) / 8;
    for (let k = 0; k < 4; k++) {
      const a = angle + (k * Math.PI) / 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      for (let t = 2; t <= 22; t += 0.5) {
        for (let w = 0; w <= 5; w += 0.5) {
          const x = 24 + ux * t - uy * w;
          const y = 22 + uy * t + ux * w;
          const frame = t < 4 || w === 0 || w === 5 || Math.abs(t % 4) < 0.5;
          fr.set(x, y, frame ? '#8a5a44' : '#e8dcc0');
        }
      }
    }
    fr.ellipse(24, 22, 2, 2, C.barkDark);
    fr.outline();
  }
  return s.img;
}

/** Колодец 24×28: сруб, столбы, крыша, ворот и ведро на верёвке. */
export function well() {
  const s = sheet(24, 28, 1);
  const fr = s.frame(0);
  logWall(fr, 4, 17, 16, 10);
  fr.rect(5, 7, 2, 11, C.bark);
  fr.rect(17, 7, 2, 11, C.barkDark);
  for (let y = 1; y <= 7; y++) {
    const half = 3 + (y - 1) * 1.6;
    for (let x = Math.round(12 - half); x <= Math.round(11 + half); x++) fr.set(x, y, y === 7 ? '#4a3030' : (x + y) % 4 ? '#7a5238' : '#5a3a38');
  }
  fr.rect(6, 9, 12, 2, C.barkLight);
  fr.line(19, 10, 22, 12, C.silver);
  fr.rect(22, 12, 1, 3, C.barkDark);
  fr.line(12, 11, 12, 13, '#d9c08a');
  fr.rect(10, 13, 5, 4, C.silver);
  fr.rect(10, 13, 5, 1, '#b7c9d6');
  fr.rect(11, 14, 3, 1, C.sky);
  fr.outline();
  return s.img;
}

/** Домик в огороде 18×30: 2 кадра — стоит и дверь трясётся. Дверь с сердечком. */
export function outhouse() {
  const s = sheet(18, 30, 2);
  for (let i = 0; i < 2; i++) {
    const fr = s.frame(i);
    const shift = i;
    for (let y = 7; y <= 29; y++) for (let x = 2; x <= 15; x++) fr.set(x, y, x % 4 === 1 ? '#a06a4c' : x > 12 ? '#8a5a44' : '#c79466');
    for (let y = 2; y <= 7; y++) for (let x = 0; x <= 17; x++) if (y >= 2 + (17 - x) / 5) fr.set(x, y, y === 7 ? '#4a3030' : '#6e4638');
    // дверь: чуть трясётся на втором кадре
    fr.rect(4 + shift, 9, 10, 20, '#b07a55');
    fr.rect(4 + shift, 9, 10, 1, '#8a5a44');
    fr.grid(7 + shift, 11, ['.r.r.', 'rrrrr', '.rrr.', '..r..'], { r: '#5d275d' });
    fr.set(12 + shift, 19, C.yellow);
    if (i === 1) fr.rect(3, 9, 1, 20, C.ink);
    fr.outline();
  }
  return s.img;
}

/** Пугало 20×30: 2 кадра — стоит и покачивается. */
export function scarecrow() {
  const s = sheet(20, 30, 2);
  for (let i = 0; i < 2; i++) {
    const fr = s.frame(i);
    const tilt = i;
    fr.rect(9, 12, 2, 18, C.bark);
    fr.line(2, 14 + tilt, 17, 14 - tilt, C.barkDark);
    // рубаха в клетку
    for (let y = 13; y <= 22; y++)
      for (let x = 5; x <= 14; x++) fr.set(x, y, (x + y) % 3 === 0 ? '#8f2f45' : y % 3 === 0 ? '#e27584' : C.red);
    for (let x = 2; x <= 17; x++) fr.set(x, 15 + (x < 10 ? tilt : -tilt), (x + 1) % 3 ? C.red : '#8f2f45');
    // соломенные руки
    fr.grid(0, 14 + tilt, ['yy', 'y.', 'yy'], { y: C.yellow });
    fr.grid(18, 12 - tilt, ['yy', '.y', 'yy'], { y: C.yellow });
    // голова-мешок с нашитым лицом
    fr.ellipse(10, 9, 4, 4, '#e8dcc0');
    fr.set(8, 8, C.ink);
    fr.set(12, 8, C.ink);
    fr.line(8, 11, 12, 11, C.ink);
    fr.set(7, 10, C.ink);
    // соломенная шляпа
    fr.rect(4, 5, 12, 1, '#d9b04c');
    fr.rect(6, 2, 8, 3, '#e8c060');
    fr.rect(6, 4, 8, 1, C.red);
    fr.outline();
  }
  return s.img;
}

/** Камень на распутье 28×20: валун с высеченными строчками и мхом. */
export function fairyStone() {
  const s = sheet(28, 20, 1);
  const fr = s.frame(0);
  const rand = rng(17);
  fr.ellipse(14, 11, 13, 8.5, (nx, ny) => {
    const l = -(nx * 0.6 + ny * 0.8) + (rand() - 0.5) * 0.2;
    return l > 0.5 ? '#b7c9d6' : l < -0.45 ? C.slate : C.silver;
  });
  // строчки надписи
  for (const [y, from, to] of [[7, 7, 21], [10, 6, 22], [13, 8, 20]]) {
    for (let x = from; x <= to; x++) if ((x * 7 + y) % 5 !== 0) fr.set(x, y, C.shadow);
  }
  for (let x = 6; x <= 20; x++) if (x % 3 !== 1) fr.set(x, 3 + (x % 2), x % 2 ? C.green : C.lime);
  fr.outline();
  return s.img;
}

/** Рыбак на ведре 32×28: 3 кадра — ждёт, клюёт (удочка согнулась), поймал рыбку. */
export function fisherman() {
  const s = sheet(32, 28, 3);
  for (let i = 0; i < 3; i++) {
    const fr = s.frame(i);
    // перевёрнутое ведро
    fr.rect(4, 21, 8, 7, C.silver);
    fr.rect(4, 21, 8, 1, '#b7c9d6');
    fr.rect(4, 25, 8, 1, C.slate);
    // ноги в сапогах
    fr.rect(10, 20, 6, 3, C.navy);
    fr.rect(14, 22, 3, 6, C.navy);
    fr.rect(14, 26, 4, 2, C.black);
    // туловище в жилетке
    fr.rect(5, 11, 8, 10, '#6f7a3a');
    fr.rect(6, 11, 2, 10, '#8a9a4a');
    fr.rect(7, 14, 2, 2, '#4a5226');
    // голова и панама
    fr.ellipse(9, 8, 3.5, 3.5, C.skin);
    fr.set(11, 8, C.ink);
    fr.set(9, 10, C.skinShade);
    fr.rect(4, 4, 11, 2, '#d9c08a');
    fr.rect(6, 2, 7, 2, '#e8d3a0');
    // руки держат удочку
    fr.rect(11, 14, 4, 2, C.skin);
    // удочка и леска
    const tipY = i === 1 ? 7 : i === 2 ? 0 : 3;
    fr.line(13, 15, 29, tipY, C.barkDark);
    if (i === 2) {
      // поймал: рыбка на леске
      fr.line(29, tipY, 29, 9, '#c3d3e6');
      fr.ellipse(29, 12, 1.6, 3, (nx) => (nx > 0.3 ? C.slate : '#c3d3e6'));
      fr.set(28, 15, C.slate);
      fr.set(30, 15, C.slate);
    } else {
      fr.line(29, tipY, 30, 26, '#c3d3e6');
      // поплавок
      fr.set(30, i === 1 ? 27 : 25, C.red);
      fr.set(30, i === 1 ? 26 : 24, C.white);
    }
    fr.outline();
  }
  return s.img;
}

// ---------------------------------------------------------------- животные

/** Утка 12×10: 2 кадра (покачивается на воде); второй ряд — плывёт влево. */
export function duck() {
  const s = sheet(12, 10, 2, 2);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 2; i++) {
      const fr = s.frame(i, row);
      const bob = i;
      fr.ellipse(5, 6 + bob, 4.5, 2.5, (nx, ny) => (ny < -0.3 ? '#c3c7d6' : nx < -0.5 ? '#8a5a44' : C.silver));
      fr.set(1, 5 + bob, C.black);
      fr.ellipse(9, 3 + bob, 2, 2, '#2a8a57');
      fr.set(9, 2 + bob, C.ink);
      fr.rect(10, 3 + bob, 2, 1, C.yellow);
      fr.set(8, 5 + bob, C.white);
      fr.outline();
      // рябь на воде
      fr.rect(1, 9, 3, 1, '#b7e0f5');
      fr.rect(7, 9, 3, 1, '#b7e0f5');
      if (row === 1) fr.mirror();
    }
  return s.img;
}

/** Птица 10×7: 2 кадра — крылья вверх и вниз. */
export function bird() {
  const s = sheet(10, 7, 2);
  s.frame(0).grid(0, 1, ['k........k', '.k......k.', '..k.kk.k..', '...kkkk...'], { k: C.shadow });
  s.frame(1).grid(0, 2, ['....kk....', '..kkkkkk..', '.k......k.', 'k........k'], { k: C.shadow });
  return s.img;
}

/** Бабочка 7×6: 2 кадра (крылья раскрыты и сложены), 3 ряда — белая, жёлтая, голубая. */
export function butterfly() {
  const s = sheet(7, 6, 2, 3);
  const colors = [
    [C.white, '#c3c7d6'],
    [C.yellow, C.orange],
    [C.sky, C.blue],
  ];
  colors.forEach(([wing, spot], row) => {
    s.frame(0, row).grid(0, 0, ['ww.ww', 'wswsw', 'ww.ww', '.w.w.'].map((r) => `.${r}.`), { w: wing, s: spot });
    s.frame(0, row).rect(3, 1, 1, 3, C.ink);
    s.frame(1, row).grid(2, 0, ['w.w', 'wsw', 'w.w'], { w: wing, s: C.ink });
  });
  return s.img;
}

/**
 * Дворняга 20×16: кадры — сидит, бежит (2), лает, спит, испугалась.
 * Ряд 0 — смотрит вправо, ряд 1 — влево. colors: окрас.
 */
export function dog(colors = {}) {
  const pal = { fur: '#c98a4a', light: '#e8b878', dark: '#8a5a34', belly: C.white, collar: C.red, ...colors };
  const s = sheet(20, 16, 6, 2);
  const head = (fr, x, y, { open = false, sad = false, closed = false } = {}) => {
    fr.ellipse(x, y, 3.3, 3, (nx, ny) => (nx < -0.3 && ny < 0 ? pal.light : pal.fur));
    // морда и нос
    fr.rect(x + 2, y, 3, 2, pal.light);
    fr.set(x + 5, y, C.ink);
    if (open) {
      fr.rect(x + 2, y + 2, 3, 1, C.red);
      fr.set(x + 4, y + 2, C.ink);
    }
    // глаз: открытый — чёрная точка с бликом, закрытый — чёрточка
    if (closed) {
      fr.rect(x, y - 1, 2, 1, C.ink);
    } else {
      fr.set(x + 1, y - 1, C.ink);
      fr.set(x + 1, y - 2, C.white);
    }
    // висячее ухо; у испуганной прижато назад
    if (sad) fr.rect(x - 3, y - 1, 3, 2, pal.dark);
    else fr.rect(x - 2, y - 2, 2, 4, pal.dark);
    fr.rect(x - 2, y + 2, 3, 1, pal.collar);
  };
  const frames = [
    // сидит: задние лапы подобраны, передние прямые, голова высоко
    (fr) => {
      fr.ellipse(8, 10, 4.5, 4, (nx) => (nx < -0.4 ? pal.light : pal.fur));
      fr.ellipse(10, 11, 2, 2.5, pal.belly);
      fr.rect(11, 11, 2, 5, pal.fur);
      fr.rect(4, 14, 4, 2, pal.dark);
      fr.line(3, 12, 1, 8, pal.fur);
      head(fr, 12, 5);
    },
    // бежит: ноги врозь
    (fr) => {
      fr.ellipse(9, 9, 6, 3, (nx, ny) => (ny < -0.3 ? pal.light : pal.fur));
      fr.ellipse(10, 10, 3, 1.5, pal.belly);
      fr.line(4, 11, 1, 14, pal.dark);
      fr.line(6, 11, 6, 15, pal.fur);
      fr.line(13, 11, 16, 14, pal.fur);
      fr.line(12, 11, 11, 15, pal.dark);
      fr.line(3, 8, 0, 5, pal.fur);
      head(fr, 15, 6);
    },
    // бежит: ноги собраны
    (fr) => {
      fr.ellipse(9, 8, 6, 3, (nx, ny) => (ny < -0.3 ? pal.light : pal.fur));
      fr.ellipse(10, 9, 3, 1.5, pal.belly);
      fr.line(5, 10, 7, 14, pal.dark);
      fr.line(7, 10, 9, 14, pal.fur);
      fr.line(12, 10, 10, 14, pal.fur);
      fr.line(13, 10, 12, 14, pal.dark);
      fr.line(3, 7, 1, 4, pal.fur);
      head(fr, 15, 5);
    },
    // лает: голова вверх, пасть открыта
    (fr) => {
      fr.ellipse(8, 10, 4.5, 4, (nx) => (nx < -0.4 ? pal.light : pal.fur));
      fr.ellipse(10, 11, 2, 2.5, pal.belly);
      fr.rect(11, 11, 2, 5, pal.fur);
      fr.rect(4, 14, 4, 2, pal.dark);
      fr.line(3, 11, 1, 6, pal.fur);
      head(fr, 13, 4, { open: true });
      fr.set(19, 1, C.white);
      fr.set(18, 0, C.white);
    },
    // спит: лежит, голова на лапах, глаза закрыты, хвост обёрнут
    (fr) => {
      fr.ellipse(8, 12, 6.5, 3, (nx, ny) => (ny < -0.2 ? pal.light : pal.fur));
      fr.rect(12, 14, 5, 1, pal.dark);
      fr.line(2, 14, 7, 15, pal.dark);
      head(fr, 14, 11, { closed: true });
    },
    // испугалась: пригнулась, уши прижаты, хвост поджат
    (fr) => {
      fr.ellipse(9, 11, 6, 3, (nx, ny) => (ny < -0.3 ? pal.light : pal.fur));
      fr.line(5, 13, 5, 15, pal.dark);
      fr.line(12, 13, 12, 15, pal.fur);
      fr.line(4, 12, 7, 14, pal.fur);
      head(fr, 15, 9, { sad: true });
      fr.set(16, 8, C.white);
    },
  ];
  for (let row = 0; row < 2; row++)
    frames.forEach((draw, i) => {
      const fr = s.frame(i, row);
      draw(fr);
      fr.outline();
      if (row === 1) fr.mirror();
    });
  return s.img;
}

// ---------------------------------------------------------------- постройки и мелочи у бань

/** Будка 22×20: доски, двускатная крыша, круглый лаз и миска. */
export function kennel() {
  const s = sheet(22, 20, 1);
  const fr = s.frame(0);
  for (let y = 8; y <= 19; y++) for (let x = 3; x <= 18; x++) fr.set(x, y, x % 4 === 0 ? '#a06a4c' : x > 15 ? '#8a5a44' : '#c79466');
  for (let y = 1; y <= 9; y++) {
    const half = 1 + (y - 1) * 1.25;
    for (let x = Math.round(11 - half); x <= Math.round(10 + half); x++) fr.set(x, y, x > 11 ? '#8f2f45' : C.red);
  }
  fr.ellipse(10.5, 16, 3.5, 4, C.ink);
  fr.rect(7, 16, 8, 4, C.ink);
  fr.ellipse(19, 18, 2.5, 1.2, C.silver);
  fr.outline();
  return s.img;
}

/** Колокольчик на кронштейне 8×12: 3 кадра — висит, качнулся влево, вправо. */
export function bell() {
  const s = sheet(8, 12, 3);
  [0, -1, 1].forEach((swing, i) => {
    const fr = s.frame(i);
    fr.rect(0, 0, 8, 1, C.barkDark);
    fr.set(4, 1, C.silver);
    fr.set(4 + swing, 2, C.silver);
    const cx = 4 + swing;
    fr.ellipse(cx, 6, 2.5, 3, (nx) => (nx < -0.3 ? '#fff0a8' : nx > 0.4 ? C.goldDark : C.gold));
    fr.rect(cx - 3, 8, 6, 1, C.goldDark);
    fr.set(cx, 10, C.barkDark);
    fr.outline();
  });
  return s.img;
}

/** Фонарь на столбе 10×26: 2 кадра — огонёк мерцает. */
export function lantern() {
  const s = sheet(10, 26, 2);
  for (let i = 0; i < 2; i++) {
    const fr = s.frame(i);
    fr.rect(3, 6, 2, 20, C.bark);
    fr.rect(3, 6, 1, 20, C.barkLight);
    fr.rect(3, 4, 6, 2, C.barkDark);
    fr.set(7, 6, C.shadow);
    fr.rect(5, 7, 5, 6, C.shadow);
    fr.rect(6, 8, 3, 4, i ? '#ffe08a' : C.yellow);
    fr.set(7, 9, i ? C.white : '#fff0a8');
    fr.outline();
  }
  return s.img;
}

/** Поленница 24×18: торцы поленьев рядами под навесом. */
export function woodpile() {
  const s = sheet(24, 18, 1);
  const fr = s.frame(0);
  fr.rect(1, 2, 22, 2, '#6e4638');
  fr.rect(2, 4, 1, 14, C.barkDark);
  fr.rect(21, 4, 1, 14, C.barkDark);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 5; col++) {
      const cx = 5 + col * 3.6 + (row % 2) * 1.2;
      const cy = 6.5 + row * 3.2;
      fr.ellipse(cx, cy, 1.8, 1.6, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? '#8a5a44' : '#e0b98a'));
      fr.set(Math.round(cx), Math.round(cy), '#c79466');
    }
  fr.outline();
  return s.img;
}

/** Забор 32×14: штакетник с двумя перекладинами (стыкуется по горизонтали). */
export function fence() {
  const s = sheet(32, 14, 1);
  const fr = s.frame(0);
  fr.rect(0, 5, 32, 2, '#a06a4c');
  fr.rect(0, 10, 32, 2, '#a06a4c');
  for (let x = 1; x < 32; x += 6) {
    fr.rect(x, 2, 4, 12, '#c79466');
    fr.rect(x + 3, 2, 1, 12, '#8a5a44');
    fr.rect(x + 1, 1, 2, 1, '#c79466');
  }
  fr.outline();
  return s.img;
}

/** Автобусная остановка 40×34: мозаика на стене, лавочка, табличка «А». */
export function busStop() {
  const s = sheet(40, 34, 1);
  const fr = s.frame(0);
  for (let y = 7; y <= 27; y++) for (let x = 3; x <= 32; x++) fr.set(x, y, (Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? C.sky : '#257179');
  // мозаика: солнце
  fr.ellipse(17, 14, 4, 4, C.yellow);
  fr.set(17, 8, C.yellow);
  fr.set(11, 14, C.yellow);
  fr.set(23, 14, C.yellow);
  fr.rect(3, 7, 2, 21, C.silver);
  fr.rect(31, 7, 2, 21, C.slate);
  fr.rect(1, 3, 34, 4, C.silver);
  fr.rect(1, 3, 34, 1, C.white);
  fr.rect(6, 22, 24, 2, C.bark);
  fr.rect(7, 24, 1, 4, C.barkDark);
  fr.rect(28, 24, 1, 4, C.barkDark);
  fr.rect(3, 28, 30, 2, C.slate);
  // знак остановки
  fr.rect(36, 6, 1, 28, C.slate);
  fr.rect(33, 0, 7, 7, C.white);
  fr.grid(35, 1, ['.k.', 'k.k', 'kkk', 'k.k', 'k.k'], { k: C.blue });
  fr.outline();
  return s.img;
}

/** Огород 12×10: 3 кадра — капуста, тыква, морковка. */
export function crops() {
  const s = sheet(12, 10, 3);
  const cabbage = s.frame(0);
  cabbage.ellipse(6, 6, 5.5, 3.8, (nx, ny) => (Math.hypot(nx, ny) > 0.75 ? C.green : ny < 0 ? '#d7f0a0' : C.lime));
  cabbage.line(6, 4, 6, 8, C.green);
  cabbage.outline();
  const pumpkin = s.frame(1);
  pumpkin.ellipse(6, 6.5, 5, 3.5, (nx) => (Math.abs(nx) > 0.6 ? '#c9571a' : Math.abs(nx) < 0.15 || Math.abs(Math.abs(nx) - 0.45) < 0.1 ? '#d96a2a' : C.orange));
  pumpkin.rect(6, 1, 1, 3, C.green);
  pumpkin.set(7, 1, C.lime);
  pumpkin.outline();
  const carrot = s.frame(2);
  for (const x of [3, 6, 9]) {
    carrot.line(x, 7, x - 1, 2, C.green);
    carrot.line(x, 7, x + 1, 3, C.lime);
    carrot.rect(x - 1, 7, 2, 2, C.orange);
  }
  carrot.outline();
  return s.img;
}

/** Указатель 16×22: столбик и стрелка. */
export function signpost() {
  const s = sheet(16, 22, 1);
  const fr = s.frame(0);
  fr.rect(6, 6, 2, 16, C.bark);
  fr.grid(1, 2, ['.wwwwwww...', 'wwwwwwwwww.', 'wwwwwwwwwww', 'wwwwwwwwww.', '.wwwwwww...'], { w: '#e0b98a' });
  fr.line(3, 4, 9, 4, C.barkDark);
  fr.outline();
  return s.img;
}

/** Дым из трубы 8×8: 3 кадра серых клубов. */
export function smoke() {
  const s = sheet(8, 8, 3);
  [2, 3, 3.6].forEach((r, i) => s.frame(i).ellipse(4, 4, r, r, (nx, ny) => (nx > 0.3 && ny > 0.3 ? C.slate : i === 2 ? '#b7c9d6' : C.silver)));
  return s.img;
}

/** Пыль из-под ног 8×8: 3 кадра. */
export function dust() {
  const s = sheet(8, 8, 3);
  [1.6, 2.6, 3.2].forEach((r, i) => s.frame(i).ellipse(4, 5, r, r * 0.8, (nx, ny) => (nx > 0.2 && ny > 0.2 ? '#c9b48a' : '#e8dcc0')));
  return s.img;
}

// ---------------------------------------------------------------- тайлы

/** Вода 32×32: синяя рябь, стыкуется. */
export function water() {
  const S = 32;
  const img = sheet(S, S, 1);
  const fr = img.frame(0);
  const rand = rng(41);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fr.set(x, y, (x * 3 + y * 5) % 17 === 0 ? '#4bb0f0' : C.sky);
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rand() * S);
    const y = Math.floor(rand() * S);
    for (let k = 0; k < 4; k++) fr.set((x + k) % S, y, k === 0 || k === 3 ? '#8fd0fa' : '#c8ecff');
  }
  return img.img;
}

