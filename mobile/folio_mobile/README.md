# Folio Android

Native Flutter client for Folio Local. It does not host a LAN server. It can pair with Folio Desktop or run as an independent offline workspace on the phone.

## Available now

- Today, Orders, Calendar and Kitchen navigation
- Customers, Food Library, Reports and Settings
- native order creation and customer/dish editing
- SQLite offline workspace with transactional outbox
- secure desktop pairing and manual synchronization
- explicit conflict recovery
- local-data deletion
- Switzer typography and reduced-motion support

## Architecture

- `ui/`: lean views and `ChangeNotifier` view models
- `domain/`: immutable workspace models
- `data/repositories/`: local-first source of truth and sync policy
- `data/services/`: HTTP, secure storage and SQLite adapters

See `../../docs/FOLIO_MOBILE_ARCHITECTURE.md` for the sync contract, offline rules and release gates.

## Local verification

```bash
flutter pub get --enforce-lockfile
flutter analyze
flutter test
flutter run
```

Build optimized per-architecture APKs:

```bash
flutter build apk --release --split-per-abi
```

GitHub Actions uploads these as `folio-android-release-apks`. The current CI build uses the development signing configuration; configure an external release keystore before Play Store distribution.

## Current boundary

The Android client is not yet a complete replacement for every desktop workflow. Mobile role authentication, package-kit and payment parity, receipt/preparation exports, automatic retry, and QR scanning remain release gates. See `../../docs/FOLIO_MOBILE_ARCHITECTURE.md` for the authoritative list.
