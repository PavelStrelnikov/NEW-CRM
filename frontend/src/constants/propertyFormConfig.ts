/**
 * Конфигурация группировки и динамической видимости свойств ассетов.
 *
 * Вся логика основана на property.key — НЕ на asset_type.
 * Расширяемо: чтобы добавить поддержку нового типа (Firewall, VPN),
 * достаточно добавить его ключи в существующие или новые группы.
 */

// ─── Скрытые свойства ─────────────────────────────────────────────────────────
// Ключи, которые НИКОГДА не отображаются в форме.
// Данные в БД сохраняются — скрытие только в UI.

export const HIDDEN_PROPERTY_KEYS = new Set([
  // Legacy ROUTER поля — устаревшие, заменены новой моделью
  'dialer_type',
  'internet_username',
  'internet_password',
  'ddns_name',
  'wan_ip_type',
  'wan_public_ip',

  // Скрытые из формы — избыточные
  'wifi_enabled',
  'lan_ip_static',
  'lan_ip_address',
  'lan_subnet',
  'internal_notes',
  'client_notes',

  // Legacy ACCESS_POINT поля — заменены упрощённой моделью
  'management_type',
  'controller_name',
  'management_ip',     // AP legacy
  'wifi_ssid_primary',
  'wifi_password_primary',

  // Legacy SWITCH поля — заменены упрощённой моделью
  'is_managed',        // заменено на switch_managed
  'poe_port_count',    // заменено на poe_ports_count
  'uplink_port_count',
  'poe_standard',
]);

// ─── Скрытые свойства per asset_type ──────────────────────────────────────────
// Ключи, скрытые ТОЛЬКО для конкретных типов ассетов.
// Нужны когда legacy-свойство (например admin_username) есть в БД для данного типа,
// но его UI заменён группой другого типа (ROUTER/SWITCH).
export const HIDDEN_PROPERTY_KEYS_PER_TYPE: Record<string, Set<string>> = {
  ACCESS_POINT: new Set(['admin_username', 'admin_password']),
};

// ─── Скрытые core-поля формы (per asset_type.code) ──────────────────────────
// Ключи базовых полей (manufacturer, model, serial_number), которые скрыты
// для определённых типов ассетов. Расширяемо: добавь код типа → Set полей.

export const HIDDEN_BASIC_FIELDS: Record<string, Set<string>> = {
  ROUTER: new Set(['manufacturer', 'model']),
  ACCESS_POINT: new Set(['manufacturer', 'model']),
  SWITCH: new Set(['manufacturer', 'model']),
};

/** Проверить, скрыто ли core-поле для данного типа ассета. */
export function isBasicFieldHidden(field: string, assetTypeCode?: string): boolean {
  if (!assetTypeCode) return false;
  return HIDDEN_BASIC_FIELDS[assetTypeCode]?.has(field) ?? false;
}

// ─── Группы свойств ───────────────────────────────────────────────────────────

export interface PropertyGroup {
  /** Уникальный id группы */
  id: string;
  /** i18n-ключ для заголовка группы (assets.propGroup.*) */
  titleKey: string;
  /** Property keys, входящие в эту группу (порядок = порядок отображения) */
  keys: string[];
  /** Коды asset_type, для которых группа применима. undefined = для всех типов. */
  assetTypes?: string[];
}

export const PROPERTY_GROUPS: PropertyGroup[] = [
  // ── ROUTER группы ──
  {
    id: 'internet',
    titleKey: 'assets.propGroup.internet',
    keys: ['provider_name', 'wan_connection_type'],
    assetTypes: ['ROUTER'],
  },
  {
    id: 'pppoe',
    titleKey: 'assets.propGroup.pppoe',
    keys: ['pppoe_username', 'pppoe_password'],
    assetTypes: ['ROUTER'],
  },
  {
    id: 'l2tp',
    titleKey: 'assets.propGroup.l2tp',
    keys: ['l2tp_server', 'l2tp_username', 'l2tp_password'],
    assetTypes: ['ROUTER'],
  },
  {
    id: 'routerAccess',
    titleKey: 'assets.propGroup.routerAccess',
    keys: ['admin_username', 'admin_password'],
    assetTypes: ['ROUTER'],
  },
  {
    id: 'wifi',
    titleKey: 'assets.propGroup.wifi',
    keys: ['wifi_name', 'wifi_password'],
    assetTypes: ['ROUTER'],
  },
  // ── ACCESS_POINT группы ──
  {
    id: 'apGeneral',
    titleKey: 'assets.propGroup.apGeneral',
    keys: ['ap_brand', 'ap_quantity'],
    assetTypes: ['ACCESS_POINT'],
  },
  {
    id: 'apWifi',
    titleKey: 'assets.propGroup.wifi',
    keys: ['wifi_ssid', 'wifi_password'],
    assetTypes: ['ACCESS_POINT'],
  },
  {
    id: 'apNotes',
    titleKey: 'assets.propGroup.notes',
    keys: ['notes'],
    assetTypes: ['ACCESS_POINT'],
  },
  // ── SWITCH группы ──
  {
    id: 'switchGeneral',
    titleKey: 'assets.propGroup.switchGeneral',
    keys: ['switch_brand', 'switch_quantity', 'switch_managed'],
    assetTypes: ['SWITCH'],
  },
  {
    id: 'switchPorts',
    titleKey: 'assets.propGroup.switchPorts',
    keys: ['total_ports', 'poe_supported', 'poe_ports_count'],
    assetTypes: ['SWITCH'],
  },
  {
    id: 'switchAccess',
    titleKey: 'assets.propGroup.switchAccess',
    keys: ['admin_username', 'admin_password'],
    assetTypes: ['SWITCH'],
  },
  {
    id: 'switchNotes',
    titleKey: 'assets.propGroup.notes',
    keys: ['notes'],
    assetTypes: ['SWITCH'],
  },
];

// ─── Динамическая видимость ───────────────────────────────────────────────────

export interface VisibilityRule {
  key: string;
  isVisible: (values: Record<string, any>) => boolean;
}

export const VISIBILITY_RULES: VisibilityRule[] = [
  // PPPoE поля видны ТОЛЬКО если wan_connection_type === 'PPPoE'
  { key: 'pppoe_username', isVisible: (v) => v.wan_connection_type === 'PPPoE' },
  { key: 'pppoe_password', isVisible: (v) => v.wan_connection_type === 'PPPoE' },

  // L2TP поля видны ТОЛЬКО если wan_connection_type === 'L2TP'
  { key: 'l2tp_server', isVisible: (v) => v.wan_connection_type === 'L2TP' },
  { key: 'l2tp_username', isVisible: (v) => v.wan_connection_type === 'L2TP' },
  { key: 'l2tp_password', isVisible: (v) => v.wan_connection_type === 'L2TP' },

  // SWITCH: poe_ports_count видно ТОЛЬКО если poe_supported = true
  { key: 'poe_ports_count', isVisible: (v) => v.poe_supported === true || v.poe_supported === 'true' },
];

// ─── Правила видимости групп ──────────────────────────────────────────────────

export interface GroupVisibilityRule {
  groupId: string;
  isVisible: (values: Record<string, any>) => boolean;
}

export const GROUP_VISIBILITY_RULES: GroupVisibilityRule[] = [
  { groupId: 'pppoe', isVisible: (v) => v.wan_connection_type === 'PPPoE' },
  { groupId: 'l2tp', isVisible: (v) => v.wan_connection_type === 'L2TP' },
  // SWITCH: Access-группа видна только если switch_managed = true
  { groupId: 'switchAccess', isVisible: (v) => v.switch_managed === true || v.switch_managed === 'true' },
];

// ─── Enum-опции для select-полей ──────────────────────────────────────────────

export interface EnumOption {
  value: string;
  labelKey: string;
}

export const ENUM_OPTIONS: Record<string, EnumOption[]> = {
  wan_connection_type: [
    { value: 'DHCP', labelKey: 'assets.enumWan.dhcp' },
    { value: 'Static', labelKey: 'assets.enumWan.static' },
    { value: 'PPPoE', labelKey: 'assets.enumWan.pppoe' },
    { value: 'L2TP', labelKey: 'assets.enumWan.l2tp' },
  ],
  provider_name: [
    { value: 'Bezeq', labelKey: 'assets.enumProvider.bezeq' },
    { value: 'HOT', labelKey: 'assets.enumProvider.hot' },
    { value: 'Partner', labelKey: 'assets.enumProvider.partner' },
    { value: 'Cellcom', labelKey: 'assets.enumProvider.cellcom' },
    { value: 'Other', labelKey: 'assets.enumProvider.other' },
  ],
  ap_brand: [
    { value: 'Cisco', labelKey: 'assets.enumBrand.cisco' },
    { value: 'Aruba', labelKey: 'assets.enumBrand.aruba' },
    { value: 'Ubiquiti', labelKey: 'assets.enumBrand.ubiquiti' },
    { value: 'TP-Link', labelKey: 'assets.enumBrand.tplink' },
    { value: 'DrayTek', labelKey: 'assets.enumBrand.draytek' },
    { value: 'MikroTik', labelKey: 'assets.enumBrand.mikrotik' },
    { value: 'Other', labelKey: 'assets.enumBrand.other' },
  ],
  switch_brand: [
    { value: 'Cisco', labelKey: 'assets.enumBrand.cisco' },
    { value: 'Aruba', labelKey: 'assets.enumBrand.aruba' },
    { value: 'Ubiquiti', labelKey: 'assets.enumBrand.ubiquiti' },
    { value: 'TP-Link', labelKey: 'assets.enumBrand.tplink' },
    { value: 'D-Link', labelKey: 'assets.enumBrand.dlink' },
    { value: 'Netgear', labelKey: 'assets.enumBrand.netgear' },
    { value: 'MikroTik', labelKey: 'assets.enumBrand.mikrotik' },
    { value: 'Other', labelKey: 'assets.enumBrand.other' },
  ],
};

// ─── Helper-функции ───────────────────────────────────────────────────────────

const visibilityMap = new Map(VISIBILITY_RULES.map(r => [r.key, r]));
const groupVisibilityMap = new Map(GROUP_VISIBILITY_RULES.map(r => [r.groupId, r]));

/**
 * Проверить, видимо ли свойство.
 * Скрытые ключи (HIDDEN_PROPERTY_KEYS) → всегда false.
 * Скрытые per-type ключи (HIDDEN_PROPERTY_KEYS_PER_TYPE) → false для данного типа.
 * Ключи с правилами → по условию.
 * Остальные → всегда видимы.
 */
export function isPropertyVisible(key: string, values: Record<string, any>, assetTypeCode?: string): boolean {
  if (HIDDEN_PROPERTY_KEYS.has(key)) return false;
  if (assetTypeCode && HIDDEN_PROPERTY_KEYS_PER_TYPE[assetTypeCode]?.has(key)) return false;
  const rule = visibilityMap.get(key);
  if (!rule) return true;
  return rule.isVisible(values);
}

/** Проверить, видима ли группа целиком. */
export function isGroupVisible(groupId: string, values: Record<string, any>): boolean {
  const rule = groupVisibilityMap.get(groupId);
  if (!rule) return true;
  return rule.isVisible(values);
}

/**
 * Получить группы, применимые для данного asset_type.
 * Если assetTypeCode не задан — возвращает все группы (обратная совместимость).
 */
export function getGroupsForAssetType(assetTypeCode?: string): PropertyGroup[] {
  if (!assetTypeCode) return PROPERTY_GROUPS;
  return PROPERTY_GROUPS.filter(g =>
    !g.assetTypes || g.assetTypes.includes(assetTypeCode)
  );
}

/**
 * Проверить, принадлежит ли ключ какой-либо группе для данного asset_type.
 * Учитывает assetTypes каждой группы.
 */
export function isKeyGrouped(key: string, assetTypeCode?: string): boolean {
  const groups = getGroupsForAssetType(assetTypeCode);
  return groups.some(g => g.keys.includes(key));
}
