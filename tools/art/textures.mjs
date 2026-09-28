// Текстуры мира (тайлы) и декор: трава, доски, брёвна, ковёр, камень, плиты сбора, монета, пар, деревья.
import { C, Img, sheet, rng } from './lib.mjs';

/** Бесшовная трава 32×32. */
export function grass() {
  const S = 32;
  const img = new Img(S, S);
  const rand = rng(3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) img.set(x, y, C.green);
  const put = (x, y, c) => img.set(((x % S) + S) % S, ((y % S) + S) % S, c);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * S);
    const y = Math.floor(rand() * S);
    put(x, y, C.teal);
    if (rand() < 0.6) put(x, y - 1, C.teal);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * S);
    const y = Math.floor(rand() * S);
    put(x, y, C.lime);
    if (rand() < 0.5) put(x + 1, y - 1, C.lime);
  }
  return img;
}

/** Пол из досок 32×32: 4 доски по 8 px, со стыками. */
export function planks() {
  const S = 32;
  const img = new Img(S, S);
  const rand = rng(21);
  const tones = ['#c79466', '#b98758', '#c28d5f', '#b07e52'];
  for (let y = 0; y < S; y++) {
    const board = Math.floor(y / 8);
    for (let x = 0; x < S; x++) {
      let c = tones[board];
      if (y % 8 === 7) c = '#7a5238';
      else if (y % 8 === 0) c = '#d6a576';
      else if (rand() < 0.07) c = '#a2724a';
      img.set(x, y, c);
    }
    // торцевой стык доски
    const seam = (board * 11 + 5) % S;
    if (y % 8 !== 7) img.set(seam, y, '#7a5238');
  }
  return img;
}

/** Бревенчатая стена 32×32: 4 бревна по 8 px. */
export function logs() {
  const S = 32;
  const img = new Img(S, S);
  const rand = rng(13);
  const band = ['#5a3a38', '#8a5a44', '#a06a4c', '#b07a55', '#b07a55', '#a06a4c', '#8a5a44', '#6e4638'];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let c = band[y % 8];
      if (y % 8 > 1 && y % 8 < 6 && rand() < 0.05) c = '#7a5238';
      img.set(x, y, c);
    }
  return img;
}

/** Красная ковровая дорожка с золотой каймой: 32 по длине × 40 поперёк. */
export function carpet() {
  const W = 32;
  const H = 40;
  const img = new Img(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = C.red;
      if (y < 3 || y >= H - 3) c = y === 1 || y === H - 2 ? C.gold : C.goldDark;
      else {
        // ромбы по центру
        const dx = Math.abs((x % 16) - 8);
        const dy = Math.abs(y - H / 2);
        if (dx + dy === 7) c = '#8f2f45';
        else if (dx + dy < 3) c = '#c95468';
      }
      img.set(x, y, c);
    }
  return img;
}

/** Каменная кладка печи 32×32. */
export function stone() {
  const S = 32;
  const img = new Img(S, S);
  const rand = rng(8);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const row = Math.floor(y / 8);
      const offset = row % 2 ? 8 : 0;
      let c = rand() < 0.5 ? C.silver : '#8aa3b6';
      if (y % 8 === 7 || (x + offset) % 16 === 15) c = C.shadow;
      else if (y % 8 === 0) c = '#b7c9d6';
      img.set(x, y, c);
    }
  return img;
}

/** Плита сбора монет 16×16, 3 кадра: закрыто, пусто, есть монеты. */
export function plate() {
  const s = sheet(16, 16, 3);
  const styles = [
    { rim: C.slate, fill: C.shadow, mark: 'lock' },
    { rim: C.goldDark, fill: '#6e4638', mark: null },
    { rim: C.gold, fill: C.green, mark: 'coin' },
  ];
  styles.forEach((st, i) => {
    const f = s.frame(i);
    f.ellipse(8, 8, 7.5, 7.5, (nx, ny) => (nx * nx + ny * ny > 0.62 ? st.rim : st.fill));
    if (st.mark === 'coin') {
      f.ellipse(8, 8, 3, 3, C.yellow);
      f.rect(8, 6, 1, 4, C.goldDark);
    }
    if (st.mark === 'lock') {
      f.grid(5, 4, ['.sss..', '.s..s.', 'yyyyyy', 'yykkyy', 'yykkyy', 'yyyyyy'], { s: C.silver, y: C.yellow, k: C.ink });
    }
  });
  return s.img;
}

/** Вращающаяся монета: 6 кадров 12×12. */
export function coin() {
  const widths = [10, 8, 5, 2, 5, 8];
  const s = sheet(12, 12, widths.length);
  widths.forEach((w, i) => {
    const f = s.frame(i);
    f.ellipse(6, 6, w / 2, 5, (nx, ny) => {
      if (w <= 2) return C.orange;
      if (w >= 5 && nx < -0.3 && ny < -0.25 && nx * nx + ny * ny > 0.3) return C.white;
      if (nx > 0.45 || ny > 0.6) return C.orange;
      if (w >= 8 && nx * nx + ny * ny > 0.3 && nx * nx + ny * ny < 0.55 && nx > -0.2) return C.orange;
      return C.yellow;
    });
    f.outline(C.plum);
  });
  return s.img;
}

/** Облачко пара: 3 кадра 8×8. */
export function steam() {
  const s = sheet(8, 8, 3);
  [2, 3, 3.6].forEach((r, i) => {
    const f = s.frame(i);
    f.ellipse(4, 4, r, r, (nx, ny) => (nx > 0.3 && ny > 0.3 ? '#c3d3e6' : C.white));
  });
  return s.img;
}

/** Круглое дерево 32×40. */
export function tree() {
  const f = sheet(32, 40, 1);
  const rand = rng(7);
  const fr = f.frame(0);
  for (let y = 22; y <= 38; y++)
    for (let x = 13; x <= 18; x++) fr.set(x, y, x === 13 ? C.barkLight : x >= 17 ? C.barkDark : C.bark);
  const blobs = [[16, 12, 10.5], [8.5, 18, 7], [23.5, 18, 7], [16, 21, 8.5], [11, 9, 6], [21, 9, 6]];
  const inside = (x, y) => blobs.some(([bx, by, r]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= r * r);
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 32; x++) {
      if (!inside(x, y)) continue;
      let l = -(((x - 16) / 14) * 0.55 + ((y - 15) / 14) * 0.85) + (rand() - 0.5) * 0.35;
      if (!inside(x, y + 2)) l -= 0.35;
      fr.set(x, y, l > 0.42 ? C.lime : l < -0.3 ? C.teal : C.green);
    }
  fr.outline();
  return f.img;
}

/** Ель 24×40. */
export function pine() {
  const f = sheet(24, 40, 1);
  const fr = f.frame(0);
  const rand = rng(11);
  for (let y = 30; y <= 38; y++) for (let x = 10; x <= 13; x++) fr.set(x, y, x >= 12 ? C.barkDark : C.bark);
  for (const t of [{ top: 1, bottom: 13, half: 6 }, { top: 7, bottom: 22, half: 8.5 }, { top: 14, bottom: 31, half: 10.5 }])
    for (let y = t.top; y <= t.bottom; y++) {
      const half = 0.8 + ((y - t.top) / (t.bottom - t.top)) * t.half;
      for (let x = 0; x < 24; x++) {
        const dx = x + 0.5 - 12;
        if (Math.abs(dx) > half) continue;
        const n = (rand() - 0.5) * 0.4;
        let c = C.teal;
        if (dx / half + n < -0.35) c = C.green;
        if (dx / half + n > 0.45 || y >= t.bottom - 1) c = C.navy;
        fr.set(x, y, c);
      }
    }
  fr.outline();
  return f.img;
}

/** Куст с ягодами 16×12. */
export function bush() {
  const f = sheet(16, 12, 1);
  const fr = f.frame(0);
  const rand = rng(5);
  const blobs = [[5, 7.5, 3.8], [11, 7.5, 3.8], [8, 5.5, 4.2]];
  for (let y = 0; y <= 10; y++)
    for (let x = 0; x < 16; x++) {
      if (!blobs.some(([bx, by, r]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= r * r)) continue;
      const l = -((x - 8) / 8) * 0.5 - ((y - 6) / 6) * 0.9 + (rand() - 0.5) * 0.4;
      fr.set(x, y, l > 0.5 ? C.lime : l < -0.35 || y === 10 ? C.teal : C.green);
    }
  for (const [x, y] of [[5, 6], [10, 5], [12, 8]]) fr.set(x, y, C.red);
  fr.outline();
  return f.img;
}

/** Ведро-шайка для декора бани 16×16. */
export function bucket() {
  const f = sheet(16, 16, 1);
  const fr = f.frame(0);
  for (let y = 5; y <= 14; y++) {
    const half = 5 - (y - 5) * 0.12;
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      if (Math.abs(dx) > half) continue;
      fr.set(x, y, y === 7 || y === 12 ? C.shadow : dx > half - 1.5 ? '#8a5a44' : C.barkLight);
    }
  }
  fr.ellipse(8, 5.5, 5, 1.5, C.sky);
  fr.rect(12, 2, 1, 4, C.silver);
  fr.rect(9, 2, 4, 1, C.silver);
  fr.outline();
  return f.img;
}
