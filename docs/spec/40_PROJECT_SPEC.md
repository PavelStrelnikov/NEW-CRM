# Project Spec — v1.0 (MVP)

Purpose:
- handle long-running work: new branch openings, renovations, installations
- attach tickets, assets, files, notes, milestones

Entities:
- projects
- project_site_links (project can cover multiple sites)
- project_ticket_links
- project_asset_links
- project_events
- attachments (linked_type=project)

Rules:
- project is not a ticket; tickets can be linked to a project
- project progress tracked by status + events
