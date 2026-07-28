import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../domain/models/sync_profile.dart';

class SecureStoreService {
  static const _storage = FlutterSecureStorage();
  Future<SyncProfile?> readProfile() async {
    final values = await _storage.readAll();
    final address = values['sync_address'],
        id = values['device_id'],
        token = values['device_token'];
    return address == null || id == null || token == null
        ? null
        : SyncProfile(address: address, deviceId: id, deviceToken: token);
  }

  Future<void> writeProfile(SyncProfile value) async {
    await Future.wait([
      _storage.write(key: 'sync_address', value: value.address),
      _storage.write(key: 'device_id', value: value.deviceId),
      _storage.write(key: 'device_token', value: value.deviceToken),
    ]);
  }

  Future<void> clear() => _storage.deleteAll();
}
