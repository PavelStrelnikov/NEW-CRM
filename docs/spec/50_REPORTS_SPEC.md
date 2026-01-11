# Reports Spec — v1.1 (MVP)

Core filters:
- period: date_from, date_to
- scope: client_id and/or site_id and/or ticket_id and/or asset_id

Report types:

1) Client Summary (period)
- ticket counts: total, included, not_included, mixed
- time totals: included minutes, not included minutes
- breakdown by work_type
- line items summary: included vs chargeable

2) Client Detailed (period)
- list tickets with: site, title, status, service_scope
- per ticket: work logs + included/not included totals
- per ticket: line items marked chargeable

3) Site Report (period)
- same as client reports but only for one site

4) Single Ticket Report
- full ticket details + history
- work logs
- line items
- linked assets

5) Asset Service History (period)
- linked tickets
- asset events
- time spent on that asset (via ticket_asset_links)

Rules:
- all time is from work_logs
- "included vs not included" uses flags on work_logs and ticket_line_items
- exports: HTML and PDF in MVP
- client portal:
  - client_admin can generate client/site reports
  - client_contact can download own ticket report
