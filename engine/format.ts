const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Десятичный разделитель языка игры: «1,23K» по-русски, «1.23K» по-английски. */
let decimalSeparator = ',';

export function setDecimalSeparator(separator: string): void {
  decimalSeparator = separator;
}

/**
 * Короткая запись больших чисел для интерфейса: 999 → «999», 1234 → «1,23K», 5 600 000 → «5,6M».
 * Округляет вниз, чтобы не показывать игроку больше, чем у него есть.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  let v = Math.abs(value);
  if (v < 1000) return sign + String(Math.floor(v));
  let unit = 0;
  while (v >= 1000 && unit < UNITS.length - 1) {
    v /= 1000;
    unit++;
  }
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  const factor = 10 ** digits;
  const floored = Math.floor(v * factor + 1e-9) / factor;
  let text = floored.toFixed(digits);
  if (digits > 0) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return sign + text.replace('.', decimalSeparator) + UNITS[unit];
}
