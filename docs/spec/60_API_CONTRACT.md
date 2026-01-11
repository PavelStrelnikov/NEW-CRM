# API Contract — v1.0 (MVP)
Base: /api/v1
Auth: session cookie or JWT (choose one; JWT recommended for future integrations even if not used now)

General:
- All endpoints return JSON
- Errors: { "error": { "code": "...", "message": "...", "details": ... } }
- Pagination: ?page=1&page_size=25 (or cursor-based later)
- Sorting: ?sort=-created_at
- Search: ?q=...

## 1) Auth

POST /auth/login
- body: { email, password }
- resp: { user: {...}, token? }

POST /auth/logout

GET /auth/me
- resp: { user, role, client_scope? }

## 2) Clients & Sites & Contacts

GET /clients?q=
POST /clients
GET /clients/{clientId}
PATCH /clients/{clientId}

POST /clients/{clientId}/sites
GET /clients/{clientId}/sites
PATCH /sites/{siteId}

POST /clients/{clientId}/contacts
GET /clients/{clientId}/contacts?q=
PATCH /contacts/{contactId}

POST /contacts/{contactId}/sites
- body: { site_ids: [...] }  # replaces links

GET /sites/{siteId}/locations
POST /sites/{siteId}/locations
PATCH /locations/{locationId}

## 3) Ticket Status Definitions (Admin)

GET /ticket-statuses
POST /ticket-statuses
PATCH /ticket-statuses/{statusId}
- supports: activate/deactivate, sort_order, is_default, is_closed_state

## 4) Tickets

GET /tickets?q=&client_id=&site_id=&status_id=&date_from=&date_to=&service_scope=
- must apply RBAC filters:
  - client_contact -> limited scope
  - client_admin -> client scope
  - internal -> all

POST /tickets
Body (MVP):
{
  "client_id": "...",
  "site_id": "...",
  "title": "...",
  "description": "...",
  "category": "CCTV|Network|PC|Alarm|Other|null",
  "priority": "low|normal|high|urgent|null",
  "source_channel": "portal|email|whatsapp|telegram|manual|api",
  "reported_via": "portal|phone|email|whatsapp|telegram|null",
  "initiator": {
    "initiator_type": "internal_user|client_user|external_identity|integration",
    "initiator_ref_id": "...|null",
    "initiator_display": "..."
  },
  "contact": {
    "contact_person_id": "...|null",
    "contact_name": "...|null",
    "contact_phone": "...",
    "contact_email": "...|null"
  },
  "service_scope": "included|not_included|mixed",
  "service_note": "..."
}

GET /tickets/{ticketId}
- include:
  - initiator
  - events (paged or last N)
  - work_logs
  - line_items
  - linked_assets

PATCH /tickets/{ticketId}
- allow: title/description/category/priority/contact fields/service_scope/service_note
- status change via dedicated endpoint (preferred)

POST /tickets/{ticketId}/status
Body: { "status_id": "...", "comment": "optional" }
- Creates ticket_event(status_change)
- If status is closed state -> set closed_at; enforce close validation

POST /tickets/{ticketId}/assign
Body: { "assigned_to_internal_user_id": "...|null" }
- Creates ticket_event(assignment_change)

## 5) Ticket Events (comments)

POST /tickets/{ticketId}/events
Body:
{
  "event_type": "comment|system_note",
  "message": "..."
}
- actor inferred from auth

## 6) Work Logs (time tracking)

POST /tickets/{ticketId}/work-logs
Body:
{
  "work_type": "phone|remote|onsite|travel|repair_lab|admin",
  "description": "...",
  "start_at": "ISO|null",
  "end_at": "ISO|null",
  "duration_minutes": 15|null,
  "included_in_service": true|false,
  "billing_note": "optional"
}
- validates start/end vs duration
- creates ticket_event(work_logged)

PATCH /work-logs/{workLogId}
DELETE /work-logs/{workLogId}

## 7) Ticket Line Items (materials/equipment/services)

POST /tickets/{ticketId}/line-items
Body:
{
  "item_type": "material|equipment|service|other",
  "description": "...",
  "quantity": 1,
  "unit": "pcs|tb|hours|...",
  "included_in_service": true|false,
  "chargeable": true|false,
  "external_reference": "optional",
  "linked_asset_id": "optional"
}

PATCH /line-items/{lineItemId}
DELETE /line-items/{lineItemId}

## 8) Asset Inventory

GET /assets?q=&client_id=&site_id=&asset_type=&serial=&wan_ip=
POST /assets
Body:
{
  "client_id": "...",
  "site_id": "...",
  "asset_type_code": "NVR|DVR|ROUTER|SWITCH|ACCESS_POINT|...",
  "label": "...",
  "manufacturer": "...",
  "model": "...",
  "serial_number": "optional",
  "install_date": "YYYY-MM-DD|null",
  "status": "active|in_repair|replaced|retired",
  "location_id": "optional",
  "notes": "optional",
  "properties": {
     "key": "value"  # dynamic fields by definitions
  }
}

GET /assets/{assetId}
- include:
  - properties (resolved with definitions)
  - events
  - linked tickets (via ticket_asset_links)
  - attachments

PATCH /assets/{assetId}
- update base fields + properties
- secret updates must log asset_event

GET /asset-types
GET /asset-property-definitions?asset_type_code=

(Admin) POST /asset-property-definitions
(Admin) PATCH /asset-property-definitions/{id}

## 9) NVR Disks (simple)

GET /assets/{assetId}/nvr-disks
POST /assets/{assetId}/nvr-disks
PATCH /nvr-disks/{diskId}
DELETE /nvr-disks/{diskId}
- each change creates asset_event(disk_added/replaced/removed)

## 10) Router structured (optional in MVP)
(You can implement as asset properties only; these endpoints are optional.)

GET /assets/{routerId}/port-forwards
POST /assets/{routerId}/port-forwards
PATCH /router-port-forwards/{id}
DELETE /router-port-forwards/{id}

GET /assets/{routerId}/vlans
POST /assets/{routerId}/vlans
PATCH /router-vlans/{id}
DELETE /router-vlans/{id}

GET /assets/{routerId}/wifi
POST /assets/{routerId}/wifi
PATCH /router-wifi-networks/{id}
DELETE /router-wifi-networks/{id}

## 11) Projects

GET /projects?q=&client_id=&status=
POST /projects
GET /projects/{projectId}
PATCH /projects/{projectId}

POST /projects/{projectId}/sites   { site_ids: [...] }
POST /projects/{projectId}/tickets { ticket_ids: [...] }
POST /projects/{projectId}/assets  { asset_ids: [...] }

POST /projects/{projectId}/events
Body: { event_type: "note|status_change|milestone", message: "..." }

## 12) Attachments

POST /attachments
Multipart:
- linked_type (ticket|asset|project|site|client)
- linked_id
- file

GET /attachments?linked_type=&linked_id=

## 13) Reports (MVP generate & download)

POST /reports/client-summary
Body: { client_id, date_from, date_to, format: "html|pdf" }

POST /reports/client-detailed
POST /reports/site
POST /reports/ticket
POST /reports/asset-history

Return:
- { report_id, status } and then:
GET /reports/{reportId}/download
(or immediate file response for simplicity)
