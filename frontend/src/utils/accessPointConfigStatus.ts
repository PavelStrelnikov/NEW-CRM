/**
 * Утилита расчёта статуса конфигурации Access Point.
 * Чистая функция, без React-зависимостей.
 */

// Используем те же типы что и Router (единый паттерн)
export type { RouterConfigStatus as APConfigStatus } from './routerConfigStatus';
export type { RouterConfigCheck as APConfigCheck } from './routerConfigStatus';
export type { RouterConfigResult as APConfigResult } from './routerConfigStatus';

import type { RouterConfigResult } from './routerConfigStatus';

// Проверки для Access Point
const CORE_CHECKS: { key: string; labelKey: string }[] = [
  { key: 'ap_brand', labelKey: 'accessPoint.checkBrand' },
  { key: 'wifi_ssid', labelKey: 'accessPoint.checkSsid' },
];

function isFilled(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function getAPConfigStatus(
  getProp: (key: string) => any,
): RouterConfigResult {
  const checks = CORE_CHECKS.map(c => ({
    ...c,
    filled: isFilled(getProp(c.key)),
  }));

  const filledCount = checks.filter(c => c.filled).length;
  const totalCount = checks.length;

  let status: 'configured' | 'incomplete' | 'no_data';
  if (filledCount === 0) {
    status = 'no_data';
  } else if (filledCount === totalCount) {
    status = 'configured';
  } else {
    status = 'incomplete';
  }

  return { status, filledCount, totalCount, checks };
}
