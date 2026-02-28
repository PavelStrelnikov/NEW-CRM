/**
 * Утилита расчёта статуса конфигурации Switch.
 * Чистая функция, без React-зависимостей.
 */

// Используем те же типы что и Router (единый паттерн)
export type { RouterConfigStatus as SwitchConfigStatus } from './routerConfigStatus';
export type { RouterConfigCheck as SwitchConfigCheck } from './routerConfigStatus';
export type { RouterConfigResult as SwitchConfigResult } from './routerConfigStatus';

import type { RouterConfigResult } from './routerConfigStatus';

// Проверки для Switch
const CORE_CHECKS: { key: string; labelKey: string }[] = [
  { key: 'switch_brand', labelKey: 'switch.checkBrand' },
  { key: 'switch_managed', labelKey: 'switch.checkManaged' },
  { key: 'total_ports', labelKey: 'switch.checkPorts' },
];

function isFilled(value: any): boolean {
  if (typeof value === 'boolean') return true; // bool всегда "заполнен"
  return value !== null && value !== undefined && value !== '';
}

export function getSwitchConfigStatus(
  getProp: (key: string) => any,
): RouterConfigResult {
  const isManaged = getProp('switch_managed');

  const checks = CORE_CHECKS.map(c => ({
    ...c,
    filled: isFilled(getProp(c.key)),
  }));

  // Условная проверка: credentials нужны только для managed switch
  if (isManaged === true || isManaged === 'true') {
    checks.push({
      key: 'admin_username',
      labelKey: 'switch.checkCredentials',
      filled: isFilled(getProp('admin_username')),
    });
  }

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
