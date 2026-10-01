// Демо-сборка игры для артефакта (страница на claude.ai, где можно сразу поиграть): страница и один скрипт рядом.
// Картинки и звуки встроены в скрипт data:-ссылками, стили — в страницу; Yandex SDK не грузится (режим demo),
// вместо рекламы на секунду появляется табличка. Каркас страницы (doctype, head, body) артефакт добавляет сам,
// поэтому в странице только title, стили, разметка и ссылка на скрипт. Скрипт — отдельным файлом: сжатый код
// внутри страницы проверка публикации принимает за шаблон обзора PR (конструкции «id=…» без кавычек).
//
// Запуск: npm run artifact [-- путь/к/странице.html]; по умолчанию games/steal/dist-artifact/steal.html,
// скрипт — рядом, с тем же именем и расширением .js. Публикуется страница, а скрипт — в files под этим именем.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { build } from 'vite';

const ROOT = 'games/steal';
const BUILD_DIR = join(ROOT, 'dist-artifact', 'build');
const output = resolve(process.argv[2] ?? join(ROOT, 'dist-artifact', 'steal.html'));
const scriptName = basename(output).replace(/\.html$/, '') + '.js';

await build({
  root: ROOT,
  mode: 'demo',
  logLevel: 'warn',
  build: {
    outDir: 'dist-artifact/build',
    emptyOutDir: true,
    // всё внутрь: картинки и звуки — data:-ссылками, код — одним файлом
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
    // одна страница со всей игрой и Three.js внутри — больше обычного предупреждения
    chunkSizeWarningLimit: 4000,
  },
});

const html = await readFile(join(BUILD_DIR, 'index.html'), 'utf8');
const title = /<title>[^<]*<\/title>/.exec(html);
const script = /<script\b[^>]*\bsrc="\.\/assets\/([^"]+\.js)"[^>]*><\/script>/.exec(html);
const style = /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\.\/assets\/([^"]+\.css)"[^>]*>/.exec(html);
const body = /<body>([\s\S]*)<\/body>/.exec(html);
if (!title || !script || !style || !body) throw new Error('Неожиданный index.html после сборки: нет title, скрипта, стилей или body');
if (/<script/i.test(body[1])) throw new Error('В body остались скрипты — их нужно встроить');

const extra = (await readdir(join(BUILD_DIR, 'assets'))).filter((name) => name !== script[1] && name !== style[1]);
if (extra.length > 0) throw new Error(`Не встроились в страницу: ${extra.join(', ')}`);

const js = await readFile(join(BUILD_DIR, 'assets', script[1]));
const css = await readFile(join(BUILD_DIR, 'assets', style[1]), 'utf8');
if (/<\/style/i.test(css)) throw new Error('В стилях есть «</style» — встроить их в страницу не получится');

const page = [title[0], `<style>${css}</style>`, body[1].trim().replace(/\n\s+/g, '\n'), `<script type="module" src="${scriptName}"></script>`, ''].join('\n');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, page);
await writeFile(join(dirname(output), scriptName), js);
await rm(BUILD_DIR, { recursive: true, force: true });
const size = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
console.log(`${output}: ${size(Buffer.byteLength(page))}, ${scriptName}: ${size(js.length)}`);
