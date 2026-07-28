# Folio Product and Scale Roadmap

This roadmap separates low-risk quality-of-life improvements from capabilities that materially change Folio's operating model. Items are ordered by customer value and architectural dependency.

## Current foundation

- Tauri desktop hub with local SQLite, backups, updates, and LAN synchronization.
- Native Flutter Android client with phone-only or paired setup, offline SQLite, encrypted pairing credentials, a transactional outbox, and explicit conflict recovery.
- Shared Folio Ledger design tokens, Switzer typography, accessible focus handling, and reduced-motion behavior.

## Immediate product-quality work

### Reliability and data safety

- Finish encrypted and authenticated synchronization transport; require an encrypted VPN until then.
- Add a per-record conflict review screen, sync diagnostics export, retry history, and “last successful sync” health checks.
- Verify restore files before replacing the database, retain pre-restore recovery snapshots, and periodically test backups automatically.
- Add schema migration versioning, crash reporting with opt-in redaction, structured logs, and database integrity checks.

### Daily quality of life

- Global command palette and cross-entity search for clients, orders, dishes, dates, venues, and phone numbers.
- Autosaved order drafts, undo for destructive actions, recent-items history, and keyboard shortcuts.
- Recurring-event and order templates, one-click cloning with adjustable dates, and bulk status/payment updates.
- Import assistants for contacts, dishes, orders, and prices from CSV/XLSX with preview and validation.
- Configurable reminders for deposits, final payments, preparation deadlines, and expiring quotations.
- Saved filters, custom table columns, compact/comfortable density, and printable filtered views.
- Customer/contact directory with event history, preferences, allergens, addresses, notes, and duplicate detection.
- Attachments for contracts, reference photos, permits, receipts, and venue documents.
- Better mobile workflows: large touch targets, offline indicator, quick payment capture, camera receipt attachment, and kitchen checklist mode.
- Accessible focus states, full keyboard operation, screen-reader labels, reduced-motion support, and contrast verification.

## Capabilities for growing catering companies

- Quotation and versioned proposal workflow with acceptance, deposits, taxes, discounts, terms, and branded email/PDF delivery.
- Inventory, recipe yields, ingredient quantities, stock reservations, wastage, purchase orders, and vendor price history.
- Staff scheduling, role requirements, assignments, shift confirmations, time tracking, and labor-cost forecasting.
- Venue logistics: rooms, equipment, delivery windows, travel time, loading notes, and conflict detection.
- Production planning: consolidated ingredient demand, preparation batches, labels, allergens, dietary requirements, and station-specific kitchen sheets.
- Customer communication timeline with templated email/SMS/WhatsApp integrations and delivery status.
- Payment-provider and accounting integrations with reconciliation, refunds, credit notes, and jurisdiction-aware taxes.
- Public API, scoped API keys, outbound webhooks, integration retries, and an integration audit log.

## Enterprise requirements

These are not merely UI features; they require a server-backed edition and operational controls.

- Organizations, branches, legal entities, warehouses, cost centers, and data residency boundaries.
- Granular RBAC and attribute-based permissions instead of the current admin/manager/viewer model.
- Immutable audit history for reads, exports, edits, approvals, authentication events, and device activity.
- SSO through OIDC/SAML, MFA, SCIM provisioning, session policy, device policy, and centralized revocation.
- Approval workflows for discounts, cancellations, purchasing, refunds, and contract changes.
- PostgreSQL-backed multi-tenant event storage, transactional outbox, durable job queues, and horizontally scalable sync gateways.
- High availability, point-in-time recovery, off-site encrypted backups, disaster-recovery drills, and defined RPO/RTO targets.
- Metrics, traces, alerting, support diagnostics, feature flags, staged rollouts, and backwards-compatible mobile protocol versions.
- Data retention, legal hold, export/deletion workflows, encryption-key rotation, and regional compliance controls.
- Analytics warehouse integration, scheduled reports, budget-versus-actuals, margin forecasting, and branch comparisons.

## Recommended editions

- **Folio Local:** desktop hub plus Android clients, SQLite, offline-first, best for one location and a small team.
- **Folio Business:** optional managed sync service, PostgreSQL, reliable remote access, integrations, audit trail, and multiple locations.
- **Folio Enterprise:** dedicated tenancy, SSO/SCIM, compliance controls, custom retention, advanced approvals, and service-level objectives.

Keeping these editions separate prevents a local-first installation from inheriting the cost and operational burden of an enterprise server while preserving a migration path through the same versioned sync protocol.
