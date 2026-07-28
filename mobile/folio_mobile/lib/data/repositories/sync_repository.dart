import 'dart:math';
import '../services/local_database_service.dart';
import '../services/secure_store_service.dart';
import '../services/sync_api_service.dart';
import '../../domain/models/sync_profile.dart';

class SyncRepository {
  SyncRepository({
    required this.database,
    required this.api,
    required this.secureStore,
  });
  final LocalDatabaseService database;
  final SyncApiService api;
  final SecureStoreService secureStore;
  Future<bool> isConfigured() async =>
      (await database.meta('workspace_mode')) != null;
  Future<SyncProfile?> profile() => secureStore.readProfile();
  Future<void> createLocalWorkspace() async {
    await database.setMeta('workspace_mode', 'local');
    await database.setMeta('revision', '0');
  }

  Future<void> pair({required String address, required String code}) async {
    final deviceId =
        'android-${DateTime.now().millisecondsSinceEpoch}-${Random.secure().nextInt(999999)}';
    final result = await api.pair(
      address: address,
      code: code,
      deviceId: deviceId,
    );
    final profile = SyncProfile(
      address: address.trim().replaceFirst(RegExp(r'/$'), ''),
      deviceId: deviceId,
      deviceToken: result.token,
    );
    final snapshot = await api.snapshot(
      address: profile.address,
      token: profile.deviceToken,
      path: result.snapshotUrl,
    );
    await database.saveSnapshot(snapshot.revision, snapshot.snapshot);
    await database.setMeta('workspace_mode', 'paired');
    await secureStore.writeProfile(profile);
  }
}
