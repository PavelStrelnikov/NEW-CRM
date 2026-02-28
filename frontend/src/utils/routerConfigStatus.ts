/**
 * Утилита расчёта статуса конфигурации Router.
 * Чистая функция, без React-зависимостей.
 */

export type RouterConfigStatus = 'configured' | 'incomplete' | 'no_data';

export interface RouterConfigCheck {
  key: string;
  labelKey: string;
  filled: boolean;
}

export interface RouterConfigResult {
  status: RouterConfigStatus;
  filledCount: number;
  totalCount: number;
  checks: RouterConfigCheck[];
}

// Проверки, всегда входящие в расчёт
const CORE_CHECKS: { key: string; labelKey: string }[] = [
  { key: 'provider_name', labelKey: 'router.checkProvider' },
  { key: 'wan_connection_type', labelKey: 'router.checkWanType' },
  { key: 'admin_username', labelKey: 'router.checkCredentials' },
];

// Wi-Fi — опциональная, но отображается
const WIFI_CHECK = { key: 'wifi_name', labelKey: 'router.checkWifi' };

// PPPoE / L2TP — условные проверки
const PPPOE_CHECK = { key: 'pppoe_username', labelKey: 'router.checkPppoe' };
const L2TP_CHECK = { key: 'l2tp_username', labelKey: 'router.checkL2tp' };

function isFilled(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function getRouterConfigStatus(
  getProp: (key: string) => any,
): RouterConfigResult {
  const wanType = getProp('wan_connection_type');

  // Собираем checklist
  const checks: RouterConfigCheck[] = CORE_CHECKS.map(c => ({
    ...c,
    filled: isFilled(getProp(c.key)),
  }));

  // Условные проверки по типу WAN
  if (wanType === 'PPPoE') {
    checks.push({ ...PPPOE_CHECK, filled: isFilled(getProp('pppoe_username')) });
  } else if (wanType === 'L2TP') {
    checks.push({ ...L2TP_CHECK, filled: isFilled(getProp('l2tp_username')) });
  }

  // Wi-Fi — показываем всегда
  checks.push({ ...WIFI_CHECK, filled: isFilled(getProp('wifi_name')) });

  const filledCount = checks.filter(c => c.filled).length;
  const totalCount = checks.length;

  let status: RouterConfigStatus;
  if (filledCount === 0) {
    status = 'no_data';
  } else if (filledCount === totalCount) {
    status = 'configured';
  } else {
    status = 'incomplete';
  }

  return { status, filledCount, totalCount, checks };
}

export function getRouterConfigColor(status: RouterConfigStatus): string {
  switch (status) {
    case 'configured': return '#2e7d32';
    case 'incomplete': return '#ed6c02';
    case 'no_data': return '#757575';
  }
}
