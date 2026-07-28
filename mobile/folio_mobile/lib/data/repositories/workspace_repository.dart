import 'dart:convert';
import 'dart:math';
import '../../domain/models/folio_workspace.dart';
import '../services/local_database_service.dart';
import '../services/secure_store_service.dart';
import '../services/sync_api_service.dart';

class WorkspaceSyncConflict implements Exception {
  const WorkspaceSyncConflict(this.message);
  final String message;
  @override
  String toString() => message;
}

class WorkspaceRepository {
  WorkspaceRepository({
    required this.database,
    required this.api,
    required this.secureStore,
  });
  final LocalDatabaseService database;
  final SyncApiService api;
  final SecureStoreService secureStore;

  Future<Map<String, dynamic>> load() async {
    final existing = await database.latestSnapshot();
    if (existing != null) return existing;
    final snapshot = _emptySnapshot();
    await database.saveSnapshot(0, snapshot);
    return snapshot;
  }

  Future<String> mode() async =>
      await database.meta('workspace_mode') ?? 'local';
  Future<bool> isDirty() => database.isDirty();
  Future<int> revision() => database.revision();

  List<FolioOrder> orders(Map<String, dynamic> snapshot) =>
      _rows(
          snapshot,
          'orders',
        ).where((row) => !_deleted(row)).map(FolioOrder.fromJson).toList()
        ..sort((a, b) => a.eventDate.compareTo(b.eventDate));
  List<FolioContact> contacts(Map<String, dynamic> snapshot) =>
      _rows(
          snapshot,
          'contacts',
        ).where((row) => !_deleted(row)).map(FolioContact.fromJson).toList()
        ..sort((a, b) => a.name.compareTo(b.name));
  List<FolioItem> items(Map<String, dynamic> snapshot) =>
      _rows(
          snapshot,
          'items',
        ).where((row) => !_deleted(row)).map(FolioItem.fromJson).toList()
        ..sort((a, b) => a.name.compareTo(b.name));

  Map<String, String> settings(Map<String, dynamic> snapshot) => {
    for (final row in _rows(snapshot, 'settings'))
      '${row['key']}': '${row['value'] ?? ''}',
  };

  Future<Map<String, dynamic>> addOrder(
    Map<String, dynamic> snapshot,
    FolioOrder order,
  ) => _replace(snapshot, 'orders', order.toJson());
  Future<Map<String, dynamic>> addContact(
    Map<String, dynamic> snapshot,
    FolioContact contact,
  ) => _replace(snapshot, 'contacts', contact.toJson());
  Future<Map<String, dynamic>> addItem(
    Map<String, dynamic> snapshot,
    FolioItem item,
  ) => _replace(snapshot, 'items', item.toJson());

  Future<Map<String, dynamic>> saveSetting(
    Map<String, dynamic> snapshot,
    String key,
    String value,
  ) => _replace(snapshot, 'settings', {'key': key, 'value': value});

  Future<Map<String, dynamic>> _replace(
    Map<String, dynamic> snapshot,
    String table,
    Map<String, dynamic> row,
  ) async {
    final next = _copy(snapshot);
    final rows = _rows(next, table);
    final key = table == 'settings' ? 'key' : 'id';
    rows.removeWhere((candidate) => '${candidate[key]}' == '${row[key]}');
    rows.add(row);
    next['createdAt'] = DateTime.now().toUtc().toIso8601String();
    final commitId = _id('android-commit');
    await database.saveLocalMutation(
      revision: await database.revision(),
      snapshot: next,
      entityType: table,
      entityId: '',
      operation: 'upsert',
      payload: row,
      commitId: commitId,
    );
    return next;
  }

  Future<Map<String, dynamic>> syncNow(Map<String, dynamic> local) async {
    final profile = await secureStore.readProfile();
    if (profile == null) {
      await database.saveSnapshot(await database.revision(), local);
      return local;
    }
    final baseRevision = await database.revision();
    if (!await database.isDirty()) {
      final remote = await api.snapshot(
        address: profile.address,
        token: profile.deviceToken,
      );
      await database.saveSnapshot(remote.revision, remote.snapshot);
      await database.clearSyncQueue();
      return remote.snapshot;
    }
    final result = await api.commit(
      address: profile.address,
      token: profile.deviceToken,
      baseRevision: baseRevision,
      snapshot: local,
      commitId:
          await database.meta('pending_commit_id') ?? _id('android-commit'),
    );
    if (result.accepted) {
      await database.saveSnapshot(result.revision, local);
      await database.clearSyncQueue();
      return local;
    }
    if (result.snapshot != null) {
      throw const WorkspaceSyncConflict(
        'This workspace changed on the desktop. Your phone changes are safe; choose which copy to keep in Settings.',
      );
    }
    throw Exception(
      result.error ?? 'The desktop rejected this synchronization.',
    );
  }

  Future<Map<String, dynamic>> useDesktopCopy() async {
    final profile = await secureStore.readProfile();
    if (profile == null) {
      throw Exception('This phone is not paired with a desktop.');
    }
    final remote = await api.snapshot(
      address: profile.address,
      token: profile.deviceToken,
    );
    await database.saveSnapshot(remote.revision, remote.snapshot);
    await database.clearSyncQueue();
    return remote.snapshot;
  }

  Future<Map<String, dynamic>> keepPhoneCopy(Map<String, dynamic> local) async {
    final profile = await secureStore.readProfile();
    if (profile == null) return local;
    final remote = await api.snapshot(
      address: profile.address,
      token: profile.deviceToken,
    );
    final result = await api.commit(
      address: profile.address,
      token: profile.deviceToken,
      baseRevision: remote.revision,
      snapshot: local,
      commitId:
          await database.meta('pending_commit_id') ?? _id('android-resolve'),
    );
    if (!result.accepted) {
      throw Exception(
        result.error ?? 'The workspace changed again. Try once more.',
      );
    }
    await database.saveSnapshot(result.revision, local);
    await database.clearSyncQueue();
    return local;
  }

  Future<void> clear() async {
    await database.clearWorkspace();
    await secureStore.clear();
  }

  List<Map<String, dynamic>> _rows(
    Map<String, dynamic> snapshot,
    String table,
  ) {
    final tables = snapshot['tables'] as Map<String, dynamic>;
    final values = tables[table] as List<dynamic>? ?? <dynamic>[];
    return values
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList(growable: true)
      ..also((rows) => tables[table] = rows);
  }

  bool _deleted(Map<String, dynamic> row) =>
      row['is_deleted'] == true || row['is_deleted'] == 1;
  Map<String, dynamic> _copy(Map<String, dynamic> value) =>
      jsonDecode(jsonEncode(value)) as Map<String, dynamic>;

  Map<String, dynamic> _emptySnapshot() {
    const names = [
      'items',
      'packages',
      'package_items',
      'orders',
      'order_items',
      'users',
      'settings',
      'contacts',
      'drafts',
      'attachments',
      'reminders',
      'saved_views',
      'recent_items',
      'audit_log',
      'undo_log',
      'role_permissions',
    ];
    final tables = <String, dynamic>{
      for (final name in names) name: <Map<String, dynamic>>[],
    };
    tables['users'] = [
      {
        'id': _id('user'),
        'username': 'owner',
        'password_hash': '',
        'role': 'admin',
      },
    ];
    tables['settings'] = [
      {'key': 'currencyCode', 'value': 'INR'},
      {'key': 'pdfBrandName', 'value': 'Folio'},
    ];
    return {
      'format': 'folio.backup',
      'version': 3,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'appVersion': '1.0.0',
      'source': 'desktop',
      'tables': tables,
    };
  }

  String _id(String prefix) =>
      '$prefix-${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
}

extension<T> on T {
  T also(void Function(T value) callback) {
    callback(this);
    return this;
  }
}
