import * as THREE from 'three';
import type { SpriteSheet, SpriteSheetDef } from './sprite';

const loader = new THREE.TextureLoader();

/** Загружает текстуру для пиксель-арта: без сглаживания, в цветовом пространстве sRGB. */
export async function loadPixelTexture(url: string): Promise<THREE.Texture> {
  const texture = await loader.loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** Текстура-плитка для пола и стен: повторяется и сглаживается вдали через mip-уровни. */
export async function loadTileTexture(url: string): Promise<THREE.Texture> {
  const texture = await loadPixelTexture(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export async function loadSpriteSheet(def: SpriteSheetDef): Promise<SpriteSheet> {
  const texture = await loadPixelTexture(def.url);
  const { width, height } = texture.image as { width: number; height: number };
  const columns = Math.floor(width / def.frameWidth);
  const rows = Math.floor(height / def.frameHeight);
  if (columns < 1 || rows < 1) {
    throw new Error(`${def.url}: кадр ${def.frameWidth}×${def.frameHeight} больше самой картинки ${width}×${height}`);
  }
  return { ...def, texture, columns, rows };
}

/** Загружает сразу несколько листов: { hero: def, ... } → { hero: sheet, ... }. */
export async function loadSpriteSheets<K extends string>(
  defs: Readonly<Record<K, SpriteSheetDef>>,
): Promise<Record<K, SpriteSheet>> {
  const keys = Object.keys(defs) as K[];
  const sheets = await Promise.all(keys.map((key) => loadSpriteSheet(defs[key])));
  return Object.fromEntries(keys.map((key, i) => [key, sheets[i]])) as Record<K, SpriteSheet>;
}
