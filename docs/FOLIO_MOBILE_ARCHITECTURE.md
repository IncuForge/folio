# Folio Android Production Architecture

## Boundary

The Flutter application is a first-class Android client for Folio Local. It never opens a LAN server. Folio Desktop remains the optional synchronization hub; a phone may instead own an independent local workspace.

## Layers

```text
Views → ChangeNotifier ViewModels → Repositories → Services
                  ↓                    ↓
              UI state         SQLite / HTTP / secure storage
```

- Views render immutable state and forward intent.
- View models own loading, offline, error, conflict and command state.
- repositories are the source of truth for workspace and synchronization policy.
- services wrap SQLite, HTTP and encrypted credential storage.
- domain models isolate desktop snapshot field names from mobile presentation.

## Implemented workflows

- first-run choice between desktop pairing and a phone-only workspace;
- offline Today, Orders, Calendar, Kitchen, Customers, Food Library, Reports and Settings screens;
- validated native order creation plus customer and dish creation/editing;
- local receipt identity setting and explicit local-data erasure;
- manual pull/push against `/pair`, `/snapshot` and `/sync`;
- persistent revision and idempotent commit identifiers;
- transactional SQLite snapshot plus append-only mutation outbox;
- explicit `Keep phone changes` / `Use desktop copy` conflict recovery;
- encrypted pairing credentials and unmodified official Switzer OTF assets;
- Android system Back through Flutter `PopScope`, safe areas and reduced-motion behavior.

## Offline behavior

Every write updates the local snapshot and appends an outbox entry in one SQLite transaction. A failed request leaves both data and the commit identifier intact. Reads and edits never require the desktop. Successful synchronization advances the revision and clears the queue. Concurrent desktop changes do not overwrite phone work automatically; Settings asks the user which complete workspace to retain.

## Security and transport

Device tokens live only in Android encrypted storage. Plain HTTP is currently limited to the user-configured private LAN or VPN/Tailscale address. Internet-facing synchronization requires TLS and an authenticated relay; the Android client intentionally does not perform automatic public network discovery.

## Remaining release gates

1. Add authenticated mobile user sessions and enforce desktop role capabilities at the sync boundary.
2. Complete package-kit selection/management, order editing/deletion, payment recording, receipts and preparation exports.
3. Namespace the sync contract as `/v1/*` while retaining current endpoints for one desktop release.
4. Add migration and desktop/mobile contract fixtures for every backup schema version.
5. Add automatic retry with exponential backoff and jitter; manual retry is implemented now.
6. Add QR scanning and a TLS/certificate strategy for non-LAN deployments.
7. Add database migration, repository integration, accessibility and screenshot tests on physical Android devices.
8. Configure signing outside source control, Play release tracks and reproducible AAB CI.
9. Add backup import/export on Android if phone-only workspaces are intended for long-term standalone use.