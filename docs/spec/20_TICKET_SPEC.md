# Ticket Spec — v1.1 (MVP)
This supersedes earlier drafts.

Entities:
- tickets
- ticket_initiators
- ticket_events
- work_logs
- ticket_line_items
- attachments (linked_type=ticket)

Must have:
- source_channel + initiator recorded for every ticket
- callback contact (phone required) may differ from initiator
- custom status definitions (admin-managed)
- time tracking via work_logs
- "included vs not included" at both ticket and work_log/line_item levels

Validation:
- ticket: client_id, site_id, title, description, source_channel, initiator, contact_phone, (contact_person_id OR contact_name)
- work_log: either (start_at,end_at) or duration_minutes > 0
- close: status.is_closed_state=true and at least one comment or work_log summary

Service scope:
- ticket.service_scope: included / not_included / mixed
- work_log.included_in_service: true/false
- ticket_line_item.included_in_service + chargeable true/false
