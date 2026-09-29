// Мини-библиотека для рисования пиксель-арта кодом и сохранения в PNG (без зависимостей).
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Палитра Sweetie 16 (GrafxKid) и несколько дополнительных цветов. */
export const C = {
  ink: '#1a1c2c',
  plum: '#5d275d',
  red: '#b13e53',
  orange: '#ef7d57',
  yellow: '#ffcd75',
  lime: '#a7f070',
  green: '#38b764',
  teal: '#257179',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  silver: '#94b0c2',
  slate: '#566c86',
  shadow: '#333c57',
  // дополнительные
  skin: '#f6c9a0',
  skinShade: '#d99a73',
  pink: '#f5a3c7',
  pinkDark: '#d0679d',
  bark: '#8a5a44',
  barkDark: '#5a3a38',
  barkLight: '#b07a55',
  black: '#2b2733',
  blackLight: '#4a4456',
  gold: '#ffd23f',
  goldDark: '#c98a1a',
};

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

export class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (!color || !this.inside(x, y)) return;
    const [r, g, b] = hex(color);
    this.data.set([r, g, b, 255], (y * this.w + x) * 4);
  }

  get(x, y) {
    if (!this.inside(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (!this.data[i + 3]) return null;
    return '#' + [0, 1, 2].map((k) => this.data[i + k].toString(16).padStart(2, '0')).join('');
  }

  clear(x, y) {
    if (this.inside(x, y)) this.data.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
  }

  save(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodePNG(this));
  }
}

/** Холст одного кадра внутри листа: все координаты — относительно левого верхнего угла кадра. */
export class Frame {
  constructor(img, fx, fy, w, h) {
    Object.assign(this, { img, fx, fy, w, h });
  }

  set(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.img.set(this.fx + x, this.fy + y, color);
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.img.get(this.fx + x, this.fy + y);
  }

  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color);
  }

  /** Эллипс с центром (cx, cy). color может быть функцией (nx, ny) => цвет, где nx, ny ∈ [-1, 1]. */
  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        this.set(x, y, typeof color === 'function' ? color(nx, ny) : color);
      }
  }

  line(x0, y0, x1, y1, color) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.set(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, color);
  }

  /** Рисует по «трафарету» из строк: каждый символ — ключ палитры, '.' — пусто. */
  grid(x0, y0, rows, palette, flip = false) {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        const color = palette[ch];
        if (!color) throw new Error(`Нет цвета для символа "${ch}"`);
        this.set(flip ? x0 + row.length - 1 - x : x0 + x, y0 + y, color);
      });
    });
  }

  /** Обводка по 4 соседям — делает силуэт читаемым на любом фоне. */
  outline(color = C.ink) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([ax, ay]) => this.get(ax, ay))) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, color);
  }

  /** Зеркалит кадр по горизонтали. */
  mirror() {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w / 2; x++) {
        const a = this.get(x, y);
        const b = this.get(this.w - 1 - x, y);
        this.img.clear(this.fx + x, this.fy + y);
        this.img.clear(this.fx + this.w - 1 - x, this.fy + y);
        if (b) this.set(x, y, b);
        if (a) this.set(this.w - 1 - x, y, a);
      }
  }
}

/** Лист спрайтов: columns × rows кадров размером fw × fh. */
export function sheet(fw, fh, columns, rows = 1) {
  const img = new Img(fw * columns, fh * rows);
  return {
    img,
    frame: (col, row = 0) => new Frame(img, col * fw, row * fh, fw, fh),
  };
}

/** Детерминированный генератор случайных чисел (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

export function encodePNG({ w, h, data }) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * stride + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 бит на канал
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Оттенки золота от тёмного к светлому — для «Голды». */
const GOLD_RAMP = ['#5e3510', '#8f5716', '#bf7f18', '#e3a520', '#f7c531', '#ffdc5e', '#fff0a8'].map(hex);
const GOLD_OUTLINE = hex('#2e1a08');
const INK = hex(C.ink);

/**
 * «Голда»: золотая копия картинки. Яркость каждого пикселя превращается в оттенок золота
 * (яркость растягивается на всю шкалу, поэтому и чёрная пантера выходит золотой),
 * контур и зрачки (цвет C.ink) становятся тёмно-коричневыми — персонаж как золотая статуэтка.
 */
export function goldify(img) {
  const out = new Img(img.w, img.h);
  const lights = [];
  for (let i = 0; i < img.w * img.h; i++) {
    if (!img.data[i * 4 + 3]) continue;
    const [r, g, b] = img.data.subarray(i * 4, i * 4 + 3);
    lights[i] = r === INK[0] && g === INK[1] && b === INK[2] ? -1 : (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  const body = lights.filter((l) => l !== undefined && l >= 0);
  const min = Math.min(...body);
  const range = Math.max(0.05, Math.max(...body) - min);
  lights.forEach((light, i) => {
    if (light === undefined) return;
    let color = GOLD_OUTLINE;
    if (light >= 0) {
      // самые тёмные места — густое золото, а не коричневый: статуэтка целиком золотая
      const t = (light - min) / range;
      color = GOLD_RAMP[Math.min(GOLD_RAMP.length - 1, 2 + Math.floor(t * (GOLD_RAMP.length - 2)))];
    }
    out.data.set([...color, 255], i * 4);
  });
  return out;
}

/** Собирает превью всех листов в одну картинку (увеличение scale) — удобно смотреть глазами. */
export function contactSheet(images, scale = 6, background = '#c4c9d8') {
  const pad = 4;
  const width = Math.max(...images.map((i) => i.w)) * scale + pad * 2;
  const height = images.reduce((sum, i) => sum + i.h * scale + pad, pad);
  const out = new Img(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) out.set(x, y, ((x >> 3) + (y >> 3)) % 2 ? background : '#d8dce8');
  let oy = pad;
  for (const image of images) {
    for (let y = 0; y < image.h; y++)
      for (let x = 0; x < image.w; x++) {
        const c = image.get(x, y);
        if (!c) continue;
        for (let yy = 0; yy < scale; yy++)
          for (let xx = 0; xx < scale; xx++) out.set(pad + x * scale + xx, oy + y * scale + yy, c);
      }
    oy += image.h * scale + pad;
  }
  return out;
}
