// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'office' | 'client_contact' | 'client_admin';
  user_type: 'internal' | 'client';
  client_id?: string;
  preferred_locale?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
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

// Ticket types
export interface Ticket {
  id: string;
  ticket_number: string;
  client_id: string;
  site_id: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  status_id: string;
  source_channel: string;
  reported_via?: string;
  service_scope: string;
  contact_phone: string;
  contact_name?: string;
  assigned_to_internal_user_id?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface TicketCreate {
  client_id: string;
  site_id: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  source_channel: string;
  reported_via?: string;
  service_scope?: string;
  contact_phone: string;
  contact_person_id?: string;
  contact_name?: string;
  contact_email?: string;
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
  events?: TicketEvent[];
  work_logs?: WorkLog[];
  line_items?: LineItem[];
  linked_assets?: string[];
}

// Asset types
export interface Asset {
  id: string;
  client_id: string;
  site_id: string;
  asset_type_code: string;
  label: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetCreate {
  client_id: string;
  site_id: string;
  asset_type_code: string;
  label: string;
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

export interface AssetDetailResponse extends Asset {
  properties?: AssetProperty[];
  events?: any[];
  linked_tickets?: Ticket[];
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
  display_name_he: string;
  display_name_en: string;
  icon?: string;
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
