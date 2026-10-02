// Маленькие помощники для интерфейса на DOM.

/** Элемент с классом и текстом. */
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Кнопка; нажатие не запускает джойстик и удар мышью (игра слушает pointerdown на контейнере). */
export function button(className: string, text: string, onPress: () => void, instant = false): HTMLButtonElement {
  const el = element('button', className, text);
  el.type = 'button';
  el.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    if (!instant) return;
    event.preventDefault();
    onPress();
  });
  if (!instant) el.addEventListener('click', () => onPress());
  return el;
}

/** Картинка персонажа — первый кадр листа 2×1 кадра 32×32, увеличенный без сглаживания. */
export function spriteIcon(url: string, size = 64): HTMLSpanElement {
  const icon = element('span', 'sprite-icon');
  icon.style.backgroundImage = `url("${url}")`;
  icon.style.width = `${size}px`;
  icon.style.height = `${size}px`;
  icon.style.backgroundSize = `${size * 2}px ${size}px`;
  return icon;
}

/** «12:34» или «1:02:03» — сколько ждать. */
export function formatWait(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
