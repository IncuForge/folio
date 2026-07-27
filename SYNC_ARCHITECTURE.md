# Folio Synchronization Architecture

## Operating model

Folio Desktop is the trusted workspace hub. Android clients remain fully usable offline and synchronize when they can reach the paired desktop over LAN, VPN, or a user-configured address. The system never requires a public cloud service.

## Safety invariants

1. Every workspace and device has a durable random identifier.
2. Pairing creates a revocable device credential; pairing codes are short-lived and single-use.
3. Every accepted synchronization commit has a monotonically increasing workspace revision and idempotency key.
4. A client stores its last confirmed base snapshot and revision before editing offline.
5. Reconnection uses a three-way merge: base, local, and current hub state.
6. Non-overlapping record changes merge automatically. Concurrent changes to the same record become explicit conflicts and are never silently discarded.
7. Deletes are compared against the base revision, preventing an offline device from resurrecting deleted records.
8. Database replacement is transactional and a recovery backup is written before applying a remote commit.
9. Pending uploads, acknowledgements, conflicts, cursors, and device credentials survive application restarts.
10. Logs contain identifiers and error codes, never credential hashes or customer payloads.

## Protocol milestones

- Pair: short-lived code plus QR payload establishes the device credential and downloads a base snapshot.
- Push: the client submits its base revision, idempotency key, and candidate snapshot.
- Conflict: when the hub moved, the client receives the current snapshot and performs a deterministic three-way merge.
- Commit: a conflict-free candidate is atomically assigned the next hub revision.
- Pull: clients poll or refresh on foreground and download commits newer than their cursor.
- Revoke: an administrator can invalidate a device credential immediately.

The initial transport is a versioned LAN HTTP API. Before calling it production-ready outside a trusted LAN or encrypted VPN, payload encryption, secure credential storage, request-size limits, rate limiting, and transport authentication must all be enabled.

## Scale boundary

This desktop-hub model is suitable for a single location or a small number of intermittently connected devices. Multi-site enterprises require an always-available synchronization service, tenant isolation, database-backed event storage, SSO, audit retention, centralized policy, and disaster-recovery operations. The protocol remains usable, but the hub implementation moves from one desktop to a managed service.