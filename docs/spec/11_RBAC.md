# RBAC (Permissions Matrix) — v1.0

Roles:
- internal: admin, technician, office
- client: client_contact, client_admin

Secrets flags (global or per client later):
- client_admin_can_view_secrets (default false)
- technician_can_edit_secrets (default configurable)

Key rules:
- Ticket initiator != callback contact.
- Ticket contact_phone is mandatory.
- Client_contact scope limited (by site or own tickets).
- Client_admin scope = whole client.

Permissions (MVP):

Admin:
- full CRUD on all entities, manage status definitions, manage users, view/edit secrets, manage reports export.

Technician:
- tickets: create/update/status change/close, add work_logs, add line_items, link assets, upload attachments
- assets: create/update, view secrets, edit secrets (configurable)
- reports: view internal basic
- users/integrations: no

Office:
- tickets: create/update/comment, add work_logs (optional), upload attachments
- assets: read, no secrets
- reports: generate/send
- status change: allowed (optional) but no closed unless admin/tech

Client_contact:
- tickets: create, view limited to allowed sites (or initiator-only), comment, upload attachments
- reports: single ticket report for own tickets
- assets: none

Client_admin:
- tickets: create, view all client tickets, comment, attachments
- assets: view + edit (except secrets unless flag enabled)
- reports: client and site reports
