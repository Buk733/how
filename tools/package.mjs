// Архив для загрузки в Консоль Яндекс Игр: `npm run package` (сначала собирает игру).
// Проверяет правила площадки: index.html в корне архива, до 100 МБ, имена файлов латиницей без пробелов,
// никаких внешних ссылок, кроме известных строк внутри Three.js. Пишет games/steal/release/steal.zip.
import { crc32, deflateRawSync } from 'node:zlib';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../games/steal/', import.meta.url));
const dist = join(root, 'dist');
const output = join(root, 'release', 'steal.zip');
const MAX_BYTES = 100 * 1024 * 1024;
/** Дата файлов в архиве — 1 января 1980 (самая ранняя в формате ZIP): нулевая дата некорректна. */
const ZIP_DATE = (0 << 9) | (1 << 5) | 1;
/** Адреса, которые встречаются в коде Three.js как текст (пространство имён SVG, ссылка в комментарии), а не как запросы. */
const ALLOWED_URLS = ['http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg', 'https://jcgt.org/published/0007/04/01/'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const problems = [];
const files = walk(dist).map((path) => ({ path, name: relative(dist, path).split(sep).join('/') }));
if (!files.some((f) => f.name === 'index.html')) problems.push('нет index.html в корне сборки');
let total = 0;
for (const file of files) {
  const data = readFileSync(file.path);
  total += data.length;
  if (!/^[A-Za-z0-9._/-]+$/.test(file.name)) problems.push(`имя файла не латиницей или с пробелами: ${file.name}`);
  if (/\.(js|html|css)$/.test(file.name)) {
    const urls = data.toString('utf8').match(/https?:\/\/[^\s"'`)<>\\]+/g) ?? [];
    for (const url of new Set(urls)) if (!ALLOWED_URLS.includes(url)) problems.push(`внешняя ссылка в ${file.name}: ${url}`);
  }
  file.data = data;
}
if (total > MAX_BYTES) problems.push(`сборка больше 100 МБ: ${(total / 1024 / 1024).toFixed(1)} МБ`);
if (problems.length > 0) {
  console.error('Архив не собран:\n- ' + problems.join('\n- '));
  process.exit(1);
}

// ZIP без сторонних библиотек: локальные заголовки, сжатые данные, центральный каталог
const local = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(file.name, 'utf8');
  const compressed = deflateRawSync(file.data, { level: 9 });
  const crc = crc32(file.data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6); // имена в UTF-8
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt16LE(0, 10); // время не важно
  header.writeUInt16LE(ZIP_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(file.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  local.push(header, name, compressed);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(0, 12);
  entry.writeUInt16LE(ZIP_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(file.data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += header.length + name.length + compressed.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
mkdirSync(join(root, 'release'), { recursive: true });
writeFileSync(output, Buffer.concat([...local, directory, end]));
console.log(`Готово: ${relative(process.cwd(), output)} — ${files.length} файлов, ${(total / 1024 / 1024).toFixed(1)} МБ без сжатия`);
