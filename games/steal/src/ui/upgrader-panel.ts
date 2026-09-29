import { formatNumber } from '@engine/format';
import { button, element, formatChance, spriteIcon } from './dom';
import { Modal } from './modal';

export interface UpgraderUnitView {
  readonly name: string;
  readonly sprite: string;
  readonly color: string;
  readonly gold: boolean;
  /** Доход в секунду. */
  readonly income: number;
}

export interface UpgraderView {
  /** Кого можно отдать — персонажи на полке (slot — номер места). */
  readonly sources: readonly (UpgraderUnitView & { readonly slot: number })[];
  readonly selectedSlot: number | null;
  /** Во что можно превратить выбранного — с шансами. */
  readonly targets: readonly (UpgraderUnitView & { readonly chance: number })[];
  readonly selectedTarget: number | null;
  /** Страховка за рекламу: при неудаче персонаж останется. */
  readonly insured: boolean;
}

export interface UpgraderCallbacks {
  onSelectSource(slot: number): void;
  onSelectTarget(index: number): void;
  onRun(): void;
  onInsure(): void;
  onClose(): void;
  /** Градусник остановился. */
  onDone(success: boolean): void;
}

const HEAT_MS = 2400;

/**
 * Парилка (апгрейдер): отдаёшь персонажа ради более ценного. Шанс — зелёная часть шкалы жара:
 * если жар остановился в зелёной части — получилось, дальше — «перегрев».
 */
export class UpgraderPanel {
  readonly modal: Modal;
  private readonly callbacks: UpgraderCallbacks;
  private readonly sources: HTMLDivElement;
  private readonly targets: HTMLDivElement;
  private readonly zone: HTMLDivElement;
  private readonly heat: HTMLDivElement;
  private readonly chance: HTMLDivElement;
  private readonly runButton: HTMLButtonElement;
  private readonly insureButton: HTMLButtonElement;
  private readonly result: HTMLDivElement;
  private lastKey = '';
  private frame = 0;

  constructor(container: HTMLElement, callbacks: UpgraderCallbacks) {
    this.callbacks = callbacks;
    this.modal = new Modal(container, '♨️ Парилка', () => callbacks.onClose(), 'upgrader-panel');
    this.sources = element('div', 'unit-row');
    this.targets = element('div', 'unit-row');
    this.sources.addEventListener('click', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (card && !this.busy) callbacks.onSelectSource(Number(card.dataset.slot));
    });
    this.targets.addEventListener('click', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
      if (card && !this.busy) callbacks.onSelectTarget(Number(card.dataset.index));
    });

    const meter = element('div', 'heat-meter');
    this.zone = element('div', 'heat-zone');
    this.heat = element('div', 'heat-fill');
    meter.append(this.zone, this.heat, element('span', 'heat-label ok', 'получится'), element('span', 'heat-label hot', 'перегрев'));
    this.chance = element('div', 'heat-chance');
    this.result = element('div', 'upgrader-result');
    this.runButton = button('buy-button', '♨️ Парить!', () => !this.busy && callbacks.onRun());
    this.insureButton = button('ad-button', '', () => !this.busy && callbacks.onInsure());
    const buttons = element('div', 'wheel-buttons');
    buttons.append(this.runButton, this.insureButton);

    this.modal.body.append(
      element('div', 'modal-subtitle', 'Кого отдать'),
      this.sources,
      element('div', 'modal-subtitle', 'Во что превратить'),
      this.targets,
      meter,
      this.chance,
      this.result,
      buttons,
      element('div', 'modal-hint', 'Не повезло — персонаж испарится. Страховка за рекламу его сохранит.'),
    );
  }

  get busy(): boolean {
    return this.frame !== 0;
  }

  render(view: UpgraderView): void {
    const target = view.selectedTarget !== null ? view.targets[view.selectedTarget] : undefined;
    const key = JSON.stringify([view.sources.map((s) => [s.slot, s.name, s.gold]), view.selectedSlot, view.targets.map((t) => t.name + t.gold), view.selectedTarget, view.insured]);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.sources.replaceChildren(
        ...(view.sources.length > 0
          ? view.sources.map((s) => this.card(s, s.slot === view.selectedSlot, { slot: String(s.slot) }))
          : [element('div', 'unit-empty', 'На полке пока никого нет')]),
      );
      this.targets.replaceChildren(
        ...(view.selectedSlot === null
          ? [element('div', 'unit-empty', 'Сначала выбери, кого отдать')]
          : view.targets.length > 0
            ? view.targets.map((t, i) => this.card(t, i === view.selectedTarget, { index: String(i) }, formatChance(t.chance)))
            : [element('div', 'unit-empty', 'Это уже самый ценный персонаж!')]),
      );
      const insureText = view.insured ? '🛡️ Страховка включена' : '📺 Реклама → страховка';
      this.insureButton.textContent = insureText;
      this.insureButton.classList.toggle('active', view.insured);
    }
    if (!this.busy) {
      const chance = target?.chance ?? 0;
      this.zone.style.width = `${chance * 100}%`;
      this.chance.textContent = target ? `Шанс ${formatChance(chance)}` : 'Выбери обоих персонажей';
      this.runButton.classList.toggle('disabled', !target);
    }
  }

  /** Жар поднимается до roll (0…1) и останавливается; success — попал в зелёную часть. */
  playHeat(roll: number, success: boolean, text: string): void {
    this.stop();
    this.result.textContent = '';
    this.result.className = 'upgrader-result';
    this.runButton.classList.add('disabled');
    const began = performance.now();
    // жар сначала взлетает, потом, покачиваясь, оседает на roll
    const peak = Math.max(roll, 0.55 + Math.random() * 0.45);
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / HEAT_MS);
      const u = (t - 0.4) / 0.6;
      const raw = t < 0.4 ? peak * (1 - (1 - t / 0.4) ** 2) : roll + (peak - roll) * (1 - u) ** 2 * Math.cos(u * Math.PI * 3);
      const level = Math.min(1, Math.max(0, raw));
      this.heat.style.width = `${level * 100}%`;
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
        return;
      }
      this.frame = 0;
      this.heat.style.width = `${roll * 100}%`;
      this.result.textContent = text;
      this.result.classList.add(success ? 'win' : 'lose');
      this.lastKey = '';
      this.callbacks.onDone(success);
    };
    this.frame = requestAnimationFrame(step);
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Сбросить шкалу (выбрали другого персонажа). */
  resetHeat(): void {
    this.heat.style.width = '0%';
    this.result.textContent = '';
    this.result.className = 'upgrader-result';
  }

  private card(unit: UpgraderUnitView, selected: boolean, data: Record<string, string>, badge = ''): HTMLDivElement {
    const card = element('div', `unit-card${selected ? ' selected' : ''}${unit.gold ? ' gold' : ''}`);
    Object.assign(card.dataset, data);
    card.style.setProperty('--rarity', unit.color);
    const name = element('div', 'unit-name', unit.gold ? `✨ ${unit.name}` : unit.name);
    card.append(spriteIcon(unit.sprite, 48), name, element('div', 'unit-income', `+${formatNumber(unit.income)}/с`));
    if (badge) card.append(element('div', 'unit-badge', badge));
    return card;
  }
}
