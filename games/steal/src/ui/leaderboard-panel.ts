import { t } from '../i18n';
import { button, element } from './dom';
import { Modal } from './modal';

export interface LeaderboardRowView {
  readonly rank: number;
  readonly name: string;
  /** «💰 1,2K/с». */
  readonly score: string;
  readonly isPlayer: boolean;
}

export interface LeaderboardView {
  /** Таблица грузится, готова или недоступна. */
  readonly state: 'loading' | 'ready' | 'unavailable';
  readonly rows: readonly LeaderboardRowView[];
  /** «Твой лучший доход: 💰 1,2K в секунду». */
  readonly best: string;
  /** Игрок — гость: показать, зачем входить, и кнопку входа. */
  readonly guest: boolean;
  /** Пример таблицы (демо). */
  readonly sample: boolean;
  /** Идёт вход: кнопка не нажимается. */
  readonly busy: boolean;
}

/** Окно «Рейтинг»: лучшие по доходу в секунду и место самого игрока. */
export class LeaderboardPanel {
  readonly modal: Modal;
  private readonly best: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private readonly guest: HTMLDivElement;
  private readonly login: HTMLButtonElement;
  private readonly sample: HTMLDivElement;
  private lastKey = '';

  constructor(container: HTMLElement, onLogin: () => void, onClose: () => void) {
    this.modal = new Modal(container, t.leaderboard.title, onClose, 'leaderboard-panel');
    this.best = element('div', 'leaderboard-best');
    this.status = element('div', 'leaderboard-status');
    this.rows = element('div', 'leaderboard-rows');
    this.guest = element('div', 'leaderboard-guest');
    this.login = button('buy-button free leaderboard-login', t.leaderboard.login, onLogin);
    this.guest.append(element('div', 'leaderboard-why', t.leaderboard.why), this.login);
    this.sample = element('div', 'modal-hint', t.leaderboard.sample);
    this.modal.body.append(this.best, this.status, this.rows, this.guest, this.sample, element('div', 'modal-hint', t.leaderboard.rule));
  }

  render(view: LeaderboardView): void {
    const key = `${view.state}|${view.best}|${view.guest}|${view.sample}|${view.busy}|${view.rows.map((r) => `${r.rank}${r.name}${r.score}${r.isPlayer}`).join(',')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.best.textContent = view.best;
    const status = view.state === 'loading' ? t.leaderboard.loading : view.state === 'unavailable' ? t.leaderboard.unavailable : view.rows.length === 0 ? t.leaderboard.empty : '';
    this.status.textContent = status;
    this.status.hidden = status === '';
    const rows: HTMLDivElement[] = [];
    view.rows.forEach((row, i) => {
      // между лучшими и местом игрока — разрыв
      if (i > 0 && row.rank > view.rows[i - 1].rank + 1) rows.push(element('div', 'leaderboard-gap', '…'));
      const line = element('div', row.isPlayer ? 'leaderboard-row player' : 'leaderboard-row');
      line.append(element('span', 'leaderboard-rank', medal(row.rank)), element('span', 'leaderboard-name', row.name), element('span', 'leaderboard-score', row.score));
      rows.push(line);
    });
    this.rows.replaceChildren(...rows);
    this.guest.hidden = !view.guest;
    this.login.disabled = view.busy;
    this.login.classList.toggle('disabled', view.busy);
    this.sample.hidden = !view.sample;
  }
}

/** Первые три места — медалями. */
function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
}
