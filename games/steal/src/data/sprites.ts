// Все картинки игры по имени файла; их рисует `npm run art` (tools/art).
const SPRITES = import.meta.glob<string>('../assets/sprites/*.png', { eager: true, import: 'default' });
const TEXTURES = import.meta.glob<string>('../assets/textures/*.png', { eager: true, import: 'default' });

/** URL спрайта sprites/<name>.png. */
export function spriteUrl(name: string): string {
  const url = SPRITES[`../assets/sprites/${name}.png`];
  if (!url) throw new Error(`Нет спрайта sprites/${name}.png — нарисуйте его в tools/art и запустите npm run art`);
  return url;
}

/** URL текстуры-плитки textures/<name>.png. */
export function textureUrl(name: string): string {
  const url = TEXTURES[`../assets/textures/${name}.png`];
  if (!url) throw new Error(`Нет текстуры textures/${name}.png — нарисуйте её в tools/art и запустите npm run art`);
  return url;
}
