// Attachment types
export type LinkedType = 'ticket' | 'asset' | 'project' | 'site' | 'client';

export interface Attachment {
  id: string;
  linked_type: LinkedType;
  linked_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_actor_display: string;
  created_at: string;
}

export interface AttachmentListResponse {
  items: Attachment[];
  total: number;
}

// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'office' | 'client_contact' | 'client_admin';
  user_type: 'internal' | 'portal';
  client_id?: string;  // Active client (for portal users)
  primary_client_id?: string;  // Home client (for CLIENT_ADMIN)
  allowed_client_ids?: string[];  // All assigned clients (for CLIENT_ADMIN)
  preferred_locale?: string;
}

// Internal User types (for admin management)
export interface InternalUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'technician' | 'office';
  is_active: boolean;
  preferred_locale?: string;
  created_at: string;
  updated_at: string;
}

export interface InternalUserCreate {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'admin' | 'technician' | 'office';
  is_active?: boolean;
  preferred_locale?: string;
}

export interface InternalUserUpdate {
  name?: string;
  email?: string;
  phone?: string;
  role?: 'admin' | 'technician' | 'office';
  is_active?: boolean;
  preferred_locale?: string;
}

export interface InternalUserListResponse {
  items: InternalUser[];
  total: number;
  page?: number;
  page_size?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// Multi-client support types for CLIENT_ADMIN users
export interface ClientOption {
  id: string;
  name: string;
}

export interface SwitchClientRequest {
  client_id: string;
}

export interface SwitchClientResponse {
  access_token: string;
  token_type: string;
  client_id: string;
  client_name: string;
}

// Client types
export interface Client {
  id: string;
  name: string;
  tax_id?: string;
  main_phone?: string;
  main_email?: string;
  main_address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientCreate {
  name: string;
  tax_id?: string;
  main_phone?: string;
  main_email?: string;
  main_address?: string;
  is_active?: boolean;
}

export interface ClientUpdate {
  name?: string;
  tax_id?: string;
  main_phone?: string;
  main_email?: string;
  main_address?: string;
  is_active?: boolean;
}

export interface ClientListResponse {
  items: Client[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Site types
export interface Site {
  id: string;
  client_id: string;
  name: string;
  address?: string;
  is_default: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SiteCreate {
  client_id: string;
  name: string;
  address?: string;
  is_default?: boolean;
  notes?: string;
}

export interface SiteUpdate {
  name?: string;
  address?: string;
  is_default?: boolean;
  notes?: string;
}

export interface SiteListResponse {
  items: Site[];
  total: number;
}

// Contact types
export interface Contact {
  id: string;
  client_id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  notes?: string;
  applies_to_all_sites: boolean;
  site_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  client_id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  notes?: string;
  applies_to_all_sites: boolean;
  site_ids?: string[];
}

export interface ContactUpdate {
  name?: string;
  phone?: string;
  email?: string;
  position?: string;
  notes?: string;
  applies_to_all_sites?: boolean;
  site_ids?: string[];
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
}

// Contact info (minimal for ticket responses)
export interface ContactInfo {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

// Ticket types
export interface TicketStatus {
  id: string;
  code: string;
  name_en: string;
  name_he: string;
  is_default: boolean;
  is_closed_state: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface TicketCategory {
  id: string;
  code: string;
  name_en?: string;
  name_he?: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  client_id: string;
  site_id: string;
  title: string;
  description: string;
  category_id?: string;
  category_code?: string;
  category_name?: string;
  priority?: string;
  status_id: string;
  status_code?: string;
  source_channel: string;
  reported_via?: string;
  service_scope: string;
  contact_phone: string;
  contact_person_id?: string;
  callback_contact_id?: string;
  contact_person?: ContactInfo;
  callback_contact?: ContactInfo;
  assigned_to_internal_user_id?: string;
  assigned_to_name?: string; // Technician name for display
  asset_id?: string; // Primary asset this ticket is about
  created_by_type?: string; // 'internal' | 'client' | 'system'
  created_by_name?: string; // Creator name for display
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface TicketCreate {
  client_id: string;
  site_id: string;
  title: string;
  description: string;
  category_id?: string;
  priority?: string;
  source_channel: string;
  reported_via: string;
  service_scope?: string;
  contact_phone: string;
  contact_person_id: string;
  callback_contact_id?: string;
  asset_id?: string; // Primary asset this ticket is about (optional)
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  event_type: string;
  message: string;
  actor_type: string;
  actor_display: string;
  created_at: string;
}

export interface WorkLog {
  id: string;
  ticket_id: string;
  work_type: string;
  description: string;
  start_at?: string;
  end_at?: string;
  duration_minutes?: number;
  included_in_service: boolean;
  billing_note?: string;
  actor_display: string;
  created_at: string;
}

export interface WorkLogCreate {
  work_type: string;
  description: string;
  start_at?: string;
  end_at?: string;
  duration_minutes?: number;
  included_in_service: boolean;
  billing_note?: string;
}

export interface LineItem {
  id: string;
  ticket_id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  included_in_service: boolean;
  chargeable: boolean;
  external_reference?: string;
  created_at: string;
}

export interface LineItemCreate {
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  included_in_service: boolean;
  chargeable: boolean;
  external_reference?: string;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
}

export interface TicketDetailResponse extends Ticket {
  status?: TicketStatus;
  category?: TicketCategory;
  events?: TicketEvent[];
  work_logs?: WorkLog[];
  line_items?: LineItem[];
  linked_assets?: string[];
}

// Health status type for equipment monitoring
export type HealthStatus = 'ok' | 'warning' | 'critical' | 'unknown';

// Asset types
export interface Asset {
  id: string;
  client_id: string;
  site_id: string;
  asset_type_id: string;
  asset_type_code: string;
  label: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  status: string;
  notes?: string;
  // Key network properties for list display
  wan_public_ip?: string;
  lan_ip_address?: string;
  // Health monitoring fields
  health_status: HealthStatus;
  health_issues?: string[];  // List of issue codes like ['HDD_1_SMART_FAIL', 'CAMERAS_OFFLINE_2']
  last_probe_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetCreate {
  client_id: string;
  site_id: string;
  asset_type_id: string;
  label: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  status?: string;
  notes?: string;
  properties?: Record<string, any>;
}

export interface AssetUpdate {
  label?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  status?: string;
  notes?: string;
  properties?: Record<string, any>;
}

export interface AssetProperty {
  key: string;
  label: string;
  value: any;
  data_type: string;
}

export interface AssetPropertyDefinition {
  id: string;
  asset_type_id: string;
  key: string;
  label_he?: string;
  label_en?: string;
  data_type: 'string' | 'int' | 'bool' | 'date' | 'decimal' | 'enum' | 'secret';
  required: boolean;
  visibility: 'internal_only' | 'client_admin' | 'client_all';
}

// Ticket summary for asset details page
export interface AssetTicketSummary {
  id: string;
  ticket_number: string;
  title: string;
  status_id: string;
  status_code?: string;
  is_closed: boolean;
  priority: string;
  created_at: string;
}

export interface AssetDetailResponse extends Asset {
  asset_type?: AssetType;
  properties?: AssetProperty[];
  events?: any[];
  linked_tickets?: Ticket[];
  tickets?: AssetTicketSummary[]; // Service tickets for this asset (via asset_id FK)
  has_active_ticket?: boolean; // True if any non-closed ticket exists
}

export interface AssetListResponse {
  items: Asset[];
  total: number;
  page: number;
  page_size: number;
}

export interface AssetType {
  id: string;
  code: string;
  name_he?: string;
  name_en?: string;
}

export interface AssetUsageSummary {
  asset_id: string;
  asset_label: string;
  asset_type: string | null;
  client_name: string | null;
  site_name: string | null;
  usage: {
    tickets_total: number;
    tickets_open: number;
    has_open_tickets: boolean;
    nvr_disks_count: number;
    nvr_disks: Array<{
      id: string;
      slot: number;
      serial_number: string;
      capacity_gb: number;
      status: string;
    }>;
    properties_count: number;
    events_count: number;
    projects_count: number;
  };
  will_be_deleted: {
    property_values: number;
    events: number;
    nvr_disks: number;
    project_links: number;
    ticket_links: number;
  };
  will_be_preserved: {
    tickets: number;
    clients: number;
    sites: number;
  };
}

export interface AssetEvent {
  id: string;
  asset_id: string;
  ticket_id?: string | null;
  event_type: string;
  details?: string | null;
  actor_type: string;
  actor_id?: string | null;
  actor_display: string;
  created_at: string;
}

// Hikvision types
export interface HikvisionProbeRequest {
  host: string;
  port?: number;       // Service Port for SDK (default 8000)
  web_port?: number;   // Web Port for ISAPI (default 80)
  username: string;
  password: string;
  proto?: 'http' | 'https';
  timeout?: number;
}

export interface HikvisionDeviceInfo {
  model?: string;
  deviceName?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  macAddress?: string;
  maxChannels?: number;
}

export interface HikvisionDiskInfo {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  capacity_mb?: number;
  free_mb?: number;
  capacity_nominal_tb?: number;
  free_human?: string;
  used_percent?: number;
  // S.M.A.R.T. data from hik_monitor_lib
  working_hours?: number;     // Power-on hours from S.M.A.R.T.
  temperature?: number;       // Temperature in Celsius
  smart_status?: string;      // Pass/Fail/Warning
  is_critical?: boolean;      // HDD requires attention
  model?: string;             // HDD model name (legacy - same as serial)
  // Explicit slot and serial fields for clarity
  slot?: number;              // Slot number (1-based)
  serial?: string;            // HDD serial number (e.g., WD-WCC4E...)
}

export interface HikvisionStorageInfo {
  disk_count: number;
  disks: HikvisionDiskInfo[];
}

export interface HikvisionChannelDetail {
  channel_number: number;       // Display number (D1=1, D2=2, etc.)
  name?: string;                // Channel name from NVR
  ip_address?: string;          // Camera IP address (LTR)
  protocol?: string;            // Connection protocol
  is_configured: boolean;       // Channel has camera configured
  is_online: boolean;           // Camera is online
  // Recording status (24h check)
  has_recording_24h: boolean;   // Has recordings in last 24 hours
  recording_files_count?: number;
  recording_size_gb?: number;
}

export interface HikvisionCameraInfo {
  total: number;
  online: number;
  offline: number;
  // Recording summary
  recording_ok: number;         // Channels with recordings in last 24h
  recording_missing: number;    // Configured channels without recordings
  // Detailed channel list
  channels: HikvisionChannelDetail[];
}

export interface HikvisionNetworkInfo {
  lan_ips: string[];
}

export interface HikvisionProbeMeta {
  success: boolean;
  errors: Record<string, string>;
  used_proto?: string;
  base_url?: string;
  // Time drift detection from hik_monitor_lib
  time_drift_seconds?: number;   // Time diff between NVR and server
  nvr_time?: string;             // NVR time as ISO string
  time_sync_status?: string;     // ok/drift/synced/error
}

export interface HikvisionHealthSummary {
  total_hdd: number;
  healthy_hdd: number;
  critical_hdd: number;
  total_channels: number;
  configured_channels: number;
  online_channels: number;
  offline_channels: number;
  unconfigured_channels: number;
  channels_with_recordings: number;
  overall_status: 'healthy' | 'ok' | 'warning' | 'critical';
}

export interface HikvisionProbeResponse {
  device: HikvisionDeviceInfo;
  network: HikvisionNetworkInfo;
  storage: HikvisionStorageInfo;
  cameras: HikvisionCameraInfo;
  health_summary?: HikvisionHealthSummary;
  meta: HikvisionProbeMeta;
}

// Audit types
export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values_json?: Record<string, any>;
  new_values_json?: Record<string, any>;
  actor_type: string;
  actor_id?: string;
  actor_display: string;
  created_at: string;
}

export interface AuditEventListResponse {
  items: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
}

// NVR Disk types
export interface NVRDisk {
  id: string;
  asset_id: string;
  slot_number?: number;
  capacity_tb: number;
  install_date: string;
  serial_number?: string;
  // S.M.A.R.T. health data
  status?: string;  // ok, warning, error, unknown
  working_hours?: number;  // Power-on hours
  temperature?: number;  // Celsius
  smart_status?: string;  // Pass, Fail, Warning
  created_at: string;
  updated_at: string;
}

export interface NVRDiskCreate {
  slot_number?: number;
  capacity_tb: number;
  install_date: string;
  serial_number?: string;
  // S.M.A.R.T. health data
  status?: string;
  working_hours?: number;
  temperature?: number;
  smart_status?: string;
}

export interface NVRDiskUpdate {
  slot_number?: number;
  capacity_tb?: number;
  install_date?: string;
  serial_number?: string;
  status?: string;
  working_hours?: number;
  temperature?: number;
  smart_status?: string;
}

// ========== NVR Channel Types ==========

export interface NVRChannelBulkUpdate {
  channel_number: number;  // 1-64
  custom_name?: string;  // User-friendly name (e.g., "Main Entrance")
  is_ignored: boolean;  // Exclude from health monitoring
  notes?: string;  // Service info: port, camera model, location
}

export interface NVRChannelBulkUpdateRequest {
  channels: NVRChannelBulkUpdate[];
}

export interface ChannelWithStatus {
  channel_number: number;
  // Customization fields (from nvr_channels table)
  custom_name?: string;
  is_ignored: boolean;
  notes?: string;
  // Live status fields (from last_probe_result)
  name?: string;  // Device-reported name (e.g., "D1")
  ip_address?: string;
  is_configured: boolean;  // Whether channel is configured on device
  is_online: boolean;
  has_recording_24h: boolean;
  // Audit fields
  updated_by_actor_display?: string;
  updated_at?: string;
}

// ========== Deletion Types ==========

export interface ClientUsageStats {
  sites_count: number;
  contacts_count: number;
  client_users_count: number;
  tickets_total: number;
  tickets_open: number;
  assets_count: number;
  projects_count: number;
}

export interface ClientDeletionSummary {
  client_id: string;
  client_name: string;
  usage: ClientUsageStats;
  can_delete: boolean;
  blocking_reason?: string;
  will_be_deleted: Record<string, number>;
  will_be_affected: Record<string, number>;
}

export interface SiteUsageStats {
  locations_count: number;
  contacts_linked_count: number;
  tickets_total: number;
  tickets_open: number;
  assets_count: number;
}

export interface SiteDeletionSummary {
  site_id: string;
  site_name: string;
  client_id: string;
  client_name: string;
  usage: SiteUsageStats;
  can_delete: boolean;
  blocking_reason?: string;
  will_be_deleted: Record<string, number>;
  will_be_affected: Record<string, number>;
}

export interface TicketDeletionSummary {
  ticket_id: string;
  ticket_number: string;
  will_be_deleted: Record<string, number>;
}

export interface DeletionResponse {
  success: boolean;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  deleted_counts: Record<string, number>;
  message: string;
}

// OCR Label Scanning

export interface OcrMappedField {
  ocr_key: string;
  value: string | null;
  raw_value: string | null;
  confidence: number;
  alternatives: string[];
  crm_property_key: string | null;
  crm_basic_field: string | null;
  label_en: string;
  label_he: string;
}

export interface LabelScanResult {
  fields: OcrMappedField[];
  ocr_confidence: number;
  provider_name: string;
  processing_time_ms: number;
  rotation_applied: number;
  raw_text: string;
  warnings: string[];
}
