import { element } from './dom';

/**
 * Окно поверх игры: заголовок, крестик и содержимое. Игра при этом не останавливается.
 * Касания окна не доходят до игры (джойстик, удар мышью).
 */
export class Modal {
  readonly body: HTMLDivElement;
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement, title: string, onClose: () => void, className = '') {
    this.root = element('div', `modal ${className}`.trim());
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());

    const header = element('div', 'modal-header');
    const close = element('button', 'modal-close', '✕');
    close.type = 'button';
    close.title = 'Закрыть';
    close.addEventListener('click', () => onClose());
    header.append(element('span', 'modal-title', title), close);

    this.body = element('div', 'modal-body');
    this.root.append(header, this.body);
    container.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open;
  }
}
